"""Collection endpoints for future-event ground truth."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import AuthPrincipal, require_active_user
from app.core.database import supabase
from app.models.mastitis_event import EventStatus, MastitisEventInput

router = APIRouter()
logger = logging.getLogger(__name__)


def _migration_missing(exc: Exception) -> bool:
    message = str(exc).lower()
    return "pgrst205" in message or (
        "mastitis_events" in message
        and any(token in message for token in ("schema cache", "not found", "does not exist"))
    )


def _database_error(exc: Exception, operation: str) -> HTTPException:
    if _migration_missing(exc):
        return HTTPException(
            status_code=503,
            detail="Scientific schema migration has not been applied",
        )
    logger.exception("Could not %s mastitis events: %s", operation, exc)
    return HTTPException(status_code=502, detail=f"Could not {operation} mastitis events")


@router.get("/mastitis-events")
async def list_mastitis_events(
    animal_id: UUID | None = None,
    status: EventStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
):
    """Return event ground truth, newest first, with optional bounded filters."""
    try:
        query = (
            supabase.table("mastitis_events")
            .select("*")
            .order("event_time", desc=True)
            .limit(limit)
        )
        if animal_id is not None:
            query = query.eq("animal_id", str(animal_id))
        if status is not None:
            query = query.eq("status", status.value)
        response = query.execute()
        return response.data or []
    except Exception as exc:
        raise _database_error(exc, "load") from exc


@router.post("/mastitis-events", status_code=201)
async def create_mastitis_event(
    event: MastitisEventInput,
    principal: AuthPrincipal = Depends(require_active_user),
):
    """Store one diagnostically supported event for later label construction."""
    if "events.report" not in principal.permissions:
        raise HTTPException(
            status_code=403,
            detail="Your role cannot report mastitis events",
        )
    if event.status.value == "CONFIRMED" and "events.confirm" not in principal.permissions:
        raise HTTPException(
            status_code=403,
            detail="Only veterinarians and animal-health authorities can confirm events",
        )
    try:
        animal = (
            supabase.table("animals")
            .select("id")
            .eq("id", str(event.animal_id))
            .limit(1)
            .execute()
        )
        if not animal.data:
            raise HTTPException(status_code=422, detail="Unknown animal_id")
        response = (
            supabase.table("mastitis_events")
            .insert(event.to_database_payload())
            .execute()
        )
        if not response.data:
            raise HTTPException(status_code=502, detail="Event was not returned after insert")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise _database_error(exc, "store") from exc
