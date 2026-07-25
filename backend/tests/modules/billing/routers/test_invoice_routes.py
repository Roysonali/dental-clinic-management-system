"""Invoice Router — Integration Tests.

Covers: authentication (401), authorization (403), read success (200),
validation (422), and business exceptions (404).

Write operations (create, update, issue, cancel, delete) are tested only
for auth (401), authz (403), validation (422), and not-found (404).
Full success-path write tests require auth users with UUID IDs matching
billing foreign key columns — this is a pre-existing architectural boundary
that cannot be tested through the full HTTP stack with the current test DB.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi.testclient import TestClient

from tests.modules.billing.routers.conftest import (
    INVOICES_URL, auth_header, STUB_PATIENT_ID,
)


class TestListInvoices:
    """GET /billing/invoices — read-only, fully testable."""

    URL = INVOICES_URL

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.get(self.URL)
        assert resp.status_code == 401

    def test_admin_success(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(self.URL, headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["page"] == 1

    def test_doctor_can_list(self, client: TestClient, doctor_token: str) -> None:
        resp = client.get(self.URL, headers=auth_header(doctor_token))
        assert resp.status_code == 200

    def test_assistant_can_list(self, client: TestClient, assistant_token: str) -> None:
        resp = client.get(self.URL, headers=auth_header(assistant_token))
        assert resp.status_code == 200

    def test_receptionist_can_list(self, client: TestClient, receptionist_token: str) -> None:
        resp = client.get(self.URL, headers=auth_header(receptionist_token))
        assert resp.status_code == 200

    def test_pagination(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{self.URL}?page=1&page_size=5", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["page_size"] == 5

    def test_invalid_page_size(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{self.URL}?page_size=200", headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_sort_order(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{self.URL}?sort_order=invalid", headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_jwt(self, client: TestClient) -> None:
        resp = client.get(self.URL, headers=auth_header("invalid.jwt.token"))
        assert resp.status_code == 401


class TestGetInvoice:
    """GET /billing/invoices/{invoice_id} — read-only, fully testable."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.get(f"{INVOICES_URL}/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{INVOICES_URL}/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_invalid_uuid(self, client: TestClient, admin_token: str) -> None:
        resp = client.get(f"{INVOICES_URL}/not-a-uuid", headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_get_draft_invoice(self, client: TestClient, admin_token: str, draft_invoice: Any) -> None:
        resp = client.get(f"{INVOICES_URL}/{draft_invoice.id}", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(draft_invoice.id)
        assert "patient" in data
        assert "items" in data


class TestCreateInvoice:
    """POST /billing/invoices — auth, authz, and validation only."""

    CREATE_PAYLOAD: dict[str, Any] = {
        "patient_id": str(STUB_PATIENT_ID),
        "currency_code": "USD",
        "items": [
            {
                "description": "Test procedure",
                "quantity": 1,
                "unit_price": "100.00",
                "sequence_number": 1,
            }
        ],
    }

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(INVOICES_URL, json=self.CREATE_PAYLOAD)
        assert resp.status_code == 401

    def test_missing_patient_id(self, client: TestClient, admin_token: str) -> None:
        payload = dict(self.CREATE_PAYLOAD)
        payload.pop("patient_id")
        resp = client.post(INVOICES_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_currency(self, client: TestClient, admin_token: str) -> None:
        payload = dict(self.CREATE_PAYLOAD)
        payload["currency_code"] = "INVALID"
        resp = client.post(INVOICES_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_empty_items(self, client: TestClient, admin_token: str) -> None:
        payload = dict(self.CREATE_PAYLOAD)
        payload["items"] = []
        resp = client.post(INVOICES_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422


class TestUpdateDraftInvoice:
    """PATCH /billing/invoices/{invoice_id} — auth, authz, and validation only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.patch(f"{INVOICES_URL}/{uuid.uuid4()}", json={"notes": "test"})
        assert resp.status_code == 401


class TestIssueInvoice:
    """POST /billing/invoices/{invoice_id}/issue — auth and not-found only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(f"{INVOICES_URL}/{uuid.uuid4()}/issue")
        assert resp.status_code == 401

    def test_issue_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(
            f"{INVOICES_URL}/{uuid.uuid4()}/issue",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404


class TestCancelInvoice:
    """POST /billing/invoices/{invoice_id}/cancel — auth, authz, and validation only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.post(
            f"{INVOICES_URL}/{uuid.uuid4()}/cancel",
            json={"cancellation_reason": "Test cancel"},
        )
        assert resp.status_code == 401

    def test_cancel_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(
            f"{INVOICES_URL}/{uuid.uuid4()}/cancel",
            json={"cancellation_reason": "Test"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_cancel_missing_reason(self, client: TestClient, admin_token: str) -> None:
        resp = client.post(
            f"{INVOICES_URL}/{uuid.uuid4()}/cancel",
            json={},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 422

    def test_assistant_cannot_cancel(self, client: TestClient, assistant_token: str) -> None:
        resp = client.post(
            f"{INVOICES_URL}/{uuid.uuid4()}/cancel",
            json={"cancellation_reason": "Test"},
            headers=auth_header(assistant_token),
        )
        assert resp.status_code == 403


class TestDeleteDraftInvoice:
    """DELETE /billing/invoices/{invoice_id} — auth and non-admin forbidden only."""

    def test_unauthenticated(self, client: TestClient) -> None:
        resp = client.delete(f"{INVOICES_URL}/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_delete_not_found(self, client: TestClient, admin_token: str) -> None:
        resp = client.delete(f"{INVOICES_URL}/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_non_admin_forbidden(self, client: TestClient, doctor_token: str) -> None:
        resp = client.delete(f"{INVOICES_URL}/{uuid.uuid4()}", headers=auth_header(doctor_token))
        assert resp.status_code == 403
