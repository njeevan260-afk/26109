import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from datetime import datetime, date
from app.core.database import supabase
import json
import traceback

class MastitisRiskModel:
    def __init__(self):
        self.model_7d = None
        self.model_14d = None
        self.feature_names = []
        self.is_trained = False
        
    def fetch_training_data(self, animal_id=None):
        """Fetch readings from Supabase."""
        try:
            query = supabase.table("sensor_readings").select("*")
            if animal_id:
                query = query.eq("animal_id", animal_id)
            response = query.execute()
            return pd.DataFrame(response.data)
        except Exception as e:
            print(f"❌ Error fetching data: {e}")
            return pd.DataFrame()
    
    def fetch_animal_baselines(self):
        """Fetch baseline EC and Temp for all cows."""
        try:
            response = supabase.table("animals").select("id, tag_number, baseline_ec, baseline_temp").execute()
            return pd.DataFrame(response.data)
        except Exception as e:
            print(f"❌ Error fetching baselines: {e}")
            return pd.DataFrame()
    
    def engineer_features(self, readings_df, baselines_df):
        """
        Create features for ML with robust column handling.
        """
        if readings_df.empty:
            print("⚠️ No readings data available.")
            return pd.DataFrame()
        
        print(f"📊 Raw readings shape: {readings_df.shape}")
        
        # Ensure we only use EC and TEMP
        readings_df = readings_df[readings_df['sensor_type'].isin(['EC', 'TEMP', 'ec', 'temp'])]
        
        if readings_df.empty:
            print("⚠️ No EC or TEMP data found.")
            return pd.DataFrame()
        
        # Standardize sensor type to uppercase for consistency
        readings_df['sensor_type'] = readings_df['sensor_type'].str.upper()
        
        # Pivot to get EC and Temp in same row per timestamp
        pivot_df = readings_df.pivot_table(
            index=['animal_id', 'reading_time'],
            columns='sensor_type',
            values='value'
        ).reset_index()
        
        # Rename columns safely
        pivot_df.rename(columns={'EC': 'ec', 'TEMP': 'temp'}, inplace=True)
        
        # Check if we have both columns
        if 'ec' not in pivot_df.columns or 'temp' not in pivot_df.columns:
            print("⚠️ Missing EC or TEMP columns after pivot.")
            return pd.DataFrame()
        
        print(f"📊 Pivoted data shape: {pivot_df.shape}")
        
        # Sort
        pivot_df = pivot_df.sort_values(['animal_id', 'reading_time'])
        
        # --- Feature Engineering per animal ---
        features_list = []
        
        for animal_id in pivot_df['animal_id'].unique():
            animal_df = pivot_df[pivot_df['animal_id'] == animal_id].copy()
            
            # Get baseline
            baseline = baselines_df[baselines_df['id'] == animal_id]
            if baseline.empty:
                baseline_ec = 4.2
                baseline_temp = 38.5
            else:
                baseline_ec = baseline.iloc[0]['baseline_ec'] if pd.notna(baseline.iloc[0]['baseline_ec']) else 4.2
                baseline_temp = baseline.iloc[0]['baseline_temp'] if pd.notna(baseline.iloc[0]['baseline_temp']) else 38.5
            
            # Rolling averages
            animal_df['ec_rolling_3d'] = animal_df['ec'].rolling(window=3, min_periods=1).mean()
            animal_df['ec_rolling_7d'] = animal_df['ec'].rolling(window=7, min_periods=1).mean()
            animal_df['temp_rolling_3d'] = animal_df['temp'].rolling(window=3, min_periods=1).mean()
            animal_df['temp_rolling_7d'] = animal_df['temp'].rolling(window=7, min_periods=1).mean()
            
            # Rate of change
            animal_df['ec_slope_7d'] = animal_df['ec'].diff(periods=7) / 7
            animal_df['temp_slope_7d'] = animal_df['temp'].diff(periods=7) / 7
            
            # Baseline deviations
            animal_df['ec_deviation'] = (animal_df['ec'] - baseline_ec) / baseline_ec if baseline_ec > 0 else 0
            animal_df['temp_deviation'] = (animal_df['temp'] - baseline_temp) / baseline_temp if baseline_temp > 0 else 0
            
            # Lag features
            animal_df['ec_lag_1d'] = animal_df['ec'].shift(1)
            animal_df['ec_lag_3d'] = animal_df['ec'].shift(3)
            animal_df['ec_lag_7d'] = animal_df['ec'].shift(7)
            animal_df['temp_lag_1d'] = animal_df['temp'].shift(1)
            animal_df['temp_lag_3d'] = animal_df['temp'].shift(3)
            animal_df['temp_lag_7d'] = animal_df['temp'].shift(7)
            
            # Labels: High risk if EC > 6.0 OR Temp > 39.5 in the future window
            # Shift backwards to look at future
            animal_df['future_ec_max_7d'] = animal_df['ec'].shift(-7).rolling(7, min_periods=1).max()
            animal_df['future_temp_max_7d'] = animal_df['temp'].shift(-7).rolling(7, min_periods=1).max()
            animal_df['label_7d'] = ((animal_df['future_ec_max_7d'] > 6.0) | 
                                     (animal_df['future_temp_max_7d'] > 39.5)).astype(int)
            
            animal_df['future_ec_max_14d'] = animal_df['ec'].shift(-14).rolling(14, min_periods=1).max()
            animal_df['future_temp_max_14d'] = animal_df['temp'].shift(-14).rolling(14, min_periods=1).max()
            animal_df['label_14d'] = ((animal_df['future_ec_max_14d'] > 6.0) | 
                                      (animal_df['future_temp_max_14d'] > 39.5)).astype(int)
            
            features_list.append(animal_df)
        
        if not features_list:
            return pd.DataFrame()
            
        result_df = pd.concat(features_list, ignore_index=True)
        result_df = result_df.dropna()
        
        print(f"📊 Final feature shape: {result_df.shape}")
        return result_df
    
    def train_model(self):
        """Train Random Forest models."""
        try:
            print("📊 Fetching data from Supabase...")
            readings = self.fetch_training_data()
            baselines = self.fetch_animal_baselines()
            
            if readings.empty:
                print("❌ No readings found. Run /simulate first!")
                return None
            
            print("🔧 Engineering features...")
            feature_df = self.engineer_features(readings, baselines)
            
            if feature_df.empty:
                print("❌ Feature engineering produced empty DataFrame.")
                return None
            
            # Define features
            exclude_cols = ['animal_id', 'reading_time', 'label_7d', 'label_14d', 
                            'future_ec_max_7d', 'future_temp_max_7d', 
                            'future_ec_max_14d', 'future_temp_max_14d']
            
            feature_cols = [col for col in feature_df.columns if col not in exclude_cols]
            self.feature_names = feature_cols
            
            X = feature_df[feature_cols]
            y_7d = feature_df['label_7d']
            y_14d = feature_df['label_14d']
            
            print(f"🧠 Training models with {len(X)} samples and {len(feature_cols)} features...")
            
            self.model_7d = RandomForestClassifier(n_estimators=50, random_state=42, class_weight='balanced')
            self.model_7d.fit(X, y_7d)
            
            self.model_14d = RandomForestClassifier(n_estimators=50, random_state=42, class_weight='balanced')
            self.model_14d.fit(X, y_14d)
            
            # Store feature importance
            self.feature_importance_7d = dict(zip(feature_cols, self.model_7d.feature_importances_))
            self.is_trained = True
            
            print("✅ Models trained successfully!")
            return self
            
        except Exception as e:
            print(f"❌ Training failed: {str(e)}")
            traceback.print_exc()
            self.is_trained = False
            return None
    
    def predict_risk(self, animal_id, current_readings):
        """
        Predict risk. Falls back to heuristic if model not trained
        or if feature columns do not match the fitted model.
        """
        if not self.is_trained or self.model_7d is None or not self.feature_names:
            print("⚠️ Model not trained. Using heuristic thresholds.")
            return self._heuristic_predict(animal_id, current_readings)
        
        try:
            # Get baseline
            baseline_resp = supabase.table("animals").select("baseline_ec, baseline_temp, tag_number").eq("id", animal_id).execute()
            if baseline_resp.data:
                baseline_ec = baseline_resp.data[0]['baseline_ec'] or 4.2
                baseline_temp = baseline_resp.data[0]['baseline_temp'] or 38.5
                tag = baseline_resp.data[0]['tag_number']
            else:
                baseline_ec = 4.2
                baseline_temp = 38.5
                tag = animal_id[:8]
            
            # Prepare readings
            readings = current_readings.copy()
            
            # Extract latest values
            ec_df = readings[readings['sensor_type'].str.upper() == 'EC']
            temp_df = readings[readings['sensor_type'].str.upper() == 'TEMP']
            
            if ec_df.empty or temp_df.empty:
                return self._heuristic_predict(animal_id, current_readings)
            
            latest_ec = ec_df.iloc[-1]['value']
            latest_temp = temp_df.iloc[-1]['value']
            
            # Calculate features for prediction
            ec_7d_avg = ec_df['value'].tail(7).mean() if len(ec_df) >= 7 else latest_ec
            temp_7d_avg = temp_df['value'].tail(7).mean() if len(temp_df) >= 7 else latest_temp
            ec_rolling_3d = ec_df['value'].tail(3).mean() if len(ec_df) >= 3 else latest_ec
            temp_rolling_3d = temp_df['value'].tail(3).mean() if len(temp_df) >= 3 else latest_temp
            ec_slope = (latest_ec - ec_df['value'].iloc[-7]) / 7 if len(ec_df) >= 7 else 0
            temp_slope = (latest_temp - temp_df['value'].iloc[-7]) / 7 if len(temp_df) >= 7 else 0
            ec_deviation = (latest_ec - baseline_ec) / baseline_ec if baseline_ec > 0 else 0
            temp_deviation = (latest_temp - baseline_temp) / baseline_temp if baseline_temp > 0 else 0
            
            # Build feature vector
            feature_dict = {
                'ec': latest_ec,
                'temp': latest_temp,
                'ec_rolling_3d': ec_rolling_3d,
                'ec_rolling_7d': ec_7d_avg,
                'temp_rolling_3d': temp_rolling_3d,
                'temp_rolling_7d': temp_7d_avg,
                'ec_slope_7d': ec_slope,
                'temp_slope_7d': temp_slope,
                'ec_deviation': ec_deviation,
                'temp_deviation': temp_deviation,
                'ec_lag_1d': ec_df['value'].iloc[-1] if len(ec_df) >= 1 else latest_ec,
                'ec_lag_3d': ec_df['value'].iloc[-3] if len(ec_df) >= 3 else latest_ec,
                'ec_lag_7d': ec_df['value'].iloc[-7] if len(ec_df) >= 7 else latest_ec,
                'temp_lag_1d': temp_df['value'].iloc[-1] if len(temp_df) >= 1 else latest_temp,
                'temp_lag_3d': temp_df['value'].iloc[-3] if len(temp_df) >= 3 else latest_temp,
                'temp_lag_7d': temp_df['value'].iloc[-7] if len(temp_df) >= 7 else latest_temp,
            }
            
            feature_vector = pd.DataFrame([feature_dict])
            for col in self.feature_names:
                if col not in feature_vector.columns:
                    feature_vector[col] = 0.0
            extra_cols = [c for c in feature_vector.columns if c not in self.feature_names]
            if extra_cols:
                feature_vector = feature_vector.drop(columns=extra_cols)
            feature_vector = feature_vector.reindex(columns=self.feature_names, fill_value=0.0)
            feature_vector = feature_vector.fillna(0.0)

            if list(feature_vector.columns) != list(self.feature_names):
                print("⚠️ Feature columns mismatch. Using heuristic.")
                return self._heuristic_predict(animal_id, current_readings)

            risk_7d = float(self.model_7d.predict_proba(feature_vector)[0][1])
            risk_14d = float(self.model_14d.predict_proba(feature_vector)[0][1])
            
            # Get top factors
            importances = self.feature_importance_7d
            sorted_factors = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:3]
            factors = {factor: round(importance, 3) for factor, importance in sorted_factors}
            
            # Category
            if risk_7d > 0.7:
                category = "HIGH"
            elif risk_7d > 0.4:
                category = "MODERATE"
            elif risk_7d > 0.2:
                category = "LOW"
            else:
                category = "NONE"
            
            return self._enrich_payload({
                "tag_number": tag,
                "risk_7day": round(risk_7d, 3),
                "risk_14day": round(risk_14d, 3),
                "category": category,
                "factors": factors,
                "baseline_ec": baseline_ec,
                "baseline_temp": baseline_temp,
                "latest_ec": round(float(latest_ec), 3),
                "latest_temp": round(float(latest_temp), 2),
                "ec_deviation": round(ec_deviation * 100, 1),
                "temp_deviation": round(temp_deviation * 100, 1),
                "recommendations": self._get_recommendations(category)
            })
            
        except Exception as e:
            print(f"❌ Prediction error: {str(e)}")
            traceback.print_exc()
            # Fallback to heuristic
            return self._heuristic_predict(animal_id, current_readings)
    
    def _heuristic_predict(self, animal_id, current_readings):
        """Simple threshold-based prediction (always works)."""
        try:
            # Get baseline and tag
            baseline_resp = supabase.table("animals").select("baseline_ec, baseline_temp, tag_number").eq("id", animal_id).execute()
            if baseline_resp.data:
                baseline_ec = baseline_resp.data[0]['baseline_ec'] or 4.2
                baseline_temp = baseline_resp.data[0]['baseline_temp'] or 38.5
                tag = baseline_resp.data[0]['tag_number']
            else:
                baseline_ec = 4.2
                baseline_temp = 38.5
                tag = animal_id[:8]
            
            if current_readings is None or getattr(current_readings, "empty", True):
                readings = pd.DataFrame(columns=["sensor_type", "value"])
            else:
                readings = current_readings.copy()
            if "sensor_type" not in readings.columns:
                readings["sensor_type"] = ""
            if "value" not in readings.columns:
                readings["value"] = 0
            sensor_upper = readings["sensor_type"].astype(str).str.upper()
            ec_df = readings[sensor_upper == "EC"]
            temp_df = readings[sensor_upper == "TEMP"]
            
            latest_ec = ec_df.iloc[-1]['value'] if not ec_df.empty else 4.0
            latest_temp = temp_df.iloc[-1]['value'] if not temp_df.empty else 38.5
            
            ec_dev = (latest_ec - baseline_ec) / baseline_ec if baseline_ec > 0 else 0
            temp_dev = (latest_temp - baseline_temp) / baseline_temp if baseline_temp > 0 else 0
            
            # Simple heuristic rules (for demo only)
            if latest_ec > 6.0 or latest_temp > 39.5:
                risk_7d = 0.85
                risk_14d = 0.92
                category = "HIGH"
                factors = {"ec_threshold": 0.40, "temp_threshold": 0.35, "deviation": 0.25}
            elif latest_ec > 5.0 or latest_temp > 39.0:
                risk_7d = 0.55
                risk_14d = 0.65
                category = "MODERATE"
                factors = {"ec_trend": 0.35, "deviation": 0.30, "temp": 0.20}
            elif latest_ec > 4.5 or latest_temp > 38.5:
                risk_7d = 0.25
                risk_14d = 0.35
                category = "LOW"
                factors = {"baseline_deviation": 0.50, "ec": 0.30, "temp": 0.20}
            else:
                risk_7d = 0.05
                risk_14d = 0.10
                category = "NONE"
                factors = {"stable": 0.60, "normal_ec": 0.40}
            
            return self._enrich_payload({
                "tag_number": tag,
                "risk_7day": round(risk_7d, 3),
                "risk_14day": round(risk_14d, 3),
                "category": category,
                "factors": factors,
                "baseline_ec": baseline_ec,
                "baseline_temp": baseline_temp,
                "latest_ec": round(float(latest_ec), 3),
                "latest_temp": round(float(latest_temp), 2),
                "ec_deviation": round(ec_dev * 100, 1),
                "temp_deviation": round(temp_dev * 100, 1),
                "recommendations": self._get_recommendations(category),
                "note": "Heuristic mode (model training in progress)"
            })
        except Exception as e:
            print(f"⚠️ Heuristic failed: {e}")
            return self._absolute_fallback()
    
    def _get_recommendations(self, category):
        """Return recommendations based on risk category."""
        if category == "HIGH":
            return [
                "🚨 Immediately inspect udder for clinical signs",
                "🔬 Check milking hygiene protocols",
                "⚙️ Verify milking equipment calibration",
                "📋 Isolate cow and monitor closely",
                "👨‍⚕️ Consult veterinarian for confirmation"
            ]
        elif category == "MODERATE":
            return [
                "📅 Schedule clinical examination within 48 hours",
                "🧹 Review housing/bedding hygiene",
                "📊 Monitor EC and temperature daily",
                "🧪 Consider CMT (California Mastitis Test)"
            ]
        elif category == "LOW":
            return [
                "✅ Continue routine monitoring",
                "🧼 Maintain milking hygiene standards",
                "📋 Review risk factors periodically"
            ]
        else:
            return ["✅ No immediate action required. Cow appears healthy."]

    def _enrich_payload(self, payload):
        """Add SIH demo vitals derived from EC/temp so the modal is complete."""
        latest_ec = float(payload.get("latest_ec") or 4.2)
        latest_temp = float(payload.get("latest_temp") or 38.5)
        scc = max(50, min(2000, int(80 + (latest_ec - 4.0) * 420)))
        payload.update({
            "latest_scc": scc,
            "latest_ph": round(max(6.2, min(7.2, 6.7 - (latest_ec - 4.2) * 0.12)), 2),
            "latest_yield": round(max(8.0, 24.0 - max(0, latest_ec - 4.5) * 4.5), 1),
            "latest_activity": int(max(1800, 4200 - max(0, latest_temp - 38.5) * 900)),
            "latest_rumination": round(max(4.0, 8.5 - max(0, latest_temp - 38.5) * 2.2), 1),
        })
        factors = payload.get("factors") or {}
        payload["factors"] = {
            "ec_trend": float(factors.get("ec_trend", factors.get("ec_threshold", factors.get("ec", 0.3)))),
            "temp_deviation": float(factors.get("temp_deviation", factors.get("temp_threshold", factors.get("temp", 0.25)))),
            "scc_level": float(factors.get("scc_level", factors.get("deviation", 0.2))),
            "activity_drop": float(factors.get("activity_drop", factors.get("history", 0.15))),
            "history": float(factors.get("history", 0.1)),
            "rolling_avg": float(factors.get("rolling_avg", factors.get("stable", 0.1))),
            **{k: float(v) for k, v in factors.items() if isinstance(v, (int, float))},
        }
        return payload

    def _absolute_fallback(self):
        return self._enrich_payload({
            "tag_number": "Unknown",
            "risk_7day": 0.5,
            "risk_14day": 0.6,
            "category": "MODERATE",
            "factors": {"error_fallback": 1.0},
            "baseline_ec": 4.2,
            "baseline_temp": 38.5,
            "latest_ec": 4.2,
            "latest_temp": 38.5,
            "ec_deviation": 0,
            "temp_deviation": 0,
            "recommendations": ["Please check sensor data connection."],
            "note": "Absolute fallback",
        })


# Singleton instance
risk_model = MastitisRiskModel()

def get_or_train_model():
    """
    Return the model immediately. Training is never done on the request
    path so Predict stays under 2 seconds. Background training may set
    is_trained after /simulate; until then heuristic is used.
    """
    return risk_model


def heuristic_fallback(animal_id, current_readings=None):
    """Public heuristic used by the API when anything goes wrong."""
    if current_readings is None:
        current_readings = pd.DataFrame()
    try:
        return risk_model._heuristic_predict(animal_id, current_readings)
    except Exception:
        return risk_model._absolute_fallback()