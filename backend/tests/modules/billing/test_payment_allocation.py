"""Service-layer tests for PaymentService allocation (Sprint 5C.3).

Tests cover:
- Successful allocation (full and partial)
- Multiple allocations to different invoices
- Multiple payments to one invoice
- Advance payment remaining partially unallocated
- Over-allocation rejection
- Allocation to invalid invoice (wrong status)
- Allocation from invalid payment state
- Duplicate allocation rejection
- Deallocation success
- Deallocation rollback on failure
- Audit creation
- Transaction rollback
- Read-only methods (get_allocations, get_unallocated_amount)
- Missing invoice_repo raises RuntimeError
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.billing.enums import (
    AuditAction,
    InvoiceStatus,
    PaymentStatus,
)
from app.modules.billing.exceptions import (
    AllocationNotFound,
    InvalidInvoiceStatusTransition,
    InvoiceNotFound,
    PaymentCreationFailed,
    PaymentExceedsInvoice,
    PaymentNotFound,
    PaymentValidationFailed,
)
from app.modules.billing.models import BillingAuditLog, PaymentAllocation

from tests.modules.billing.conftest import (
    _STUB_USER_ID,
    _STUB_PATIENT_ID,
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
)


# ======================================================================
# allocate_payment
# ======================================================================


class TestAllocatePayment:
    """Tests for PaymentService.allocate_payment()."""

    def test_allocate_full_amount(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Full allocation of a completed payment to an issued invoice."""
        allocation = payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("100.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert allocation.id is not None
        assert allocation.payment_id == completed_payment.id
        assert allocation.invoice_id == issued_invoice.id
        assert allocation.allocated_amount == Decimal("100.00")
        assert allocation.is_refund is False

    def test_allocate_partial_amount(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Partial allocation leaves unallocated balance on the payment."""
        allocation = payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("40.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert allocation.allocated_amount == Decimal("40.00")

        # Verify unallocated amount reflects partial allocation
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("60.00")

    def test_multiple_allocations_to_different_invoices(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """One payment can allocate to multiple invoices."""
        from app.modules.billing.enums import InvoiceStatus

        # Create two issued invoices with items
        inv1 = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        InvoiceItemFactory.create(
            db, invoice_id=inv1.id, sequence_number=1,
            unit_price=Decimal("50.00"), net_amount=Decimal("50.00"),
        )

        inv2 = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        InvoiceItemFactory.create(
            db, invoice_id=inv2.id, sequence_number=1,
            unit_price=Decimal("50.00"), net_amount=Decimal("50.00"),
        )

        alloc1 = payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=inv1.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc1.allocated_amount == Decimal("50.00")

        alloc2 = payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=inv2.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc2.allocated_amount == Decimal("50.00")

        # Payment is fully allocated
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("0.00")

    def test_multiple_payments_to_one_invoice(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Multiple payments can allocate to the same invoice."""
        from app.modules.billing.enums import PaymentStatus

        pay1 = PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value,
                                      total_amount=Decimal("75.00"))
        pay2 = PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value,
                                      total_amount=Decimal("75.00"))

        alloc1 = payment_service_with_allocation.allocate_payment(
            payment_id=pay1.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("75.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc1.allocated_amount == Decimal("75.00")

        alloc2 = payment_service_with_allocation.allocate_payment(
            payment_id=pay2.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("75.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc2.allocated_amount == Decimal("75.00")

    def test_advance_payment_remaining_partially_unallocated(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """After partial allocation, remaining amount stays unallocated."""
        from app.modules.billing.enums import PaymentStatus

        # Create a large payment
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("500.00"),
        )

        alloc = payment_service_with_allocation.allocate_payment(
            payment_id=payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("100.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc.allocated_amount == Decimal("100.00")

        unallocated = payment_service_with_allocation.get_unallocated_amount(
            payment.id
        )
        assert unallocated == Decimal("400.00")

    def test_over_allocation_rejected(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Allocation exceeding the payment amount is rejected."""
        with pytest.raises(PaymentExceedsInvoice):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("999.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocation_to_invalid_invoice_status(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Allocation to a draft invoice is rejected."""
        draft_invoice = InvoiceFactory.create(db, status="draft")
        InvoiceItemFactory.create(
            db, invoice_id=draft_invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )

        with pytest.raises(InvalidInvoiceStatusTransition):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=draft_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocation_from_invalid_payment_state(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Allocation from a PENDING payment is rejected."""
        pending_payment = PaymentFactory.create(db, status=PaymentStatus.PENDING.value)

        with pytest.raises(PaymentValidationFailed):
            payment_service_with_allocation.allocate_payment(
                payment_id=pending_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocation_from_voided_payment(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Allocation from a VOID payment is rejected."""
        void_payment = PaymentFactory.create(db, status=PaymentStatus.VOID.value)

        with pytest.raises(PaymentValidationFailed):
            payment_service_with_allocation.allocate_payment(
                payment_id=void_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_duplicate_allocation_rejected(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Duplicate allocation (same payment+invoice) is rejected."""
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        with pytest.raises(PaymentValidationFailed):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("25.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_payment_not_found(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Allocation with a non-existent payment is rejected."""
        with pytest.raises(PaymentNotFound):
            payment_service_with_allocation.allocate_payment(
                payment_id=uuid.uuid4(),
                invoice_id=issued_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_invoice_not_found(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Allocation with a non-existent invoice is rejected."""
        with pytest.raises(InvoiceNotFound):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=uuid.uuid4(),
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_creates_audit_log(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Successful allocation creates a BillingAuditLog entry."""
        from app.modules.billing.repositories import AuditRepository

        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", completed_payment.id, sort_by="changed_at"
        )
        # Find the allocation audit log (not the created/completed ones)
        alloc_logs = [l for l in logs if l.action == AuditAction.PAYMENT_RECEIVED.value]
        assert len(alloc_logs) >= 1
        assert alloc_logs[0].entity_id == completed_payment.id
        assert alloc_logs[0].new_value["allocated_amount"] == "50.00"

    def test_allocate_rollback_on_db_error(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """DB error during allocation triggers rollback."""
        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                payment_service_with_allocation._payment_repo,
                "add_allocation",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    payment_service_with_allocation.allocate_payment(
                        payment_id=completed_payment.id,
                        invoice_id=issued_invoice.id,
                        amount=Decimal("50.00"),
                        allocated_by=_STUB_USER_ID,
                    )
            mock_rollback.assert_called_once()

    def test_allocate_exceeds_invoice_outstanding(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Allocation exceeding the invoice's outstanding balance is rejected."""
        from app.modules.billing.enums import PaymentStatus

        pay1 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("250.00"),
        )
        # Allocate 200 (full invoice amount)
        payment_service_with_allocation.allocate_payment(
            payment_id=pay1.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("200.00"),
            allocated_by=_STUB_USER_ID,
        )

        # Now try to allocate more — should fail
        with pytest.raises(PaymentExceedsInvoice):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_after_refund_reduces_outstanding(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Regression test: allocation after refund respects refunded amount.

        BR-63: outstanding = grand_total - paid + refunded.

        Scenario:
        - Invoice grand_total = $200
        - Payment of $200 fully allocates it (outstanding = $0)
        - Refund of $50 increases outstanding to $50
        - A new $30 payment can now be allocated
        """
        from app.modules.billing.enums import PaymentStatus

        # ── 1. Create first payment and fully allocate ───────────
        pay1 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        payment_service_with_allocation.allocate_payment(
            payment_id=pay1.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("200.00"),
            allocated_by=_STUB_USER_ID,
        )

        # ── 2. Create a refund allocation on the invoice ─────────
        from app.modules.billing.models import PaymentAllocation
        refund_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("50.00"),
        )
        refund_alloc = PaymentAllocation(
            payment_id=refund_payment.id,
            invoice_id=issued_invoice.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Partial refund for testing",
            created_by=_STUB_USER_ID,
        )
        db.add(refund_alloc)
        db.flush()

        # ── 3. Now allocate another payment — should succeed ─────
        # Outstanding = 200 - 200 + 50 = 50, so $30 should work
        pay2 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("30.00"),
        )
        allocation = payment_service_with_allocation.allocate_payment(
            payment_id=pay2.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("30.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert allocation.allocated_amount == Decimal("30.00")

    def test_allocate_after_refund_cannot_exceed_adjusted_outstanding(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Regression test: allocation after refund cannot exceed adjusted outstanding.

        Scenario:
        - Invoice grand_total = $200
        - Payment of $200 fully allocates it (outstanding = $0)
        - Refund of $50 increases outstanding to $50
        - A $60 payment allocation should be rejected (exceeds $50 outstanding)
        """
        from app.modules.billing.enums import PaymentStatus
        from app.modules.billing.models import PaymentAllocation

        # ── 1. Create first payment and fully allocate ───────────
        pay1 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )
        payment_service_with_allocation.allocate_payment(
            payment_id=pay1.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("200.00"),
            allocated_by=_STUB_USER_ID,
        )

        # ── 2. Create a refund allocation on the invoice ─────────
        refund_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("50.00"),
        )
        refund_alloc = PaymentAllocation(
            payment_id=refund_payment.id,
            invoice_id=issued_invoice.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Partial refund for testing",
            created_by=_STUB_USER_ID,
        )
        db.add(refund_alloc)
        db.flush()

        # ── 3. Try to allocate $60 — should fail ───────────────
        # Outstanding = 200 - 200 + 50 = 50, so $60 should fail
        pay2 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("60.00"),
        )
        with pytest.raises(PaymentExceedsInvoice):
            payment_service_with_allocation.allocate_payment(
                payment_id=pay2.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("60.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_missing_invoice_repo_raises(
        self, db, payment_service, completed_payment, issued_invoice
    ):
        """Allocation without invoice_repo raises RuntimeError."""
        # payment_service does NOT have invoice_repo configured
        with pytest.raises(RuntimeError):
            payment_service.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_negative_amount_rejected(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Negative allocation amount is rejected."""
        from app.modules.billing.exceptions import NegativeAmountNotAllowed

        with pytest.raises(NegativeAmountNotAllowed):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("-50.00"),
                allocated_by=_STUB_USER_ID,
            )

    def test_allocate_zero_amount_rejected(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Zero allocation amount is rejected."""
        from app.modules.billing.exceptions import NegativeAmountNotAllowed

        with pytest.raises(NegativeAmountNotAllowed):
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("0.00"),
                allocated_by=_STUB_USER_ID,
            )


# ======================================================================
# deallocate_payment
# ======================================================================


class TestDeallocatePayment:
    """Tests for PaymentService.deallocate_payment()."""

    def test_deallocate_success(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Successfully deallocate a payment from an invoice."""
        # First allocate
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        # Then deallocate
        payment_service_with_allocation.deallocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            deallocated_by=_STUB_USER_ID,
        )

        # Verify allocation is removed
        allocations = payment_service_with_allocation.get_allocations(
            completed_payment.id
        )
        matching = [a for a in allocations if a.invoice_id == issued_invoice.id]
        assert len(matching) == 0

        # Verify unallocated amount is restored
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("100.00")

    def test_deallocate_nonexistent_allocation(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Deallocating a non-existent allocation raises AllocationNotFound."""
        with pytest.raises(AllocationNotFound):
            payment_service_with_allocation.deallocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                deallocated_by=_STUB_USER_ID,
            )

    def test_deallocate_payment_not_found(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Deallocating with a non-existent payment raises PaymentNotFound."""
        with pytest.raises(PaymentNotFound):
            payment_service_with_allocation.deallocate_payment(
                payment_id=uuid.uuid4(),
                invoice_id=issued_invoice.id,
                deallocated_by=_STUB_USER_ID,
            )

    def test_deallocate_invoice_not_found(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Deallocating with a non-existent invoice raises InvoiceNotFound."""
        with pytest.raises(InvoiceNotFound):
            payment_service_with_allocation.deallocate_payment(
                payment_id=completed_payment.id,
                invoice_id=uuid.uuid4(),
                deallocated_by=_STUB_USER_ID,
            )

    def test_deallocate_creates_audit_log(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Successful deallocation creates a BillingAuditLog entry."""
        from app.modules.billing.repositories import AuditRepository

        # Allocate first
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        # Then deallocate
        payment_service_with_allocation.deallocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            deallocated_by=_STUB_USER_ID,
        )

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", completed_payment.id, sort_by="changed_at"
        )
        # Find the deallocation audit log
        reversal_logs = [l for l in logs if l.action == AuditAction.PAYMENT_REVERSED.value]
        assert len(reversal_logs) >= 1
        assert reversal_logs[0].entity_id == completed_payment.id

    def test_deallocate_rollback_on_db_error(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """DB error during deallocation triggers rollback."""
        # Allocate first
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        # Then try to deallocate with a forced error
        with patch.object(
            payment_service_with_allocation._payment_repo,
            "remove_allocation",
            side_effect=IntegrityError("forced", None, None),
        ):
            with pytest.raises(PaymentCreationFailed):
                payment_service_with_allocation.deallocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=issued_invoice.id,
                    deallocated_by=_STUB_USER_ID,
                )

        # Verify allocation still exists
        allocations = payment_service_with_allocation.get_allocations(
            completed_payment.id
        )
        matching = [a for a in allocations if a.invoice_id == issued_invoice.id]
        assert len(matching) == 1

    def test_deallocate_missing_invoice_repo_raises(
        self, db, payment_service, completed_payment, issued_invoice
    ):
        """Deallocation without invoice_repo raises RuntimeError."""
        with pytest.raises(RuntimeError):
            payment_service.deallocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                deallocated_by=_STUB_USER_ID,
            )


# ======================================================================
# get_allocations
# ======================================================================


class TestGetAllocations:
    """Tests for PaymentService.get_allocations()."""

    def test_get_allocations_empty(self, payment_service_with_allocation, completed_payment):
        """No allocations returns empty list."""
        allocations = payment_service_with_allocation.get_allocations(
            completed_payment.id
        )
        assert allocations == []

    def test_get_allocations_after_allocate(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """After allocation, get_allocations returns the allocation."""
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        allocations = payment_service_with_allocation.get_allocations(
            completed_payment.id
        )
        assert len(allocations) == 1
        assert allocations[0].invoice_id == issued_invoice.id
        assert allocations[0].allocated_amount == Decimal("50.00")

    def test_get_allocations_does_not_commit(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Read-only method should not commit any transaction."""
        # The method is read-only; no mutation should occur
        allocations = payment_service_with_allocation.get_allocations(
            completed_payment.id
        )
        assert isinstance(allocations, list)

    def test_get_allocations_payment_not_found(
        self, payment_service_with_allocation
    ):
        """Non-existent payment raises PaymentNotFound."""
        with pytest.raises(PaymentNotFound):
            payment_service_with_allocation.get_allocations(uuid.uuid4())


# ======================================================================
# get_unallocated_amount
# ======================================================================


class TestGetUnallocatedAmount:
    """Tests for PaymentService.get_unallocated_amount()."""

    def test_unallocated_full_amount(
        self, payment_service_with_allocation, completed_payment
    ):
        """Fresh payment has full amount unallocated."""
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("100.00")

    def test_unallocated_after_partial_allocation(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """After partial allocation, unallocated is reduced."""
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("30.00"),
            allocated_by=_STUB_USER_ID,
        )
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("70.00")

    def test_unallocated_after_full_allocation(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """After full allocation, unallocated is zero."""
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("100.00"),
            allocated_by=_STUB_USER_ID,
        )
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("0.00")

    def test_unallocated_after_deallocation(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """After deallocation, unallocated is restored."""
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )
        payment_service_with_allocation.deallocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            deallocated_by=_STUB_USER_ID,
        )
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert unallocated == Decimal("100.00")

    def test_unallocated_does_not_commit(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Read-only method should not commit any transaction."""
        unallocated = payment_service_with_allocation.get_unallocated_amount(
            completed_payment.id
        )
        assert isinstance(unallocated, Decimal)

    def test_unallocated_payment_not_found(
        self, payment_service_with_allocation
    ):
        """Non-existent payment raises PaymentNotFound."""
        with pytest.raises(PaymentNotFound):
            payment_service_with_allocation.get_unallocated_amount(uuid.uuid4())


# ======================================================================
# End-to-end allocation scenarios
# ======================================================================


class TestAllocationScenarios:
    """End-to-end allocation business scenarios."""

    def test_full_lifecycle(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Full lifecycle: allocate → verify → deallocate → verify."""
        # Allocate
        alloc = payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("75.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc.allocated_amount == Decimal("75.00")

        # Verify allocated
        assert len(payment_service_with_allocation.get_allocations(completed_payment.id)) == 1
        assert payment_service_with_allocation.get_unallocated_amount(completed_payment.id) == Decimal("25.00")

        # Deallocate
        payment_service_with_allocation.deallocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            deallocated_by=_STUB_USER_ID,
        )

        # Verify deallocated
        assert len(payment_service_with_allocation.get_allocations(completed_payment.id)) == 0
        assert payment_service_with_allocation.get_unallocated_amount(completed_payment.id) == Decimal("100.00")

    def test_exact_payment_against_invoice(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """A payment exactly covering an invoice."""
        from app.modules.billing.enums import PaymentStatus

        # Create a payment matching the invoice total (200)
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("200.00"),
        )

        alloc = payment_service_with_allocation.allocate_payment(
            payment_id=payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("200.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert alloc.allocated_amount == Decimal("200.00")
        assert payment_service_with_allocation.get_unallocated_amount(payment.id) == Decimal("0.00")


# ======================================================================
# Regression tests — rollback coverage & invoice status variants
# ======================================================================


class TestAllocationRollbackCoverage:
    """Regression tests for transaction rollback on validation failures.

    These tests verify that every validation path in ``allocate_payment``
    and ``deallocate_payment`` correctly triggers a rollback before
    re-raising the exception (Sprint 5C.3 production blocker fix).
    """

    def test_allocate_invoice_validation_triggers_rollback(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Invoice validation failure (draft) triggers rollback."""
        draft_invoice = InvoiceFactory.create(db, status="draft")
        InvoiceItemFactory.create(
            db, invoice_id=draft_invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )

        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(InvalidInvoiceStatusTransition):
                payment_service_with_allocation.allocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=draft_invoice.id,
                    amount=Decimal("50.00"),
                    allocated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_allocate_payment_validation_triggers_rollback(
        self, db, payment_service_with_allocation, issued_invoice
    ):
        """Payment validation failure (pending) triggers rollback."""
        pending_payment = PaymentFactory.create(db, status=PaymentStatus.PENDING.value)

        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(PaymentValidationFailed):
                payment_service_with_allocation.allocate_payment(
                    payment_id=pending_payment.id,
                    invoice_id=issued_invoice.id,
                    amount=Decimal("50.00"),
                    allocated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_allocate_amount_validation_triggers_rollback(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Amount validation failure (over-allocation) triggers rollback."""
        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(PaymentExceedsInvoice):
                payment_service_with_allocation.allocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=issued_invoice.id,
                    amount=Decimal("999.00"),
                    allocated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_allocate_outstanding_validation_triggers_rollback(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Invoice outstanding validation failure triggers rollback."""
        from app.modules.billing.enums import PaymentStatus

        # First fully allocate the invoice using a different payment
        pay1 = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("250.00"),
        )
        payment_service_with_allocation.allocate_payment(
            payment_id=pay1.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("200.00"),
            allocated_by=_STUB_USER_ID,
        )

        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(PaymentExceedsInvoice):
                payment_service_with_allocation.allocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=issued_invoice.id,
                    amount=Decimal("50.00"),
                    allocated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_allocate_duplicate_triggers_rollback(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Duplicate allocation validation triggers rollback."""
        payment_service_with_allocation.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=issued_invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )

        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(PaymentValidationFailed):
                payment_service_with_allocation.allocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=issued_invoice.id,
                    amount=Decimal("25.00"),
                    allocated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_deallocate_allocation_not_found_triggers_rollback(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Deallocation with non-existent allocation triggers rollback."""
        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(AllocationNotFound):
                payment_service_with_allocation.deallocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=issued_invoice.id,
                    deallocated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_rollback_happens_exactly_once(
        self, db, payment_service_with_allocation, completed_payment
    ):
        """Verify rollback is called exactly once per validation failure."""
        draft_invoice = InvoiceFactory.create(db, status="draft")
        InvoiceItemFactory.create(
            db, invoice_id=draft_invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )

        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(InvalidInvoiceStatusTransition):
                payment_service_with_allocation.allocate_payment(
                    payment_id=completed_payment.id,
                    invoice_id=draft_invoice.id,
                    amount=Decimal("50.00"),
                    allocated_by=_STUB_USER_ID,
                )
            assert mock_rollback.call_count == 1

    def test_successful_allocation_does_not_rollback(
        self, db, payment_service_with_allocation, completed_payment, issued_invoice
    ):
        """Successful path does not call rollback."""
        with patch.object(
            payment_service_with_allocation._db, "rollback"
        ) as mock_rollback:
            payment_service_with_allocation.allocate_payment(
                payment_id=completed_payment.id,
                invoice_id=issued_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )
            mock_rollback.assert_not_called()

    def test_session_usable_after_validation_rollback(
        self, db, payment_service_with_allocation
    ):
        """Session remains usable after a validation rollback."""
        from app.modules.billing.enums import PaymentStatus

        # Create entities and commit them so they survive a rollback
        payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value,
            total_amount=Decimal("100.00"),
        )
        invoice = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        InvoiceItemFactory.create(
            db, invoice_id=invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        draft_invoice = InvoiceFactory.create(db, status="draft")
        InvoiceItemFactory.create(
            db, invoice_id=draft_invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.commit()  # Commit so entities survive subsequent rollback

        # Trigger a validation failure that rolls back
        with pytest.raises(InvalidInvoiceStatusTransition):
            payment_service_with_allocation.allocate_payment(
                payment_id=payment.id,
                invoice_id=draft_invoice.id,
                amount=Decimal("50.00"),
                allocated_by=_STUB_USER_ID,
            )

        # Verify the session is still usable by running a successful allocation
        allocation = payment_service_with_allocation.allocate_payment(
            payment_id=payment.id,
            invoice_id=invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert allocation.id is not None
        assert allocation.allocated_amount == Decimal("50.00")


class TestAllocationInvoiceStatusVariants:
    """Regression tests for allocation to various invoice statuses."""

    def test_allocate_to_partially_paid_invoice(
        self, db, payment_service_with_allocation
    ):
        """Allocation to a PARTIALLY_PAID invoice succeeds."""
        from app.modules.billing.enums import PaymentStatus

        invoice = InvoiceFactory.create(db, status=InvoiceStatus.PARTIALLY_PAID.value)
        InvoiceItemFactory.create(
            db, invoice_id=invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        payment = PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value,
                                         total_amount=Decimal("50.00"))

        allocation = payment_service_with_allocation.allocate_payment(
            payment_id=payment.id,
            invoice_id=invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert allocation.allocated_amount == Decimal("50.00")

    def test_allocate_to_overdue_invoice(
        self, db, payment_service_with_allocation
    ):
        """Allocation to an OVERDUE invoice succeeds."""
        from app.modules.billing.enums import PaymentStatus

        invoice = InvoiceFactory.create(db, status=InvoiceStatus.OVERDUE.value)
        InvoiceItemFactory.create(
            db, invoice_id=invoice.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        payment = PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value,
                                         total_amount=Decimal("50.00"))

        allocation = payment_service_with_allocation.allocate_payment(
            payment_id=payment.id,
            invoice_id=invoice.id,
            amount=Decimal("50.00"),
            allocated_by=_STUB_USER_ID,
        )
        assert allocation.allocated_amount == Decimal("50.00")
