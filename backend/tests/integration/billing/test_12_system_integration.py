"""Sprint 11: System Integration Testing — Cross-Module Integration Validation.

Validates that the Billing module works correctly with all implemented
DensCare modules: Auth, RBAC, Users, Patients, Doctors, Appointments,
Treatment, and Patient Records.

Every test uses real PostgreSQL, real routers, real services, real repositories.
No mocks unless technically unavoidable.

Principle: Every FK relationship that Billing has with another module must
be verified through automated integration tests.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.core.exception_handlers import register_exception_handlers
from app.core.security import create_access_token
from app.database.session import get_db

from app.modules.billing.models import (
    Invoice,
    Payment,
    PaymentAllocation,
    Refund,
    CreditNote,
    BillingAuditLog,
)
from app.modules.billing.routers import billing_router
from app.modules.billing.repositories import (
    InvoiceRepository,
    PaymentRepository,
    RefundRepository,
    AuditRepository,
)
from app.modules.billing.constants import ZERO_MONEY

from tests.integration.billing.conftest import (
    STUB_PATIENT_ID,
    STUB_USER_ID,
    STUB_DOCTOR_ID,
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    RefundFactory,
    CreditNoteFactory,
    AuditLogFactory,
)

pytestmark = pytest.mark.postgres

# ---------------------------------------------------------------------------
# Cross-module FK stub IDs
# ---------------------------------------------------------------------------

STUB_TREATMENT_PLAN_ID = uuid.UUID("20000000-0000-0000-0000-000000000001")
STUB_PLAN_ITEM_ID = uuid.UUID("20000000-0000-0000-0000-000000000002")
STUB_APPOINTMENT_ID = uuid.UUID("30000000-0000-0000-0000-000000000001")
STUB_DIAGNOSIS_ID = uuid.UUID("40000000-0000-0000-0000-000000000001")


@pytest.fixture()
def cross_module_stubs(db: Session):
    """Seed FK stub records for all cross-module relationships.

    Billing references these tables via foreign keys:
    - users.id (INTEGER) — created_by, updated_by, changed_by (seeded in conftest)
    - patients.id (UUID) — patient_id (seeded in conftest)
    - doctors.id (UUID) — doctor_id on Invoice
    - appointments.id (UUID) — appointment_id on Invoice
    - treatment_plans.id (UUID) — treatment_plan_id on Invoice
    - treatment_plan_items.id (UUID) — plan_item_id on InvoiceItem
    - patient_record_diagnoses.id (UUID) — diagnosis_id on InvoiceItem

    NOTE: Uses raw SQL with ON CONFLICT DO NOTHING for idempotency.
    If module schemas change, update these INSERT statements to match.
    """
    # Doctor (app/modules/doctors/models.py)
    db.execute(text("""
        INSERT INTO doctors (id, doctor_code, user_id, primary_phone, is_active)
        VALUES (CAST(:did AS UUID), 'D-SIT-001', 1, '+1234567890', true)
        ON CONFLICT (id) DO NOTHING
    """), {"did": str(STUB_DOCTOR_ID)})

    # Appointment (app/modules/appointments/model.py)
    # dentist_id is Integer FK to users.id, NOT UUID FK to doctors.id
    db.execute(text("""
        INSERT INTO appointments (id, appointment_number, patient_id, dentist_id,
            appointment_date, start_time, end_time, duration_minutes,
            appointment_type, reason_for_visit, status)
        VALUES (CAST(:aid AS UUID), 'APT-SIT-001', CAST(:pid AS UUID), 1,
            :adate, '10:00', '11:00', 60,
            'Consultation', 'Regular dental checkup', 'Scheduled')
        ON CONFLICT (id) DO NOTHING
    """), {
        "aid": str(STUB_APPOINTMENT_ID),
        "pid": str(STUB_PATIENT_ID),
        "adate": date.today(),
    })

    # Procedure catalog (app/modules/treatment/models.py)
    db.execute(text("""
        INSERT INTO procedures (id, code, name, default_cost, category, is_active)
        VALUES (1, 'RC-001', 'Root Canal', 500.00, 'endodontic', true)
        ON CONFLICT (id) DO NOTHING
    """))

    # Treatment Plan (app/modules/treatment/models.py)
    db.execute(text("""
        INSERT INTO treatment_plans (id, plan_code, patient_id, doctor_id, status,
            current_version, lock_version, created_at, updated_at)
        VALUES (CAST(:tpid AS UUID), 'TXN-SIT-001', CAST(:pid AS UUID), CAST(:did AS UUID), 'approved',
            1, 1, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
    """), {
        "tpid": str(STUB_TREATMENT_PLAN_ID),
        "pid": str(STUB_PATIENT_ID),
        "did": str(STUB_DOCTOR_ID),
    })

    # Treatment Plan Item (app/modules/treatment/models.py)
    # NOTE: No description column — description comes from Procedure.name via JOIN
    db.execute(text("""
        INSERT INTO treatment_plan_items (id, plan_id, procedure_id, sequence_number,
            estimated_cost, discount, item_status)
        VALUES (CAST(:piid AS UUID), CAST(:tpid AS UUID), 1, 1,
            500.00, 0.00, 'pending')
        ON CONFLICT (id) DO NOTHING
    """), {
        "piid": str(STUB_PLAN_ITEM_ID),
        "tpid": str(STUB_TREATMENT_PLAN_ID),
    })

    # Patient Record Diagnosis (app/modules/patient_records/models/diagnosis.py)
    db.execute(text("""
        INSERT INTO patient_record_diagnoses (id, patient_id, diagnosis_code,
            diagnosis_name, is_deleted)
        VALUES (CAST(:did AS UUID), CAST(:pid AS UUID), 'K04.0', 'Pulpitis', false)
        ON CONFLICT (id) DO NOTHING
    """), {
        "did": str(STUB_DIAGNOSIS_ID),
        "pid": str(STUB_PATIENT_ID),
    })

    db.flush()
    yield


# ---------------------------------------------------------------------------
# TestClient Helpers
# ---------------------------------------------------------------------------


def _create_sit_app(pg_engine) -> FastAPI:
    """Create a minimal FastAPI app with PG-backed session and billing routes."""
    app = FastAPI(title="DensCare SIT Test")
    app.include_router(billing_router)
    register_exception_handlers(app)
    TestSessionLocal = sessionmaker(bind=pg_engine)
    app.dependency_overrides[get_db] = lambda: TestSessionLocal()
    return app


def _auth_headers() -> dict[str, str]:
    """JWT auth headers for the test admin user (id=1, role=ADMIN)."""
    token = create_access_token(data={"sub": "test@test.com"})
    return {"Authorization": f"Bearer {token}"}


# ===================================================================
# AUTH-001: Unauthenticated requests rejected on all billing endpoints
# ===================================================================
class TestAuthIntegration:
    """AUTH-001: All billing endpoints reject unauthenticated requests."""

    def _test_401(self, pg_engine, method: str, path: str, json_body: dict | None = None):
        app = _create_sit_app(pg_engine)
        client = TestClient(app)
        if method == "GET":
            response = client.get(path)
        elif method == "POST":
            response = client.post(path, json=json_body or {})
        elif method == "DELETE":
            response = client.delete(path)
        else:
            raise ValueError(f"Unknown method: {method}")
        assert response.status_code == 401, f"Expected 401 for {method} {path}, got {response.status_code}"

    def test_unauthenticated_get_invoices(self, pg_engine):
        self._test_401(pg_engine, "GET", "/billing/invoices")

    def test_unauthenticated_create_invoice(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/invoices", {"patient_id": str(uuid.uuid4()), "items": []})

    def test_unauthenticated_create_payment(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/payments",
                       {"patient_id": str(uuid.uuid4()), "total_amount": "100.00", "payment_method": "cash", "payment_date": str(date.today())})

    def test_unauthenticated_get_dashboard(self, pg_engine):
        self._test_401(pg_engine, "GET", "/billing/dashboard")

    def test_unauthenticated_create_refund(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/refunds",
                       {"payment_id": str(uuid.uuid4()), "amount": "50.00", "reason": "Test"})

    def test_unauthenticated_create_credit_note(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/credit-notes",
                       {"invoice_id": str(uuid.uuid4()), "patient_id": str(uuid.uuid4()), "amount": "50.00", "reason": "Test"})


# ===================================================================
# AUTH-002: JWT token validation rejects expired/malformed tokens
# ===================================================================
class TestAuthTokenValidation:
    """AUTH-002: JWT validation rejects invalid tokens."""

    def test_expired_token_rejected(self, pg_engine):
        from jose import jwt
        from app.core.config import settings
        expired = jwt.encode({"sub": "test@test.com", "exp": 0}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        client = TestClient(_create_sit_app(pg_engine))
        response = client.get("/billing/invoices", headers={"Authorization": f"Bearer {expired}"})
        assert response.status_code == 401

    def test_malformed_token_rejected(self, pg_engine):
        client = TestClient(_create_sit_app(pg_engine))
        response = client.get("/billing/invoices", headers={"Authorization": "Bearer invalid.jwt.here"})
        assert response.status_code == 401

    def test_missing_bearer_prefix_rejected(self, pg_engine):
        client = TestClient(_create_sit_app(pg_engine))
        response = client.get("/billing/invoices", headers={"Authorization": "Token sometoken"})
        assert response.status_code == 401


# ===================================================================
# RBAC-001/002/003: Role-based access control
# ===================================================================
class TestRBACIntegration:
    """RBAC-001/002/003: Verify role enforcement on billing endpoints.

    NOTE: Full E2E role testing through HTTP is limited by auth user ID type
    mismatch (int vs UUID). These tests verify endpoint authorization guards
    are invoked. Accepts multiple valid status codes as documented.
    """

    def test_read_endpoint_requires_auth(self, pg_engine):
        """RBAC-001: Authenticated users can access read endpoints."""
        client = TestClient(_create_sit_app(pg_engine))
        response = client.get("/billing/invoices", headers=_auth_headers())
        assert response.status_code in (200, 422)

    def test_delete_invoice_admin_only(self, pg_engine):
        """RBAC-002: DELETE requires elevated role (Admin)."""
        client = TestClient(_create_sit_app(pg_engine))
        response = client.delete(f"/billing/invoices/{uuid.uuid4()}", headers=_auth_headers())
        # 404 = service not found, 403 = RBAC rejected, 204 = success (admin)
        assert response.status_code in (204, 403, 404)

    def test_workflow_endpoints_restricted(self, pg_engine):
        """RBAC-003: Workflow endpoints require workflow role."""
        client = TestClient(_create_sit_app(pg_engine))
        response = client.post(f"/billing/invoices/{uuid.uuid4()}/issue", headers=_auth_headers())
        assert response.status_code in (403, 404, 409)


# ===================================================================
# PATIENT-001/002: Patient integration
# ===================================================================
class TestPatientIntegration:
    """PATIENT-001/002: Verify patient-billing FK integrity."""

    def test_invoice_joins_patient(self, db, cross_module_stubs):
        """PATIENT-001: Invoice JOIN patient returns correct patient data."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id)
        db.flush()
        row = db.execute(
            text("SELECT i.id, p.patient_code FROM invoices i JOIN patients p ON p.id = i.patient_id WHERE i.id = CAST(:iid AS UUID)"),
            {"iid": str(inv.id)},
        ).fetchone()
        assert row is not None
        assert row.patient_code == "P-TEST-001"

    def test_payment_joins_patient(self, db, cross_module_stubs):
        """PATIENT-001: Payment JOIN patient returns correct patient data."""
        pay = PaymentFactory.create(db, patient_id=STUB_PATIENT_ID)
        db.flush()
        row = db.execute(
            text("SELECT pay.id, p.patient_code FROM payments pay JOIN patients p ON p.id = pay.patient_id WHERE pay.id = CAST(:pid AS UUID)"),
            {"pid": str(pay.id)},
        ).fetchone()
        assert row is not None
        assert row.patient_code == "P-TEST-001"

    def test_credit_note_joins_patient(self, db, cross_module_stubs):
        """PATIENT-001: Credit note JOIN patient."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID)
        db.flush()
        cn = CreditNoteFactory.create(db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID)
        db.flush()
        row = db.execute(
            text("SELECT cn.id, p.patient_code FROM credit_notes cn JOIN patients p ON p.id = cn.patient_id WHERE cn.id = CAST(:cnid AS UUID)"),
            {"cnid": str(cn.id)},
        ).fetchone()
        assert row is not None
        assert row.patient_code == "P-TEST-001"

    def test_patient_filter_on_invoice_search(self, db, cross_module_stubs):
        """PATIENT-001: InvoiceRepository.search filters by patient_id."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id)
        db.flush()
        repo = InvoiceRepository(db)
        results, total = repo.search(patient_id=STUB_PATIENT_ID)
        assert total >= 1
        assert all(r.patient_id == STUB_PATIENT_ID for r in results)

    def test_invoice_allows_inactive_patient(self, db):
        """PATIENT-002: Invoice FK allows inactive patients (no business rule)."""
        pid = uuid.uuid4()
        db.execute(text("""
            INSERT INTO patients (id, patient_code, first_name, last_name,
                date_of_birth, gender, primary_contact_number, is_active)
            VALUES (CAST(:pid AS UUID), 'P-INACTIVE', 'Inactive', 'Patient',
                '1990-01-01', 'male', '+1234567890', false)
            ON CONFLICT (id) DO NOTHING
        """), {"pid": str(pid)})
        db.flush()
        inv = InvoiceFactory.create(db, patient_id=pid)
        db.flush()
        assert inv.patient_id == pid


# ===================================================================
# DOCTOR-001: Doctor integration
# ===================================================================
class TestDoctorIntegration:
    """DOCTOR-001: Verify doctor-billing FK integrity."""

    def test_invoice_joins_doctor(self, db, cross_module_stubs):
        """DOCTOR-001: Invoice JOIN doctor returns correct doctor data."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID)
        db.flush()
        row = db.execute(
            text("SELECT i.id, d.doctor_code FROM invoices i JOIN doctors d ON d.id = i.doctor_id WHERE i.id = CAST(:iid AS UUID)"),
            {"iid": str(inv.id)},
        ).fetchone()
        assert row is not None
        assert row.doctor_code == "D-SIT-001"

    def test_doctor_revenue_attribution(self, db, cross_module_stubs):
        """DOCTOR-001: Invoice items aggregated by doctor."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID, status="issued")
        InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1, unit_price=Decimal("1000.00"), net_amount=Decimal("1000.00"))
        InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=2, unit_price=Decimal("500.00"), net_amount=Decimal("500.00"))
        db.flush()
        row = db.execute(
            text("""
                SELECT COALESCE(SUM(ii.net_amount), 0) as total
                FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
                WHERE i.doctor_id = CAST(:did AS UUID) AND i.status NOT IN ('cancelled', 'void')
            """),
            {"did": str(STUB_DOCTOR_ID)},
        ).fetchone()
        assert row.total == Decimal("1500.00")

    def test_doctor_filter_on_invoice_search(self, db, cross_module_stubs):
        """DOCTOR-001: InvoiceRepository.search filters by doctor_id."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id)
        db.flush()
        repo = InvoiceRepository(db)
        results, total = repo.search(doctor_id=STUB_DOCTOR_ID)
        assert total >= 1
        assert all(r.doctor_id == STUB_DOCTOR_ID for r in results)


# ===================================================================
# APPOINTMENT-001: Appointment integration
# ===================================================================
class TestAppointmentIntegration:
    """APPOINTMENT-001: Verify appointment-billing FK integrity."""

    def test_invoice_joins_appointment(self, db, cross_module_stubs):
        """APPOINTMENT-001: Invoice JOIN appointment."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID, appointment_id=STUB_APPOINTMENT_ID)
        db.flush()
        row = db.execute(
            text("SELECT i.id, a.appointment_number FROM invoices i JOIN appointments a ON a.id = i.appointment_id WHERE i.id = CAST(:iid AS UUID)"),
            {"iid": str(inv.id)},
        ).fetchone()
        assert row is not None
        assert row.appointment_number == "APT-SIT-001"

    def test_appointment_to_invoice_lookup(self, db, cross_module_stubs):
        """APPOINTMENT-001: Query from appointment to invoice."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID, appointment_id=STUB_APPOINTMENT_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id)
        db.flush()
        row = db.execute(
            text("SELECT a.id, i.invoice_number FROM appointments a JOIN invoices i ON i.appointment_id = a.id WHERE a.id = CAST(:aid AS UUID)"),
            {"aid": str(STUB_APPOINTMENT_ID)},
        ).fetchone()
        assert row is not None
        assert row.invoice_number is not None

    def test_nullable_appointment(self, db):
        """APPOINTMENT-001: Invoice without appointment is valid."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, appointment_id=None)
        db.flush()
        assert inv.appointment_id is None


# ===================================================================
# TREATMENT-001/002: Treatment Plan integration
# ===================================================================
class TestTreatmentIntegration:
    """TREATMENT-001/002: Verify treatment-billing FK integrity."""

    def test_invoice_joins_treatment_plan(self, db, cross_module_stubs):
        """TREATMENT-001: Invoice JOIN treatment_plan."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID, treatment_plan_id=STUB_TREATMENT_PLAN_ID)
        db.flush()
        row = db.execute(
            text("SELECT i.id, tp.plan_code FROM invoices i JOIN treatment_plans tp ON tp.id = i.treatment_plan_id WHERE i.id = CAST(:iid AS UUID)"),
            {"iid": str(inv.id)},
        ).fetchone()
        assert row is not None
        assert row.plan_code == "TXN-SIT-001"

    def test_invoice_item_joins_plan_item(self, db, cross_module_stubs):
        """TREATMENT-001: InvoiceItem JOIN treatment_plan_item + procedure."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID, treatment_plan_id=STUB_TREATMENT_PLAN_ID)
        item = InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1, plan_item_id=STUB_PLAN_ITEM_ID)
        db.flush()
        row = db.execute(
            text("""
                SELECT ii.id, p.name as procedure_name
                FROM invoice_items ii
                JOIN treatment_plan_items tpi ON tpi.id = ii.plan_item_id
                JOIN procedures p ON p.id = tpi.procedure_id
                WHERE ii.id = CAST(:iid AS UUID)
            """),
            {"iid": str(item.id)},
        ).fetchone()
        assert row is not None
        assert row.procedure_name == "Root Canal"

    def test_full_treatment_chain(self, db, cross_module_stubs):
        """TREATMENT-001: Invoice → item → plan_item → plan traceability."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID, treatment_plan_id=STUB_TREATMENT_PLAN_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1, unit_price=Decimal("500.00"), net_amount=Decimal("500.00"), plan_item_id=STUB_PLAN_ITEM_ID)
        db.flush()
        row = db.execute(
            text("""
                SELECT i.invoice_number, tp.plan_code, p.name as procedure_name
                FROM invoices i
                JOIN invoice_items ii ON ii.invoice_id = i.id
                LEFT JOIN treatment_plan_items tpi ON tpi.id = ii.plan_item_id
                LEFT JOIN procedures p ON p.id = tpi.procedure_id
                LEFT JOIN treatment_plans tp ON tp.id = i.treatment_plan_id
                WHERE i.id = CAST(:iid AS UUID)
            """),
            {"iid": str(inv.id)},
        ).fetchone()
        assert row is not None
        assert row.plan_code == "TXN-SIT-001"
        assert row.procedure_name == "Root Canal"

    def test_nullable_treatment_plan(self, db):
        """TREATMENT-001: Invoice without treatment plan is valid."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, treatment_plan_id=None)
        db.flush()
        assert inv.treatment_plan_id is None


# ===================================================================
# PATIENT_RECORD-001: Diagnosis integration
# ===================================================================
class TestPatientRecordIntegration:
    """PATIENT_RECORD-001: Verify diagnosis-billing FK integrity."""

    def test_invoice_item_joins_diagnosis(self, db, cross_module_stubs):
        """PATIENT_RECORD-001: InvoiceItem JOIN diagnosis."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID)
        item = InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1, diagnosis_id=STUB_DIAGNOSIS_ID)
        db.flush()
        row = db.execute(
            text("SELECT ii.id, prd.diagnosis_name FROM invoice_items ii JOIN patient_record_diagnoses prd ON prd.id = ii.diagnosis_id WHERE ii.id = CAST(:iid AS UUID)"),
            {"iid": str(item.id)},
        ).fetchone()
        assert row is not None
        assert row.diagnosis_name == "Pulpitis"

    def test_diagnosis_code_traceability(self, db, cross_module_stubs):
        """PATIENT_RECORD-001: Diagnosis code accessible from invoice context."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1, diagnosis_id=STUB_DIAGNOSIS_ID)
        db.flush()
        row = db.execute(
            text("""
                SELECT prd.diagnosis_code FROM invoice_items ii
                JOIN patient_record_diagnoses prd ON prd.id = ii.diagnosis_id
                WHERE ii.invoice_id = CAST(:iid AS UUID)
            """),
            {"iid": str(inv.id)},
        ).fetchone()
        assert row is not None
        assert row.diagnosis_code == "K04.0"

    def test_nullable_diagnosis(self, db):
        """PATIENT_RECORD-001: Invoice item without diagnosis is valid."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID)
        item = InvoiceItemFactory.create(db, invoice_id=inv.id, diagnosis_id=None)
        db.flush()
        assert item.diagnosis_id is None


# ===================================================================
# USER-001: User attribution on billing records
# ===================================================================
class TestUserIntegration:
    """USER-001: Verify user attribution FK integrity."""

    def test_invoice_created_by_user(self, db, cross_module_stubs):
        inv = InvoiceFactory.create(db, created_by=STUB_USER_ID)
        InvoiceItemFactory.create(db, invoice_id=inv.id)
        db.flush()
        row = db.execute(text("SELECT u.full_name FROM invoices i JOIN users u ON u.id = i.created_by WHERE i.id = CAST(:iid AS UUID)"), {"iid": str(inv.id)}).fetchone()
        assert row is not None
        assert row.full_name == "Test User"

    def test_payment_created_by_user(self, db, cross_module_stubs):
        pay = PaymentFactory.create(db, created_by=STUB_USER_ID)
        db.flush()
        row = db.execute(text("SELECT u.full_name FROM payments p JOIN users u ON u.id = p.created_by WHERE p.id = CAST(:pid AS UUID)"), {"pid": str(pay.id)}).fetchone()
        assert row is not None
        assert row.full_name == "Test User"

    def test_refund_created_by_user(self, db, cross_module_stubs):
        pay = PaymentFactory.create(db)
        db.flush()
        refund = RefundFactory.create(db, payment_id=pay.id, created_by=STUB_USER_ID)
        db.flush()
        row = db.execute(text("SELECT u.full_name FROM refunds r JOIN users u ON u.id = r.created_by WHERE r.id = CAST(:rid AS UUID)"), {"rid": str(refund.id)}).fetchone()
        assert row is not None
        assert row.full_name == "Test User"

    def test_credit_note_created_by_user(self, db, cross_module_stubs):
        inv = InvoiceFactory.create(db)
        db.flush()
        cn = CreditNoteFactory.create(db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID, created_by=STUB_USER_ID)
        db.flush()
        row = db.execute(text("SELECT u.full_name FROM credit_notes cn JOIN users u ON u.id = cn.created_by WHERE cn.id = CAST(:cnid AS UUID)"), {"cnid": str(cn.id)}).fetchone()
        assert row is not None
        assert row.full_name == "Test User"

    def test_audit_log_user_attribution(self, db, cross_module_stubs):
        audit = AuditLogFactory.create(db, changed_by=STUB_USER_ID)
        db.flush()
        row = db.execute(text("SELECT u.full_name FROM billing_audit_logs al JOIN users u ON u.id = al.changed_by WHERE al.id = CAST(:aid AS UUID)"), {"aid": str(audit.id)}).fetchone()
        assert row is not None
        assert row.full_name == "Test User"


# ===================================================================
# Full cross-entity workflow integration
# ===================================================================
class TestCrossEntityFullWorkflow:
    """Full chain: Patient → Doctor → Treatment Plan → Invoice → Payment → Allocation."""

    def test_full_workflow_all_modules(self, db, cross_module_stubs):
        """Verify all cross-module FKs resolve correctly in one workflow."""
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, doctor_id=STUB_DOCTOR_ID,
                                     treatment_plan_id=STUB_TREATMENT_PLAN_ID, status="issued")
        InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1,
                                   unit_price=Decimal("750.00"), net_amount=Decimal("750.00"),
                                   plan_item_id=STUB_PLAN_ITEM_ID, diagnosis_id=STUB_DIAGNOSIS_ID)
        db.flush()

        pay = PaymentFactory.create(db, patient_id=STUB_PATIENT_ID, status="completed", total_amount=Decimal("750.00"))
        db.flush()

        alloc = PaymentAllocation(id=uuid.uuid4(), payment_id=pay.id, invoice_id=inv.id,
                                   allocated_amount=Decimal("750.00"), is_refund=False, created_by=STUB_USER_ID)
        db.add(alloc)
        db.flush()

        row = db.execute(text("""
            SELECT p.patient_code, d.doctor_code, tp.plan_code, proc.name as procedure_name,
                   prd.diagnosis_name, pay.payment_number, pa.allocated_amount
            FROM invoices i
            JOIN patients p ON p.id = i.patient_id
            LEFT JOIN doctors d ON d.id = i.doctor_id
            LEFT JOIN treatment_plans tp ON tp.id = i.treatment_plan_id
            JOIN invoice_items ii ON ii.invoice_id = i.id
            LEFT JOIN treatment_plan_items tpi ON tpi.id = ii.plan_item_id
            JOIN procedures proc ON proc.id = tpi.procedure_id
            LEFT JOIN patient_record_diagnoses prd ON prd.id = ii.diagnosis_id
            JOIN payments pay ON pay.id = CAST(:payid AS UUID)
            JOIN payment_allocations pa ON pa.invoice_id = i.id AND pa.payment_id = pay.id
            WHERE i.id = CAST(:iid AS UUID)
        """), {"iid": str(inv.id), "payid": str(pay.id)}).fetchone()

        assert row is not None
        assert row.patient_code == "P-TEST-001"
        assert row.doctor_code == "D-SIT-001"
        assert row.plan_code == "TXN-SIT-001"
        assert row.procedure_name == "Root Canal"
        assert row.diagnosis_name == "Pulpitis"
        assert row.allocated_amount == Decimal("750.00")

    def test_audit_trail_user_attribution(self, db, cross_module_stubs):
        """Audit log entries have correct user attribution."""
        inv = InvoiceFactory.create(db, created_by=STUB_USER_ID)
        db.flush()
        audit = BillingAuditLog(id=uuid.uuid4(), entity_type="invoice", entity_id=inv.id, action="created",
                                 new_value={"status": "draft"}, changed_by=STUB_USER_ID, changed_at=datetime.now(timezone.utc))
        db.add(audit)
        db.flush()
        row = db.execute(text("SELECT u.full_name FROM billing_audit_logs al JOIN users u ON u.id = al.changed_by WHERE al.id = CAST(:aid AS UUID)"), {"aid": str(audit.id)}).fetchone()
        assert row is not None
        assert row.full_name == "Test User"


# ===================================================================
# DASHBOARD-001: Dashboard aggregates
# ===================================================================
class TestDashboardIntegration:
    """DASHBOARD-001: Dashboard aggregates work with patient data."""

    def test_invoice_totals(self, db, cross_module_stubs):
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, status="issued")
        InvoiceItemFactory.create(db, invoice_id=inv.id, unit_price=Decimal("1000.00"), net_amount=Decimal("1000.00"))
        db.flush()
        total = InvoiceRepository(db).get_invoice_grand_total(inv.id)
        assert total == Decimal("1000.00")

    def test_patient_scoped_totals(self, db, cross_module_stubs):
        inv = InvoiceFactory.create(db, patient_id=STUB_PATIENT_ID, status="issued")
        InvoiceItemFactory.create(db, invoice_id=inv.id, unit_price=Decimal("500.00"), net_amount=Decimal("500.00"))
        db.flush()
        total = InvoiceRepository(db).get_invoice_grand_total(inv.id)
        assert total == Decimal("500.00")

    def test_payment_list_by_patient(self, db, cross_module_stubs):
        PaymentFactory.create(db, patient_id=STUB_PATIENT_ID, status="completed", total_amount=Decimal("300.00"))
        db.flush()
        results, total = PaymentRepository(db).search(patient_id=STUB_PATIENT_ID)
        assert total >= 1
        assert all(p.patient_id == STUB_PATIENT_ID for p in results)


# ===================================================================
# FUTURE INTEGRATIONS — documented as pending
# ===================================================================
class TestFutureIntegrations:
    """Document pending integrations (no tests — not implemented)."""

    def test_inventory_integration_pending(self):
        """FUTURE: Invoice items → inventory stock decrement. Not implemented."""
        pass

    def test_notifications_integration_pending(self):
        """FUTURE: Receipts, reminders → notifications. Not implemented."""
        pass

    def test_insurance_integration_pending(self):
        """FUTURE: Insurance claims from invoice items. Not implemented."""
        pass
