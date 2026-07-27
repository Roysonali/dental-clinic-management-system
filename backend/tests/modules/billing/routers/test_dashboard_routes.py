"""Dashboard Router — Integration Tests.

Covers: authentication (401), authorization (403), success cases (200).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.modules.billing.routers.conftest import (
    DASHBOARD_URL, SUMMARY_URL, auth_header,
)


class TestGetDashboard:
    """GET /billing/dashboard"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.get(DASHBOARD_URL)
        assert resp.status_code == 401

    def test_admin_success(self, client: TestClient, admin_token: str):
        resp = client.get(DASHBOARD_URL, headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "totals" in data
        assert "recent_invoices" in data
        assert "recent_payments" in data
        assert "generated_at" in data
        # Verify totals structure
        totals = data["totals"]
        assert "total_invoiced" in totals
        assert "total_collected" in totals
        assert "total_outstanding" in totals
        assert "invoice_count" in totals

    def test_doctor_can_access(self, client: TestClient, doctor_token: str):
        resp = client.get(DASHBOARD_URL, headers=auth_header(doctor_token))
        assert resp.status_code == 200

    def test_receptionist_can_access(self, client: TestClient, receptionist_token: str):
        resp = client.get(DASHBOARD_URL, headers=auth_header(receptionist_token))
        assert resp.status_code == 200

    def test_assistant_can_access(self, client: TestClient, assistant_token: str):
        resp = client.get(DASHBOARD_URL, headers=auth_header(assistant_token))
        assert resp.status_code == 200

    def test_with_patient_id(self, client: TestClient, admin_token: str):
        from tests.modules.billing.routers.conftest import STUB_PATIENT_ID
        resp = client.get(
            f"{DASHBOARD_URL}?patient_id={STUB_PATIENT_ID}",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "patient_summary" in data

    def test_invalid_patient_id(self, client: TestClient, admin_token: str):
        resp = client.get(
            f"{DASHBOARD_URL}?patient_id=invalid-uuid",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 422


class TestGetSummary:
    """GET /billing/summary"""

    def test_unauthenticated(self, client: TestClient):
        resp = client.get(SUMMARY_URL)
        assert resp.status_code == 401

    def test_admin_success(self, client: TestClient, admin_token: str):
        resp = client.get(SUMMARY_URL, headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "total_invoiced" in data
        assert "total_collected" in data
        assert "total_outstanding" in data
        assert "invoice_count" in data

    def test_invalid_token(self, client: TestClient):
        """An invalid JWT should get 401."""
        resp = client.get(SUMMARY_URL, headers=auth_header("invalid-token"))
        assert resp.status_code == 401

    def test_invalid_jwt(self, client: TestClient):
        """A malformed JWT should get 401."""
        resp = client.get(SUMMARY_URL, headers=auth_header("invalid.jwt.token"))
        assert resp.status_code == 401
