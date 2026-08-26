"""Leakage-safe canonicalization and temporal feature engineering."""

from collections.abc import Iterable

import numpy as np
import pandas as pd


SENSOR_COLUMN_MAP = {
    "EC": "milk_ec",
    "TEMP": "milk_temperature",
    "YIELD": "milk_yield",
    "ACTIVITY": "activity",
    "RUMINATION": "rumination",
    "SCC": "scc",
}
DEFAULT_SIGNALS = (
    "milk_ec",
    "milk_temperature",
    "activity",
    "rumination",
)


def _require_columns(frame: pd.DataFrame, required: set[str], name: str) -> None:
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(f"{name} is missing required columns: {', '.join(missing)}")


def canonicalize_sensor_readings(readings: pd.DataFrame) -> pd.DataFrame:
    """Convert vertical sensor rows into one chronological row per cow/time."""
    _require_columns(
        readings,
        {"animal_id", "reading_time", "sensor_type", "value"},
        "readings",
    )
    frame = readings.copy()
    frame["reading_time"] = pd.to_datetime(
        frame["reading_time"], errors="coerce", utc=True
    )
    frame["sensor_type"] = frame["sensor_type"].astype(str).str.upper()
    frame["value"] = pd.to_numeric(frame["value"], errors="coerce")
    if "quality_flag" in frame.columns:
        frame = frame[
            ~frame["quality_flag"].astype(str).str.upper().eq("INVALID")
        ]
    frame = frame.dropna(subset=["animal_id", "reading_time", "value"])
    frame = frame[frame["sensor_type"].isin(SENSOR_COLUMN_MAP)]
    if frame.empty:
        return pd.DataFrame(columns=["animal_id", "observed_at"])

    canonical = (
        frame.pivot_table(
            index=["animal_id", "reading_time"],
            columns="sensor_type",
            values="value",
            aggfunc="median",
        )
        .rename(columns=SENSOR_COLUMN_MAP)
        .reset_index()
        .rename(columns={"reading_time": "observed_at"})
        .sort_values(["animal_id", "observed_at"])
        .reset_index(drop=True)
    )
    canonical.columns.name = None
    return canonical


def _asof_lag(
    times: pd.Series,
    values: pd.Series,
    days: int,
) -> pd.Series:
    """Return the most recent value at or before ``time - days``."""
    left = pd.DataFrame(
        {
            "target_time": times - pd.Timedelta(days=days),
            "row_order": np.arange(len(times)),
        }
    ).sort_values("target_time")
    right = pd.DataFrame(
        {"history_time": times, "lag_value": values}
    ).dropna(subset=["lag_value"]).sort_values("history_time")
    if right.empty:
        return pd.Series(np.nan, index=times.index, dtype=float)

    merged = pd.merge_asof(
        left,
        right,
        left_on="target_time",
        right_on="history_time",
        direction="backward",
        tolerance=pd.Timedelta(days=days),
    ).sort_values("row_order")
    return pd.Series(merged["lag_value"].to_numpy(), index=times.index, dtype=float)


def engineer_temporal_features(
    canonical: pd.DataFrame,
    *,
    signals: Iterable[str] = DEFAULT_SIGNALS,
    required_signals: Iterable[str] = ("milk_ec", "milk_temperature"),
    windows_days: Iterable[int] = (1, 3, 7),
    minimum_baseline_observations: int = 8,
) -> pd.DataFrame:
    """
    Generate past-only rolling, lag, slope and individual-baseline features.

    Expanding baselines are shifted by one observation, ensuring that a row's
    baseline never uses its current value or any future value.

    Milk yield and SCC are intentionally excluded from ``DEFAULT_SIGNALS``.
    Yield loss is a clinical/production outcome this pipeline aims to precede,
    while SCC is diagnostic evidence. Either requires an explicit opt-in for a
    separate detection experiment and must not silently enter the forecast.
    """
    _require_columns(canonical, {"animal_id", "observed_at"}, "canonical")
    if minimum_baseline_observations < 2:
        raise ValueError("minimum_baseline_observations must be at least 2")
    windows = tuple(sorted({int(value) for value in windows_days}))
    if not windows or any(value <= 0 for value in windows):
        raise ValueError("windows_days must contain positive day counts")

    frame = canonical.copy()
    frame["observed_at"] = pd.to_datetime(
        frame["observed_at"], errors="coerce", utc=True
    )
    if frame["observed_at"].isna().any():
        raise ValueError("canonical contains invalid timestamps")
    frame = frame.sort_values(["animal_id", "observed_at"]).reset_index(drop=True)

    selected_signals = [signal for signal in signals if signal in frame.columns]
    required = tuple(required_signals)
    missing_required = sorted(set(required).difference(frame.columns))
    if missing_required:
        raise ValueError(
            "canonical is missing required signals: " + ", ".join(missing_required)
        )

    feature_groups = []
    for _, animal in frame.groupby("animal_id", sort=False):
        animal = animal.copy().sort_values("observed_at")
        times = animal["observed_at"]
        time_index = pd.DatetimeIndex(times)

        for signal in selected_signals:
            values = pd.to_numeric(animal[signal], errors="coerce")
            indexed = pd.Series(values.to_numpy(), index=time_index, dtype=float)
            animal[f"{signal}_current"] = values.to_numpy()

            history_count = values.notna().cumsum().shift(1, fill_value=0)
            expanding = values.expanding(min_periods=minimum_baseline_observations)
            animal[f"{signal}_baseline_mean"] = expanding.mean().shift(1)
            animal[f"{signal}_baseline_median"] = expanding.median().shift(1)
            animal[f"{signal}_baseline_std"] = expanding.std().shift(1)
            animal[f"{signal}_history_count"] = history_count
            denominator = animal[f"{signal}_baseline_median"].replace(0, np.nan)
            animal[f"{signal}_deviation_from_baseline"] = (
                values.to_numpy() - animal[f"{signal}_baseline_median"]
            ) / denominator

            for days in windows:
                rolling = indexed.rolling(
                    f"{days}D", min_periods=2, closed="both"
                )
                animal[f"{signal}_mean_{days}d"] = rolling.mean().to_numpy()
                animal[f"{signal}_std_{days}d"] = rolling.std().to_numpy()
                lag = _asof_lag(times.reset_index(drop=True), values.reset_index(drop=True), days)
                animal[f"{signal}_lag_{days}d"] = lag.to_numpy()
                animal[f"{signal}_slope_{days}d"] = (
                    values.to_numpy() - lag.to_numpy()
                ) / days

        animal["ec_temp_interaction"] = (
            animal["milk_ec_deviation_from_baseline"]
            * animal["milk_temperature_deviation_from_baseline"]
        )
        required_counts = [
            animal[f"{signal}_history_count"] for signal in required
        ]
        animal["has_sufficient_history"] = (
            pd.concat(required_counts, axis=1).min(axis=1)
            >= minimum_baseline_observations
        )
        feature_groups.append(animal)

    return pd.concat(feature_groups, ignore_index=True) if feature_groups else frame
