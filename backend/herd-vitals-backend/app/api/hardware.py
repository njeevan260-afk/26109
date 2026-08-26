from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()


@router.get("/health/hardware")
async def hardware_status():

    return {
        "status": "online",
        "device_id": "ESP8266_01",
        "signal_strength": 85,
        "battery": 92,
        "last_reading": datetime.now(timezone.utc).isoformat()
    }