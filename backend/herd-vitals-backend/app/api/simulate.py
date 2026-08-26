import threading
import traceback

from fastapi import APIRouter, HTTPException
from app.core.database import supabase
from app.utils.data_generator import generate_cow_profile, generate_time_series

router = APIRouter()


def _train_in_background():
    try:
        from app.services.ml_service import risk_model
        risk_model.train_model()
    except Exception as exc:
        print(f"⚠️ Background training skipped: {exc}")


@router.post("/simulate")
async def simulate_herd():
    """
    Generates 20 cows (COW-100 … COW-119) and 90 days of sensor data.
    """
    try:
        try:
            supabase.table("sensor_readings").delete().eq("is_simulated", True).execute()
        except Exception as exc:
            print(f"⚠️ Could not clear simulated readings: {exc}")

        try:
            supabase.table("animals").delete().like("tag_number", "COW-%").execute()
        except Exception as exc:
            print(f"⚠️ Could not clear simulated animals: {exc}")

        cow_profiles = [generate_cow_profile(i) for i in range(20)]
        inserted_cows = []

        for profile in cow_profiles:
            result = supabase.table("animals").insert(profile).execute()
            if result.data:
                inserted_cows.append(result.data[0])

        print(f"✅ Inserted {len(inserted_cows)} cows into Supabase.")

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
            print(f"Inserted {len(chunk)} readings...")

        threading.Thread(target=_train_in_background, daemon=True).start()

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
        print(f"❌ Error in /simulate: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
