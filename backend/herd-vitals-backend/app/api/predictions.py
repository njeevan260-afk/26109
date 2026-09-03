from datetime import date
import json
import logging
import traceback

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.api.alerts import create_elevated_risk_alert
from app.core.database import supabase
from app.services.ml_service import get_or_train_model, heuristic_fallback

router = APIRouter()
logger = logging.getLogger(__name__)

# Two sensor rows (EC and TEMP) are recorded at each sample. With the current
# four-samples-per-day simulator this covers 20 days of historical context.
PREDICTION_READING_LIMIT = 160


def _fetch_recent_readings(animal_id: str, live_only: bool = False) -> pd.DataFrame:
    query = (
        supabase.table("sensor_readings")
        .select("sensor_type, value, reading_time, is_simulated")
        .eq("animal_id", animal_id)
    )
    if live_only:
        query = query.eq("is_simulated", False)
    response = (
        query.order("reading_time", desc=True)
        .limit(PREDICTION_READING_LIMIT)
        .execute()
    )

    readings = pd.DataFrame(response.data or [])
    if readings.empty:
        return readings

    readings["reading_time"] = pd.to_datetime(
        readings["reading_time"], errors="coerce", utc=True
    )
    readings = readings.dropna(subset=["reading_time"])
    return readings.sort_values("reading_time").reset_index(drop=True)


def _compute_prediction(animal_id: str, live_only: bool = False) -> dict:
    try:
        readings = _fetch_recent_readings(animal_id, live_only=live_only)
    except Exception as exc:
        logger.exception("Could not fetch sensor readings for %s: %s", animal_id, exc)
        readings = pd.DataFrame()

    model = get_or_train_model()
    try:
        prediction = model.predict_risk(animal_id, readings)
    except Exception as exc:
        logger.exception("Model prediction failed for %s: %s", animal_id, exc)
        prediction = heuristic_fallback(animal_id, readings)

    if not isinstance(prediction, dict):
        prediction = heuristic_fallback(animal_id, readings)

    if readings.empty or "is_simulated" not in readings.columns:
        data_source = "unavailable"
    elif bool(readings["is_simulated"].fillna(False).all()):
        data_source = "simulated"
    else:
        data_source = "live"

    prediction["data_source"] = data_source
    prediction.setdefault("model_mode", "heuristic")
    return prediction


def _save_prediction(animal_id: str, prediction: dict) -> None:
    category = str(prediction.get("category") or "NONE").upper()
    model_mode = str(prediction.get("model_mode") or "heuristic")
    payload = {
        "animal_id": animal_id,
        "prediction_date": date.today().isoformat(),
        "risk_7day": prediction.get("risk_7day", 0),
        "risk_14day": prediction.get("risk_14day", 0),
        "risk_category": category,
        "model_version": f"v1.1-{model_mode.replace('_', '-')}",
        "feature_importance": json.dumps(prediction.get("factors", {})),
        "is_simulated": prediction.get("data_source") != "live",
    }
    supabase.table("predictions").insert(payload).execute()


def process_live_risk_alerts(animal_ids: list[str]) -> None:
    """Recompute each cow after live ingestion and notify on elevated risk."""
    from app.services.whatsapp_service import send_risk_alerts

    for animal_id in sorted(set(animal_ids)):
        try:
            prediction = _compute_prediction(animal_id, live_only=True)
            if prediction.get("data_source") != "live":
                continue
            _save_prediction(animal_id, prediction)
            category = str(prediction.get("category") or "").upper()
            if category in {"HIGH", "MODERATE"}:
                create_elevated_risk_alert(animal_id, prediction)
                send_risk_alerts(animal_id, prediction)
        except Exception as exc:
            # Notification failures must never make the hardware retry a batch
            # whose readings were already stored.
            logger.exception("Live risk processing failed for %s: %s", animal_id, exc)


@router.get("/predict/{animal_id}")
async def preview_risk(animal_id: str):
    """Compute current risk without writing prediction or alert rows."""
    return _compute_prediction(animal_id)


@router.post("/predict/{animal_id}")
async def recompute_risk(animal_id: str):
    """Compute and persist a prediction after an explicit user action."""
    prediction = _compute_prediction(animal_id)

    try:
        _save_prediction(animal_id, prediction)
    except Exception as exc:
        logger.exception("Could not save prediction for %s: %s", animal_id, exc)
        raise HTTPException(status_code=502, detail="Prediction was computed but could not be saved") from exc

    if str(prediction.get("category", "")).upper() in {"HIGH", "MODERATE"}:
        create_elevated_risk_alert(animal_id, prediction)

    prediction["persisted"] = True
    return prediction


@router.get("/predictions")
async def list_predictions(limit: int = Query(500, ge=1, le=5000)):
    try:
        response = (
            supabase.table("predictions")
            .select("*")
            .order("prediction_date", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.exception("Could not list predictions: %s", exc)
        raise HTTPException(status_code=502, detail="Could not load predictions") from exc


@router.get("/predictions/{animal_id}")
async def get_prediction_history(
    animal_id: str,
    limit: int = Query(10, ge=1, le=100),
):
    try:
        response = (
            supabase.table("predictions")
            .select("*")
            .eq("animal_id", animal_id)
            .order("prediction_date", desc=True)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        history = []
        for row in response.data or []:
            factors = row.get("feature_importance") or row.get("factors") or {}
            if isinstance(factors, str):
                try:
                    factors = json.loads(factors)
                except (TypeError, ValueError):
                    factors = {}
            history.append(
                {
                    "prediction_date": row.get("prediction_date") or row.get("created_at"),
                    "risk_7day": row.get("risk_7day", 0),
                    "risk_14day": row.get("risk_14day", 0),
                    "risk_category": row.get("risk_category") or "NONE",
                    "model_version": row.get("model_version"),
                    "feature_importance": factors,
                }
            )
        return {"animal_id": animal_id, "history": history}
    except Exception as exc:
        logger.exception("Could not load prediction history for %s: %s", animal_id, exc)
        raise HTTPException(status_code=502, detail="Could not load prediction history") from exc
