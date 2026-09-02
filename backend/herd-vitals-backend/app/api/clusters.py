import logging
import math

from fastapi import APIRouter, HTTPException
from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)

RISK_PRIORITY = {"LOW": 0, "MODERATE": 1, "HIGH": 2}


@router.get("/clusters")
async def get_clusters():
    try:
        animals_resp = (
            supabase.table("animals")
            .select("id, tag_number, latitude, longitude")
            .execute()
        )
        animals = animals_resp.data or []
        preds_resp = (
            supabase.table("predictions")
            .select("animal_id, risk_category, prediction_date, created_at")
            .order("prediction_date", desc=True)
            .order("created_at", desc=True)
            .execute()
        )
        predictions = preds_resp.data or []
    except Exception as exc:
        logger.exception("Cluster query failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not load risk clusters") from exc

    latest = {}
    for row in predictions:
        animal_id = str(row.get("animal_id") or "")
        if animal_id and animal_id not in latest:
            latest[animal_id] = str(
                row.get("risk_category") or "NONE"
            ).upper()

    clusters = {}
    for animal in animals:
        latitude = animal.get("latitude")
        longitude = animal.get("longitude")
        if latitude is None or longitude is None:
            continue

        try:
            latitude = float(latitude)
            longitude = float(longitude)
        except (TypeError, ValueError):
            continue

        if (
            not math.isfinite(latitude)
            or not math.isfinite(longitude)
            or not -90 <= latitude <= 90
            or not -180 <= longitude <= 180
        ):
            continue

        location = (round(latitude, 2), round(longitude, 2))
        cluster = clusters.setdefault(location, {"tags": [], "risk": "LOW"})
        animal_id = str(animal.get("id") or "")
        tag = animal.get("tag_number") or animal_id
        cluster["tags"].append(tag)

        risk = latest.get(animal_id, "LOW")
        if risk not in RISK_PRIORITY:
            risk = "LOW"
        if RISK_PRIORITY[risk] > RISK_PRIORITY[cluster["risk"]]:
            cluster["risk"] = risk

    features = []
    for cluster_number, ((lat, lon), cluster) in enumerate(
        sorted(clusters.items()), start=1
    ):
        tags = cluster["tags"]
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": {
                "cluster_name": f"VTU Mysuru Cluster {cluster_number}",
                "risk_level": cluster["risk"],
                "affected_cows": tags[:12],
                "affected_count": len(tags),
                "location_source": "demo",
                "environment_data_available": False,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }
