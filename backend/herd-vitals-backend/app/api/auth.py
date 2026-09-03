"""Authenticated identity and RBAC status endpoints."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import AuthPrincipal, get_current_principal
from app.core.database import supabase

router = APIRouter()


@router.get("/auth/me")
def current_identity(
    principal: AuthPrincipal = Depends(get_current_principal),
):
    try:
        response = (
            supabase.table("profiles")
            .select(
                "display_name, phone_number, whatsapp_alerts_enabled,"
                " organization_name, requested_role"
            )
            .eq("id", principal.user_id)
            .limit(1)
            .execute()
        )
        profile = (response.data or [{}])[0]
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not load the user profile",
        ) from exc

    return {
        "user_id": principal.user_id,
        "email": principal.email,
        "display_name": profile.get("display_name"),
        "phone_number": profile.get("phone_number"),
        "whatsapp_alerts_enabled": bool(profile.get("whatsapp_alerts_enabled")),
        "organization_name": profile.get("organization_name"),
        "requested_role": profile.get("requested_role"),
        "role": principal.role.value if principal.role else None,
        "account_status": principal.account_status.value,
        "permissions": sorted(principal.permissions),
        "dashboard_path": principal.dashboard_path,
    }
