from fastapi import APIRouter, HTTPException, Query
from app.core.database import supabase

router = APIRouter()


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
        print(f"❌ Error fetching sensor readings: {e}")
        raise HTTPException(status_code=500, detail=str(e))