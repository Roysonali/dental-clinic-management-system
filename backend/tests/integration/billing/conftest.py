"""PostgreSQL integration test infrastructure for the Billing module.

Provides:
- Real PostgreSQL engine connected to denscare_test database
- Per-test transactional rollback for isolation
- Seeded FK stubs matching production schema
- Reusable entity factories (no SQLite hacks)
- Session-per-test with automatic teardown
- Alembic migration runner

Usage:
    All tests in this directory use real PostgreSQL.
    Tests are marked with ``@pytest.mark.postgres``.
    Run with: pytest tests/integration/ -m postgres --tb=short
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

# CRITICAL: Override DATABASE_URL BEFORE any app modules are imported.
# Other conftest files (tests/modules/billing/conftest.py) set this to
# SQLite — we must override it before app.database.session is loaded.
os.environ["DATABASE_URL"] = "postgresql://postgres:1234@localhost:5432/denscare_test"
os.environ["JWT_SECRET"] = "integration-test-secret-key-32-chars-long!"
os.environ["JWT_ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.database.base import Base
import app.database.models  # noqa: F401 — register all models

from app.modules.billing.models import (  # noqa: E402
    BillingAuditLog,
    CreditNote,
    DocumentSequence,
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
    PatientCredit,
    Payment,
    PaymentAllocation,
    Receipt,
    ReceiptInvoice,
    Refund,
    SequenceConsumptionLog,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
STUB_PATIENT_ID = uuid.UUID("10000000-0000-0000-0000-000000000001")
STUB_USER_ID = 1  # INTEGER FK to users table
STUB_DOCTOR_ID = uuid.UUID("10000000-0000-0000-0000-000000000002")

PG_URL = os.environ["DATABASE_URL"]


# ---------------------------------------------------------------------------
# Engine — one shared engine for the entire test session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def pg_engine():
    """Create a session-scoped PostgreSQL engine."""
    engine = create_engine(
        PG_URL,
        poolclass=NullPool,
    )
    yield engine
    engine.dispose()


# ---------------------------------------------------------------------------
# Schema setup/teardown — create all tables once per session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _setup_schema(pg_engine):
    """Create all tables from metadata, then drop after session."""
    Base.metadata.create_all(bind=pg_engine)
    yield
    Base.metadata.drop_all(bind=pg_engine)


@pytest.fixture(scope="session", autouse=True)
def _seed_committed_stubs(pg_engine, _setup_schema):
    """Commit FK stubs via raw SQL so concurrent sessions can see them.

    The per-test `db` fixture's uncommitted transaction is invisible to
    other connections. Concurrency tests create their own sessions, so
    the stubs must be committed at session scope.
    """
    import uuid as _uuid
    with pg_engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO roles (id, name) VALUES (1, 'ADMIN') "
            "ON CONFLICT (id) DO NOTHING"
        ))
        conn.execute(text(
            "INSERT INTO users (id, email, password_hash, full_name, role_id, is_active, status) "
            "VALUES (1, 'test@test.com', 'hashed', 'Test User', 1, true, 'active') "
            "ON CONFLICT (id) DO NOTHING"
        ))
        conn.execute(text(
            "INSERT INTO patients (id, patient_code, first_name, last_name, "
            "date_of_birth, gender, primary_contact_number, is_active) "
            "VALUES (CAST(:pid AS UUID), 'P-TEST-001', 'Test', 'Patient', "
            "'1990-01-01', 'male', '+1234567890', true) "
            "ON CONFLICT (id) DO NOTHING"
        ), {"pid": str(STUB_PATIENT_ID)})

        for doc_type, prefix in [
            ("invoice", "INV-"), ("payment", "PAY-"), ("receipt", "RCT-"),
            ("refund", "RFD-"), ("credit_note", "CN-"),
        ]:
            conn.execute(text(
                "INSERT INTO document_sequences (document_type, prefix, current_value, "
                "min_digits, start_value, updated_by) "
                "VALUES (:dt, :p, 0, 5, 1, 1) "
                "ON CONFLICT (document_type) DO NOTHING"
            ), {"dt": doc_type, "p": prefix})


# ---------------------------------------------------------------------------
# Alembic migration runner
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def alembic_config():
    """Return a configured alembic config pointing at the test DB."""
    from alembic.config import Config as AlembicConfig
    ini_path = Path(__file__).resolve().parent.parent.parent.parent / "alembic.ini"
    cfg = AlembicConfig(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", PG_URL)
    return cfg


# ---------------------------------------------------------------------------
# Database session — transactional rollback per test
# ---------------------------------------------------------------------------
@pytest.fixture()
def db(pg_engine):
    """Provide a transactional session that rolls back after each test.

    This is the core isolation mechanism: every test gets its own
    transaction that is rolled back at teardown, guaranteeing a clean
    database state without needing to recreate tables.
    """
    connection = pg_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    _seed_fk_stubs(session)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def db_session(db):
    """Alias for db — allows both naming conventions."""
    return db


# ---------------------------------------------------------------------------
# FK stub seeding — minimal required records for billing FKs
# ---------------------------------------------------------------------------
def _seed_fk_stubs(db: Session) -> None:
    """Insert minimal FK target records required by billing entities.

    Uses raw SQL inserts where possible to avoid model validation issues.
    Billing only strictly requires: User (for created_by), Patient, and
    DocumentSequences. Other stubs are best-effort.

    Idempotent — uses ON CONFLICT DO NOTHING for Role/User and
    checks existence before inserting DocumentSequences.
    """
    from sqlalchemy import text

    # Role — use raw SQL with ON CONFLICT to be idempotent
    db.execute(text(
        "INSERT INTO roles (id, name) VALUES (1, 'ADMIN') "
        "ON CONFLICT (id) DO NOTHING"
    ))

    # User — use raw SQL with ON CONFLICT to be idempotent
    db.execute(text(
        "INSERT INTO users (id, email, password_hash, full_name, role_id, is_active, status) "
        "VALUES (1, 'test@test.com', 'hashed', 'Test User', 1, true, 'active') "
        "ON CONFLICT (id) DO NOTHING"
    ))

    # Patient — use raw SQL with ON CONFLICT to be idempotent
    db.execute(text(
        "INSERT INTO patients (id, patient_code, first_name, last_name, "
        "date_of_birth, gender, primary_contact_number, is_active) "
        "VALUES (CAST(:pid AS UUID), 'P-TEST-001', 'Test', 'Patient', "
        "'1990-01-01', 'male', '+1234567890', true) "
        "ON CONFLICT (id) DO NOTHING"
    ), {"pid": str(STUB_PATIENT_ID)})

    # Best-effort doctor stub — savepoint so failure doesn't undo above
    try:
        from app.modules.doctors.models import Doctor
        sp = db.begin_nested()
        try:
            doctor = Doctor(
                id=STUB_DOCTOR_ID,
                doctor_code="D-TEST-001",
                user_id=1,
                primary_phone="+1234567890",
            )
            db.add(doctor)
            sp.commit()
        except Exception:
            sp.rollback()
    except Exception:
        pass

    # DocumentSequences — only insert if not already present
    existing_ds = db.execute(
        text("SELECT document_type FROM document_sequences")
    ).fetchall()
    existing_types = {row[0] for row in existing_ds}

    for doc_type, prefix in [
        ("invoice", "INV-"),
        ("payment", "PAY-"),
        ("receipt", "RCT-"),
        ("refund", "RFD-"),
        ("credit_note", "CN-"),
    ]:
        if doc_type not in existing_types:
            ds = DocumentSequence(
                document_type=doc_type,
                prefix=prefix,
                current_value=0,
                min_digits=5,
                start_value=1,
                updated_by=1,
            )
            db.add(ds)
    db.flush()


# ---------------------------------------------------------------------------
# Factories — build and persist billing entities
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
            patient_id=STUB_PATIENT_ID,
            treatment_plan_id=None,
            appointment_id=None,
            doctor_id=None,
            invoice_number=cls._next_number(),
            invoice_date=date.today(),
            due_date=date.today() + __import__("datetime").timedelta(days=30),
            status="draft",
            currency_code="USD",
            notes=None,
            cancellation_reason=None,
            void_reason=None,
            created_by=STUB_USER_ID,
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
            created_by=STUB_USER_ID,
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
            patient_id=STUB_PATIENT_ID,
            payment_number=cls._next_number(),
            payment_method="cash",
            total_amount=Decimal("100.00"),
            payment_date=date.today(),
            status="pending",
            reference_number=None,
            is_reversed=False,
            reversal_reason=None,
            notes=None,
            created_by=STUB_USER_ID,
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


class ReceiptFactory:
    _counter = 0

    @classmethod
    def _next_number(cls) -> str:
        cls._counter += 1
        return f"RCT-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, payment_id: uuid.UUID, **kwargs) -> Receipt:
        now = datetime.now(timezone.utc)
        defaults = dict(
            id=uuid.uuid4(),
            payment_id=payment_id,
            receipt_number=cls._next_number(),
            receipt_date=date.today(),
            amount=Decimal("100.00"),
            status="generated",
            created_by=STUB_USER_ID,
            created_at=now,
        )
        defaults.update(kwargs)
        return Receipt(**defaults)

    @classmethod
    def create(cls, db: Session, payment_id: uuid.UUID, **kwargs) -> Receipt:
        obj = cls.build(payment_id=payment_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class RefundFactory:
    _counter = 0

    @classmethod
    def _next_number(cls) -> str:
        cls._counter += 1
        return f"RFD-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, payment_id: uuid.UUID, **kwargs) -> Refund:
        now = datetime.now(timezone.utc)
        defaults = dict(
            id=uuid.uuid4(),
            payment_id=payment_id,
            refund_number=cls._next_number(),
            amount=Decimal("50.00"),
            reason="Test refund",
            status="pending",
            reviewed_by=None,
            reviewed_at=None,
            rejection_reason=None,
            created_by=STUB_USER_ID,
            updated_by=None,
            created_at=now,
            updated_at=now,
            version=1,
            doc_version=1,
        )
        defaults.update(kwargs)
        return Refund(**defaults)

    @classmethod
    def create(cls, db: Session, payment_id: uuid.UUID, **kwargs) -> Refund:
        obj = cls.build(payment_id=payment_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class CreditNoteFactory:
    _counter = 0

    @classmethod
    def _next_number(cls) -> str:
        cls._counter += 1
        return f"CN-TEST-{cls._counter:06d}"

    @classmethod
    def build(cls, invoice_id: uuid.UUID, patient_id: uuid.UUID, **kwargs) -> CreditNote:
        now = datetime.now(timezone.utc)
        defaults = dict(
            id=uuid.uuid4(),
            invoice_id=invoice_id,
            patient_id=patient_id,
            credit_note_number=cls._next_number(),
            issue_date=None,
            amount=Decimal("50.00"),
            remaining_balance=Decimal("50.00"),
            reason="Test credit note",
            status="draft",
            expiry_date=None,
            void_reason=None,
            created_by=STUB_USER_ID,
            updated_by=None,
            created_at=now,
            updated_at=now,
            version=1,
            doc_version=1,
        )
        defaults.update(kwargs)
        return CreditNote(**defaults)

    @classmethod
    def create(cls, db: Session, invoice_id: uuid.UUID, patient_id: uuid.UUID, **kwargs) -> CreditNote:
        obj = cls.build(invoice_id=invoice_id, patient_id=patient_id, **kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


class AuditLogFactory:
    @classmethod
    def build(cls, **kwargs) -> BillingAuditLog:
        defaults = dict(
            id=uuid.uuid4(),
            entity_type="invoice",
            entity_id=uuid.uuid4(),
            action="created",
            old_value=None,
            new_value=None,
            changed_by=STUB_USER_ID,
            changed_at=datetime.now(timezone.utc),
            reason=None,
        )
        defaults.update(kwargs)
        return BillingAuditLog(**defaults)

    @classmethod
    def create(cls, db: Session, **kwargs) -> BillingAuditLog:
        obj = cls.build(**kwargs)
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return obj


# ---------------------------------------------------------------------------
# Entity fixtures
# ---------------------------------------------------------------------------
@pytest.fixture()
def invoice(db) -> Invoice:
    return InvoiceFactory.create(db)


@pytest.fixture()
def invoice_with_items(db) -> Invoice:
    inv = InvoiceFactory.create(db)
    InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1)
    InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=2)
    db.refresh(inv)
    return inv


@pytest.fixture()
def issued_invoice(db) -> Invoice:
    inv = InvoiceFactory.create(db, status="issued")
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


@pytest.fixture()
def payment(db) -> Payment:
    return PaymentFactory.create(db)


@pytest.fixture()
def completed_payment(db) -> Payment:
    return PaymentFactory.create(db, status="completed")


@pytest.fixture()
def receipt(db, completed_payment) -> Receipt:
    return ReceiptFactory.create(db, payment_id=completed_payment.id,
                                 amount=completed_payment.total_amount)


# ---------------------------------------------------------------------------
# Raw DB access — for PostgreSQL-specific queries
# ---------------------------------------------------------------------------
@pytest.fixture()
def raw_conn(pg_engine):
    """Provide a raw psycopg2 connection for PostgreSQL-specific tests."""
    conn = pg_engine.raw_connection()
    yield conn
    conn.close()
