from fastapi import APIRouter
from app.core.database import supabase

router = APIRouter()

# Demo farm coordinates (Delhi NCR) — no schema change required.
BARN_POINTS = [
    ("Barn A — High Risk", 77.1025, 28.7041),
    ("Barn B — Moderate Watch", 77.1058, 28.7064),
    ("Barn C — Stable", 77.0992, 28.7018),
]


@router.get("/clusters")
async def get_clusters():
    try:
        animals_resp = supabase.table("animals").select("id, tag_number").execute()
        animals = animals_resp.data or []
        preds_resp = (
            supabase.table("predictions")
            .select("animal_id, risk_category, risk_level, prediction_date")
            .order("prediction_date", desc=True)
            .execute()
        )
        predictions = preds_resp.data or []
    except Exception as exc:
        print(f"⚠️ Cluster fetch failed: {exc}")
        animals, predictions = [], []

    latest = {}
    for row in predictions:
        animal_id = str(row.get("animal_id") or "")
        if animal_id and animal_id not in latest:
            latest[animal_id] = str(
                row.get("risk_category") or row.get("risk_level") or "NONE"
            ).upper()

    id_to_tag = {
        str(a.get("id")): a.get("tag_number") or str(a.get("id"))
        for a in animals
    }

    high, moderate, low = [], [], []
    for animal_id, tag in id_to_tag.items():
        risk = latest.get(animal_id, "NONE")
        if risk == "HIGH":
            high.append(tag)
        elif risk == "MODERATE":
            moderate.append(tag)
        else:
            low.append(tag)

    groups = [
        ("HIGH", high),
        ("MODERATE", moderate),
        ("LOW", low),
    ]

    features = []
    for (name, lon, lat), (risk, tags) in zip(BARN_POINTS, groups):
        if not tags and risk != "LOW":
            continue
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": {
                "cluster_name": name,
                "risk_level": risk,
                "affected_cows": tags[:12],
                "affected_count": len(tags),
                "environment": {
                    "temperature": 28.5,
                    "humidity": 65.0,
                    "hygiene_score": 85.0 if risk != "HIGH" else 62.0,
                },
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }
