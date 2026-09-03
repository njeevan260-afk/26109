import unittest
from datetime import date

from app.api.dashboard import _build_risk_history


class DashboardHistoryTests(unittest.TestCase):
    def test_stale_history_gets_a_current_day_snapshot(self):
        predictions = [
            {"animal_id": "cow-1", "prediction_date": "2026-08-26", "risk_7day": 0.2},
            {"animal_id": "cow-2", "prediction_date": "2026-08-26", "risk_7day": 60},
        ]

        history = _build_risk_history(
            predictions,
            predictions,
            today=date(2026, 9, 3),
        )

        self.assertEqual(history[-1]["prediction_date"], "2026-09-03")
        self.assertEqual(history[-1]["risk_7day"], 0.4)
        self.assertTrue(history[-1]["is_current_snapshot"])

    def test_current_day_snapshot_uses_latest_value_for_every_animal(self):
        predictions = [
            {"animal_id": "cow-1", "prediction_date": "2026-09-03", "risk_7day": 0.3},
            {"animal_id": "cow-2", "prediction_date": "2026-09-02", "risk_7day": 0.5},
        ]

        history = _build_risk_history(
            predictions,
            predictions,
            today=date(2026, 9, 3),
        )

        self.assertEqual(history[-1]["prediction_date"], "2026-09-03")
        self.assertEqual(history[-1]["risk_7day"], 0.4)
        self.assertTrue(history[-1]["is_current_snapshot"])


if __name__ == "__main__":
    unittest.main()
