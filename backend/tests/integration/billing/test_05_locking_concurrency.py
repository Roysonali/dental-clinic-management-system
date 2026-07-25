"""Phase 5: Locking & Concurrency Tests.

Validates that SELECT FOR UPDATE and concurrent operations cannot
corrupt financial data. Uses real PostgreSQL sessions with concurrent
threads.

Critical scenarios:
- Concurrent document sequence generation
- Concurrent payment allocation to same invoice
- Concurrent refund creation
- Row locking prevents double-spending
"""

from __future__ import annotations

import threading
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.modules.billing.models import (
    PaymentAllocation,
    Refund,
)
from app.modules.billing.repositories import (
    DocumentSequenceRepository,
    InvoiceRepository,
    PaymentRepository,
    RefundRepository,
)
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    RefundFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
    PG_URL,
)

pytestmark = pytest.mark.postgres


def _commit_via_engine(pg_engine, sql, params=None):
    """Execute a SQL statement in a committed transaction via raw engine."""
    with pg_engine.begin() as conn:
        conn.execute(text(sql), params or {})


def _setup_invoice_committed(pg_engine, inv_id, inv_number):
    """Insert a committed invoice via raw SQL."""
    _commit_via_engine(pg_engine,
        "INSERT INTO invoices (id, patient_id, treatment_plan_id, appointment_id, "
        "doctor_id, invoice_number, invoice_date, due_date, status, currency_code, "
        "created_by, created_at, updated_at, version, doc_version) "
        "VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), NULL, NULL, NULL, :num, "
        "CURRENT_DATE, CURRENT_DATE, 'issued', 'USD', 1, NOW(), NOW(), 1, 1) "
        "ON CONFLICT (id) DO NOTHING",
        {"id": str(inv_id), "pid": str(STUB_PATIENT_ID), "num": inv_number}
    )


def _setup_payment_committed(pg_engine, pay_id, pay_number, amount):
    """Insert a committed payment via raw SQL."""
    _commit_via_engine(pg_engine,
        "INSERT INTO payments (id, patient_id, payment_number, payment_method, "
        "total_amount, payment_date, status, is_reversed, created_by, created_at, "
        "updated_at, version, doc_version) "
        "VALUES (CAST(:id AS UUID), CAST(:pid AS UUID), :num, 'cash', :amt, "
        "CURRENT_DATE, 'completed', FALSE, 1, NOW(), NOW(), 1, 1) "
        "ON CONFLICT (id) DO NOTHING",
        {"id": str(pay_id), "pid": str(STUB_PATIENT_ID), "num": pay_number, "amt": str(amount)}
    )


def _setup_line_item_committed(pg_engine, inv_id):
    """Insert a committed invoice line item via raw SQL."""
    _commit_via_engine(pg_engine,
        "INSERT INTO invoice_line_items (id, invoice_id, sequence_number, description, "
        "quantity, unit_price, net_amount, created_by, version, doc_version) "
        "VALUES (CAST(:id AS UUID), CAST(:iid AS UUID), 1, 'Item', 1, 200.00, 200.00, 1, 1, 1) "
        "ON CONFLICT (id) DO NOTHING",
        {"id": str(uuid.uuid4()), "iid": str(inv_id)}
    )


# ---------------------------------------------------------------------------
# Concurrent Document Sequence Generation
# ---------------------------------------------------------------------------
class TestConcurrentDocumentSequence:
    def test_concurrent_increments_produce_unique_values(self, db, pg_engine):
        """Verify that concurrent calls to increment() never produce
        duplicate sequence numbers."""
        NUM_THREADS = 10
        results = []
        errors = []

        session_factory = sessionmaker(bind=pg_engine)

        def increment_sequence():
            try:
                session = session_factory()
                try:
                    repo = DocumentSequenceRepository(session)
                    result = repo.increment("invoice")
                    if result is not None:
                        results.append(result.current_value)
                    session.commit()
                except Exception as e:
                    session.rollback()
                    errors.append(e)
                finally:
                    session.close()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=increment_sequence) for _ in range(NUM_THREADS)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert len(errors) == 0, f"Errors during concurrent increment: {errors}"
        assert len(results) == NUM_THREADS
        assert len(set(results)) == NUM_THREADS, (
            f"Duplicate sequence values detected: {sorted(results)}"
        )

    def test_concurrent_increments_sequential_order(self, db, pg_engine):
        """Verify that the final current_value equals the number of increments."""
        NUM_THREADS = 15
        errors = []

        session_factory = sessionmaker(bind=pg_engine)

        def increment_sequence():
            try:
                session = session_factory()
                try:
                    repo = DocumentSequenceRepository(session)
                    repo.increment("payment")
                    session.commit()
                except Exception as e:
                    session.rollback()
                    errors.append(e)
                finally:
                    session.close()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=increment_sequence) for _ in range(NUM_THREADS)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert len(errors) == 0, f"Errors during concurrent increment: {errors}"

        with pg_engine.connect() as conn:
            result = conn.execute(
                text("SELECT current_value FROM document_sequences WHERE document_type = 'payment'")
            )
            final_value = result.scalar()
            assert final_value == NUM_THREADS


# ---------------------------------------------------------------------------
# Concurrent Payment Allocation
# ---------------------------------------------------------------------------
class TestConcurrentPaymentAllocation:
    def test_concurrent_allocation_to_different_invoices_succeeds(self, db, pg_engine):
        """Allocating the same payment to different invoices concurrently
        should succeed without conflicts."""
        inv1_id = uuid.uuid4()
        inv2_id = uuid.uuid4()
        payment_id = uuid.uuid4()

        _setup_invoice_committed(pg_engine, inv1_id, f"INV-CONC-{str(inv1_id)[:8]}")
        _setup_invoice_committed(pg_engine, inv2_id, f"INV-CONC-{str(inv2_id)[:8]}")
        _setup_payment_committed(pg_engine, payment_id, f"PAY-CONC-{str(payment_id)[:8]}", Decimal("400.00"))
        _setup_line_item_committed(pg_engine, inv1_id)
        _setup_line_item_committed(pg_engine, inv2_id)

        errors = []
        session_factory = sessionmaker(bind=pg_engine)

        def allocate_to_invoice(invoice_id, amount):
            try:
                session = session_factory()
                try:
                    alloc = PaymentAllocation(
                        id=uuid.uuid4(),
                        payment_id=payment_id,
                        invoice_id=invoice_id,
                        allocated_amount=amount,
                        is_refund=False,
                        refund_reason=None,
                        original_allocation_id=None,
                        created_by=STUB_USER_ID,
                    )
                    session.add(alloc)
                    session.commit()
                except Exception as e:
                    session.rollback()
                    errors.append(e)
                finally:
                    session.close()
            except Exception as e:
                errors.append(e)

        t1 = threading.Thread(target=allocate_to_invoice, args=(inv1_id, Decimal("200.00")))
        t2 = threading.Thread(target=allocate_to_invoice, args=(inv2_id, Decimal("200.00")))
        t1.start()
        t2.start()
        t1.join(timeout=10)
        t2.join(timeout=10)

        assert len(errors) == 0, f"Concurrent allocation errors: {errors}"

        with pg_engine.connect() as conn:
            result = conn.execute(
                text("SELECT COUNT(*) FROM payment_allocations "
                     "WHERE payment_id = CAST(:pid AS UUID) AND is_refund = FALSE"),
                {"pid": str(payment_id)},
            )
            count = result.scalar()
            assert count == 2

    def test_duplicate_concurrent_allocation_to_same_invoice_fails(self, db, pg_engine):
        """Two concurrent allocations of the same payment to the SAME invoice
        should result in one success and one failure due to the partial index."""
        inv_id = uuid.uuid4()
        payment_id = uuid.uuid4()

        _setup_invoice_committed(pg_engine, inv_id, f"INV-DUP-{str(inv_id)[:8]}")
        _setup_payment_committed(pg_engine, payment_id, f"PAY-DUP-{str(payment_id)[:8]}", Decimal("500.00"))
        _setup_line_item_committed(pg_engine, inv_id)

        success_count = []
        error_count = []
        lock = threading.Lock()

        session_factory = sessionmaker(bind=pg_engine)

        def allocate():
            try:
                session = session_factory()
                try:
                    alloc = PaymentAllocation(
                        id=uuid.uuid4(),
                        payment_id=payment_id,
                        invoice_id=inv_id,
                        allocated_amount=Decimal("100.00"),
                        is_refund=False,
                        refund_reason=None,
                        original_allocation_id=None,
                        created_by=STUB_USER_ID,
                    )
                    session.add(alloc)
                    session.commit()
                    with lock:
                        success_count.append(1)
                except Exception:
                    session.rollback()
                    with lock:
                        error_count.append(1)
                finally:
                    session.close()
            except Exception:
                with lock:
                    error_count.append(1)

        threads = [threading.Thread(target=allocate) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert len(success_count) == 1, (
            f"Expected exactly 1 success, got {len(success_count)}"
        )
        assert len(error_count) == 4, (
            f"Expected exactly 4 failures, got {len(error_count)}"
        )


# ---------------------------------------------------------------------------
# Concurrent Refund Creation
# ---------------------------------------------------------------------------
class TestConcurrentRefundCreation:
    def test_concurrent_refund_creation_succeeds(self, db, pg_engine):
        """Creating multiple refunds for the same payment concurrently
        should succeed (no partial index on refunds)."""
        payment_id = uuid.uuid4()
        _setup_payment_committed(pg_engine, payment_id, f"PAY-REF-{str(payment_id)[:8]}", Decimal("1000.00"))

        NUM_THREADS = 5
        errors = []
        session_factory = sessionmaker(bind=pg_engine)

        def create_refund(idx):
            try:
                session = session_factory()
                try:
                    refund = Refund(
                        id=uuid.uuid4(),
                        payment_id=payment_id,
                        refund_number=f"RFD-CONC-{idx:06d}",
                        amount=Decimal("50.00"),
                        reason=f"Refund {idx}",
                        status="pending",
                        created_by=STUB_USER_ID,
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                        version=1,
                        doc_version=1,
                    )
                    session.add(refund)
                    session.commit()
                except Exception as e:
                    session.rollback()
                    errors.append(e)
                finally:
                    session.close()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=create_refund, args=(i,)) for i in range(NUM_THREADS)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert len(errors) == 0, f"Concurrent refund errors: {errors}"

        with pg_engine.connect() as conn:
            result = conn.execute(
                text("SELECT COUNT(*) FROM refunds WHERE payment_id = CAST(:pid AS UUID)"),
                {"pid": str(payment_id)},
            )
            count = result.scalar()
            assert count == NUM_THREADS


# ---------------------------------------------------------------------------
# Row-Level Locking (SELECT FOR UPDATE)
# ---------------------------------------------------------------------------
class TestRowLevelLocking:
    def test_get_for_update_returns_locked_row(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        locked = repo.get_for_update(inv.id)
        assert locked is not None
        assert locked.id == inv.id

    def test_get_for_update_none_on_missing(self, db):
        repo = InvoiceRepository(db)
        result = repo.get_for_update(uuid.uuid4())
        assert result is None

    def test_payment_get_for_update(self, db):
        payment = PaymentFactory.create(db)
        repo = PaymentRepository(db)
        locked = repo.get_for_update(payment.id)
        assert locked is not None
        assert locked.id == payment.id

    def test_refund_get_for_update(self, db):
        payment = PaymentFactory.create(db, status="completed")
        refund = RefundFactory.create(db, payment_id=payment.id)
        repo = RefundRepository(db)
        locked = repo.get_for_update(refund.id)
        assert locked is not None
        assert locked.id == refund.id
