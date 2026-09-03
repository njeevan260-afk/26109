from datetime import datetime, timezone
import logging

from fastapi import APIRouter, HTTPException

from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)
ONLINE_WINDOW_SECONDS = 20


@router.get("/health/hardware")
async def hardware_status():
    """Report the latest real device activity instead of a static healthy value."""
    try:
        response = (
            supabase.table("sensor_readings")
            .select("device_id, reading_time, is_simulated")
            .eq("is_simulated", False)
            .order("reading_time", desc=True)
            .limit(1)
            .execute()
        )
        if not response.data:
            return {
                "status": "offline",
                "device_id": "none",
                "signal_strength": 0,
                "battery": 0,
                "last_reading": None,
                "data_source": "unavailable",
            }

        latest = response.data[0]
        reading_time = datetime.fromisoformat(
            str(latest["reading_time"]).replace("Z", "+00:00")
        ).astimezone(timezone.utc)
        age_seconds = max(
            0, (datetime.now(timezone.utc) - reading_time).total_seconds()
        )
        is_online = age_seconds <= ONLINE_WINDOW_SECONDS
        is_simulated = bool(latest.get("is_simulated"))
        return {
            "status": "online" if is_online else "offline",
            "device_id": latest.get("device_id") or "unknown",
            "signal_strength": 100 if is_online else 0,
            "battery": None,
            "last_reading": reading_time.isoformat(),
            "age_minutes": round(age_seconds / 60, 1),
            "data_source": "simulated" if is_simulated else "live",
        }
    except Exception as exc:
        logger.exception("Hardware health query failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not load hardware status") from exc
