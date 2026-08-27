"""Supabase bearer-token validation and authoritative application RBAC."""

from dataclasses import dataclass
from enum import StrEnum
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.database import supabase

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


class AppRole(StrEnum):
    ADMIN = "ADMIN"
    DAIRY_FARMER = "DAIRY_FARMER"
    VETERINARIAN = "VETERINARIAN"
    DAIRY_COOPERATIVE = "DAIRY_COOPERATIVE"
    ANIMAL_HEALTH_AUTHORITY = "ANIMAL_HEALTH_AUTHORITY"


class AccountStatus(StrEnum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"


ROLE_DASHBOARD_PATHS = {
    AppRole.ADMIN: "/portal/admin",
    AppRole.DAIRY_FARMER: "/dashboard",
    AppRole.VETERINARIAN: "/dashboard",
    AppRole.DAIRY_COOPERATIVE: "/dashboard",
    AppRole.ANIMAL_HEALTH_AUTHORITY: "/dashboard",
}


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: str
    email: str | None
    role: AppRole | None
    account_status: AccountStatus
    permissions: frozenset[str]

    @property
    def dashboard_path(self) -> str:
        return ROLE_DASHBOARD_PATHS.get(self.role, "/pending")


def _unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthPrincipal:
    """Validate the JWT with Supabase Auth, then load server-controlled RBAC."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    try:
        auth_response = supabase.auth.get_user(credentials.credentials)
        user = getattr(auth_response, "user", None)
    except Exception as exc:
        logger.info("Supabase rejected bearer token: %s", exc)
        raise _unauthorized("Invalid or expired session") from exc

    user_id = str(getattr(user, "id", "") or "")
    if not user_id:
        raise _unauthorized("Invalid or expired session")

    try:
        role_response = (
            supabase.table("user_roles")
            .select("role, status")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        role_row = (role_response.data or [None])[0]
        role = AppRole(role_row["role"]) if role_row else None
        account_status = (
            AccountStatus(role_row["status"])
            if role_row
            else AccountStatus.PENDING
        )

        permissions: frozenset[str] = frozenset()
        if role is not None:
            permission_response = (
                supabase.table("role_permissions")
                .select("permission")
                .eq("role", role.value)
                .execute()
            )
            permissions = frozenset(
                str(row["permission"])
                for row in (permission_response.data or [])
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Could not load RBAC for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization service is unavailable",
        ) from exc

    return AuthPrincipal(
        user_id=user_id,
        email=getattr(user, "email", None),
        role=role,
        account_status=account_status,
        permissions=permissions,
    )


def require_active_user(
    principal: AuthPrincipal = Depends(get_current_principal),
) -> AuthPrincipal:
    if principal.account_status != AccountStatus.ACTIVE or principal.role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending role approval or is suspended",
        )
    return principal


def require_permissions(*required_permissions: str):
    required = frozenset(required_permissions)

    def dependency(
        principal: AuthPrincipal = Depends(require_active_user),
    ) -> AuthPrincipal:
        if not required.issubset(principal.permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role does not have permission for this operation",
            )
        return principal

    return dependency
