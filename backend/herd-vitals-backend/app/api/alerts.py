from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import AuthPrincipal, require_permissions
from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


def _animal_details_map():
    try:
        response = (
            supabase
            .table("animals")
            .select("id, tag_number, breed")
            .execute()
        )
        return {
            str(row.get("id")): {
                "tag_number": row.get("tag_number") or str(row.get("id")),
                "breed": row.get("breed") or "Breed unavailable",
            }
            for row in (response.data or [])
        }
    except Exception as exc:
        logger.warning("Could not load animal details: %s", exc)
        return {}


def create_high_risk_alert(animal_id: str, prediction: dict) -> None:
    """
    Insert an alert whenever a cow is classified HIGH.
    Failures are logged and never crash prediction.
    """
    try:
        existing = (
            supabase.table("alerts")
            .select("id")
            .eq("animal_id", animal_id)
            .eq("status", "UNRESOLVED")
            .limit(1)
            .execute()
        )
        if existing.data:
            logger.info("Skipped duplicate unresolved alert for %s", animal_id)
            return

        tag = prediction.get("tag_number") or animal_id
        risk_pct = round(float(prediction.get("risk_7day") or 0) * 100)
        payload = {
            "animal_id": animal_id,
            "severity": "HIGH",
            "status": "UNRESOLVED",
            "message": (
                f"{tag} classified HIGH risk "
                f"({risk_pct}% prototype signal). Inspect the animal and confirm clinically."
            ),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("alerts").insert(payload).execute()
        logger.info("Alert created for %s", tag)
    except Exception as exc:
        logger.exception("Could not create alert for %s: %s", animal_id, exc)


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
        animal_details = _animal_details_map()
        alerts = []
        for alert in (response.data or []):
            animal_id = str(alert.get("animal_id") or "Unknown")
            details = animal_details.get(animal_id, {})
            alerts.append({
                **alert,
                "animal_id": animal_id,
                "tag_number": details.get(
                    "tag_number",
                    alert.get("tag_number") or animal_id,
                ),
                "breed": details.get(
                    "breed",
                    alert.get("breed") or "Breed unavailable",
                ),
                "severity": str(alert.get("severity") or "MODERATE").upper(),
                "status": str(alert.get("status") or "UNRESOLVED").upper(),
                "message": alert.get("message") or "Mastitis risk detected.",
                "created_at": alert.get("created_at") or datetime.now(timezone.utc).isoformat(),
            })
        return alerts
    except Exception as e:
        logger.exception("Could not fetch alerts: %s", e)
        raise HTTPException(status_code=502, detail="Could not load alerts") from e


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    _principal: AuthPrincipal = Depends(require_permissions("alerts.manage")),
):
    try:
        response = (
            supabase.table("alerts")
            .update({"status": "RESOLVED"})
            .eq("id", alert_id)
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=404, detail="Alert not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not resolve alert %s: %s", alert_id, exc)
        raise HTTPException(status_code=502, detail="Could not resolve alert") from exc
