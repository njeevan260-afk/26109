import unittest

import numpy as np
import pandas as pd

from app.ml.evaluation import (
    evaluate_binary_models,
    select_alert_threshold,
    temporal_split,
)


class EvaluationTests(unittest.TestCase):
    def test_temporal_split_has_strict_boundaries(self):
        frame = pd.DataFrame(
            {
                "observed_at": pd.date_range(
                    "2026-01-01", periods=20, freq="D", tz="UTC"
                ),
                "label_7_to_14d": [index % 2 for index in range(20)],
                "feature": range(20),
            }
        )
        split = temporal_split(frame)
        self.assertLess(
            split.train["observed_at"].max(),
            split.validation["observed_at"].min(),
        )
        self.assertLess(
            split.validation["observed_at"].max(),
            split.test["observed_at"].min(),
        )

    def test_threshold_respects_minimum_precision_when_possible(self):
        truth = np.array([0, 0, 1, 1])
        probability = np.array([0.1, 0.4, 0.5, 0.9])
        threshold = select_alert_threshold(
            truth, probability, minimum_precision=0.66
        )
        self.assertGreaterEqual(threshold, 0.5)

    def test_benchmark_compares_all_four_models(self):
        rng = np.random.default_rng(42)
        periods = 120
        labels = np.array([(index % 10) < 3 for index in range(periods)], dtype=int)
        frame = pd.DataFrame(
            {
                "animal_id": [f"cow-{index % 8}" for index in range(periods)],
                "observed_at": pd.date_range(
                    "2026-01-01", periods=periods, freq="D", tz="UTC"
                ),
                "feature_signal": labels + rng.normal(0, 0.25, periods),
                "feature_noise": rng.normal(0, 1, periods),
                "label_7_to_14d": labels,
                "is_label_eligible": True,
                "has_sufficient_history": True,
            }
        )

        run = evaluate_binary_models(frame, minimum_precision=0.10)

        self.assertEqual(
            set(run.metrics["model"]),
            {"logistic_regression", "random_forest", "extra_trees", "xgboost"},
        )
        self.assertTrue(run.metrics["pr_auc"].between(0, 1).all())
        self.assertTrue(run.metrics["recall"].between(0, 1).all())
        self.assertTrue(run.metrics["validation_precision"].between(0, 1).all())
        self.assertTrue(run.metrics["alerts_per_1000"].between(0, 1000).all())

    def test_outcome_columns_are_not_auto_selected_as_features(self):
        periods = 120
        labels = np.array([(index % 10) < 3 for index in range(periods)], dtype=int)
        frame = pd.DataFrame(
            {
                "animal_id": [f"cow-{index % 8}" for index in range(periods)],
                "observed_at": pd.date_range(
                    "2026-01-01", periods=periods, freq="D", tz="UTC"
                ),
                "milk_ec": labels + 4.0,
                "milk_yield": 30 - labels * 10,
                "scc": 100_000 + labels * 500_000,
                "label_7_to_14d": labels,
                "is_label_eligible": True,
                "has_sufficient_history": True,
            }
        )

        run = evaluate_binary_models(
            frame,
            model_names=("logistic_regression",),
            minimum_precision=0.10,
        )

        self.assertIn("milk_ec", run.feature_names)
        self.assertNotIn("milk_yield", run.feature_names)
        self.assertNotIn("scc", run.feature_names)


if __name__ == "__main__":
    unittest.main()
