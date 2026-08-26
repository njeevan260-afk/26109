import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from app.core.database import supabase

logger = logging.getLogger(__name__)
DEFAULT_ARTIFACT_PATH = (
    Path(__file__).resolve().parents[2] / "artifacts" / "mastitis-risk-model.joblib"
)
MODEL_ARTIFACT_PATH = Path(os.getenv("MODEL_ARTIFACT_PATH", str(DEFAULT_ARTIFACT_PATH)))


class MastitisRiskModel:
    def __init__(self):
        self.model_7d = None
        self.model_14d = None
        self.feature_names = []
        self.feature_importance_7d = {}
        self.is_trained = False
        self.trained_at = None

    def save_model(self):
        if not self.is_trained:
            return False
        MODEL_ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "artifact_version": 1,
                "model_7d": self.model_7d,
                "model_14d": self.model_14d,
                "feature_names": self.feature_names,
                "feature_importance_7d": self.feature_importance_7d,
                "trained_at": self.trained_at,
            },
            MODEL_ARTIFACT_PATH,
        )
        return True

    def load_model(self):
        if not MODEL_ARTIFACT_PATH.exists():
            return False
        try:
            artifact = joblib.load(MODEL_ARTIFACT_PATH)
            if artifact.get("artifact_version") != 1:
                logger.warning("Ignoring incompatible model artifact")
                return False
            self.model_7d = artifact["model_7d"]
            self.model_14d = artifact["model_14d"]
            self.feature_names = artifact["feature_names"]
            self.feature_importance_7d = artifact["feature_importance_7d"]
            self.trained_at = artifact.get("trained_at")
            self.is_trained = True
            logger.info("Loaded model artifact from %s", MODEL_ARTIFACT_PATH)
            return True
        except Exception as exc:
            logger.exception("Could not load model artifact: %s", exc)
            self.is_trained = False
            return False

    def status(self):
        return {
            "mode": "random_forest" if self.is_trained else "heuristic",
            "trained": self.is_trained,
            "trained_at": self.trained_at,
            "feature_count": len(self.feature_names),
            "artifact_path": str(MODEL_ARTIFACT_PATH),
            "training_data": "simulated threshold labels",
            "clinically_validated": False,
        }

    def fetch_training_data(self, animal_id=None):
        """Fetch all sensor rows using pagination; Supabase defaults to 1,000."""
        try:
            rows = []
            page_size = 1000
            start = 0
            while True:
                query = (
                    supabase.table("sensor_readings")
                    .select("animal_id, sensor_type, value, reading_time")
                    .order("reading_time")
                )
                if animal_id:
                    query = query.eq("animal_id", animal_id)
                response = query.range(start, start + page_size - 1).execute()
                page = response.data or []
                rows.extend(page)
                if len(page) < page_size:
                    break
                start += page_size
            return pd.DataFrame(rows)
        except Exception as exc:
            logger.exception("Could not fetch training data: %s", exc)
            return pd.DataFrame()

    def fetch_animal_baselines(self):
        try:
            response = (
                supabase.table("animals")
                .select("id, tag_number, baseline_ec, baseline_temp")
                .execute()
            )
            return pd.DataFrame(response.data or [])
        except Exception as exc:
            logger.exception("Could not fetch animal baselines: %s", exc)
            return pd.DataFrame()

    @staticmethod
    def _samples_per_day(frame):
        if "reading_time" not in frame.columns or len(frame) < 2:
            return 1
        times = pd.to_datetime(
            frame["reading_time"], errors="coerce", utc=True
        ).dropna().sort_values()
        positive_deltas = times.diff().dropna().dt.total_seconds()
        positive_deltas = positive_deltas[positive_deltas > 0]
        if positive_deltas.empty:
            return 1
        return max(1, min(1440, int(round(86400 / float(positive_deltas.median())))))

    @staticmethod
    def _future_max(series, window):
        """Maximum of the next window samples, excluding the current sample."""
        return series.shift(-1)[::-1].rolling(window, min_periods=1).max()[::-1]

    def engineer_features(self, readings_df, baselines_df):
        """Create sampling-rate-aware features for each animal."""
        if readings_df.empty:
            logger.warning("No readings are available for feature engineering")
            return pd.DataFrame()

        readings = readings_df.copy()
        readings["reading_time"] = pd.to_datetime(
            readings["reading_time"], errors="coerce", utc=True
        )
        readings = readings.dropna(
            subset=["animal_id", "reading_time", "sensor_type", "value"]
        )
        readings["sensor_type"] = readings["sensor_type"].astype(str).str.upper()
        readings = readings[readings["sensor_type"].isin(["EC", "TEMP"])]
        if readings.empty:
            logger.warning("No EC or TEMP readings were found")
            return pd.DataFrame()

        pivot = readings.pivot_table(
            index=["animal_id", "reading_time"],
            columns="sensor_type",
            values="value",
        ).reset_index()
        pivot.rename(columns={"EC": "ec", "TEMP": "temp"}, inplace=True)
        if "ec" not in pivot.columns or "temp" not in pivot.columns:
            logger.warning("EC or TEMP is missing after pivoting sensor readings")
            return pd.DataFrame()
        pivot = pivot.sort_values(["animal_id", "reading_time"])

        features = []
        for animal_id in pivot["animal_id"].unique():
            animal = pivot[pivot["animal_id"] == animal_id].copy()
            samples_per_day = self._samples_per_day(animal)
            windows = {
                1: samples_per_day,
                3: 3 * samples_per_day,
                7: 7 * samples_per_day,
                14: 14 * samples_per_day,
            }

            baseline = baselines_df[baselines_df["id"] == animal_id]
            if baseline.empty:
                baseline_ec, baseline_temp = 4.2, 38.5
            else:
                row = baseline.iloc[0]
                baseline_ec = float(row["baseline_ec"]) if pd.notna(row["baseline_ec"]) else 4.2
                baseline_temp = float(row["baseline_temp"]) if pd.notna(row["baseline_temp"]) else 38.5

            animal["ec_rolling_3d"] = animal["ec"].rolling(windows[3], min_periods=1).mean()
            animal["ec_rolling_7d"] = animal["ec"].rolling(windows[7], min_periods=1).mean()
            animal["temp_rolling_3d"] = animal["temp"].rolling(windows[3], min_periods=1).mean()
            animal["temp_rolling_7d"] = animal["temp"].rolling(windows[7], min_periods=1).mean()
            animal["ec_slope_7d"] = animal["ec"].diff(windows[7]) / 7
            animal["temp_slope_7d"] = animal["temp"].diff(windows[7]) / 7
            animal["ec_deviation"] = (animal["ec"] - baseline_ec) / baseline_ec
            animal["temp_deviation"] = (animal["temp"] - baseline_temp) / baseline_temp

            for days in (1, 3, 7):
                animal[f"ec_lag_{days}d"] = animal["ec"].shift(windows[days])
                animal[f"temp_lag_{days}d"] = animal["temp"].shift(windows[days])

            animal["future_ec_max_7d"] = self._future_max(animal["ec"], windows[7])
            animal["future_temp_max_7d"] = self._future_max(animal["temp"], windows[7])
            animal["future_ec_max_14d"] = self._future_max(animal["ec"], windows[14])
            animal["future_temp_max_14d"] = self._future_max(animal["temp"], windows[14])
            animal["label_7d"] = (
                (animal["future_ec_max_7d"] > 6.0)
                | (animal["future_temp_max_7d"] > 39.5)
            ).astype(int)
            animal["label_14d"] = (
                (animal["future_ec_max_14d"] > 6.0)
                | (animal["future_temp_max_14d"] > 39.5)
            ).astype(int)
            features.append(animal)

        if not features:
            return pd.DataFrame()
        result = pd.concat(features, ignore_index=True).dropna()
        logger.info("Engineered %s model rows", len(result))
        return result

    def train_model(self):
        """Train prototype Random Forest models on the available data."""
        try:
            readings = self.fetch_training_data()
            baselines = self.fetch_animal_baselines()
            if readings.empty:
                logger.error("No readings found; ingest data before training")
                return None

            feature_df = self.engineer_features(readings, baselines)
            if feature_df.empty:
                logger.error("Feature engineering produced no training rows")
                return None

            excluded = {
                "animal_id",
                "reading_time",
                "label_7d",
                "label_14d",
                "future_ec_max_7d",
                "future_temp_max_7d",
                "future_ec_max_14d",
                "future_temp_max_14d",
            }
            self.feature_names = [column for column in feature_df.columns if column not in excluded]
            x = feature_df[self.feature_names]
            y_7d = feature_df["label_7d"]
            y_14d = feature_df["label_14d"]
            if y_7d.nunique() < 2 or y_14d.nunique() < 2:
                logger.error("Training labels contain one class; keeping heuristic mode")
                self.is_trained = False
                return None

            self.model_7d = RandomForestClassifier(
                n_estimators=100, random_state=42, class_weight="balanced"
            ).fit(x, y_7d)
            self.model_14d = RandomForestClassifier(
                n_estimators=100, random_state=42, class_weight="balanced"
            ).fit(x, y_14d)
            self.feature_importance_7d = dict(
                zip(self.feature_names, self.model_7d.feature_importances_)
            )
            self.is_trained = True
            self.trained_at = datetime.now(timezone.utc).isoformat()
            self.save_model()
            logger.info("Prototype models trained with %s rows", len(x))
            return self
        except Exception as exc:
            logger.exception("Training failed: %s", exc)
            self.is_trained = False
            return None

    def _animal_baseline(self, animal_id):
        response = (
            supabase.table("animals")
            .select("baseline_ec, baseline_temp, tag_number")
            .eq("id", animal_id)
            .limit(1)
            .execute()
        )
        if response.data:
            row = response.data[0]
            return (
                float(row.get("baseline_ec") or 4.2),
                float(row.get("baseline_temp") or 38.5),
                row.get("tag_number") or animal_id[:8],
            )
        return 4.2, 38.5, animal_id[:8]

    @staticmethod
    def _prepare_readings(current_readings):
        if current_readings is None or getattr(current_readings, "empty", True):
            return pd.DataFrame(columns=["sensor_type", "value", "reading_time"])
        readings = current_readings.copy()
        for column, default in (
            ("sensor_type", ""),
            ("value", 0),
            ("reading_time", pd.NaT),
        ):
            if column not in readings.columns:
                readings[column] = default
        readings["sensor_type"] = readings["sensor_type"].astype(str).str.upper()
        readings["value"] = pd.to_numeric(readings["value"], errors="coerce")
        readings["reading_time"] = pd.to_datetime(
            readings["reading_time"], errors="coerce", utc=True
        )
        return readings.dropna(subset=["value"]).sort_values("reading_time")

    @staticmethod
    def _lag_value(frame, rows, fallback):
        return float(frame["value"].iloc[-rows]) if len(frame) >= rows else float(fallback)

    @staticmethod
    def _positive_probability(model, feature_vector):
        classes = list(model.classes_)
        if 1 not in classes:
            return 0.0
        return float(model.predict_proba(feature_vector)[0][classes.index(1)])

    @staticmethod
    def _risk_category(risk_7d):
        if risk_7d > 0.7:
            return "HIGH"
        if risk_7d > 0.4:
            return "MODERATE"
        if risk_7d > 0.2:
            return "LOW"
        return "NONE"

    def predict_risk(self, animal_id, current_readings):
        """Predict risk, falling back to clearly labelled heuristic mode."""
        if not self.is_trained or self.model_7d is None or not self.feature_names:
            return self._heuristic_predict(animal_id, current_readings)

        try:
            baseline_ec, baseline_temp, tag = self._animal_baseline(animal_id)
            readings = self._prepare_readings(current_readings)
            ec_df = readings[readings["sensor_type"] == "EC"]
            temp_df = readings[readings["sensor_type"] == "TEMP"]
            if ec_df.empty or temp_df.empty:
                return self._heuristic_predict(animal_id, current_readings)

            latest_ec = float(ec_df.iloc[-1]["value"])
            latest_temp = float(temp_df.iloc[-1]["value"])
            samples_per_day = max(
                self._samples_per_day(ec_df), self._samples_per_day(temp_df)
            )
            window_3d = 3 * samples_per_day
            window_7d = 7 * samples_per_day
            ec_deviation = (latest_ec - baseline_ec) / baseline_ec
            temp_deviation = (latest_temp - baseline_temp) / baseline_temp

            feature_dict = {
                "ec": latest_ec,
                "temp": latest_temp,
                "ec_rolling_3d": float(ec_df["value"].tail(window_3d).mean()),
                "ec_rolling_7d": float(ec_df["value"].tail(window_7d).mean()),
                "temp_rolling_3d": float(temp_df["value"].tail(window_3d).mean()),
                "temp_rolling_7d": float(temp_df["value"].tail(window_7d).mean()),
                "ec_slope_7d": (latest_ec - self._lag_value(ec_df, window_7d, latest_ec)) / 7,
                "temp_slope_7d": (latest_temp - self._lag_value(temp_df, window_7d, latest_temp)) / 7,
                "ec_deviation": ec_deviation,
                "temp_deviation": temp_deviation,
                "ec_lag_1d": self._lag_value(ec_df, samples_per_day, latest_ec),
                "ec_lag_3d": self._lag_value(ec_df, window_3d, latest_ec),
                "ec_lag_7d": self._lag_value(ec_df, window_7d, latest_ec),
                "temp_lag_1d": self._lag_value(temp_df, samples_per_day, latest_temp),
                "temp_lag_3d": self._lag_value(temp_df, window_3d, latest_temp),
                "temp_lag_7d": self._lag_value(temp_df, window_7d, latest_temp),
            }
            feature_vector = pd.DataFrame([feature_dict]).reindex(
                columns=self.feature_names, fill_value=0.0
            ).fillna(0.0)
            risk_7d = self._positive_probability(self.model_7d, feature_vector)
            risk_14d = self._positive_probability(self.model_14d, feature_vector)
            factors = {
                name: round(float(value), 3)
                for name, value in sorted(
                    self.feature_importance_7d.items(),
                    key=lambda item: item[1],
                    reverse=True,
                )[:4]
            }
            category = self._risk_category(risk_7d)
            return self._enrich_payload(
                {
                    "tag_number": tag,
                    "risk_7day": round(risk_7d, 3),
                    "risk_14day": round(risk_14d, 3),
                    "category": category,
                    "factors": factors,
                    "baseline_ec": baseline_ec,
                    "baseline_temp": baseline_temp,
                    "latest_ec": round(latest_ec, 3),
                    "latest_temp": round(latest_temp, 2),
                    "ec_deviation": round(ec_deviation * 100, 1),
                    "temp_deviation": round(temp_deviation * 100, 1),
                    "recommendations": self._get_recommendations(category),
                    "model_mode": "random_forest",
                    "note": "Prototype model trained on simulated threshold labels",
                }
            )
        except Exception as exc:
            logger.exception("Prediction failed for %s: %s", animal_id, exc)
            return self._heuristic_predict(animal_id, current_readings)

    def _heuristic_predict(self, animal_id, current_readings):
        """Threshold fallback that is always labelled as heuristic."""
        try:
            baseline_ec, baseline_temp, tag = self._animal_baseline(animal_id)
            readings = self._prepare_readings(current_readings)
            ec_df = readings[readings["sensor_type"] == "EC"]
            temp_df = readings[readings["sensor_type"] == "TEMP"]
            latest_ec = float(ec_df.iloc[-1]["value"]) if not ec_df.empty else baseline_ec
            latest_temp = float(temp_df.iloc[-1]["value"]) if not temp_df.empty else baseline_temp
            ec_dev = (latest_ec - baseline_ec) / baseline_ec
            temp_dev = (latest_temp - baseline_temp) / baseline_temp

            if latest_ec > 6.0 or latest_temp > 39.5:
                risk_7d, risk_14d = 0.85, 0.92
                factors = {"ec_threshold": 0.40, "temp_threshold": 0.35, "deviation": 0.25}
            elif latest_ec > 5.0 or latest_temp > 39.0:
                risk_7d, risk_14d = 0.55, 0.65
                factors = {"ec_trend": 0.35, "deviation": 0.30, "temp": 0.20}
            elif latest_ec > 4.5 or latest_temp > 38.5:
                risk_7d, risk_14d = 0.25, 0.35
                factors = {"baseline_deviation": 0.50, "ec": 0.30, "temp": 0.20}
            else:
                risk_7d, risk_14d = 0.05, 0.10
                factors = {"stable": 0.60, "normal_ec": 0.40}

            category = self._risk_category(risk_7d)
            return self._enrich_payload(
                {
                    "tag_number": tag,
                    "risk_7day": risk_7d,
                    "risk_14day": risk_14d,
                    "category": category,
                    "factors": factors,
                    "baseline_ec": baseline_ec,
                    "baseline_temp": baseline_temp,
                    "latest_ec": round(latest_ec, 3),
                    "latest_temp": round(latest_temp, 2),
                    "ec_deviation": round(ec_dev * 100, 1),
                    "temp_deviation": round(temp_dev * 100, 1),
                    "recommendations": self._get_recommendations(category),
                    "model_mode": "heuristic",
                    "note": "Heuristic fallback; not a clinically validated forecast",
                }
            )
        except Exception as exc:
            logger.exception("Heuristic fallback failed for %s: %s", animal_id, exc)
            return self._absolute_fallback()

    @staticmethod
    def _get_recommendations(category):
        if category == "HIGH":
            return [
                "Inspect the udder for clinical signs immediately",
                "Review milking hygiene and equipment calibration",
                "Separate and monitor the animal closely",
                "Contact a veterinarian for confirmation",
            ]
        if category == "MODERATE":
            return [
                "Schedule a clinical examination within 48 hours",
                "Review housing and bedding hygiene",
                "Monitor EC and temperature at every milking",
                "Consider a California Mastitis Test",
            ]
        if category == "LOW":
            return [
                "Continue routine monitoring",
                "Maintain milking hygiene standards",
                "Review risk factors during the next herd check",
            ]
        return ["No immediate action is indicated; continue routine monitoring"]

    @staticmethod
    def _enrich_payload(payload):
        """Normalize explanation fields without inventing unmeasured vitals."""
        factors = payload.get("factors") or {}
        payload["factors"] = {
            "ec_trend": float(
                factors.get("ec_trend", factors.get("ec_threshold", factors.get("ec", 0.0)))
            ),
            "temp_deviation": float(
                factors.get(
                    "temp_deviation", factors.get("temp_threshold", factors.get("temp", 0.0))
                )
            ),
            "history": float(factors.get("history", factors.get("deviation", 0.0))),
            "rolling_avg": float(factors.get("rolling_avg", factors.get("stable", 0.0))),
            **{
                key: float(value)
                for key, value in factors.items()
                if isinstance(value, (int, float))
            },
        }
        return payload

    def _absolute_fallback(self):
        return self._enrich_payload(
            {
                "tag_number": "Unknown",
                "risk_7day": 0.0,
                "risk_14day": 0.0,
                "category": "NONE",
                "factors": {"data_unavailable": 1.0},
                "baseline_ec": 4.2,
                "baseline_temp": 38.5,
                "latest_ec": 4.2,
                "latest_temp": 38.5,
                "ec_deviation": 0,
                "temp_deviation": 0,
                "recommendations": [
                    "Sensor data is unavailable; check the device connection"
                ],
                "model_mode": "unavailable",
                "note": "Prediction unavailable",
            }
        )


risk_model = MastitisRiskModel()
risk_model.load_model()


def get_or_train_model():
    """Return immediately; background training is triggered by simulation."""
    return risk_model


def heuristic_fallback(animal_id, current_readings=None):
    if current_readings is None:
        current_readings = pd.DataFrame()
    try:
        return risk_model._heuristic_predict(animal_id, current_readings)
    except Exception:
        return risk_model._absolute_fallback()
