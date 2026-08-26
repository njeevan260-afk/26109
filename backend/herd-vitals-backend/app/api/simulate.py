import logging

from fastapi import APIRouter, HTTPException
from app.api.model import train_in_background
from app.core.database import supabase
from app.utils.data_generator import generate_cow_profile, generate_time_series

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/simulate")
async def simulate_herd():
    """
    Generates 20 cows (COW-100 through COW-119) and 90 days of sensor data.
    """
    try:
        try:
            supabase.table("sensor_readings").delete().eq("is_simulated", True).execute()
        except Exception as exc:
            logger.warning("Could not clear simulated readings: %s", exc)

        try:
            supabase.table("animals").delete().like("tag_number", "COW-%").execute()
        except Exception as exc:
            logger.warning("Could not clear simulated animals: %s", exc)

        cow_profiles = [generate_cow_profile(i) for i in range(20)]
        inserted_cows = []

        for profile in cow_profiles:
            result = supabase.table("animals").insert(profile).execute()
            if result.data:
                inserted_cows.append(result.data[0])

        logger.info("Inserted %s cows into Supabase", len(inserted_cows))

        all_readings = []
        for cow in inserted_cows:
            readings = generate_time_series(
                animal_id=cow["id"],
                baseline_ec=cow["baseline_ec"],
                baseline_temp=cow["baseline_temp"],
            )
            all_readings.extend(readings)

        chunk_size = 500
        for i in range(0, len(all_readings), chunk_size):
            chunk = all_readings[i:i + chunk_size]
            supabase.table("sensor_readings").insert(chunk).execute()
            logger.info("Inserted %s readings", len(chunk))

        train_in_background()

        return {
            "status": "success",
            "message": (
                f"Created {len(inserted_cows)} cows and "
                f"{len(all_readings)} sensor readings."
            ),
            "cows": [
                {
                    "id": cow.get("id"),
                    "tag_number": cow.get("tag_number"),
                    "breed": cow.get("breed"),
                }
                for cow in inserted_cows
            ],
        }

    except Exception as e:
        logger.exception("Simulation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
