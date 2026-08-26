"""Temporal model comparison for imbalanced mastitis forecasting targets."""

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


NON_FEATURE_COLUMNS = {
    "animal_id",
    "observed_at",
    "next_event_at",
    "days_to_event",
    "days_since_event",
    "is_label_eligible",
    "has_sufficient_history",
    "has_outcome_followup",
    "milk_yield",
    "scc",
    "is_simulated",
}


@dataclass(frozen=True)
class TemporalSplit:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    train_end: pd.Timestamp
    validation_end: pd.Timestamp


@dataclass
class BenchmarkRun:
    metrics: pd.DataFrame
    models: dict[str, Any]
    preprocessors: dict[str, Any]
    feature_names: list[str]
    split: TemporalSplit


def temporal_split(
    frame: pd.DataFrame,
    *,
    time_col: str = "observed_at",
    train_fraction: float = 0.70,
    validation_fraction: float = 0.15,
) -> TemporalSplit:
    """Split globally by unique timestamps, never randomly across time."""
    if time_col not in frame.columns:
        raise ValueError(f"frame is missing time column {time_col!r}")
    if not 0 < train_fraction < 1 or not 0 < validation_fraction < 1:
        raise ValueError("split fractions must be between zero and one")
    if train_fraction + validation_fraction >= 1:
        raise ValueError("train_fraction + validation_fraction must be below one")

    ordered = frame.copy()
    ordered[time_col] = pd.to_datetime(ordered[time_col], errors="coerce", utc=True)
    if ordered[time_col].isna().any():
        raise ValueError("frame contains invalid timestamps")
    unique_times = np.sort(ordered[time_col].unique())
    if len(unique_times) < 10:
        raise ValueError("at least 10 unique timestamps are required")

    train_position = max(1, int(len(unique_times) * train_fraction))
    validation_position = max(
        train_position + 1,
        int(len(unique_times) * (train_fraction + validation_fraction)),
    )
    validation_position = min(validation_position, len(unique_times) - 1)
    train_end = pd.Timestamp(unique_times[train_position - 1])
    validation_end = pd.Timestamp(unique_times[validation_position - 1])

    train = ordered[ordered[time_col] <= train_end].copy()
    validation = ordered[
        (ordered[time_col] > train_end)
        & (ordered[time_col] <= validation_end)
    ].copy()
    test = ordered[ordered[time_col] > validation_end].copy()
    if train.empty or validation.empty or test.empty:
        raise ValueError("temporal split produced an empty partition")
    return TemporalSplit(train, validation, test, train_end, validation_end)


def select_alert_threshold(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    *,
    minimum_precision: float = 0.20,
) -> float:
    """Maximize validation recall while meeting a minimum precision target."""
    precision, recall, thresholds = precision_recall_curve(y_true, probabilities)
    if not len(thresholds):
        return 0.5
    precision = precision[:-1]
    recall = recall[:-1]
    feasible = np.flatnonzero(precision >= minimum_precision)
    if len(feasible):
        best_recall = recall[feasible].max()
        recall_ties = feasible[recall[feasible] == best_recall]
        best = recall_ties[np.argmax(precision[recall_ties])]
        return float(thresholds[best])

    denominator = precision + recall
    f1 = np.divide(
        2 * precision * recall,
        denominator,
        out=np.zeros_like(denominator),
        where=denominator > 0,
    )
    return float(thresholds[int(np.argmax(f1))])


def _classification_metrics(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    threshold: float,
) -> dict[str, float]:
    predicted = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predicted, labels=[0, 1]).ravel()
    specificity = tn / (tn + fp) if tn + fp else 0.0
    return {
        "roc_auc": float(roc_auc_score(y_true, probabilities)),
        "pr_auc": float(average_precision_score(y_true, probabilities)),
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "specificity": float(specificity),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
        "threshold": float(threshold),
        "true_positive": int(tp),
        "false_positive": int(fp),
        "true_negative": int(tn),
        "false_negative": int(fn),
        "alerts_per_1000": float(predicted.mean() * 1_000),
    }


def _validate_binary_partitions(split: TemporalSplit, label_col: str) -> None:
    for name, partition in (
        ("train", split.train),
        ("validation", split.validation),
        ("test", split.test),
    ):
        values = set(pd.to_numeric(partition[label_col], errors="raise").unique())
        if not values.issubset({0, 1}) or len(values) < 2:
            raise ValueError(f"{name} partition must contain both binary classes")


def evaluate_binary_models(
    frame: pd.DataFrame,
    *,
    label_col: str = "label_7_to_14d",
    time_col: str = "observed_at",
    feature_names: list[str] | None = None,
    model_names: tuple[str, ...] = (
        "logistic_regression",
        "random_forest",
        "extra_trees",
        "xgboost",
    ),
    minimum_precision: float = 0.20,
    random_state: int = 42,
) -> BenchmarkRun:
    """Train and compare classical tabular models on a strict temporal split."""
    if label_col not in frame.columns:
        raise ValueError(f"frame is missing label column {label_col!r}")
    eligible = frame.copy()
    if "is_label_eligible" in eligible.columns:
        eligible = eligible[eligible["is_label_eligible"]]
    if "has_sufficient_history" in eligible.columns:
        eligible = eligible[eligible["has_sufficient_history"]]
    if eligible.empty:
        raise ValueError("no eligible model rows remain")

    split = temporal_split(eligible, time_col=time_col)
    _validate_binary_partitions(split, label_col)
    if feature_names is None:
        excluded = (
            NON_FEATURE_COLUMNS
            | {label_col}
            | {
                column
                for column in eligible.columns
                if column.startswith("label_")
            }
        )
        feature_names = [
            column
            for column in eligible.columns
            if column not in excluded
            and pd.api.types.is_numeric_dtype(eligible[column])
        ]
    if not feature_names:
        raise ValueError("no numeric feature columns were selected")

    imputer = SimpleImputer(strategy="median")
    x_train = imputer.fit_transform(split.train[feature_names])
    x_validation = imputer.transform(split.validation[feature_names])
    x_test = imputer.transform(split.test[feature_names])
    y_train = split.train[label_col].astype(int).to_numpy()
    y_validation = split.validation[label_col].astype(int).to_numpy()
    y_test = split.test[label_col].astype(int).to_numpy()

    negative_count = int((y_train == 0).sum())
    positive_count = int((y_train == 1).sum())
    scale_pos_weight = negative_count / max(positive_count, 1)

    candidates: dict[str, Any] = {
        "logistic_regression": LogisticRegression(
            max_iter=2_000,
            class_weight="balanced",
            random_state=random_state,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=3,
            class_weight="balanced_subsample",
            random_state=random_state,
            n_jobs=-1,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=300,
            min_samples_leaf=3,
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        ),
        "xgboost": XGBClassifier(
            objective="binary:logistic",
            eval_metric="logloss",
            n_estimators=500,
            learning_rate=0.05,
            max_depth=4,
            min_child_weight=3,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_lambda=1.0,
            scale_pos_weight=scale_pos_weight,
            early_stopping_rounds=30,
            random_state=random_state,
            n_jobs=-1,
        ),
    }
    unknown = sorted(set(model_names).difference(candidates))
    if unknown:
        raise ValueError("unknown model names: " + ", ".join(unknown))

    fitted_models: dict[str, Any] = {}
    preprocessors: dict[str, Any] = {"imputer": imputer}
    rows = []
    for name in model_names:
        model = candidates[name]
        fit_train = x_train
        fit_validation = x_validation
        fit_test = x_test
        if name == "logistic_regression":
            scaler = StandardScaler()
            fit_train = scaler.fit_transform(x_train)
            fit_validation = scaler.transform(x_validation)
            fit_test = scaler.transform(x_test)
            preprocessors["logistic_scaler"] = scaler

        if name == "xgboost":
            model.fit(
                fit_train,
                y_train,
                eval_set=[(fit_validation, y_validation)],
                verbose=False,
            )
        else:
            model.fit(fit_train, y_train)
        validation_probability = model.predict_proba(fit_validation)[:, 1]
        threshold = select_alert_threshold(
            y_validation,
            validation_probability,
            minimum_precision=minimum_precision,
        )
        validation_metrics = _classification_metrics(
            y_validation,
            validation_probability,
            threshold,
        )
        test_probability = model.predict_proba(fit_test)[:, 1]
        rows.append(
            {
                "model": name,
                **_classification_metrics(y_test, test_probability, threshold),
                "validation_precision": validation_metrics["precision"],
                "validation_recall": validation_metrics["recall"],
                "validation_alerts_per_1000": validation_metrics[
                    "alerts_per_1000"
                ],
                "train_rows": len(split.train),
                "validation_rows": len(split.validation),
                "test_rows": len(split.test),
                "positive_rate_test": float(y_test.mean()),
            }
        )
        fitted_models[name] = model

    metrics = pd.DataFrame(rows).sort_values(
        ["pr_auc", "recall", "specificity"], ascending=False
    ).reset_index(drop=True)
    return BenchmarkRun(metrics, fitted_models, preprocessors, feature_names, split)
