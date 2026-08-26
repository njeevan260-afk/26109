from datetime import date
import json
import traceback

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from app.core.database import supabase
from app.services.ml_service import get_or_train_model, heuristic_fallback
from app.api.alerts import create_high_risk_alert

router = APIRouter()


def _save_prediction(animal_id: str, prediction: dict) -> None:
    category = prediction.get("category") or "NONE"
    base = {
        "animal_id": animal_id,
        "prediction_date": date.today().isoformat(),
        "risk_7day": prediction.get("risk_7day", 0),
        "risk_14day": prediction.get("risk_14day", 0),
        "is_simulated": True,
    }
    attempts = [
        {
            **base,
            "risk_category": category,
            "risk_level": category,
            "model_version": prediction.get("note") and "v1.0-heuristic" or "v1.0",
            "feature_importance": json.dumps(prediction.get("factors", {})),
        },
        {
            **base,
            "risk_category": category,
            "feature_importance": json.dumps(prediction.get("factors", {})),
        },
        {
            **base,
            "risk_level": category,
        },
        base,
    ]
    for payload in attempts:
        try:
            supabase.table("predictions").insert(payload).execute()
            return
        except Exception as exc:
            last_error = exc
    print(f"⚠️ Could not save prediction: {last_error}")


@router.post("/predict/{animal_id}")
async def predict_risk(animal_id: str):
    """
    Always returns a prediction payload. Model column mismatches
    fall back to the heuristic so the UI never receives a 500.
    """
    try:
        print(f"🔍 Predicting for animal: {animal_id}")
        model = get_or_train_model()

        response = (
            supabase.table("sensor_readings")
            .select("sensor_type, value, reading_time")
            .eq("animal_id", animal_id)
            .order("reading_time", desc=False)
            .limit(100)
            .execute()
        )

        readings_df = pd.DataFrame(response.data or [])
        if readings_df.empty:
            prediction = heuristic_fallback(animal_id, readings_df)
        else:
            try:
                prediction = model.predict_risk(animal_id, readings_df)
            except Exception as exc:
                print(f"⚠️ Model predict failed, using heuristic: {exc}")
                traceback.print_exc()
                prediction = heuristic_fallback(animal_id, readings_df)

        if not isinstance(prediction, dict):
            prediction = heuristic_fallback(animal_id, readings_df)

        _save_prediction(animal_id, prediction)

        if str(prediction.get("category", "")).upper() == "HIGH":
            create_high_risk_alert(animal_id, prediction)

        return prediction

    except Exception as e:
        print(f"❌ Prediction error: {str(e)}")
        traceback.print_exc()
        fallback = heuristic_fallback(animal_id, pd.DataFrame())
        try:
            _save_prediction(animal_id, fallback)
        except Exception:
            pass
        return fallback


@router.get("/predictions")
async def list_predictions(limit: int = Query(500, ge=1, le=5000)):
    try:
        response = (
            supabase.table("predictions")
            .select("*")
            .order("prediction_date", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"⚠️ Could not list predictions: {e}")
        return []


@router.get("/predictions/{animal_id}")
async def get_prediction_history(animal_id: str, limit: int = Query(10)):
    try:
        response = (
            supabase.table("predictions")
            .select("*")
            .eq("animal_id", animal_id)
            .order("prediction_date", desc=True)
            .limit(limit)
            .execute()
        )
        history = []
        for row in (response.data or []):
            factors = row.get("feature_importance") or row.get("factors") or {}
            if isinstance(factors, str):
                try:
                    factors = json.loads(factors)
                except Exception:
                    factors = {}
            history.append({
                "prediction_date": row.get("prediction_date") or row.get("created_at"),
                "risk_7day": row.get("risk_7day", 0),
                "risk_14day": row.get("risk_14day", 0),
                "risk_category": row.get("risk_category") or row.get("risk_level") or "NONE",
                "feature_importance": factors,
            })
        return {"animal_id": animal_id, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
