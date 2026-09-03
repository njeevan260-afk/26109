"""YCloud WhatsApp delivery for elevated live animal-risk signals."""

from datetime import datetime, timezone
import hashlib
import hmac
import logging
import os
import time
from uuid import uuid4

import httpx

from app.core.database import supabase

logger = logging.getLogger(__name__)

YCLOUD_MESSAGES_URL = "https://api.ycloud.com/v2/whatsapp/messages"
ALERT_CATEGORIES = frozenset({"HIGH", "MODERATE"})
DEFAULT_ALERT_ROLES = frozenset(
    {
        "ADMIN",
        "DAIRY_FARMER",
        "VETERINARIAN",
        "DAIRY_COOPERATIVE",
        "ANIMAL_HEALTH_AUTHORITY",
    }
)


def _configured_roles() -> frozenset[str]:
    raw = os.getenv("WHATSAPP_ALERT_ROLES", "")
    if not raw.strip():
        return DEFAULT_ALERT_ROLES
    return frozenset(role.strip().upper() for role in raw.split(",") if role.strip())


def is_configured() -> bool:
    return all(
        os.getenv(name)
        for name in (
            "YCLOUD_API_KEY",
            "YCLOUD_WHATSAPP_FROM",
            "YCLOUD_WHATSAPP_TEMPLATE_NAME",
        )
    )


def _active_recipients() -> list[dict]:
    role_rows = (
        supabase.table("user_roles")
        .select("user_id,role")
        .eq("status", "ACTIVE")
        .execute()
    ).data or []
    allowed_roles = _configured_roles()
    active_ids = {
        str(row["user_id"])
        for row in role_rows
        if str(row.get("role") or "").upper() in allowed_roles
    }
    if not active_ids:
        return []

    profiles = (
        supabase.table("profiles")
        .select("id,display_name,phone_number,whatsapp_alerts_enabled")
        .in_("id", sorted(active_ids))
        .eq("whatsapp_alerts_enabled", True)
        .execute()
    ).data or []

    # A number receives one message even if it is accidentally shared by profiles.
    by_phone = {}
    for profile in profiles:
        phone = str(profile.get("phone_number") or "").strip()
        if phone:
            by_phone.setdefault(phone, profile)
    return list(by_phone.values())


def _claim_delivery(animal_id: str, recipient: dict, category: str) -> dict | None:
    """Atomically reserve one delivery per cow/phone in any rolling 24 hours."""
    external_id = f"herdvitals-{uuid4()}"
    response = supabase.rpc(
        "claim_whatsapp_risk_alert",
        {
            "p_animal_id": animal_id,
            "p_recipient_user_id": recipient.get("id"),
            "p_recipient_phone": recipient["phone_number"],
            "p_risk_category": category,
            "p_external_id": external_id,
        },
    ).execute()
    rows = response.data or []
    return rows[0] if rows else None


def _update_delivery(delivery_id: str, **values) -> None:
    values["updated_at"] = datetime.now(timezone.utc).isoformat()
    supabase.table("whatsapp_alert_deliveries").update(values).eq(
        "id", delivery_id
    ).execute()


def _template_parameters(prediction: dict, animal: dict) -> list[dict]:
    recommendations = prediction.get("recommendations") or []
    preventive_steps = "; ".join(str(item) for item in recommendations[:4])
    return [
        {"type": "text", "text": str(prediction["category"]).title()},
        {"type": "text", "text": str(animal.get("tag_number") or animal["id"])},
        {"type": "text", "text": str(animal.get("breed") or "not recorded")},
        {"type": "text", "text": f"{float(prediction.get('risk_7day') or 0) * 100:.0f}%"},
        {"type": "text", "text": f"{float(prediction.get('latest_ec') or 0):.2f} mS/cm"},
        {"type": "text", "text": f"{float(prediction.get('latest_temp') or 0):.2f} C"},
        {"type": "text", "text": preventive_steps or "Monitor closely and consult a veterinarian"},
    ]


def send_risk_alerts(animal_id: str, prediction: dict) -> dict:
    """Send an approved utility template to opted-in active users."""
    category = str(prediction.get("category") or "").upper()
    if category not in ALERT_CATEGORIES or prediction.get("data_source") != "live":
        return {"sent": 0, "skipped": "risk_not_elevated_or_not_live"}
    if not is_configured():
        logger.warning("YCloud is not configured; WhatsApp risk alert skipped")
        return {"sent": 0, "skipped": "ycloud_not_configured"}

    animal_rows = (
        supabase.table("animals")
        .select("id,tag_number,breed")
        .eq("id", animal_id)
        .limit(1)
        .execute()
    ).data or []
    if not animal_rows:
        return {"sent": 0, "skipped": "animal_not_found"}
    animal = animal_rows[0]

    sent = 0
    suppressed = 0
    failed = 0
    for recipient in _active_recipients():
        delivery_id = None
        try:
            claim = _claim_delivery(animal_id, recipient, category)
            if not claim:
                suppressed += 1
                continue
            delivery_id = str(claim["id"])
            payload = {
                "from": os.environ["YCLOUD_WHATSAPP_FROM"],
                "to": recipient["phone_number"],
                "type": "template",
                "template": {
                    "name": os.environ["YCLOUD_WHATSAPP_TEMPLATE_NAME"],
                    "language": {
                        "code": os.getenv("YCLOUD_WHATSAPP_TEMPLATE_LANGUAGE", "en"),
                        "policy": "deterministic",
                    },
                    "components": [
                        {"type": "body", "parameters": _template_parameters(prediction, animal)}
                    ],
                },
                "externalId": claim["external_id"],
                "filterUnsubscribed": True,
                "filterBlocked": True,
            }
            with httpx.Client(timeout=10.0) as client:
                response = client.post(
                    YCLOUD_MESSAGES_URL,
                    headers={
                        "Content-Type": "application/json",
                        "X-API-Key": os.environ["YCLOUD_API_KEY"],
                    },
                    json=payload,
                )
                response.raise_for_status()
            body = response.json()
            _update_delivery(
                delivery_id,
                status="QUEUED",
                ycloud_message_id=body.get("id") or body.get("wamid"),
            )
            sent += 1
        except Exception as exc:
            failed += 1
            logger.exception("Could not send WhatsApp alert for cow %s: %s", animal_id, exc)
            if delivery_id:
                try:
                    _update_delivery(
                        delivery_id,
                        status="REQUEST_FAILED",
                        error_message=str(exc)[:1000],
                    )
                except Exception:
                    logger.exception("Could not record failed WhatsApp delivery")
    return {"sent": sent, "suppressed": suppressed, "failed": failed}


def verify_webhook_signature(raw_body: bytes, header: str | None) -> bool:
    secret = os.getenv("YCLOUD_WEBHOOK_SECRET")
    if not secret or not header:
        return False
    try:
        parts = dict(item.split("=", 1) for item in header.split(","))
        timestamp = parts["t"]
        supplied = parts["s"]
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except (KeyError, ValueError):
        return False
    signed = timestamp.encode() + b"." + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(supplied, expected)


def record_delivery_update(event: dict) -> None:
    if event.get("type") != "whatsapp.message.updated":
        return
    message = event.get("whatsappMessage") or {}
    provider_id = message.get("id") or message.get("wamid")
    external_id = message.get("externalId")
    status = str(message.get("status") or "").upper()
    if status not in {"QUEUED", "SENT", "DELIVERED", "READ", "FAILED"}:
        return
    values = {
        "status": status,
        "error_message": message.get("errorMessage"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    query = supabase.table("whatsapp_alert_deliveries").update(values)
    if external_id:
        query.eq("external_id", external_id).execute()
    elif provider_id:
        query.eq("ycloud_message_id", provider_id).execute()
