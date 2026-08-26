"""Create forecasting targets from confirmed mastitis event timestamps."""

from collections.abc import Iterable

import numpy as np
import pandas as pd


SECONDS_PER_DAY = 86_400


def _require_columns(frame: pd.DataFrame, required: set[str], name: str) -> None:
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(f"{name} is missing required columns: {', '.join(missing)}")


def build_forecast_labels(
    observations: pd.DataFrame,
    events: pd.DataFrame,
    *,
    forecast_windows: Iterable[tuple[int, int]] = ((7, 14),),
    animal_col: str = "animal_id",
    observation_time_col: str = "observed_at",
    event_time_col: str = "event_time",
    status_col: str = "status",
    confirmed_statuses: Iterable[str] = ("CONFIRMED",),
    exclude_before_onset_days: int = 7,
    washout_days: int = 14,
) -> pd.DataFrame:
    """
    Label observations for bounded preclinical forecast windows.

    ``event_time`` must represent the earliest known clinical onset or confirmed
    detection time, not the database-entry time. The default positive target is
    an event 7 through 14 days after observation. Rows closer than 7 days to
    onset are excluded so late prodromal or clinical signs cannot be learned as
    an "early" forecast.

    Labels are based only on event timestamps strictly after the observation.
    Rows within ``washout_days`` after a confirmed event are retained but marked
    ``is_label_eligible=False`` so callers can exclude recovery periods.
    """
    windows = tuple(sorted({(int(start), int(end)) for start, end in forecast_windows}))
    if not windows or any(start <= 0 or end < start for start, end in windows):
        raise ValueError("forecast windows must satisfy 0 < start <= end")
    if exclude_before_onset_days < 0:
        raise ValueError("exclude_before_onset_days must be non-negative")
    if washout_days < 0:
        raise ValueError("washout_days must be non-negative")

    _require_columns(
        observations,
        {animal_col, observation_time_col},
        "observations",
    )
    _require_columns(events, {animal_col, event_time_col}, "events")

    labelled = observations.copy()
    labelled[observation_time_col] = pd.to_datetime(
        labelled[observation_time_col], errors="coerce", utc=True
    )
    if labelled[observation_time_col].isna().any():
        raise ValueError("observations contains invalid timestamps")

    confirmed = events.copy()
    confirmed[event_time_col] = pd.to_datetime(
        confirmed[event_time_col], errors="coerce", utc=True
    )
    if confirmed[event_time_col].isna().any():
        raise ValueError("events contains invalid timestamps")
    if status_col in confirmed.columns:
        allowed = {str(value).upper() for value in confirmed_statuses}
        confirmed = confirmed[
            confirmed[status_col].astype(str).str.upper().isin(allowed)
        ]

    labelled["next_event_at"] = pd.Series(
        pd.NaT,
        index=labelled.index,
        dtype="datetime64[ns, UTC]",
    )
    labelled["days_to_event"] = np.nan
    labelled["days_since_event"] = np.nan
    labelled["has_outcome_followup"] = False
    labelled["is_label_eligible"] = True
    for start, end in windows:
        labelled[f"label_{start}_to_{end}d"] = 0

    for animal_id, observation_group in labelled.groupby(animal_col, sort=False):
        observation_index = observation_group.index
        observation_times = observation_group[observation_time_col]
        observation_ns = observation_times.to_numpy(
            dtype="datetime64[ns]"
        ).astype("int64")
        maximum_window_days = max(end for _, end in windows)
        observation_end_ns = observation_ns.max()
        followup_cutoff_ns = observation_end_ns - (
            maximum_window_days * SECONDS_PER_DAY * 1_000_000_000
        )
        event_times = (
            confirmed.loc[confirmed[animal_col] == animal_id, event_time_col]
            .sort_values()
            .drop_duplicates()
        )
        if event_times.empty:
            has_outcome_followup = observation_ns <= followup_cutoff_ns
            labelled.loc[
                observation_index,
                "has_outcome_followup",
            ] = has_outcome_followup
            labelled.loc[
                observation_index,
                "is_label_eligible",
            ] = has_outcome_followup
            continue

        event_ns = event_times.to_numpy(dtype="datetime64[ns]").astype("int64")

        next_positions = np.searchsorted(event_ns, observation_ns, side="right")
        has_next = next_positions < len(event_ns)
        next_values = np.full(
            len(observation_ns),
            np.iinfo(np.int64).min,
            dtype=np.int64,
        )
        next_values[has_next] = event_ns[next_positions[has_next]]
        days_to_event = np.full(len(observation_ns), np.nan, dtype=float)
        days_to_event[has_next] = (
            event_ns[next_positions[has_next]] - observation_ns[has_next]
        ) / (1_000_000_000 * SECONDS_PER_DAY)

        previous_positions = np.searchsorted(event_ns, observation_ns, side="right") - 1
        has_previous = previous_positions >= 0
        days_since_event = np.full(len(observation_ns), np.nan, dtype=float)
        days_since_event[has_previous] = (
            observation_ns[has_previous] - event_ns[previous_positions[has_previous]]
        ) / (1_000_000_000 * SECONDS_PER_DAY)
        has_outcome_followup = has_next | (observation_ns <= followup_cutoff_ns)
        outside_recovery = ~has_previous | (days_since_event > washout_days)
        outside_late_onset = ~has_next | (days_to_event >= exclude_before_onset_days)
        eligible = outside_recovery & outside_late_onset & has_outcome_followup

        labelled.loc[observation_index, "next_event_at"] = pd.to_datetime(
            next_values, utc=True
        )
        labelled.loc[observation_index, "days_to_event"] = days_to_event
        labelled.loc[observation_index, "days_since_event"] = days_since_event
        labelled.loc[observation_index, "has_outcome_followup"] = has_outcome_followup
        labelled.loc[observation_index, "is_label_eligible"] = eligible
        for start, end in windows:
            values = (
                has_next
                & (days_to_event >= start)
                & (days_to_event <= end)
            ).astype(int)
            labelled.loc[
                observation_index,
                f"label_{start}_to_{end}d",
            ] = values

    return labelled
