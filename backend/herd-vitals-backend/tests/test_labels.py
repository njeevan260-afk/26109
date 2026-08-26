import unittest

import pandas as pd

from app.ml.labels import build_forecast_labels


class ForecastLabelTests(unittest.TestCase):
    def test_labels_are_based_on_strictly_future_confirmed_events(self):
        observations = pd.DataFrame(
            {
                "animal_id": ["cow-1"] * 5,
                "observed_at": pd.to_datetime(
                    [
                        "2026-01-01",
                        "2026-01-05",
                        "2026-01-10",
                        "2026-01-20",
                        "2026-02-10",
                    ],
                    utc=True,
                ),
            }
        )
        events = pd.DataFrame(
            {
                "animal_id": ["cow-1", "cow-1"],
                "event_time": pd.to_datetime(
                    ["2026-01-05", "2026-02-01"], utc=True
                ),
                "status": ["CONFIRMED", "SUSPECTED"],
            }
        )

        result = build_forecast_labels(observations, events)

        self.assertEqual(result.loc[0, "label_7_to_14d"], 0)
        self.assertEqual(result.loc[1, "label_7_to_14d"], 0)
        self.assertFalse(bool(result.loc[1, "is_label_eligible"]))
        self.assertFalse(bool(result.loc[2, "is_label_eligible"]))
        self.assertTrue(bool(result.loc[3, "is_label_eligible"]))
        self.assertFalse(bool(result.loc[4, "is_label_eligible"]))

    def test_labels_single_seven_to_fourteen_day_window(self):
        observations = pd.DataFrame(
            {"animal_id": ["cow-1"], "observed_at": ["2026-01-01"]}
        )
        events = pd.DataFrame(
            {
                "animal_id": ["cow-1"],
                "event_time": ["2026-01-11"],
                "status": ["CONFIRMED"],
            }
        )

        result = build_forecast_labels(observations, events)

        self.assertEqual(result.loc[0, "label_7_to_14d"], 1)
        self.assertEqual(result.loc[0, "days_to_event"], 10)

    def test_excludes_rows_closer_than_seven_days_to_onset(self):
        observations = pd.DataFrame(
            {
                "animal_id": ["cow-1", "cow-1", "cow-1"],
                "observed_at": ["2026-01-01", "2026-01-05", "2026-01-09"],
            }
        )
        events = pd.DataFrame(
            {
                "animal_id": ["cow-1"],
                "event_time": ["2026-01-15"],
                "status": ["CONFIRMED"],
            }
        )

        result = build_forecast_labels(observations, events)

        self.assertEqual(list(result["label_7_to_14d"]), [1, 1, 0])
        self.assertEqual(list(result["is_label_eligible"]), [True, True, False])

    def test_rejects_invalid_timestamps(self):
        observations = pd.DataFrame(
            {"animal_id": ["cow-1"], "observed_at": ["not-a-date"]}
        )
        events = pd.DataFrame(
            {
                "animal_id": ["cow-1"],
                "event_time": ["2026-01-11"],
                "status": ["CONFIRMED"],
            }
        )
        with self.assertRaisesRegex(ValueError, "invalid timestamps"):
            build_forecast_labels(observations, events)

    def test_censors_rows_without_fourteen_days_of_followup(self):
        observations = pd.DataFrame(
            {
                "animal_id": ["cow-1"] * 3,
                "observed_at": ["2026-01-01", "2026-01-16", "2026-01-20"],
            }
        )
        events = pd.DataFrame(
            columns=["animal_id", "event_time", "status"]
        )

        result = build_forecast_labels(observations, events)

        self.assertEqual(list(result["has_outcome_followup"]), [True, False, False])
        self.assertEqual(list(result["is_label_eligible"]), [True, False, False])


if __name__ == "__main__":
    unittest.main()
