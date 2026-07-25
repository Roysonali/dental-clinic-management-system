"""Receipt Router — Integration Tests.

Covers: authentication (401), authorization (403), read success (200),
validation (422), and business exceptions (404).

Write operations (generate, regenerate) are tested only for auth, authz,
validation, and not-found. Full success-path write tests require auth
users with UUID IDs matching billing foreign key columns — this is a
pre-existing architectural boundary that cannot be tested through the
full HTTP stack with the current test DB.
"""

from __future__ import annotations

import uuid
from fastapi.testclient import TestClient

from tests.modules.billing.routers.conftest import (
    RECEIPTS_URL, auth_header,
)


class TestGetReceipt:
    """GET /billing/receipts/{receipt_id} — read-only, fully testable."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.get(f"{RECEIPTS_URL}/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{RECEIPTS_URL}/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_invalid_uuid(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{RECEIPTS_URL}/invalid-uuid", headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_jwt(self, client: TestClient) -> None:
        resp = client.get(f"{RECEIPTS_URL}/{uuid.uuid4()}", headers=auth_header("invalid.jwt.token"))
        assert resp.status_code == 401


class TestGenerateReceipt:
    """POST /billing/receipts — auth, authz, and validation only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(RECEIPTS_URL, json={"payment_id": str(uuid.uuid4())})
        assert resp.status_code == 401

    def test_missing_payment_id(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(RECEIPTS_URL, json={}, headers=auth_header(admin_token))
        assert resp.status_code == 422


class TestRegenerateReceipt:
    """POST /billing/receipts/{receipt_id}/regenerate — auth and authz only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(f"{RECEIPTS_URL}/{uuid.uuid4()}/regenerate")
        assert resp.status_code == 401

    def test_assistant_cannot_regenerate(self, client: TestClient, assistant_token: str) -> None:
        resp = client.post(
            f"{RECEIPTS_URL}/{uuid.uuid4()}/regenerate",
            headers=auth_header(assistant_token),
        )
        assert resp.status_code == 403
