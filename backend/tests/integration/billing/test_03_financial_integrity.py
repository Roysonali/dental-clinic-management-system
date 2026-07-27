"""Phase 3: Financial Integrity Validation Tests.

Validates that critical financial queries return correct results
against real PostgreSQL. No mocks. Verifies actual persisted data
through repository methods and raw SQL.

Focus areas:
- InvoiceRepository: aggregates, sums, paid/refunded/allocation totals
- PaymentRepository: totals, allocation sums
- RefundRepository: completed/outstanding refund totals
- CreditNoteRepository: remaining balance tracking
- DocumentSequenceRepository: sequence generation, overflow handling
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

import pytest
from sqlalchemy import text

from app.modules.billing.constants import ZERO_MONEY
from app.modules.billing.enums import (
    InvoiceStatus,
    PaymentStatus,
    RefundStatus,
    CreditNoteStatus,
)
from app.modules.billing.models import (
    CreditNote,
    Invoice,
    InvoiceItem,
    Payment,
    PaymentAllocation,
    Refund,
)
from app.modules.billing.repositories import (
    InvoiceRepository,
    PaymentRepository,
    RefundRepository,
    CreditNoteRepository,
    DocumentSequenceRepository,
    AuditRepository,
)
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    RefundFactory,
    CreditNoteFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ---------------------------------------------------------------------------
# Invoice Aggregates
# ---------------------------------------------------------------------------
class TestInvoiceAggregates:
    def test_get_invoice_aggregates_no_items(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        repo = InvoiceRepository(db)
        result = repo.get_invoice_aggregates()
        assert "total_grand_total" in result
        assert "total_paid" in result
        assert "outstanding_count" in result

    def test_get_invoice_grand_total_single_item(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("250.00"), net_amount=Decimal("250.00"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("250.00")

    def test_get_invoice_grand_total_multiple_items(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=2,
            unit_price=Decimal("200.00"), net_amount=Decimal("200.00"),
        )
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=3,
            unit_price=Decimal("50.75"), net_amount=Decimal("50.75"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("350.75")

    def test_get_total_allocated_zero_when_no_allocations(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        allocated = repo.get_total_allocated_for_invoice(inv.id)
        assert allocated == ZERO_MONEY

    def test_get_total_allocated_with_allocations(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("200.00"), net_amount=Decimal("200.00"),
        )
        db.flush()

        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("150.00"),
        )
        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("150.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        repo = InvoiceRepository(db)
        allocated = repo.get_total_allocated_for_invoice(inv.id)
        assert allocated == Decimal("150.00")

    def test_get_total_refunded_for_invoice(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("200.00"), net_amount=Decimal("200.00"),
        )
        db.flush()

        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("200.00"))

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        refund_alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Test refund",
            original_allocation_id=alloc.id,
            created_by=STUB_USER_ID,
        )
        db.add(refund_alloc)
        db.flush()

        repo = InvoiceRepository(db)
        refunded = repo.get_total_refunded_for_invoice(inv.id)
        assert refunded == Decimal("50.00")

    def test_count_grouped_by_status(self, db):
        InvoiceFactory.create(db, status="draft")
        InvoiceFactory.create(db, status="draft")
        InvoiceFactory.create(db, status="issued")
        db.flush()

        repo = InvoiceRepository(db)
        grouped = repo.count_grouped_by_status()
        assert grouped["draft"] == 2
        assert grouped["issued"] == 1

    def test_monetary_precision_preserved(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("99.99"),
            net_amount=Decimal("99.99"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("99.99")
        assert isinstance(total, Decimal)


# ---------------------------------------------------------------------------
# Payment Aggregates
# ---------------------------------------------------------------------------
class TestPaymentAggregates:
    def test_get_payment_totals_empty(self, db):
        repo = PaymentRepository(db)
        totals = repo.get_payment_totals()
        assert totals["total_amount"] == ZERO_MONEY
        assert totals["payment_count"] == 0

    def test_get_payment_totals_with_payments(self, db):
        PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))
        PaymentFactory.create(db, status="completed", total_amount=Decimal("250.75"))
        db.flush()

        repo = PaymentRepository(db)
        totals = repo.get_payment_totals()
        assert totals["total_amount"] == Decimal("350.75")
        assert totals["payment_count"] == 2

    def test_get_payment_totals_with_patient_filter(self, db):
        PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"),
                              patient_id=STUB_PATIENT_ID)
        other_patient = uuid.uuid4()
        db.flush()
        # Insert the other patient so FK is satisfied
        from sqlalchemy import text as sa_text
        db.execute(sa_text(
            "INSERT INTO patients (id, patient_code, first_name, last_name, "
            "date_of_birth, gender, primary_contact_number, is_active) "
            "VALUES (:id, :code, 'O', 'P', '2000-01-01', 'male', '+0000000000', TRUE)"
        ), {"id": str(other_patient), "code": f"P-{str(other_patient)[:8]}"})
        db.flush()

        PaymentFactory.create(db, status="completed", total_amount=Decimal("200.00"),
                              patient_id=other_patient)
        db.flush()

        repo = PaymentRepository(db)
        totals = repo.get_payment_totals(patient_id=STUB_PATIENT_ID)
        assert totals["total_amount"] == Decimal("100.00")
        assert totals["payment_count"] == 1

    def test_get_total_allocated_for_payment(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("300.00"), net_amount=Decimal("300.00"),
        )
        db.flush()

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("300.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        repo = PaymentRepository(db)
        allocated = repo.get_total_allocated_for_payment(payment.id)
        assert allocated == Decimal("300.00")

    def test_count_grouped_by_status(self, db):
        PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))
        PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))
        PaymentFactory.create(db, status="pending", total_amount=Decimal("100.00"))
        db.flush()

        repo = PaymentRepository(db)
        grouped = repo.count_grouped_by_status()
        assert grouped["completed"] == 2
        assert grouped["pending"] == 1


# ---------------------------------------------------------------------------
# Refund Aggregates
# ---------------------------------------------------------------------------
class TestRefundAggregates:
    def test_get_completed_refund_total_none(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        db.flush()

        repo = RefundRepository(db)
        total = repo.get_completed_refund_total(payment.id)
        assert total == ZERO_MONEY

    def test_get_completed_refund_total(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("100.00"),
                             status="completed")
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("50.00"),
                             status="completed")
        db.flush()

        repo = RefundRepository(db)
        total = repo.get_completed_refund_total(payment.id)
        assert total == Decimal("150.00")

    def test_get_completed_refund_excludes_non_completed(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("100.00"),
                             status="pending")
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("50.00"),
                             status="rejected", rejection_reason="No",
                             reviewed_by=STUB_USER_ID,
                             reviewed_at=datetime.now(timezone.utc))
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("75.00"),
                             status="completed")
        db.flush()

        repo = RefundRepository(db)
        total = repo.get_completed_refund_total(payment.id)
        assert total == Decimal("75.00")

    def test_get_outstanding_refund_total_includes_pending(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("100.00"),
                             status="pending")
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("50.00"),
                             status="approved")
        db.flush()

        repo = RefundRepository(db)
        total = repo.get_outstanding_refund_total(payment.id)
        assert total == Decimal("150.00")

    def test_get_outstanding_refund_excludes_rejected(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("100.00"),
                             status="completed")
        RefundFactory.create(db, payment_id=payment.id, amount=Decimal("200.00"),
                             status="rejected", rejection_reason="No",
                             reviewed_by=STUB_USER_ID,
                             reviewed_at=datetime.now(timezone.utc))
        db.flush()

        repo = RefundRepository(db)
        total = repo.get_outstanding_refund_total(payment.id)
        assert total == Decimal("100.00")


# ---------------------------------------------------------------------------
# Credit Note Totals
# ---------------------------------------------------------------------------
class TestCreditNoteAggregates:
    def test_get_credit_note_totals_empty(self, db):
        repo = CreditNoteRepository(db)
        totals = repo.get_credit_note_totals()
        assert totals["credit_note_count"] == 0
        assert totals["total_amount"] == ZERO_MONEY

    def test_get_credit_note_totals_with_records(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("500.00"), net_amount=Decimal("500.00"),
        )
        db.flush()

        CreditNoteFactory.create(
            db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"), remaining_balance=Decimal("50.00"),
        )
        CreditNoteFactory.create(
            db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID,
            amount=Decimal("200.00"), remaining_balance=Decimal("200.00"),
        )
        db.flush()

        repo = CreditNoteRepository(db)
        totals = repo.get_credit_note_totals()
        assert totals["credit_note_count"] == 2
        assert totals["total_amount"] == Decimal("300.00")
        assert totals["total_remaining"] == Decimal("250.00")

    def test_get_credit_note_totals_with_patient_filter(self, db):
        from sqlalchemy import text as sa_text
        other_patient = uuid.uuid4()
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("500.00"), net_amount=Decimal("500.00"),
        )
        db.flush()

        db.execute(sa_text(
            "INSERT INTO patients (id, patient_code, first_name, last_name, "
            "date_of_birth, gender, primary_contact_number, is_active) "
            "VALUES (:id, :code, 'O', 'P', '2000-01-01', 'male', '+0000000000', TRUE)"
        ), {"id": str(other_patient), "code": f"P-{str(other_patient)[:8]}"})
        db.flush()

        CreditNoteFactory.create(
            db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"), remaining_balance=Decimal("100.00"),
        )
        CreditNoteFactory.create(
            db, invoice_id=inv.id, patient_id=other_patient,
            amount=Decimal("200.00"), remaining_balance=Decimal("200.00"),
        )
        db.flush()

        repo = CreditNoteRepository(db)
        totals = repo.get_credit_note_totals(patient_id=STUB_PATIENT_ID)
        assert totals["credit_note_count"] == 1
        assert totals["total_amount"] == Decimal("100.00")

    def test_remaining_balance_constraint(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        cn = CreditNoteFactory.create(
            db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"), remaining_balance=Decimal("100.00"),
        )

        from sqlalchemy.exc import IntegrityError
        cn.remaining_balance = Decimal("150.00")
        with pytest.raises(IntegrityError):
            db.flush()


# ---------------------------------------------------------------------------
# Document Sequence
# ---------------------------------------------------------------------------
class TestDocumentSequence:
    def test_increment_returns_next_value(self, db):
        repo = DocumentSequenceRepository(db)
        result = repo.increment("invoice")
        assert result is not None
        assert result.current_value == 1

    def test_increment_multiple_returns_sequential(self, db):
        repo = DocumentSequenceRepository(db)
        repo.increment("invoice")
        repo.increment("invoice")
        repo.increment("invoice")
        result = repo.get_by_document_type("invoice")
        assert result.current_value == 3

    def test_increment_preserves_precision(self, db):
        repo = DocumentSequenceRepository(db)
        for _ in range(10):
            repo.increment("payment")
        result = repo.get_by_document_type("payment")
        assert result.current_value == 10

    def test_increment_overflow_raises(self, db):
        repo = DocumentSequenceRepository(db)
        seq = repo.get_by_document_type("invoice")
        seq.current_value = seq.max_value if hasattr(seq, 'max_value') else 99999
        db.flush()
        from app.modules.billing.exceptions import BillingValidationError
        with pytest.raises(BillingValidationError):
            repo.increment("invoice")

    def test_get_recent_consumption_logs(self, db):
        from app.modules.billing.models import SequenceConsumptionLog
        repo = DocumentSequenceRepository(db)
        repo.increment("invoice")
        repo.increment("invoice")

        log = SequenceConsumptionLog(
            id=uuid.uuid4(),
            document_type="invoice",
            number_assigned=1,
            reserved_at=datetime.now(timezone.utc),
            reserved_by=STUB_USER_ID,
            document_id=uuid.uuid4(),
            status="completed",
        )
        db.add(log)
        db.flush()

        logs = repo.get_recent_consumption_logs("invoice")
        assert len(logs) >= 1


# ---------------------------------------------------------------------------
# Raw SQL Financial Verification
# ---------------------------------------------------------------------------
class TestRawSQLFinancialVerification:
    """Cross-check repository results against raw SQL queries."""

    def test_raw_sql_grand_total_matches_repository(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("123.45"), net_amount=Decimal("123.45"),
        )
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=2,
            unit_price=Decimal("67.89"), net_amount=Decimal("67.89"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        repo_total = repo.get_invoice_grand_total(inv.id)

        result = db.execute(
            text("SELECT SUM(net_amount) FROM invoice_line_items "
                 "WHERE invoice_id = :iid"),
            {"iid": str(inv.id)},
        )
        raw_total = result.scalar()

        assert repo_total == raw_total
        assert repo_total == Decimal("191.34")

    def test_raw_sql_allocation_total_matches_repository(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("500.00"), net_amount=Decimal("500.00"),
        )
        db.flush()

        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))
        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("300.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        repo = InvoiceRepository(db)
        repo_allocated = repo.get_total_allocated_for_invoice(inv.id)

        result = db.execute(
            text("SELECT COALESCE(SUM(allocated_amount), 0) "
                 "FROM payment_allocations "
                 "WHERE invoice_id = :iid AND is_refund = FALSE"),
            {"iid": str(inv.id)},
        )
        raw_allocated = result.scalar()

        assert repo_allocated == Decimal(str(raw_allocated))
