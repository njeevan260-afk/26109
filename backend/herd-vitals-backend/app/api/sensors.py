import logging

from fastapi import APIRouter, HTTPException, Query
from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


def _reading_risk_level(sensor_type: str, value) -> str:
    """Classify an individual reading using the model fallback thresholds."""
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return "NONE"

    sensor_type = str(sensor_type or "").upper()
    if sensor_type == "EC":
        if numeric_value > 6.0:
            return "HIGH"
        if numeric_value > 5.0:
            return "MODERATE"
        if numeric_value > 4.5:
            return "LOW"
    elif sensor_type == "TEMP":
        if numeric_value > 39.5:
            return "HIGH"
        if numeric_value > 39.0:
            return "MODERATE"
        if numeric_value > 38.5:
            return "LOW"

    return "NONE"


@router.get("/sensors/real-readings")
async def get_real_sensor_readings(
    limit: int = Query(500, ge=1, le=1000)
):
    """Return only readings received from physical devices."""
    try:
        response = (
            supabase
            .table("sensor_readings")
            .select(
                "id,animal_id,sensor_type,value,unit,reading_time,"
                "is_simulated,device_id,quality_flag"
            )
            .eq("is_simulated", False)
            .order("reading_time", desc=True)
            .limit(limit)
            .execute()
        )
        readings = response.data or []

        animal_ids = sorted({
            reading["animal_id"]
            for reading in readings
            if reading.get("animal_id")
        })
        animals_by_id = {}
        if animal_ids:
            animals_response = (
                supabase
                .table("animals")
                .select("id,tag_number,breed")
                .in_("id", animal_ids)
                .execute()
            )
            animals_by_id = {
                animal["id"]: animal
                for animal in (animals_response.data or [])
            }

        return [
            {
                **reading,
                "risk_level": _reading_risk_level(
                    reading.get("sensor_type"), reading.get("value")
                ),
                "tag_number": animals_by_id.get(
                    reading.get("animal_id"), {}
                ).get("tag_number"),
                "breed": animals_by_id.get(
                    reading.get("animal_id"), {}
                ).get("breed"),
            }
            for reading in readings
        ]

    except Exception as e:
        logger.exception("Could not fetch real sensor readings: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Could not load real sensor readings",
        ) from e


@router.get("/sensors/{animal_id}")
async def get_sensor_readings(
    animal_id: str,
    limit: int = Query(100, ge=1, le=1000)
):
    try:
        response = (
            supabase
            .table("sensor_readings")
            .select("*")
            .eq("animal_id", animal_id)
            .order("reading_time", desc=True)
            .limit(limit)
            .execute()
        )

        return response.data or []

    except Exception as e:
        logger.exception("Could not fetch sensor readings: %s", e)
        raise HTTPException(status_code=502, detail="Could not load sensor readings") from e
