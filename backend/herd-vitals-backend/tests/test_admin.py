import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException

from app.api.admin import AdminDecision, RoleDecisionInput, _load_role_requests, decide_role_request
from app.core.auth import AccountStatus, AppRole, AuthPrincipal


class _TableQuery:
    def __init__(self, database, table_name):
        self.database = database
        self.table_name = table_name
        self.filters = []
        self.update_payload = None

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def update(self, payload):
        self.update_payload = payload
        return self

    def execute(self):
        rows = self.database[self.table_name]
        matches = [
            row for row in rows
            if all(str(row.get(column)) == str(value) for column, value in self.filters)
        ]
        if self.update_payload is not None:
            for row in matches:
                row.update(self.update_payload)
        return SimpleNamespace(data=deepcopy(matches))


class _FakeSupabase:
    def __init__(self, role_rows, profile_rows):
        self.database = {
            "user_roles": deepcopy(role_rows),
            "profiles": deepcopy(profile_rows),
        }

    def table(self, name):
        return _TableQuery(self.database, name)


class AdminApprovalTests(unittest.TestCase):
    def admin_principal(self):
        return AuthPrincipal(
            user_id=str(uuid4()),
            email="admin@example.com",
            role=AppRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
            permissions=frozenset({"admin.manage"}),
        )

    def test_queue_enriches_role_request_with_profile(self):
        user_id = str(uuid4())
        fake = _FakeSupabase(
            [{
                "user_id": user_id,
                "role": "VETERINARIAN",
                "status": "PENDING",
                "assigned_by": None,
                "assigned_at": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }],
            [{
                "id": user_id,
                "email": "vet@example.com",
                "display_name": "Dr Vet",
                "phone_number": "+919876543210",
                "organization_name": "Animal Clinic",
                "requested_role": "VETERINARIAN",
            }],
        )
        with patch("app.api.admin.supabase", fake):
            queue = _load_role_requests("PENDING")
        self.assertEqual(queue[0]["email"], "vet@example.com")
        self.assertEqual(queue[0]["display_name"], "Dr Vet")
        self.assertEqual(queue[0]["phone_number"], "+919876543210")

    def test_admin_can_approve_non_admin_request(self):
        user_id = uuid4()
        fake = _FakeSupabase(
            [{
                "user_id": str(user_id),
                "role": "DAIRY_COOPERATIVE",
                "status": "PENDING",
                "assigned_by": None,
                "assigned_at": None,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }],
            [{
                "id": str(user_id),
                "email": "coop@example.com",
                "display_name": "Coop User",
                "organization_name": "Milk Cooperative",
                "requested_role": "DAIRY_COOPERATIVE",
            }],
        )
        with patch("app.api.admin.supabase", fake):
            result = decide_role_request(
                user_id,
                RoleDecisionInput(decision=AdminDecision.APPROVE),
                self.admin_principal(),
            )
        self.assertEqual(result["status"], "ACTIVE")
        self.assertIsNotNone(result["assigned_at"])

    def test_admin_cannot_modify_another_admin(self):
        user_id = uuid4()
        fake = _FakeSupabase(
            [{
                "user_id": str(user_id),
                "role": "ADMIN",
                "status": "ACTIVE",
                "assigned_by": str(user_id),
                "assigned_at": "2026-01-01T00:00:00+00:00",
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }],
            [],
        )
        with patch("app.api.admin.supabase", fake):
            with self.assertRaises(HTTPException) as raised:
                decide_role_request(
                    user_id,
                    RoleDecisionInput(decision=AdminDecision.REJECT),
                    self.admin_principal(),
                )
        self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
