from collections import Counter
from datetime import date, datetime, timezone
import logging
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException
from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


def _normalize_risk(value) -> float:
    try:
        risk = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    return risk / 100 if risk > 1 else risk


def _build_risk_history(predictions, latest_predictions, today=None):
    """Build observed history and finish it with the current herd snapshot."""
    today = today or date.today()
    latest_by_animal_date = {}
    for prediction in predictions:
        prediction_date = str(prediction.get("prediction_date") or "")[:10]
        animal_id = prediction.get("animal_id")
        if not prediction_date or not animal_id:
            continue
        latest_by_animal_date.setdefault((prediction_date, animal_id), prediction)

    history_counter = {}
    for (prediction_date, _animal_id), prediction in latest_by_animal_date.items():
        history_counter.setdefault(prediction_date, []).append(
            _normalize_risk(prediction.get("risk_7day"))
        )

    risk_history = [
        {
            "prediction_date": prediction_date,
            "risk_7day": round(sum(values) / len(values), 4),
            "is_current_snapshot": False,
        }
        for prediction_date, values in sorted(history_counter.items())
        if values
    ]

    today_string = today.isoformat()
    risk_history = [
        item for item in risk_history if item["prediction_date"] < today_string
    ]
    if latest_predictions:
        current_values = [
            _normalize_risk(prediction.get("risk_7day"))
            for prediction in latest_predictions
        ]
        risk_history.append(
            {
                "prediction_date": today_string,
                "risk_7day": round(sum(current_values) / len(current_values), 4),
                "is_current_snapshot": True,
            }
        )

    return sorted(risk_history, key=lambda item: item["prediction_date"])[-14:]


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

    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    risk_history = _build_risk_history(predictions, latest, today=today)

    return {
        "total_cows": total_cows,
        "high_risk": high_risk,
        "high_risk_7day": high_risk,
        "moderate_high": moderate_high,
        "moderate_high_14day": moderate_high,
        "herd_risk_index": round(max(0, min(100, herd_risk_index)), 1),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "history_through": today.isoformat(),
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
