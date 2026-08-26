"""Event-first synthetic longitudinal data for pipeline verification only."""

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SyntheticCohort:
    observations: pd.DataFrame
    events: pd.DataFrame


def generate_event_first_cohort(
    *,
    animal_count: int = 48,
    days: int = 120,
    readings_per_day: int = 4,
    seed: int = 42,
) -> SyntheticCohort:
    """
    Generate explicit event dates first, then pre-event sensor trajectories.

    This is intended for leakage tests, API demonstrations and benchmark smoke
    runs. It must never be described as clinical validation data.
    """
    if animal_count < 12:
        raise ValueError("animal_count must be at least 12")
    if days < 60:
        raise ValueError("days must be at least 60")
    if readings_per_day < 1:
        raise ValueError("readings_per_day must be positive")

    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2026-01-01", tz="UTC")
    frequency = pd.Timedelta(days=1) / readings_per_day
    timestamps = pd.date_range(
        start,
        periods=days * readings_per_day,
        freq=frequency,
    )
    event_centres = (int(days * 0.38), int(days * 0.68), int(days * 0.90))

    observations = []
    events = []
    for animal_index in range(animal_count):
        animal_id = f"SYN-{animal_index + 1:03d}"
        base_ec = rng.uniform(3.8, 4.9)
        base_temperature = rng.uniform(38.1, 38.8)
        base_yield = rng.uniform(18, 34)
        base_activity = rng.uniform(75, 125)
        base_rumination = rng.uniform(390, 560)

        event_times = []
        band = animal_index % 4
        if band < 3:
            event_day = int(
                np.clip(event_centres[band] + rng.integers(-4, 5), 18, days + 7)
            )
            event_time = start + pd.Timedelta(days=event_day)
            event_times.append(event_time)
            events.append(
                {
                    "animal_id": animal_id,
                    "event_time": event_time,
                    "status": "CONFIRMED",
                    "diagnosis_method": "OTHER",
                    "diagnosis_result": "SYNTHETIC_POSITIVE",
                    "is_simulated": True,
                }
            )

        for timestamp in timestamps:
            future_deltas = [
                (event_time - timestamp).total_seconds() / 86_400
                for event_time in event_times
                if event_time > timestamp
            ]
            days_to_event = min(future_deltas) if future_deltas else np.inf
            if 0 < days_to_event <= 14:
                progression = (14 - days_to_event) / 14
            else:
                progression = 0.0

            observations.append(
                {
                    "animal_id": animal_id,
                    "observed_at": timestamp,
                    "milk_ec": base_ec + rng.normal(0, 0.08) + progression * 2.1,
                    "milk_temperature": (
                        base_temperature + rng.normal(0, 0.06) + progression * 0.85
                    ),
                    "milk_yield": (
                        base_yield + rng.normal(0, 0.6) - progression * base_yield * 0.18
                    ),
                    "activity": (
                        base_activity + rng.normal(0, 4) - progression * base_activity * 0.22
                    ),
                    "rumination": (
                        base_rumination + rng.normal(0, 12) - progression * base_rumination * 0.16
                    ),
                    "farm_id": f"SYN-FARM-{animal_index % 3 + 1}",
                    "is_simulated": True,
                }
            )

    return SyntheticCohort(
        observations=pd.DataFrame(observations),
        events=pd.DataFrame(events),
    )
