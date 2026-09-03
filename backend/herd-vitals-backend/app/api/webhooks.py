import json
import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app.services.whatsapp_service import record_delivery_update, verify_webhook_signature

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/webhooks/ycloud")
async def ycloud_webhook(
    request: Request,
    ycloud_signature: str | None = Header(default=None),
):
    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, ycloud_signature):
        raise HTTPException(status_code=401, detail="Invalid YCloud signature")
    try:
        event = json.loads(raw_body)
        record_delivery_update(event)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc
    except Exception as exc:
        logger.exception("Could not process YCloud webhook: %s", exc)
        raise HTTPException(status_code=503, detail="Webhook processing failed") from exc
    return {"received": True}
