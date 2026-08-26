from collections import Counter
import logging

from fastapi import APIRouter, HTTPException
from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/dashboard/summary")
async def dashboard_summary():
    try:
        animals_response = (
            supabase.table("animals").select("id, tag_number").execute()
        )
        animals = animals_response.data or []
        total_cows = len(animals)

        predictions_response = (
            supabase.table("predictions")
            .select("animal_id, prediction_date, created_at, risk_7day, risk_14day, risk_category")
            .order("prediction_date", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        predictions = predictions_response.data or []
    except Exception as exc:
        logger.exception("Dashboard summary query failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not load dashboard summary") from exc

    latest_predictions = {}
    for prediction in predictions:
        animal_id = prediction.get("animal_id")
        if animal_id and animal_id not in latest_predictions:
            latest_predictions[animal_id] = prediction

    latest = list(latest_predictions.values())

    def category_of(row):
        value = str(
            row.get("risk_category")
            or "NONE"
        ).upper()
        if value == "NORMAL":
            return "NONE"
        return value if value in {"HIGH", "MODERATE", "LOW", "NONE"} else "NONE"

    risk_counts = Counter(category_of(p) for p in latest)
    high_risk = risk_counts.get("HIGH", 0)
    moderate_risk = risk_counts.get("MODERATE", 0)
    low_risk = risk_counts.get("LOW", 0)
    animals_without_predictions = max(0, total_cows - len(latest))
    none_risk = risk_counts.get("NONE", 0) + animals_without_predictions
    moderate_high = high_risk + moderate_risk

    denominator = total_cows or len(latest) or 1
    if latest:
        herd_risk_index = (
            (high_risk * 1.0 + moderate_risk * 0.5 + low_risk * 0.2) / denominator
        ) * 100
    else:
        herd_risk_index = 0

    latest_by_animal_date = {}
    for prediction in predictions:
        date = str(prediction.get("prediction_date") or "")[:10]
        animal_id = prediction.get("animal_id")
        if not date or not animal_id:
            continue
        latest_by_animal_date.setdefault((date, animal_id), prediction)

    history_counter = {}
    for (date, _animal_id), prediction in latest_by_animal_date.items():
        history_counter.setdefault(date, []).append(float(prediction.get("risk_7day") or 0))

    risk_history = []
    for date, values in sorted(history_counter.items()):
        avg_risk = sum(values) / len(values) if values else 0
        if avg_risk > 1:
            avg_risk = avg_risk / 100
        risk_history.append({
            "prediction_date": date,
            "risk_7day": round(avg_risk, 4),
        })
    risk_history = risk_history[-14:]

    return {
        "total_cows": total_cows,
        "high_risk": high_risk,
        "high_risk_7day": high_risk,
        "moderate_high": moderate_high,
        "moderate_high_14day": moderate_high,
        "herd_risk_index": round(max(0, min(100, herd_risk_index)), 1),
        "risk_distribution": {
            "HIGH": high_risk,
            "MODERATE": moderate_risk,
            "LOW": low_risk,
            "NONE": none_risk,
            "high": high_risk,
            "moderate": moderate_risk,
            "low": low_risk,
            "none": none_risk,
        },
        "risk_history": risk_history,
    }
