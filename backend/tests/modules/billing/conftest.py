"""Billing module — shared test fixtures & factory helpers.

Provides:
- SQLite in-memory engine with UUID/JSONB compilation overrides
- Factory classes: InvoiceFactory, InvoiceItemFactory
- Fixtures: db, invoice_service, invoice, invoice_with_items
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base

# Register all FK target tables with the shared metadata registry.
import app.database.models  # noqa: F401

# ---------------------------------------------------------------------------
# SQLite compilation overrides for PostgreSQL-specific column types
# ---------------------------------------------------------------------------
@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(element, compiler, **kw):
    return "VARCHAR(36)"


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(element, compiler, **kw):
    return "TEXT"


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Billing models (ensure they are registered with the metadata)
# ---------------------------------------------------------------------------
from app.modules.billing.models import (  # noqa: E402
    DocumentSequence,
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
    Payment,
    PaymentAllocation,
    Receipt,
    Refund,
)


# ---------------------------------------------------------------------------
# Stub record IDs
# ---------------------------------------------------------------------------
_STUB_PATIENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_STUB_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")
_STUB_DOCTOR_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_STUB_APPOINTMENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")
_STUB_TREATMENT_PLAN_ID = uuid.UUID("00000000-0000-0000-0000-000000000004")
_STUB_TREATMENT_PLAN_ITEM_ID = uuid.UUID("00000000-0000-0000-0000-000000000005")


# ---------------------------------------------------------------------------
# Database fixture (autouse — every test gets a fresh DB)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="function", autouse=True)
def db():
    # SQLite does not support the PostgreSQL ~ (regex) operator used in
    # several CHECK constraints. Remove those constraints before create_all
    # so tests can run on SQLite.
    for table in Base.metadata.tables.values():
        for constraint in list(table.constraints):
            sql_text = str(constraint.sqltext) if hasattr(constraint, "sqltext") else ""
            if "~" in sql_text:
                table.constraints.remove(constraint)

    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    _seed_fk_stubs(session)
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(bind=engine)


def _seed_fk_stubs(db: Session) -> None:
    """Insert minimal FK target records required by Invoice."""
    from app.modules.patients.models import Patient  # noqa: E402
    from app.modules.doctors.models import Doctor  # noqa: E402
    from app.modules.appointments.model import Appointment  # noqa: E402
    from app.modules.treatment.models import TreatmentPlan  # noqa: E402
    from app.modules.treatment.models import TreatmentPlanItem  # noqa: E402

    patient = Patient(
        id=_STUB_PATIENT_ID,
        patient_code="P-TEST-001",
        first_name="Test",
        last_name="Patient",
        date_of_birth=date(1990, 1, 1),
        gender="male",
        primary_contact_number="+1234567890",
    )
    db.add(patient)

    doctor = Doctor(
        id=_STUB_DOCTOR_ID,
        doctor_code="D-TEST-001",
        user_id=1,
        primary_phone="+1234567890",
    )
    db.add(doctor)

    appointment = Appointment(
        id=_STUB_APPOINTMENT_ID,
        appointment_number="APT-TEST-001",
        patient_id=_STUB_PATIENT_ID,
        dentist_id=1,
        appointment_date=date(2025, 1, 1),
        start_time=datetime.strptime("09:00:00", "%H:%M:%S").time(),
        end_time=datetime.strptime("09:30:00", "%H:%M:%S").time(),
        duration_minutes=30,
        appointment_type="checkup",
        reason_for_visit="Test visit",
    )
    db.add(appointment)

    treatment_plan = TreatmentPlan(
        id=_STUB_TREATMENT_PLAN_ID,
        plan_code="TP-TEST-001",
        patient_id=_STUB_PATIENT_ID,
        doctor_id=_STUB_DOCTOR_ID,
        status="draft",
        current_version=1,
        is_active=True,
        created_by=None,
        updated_by=None,
    )
    db.add(treatment_plan)

    treatment_plan_item = TreatmentPlanItem(
        id=_STUB_TREATMENT_PLAN_ITEM_ID,
        plan_id=_STUB_TREATMENT_PLAN_ID,
        procedure_id=1,
        sequence_number=1,
        estimated_cost=Decimal("100.00"),
        discount=Decimal("0.00"),
        item_status="pending",
    )
    db.add(treatment_plan_item)

    document_sequence_invoice = DocumentSequence(
        document_type="invoice",
        prefix="INV-",
        current_value=0,
        min_digits=5,
        start_value=1,
        updated_by=_STUB_USER_ID,
    )
    db.add(document_sequence_invoice)

    document_sequence_payment = DocumentSequence(
        document_type="payment",
        prefix="PAY-",
        current_value=0,
        min_digits=5,
        start_value=1,
        updated_by=_STUB_USER_ID,
    )
    db.add(document_sequence_payment)

    document_sequence_receipt = DocumentSequence(
        document_type="receipt",
        prefix="RCT-",
        current_value=0,
        min_digits=5,
        start_value=1,
        updated_by=_STUB_USER_ID,
    )
    db.add(document_sequence_receipt)

    document_sequence_refund = DocumentSequence(
        document_type="refund",
        prefix="RFD-",
        current_value=0,
        min_digits=5,
        start_value=1,
        updated_by=_STUB_USER_ID,
    )
    db.add(document_sequence_refund)

    db.flush()


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------
class InvoiceFactory:
    _counter = 0

    @classmethod
    def _next_number(cls) -> str:
        cls._counter += 1
        return f"INV-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, **kwargs) -> Invoice:
        now = datetime.now(timezone.utc)
        defaults = dict(
            id=uuid.uuid4(),
            patient_id=_STUB_PATIENT_ID,
            treatment_plan_id=None,
            appointment_id=None,
            doctor_id=None,
            invoice_number=cls._next_number(),
            invoice_date=date.today(),
            due_date=date.today() + __import__("datetime").date.resolution * 30,
            status="draft",
            currency_code="USD",
            notes=None,
            cancellation_reason=None,
            void_reason=None,
            created_by=_STUB_USER_ID,
            updated_by=None,
            created_at=now,
            updated_at=now,
            version=1,
            doc_version=1,
        )
        defaults.update(kwargs)
        return Invoice(**defaults)

    @classmethod
    def create(cls, db: Session, **kwargs) -> Invoice:
        obj = cls.build(**kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class InvoiceItemFactory:
    _seq_counter = 0

    @classmethod
    def _next_seq(cls) -> int:
        cls._seq_counter += 1
        return cls._seq_counter

    @classmethod
    def build(cls, invoice_id: uuid.UUID, **kwargs) -> InvoiceItem:
        defaults = dict(
            id=uuid.uuid4(),
            invoice_id=invoice_id,
            plan_item_id=None,
            diagnosis_id=None,
            sequence_number=cls._next_seq(),
            description="Test item",
            quantity=1,
            unit_price=Decimal("100.00"),
            discount_type=None,
            discount_value=None,
            net_amount=Decimal("100.00"),
            tax_rate_id=None,
            tax_amount=None,
            original_price=None,
            override_reason=None,
            created_by=_STUB_USER_ID,
            updated_by=None,
            version=1,
            doc_version=1,
        )
        defaults.update(kwargs)
        return InvoiceItem(**defaults)

    @classmethod
    def create(cls, db: Session, invoice_id: uuid.UUID, **kwargs) -> InvoiceItem:
        obj = cls.build(invoice_id=invoice_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class PaymentFactory:
    _counter = 0

    @classmethod
    def _next_number(cls) -> str:
        cls._counter += 1
        return f"PAY-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, **kwargs) -> Payment:
        now = datetime.now(timezone.utc)
        defaults = dict(
            id=uuid.uuid4(),
            patient_id=_STUB_PATIENT_ID,
            payment_number=cls._next_number(),
            payment_method="cash",
            total_amount=Decimal("100.00"),
            payment_date=date.today(),
            status="pending",
            reference_number=None,
            is_reversed=False,
            reversal_reason=None,
            notes=None,
            created_by=_STUB_USER_ID,
            updated_by=None,
            created_at=now,
            updated_at=now,
            version=1,
            doc_version=1,
        )
        defaults.update(kwargs)
        return Payment(**defaults)

    @classmethod
    def create(cls, db: Session, **kwargs) -> Payment:
        obj = cls.build(**kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


# ---------------------------------------------------------------------------
# Entity fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def invoice(db) -> Invoice:
    return InvoiceFactory.create(db)


@pytest.fixture
def invoice_with_items(db) -> Invoice:
    inv = InvoiceFactory.create(db)
    InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1)
    InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=2)
    db.refresh(inv)
    return inv


@pytest.fixture
def payment(db) -> Payment:
    return PaymentFactory.create(db)


@pytest.fixture
def completed_payment(db) -> Payment:
    """A payment already in COMPLETED status."""
    from app.modules.billing.enums import PaymentStatus
    return PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value)


@pytest.fixture
def issued_invoice(db) -> Invoice:
    """An invoice in ISSUED status with 2 line items (total=200)."""
    from app.modules.billing.enums import InvoiceStatus
    inv = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
    InvoiceItemFactory.create(
        db, invoice_id=inv.id, sequence_number=1,
        unit_price=Decimal("150.00"), net_amount=Decimal("150.00"),
    )
    InvoiceItemFactory.create(
        db, invoice_id=inv.id, sequence_number=2,
        unit_price=Decimal("50.00"), net_amount=Decimal("50.00"),
    )
    db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Service fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def invoice_service(db) -> InvoiceService:
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        InvoiceRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        InvoiceValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        InvoiceService,
    )

    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    invoice_validator = InvoiceValidator(invoice_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )

    return InvoiceService(
        db=db,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


@pytest.fixture
def payment_service(db) -> PaymentService:
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        PaymentRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        PaymentValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        PaymentService,
    )

    payment_repo = PaymentRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    payment_validator = PaymentValidator(payment_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )

    return PaymentService(
        db=db,
        payment_repo=payment_repo,
        payment_validator=payment_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


@pytest.fixture
def payment_service_with_allocation(db) -> PaymentService:
    """PaymentService with invoice dependencies for allocation operations."""
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        InvoiceRepository,
        PaymentRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        InvoiceValidator,
        PaymentValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        PaymentService,
    )

    payment_repo = PaymentRepository(db)
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    payment_validator = PaymentValidator(payment_repo, financial_validator)
    invoice_validator = InvoiceValidator(invoice_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )

    return PaymentService(
        db=db,
        payment_repo=payment_repo,
        payment_validator=payment_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
    )


@pytest.fixture
def receipt_service(db) -> ReceiptService:
    """ReceiptService with all dependencies for receipt operations."""
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        PaymentRepository,
        ReceiptRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        ReceiptValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        ReceiptService,
    )

    receipt_repo = ReceiptRepository(db)
    payment_repo = PaymentRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    receipt_validator = ReceiptValidator(receipt_repo)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )

    return ReceiptService(
        db=db,
        receipt_repo=receipt_repo,
        receipt_validator=receipt_validator,
        payment_repo=payment_repo,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )



@pytest.fixture
def refund_service(db) -> 'RefundService':
    """RefundService with all dependencies for refund operations."""
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        PaymentRepository,
    )
    from app.modules.billing.repositories.refund_repository import RefundRepository
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
    )
    from app.modules.billing.validators.refund_validator import RefundValidator
    from app.modules.billing.services import (
        DocumentSequenceService,
    )
    from app.modules.billing.services.refund_service import RefundService

    refund_repo = RefundRepository(db)
    payment_repo = PaymentRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    refund_validator = RefundValidator(refund_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )

    return RefundService(
        db=db,
        refund_repo=refund_repo,
        payment_repo=payment_repo,
        refund_validator=refund_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


__all__ = [
    "_STUB_DOCTOR_ID",
    "_STUB_USER_ID",
    "_STUB_PATIENT_ID",
    "InvoiceFactory",
    "InvoiceItemFactory",
    "PaymentFactory",
    "invoice",
    "invoice_with_items",
    "invoice_service",
    "payment",
    "payment_service",
    "refund_service",
]
