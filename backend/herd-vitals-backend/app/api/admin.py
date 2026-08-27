"""Administrator-only application role review endpoints."""

from datetime import datetime, timezone
from enum import StrEnum
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import AuthPrincipal, require_permissions
from app.core.database import supabase

router = APIRouter()
logger = logging.getLogger(__name__)


class AdminDecision(StrEnum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class RoleDecisionInput(BaseModel):
    decision: AdminDecision


def _load_role_requests(status_filter: str | None = None) -> list[dict]:
    query = (
        supabase.table("user_roles")
        .select("user_id, role, status, assigned_by, assigned_at, created_at, updated_at")
        .order("created_at", desc=True)
    )
    if status_filter:
        query = query.eq("status", status_filter)
    role_rows = query.execute().data or []
    if not role_rows:
        return []

    profile_rows = (
        supabase.table("profiles")
        .select("id, email, display_name, organization_name, requested_role")
        .execute()
        .data
        or []
    )
    profiles = {str(row["id"]): row for row in profile_rows}
    return [
        {
            **row,
            "email": profiles.get(str(row["user_id"]), {}).get("email"),
            "display_name": profiles.get(str(row["user_id"]), {}).get("display_name"),
            "organization_name": profiles.get(str(row["user_id"]), {}).get("organization_name"),
            "requested_role": profiles.get(str(row["user_id"]), {}).get("requested_role"),
        }
        for row in role_rows
    ]


@router.get("/admin/role-requests")
def list_role_requests(
    status: str | None = Query(default=None, pattern="^(PENDING|ACTIVE|SUSPENDED)$"),
    _principal: AuthPrincipal = Depends(require_permissions("admin.manage")),
):
    """Return application-role assignments for the admin control centre."""
    try:
        return _load_role_requests(status)
    except Exception as exc:
        logger.exception("Could not load role requests: %s", exc)
        raise HTTPException(status_code=502, detail="Could not load role requests") from exc


@router.patch("/admin/role-requests/{user_id}")
def decide_role_request(
    user_id: UUID,
    decision: RoleDecisionInput,
    principal: AuthPrincipal = Depends(require_permissions("admin.manage")),
):
    """Approve or reject a non-admin application role."""
    try:
        existing_response = (
            supabase.table("user_roles")
            .select("user_id, role, status")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        existing = (existing_response.data or [None])[0]
        if not existing:
            raise HTTPException(status_code=404, detail="Role request not found")
        if existing["role"] == "ADMIN":
            raise HTTPException(
                status_code=403,
                detail="Administrator accounts cannot be changed from the approval queue",
            )

        now = datetime.now(timezone.utc).isoformat()
        update_payload = {
            "status": "ACTIVE" if decision.decision == AdminDecision.APPROVE else "SUSPENDED",
            "assigned_by": principal.user_id,
            "updated_at": now,
        }
        if decision.decision == AdminDecision.APPROVE:
            update_payload["assigned_at"] = now

        updated = (
            supabase.table("user_roles")
            .update(update_payload)
            .eq("user_id", str(user_id))
            .execute()
        )
        if not updated.data:
            raise HTTPException(status_code=502, detail="Role request was not updated")

        matching = [
            row for row in _load_role_requests() if str(row["user_id"]) == str(user_id)
        ]
        return matching[0] if matching else updated.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not process role request %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="Could not process role request") from exc
