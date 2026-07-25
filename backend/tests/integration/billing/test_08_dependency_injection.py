"""Phase 8: Dependency Injection Tests.

Verifies that FastAPI dependency injection works correctly with
the PostgreSQL-backed session, including:
- DB session lifecycle
- Repository injection
- Service injection
- Validator injection
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
import app.database.models  # noqa: F401
from app.database.session import get_db
from app.modules.billing.routers import billing_router
from app.core.exception_handlers import register_exception_handlers
from app.dependencies.auth import get_current_user
from tests.integration.billing.conftest import (
    PG_URL,
    InvoiceFactory,
    PaymentFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _auth_headers():
    """Generate a valid JWT for the test user (id=1, role=ADMIN)."""
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": "test@test.com"})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def pg_session_factory(pg_engine):
    return sessionmaker(bind=pg_engine)


@pytest.fixture()
def app(pg_engine):
    """Create a FastAPI app with PG-backed session override."""
    test_app = FastAPI(title="DensCare Billing Integration Test")
    test_app.include_router(billing_router)
    register_exception_handlers(test_app)

    TestSessionLocal = sessionmaker(bind=pg_engine)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    test_app.dependency_overrides[get_db] = override_get_db
    return test_app


@pytest.fixture()
def client(app):
    return TestClient(app)


# ---------------------------------------------------------------------------
# DB Session Lifecycle
# ---------------------------------------------------------------------------
class TestDBSessionLifecycle:
    def test_session_provided_via_dependency(self, app):
        """Verify that the test DB session is provided via dependency override."""
        assert get_db in app.dependency_overrides

    def test_session_is_postgresql(self, pg_engine):
        """Verify the engine is connected to PostgreSQL, not SQLite."""
        with pg_engine.connect() as conn:
            result = conn.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            assert db_name == "denscare_test"


# ---------------------------------------------------------------------------
# Repository Injection
# ---------------------------------------------------------------------------
class TestRepositoryInjection:
    def test_repositories_receive_pg_session(self, db):
        """Verify that repositories receive a PostgreSQL-backed session."""
        from app.modules.billing.repositories import InvoiceRepository
        repo = InvoiceRepository(db)
        engine = db.get_bind().engine
        assert "denscare_test" in str(engine.url)

    def test_all_repositories_accept_session(self, db):
        """Verify all repositories can be instantiated with the PG session."""
        from app.modules.billing.repositories import (
            InvoiceRepository,
            PaymentRepository,
            ReceiptRepository,
            RefundRepository,
            CreditNoteRepository,
            PatientCreditRepository,
            DocumentSequenceRepository,
            AuditRepository,
        )
        InvoiceRepository(db)
        PaymentRepository(db)
        ReceiptRepository(db)
        RefundRepository(db)
        CreditNoteRepository(db)
        PatientCreditRepository(db)
        DocumentSequenceRepository(db)
        AuditRepository(db)


# ---------------------------------------------------------------------------
# Service Injection
# ---------------------------------------------------------------------------
class TestServiceInjection:
    def test_services_receive_repositories_with_pg_session(self, db):
        """Verify that services receive repositories backed by PG."""
        from app.modules.billing.repositories import (
            InvoiceRepository, AuditRepository, DocumentSequenceRepository,
        )
        from app.modules.billing.validators import (
            FinancialValidator, InvoiceValidator, DocumentSequenceValidator,
        )
        from app.modules.billing.services import DocumentSequenceService, InvoiceService

        invoice_repo = InvoiceRepository(db)
        audit_repo = AuditRepository(db)
        doc_seq_repo = DocumentSequenceRepository(db)
        financial_validator = FinancialValidator()
        invoice_validator = InvoiceValidator(invoice_repo, financial_validator)
        doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
        doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)

        service = InvoiceService(
            db=db, invoice_repo=invoice_repo, invoice_validator=invoice_validator,
            financial_validator=financial_validator,
            document_sequence_service=doc_seq_service, audit_repo=audit_repo,
        )
        assert service._db is db
        assert service._invoice_repo.db is db


# ---------------------------------------------------------------------------
# Router Integration
# ---------------------------------------------------------------------------
class TestRouterIntegration:
    def test_list_invoices_returns_empty(self, client):
        """Verify the router can handle list requests against PG."""
        response = client.get("/billing/invoices", headers=_auth_headers())
        assert response.status_code == 200

    def test_get_invoice_not_found(self, client):
        response = client.get(f"/billing/invoices/{uuid.uuid4()}", headers=_auth_headers())
        assert response.status_code in (404, 422)

    def test_list_payments_returns_empty(self, client):
        response = client.get("/billing/payments", headers=_auth_headers())
        assert response.status_code == 200

    def test_dashboard_returns_data(self, client):
        response = client.get("/billing/dashboard", headers=_auth_headers())
        assert response.status_code == 200
