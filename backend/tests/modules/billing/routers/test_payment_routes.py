"""Payment Router — Integration Tests.

Covers: authentication (401), authorization (403), read success (200),
validation (422), and business exceptions (404).

Write operations (create, update, delete, complete, fail, void, allocate)
are tested only for auth (401), authz (403), validation (422), and
not-found (404). Full success-path write tests require auth users with
UUID IDs matching billing foreign key columns — this is a pre-existing
architectural boundary that cannot be tested through the full HTTP stack
with the current test DB.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi.testclient import TestClient

from tests.modules.billing.routers.conftest import (
    PAYMENTS_URL, auth_header, STUB_PATIENT_ID,
)


class TestListPayments:
    """GET /billing/payments — read-only, fully testable."""

    URL = PAYMENTS_URL

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.get(self.URL)
        assert resp.status_code == 401

    def test_admin_success(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(self.URL, headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    def test_doctor_can_list(self, client: TestClient, doctor_token: str) -> None:
        resp = client.get(self.URL, headers=auth_header(doctor_token))
        assert resp.status_code == 200

    def test_invalid_status(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{self.URL}?status=INVALID", headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_sort_order(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{self.URL}?sort_order=invalid", headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_jwt(self, client: TestClient) -> None:
        resp = client.get(self.URL, headers=auth_header("invalid.jwt.token"))
        assert resp.status_code == 401


class TestGetPayment:
    """GET /billing/payments/{payment_id} — read-only, fully testable."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.get(f"{PAYMENTS_URL}/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{PAYMENTS_URL}/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_invalid_uuid(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{PAYMENTS_URL}/not-a-uuid", headers=auth_header(admin_token))
        assert resp.status_code == 422


class TestCreatePayment:
    """POST /billing/payments — auth, authz, and validation only."""

    CREATE_PAYLOAD: dict[str, Any] = {
        "patient_id": str(STUB_PATIENT_ID),
        "payment_method": "cash",
        "total_amount": "100.00",
        "payment_date": "2026-07-23",
    }

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(PAYMENTS_URL, json=self.CREATE_PAYLOAD)
        assert resp.status_code == 401

    def test_missing_patient_id(self, client: TestClient, admin_token: str) -> None:
        payload = dict(self.CREATE_PAYLOAD)
        payload.pop("patient_id")
        resp = client.post(PAYMENTS_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_payment_method(self, client: TestClient, admin_token: str) -> None:
        payload = dict(self.CREATE_PAYLOAD)
        payload["payment_method"] = "invalid_method"
        resp = client.post(PAYMENTS_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_negative_amount(self, client: TestClient, admin_token: str) -> None:
        payload = dict(self.CREATE_PAYLOAD)
        payload["total_amount"] = "-50.00"
        resp = client.post(PAYMENTS_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_assistant_can_create(self, client: TestClient, assistant_token: str) -> None:
        """Verify assistant has write role (assert not 403)."""
        payload = dict(self.CREATE_PAYLOAD)
        resp = client.post(PAYMENTS_URL, json=payload, headers=auth_header(assistant_token))
        assert resp.status_code != 403


class TestUpdatePayment:
    """PATCH /billing/payments/{payment_id} — auth only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.patch(f"{PAYMENTS_URL}/{uuid.uuid4()}", json={"notes": "test"})
        assert resp.status_code == 401


class TestDeletePayment:
    """DELETE /billing/payments/{payment_id} — auth and non-admin only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.delete(f"{PAYMENTS_URL}/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_non_admin_forbidden(self, client: TestClient, doctor_token: str) -> None:
        resp = client.delete(f"{PAYMENTS_URL}/{uuid.uuid4()}", headers=auth_header(doctor_token))
        assert resp.status_code == 403


class TestCompletePayment:
    """POST /billing/payments/{payment_id}/complete — auth and not-found only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(f"{PAYMENTS_URL}/{uuid.uuid4()}/complete")
        assert resp.status_code == 401

    def test_complete_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(
            f"{PAYMENTS_URL}/{uuid.uuid4()}/complete",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_assistant_cannot_complete(self, client: TestClient, assistant_token: str) -> None:
        resp = client.post(
            f"{PAYMENTS_URL}/{uuid.uuid4()}/complete",
            headers=auth_header(assistant_token),
        )
        assert resp.status_code == 403


class TestFailPayment:
    """POST /billing/payments/{payment_id}/fail — auth and authz only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(f"{PAYMENTS_URL}/{uuid.uuid4()}/fail", json={})
        assert resp.status_code == 401

    def test_assistant_cannot_fail(self, client: TestClient, assistant_token: str) -> None:
        resp = client.post(
            f"{PAYMENTS_URL}/{uuid.uuid4()}/fail",
            json={},
            headers=auth_header(assistant_token),
        )
        assert resp.status_code == 403


class TestVoidPayment:
    """POST /billing/payments/{payment_id}/void — auth only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(f"{PAYMENTS_URL}/{uuid.uuid4()}/void", json={})
        assert resp.status_code == 401


class TestAllocatePayment:
    """POST /billing/payments/{payment_id}/allocate — auth and validation only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(
            f"{PAYMENTS_URL}/{uuid.uuid4()}/allocate",
            json={"invoice_id": str(uuid.uuid4()), "amount": "50.00"},
        )
        assert resp.status_code == 401

    def test_allocate_no_payment(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(
            f"{PAYMENTS_URL}/{uuid.uuid4()}/allocate",
            json={"invoice_id": str(uuid.uuid4()), "amount": "50.00"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_invalid_amount(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(
            f"{PAYMENTS_URL}/{uuid.uuid4()}/allocate",
            json={"invoice_id": str(uuid.uuid4()), "amount": "-50.00"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 422
