import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
import httpx

from app.core.auth import (
    AccountStatus,
    AppRole,
    AuthPrincipal,
    get_current_principal,
    require_active_user,
    require_permissions,
)


class _Query:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class _FakeSupabase:
    def __init__(self, role_rows, permission_rows, valid=True):
        self.role_rows = role_rows
        self.permission_rows = permission_rows
        self.valid = valid
        self.auth = self

    def get_user(self, _token):
        if not self.valid:
            raise ValueError("rejected")
        return SimpleNamespace(user=SimpleNamespace(id="user-123", email="farmer@example.com"))

    def table(self, name):
        if name == "user_roles":
            return _Query(self.role_rows)
        if name == "role_permissions":
            return _Query(self.permission_rows)
        raise AssertionError(f"Unexpected table: {name}")


class AuthenticationTests(unittest.TestCase):
    def credentials(self):
        return HTTPAuthorizationCredentials(scheme="Bearer", credentials="jwt")

    def test_valid_token_loads_authoritative_role_and_permissions(self):
        fake = _FakeSupabase(
            [{"role": "DAIRY_FARMER", "status": "ACTIVE"}],
            [{"permission": "animals.read"}, {"permission": "events.report"}],
        )
        with patch("app.core.auth.supabase", fake):
            principal = get_current_principal(self.credentials())

        self.assertEqual(principal.role, AppRole.DAIRY_FARMER)
        self.assertEqual(principal.account_status, AccountStatus.ACTIVE)
        self.assertEqual(principal.dashboard_path, "/dashboard")
        self.assertIn("events.report", principal.permissions)

    def test_missing_credentials_is_unauthorized(self):
        with self.assertRaises(HTTPException) as raised:
            get_current_principal(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_invalid_token_is_unauthorized(self):
        with patch("app.core.auth.supabase", _FakeSupabase([], [], valid=False)):
            with self.assertRaises(HTTPException) as raised:
                get_current_principal(self.credentials())
        self.assertEqual(raised.exception.status_code, 401)

    def test_auth_network_failure_is_service_unavailable(self):
        fake = _FakeSupabase([], [])
        fake.get_user = lambda _token: (_ for _ in ()).throw(httpx.ConnectError("offline"))
        with patch("app.core.auth.supabase", fake):
            with self.assertRaises(HTTPException) as raised:
                get_current_principal(self.credentials())
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(
            raised.exception.detail,
            "Authentication service is temporarily unavailable",
        )

    def test_user_without_assignment_is_pending(self):
        with patch("app.core.auth.supabase", _FakeSupabase([], [])):
            principal = get_current_principal(self.credentials())
        self.assertIsNone(principal.role)
        self.assertEqual(principal.account_status, AccountStatus.PENDING)
        with self.assertRaises(HTTPException) as raised:
            require_active_user(principal)
        self.assertEqual(raised.exception.status_code, 403)

    def test_permission_dependency_denies_missing_permission(self):
        principal = AuthPrincipal(
            user_id="user-123",
            email=None,
            role=AppRole.DAIRY_COOPERATIVE,
            account_status=AccountStatus.ACTIVE,
            permissions=frozenset({"events.read"}),
        )
        dependency = require_permissions("events.confirm")
        with self.assertRaises(HTTPException) as raised:
            dependency(principal)
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
