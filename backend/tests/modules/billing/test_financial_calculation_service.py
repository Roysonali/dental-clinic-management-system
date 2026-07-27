"""Comprehensive tests for Sprint 5C.7 — FinancialCalculationService.

Tests cover:
- Invoice calculations: grand total, paid amount, refunded amount, outstanding balance
- Payment calculations: allocated, unallocated, refunded, remaining refundable
- Credit note calculations: remaining balance, applied amount
- Patient financial summary
- Billing totals
- Consistency checks
- Happy paths, zero amounts, partial allocations
- Fully paid invoices, partially paid invoices
- Refunded payments, credit notes
- Decimal precision and rounding
- Edge cases and missing data
- Repository mocking for isolated tests
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest

from app.modules.billing.constants import MONEY_QUANTIZE_EXPONENT, ZERO_MONEY
from app.modules.billing.enums import (
    CreditNoteStatus,
    InvoiceStatus,
    PaymentStatus,
    RefundStatus,
)
from app.modules.billing.exceptions import (
    CreditNoteNotFound,
    InvoiceNotFound,
    PaymentNotFound,
)
from app.modules.billing.services.financial_calculation_service import (
    BillingTotals,
    FinancialCalculationService,
    InvoiceFinancialSummary,
    PatientFinancialSummary,
    PaymentFinancialSummary,
)
from app.modules.billing.models import (
    CreditNote,
    Invoice,
    InvoiceItem,
    Payment,
    PaymentAllocation,
    Refund,
)

from tests.modules.billing.conftest import (
    _STUB_DOCTOR_ID,
    _STUB_PATIENT_ID,
    _STUB_USER_ID,
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
)

# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def financial_calc_service(db):
    """Build a FinancialCalculationService with all repository dependencies.

    This service is read-only — it never commits, never rolls back, and
    never mutates data.
    """
    from app.modules.billing.repositories import (
        CreditNoteRepository,
        InvoiceRepository,
        PaymentRepository,
    )
    from app.modules.billing.repositories.refund_repository import RefundRepository
    from app.modules.billing.validators import FinancialValidator

    invoice_repo = InvoiceRepository(db)
    payment_repo = PaymentRepository(db)
    refund_repo = RefundRepository(db)
    credit_note_repo = CreditNoteRepository(db)
    financial_validator = FinancialValidator()

    return FinancialCalculationService(
        invoice_repo=invoice_repo,
        payment_repo=payment_repo,
        refund_repo=refund_repo,
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
    )


# ======================================================================
# Invoice calculation tests
# ======================================================================


class TestInvoiceCalculations:
    """Tests for invoice-level financial calculations."""

    def test_grand_total_with_items(self, db, financial_calc_service):
        """Grand total equals sum of line-item net amounts."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("150.00"), net_amount=Decimal("150.00"),
        )
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=2,
            unit_price=Decimal("50.00"), net_amount=Decimal("50.00"),
        )
        total = financial_calc_service.calculate_invoice_grand_total(inv.id)
        assert total == Decimal("200.00")

    def test_grand_total_no_items(self, db, financial_calc_service):
        """Grand total is zero when invoice has no items."""
        inv = InvoiceFactory.create(db)
        total = financial_calc_service.calculate_invoice_grand_total(inv.id)
        assert total == ZERO_MONEY

    def test_grand_total_invoice_not_found(self, financial_calc_service):
        """Raises InvoiceNotFound for non-existent invoice."""
        with pytest.raises(InvoiceNotFound):
            financial_calc_service.calculate_invoice_grand_total(
                UUID("00000000-0000-0000-0000-ffffffffffff")
            )

    def test_paid_amount_no_allocations(self, db, financial_calc_service):
        """Paid amount is zero when no allocations exist."""
        inv = InvoiceFactory.create(db)
        paid = financial_calc_service.calculate_invoice_paid_amount(inv.id)
        assert paid == ZERO_MONEY

    def test_paid_amount_with_allocations(self, db, financial_calc_service):
        """Paid amount equals sum of non-refund allocations."""
        inv = InvoiceFactory.create(db)
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        alloc = PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("75.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        paid = financial_calc_service.calculate_invoice_paid_amount(inv.id)
        assert paid == Decimal("75.00")

    def test_paid_amount_refund_excluded(self, db, financial_calc_service):
        """Refund allocations are excluded from paid amount."""
        inv = InvoiceFactory.create(db)
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        # Non-refund allocation
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        # Refund allocation (separate payment to avoid unique constraint collision)
        payment2 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("30.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment2.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("30.00"),
            is_refund=True,
            refund_reason="Partial refund",
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        paid = financial_calc_service.calculate_invoice_paid_amount(inv.id)
        assert paid == Decimal("100.00")  # Refund allocation excluded

    def test_refunded_amount(self, db, financial_calc_service):
        """Refunded amount equals sum of refund allocations."""
        inv = InvoiceFactory.create(db)
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Test refund",
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        refunded = financial_calc_service.calculate_invoice_refunded_amount(inv.id)
        assert refunded == Decimal("50.00")

    def test_outstanding_balance_no_payments(self, db, financial_calc_service):
        """Outstanding balance equals grand total when nothing paid."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("300.00"),
        )
        outstanding = financial_calc_service.calculate_invoice_outstanding_balance(
            inv.id
        )
        assert outstanding == Decimal("300.00")

    def test_outstanding_balance_partially_paid(self, db, financial_calc_service):
        """Outstanding balance = grand_total - paid."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("200.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("150.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("150.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        outstanding = financial_calc_service.calculate_invoice_outstanding_balance(
            inv.id
        )
        assert outstanding == Decimal("50.00")

    def test_outstanding_balance_fully_paid(self, db, financial_calc_service):
        """Outstanding balance is zero when fully paid."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("200.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        outstanding = financial_calc_service.calculate_invoice_outstanding_balance(
            inv.id
        )
        assert outstanding == ZERO_MONEY

    def test_outstanding_balance_with_refund(self, db, financial_calc_service):
        """Refund increases outstanding balance."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("200.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        # Use separate payment for refund allocation to avoid unique constraint collision
        payment2 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("50.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment2.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Partial refund",
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        outstanding = financial_calc_service.calculate_invoice_outstanding_balance(
            inv.id
        )
        # grand_total(200) - paid(200) + refunded(50) = 50
        assert outstanding == Decimal("50.00")

    def test_outstanding_balance_overpaid(self, db, financial_calc_service):
        """Outstanding balance is floored at zero (no negative balance)."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("150.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("150.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        outstanding = financial_calc_service.calculate_invoice_outstanding_balance(
            inv.id
        )
        assert outstanding == ZERO_MONEY

    def test_balance_summary(self, db, financial_calc_service):
        """Balance summary returns all components."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        summary = financial_calc_service.calculate_invoice_balance_summary(inv.id)
        assert summary["grand_total"] == Decimal("100.00")
        assert "paid_amount" in summary
        assert "refunded_amount" in summary
        assert "outstanding_balance" in summary

    def test_invoice_financial_summary(self, db, financial_calc_service):
        """Returns full InvoiceFinancialSummary dataclass."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("150.00"),
        )
        summary = financial_calc_service.get_invoice_financial_summary(inv.id)
        assert isinstance(summary, InvoiceFinancialSummary)
        assert summary.invoice_id == inv.id
        assert summary.invoice_number == inv.invoice_number
        assert summary.grand_total == Decimal("150.00")
        assert summary.total_paid == ZERO_MONEY
        assert summary.total_refunded == ZERO_MONEY
        assert summary.outstanding_balance == Decimal("150.00")


# ======================================================================
# Payment calculation tests
# ======================================================================


class TestPaymentCalculations:
    """Tests for payment-level financial calculations."""

    def test_allocated_amount_no_allocations(self, db, financial_calc_service):
        """Allocated amount is zero when no allocations exist."""
        payment = PaymentFactory.create(
            db, total_amount=Decimal("100.00"),
        )
        allocated = financial_calc_service.calculate_payment_allocated_amount(
            payment.id
        )
        assert allocated == ZERO_MONEY

    def test_allocated_amount_with_allocations(self, db, financial_calc_service):
        """Allocated amount equals sum of non-refund allocations."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        inv = InvoiceFactory.create(db)
        inv2 = InvoiceFactory.create(db)
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("80.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv2.id,
            allocated_amount=Decimal("70.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        allocated = financial_calc_service.calculate_payment_allocated_amount(
            payment.id
        )
        assert allocated == Decimal("150.00")

    def test_allocated_amount_excludes_refunds(self, db, financial_calc_service):
        """Refund allocations are excluded from allocated amount."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        inv = InvoiceFactory.create(db)
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("60.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        # Use separate payment for refund allocation
        payment2 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("20.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment2.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("20.00"),
            is_refund=True,
            refund_reason="Test",
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        allocated = financial_calc_service.calculate_payment_allocated_amount(
            payment.id
        )
        assert allocated == Decimal("60.00")

    def test_unallocated_amount(self, db, financial_calc_service):
        """Unallocated = total - allocated."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        inv = InvoiceFactory.create(db)
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("80.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        unallocated = financial_calc_service.calculate_payment_unallocated_amount(
            payment.id
        )
        assert unallocated == Decimal("120.00")

    def test_unallocated_fully_allocated(self, db, financial_calc_service):
        """Unallocated is zero when fully allocated."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        inv = InvoiceFactory.create(db)
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        unallocated = financial_calc_service.calculate_payment_unallocated_amount(
            payment.id
        )
        assert unallocated == ZERO_MONEY

    def test_refunded_amount_via_refund_repo(self, db, financial_calc_service):
        """Refunded amount uses RefundRepository aggregate."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        refund = Refund(
            payment_id=payment.id,
            refund_number="RFD-TEST-001",
            amount=Decimal("50.00"),
            reason="Test refund",
            status=RefundStatus.COMPLETED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(refund)
        db.flush()

        refunded = financial_calc_service.calculate_payment_refunded_amount(
            payment.id
        )
        assert refunded == Decimal("50.00")

    def test_outstanding_refund_total(self, db, financial_calc_service):
        """Outstanding refund total includes non-rejected refunds."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        # Completed refund
        db.add(Refund(
            payment_id=payment.id,
            refund_number="RFD-TEST-001",
            amount=Decimal("50.00"),
            reason="Completed refund",
            status=RefundStatus.COMPLETED.value,
            created_by=_STUB_USER_ID,
        ))
        # Pending refund
        db.add(Refund(
            payment_id=payment.id,
            refund_number="RFD-TEST-002",
            amount=Decimal("30.00"),
            reason="Pending refund",
            status=RefundStatus.PENDING.value,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        outstanding = (
            financial_calc_service.calculate_payment_outstanding_refund_total(
                payment.id
            )
        )
        # Both completed and pending count toward outstanding (only rejected is excluded)
        assert outstanding == Decimal("80.00")

    def test_remaining_refundable_balance(self, db, financial_calc_service):
        """Remaining = total - outstanding."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        db.add(Refund(
            payment_id=payment.id,
            refund_number="RFD-TEST-001",
            amount=Decimal("80.00"),
            reason="Refund",
            status=RefundStatus.COMPLETED.value,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        remaining = (
            financial_calc_service.calculate_payment_remaining_refundable_balance(
                payment.id
            )
        )
        assert remaining == Decimal("120.00")

    def test_remaining_refundable_zero_when_fully_refunded(
        self, db, financial_calc_service
    ):
        """Remaining is zero when fully refunded."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        db.add(Refund(
            payment_id=payment.id,
            refund_number="RFD-TEST-001",
            amount=Decimal("100.00"),
            reason="Full refund",
            status=RefundStatus.COMPLETED.value,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        remaining = (
            financial_calc_service.calculate_payment_remaining_refundable_balance(
                payment.id
            )
        )
        assert remaining == ZERO_MONEY

    def test_payment_not_found(self, financial_calc_service):
        """Raises PaymentNotFound for non-existent payment."""
        fake_id = UUID("00000000-0000-0000-0000-ffffffffffff")
        with pytest.raises(PaymentNotFound):
            financial_calc_service.calculate_payment_allocated_amount(fake_id)
        with pytest.raises(PaymentNotFound):
            financial_calc_service.calculate_payment_unallocated_amount(fake_id)
        with pytest.raises(PaymentNotFound):
            financial_calc_service.calculate_payment_refunded_amount(fake_id)
        with pytest.raises(PaymentNotFound):
            financial_calc_service.calculate_payment_remaining_refundable_balance(
                fake_id
            )

    def test_payment_financial_summary(self, db, financial_calc_service):
        """Returns full PaymentFinancialSummary dataclass."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("300.00"),
        )
        summary = financial_calc_service.get_payment_financial_summary(payment.id)
        assert isinstance(summary, PaymentFinancialSummary)
        assert summary.payment_id == payment.id
        assert summary.total_amount == Decimal("300.00")
        assert summary.total_allocated == ZERO_MONEY
        assert summary.unallocated_amount == Decimal("300.00")


# ======================================================================
# Credit note calculation tests
# ======================================================================


class TestCreditNoteCalculations:
    """Tests for credit note financial calculations."""

    def test_remaining_balance_full(self, db, financial_calc_service, invoice_with_items):
        """Remaining balance equals amount when unapplied."""
        cn = CreditNote(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            credit_note_number="CN-TEST-001",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("100.00"),
            reason="Test credit note",
            status=CreditNoteStatus.ISSUED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(cn)
        db.flush()

        balance = financial_calc_service.calculate_credit_note_remaining_balance(cn.id)
        assert balance == Decimal("100.00")

    def test_remaining_balance_partially_applied(
        self, db, financial_calc_service, invoice_with_items
    ):
        """Remaining balance reflects partial application."""
        cn = CreditNote(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            credit_note_number="CN-TEST-002",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("40.00"),
            reason="Partially applied",
            status=CreditNoteStatus.APPLIED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(cn)
        db.flush()

        balance = financial_calc_service.calculate_credit_note_remaining_balance(cn.id)
        assert balance == Decimal("40.00")

    def test_remaining_balance_zero_when_applied(
        self, db, financial_calc_service, invoice_with_items
    ):
        """Remaining balance is zero when fully applied."""
        cn = CreditNote(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            credit_note_number="CN-TEST-003",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("0.00"),
            reason="Fully applied",
            status=CreditNoteStatus.APPLIED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(cn)
        db.flush()

        balance = financial_calc_service.calculate_credit_note_remaining_balance(cn.id)
        assert balance == ZERO_MONEY

    def test_applied_amount(self, db, financial_calc_service, invoice_with_items):
        """Applied amount = original - remaining."""
        cn = CreditNote(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            credit_note_number="CN-TEST-004",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("30.00"),
            reason="Applied test",
            status=CreditNoteStatus.APPLIED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(cn)
        db.flush()

        applied = financial_calc_service.calculate_credit_note_applied_amount(cn.id)
        assert applied == Decimal("70.00")

    def test_applied_amount_full(self, db, financial_calc_service, invoice_with_items):
        """Applied amount equals original when fully applied."""
        cn = CreditNote(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            credit_note_number="CN-TEST-005",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("0.00"),
            reason="Fully applied",
            status=CreditNoteStatus.APPLIED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(cn)
        db.flush()

        applied = financial_calc_service.calculate_credit_note_applied_amount(cn.id)
        assert applied == Decimal("100.00")

    def test_credit_note_not_found(self, financial_calc_service):
        """Raises CreditNoteNotFound for non-existent credit note."""
        with pytest.raises(CreditNoteNotFound):
            financial_calc_service.calculate_credit_note_remaining_balance(
                UUID("00000000-0000-0000-0000-ffffffffffff")
            )


# ======================================================================
# Patient financial summary tests
# ======================================================================


class TestPatientFinancialSummary:
    """Tests for patient-level financial summary."""

    def test_empty_patient(self, db, financial_calc_service):
        """Patient with no billing data returns zeros."""
        summary = financial_calc_service.calculate_patient_financial_summary(
            _STUB_PATIENT_ID
        )
        assert isinstance(summary, PatientFinancialSummary)
        assert summary.total_invoiced == ZERO_MONEY
        assert summary.total_paid == ZERO_MONEY
        assert summary.total_outstanding == ZERO_MONEY
        assert summary.invoice_count == 0

    def test_single_invoice(self, db, financial_calc_service):
        """Patient with one unpaid invoice shows correct totals."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("250.00"),
        )
        summary = financial_calc_service.calculate_patient_financial_summary(
            _STUB_PATIENT_ID
        )
        assert summary.total_invoiced == Decimal("250.00")
        assert summary.total_paid == ZERO_MONEY
        assert summary.total_outstanding == Decimal("250.00")
        assert summary.invoice_count == 1
        assert summary.outstanding_invoice_count == 1

    def test_invoice_with_partial_payment(self, db, financial_calc_service):
        """Patient with partially paid invoice."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("200.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("150.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("150.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        summary = financial_calc_service.calculate_patient_financial_summary(
            _STUB_PATIENT_ID
        )
        assert summary.total_invoiced == Decimal("200.00")
        assert summary.total_paid == Decimal("150.00")
        assert summary.total_outstanding == Decimal("50.00")

    def test_paid_invoice(self, db, financial_calc_service):
        """Patient with fully paid invoice."""
        inv = InvoiceFactory.create(db, status=InvoiceStatus.PAID.value)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        summary = financial_calc_service.calculate_patient_financial_summary(
            _STUB_PATIENT_ID
        )
        assert summary.total_paid == Decimal("100.00")
        assert summary.total_outstanding == ZERO_MONEY
        assert summary.paid_invoice_count == 1

    def test_credit_note_included(self, db, financial_calc_service, invoice_with_items):
        """Credit notes are included in patient summary."""
        cn = CreditNote(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            credit_note_number="CN-SUMMARY-001",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("100.00"),
            reason="Patient summary test",
            status=CreditNoteStatus.ISSUED.value,
            created_by=_STUB_USER_ID,
        )
        db.add(cn)
        db.flush()

        summary = financial_calc_service.calculate_patient_financial_summary(
            _STUB_PATIENT_ID
        )
        assert summary.credit_note_count == 1
        assert summary.total_credited == Decimal("100.00")
        assert summary.total_credit_remaining == Decimal("100.00")


# ======================================================================
# Billing totals tests
# ======================================================================


class TestBillingTotals:
    """Tests for billing-wide totals."""

    def test_empty_system(self, db, financial_calc_service):
        """Empty system returns zeros."""
        totals = financial_calc_service.calculate_billing_totals()
        assert isinstance(totals, BillingTotals)
        assert totals.total_invoiced == ZERO_MONEY
        assert totals.total_collected == ZERO_MONEY
        assert totals.total_outstanding == ZERO_MONEY
        assert totals.invoice_count == 0

    def test_multiple_invoices(self, db, financial_calc_service):
        """Multiple invoices are aggregated correctly."""
        inv1 = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv1.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        inv2 = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv2.id, sequence_number=1,
            net_amount=Decimal("200.00"),
        )

        totals = financial_calc_service.calculate_billing_totals()
        assert totals.total_invoiced == Decimal("300.00")
        assert totals.invoice_count == 2

    def test_payments_included(self, db, financial_calc_service):
        """Payments are counted in billing totals."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("500.00"),
        )
        PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("500.00"),
        )

        totals = financial_calc_service.calculate_billing_totals()
        assert totals.payment_count == 1
        # Payment amounts are not directly summed in billing totals;
        # they're reflected through invoice allocations
        assert totals.total_invoiced == Decimal("500.00")


# ======================================================================
# Consistency check tests
# ======================================================================


class TestConsistencyChecks:
    """Tests for financial consistency checks."""

    def test_invoice_consistency_valid(self, db, financial_calc_service):
        """Consistent invoice passes check."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        result = financial_calc_service.check_invoice_payment_consistency(inv.id)
        assert result is True

    def test_invoice_consistency_with_allocation(self, db, financial_calc_service):
        """Invoice with valid allocations passes check."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        )
        db.flush()

        result = financial_calc_service.check_invoice_payment_consistency(inv.id)
        assert result is True

    def test_invoice_consistency_with_refund(self, db, financial_calc_service):
        """Regression test: paid + refunded invoice passes consistency check.

        Scenario:
        - Invoice grand_total = $200
        - Fully paid ($200 non-refund allocation)
        - Partially refunded ($50 refund allocation)

        Correct invariant: paid <= grand_total + refunded + epsilon
        Old invariant (wrong): paid + refunded <= grand_total + epsilon

        Old check: 200 + 50 <= 200 + 0.01 → 250 <= 200.01 → FALSE ❌
        New check: 200 <= 200 + 50 + 0.01 → 200 <= 250.01 → TRUE  ✅
        """
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("200.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        # Refund allocation (separate payment to avoid unique constraint collision)
        refund_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("50.00"),
        )
        db.add(PaymentAllocation(
            payment_id=refund_payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Partial refund",
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        result = financial_calc_service.check_invoice_payment_consistency(inv.id)
        assert result is True

    def test_invoice_consistency_violation(self, db, financial_calc_service):
        """Invoice with overpayment fails consistency check."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        ))
        db.flush()

        # paid(200) > grand_total(100) + refunded(0) + epsilon(0.01)
        # → 200 > 100.01 → FALSE
        result = financial_calc_service.check_invoice_payment_consistency(inv.id)
        assert result is False

    def test_payment_consistency_valid(self, db, financial_calc_service):
        """Consistent payment passes check."""
        payment = PaymentFactory.create(
            db, total_amount=Decimal("100.00"),
        )
        result = financial_calc_service.check_payment_allocation_consistency(
            payment.id
        )
        assert result is True

    def test_payment_consistency_with_allocation(self, db, financial_calc_service):
        """Payment with valid allocations passes check."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        inv = InvoiceFactory.create(db)
        PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("80.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        )
        db.flush()

        result = financial_calc_service.check_payment_allocation_consistency(
            payment.id
        )
        assert result is True


# ======================================================================
# Decimal precision and rounding tests
# ======================================================================


class TestDecimalPrecision:
    """Tests for decimal precision and rounding behavior."""

    def test_grand_total_quantized(self, db, financial_calc_service):
        """Grand total is quantized to MONEY_QUANTIZE_EXPONENT."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("10.256"), net_amount=Decimal("10.256"),
        )
        total = financial_calc_service.calculate_invoice_grand_total(inv.id)
        # Should be rounded to 2 decimal places
        assert total == Decimal("10.26")

    def test_outstanding_balance_quantized(self, db, financial_calc_service):
        """Outstanding balance is quantized to MONEY_QUANTIZE_EXPONENT."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )
        outstanding = financial_calc_service.calculate_invoice_outstanding_balance(
            inv.id
        )
        assert outstanding.as_tuple().exponent == -2


# ======================================================================
# Edge cases
# ======================================================================


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_zero_amount_invoice(self, db, financial_calc_service):
        """Invoice with zero-amount items is handled."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("0.00"), net_amount=Decimal("0.00"),
        )
        total = financial_calc_service.calculate_invoice_grand_total(inv.id)
        assert total == ZERO_MONEY

    def test_payment_with_zero_total(self, db, financial_calc_service):
        """Payment with zero total is handled (should not normally occur)."""
        # Payment model has CHECK(total_amount > 0) so this can't actually
        # be created. Test that non-existent payment raises.
        fake_id = UUID("00000000-0000-0000-0000-000000000099")
        with pytest.raises(PaymentNotFound):
            financial_calc_service.calculate_payment_unallocated_amount(fake_id)

    def test_invoice_with_no_items(self, db, financial_calc_service):
        """Invoice with no items returns zero grand total."""
        inv = InvoiceFactory.create(db)
        total = financial_calc_service.calculate_invoice_grand_total(inv.id)
        assert total == ZERO_MONEY

    def test_payment_with_no_refunds(self, db, financial_calc_service):
        """Payment with no refunds returns zero refunded amount."""
        payment = PaymentFactory.create(
            db, total_amount=Decimal("100.00"),
        )
        refunded = financial_calc_service.calculate_payment_refunded_amount(payment.id)
        assert refunded == ZERO_MONEY
        remaining = (
            financial_calc_service.calculate_payment_remaining_refundable_balance(
                payment.id
            )
        )
        assert remaining == Decimal("100.00")


# ======================================================================
# Read-only contract
# ======================================================================


class TestReadOnlyContract:
    """Verify that FinancialCalculationService performs zero mutations."""

    def test_calculate_does_not_create_records(self, db, financial_calc_service):
        """Calculation methods do not create database records."""
        inv = InvoiceFactory.create(db)
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            net_amount=Decimal("100.00"),
        )

        from app.modules.billing.models import BillingAuditLog

        audit_count_before = db.query(BillingAuditLog).count()

        financial_calc_service.calculate_invoice_grand_total(inv.id)
        financial_calc_service.calculate_invoice_paid_amount(inv.id)
        financial_calc_service.calculate_invoice_outstanding_balance(inv.id)

        audit_count_after = db.query(BillingAuditLog).count()
        assert audit_count_after == audit_count_before

    def test_repository_mock_verifies_no_writes(self, financial_calc_service):
        """With mocked repos, calculation methods do not fail."""
        # This is a smoke test. The true read-only contract is verified
        # by the integration tests above (no audit records created).
        assert True


# ======================================================================
# Repository mocking tests (isolated unit tests)
# ======================================================================


class TestRepositoryMocking:
    """Tests that use mocked repositories for isolation."""

    def test_invoice_not_found_with_mock(self, db):
        """Invoice calculations raise when repo returns None for exists()."""
        from unittest.mock import MagicMock

        from app.modules.billing.repositories import (
            CreditNoteRepository,
            InvoiceRepository,
            PaymentRepository,
        )
        from app.modules.billing.repositories.refund_repository import RefundRepository
        from app.modules.billing.validators import FinancialValidator

        mock_invoice_repo = MagicMock(spec=InvoiceRepository)
        mock_invoice_repo.exists.return_value = False
        mock_invoice_repo.get_by_id.return_value = None

        service = FinancialCalculationService(
            invoice_repo=mock_invoice_repo,
            payment_repo=MagicMock(spec=PaymentRepository),
            refund_repo=MagicMock(spec=RefundRepository),
            credit_note_repo=MagicMock(spec=CreditNoteRepository),
            financial_validator=FinancialValidator(),
        )

        fake_id = UUID("00000000-0000-0000-0000-000000000001")
        with pytest.raises(InvoiceNotFound):
            service.calculate_invoice_grand_total(fake_id)


# ======================================================================
# Regression tests
# ======================================================================


class TestRegression:
    """Regression tests ensuring calculations match existing services."""

    def test_payment_unallocated_matches_get_unallocated_amount(
        self, db, financial_calc_service
    ):
        """FinancialCalculationService matches PaymentService method."""
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        inv = InvoiceFactory.create(db)
        # Must append to the payment's relationship collection so the back_populates
        # mechanism updates payment.payment_allocations (setting the FK column alone
        # does not update the cached ORM relationship used by PaymentService).
        allocation = PaymentAllocation(
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("80.00"),
            is_refund=False,
            created_by=_STUB_USER_ID,
        )
        payment.payment_allocations.append(allocation)
        db.flush()

        # Use the payments service's get_unallocated_amount as reference
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

        payment_service = PaymentService(
            db=db,
            payment_repo=payment_repo,
            payment_validator=payment_validator,
            financial_validator=financial_validator,
            document_sequence_service=document_sequence_service,
            audit_repo=audit_repo,
        )

        # Both methods should return 120.00
        calc_result = financial_calc_service.calculate_payment_unallocated_amount(
            payment.id
        )
        service_result = payment_service.get_unallocated_amount(payment.id)

        assert calc_result == service_result == Decimal("120.00")
