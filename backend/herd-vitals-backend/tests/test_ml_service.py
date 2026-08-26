import unittest
from datetime import datetime, timedelta, timezone

import pandas as pd

from app.services.ml_service import MastitisRiskModel


class MastitisRiskModelTests(unittest.TestCase):
    def setUp(self):
        self.model = MastitisRiskModel()

    def test_samples_per_day_uses_timestamp_spacing(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        frame = pd.DataFrame(
            {"reading_time": [start + timedelta(hours=6 * index) for index in range(12)]}
        )
        self.assertEqual(self.model._samples_per_day(frame), 4)

    def test_prepare_readings_sorts_oldest_to_newest(self):
        frame = pd.DataFrame(
            [
                {"sensor_type": "EC", "value": 6.0, "reading_time": "2026-01-02T00:00:00Z"},
                {"sensor_type": "EC", "value": 4.0, "reading_time": "2026-01-01T00:00:00Z"},
            ]
        )
        prepared = self.model._prepare_readings(frame)
        self.assertEqual(prepared["value"].tolist(), [4.0, 6.0])

    def test_engineered_lags_represent_days_not_rows(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        rows = []
        for index in range(4 * 24):
            timestamp = start + timedelta(hours=6 * index)
            rows.extend(
                [
                    {"animal_id": "cow-1", "sensor_type": "EC", "value": 4 + index * 0.01, "reading_time": timestamp},
                    {"animal_id": "cow-1", "sensor_type": "TEMP", "value": 38 + index * 0.005, "reading_time": timestamp},
                ]
            )
        baselines = pd.DataFrame(
            [{"id": "cow-1", "baseline_ec": 4.0, "baseline_temp": 38.0}]
        )
        features = self.model.engineer_features(pd.DataFrame(rows), baselines)
        target = features.iloc[0]
        self.assertAlmostEqual(target["ec"] - target["ec_lag_1d"], 0.04, places=6)
        self.assertAlmostEqual(target["ec"] - target["ec_lag_7d"], 0.28, places=6)


if __name__ == "__main__":
    unittest.main()
