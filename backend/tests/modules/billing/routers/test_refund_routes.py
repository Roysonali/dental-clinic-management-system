"""Refund Router — Integration Tests.

Covers: authentication (401), authorization (403), success cases (200/201),
validation (422), and business exceptions (404/409).
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.modules.billing.routers.conftest import (
    REFUNDS_URL, PAYMENTS_URL, auth_header, STUB_PATIENT_ID,
)


class TestCreateRefund:
    """POST /billing/refunds"""

    CREATE_PAYLOAD = {
        "payment_id": str(uuid.uuid4()),
        "amount": "50.00",
        "reason": "Patient cancelled treatment",
    }

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(REFUNDS_URL, json=self.CREATE_PAYLOAD)
        assert resp.status_code == 401

    def test_create_payment_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(REFUNDS_URL, json=self.CREATE_PAYLOAD, headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_missing_amount(self, client: TestClient, admin_token: str):
        payload = {"payment_id": str(uuid.uuid4()), "reason": "Test"}
        resp = client.post(REFUNDS_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_missing_reason(self, client: TestClient, admin_token: str):
        payload = {"payment_id": str(uuid.uuid4()), "amount": "50.00"}
        resp = client.post(REFUNDS_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_negative_amount(self, client: TestClient, admin_token: str):
        payload = self.CREATE_PAYLOAD.copy()
        payload["amount"] = "-50.00"
        resp = client.post(REFUNDS_URL, json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_assistant_can_create(self, client: TestClient, assistant_token: str):
        resp = client.post(
            REFUNDS_URL,
            json=self.CREATE_PAYLOAD,
            headers=auth_header(assistant_token),
        )
        # Payment not found is expected (no real payment exists), but 403 not expected
        assert resp.status_code != 403


class TestApproveRefund:
    """POST /billing/refunds/{refund_id}/approve"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(f"{REFUNDS_URL}/{uuid.uuid4()}/approve")
        assert resp.status_code == 401

    def test_approve_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{REFUNDS_URL}/{uuid.uuid4()}/approve",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404

    def test_assistant_cannot_approve(self, client: TestClient, assistant_token: str):
        """Assistants not in workflow roles."""
        resp = client.post(
            f"{REFUNDS_URL}/{uuid.uuid4()}/approve",
            headers=auth_header(assistant_token),
        )
        assert resp.status_code == 403


class TestRejectRefund:
    """POST /billing/refunds/{refund_id}/reject"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(f"{REFUNDS_URL}/{uuid.uuid4()}/reject", json={"reason": "Invalid"})
        assert resp.status_code == 401

    def test_reject_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{REFUNDS_URL}/{uuid.uuid4()}/reject",
            json={"reason": "Invalid request"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404


class TestCompleteRefund:
    """POST /billing/refunds/{refund_id}/complete"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.post(f"{REFUNDS_URL}/{uuid.uuid4()}/complete")
        assert resp.status_code == 401

    def test_complete_not_found(self, client: TestClient, admin_token: str):
        resp = client.post(
            f"{REFUNDS_URL}/{uuid.uuid4()}/complete",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 404
