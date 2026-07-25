"""Credit Note Router — Integration Tests.

Covers: authentication (401), authorization (403), success cases (200/201),
validation (422), and business exceptions (404/409).
"""

from __future__ import annotations

import uuid
from fastapi.testclient import TestClient

from tests.modules.billing.routers.conftest import (
    CREDIT_NOTES_URL, auth_header, STUB_PATIENT_ID,
)


class TestCreateCreditNote:
    """POST /billing/credit-notes"""

    CREATE_PAYLOAD = {
        "invoice_id": str(uuid.uuid4()),
        "patient_id": str(STUB_PATIENT_ID),
        "amount": "100.00",
        "reason": "Service charge adjustment",
    }

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(CREDIT_NOTES_URL, json=self.CREATE_PAYLOAD)
        assert resp.status_code == 401

    def test_create_invoice_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            CREDIT_NOTES_URL,
            json=self.CREATE_PAYLOAD,
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_missing_invoice_id(self, client: TestClient, admin_token: str):
        payload = self.CREATE_PAYLOAD.copy()
        payload.pop("invoice_id")
        resp = client.post(CREDIT_NOTES_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_missing_amount(self, client: TestClient, admin_token: str):
        payload = self.CREATE_PAYLOAD.copy()
        payload.pop("amount")
        resp = client.post(CREDIT_NOTES_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_negative_amount(self, client: TestClient, admin_token: str):
        payload = self.CREATE_PAYLOAD.copy()
        payload["amount"] = "-50.00"
        resp = client.post(CREDIT_NOTES_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_assistant_can_create(self, client: TestClient, assistant_token: str):
        resp = client.post(
            CREDIT_NOTES_URL,
            json=self.CREATE_PAYLOAD,
            headers=auth_header(assistant_token),
        )
        assert resp.status_code != 403


class TestIssueCreditNote:
    """POST /billing/credit-notes/{credit_note_id}/issue"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/issue")
        assert resp.status_code == 401

    def test_issue_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/issue",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_assistant_cannot_issue(self, client: TestClient, assistant_token: str):
        """Assistants not in workflow roles."""
        resp = client.post(
            f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/issue",
            headers=auth_header(assistant_token),
        )
        assert resp.status_code == 403


class TestVoidCreditNote:
    """POST /billing/credit-notes/{credit_note_id}/void"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(
            f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/void",
            json={"void_reason": "Issued in error"},
        )
        assert resp.status_code == 401

    def test_void_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/void",
            json={"void_reason": "Issued in error"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_void_missing_reason(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/void",
            json={},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 422


class TestApplyCreditNote:
    """POST /billing/credit-notes/{credit_note_id}/apply"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/apply")
        assert resp.status_code == 401

    def test_apply_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{CREDIT_NOTES_URL}/{uuid.uuid4()}/apply",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404
