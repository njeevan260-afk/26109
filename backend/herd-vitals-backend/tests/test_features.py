import unittest

import pandas as pd
from pandas.testing import assert_frame_equal

from app.ml.features import canonicalize_sensor_readings, engineer_temporal_features


def make_readings(days=12):
    rows = []
    times = pd.date_range("2026-01-01", periods=days, freq="D", tz="UTC")
    for index, timestamp in enumerate(times):
        for sensor_type, value in (
            ("EC", 4.0 + index * 0.1),
            ("TEMP", 38.0 + index * 0.02),
        ):
            rows.append(
                {
                    "animal_id": "cow-1",
                    "reading_time": timestamp,
                    "sensor_type": sensor_type,
                    "value": value,
                    "quality_flag": "VALID",
                }
            )
    return pd.DataFrame(rows)


class TemporalFeatureTests(unittest.TestCase):
    def test_baseline_excludes_current_observation(self):
        canonical = pd.DataFrame(
            {
                "animal_id": ["cow-1"] * 4,
                "observed_at": pd.date_range(
                    "2026-01-01", periods=4, freq="D", tz="UTC"
                ),
                "milk_ec": [4.0, 5.0, 6.0, 100.0],
                "milk_temperature": [38.0, 38.1, 38.2, 42.0],
            }
        )
        result = engineer_temporal_features(
            canonical, minimum_baseline_observations=3
        )
        self.assertEqual(result.loc[3, "milk_ec_baseline_median"], 5.0)
        self.assertEqual(result.loc[3, "milk_temperature_baseline_median"], 38.1)

    def test_future_rows_do_not_change_existing_features(self):
        canonical = canonicalize_sensor_readings(make_readings())
        partial = engineer_temporal_features(
            canonical.iloc[:8], minimum_baseline_observations=3
        )
        complete = engineer_temporal_features(
            canonical, minimum_baseline_observations=3
        ).iloc[:8]
        feature_columns = [
            column
            for column in partial.columns
            if column not in {"animal_id", "observed_at"}
        ]
        assert_frame_equal(
            partial[feature_columns].reset_index(drop=True),
            complete[feature_columns].reset_index(drop=True),
            check_dtype=False,
        )

    def test_time_lag_uses_timestamp_not_row_count(self):
        canonical = pd.DataFrame(
            {
                "animal_id": ["cow-1"] * 3,
                "observed_at": pd.to_datetime(
                    ["2026-01-01", "2026-01-02", "2026-01-04"], utc=True
                ),
                "milk_ec": [4.0, 5.0, 7.0],
                "milk_temperature": [38.0, 38.1, 38.3],
            }
        )
        result = engineer_temporal_features(
            canonical, minimum_baseline_observations=2
        )
        self.assertEqual(result.loc[2, "milk_ec_lag_1d"], 5.0)
        self.assertEqual(result.loc[2, "milk_ec_slope_1d"], 2.0)

    def test_default_forecast_features_exclude_yield_and_scc(self):
        canonical = pd.DataFrame(
            {
                "animal_id": ["cow-1"] * 3,
                "observed_at": pd.date_range(
                    "2026-01-01", periods=3, freq="D", tz="UTC"
                ),
                "milk_ec": [4.0, 4.1, 4.2],
                "milk_temperature": [38.0, 38.1, 38.2],
                "milk_yield": [25.0, 20.0, 10.0],
                "scc": [100_000, 300_000, 800_000],
            }
        )

        result = engineer_temporal_features(
            canonical, minimum_baseline_observations=2
        )

        self.assertNotIn("milk_yield_current", result.columns)
        self.assertNotIn("scc_current", result.columns)


if __name__ == "__main__":
    unittest.main()
