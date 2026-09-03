from datetime import datetime, timezone
import hmac
import logging
import os
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


class SensorReadingInput(BaseModel):
    animal_id: str = Field(min_length=1, max_length=100)
    sensor_type: Literal["EC", "TEMP"]
    value: float
    unit: str = Field(min_length=1, max_length=20)
    reading_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_id: str = Field(min_length=1, max_length=100)
    is_simulated: bool = False

    @model_validator(mode="after")
    def validate_sensor_range(self):
        if self.sensor_type == "EC" and not 0 <= self.value <= 20:
            raise ValueError("EC must be between 0 and 20 mS/cm")
        if self.sensor_type == "TEMP" and not 30 <= self.value <= 45:
            raise ValueError("Temperature must be between 30 and 45 degrees C")
        return self


class SensorReadingBatch(BaseModel):
    readings: list[SensorReadingInput] = Field(min_length=1, max_length=500)


def _verify_device_key(provided_key: str | None) -> None:
    configured_key = os.getenv("DEVICE_INGESTION_KEY")
    if not configured_key:
        return
    if not provided_key or not hmac.compare_digest(provided_key, configured_key):
        raise HTTPException(status_code=401, detail="Invalid device key")


@router.post("/readings", status_code=202)
async def ingest_readings(
    batch: SensorReadingBatch,
    background_tasks: BackgroundTasks,
    x_device_key: str | None = Header(default=None),
):
    """Validate and store a bounded batch of device sensor readings."""
    _verify_device_key(x_device_key)

    animal_ids = sorted({reading.animal_id for reading in batch.readings})
    try:
        animal_response = (
            supabase.table("animals")
            .select("id")
            .in_("id", animal_ids)
            .execute()
        )
        existing_ids = {str(row["id"]) for row in animal_response.data or []}
        missing_ids = [animal_id for animal_id in animal_ids if animal_id not in existing_ids]
        if missing_ids:
            raise HTTPException(
                status_code=422,
                detail={"message": "Unknown animal IDs", "animal_ids": missing_ids},
            )

        payload = [
            {
                **reading.model_dump(exclude={"reading_time"}),
                "reading_time": reading.reading_time.astimezone(timezone.utc).isoformat(),
            }
            for reading in batch.readings
        ]
        response = supabase.table("sensor_readings").insert(payload).execute()
        stored = response.data or []
        live_animal_ids = sorted(
            {
                reading.animal_id
                for reading in batch.readings
                if not reading.is_simulated
            }
        )
        if live_animal_ids:
            # Import here to keep API modules independently importable in tests.
            from app.api.predictions import process_live_risk_alerts

            background_tasks.add_task(process_live_risk_alerts, live_animal_ids)
        return {
            "status": "accepted",
            "accepted": len(stored) or len(payload),
            "device_ids": sorted({reading.device_id for reading in batch.readings}),
            "authentication": "device_key" if os.getenv("DEVICE_INGESTION_KEY") else "disabled",
            "risk_checks_scheduled": len(live_animal_ids),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Sensor ingestion failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not store sensor readings") from exc
