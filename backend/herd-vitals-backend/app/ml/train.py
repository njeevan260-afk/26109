"""Command-line research benchmark for the new event-based ML pipeline."""

import argparse
import json
from pathlib import Path

from app.ml.evaluation import evaluate_binary_models
from app.ml.features import engineer_temporal_features
from app.ml.labels import build_forecast_labels
from app.ml.synthetic import generate_event_first_cohort


def run_synthetic_benchmark(output: Path) -> dict:
    cohort = generate_event_first_cohort()
    features = engineer_temporal_features(
        cohort.observations,
        minimum_baseline_observations=12,
    )
    labelled = build_forecast_labels(features, cohort.events)

    minimum_validation_precision = 0.50
    run = evaluate_binary_models(
        labelled,
        label_col="label_7_to_14d",
        minimum_precision=minimum_validation_precision,
    )

    report = {
        "data_mode": "synthetic_event_first",
        "clinically_validated": False,
        "purpose": "pipeline verification and model comparison only",
        "interpretation_warnings": [
            "Synthetic trajectories are intentionally learnable, so performance is not evidence of clinical utility.",
            "Alert thresholds are chosen on the validation period and can transfer poorly to a later test period.",
            "Select a production model only after farm-grouped external validation on confirmed real events.",
        ],
        "animal_count": int(cohort.observations["animal_id"].nunique()),
        "observation_count": len(cohort.observations),
        "confirmed_event_count": len(cohort.events),
        "threshold_policy": {
            "selection_partition": "validation",
            "objective": "maximum recall subject to minimum precision",
            "minimum_precision": minimum_validation_precision,
        },
        "forecast_window_days": {"start": 7, "end": 14},
        "clinical_anchor": "earliest clinical onset or confirmed detection",
        "late_onset_exclusion_days": 7,
        "models": run.metrics.round(6).to_dict(orient="records"),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the leakage-safe HerdVitals research benchmark."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("ml/reports/synthetic_event_benchmark.json"),
    )
    args = parser.parse_args()
    report = run_synthetic_benchmark(args.output)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
