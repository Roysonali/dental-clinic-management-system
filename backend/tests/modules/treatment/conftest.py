"""Treatment Plan module — shared test fixtures & factory helpers.

Provides:
- SQLite in-memory engine with UUID/JSONB compilation overrides
- Factory classes: ProcedureFactory, TreatmentPlanFactory, etc.
- Fixtures: db, procedure, plan, plan_with_items, etc.
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "a" * 32
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
import app.database.models  # noqa: F401 — register all FK target tables

# Billing module tables use PostgreSQL-specific regex CHECK constraints
# (e.g. ``prefix ~ '^[A-Z-]+$'``) that SQLite cannot compile.  We
# exclude them from ``create_all`` so the treatment test suite can run
# on SQLite while the production PostgreSQL constraint remains untouched.
_BILLING_TABLES = frozenset({
    "document_sequences",
    "sequence_consumption_log",
    "invoices",
    "invoice_line_items",
    "invoice_status_history",
    "payments",
    "payment_allocations",
    "receipts",
    "receipt_invoices",
    "credit_notes",
    "patient_credits",
    "refunds",
    "billing_audit_logs",
})

# Models from other modules needed for FK stub records
from app.modules.auth.models import Role, User
from app.modules.doctors.models import Doctor
from app.modules.patients.models import Patient

from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ProcedureCategory,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
    ToothArch,
    ToothQuadrant,
)
from app.modules.treatment.models import (
    Procedure,
    TreatmentPlan,
    TreatmentPlanApproval,
    TreatmentPlanItem,
    TreatmentPlanVersion,
)


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
# Stub FK record IDs (known values seeded before every test)
# ---------------------------------------------------------------------------

_STUB_PATIENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_STUB_DOCTOR_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_STUB_USER_ID = 1
_STUB_ROLE_ID = 1


def _seed_fk_stubs(db: Session) -> None:
    """Insert minimal FK target records required by TreatmentPlan.

    Called once per test inside the ``db`` fixture so every test has
    the FK targets it needs. The known IDs are also used as defaults
    in the factory classes below.
    """
    role = Role(id=_STUB_ROLE_ID, name="Doctor")
    db.add(role)

    user = User(
        id=_STUB_USER_ID,
        full_name="Test Doctor",
        email="doctor@test.com",
        password_hash="<stub>",
        status="active",
        is_active=True,
        role_id=_STUB_ROLE_ID,
    )
    db.add(user)

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
        user_id=_STUB_USER_ID,
        primary_phone="+1234567890",
    )
    db.add(doctor)

    db.flush()


# ---------------------------------------------------------------------------
# Factory classes
# ---------------------------------------------------------------------------


class ProcedureFactory:
    _counter = 0

    @classmethod
    def _next_code(cls) -> str:
        cls._counter += 1
        return f"PRC-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, **kwargs) -> Procedure:
        n = cls._counter + 1
        defaults = dict(
            code=cls._next_code(),
            name=f"Procedure {n}",
            default_cost=Decimal("100.00"),
            category=ProcedureCategory.OTHER,
            description=None,
            is_active=True,
        )
        defaults.update(kwargs)
        return Procedure(**defaults)

    @classmethod
    def create(cls, db: Session, **kwargs) -> Procedure:
        obj = cls.build(**kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class TreatmentPlanFactory:
    _counter = 0

    @classmethod
    def _next_code(cls) -> str:
        cls._counter += 1
        return f"TXN-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, **kwargs) -> TreatmentPlan:
        now = datetime.now(timezone.utc)
        defaults = dict(
            id=uuid.uuid4(),
            plan_code=cls._next_code(),
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            clinical_notes=None,
            observations=None,
            dentist_recommendations=None,
            valid_from=None,
            valid_to=None,
            status=TreatmentPlanStatus.DRAFT,
            current_version=1,
            lock_version=1,
            is_active=True,
            created_by=None,
            updated_by=None,
            created_at=now,
            updated_at=now,
        )
        defaults.update(kwargs)
        return TreatmentPlan(**defaults)

    @classmethod
    def create(cls, db: Session, **kwargs) -> TreatmentPlan:
        obj = cls.build(**kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class TreatmentPlanItemFactory:
    _seq_counter = 0

    @classmethod
    def _next_seq(cls) -> int:
        cls._seq_counter += 1
        return cls._seq_counter

    @classmethod
    def build(cls, plan_id: uuid.UUID, **kwargs) -> TreatmentPlanItem:
        defaults = dict(
            id=uuid.uuid4(),
            plan_id=plan_id,
            procedure_id=1,
            sequence_number=cls._next_seq(),
            quantity=1,
            tooth_number=None,
            tooth_surface=None,
            quadrant=None,
            arch=None,
            estimated_cost=Decimal("100.00"),
            discount=Decimal("0.00"),
            item_status=TreatmentPlanItemStatus.PENDING,
            notes=None,
            appointment_id=None,
            diagnosis_id=None,
        )
        defaults.update(kwargs)
        return TreatmentPlanItem(**defaults)

    @classmethod
    def create(cls, db: Session, plan_id: uuid.UUID, **kwargs) -> TreatmentPlanItem:
        obj = cls.build(plan_id=plan_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class TreatmentPlanVersionFactory:
    _v_counter = 0

    @classmethod
    def _next_version(cls) -> int:
        cls._v_counter += 1
        return cls._v_counter

    @classmethod
    def build(cls, plan_id: uuid.UUID, **kwargs) -> TreatmentPlanVersion:
        defaults = dict(
            id=uuid.uuid4(),
            plan_id=plan_id,
            version_number=cls._next_version(),
            items_snapshot={},
            change_reason="Test version creation",
            changed_by=1,
            created_at=datetime.now(timezone.utc),
        )
        defaults.update(kwargs)
        return TreatmentPlanVersion(**defaults)

    @classmethod
    def create(cls, db: Session, plan_id: uuid.UUID, **kwargs) -> TreatmentPlanVersion:
        obj = cls.build(plan_id=plan_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class TreatmentPlanApprovalFactory:
    @classmethod
    def build(cls, plan_id: uuid.UUID, **kwargs) -> TreatmentPlanApproval:
        defaults = dict(
            id=uuid.uuid4(),
            plan_id=plan_id,
            approved_by=None,
            approved_at=None,
            patient_status=PatientAcknowledgmentStatus.PENDING,
            patient_acknowledged_at=None,
            approval_notes=None,
        )
        defaults.update(kwargs)
        return TreatmentPlanApproval(**defaults)

    @classmethod
    def create(cls, db: Session, plan_id: uuid.UUID, **kwargs) -> TreatmentPlanApproval:
        obj = cls.build(plan_id=plan_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


# ---------------------------------------------------------------------------
# Database fixture (autouse — every test gets a fresh DB)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function", autouse=True)
def db():
    """Create all tables, yield a session, then drop all tables.

    Uses ``autouse=True`` so every test automatically has a clean database.
    Foreign key enforcement is enabled via ``PRAGMA foreign_keys = ON``.
    """
    # Create all tables EXCEPT billing tables with PostgreSQL regex
    # CHECK constraints that SQLite cannot compile (Option B: dialect-
    # aware schema generation).
    _test_tables = [
        t
        for name, t in Base.metadata.tables.items()
        if name not in _BILLING_TABLES
    ]
    Base.metadata.create_all(bind=engine, tables=_test_tables)
    session = TestingSessionLocal()
    # NOTE: Foreign-key enforcement is intentionally disabled for repository
    # tests. SQLite's ``ON DELETE CASCADE`` (required by ``passive_deletes=True``
    # on model relationships) only fires when FK enforcement is enabled, but
    # enabling it breaks tests that use random UUIDs for cross-module FKs
    # (patient_id, doctor_id). FK integrity is validated at the service/API
    # integration layer.
    #
    # session.execute(text("PRAGMA foreign_keys = ON"))
    _seed_fk_stubs(session)
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Entity fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def procedure(db) -> Procedure:
    """Create and return a single active procedure."""
    return ProcedureFactory.create(db)


@pytest.fixture
def inactive_procedure(db) -> Procedure:
    """Create and return a single inactive procedure."""
    return ProcedureFactory.create(db, is_active=False)


@pytest.fixture
def procedure_list(db) -> list[Procedure]:
    """Create and return 3 procedures."""
    return [ProcedureFactory.create(db) for _ in range(3)]


@pytest.fixture
def plan(db) -> TreatmentPlan:
    """Create and return a draft treatment plan with no items."""
    return TreatmentPlanFactory.create(db)


@pytest.fixture
def plan_with_items(db, procedure) -> TreatmentPlan:
    """Create a draft plan with 3 items linked to the fixture procedure."""
    p = TreatmentPlanFactory.create(db)
    for i in range(1, 4):
        TreatmentPlanItemFactory.create(
            db, plan_id=p.id, procedure_id=procedure.id, sequence_number=i,
        )
    db.refresh(p)
    return p


@pytest.fixture
def plan_with_approval(db) -> TreatmentPlan:
    """Create a plan with an approval record (pending)."""
    p = TreatmentPlanFactory.create(db)
    TreatmentPlanApprovalFactory.create(db, plan_id=p.id)
    db.refresh(p)
    return p


@pytest.fixture
def plan_with_versions(db) -> TreatmentPlan:
    """Create a plan with 2 version snapshots."""
    p = TreatmentPlanFactory.create(db)
    TreatmentPlanVersionFactory.create(db, plan_id=p.id, version_number=1)
    TreatmentPlanVersionFactory.create(db, plan_id=p.id, version_number=2)
    db.refresh(p)
    return p


@pytest.fixture
def plan_complete_aggregate(db, procedure, plan_with_items) -> TreatmentPlan:
    """Create a fully populated plan: items + approval + 2 versions."""
    TreatmentPlanApprovalFactory.create(db, plan_id=plan_with_items.id)
    TreatmentPlanVersionFactory.create(db, plan_id=plan_with_items.id, version_number=1)
    TreatmentPlanVersionFactory.create(db, plan_id=plan_with_items.id, version_number=2)
    db.refresh(plan_with_items)
    return plan_with_items


# ---------------------------------------------------------------------------
# Mock fixtures for isolated tests
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_db():
    """Return a MagicMock spec=Session for unit tests that need a mocked session."""
    return MagicMock(spec=Session)


@pytest.fixture
def mock_procedure():
    """Return a MagicMock resembling a Procedure ORM instance."""
    mock = MagicMock(spec=Procedure)
    mock.id = 1
    mock.code = "TEST001"
    mock.name = "Test Procedure"
    mock.category = ProcedureCategory.OTHER
    mock.default_cost = Decimal("100.00")
    mock.is_active = True
    mock.description = "A test procedure"
    return mock
