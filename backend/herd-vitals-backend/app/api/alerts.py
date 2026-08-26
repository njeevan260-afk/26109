from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from app.core.database import supabase

router = APIRouter()


def _animal_tag_map():
    try:
        response = (
            supabase
            .table("animals")
            .select("id, tag_number")
            .execute()
        )
        return {
            str(row.get("id")): row.get("tag_number") or str(row.get("id"))
            for row in (response.data or [])
        }
    except Exception as exc:
        print(f"[WARNING] Could not load animal tags: {exc}")
        return {}


def create_high_risk_alert(animal_id: str, prediction: dict) -> None:
    """
    Insert an alert whenever a cow is classified HIGH.
    Failures are logged and never crash prediction.
    """
    try:
        tag = prediction.get("tag_number") or animal_id
        risk_pct = round(float(prediction.get("risk_7day") or 0) * 100)
        payload = {
            "animal_id": animal_id,
            "severity": "HIGH",
            "status": "UNRESOLVED",
            "message": (
                f"{tag} classified HIGH risk "
                f"({risk_pct}% 7-day). Inspect udder immediately."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("alerts").insert(payload).execute()
        print(f"🚨 Alert created for {tag}")
    except Exception as exc:
        print(f"⚠️ Could not create alert: {exc}")
        try:
            supabase.table("alerts").insert({
                "animal_id": animal_id,
                "severity": "HIGH",
                "message": f"High mastitis risk detected for {animal_id}.",
            }).execute()
        except Exception as retry_exc:
            print(f"⚠️ Alert retry failed: {retry_exc}")


@router.get("/alerts")
async def get_alerts():
    try:
        response = (
            supabase
            .table("alerts")
            .select("*")
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        tags = _animal_tag_map()
        alerts = []
        for alert in (response.data or []):
            animal_id = str(alert.get("animal_id") or "Unknown")
            alerts.append({
                **alert,
                "animal_id": animal_id,
                "tag_number": tags.get(animal_id, alert.get("tag_number") or animal_id),
                "severity": str(alert.get("severity") or "MODERATE").upper(),
                "status": str(alert.get("status") or "UNRESOLVED").upper(),
                "message": alert.get("message") or "Mastitis risk detected.",
                "created_at": alert.get("created_at") or datetime.now(timezone.utc).isoformat(),
            })
        return alerts
    except Exception as e:
        print(f"❌ Error fetching alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
