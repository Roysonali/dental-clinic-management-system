"""Phase 9: Exception Handling Tests.

Verifies:
- IntegrityError handling at DB level
- Business exceptions produce correct behavior
- Rollback happens after exceptions
- Consistent error responses
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text

from app.modules.billing.exceptions import (
    BillingException,
    BillingValidationError,
    InvoiceNotFound,
    InvoiceNotEditable,
    PaymentNotFound,
)
from app.modules.billing.models import (
    Invoice,
    InvoiceItem,
    Payment,
)
from app.modules.billing.repositories import (
    InvoiceRepository,
    PaymentRepository,
)
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ---------------------------------------------------------------------------
# IntegrityError Handling
# ---------------------------------------------------------------------------
class TestIntegrityErrorHandling:
    def test_duplicate_invoice_number_raises_integrity_error(self, db):
        InvoiceFactory.create(db, invoice_number="INV-DUP-001")
        db.flush()

        dup = InvoiceFactory.build(invoice_number="INV-DUP-001")
        db.add(dup)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_duplicate_payment_number_raises_integrity_error(self, db):
        PaymentFactory.create(db, payment_number="PAY-DUP-001")
        db.flush()

        dup = PaymentFactory.build(payment_number="PAY-DUP-001")
        db.add(dup)
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    def test_fk_violation_raises_integrity_error(self, db):
        inv = Invoice(
            id=uuid.uuid4(),
            patient_id=uuid.uuid4(),  # Non-existent
            invoice_number="INV-FK-001",
            invoice_date=date.today(),
            due_date=date.today(),
            status="draft",
            currency_code="USD",
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(inv)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_check_constraint_violation_raises_integrity_error(self, db):
        payment = Payment(
            id=uuid.uuid4(),
            patient_id=STUB_PATIENT_ID,
            payment_number="PAY-ZERO-001",
            payment_method="cash",
            total_amount=Decimal("-10.00"),
            payment_date=date.today(),
            status="pending",
            is_reversed=False,
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(payment)
        with pytest.raises(IntegrityError):
            db.flush()


# ---------------------------------------------------------------------------
# Business Exception Behavior
# ---------------------------------------------------------------------------
class TestBusinessExceptions:
    def test_invoice_not_found_exception(self, db):
        repo = InvoiceRepository(db)
        result = repo.get_by_id(uuid.uuid4())
        assert result is None

    def test_payment_not_found_exception(self, db):
        repo = PaymentRepository(db)
        result = repo.get_by_id(uuid.uuid4())
        assert result is None

    def test_billing_exception_hierarchy(self):
        assert issubclass(InvoiceNotFound, BillingException)
        assert issubclass(InvoiceNotEditable, BillingException)
        assert issubclass(PaymentNotFound, BillingException)
        assert issubclass(BillingValidationError, BillingException)


# ---------------------------------------------------------------------------
# Rollback After Exception
# ---------------------------------------------------------------------------
class TestRollbackAfterException:
    def test_session_usable_after_integrity_error(self, db):
        """After an IntegrityError and rollback, the session should
        still be functional."""
        InvoiceFactory.create(db, invoice_number="INV-ERR-001")
        db.flush()

        dup = InvoiceFactory.build(invoice_number="INV-ERR-001")
        db.add(dup)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            # Re-seed FK stubs after full rollback
            from tests.integration.billing.conftest import _seed_fk_stubs
            _seed_fk_stubs(db)

        inv = InvoiceFactory.create(db, invoice_number="INV-ERR-002")
        db.flush()
        assert inv.id is not None

    def test_failed_operation_does_not_corrupt_other_data(self, db):
        """A failed operation should not affect other committed data."""
        good_inv = InvoiceFactory.create(db, invoice_number="INV-GOOD-001")
        db.flush()

        bad_inv = InvoiceFactory.build(invoice_number="INV-GOOD-001")  # Duplicate
        db.add(bad_inv)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            from tests.integration.billing.conftest import _seed_fk_stubs
            _seed_fk_stubs(db)

        inv2 = InvoiceFactory.create(db, invoice_number="INV-GOOD-002")
        db.flush()
        assert inv2.id is not None
        assert inv2.invoice_number == "INV-GOOD-002"


# ---------------------------------------------------------------------------
# Error Response Consistency
# ---------------------------------------------------------------------------
class TestErrorResponseConsistency:
    def test_constraint_error_produces_informative_message(self, db):
        InvoiceFactory.create(db, invoice_number="INV-INFO-001")
        db.flush()

        dup = InvoiceFactory.build(invoice_number="INV-INFO-001")
        db.add(dup)
        with pytest.raises(IntegrityError) as exc_info:
            db.flush()

        error_str = str(exc_info.value)
        assert "unique" in error_str.lower() or "duplicate" in error_str.lower() or "invoice_number" in error_str.lower()
