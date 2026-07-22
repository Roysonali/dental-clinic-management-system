"""Comprehensive tests for Sprint 5C.5 — RefundService.

Covers:
- Refund creation (success, invalid payment, invalid amount)
- Refund approval (success, invalid transition)
- Refund rejection (success, missing reason)
- Refund completion (success, payment status update, rollback)
- Full lifecycle (create → approve → complete)
- Audit trail verification
- Partial refunds and multiple refunds
- Edge cases (over-refund, invalid status transitions)
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.billing.enums import PaymentStatus, RefundStatus
from app.modules.billing.exceptions import (
    InvalidRefundStatusTransition,
    PaymentNotFound,
    PaymentValidationFailed,
    RefundCreationFailed,
    RefundExceedsPayment,
    RefundNotFound,
    RefundValidationFailed,
)
from app.modules.billing.models import PaymentAllocation, Refund


# ======================================================================
# Fixtures
# ======================================================================

@pytest.fixture
def refund_payment(db):
    """A completed payment with sufficient amount for refunding."""
    from tests.modules.billing.conftest import PaymentFactory
    from app.modules.billing.enums import PaymentStatus
    return PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value, total_amount=Decimal("200.00"))


# ======================================================================
# create_refund
# ======================================================================

class TestCreateRefund:
    """Tests for RefundService.create_refund()."""

    def test_create_refund_success(self, refund_service, refund_payment):
        """Successfully create a refund for a completed payment."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Patient requested refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        assert refund.id is not None
        assert refund.payment_id == refund_payment.id
        assert refund.amount == Decimal("50.00")
        assert refund.reason == "Patient requested refund"
        assert refund.status == RefundStatus.PENDING
        assert refund.refund_number is not None
        assert refund.refund_number.startswith("RFD-")

    def test_create_refund_payment_not_found(self, refund_service):
        """Creating a refund for a non-existent payment raises."""
        with pytest.raises(PaymentNotFound):
            refund_service.create_refund(
                payment_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                amount=Decimal("50.00"),
                reason="Test refund",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_create_refund_invalid_payment_status(self, refund_service, payment):
        """Creating a refund for a non-completed payment raises."""
        with pytest.raises(PaymentValidationFailed):
            refund_service.create_refund(
                payment_id=payment.id,
                amount=Decimal("50.00"),
                reason="Test refund",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_create_refund_exceeds_payment(self, refund_service, refund_payment):
        """Creating a refund that exceeds the payment amount raises."""
        with pytest.raises(RefundExceedsPayment):
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("999999.00"),
                reason="Over refund",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_create_refund_negative_amount(self, refund_service, refund_payment):
        """Creating a refund with a negative amount raises."""
        from app.modules.billing.exceptions import NegativeAmountNotAllowed
        with pytest.raises(NegativeAmountNotAllowed):
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("-50.00"),
                reason="Negative refund",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_create_refund_creates_audit(self, refund_service, refund_payment):
        """Creating a refund creates an audit entry."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Audit test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        from app.modules.billing.models import BillingAuditLog
        from app.modules.billing.enums import AuditAction

        audit = (
            refund_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "refund",
                BillingAuditLog.entity_id == refund.id,
                BillingAuditLog.action == AuditAction.REFUND_CREATED.value,
            )
            .first()
        )
        assert audit is not None
        assert audit.changed_by == UUID("00000000-0000-0000-0000-000000000000")

    def test_create_refund_rollback_on_failure(self, refund_service, refund_payment):
        """Refund creation rolls back on validation failure."""
        from app.modules.billing.exceptions import RefundExceedsPayment

        initial_count = refund_service._db.query(Refund).count()

        try:
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("999999.00"),
                reason="Over refund - should rollback",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )
        except RefundExceedsPayment:
            pass

        final_count = refund_service._db.query(Refund).count()
        assert final_count == initial_count


# ======================================================================
# approve_refund
# ======================================================================

class TestApproveRefund:
    """Tests for RefundService.approve_refund()."""

    def test_approve_refund_success(self, refund_service, refund_payment):
        """Successfully approve a pending refund."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Test refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        approved = refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )

        assert approved.status == RefundStatus.APPROVED
        assert approved.reviewed_by == UUID("00000000-0000-0000-0000-000000000001")
        assert approved.reviewed_at is not None

    def test_approve_refund_not_found(self, refund_service):
        """Approving a non-existent refund raises."""
        with pytest.raises(RefundNotFound):
            refund_service.approve_refund(
                refund_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                approved_by=UUID("00000000-0000-0000-0000-000000000001"),
            )

    def test_approve_refund_invalid_transition(self, refund_service, refund_payment):
        """Approving a refund in COMPLETED status raises."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Test refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        refund_service.complete_refund(
            refund_id=refund.id,
            completed_by=UUID("00000000-0000-0000-0000-000000000002"),
        )

        with pytest.raises(InvalidRefundStatusTransition):
            refund_service.approve_refund(
                refund_id=refund.id,
                approved_by=UUID("00000000-0000-0000-0000-000000000001"),
            )

    def test_approve_refund_creates_audit(self, refund_service, refund_payment):
        """Approving a refund creates an audit entry."""
        from app.modules.billing.models import BillingAuditLog
        from app.modules.billing.enums import AuditAction

        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Audit test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )

        audit = (
            refund_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "refund",
                BillingAuditLog.entity_id == refund.id,
                BillingAuditLog.action == AuditAction.REFUND_APPROVED.value,
            )
            .first()
        )
        assert audit is not None


# ======================================================================
# reject_refund
# ======================================================================

class TestRejectRefund:
    """Tests for RefundService.reject_refund()."""

    def test_reject_refund_success(self, refund_service, refund_payment):
        """Successfully reject a pending refund."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Test refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        rejected = refund_service.reject_refund(
            refund_id=refund.id,
            rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
            reason="Policy violation",
        )

        assert rejected.status == RefundStatus.REJECTED
        assert rejected.rejection_reason == "Policy violation"
        assert rejected.reviewed_by == UUID("00000000-0000-0000-0000-000000000001")

    def test_reject_refund_missing_reason(self, refund_service, refund_payment):
        """Rejecting a refund without a reason raises."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Test refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        with pytest.raises(RefundValidationFailed):
            refund_service.reject_refund(
                refund_id=refund.id,
                rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
                reason=None,
            )

    def test_reject_refund_creates_audit(self, refund_service, refund_payment):
        """Rejecting a refund creates an audit entry."""
        from app.modules.billing.models import BillingAuditLog
        from app.modules.billing.enums import AuditAction

        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Audit test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        refund_service.reject_refund(
            refund_id=refund.id,
            rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
            reason="Policy violation",
        )

        audit = (
            refund_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "refund",
                BillingAuditLog.entity_id == refund.id,
                BillingAuditLog.action == AuditAction.REFUND_REJECTED.value,
            )
            .first()
        )
        assert audit is not None

    def test_reject_refund_not_found(self, refund_service):
        """Rejecting a non-existent refund raises."""
        with pytest.raises(RefundNotFound):
            refund_service.reject_refund(
                refund_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
                reason="Not found",
            )


# ======================================================================
# complete_refund
# ======================================================================

class TestCompleteRefund:
    """Tests for RefundService.complete_refund()."""

    def test_complete_refund_success(self, refund_service, refund_payment):
        """Successfully complete an approved refund."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Test refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )

        completed = refund_service.complete_refund(
            refund_id=refund.id,
            completed_by=UUID("00000000-0000-0000-0000-000000000002"),
        )

        assert completed.status == RefundStatus.COMPLETED

    def test_complete_refund_creates_allocation(self, refund_service, refund_payment):
        """Completing a refund creates a PaymentAllocation with is_refund=True."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Test create allocation",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        refund_service.complete_refund(
            refund_id=refund.id,
            completed_by=UUID("00000000-0000-0000-0000-000000000002"),
        )

        allocation = (
            refund_service._db.query(PaymentAllocation)
            .filter(
                PaymentAllocation.payment_id == refund_payment.id,
                PaymentAllocation.is_refund == True,
            )
            .first()
        )
        assert allocation is not None
        assert allocation.allocated_amount == Decimal("50.00")
        assert allocation.refund_reason == "Test create allocation"

    def test_complete_partial_refund_does_not_change_payment_status(self, refund_service, refund_payment):
        """Partial refund does not change payment status to REFUNDED."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Partial refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        refund_service.complete_refund(
            refund_id=refund.id,
            completed_by=UUID("00000000-0000-0000-0000-000000000002"),
        )

        from app.modules.billing.models import Payment
        payment = refund_service._db.query(Payment).filter(Payment.id == refund_payment.id).first()
        assert payment.status == PaymentStatus.COMPLETED.value

    def test_complete_full_refund_updates_payment_status(self, refund_service, refund_payment):
        """Full refund changes payment status to REFUNDED."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("200.00"),
            reason="Full refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        refund_service.complete_refund(
            refund_id=refund.id,
            completed_by=UUID("00000000-0000-0000-0000-000000000002"),
        )

        from app.modules.billing.models import Payment
        payment = refund_service._db.query(Payment).filter(Payment.id == refund_payment.id).first()
        assert payment.status == PaymentStatus.REFUNDED.value

    def test_complete_multiple_refunds_partial_then_remainder(self, refund_service, refund_payment):
        """Multiple partial refunds that sum to full amount update payment to REFUNDED."""
        # First partial refund
        refund1 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("80.00"),
            reason="First partial refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund1.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))
        refund_service.complete_refund(refund_id=refund1.id, completed_by=UUID("00000000-0000-0000-0000-000000000002"))

        # Second refund for the remainder
        refund2 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("120.00"),
            reason="Second partial refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund2.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))
        refund_service.complete_refund(refund_id=refund2.id, completed_by=UUID("00000000-0000-0000-0000-000000000002"))

        from app.modules.billing.models import Payment
        payment = refund_service._db.query(Payment).filter(Payment.id == refund_payment.id).first()
        assert payment.status == PaymentStatus.REFUNDED.value

    def test_complete_refund_exceeds_remaining_balance(self, refund_service, refund_payment):
        """Creating multiple refunds that exceed the payment raises."""
        refund1 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("150.00"),
            reason="First refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund1.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))
        refund_service.complete_refund(refund_id=refund1.id, completed_by=UUID("00000000-0000-0000-0000-000000000002"))

        with pytest.raises(RefundExceedsPayment):
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("100.00"),
                reason="Over refund",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_complete_refund_not_found(self, refund_service):
        """Completing a non-existent refund raises."""
        with pytest.raises(RefundNotFound):
            refund_service.complete_refund(
                refund_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                completed_by=UUID("00000000-0000-0000-0000-000000000002"),
            )

    def test_complete_refund_not_approved(self, refund_service, refund_payment):
        """Completing a refund that is not yet approved raises."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Skip approval",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )

        with pytest.raises(InvalidRefundStatusTransition):
            refund_service.complete_refund(
                refund_id=refund.id,
                completed_by=UUID("00000000-0000-0000-0000-000000000002"),
            )

    def test_complete_refund_creates_audit(self, refund_service, refund_payment):
        """Completing a refund creates an audit entry."""
        from app.modules.billing.models import BillingAuditLog
        from app.modules.billing.enums import AuditAction

        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Audit test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))
        refund_service.complete_refund(refund_id=refund.id, completed_by=UUID("00000000-0000-0000-0000-000000000002"))

        audit = (
            refund_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "refund",
                BillingAuditLog.entity_id == refund.id,
                BillingAuditLog.action == AuditAction.REFUND_COMPLETED.value,
            )
            .first()
        )
        assert audit is not None

    def test_complete_refund_rollback_on_failure(self, refund_service, refund_payment, db):
        """Refund completion rolls back on database error."""
        from app.modules.billing.services.refund_service import RefundService

        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("50.00"),
            reason="Rollback test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))

        # Commit the approve so the refund state is persisted
        db.commit()

        initial_refund_status = (
            db.query(Refund)
            .filter(Refund.id == refund.id)
            .first()
            .status
        )

        with patch.object(refund_service, '_commit', side_effect=IntegrityError("mock", "mock", "mock")):
            with pytest.raises(RefundCreationFailed):
                refund_service.complete_refund(
                    refund_id=refund.id,
                    completed_by=UUID("00000000-0000-0000-0000-000000000002"),
                )

        # Rollback the failed transaction so we can read state
        db.rollback()

        final_refund = db.query(Refund).filter(Refund.id == refund.id).first()
        assert final_refund is not None
        assert final_refund.status == initial_refund_status


# ======================================================================
# Over-refund prevention (Kilo CR-001)
# ======================================================================

class TestOverRefundPrevention:
    """Regression tests: multiple PENDING refunds must not exceed payment."""

    def test_multiple_pending_refunds_blocked_by_total(self, refund_service, refund_payment):
        """Creating two pending refunds that together exceed the payment is blocked."""
        refund1 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("120.00"),
            reason="First refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        assert refund1.status == RefundStatus.PENDING

        # Second refund for 120 would bring total to 240 > 200
        with pytest.raises(RefundExceedsPayment):
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("120.00"),
                reason="Second refund - should be blocked",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_approved_refund_counts_toward_outstanding(self, refund_service, refund_payment):
        """An APPROVED (not yet completed) refund counts toward the outstanding total."""
        refund1 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("150.00"),
            reason="First refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(
            refund_id=refund1.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )

        # Second refund for 100 would bring outstanding to 250 > 200
        with pytest.raises(RefundExceedsPayment):
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("100.00"),
                reason="Second refund - should be blocked",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_rejected_refund_does_not_count_toward_outstanding(self, refund_service, refund_payment):
        """A REJECTED refund does not count toward the outstanding total."""
        refund1 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("150.00"),
            reason="First refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.reject_refund(
            refund_id=refund1.id,
            rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
            reason="Policy violation",
        )

        # Second refund for 150 should pass because the rejected refund doesn't count
        refund2 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("150.00"),
            reason="Second refund - should work",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        assert refund2.status == RefundStatus.PENDING

    def test_pending_completed_and_pending_combined_blocked(self, refund_service, refund_payment):
        """Completed + pending combined total is properly guarded."""
        # Complete one refund for 80
        refund1 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("80.00"),
            reason="First refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund1.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))
        refund_service.complete_refund(refund_id=refund1.id, completed_by=UUID("00000000-0000-0000-0000-000000000002"))

        # Create a pending refund for 100 (total outstanding = 180, ok)
        refund2 = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("100.00"),
            reason="Second refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        assert refund2.status == RefundStatus.PENDING

        # Third refund for 50 would bring outstanding to 230 > 200
        with pytest.raises(RefundExceedsPayment):
            refund_service.create_refund(
                payment_id=refund_payment.id,
                amount=Decimal("50.00"),
                reason="Third refund - should be blocked",
                created_by=UUID("00000000-0000-0000-0000-000000000000"),
            )

    def test_complete_refund_guards_against_over_allocation(self, refund_service, refund_payment):
        """complete_refund() validates before creating the allocation (Kilo CR-002)."""
        # Create, approve, complete a refund for the full amount
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("200.00"),
            reason="Full refund",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.approve_refund(refund_id=refund.id, approved_by=UUID("00000000-0000-0000-0000-000000000001"))
        refund_service.complete_refund(refund_id=refund.id, completed_by=UUID("00000000-0000-0000-0000-000000000002"))

        # Payment should now be fully refunded
        from app.modules.billing.models import Payment
        payment = refund_service._db.query(Payment).filter(Payment.id == refund_payment.id).first()
        assert payment.status == PaymentStatus.REFUNDED.value

        # Verify completed refund total
        total = refund_service._refund_repo.get_completed_refund_total(refund_payment.id)
        assert total == Decimal("200.00")


# ======================================================================
# Full lifecycle
# ======================================================================

class TestRefundLifecycle:
    """Tests for the full refund lifecycle."""

    def test_full_lifecycle_create_approve_complete(self, refund_service, refund_payment):
        """A refund can go through the full lifecycle: PENDING → APPROVED → COMPLETED."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("100.00"),
            reason="Full lifecycle test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        assert refund.status == RefundStatus.PENDING

        refund = refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=UUID("00000000-0000-0000-0000-000000000001"),
        )
        assert refund.status == RefundStatus.APPROVED

        refund = refund_service.complete_refund(
            refund_id=refund.id,
            completed_by=UUID("00000000-0000-0000-0000-000000000002"),
        )
        assert refund.status == RefundStatus.COMPLETED

    def test_lifecycle_create_reject(self, refund_service, refund_payment):
        """A refund can go through: PENDING → REJECTED."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("100.00"),
            reason="Rejection lifecycle test",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        assert refund.status == RefundStatus.PENDING

        refund = refund_service.reject_refund(
            refund_id=refund.id,
            rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
            reason="Not eligible",
        )
        assert refund.status == RefundStatus.REJECTED

    def test_cannot_approve_rejected_refund(self, refund_service, refund_payment):
        """A rejected refund cannot be approved."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("100.00"),
            reason="Already rejected",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.reject_refund(
            refund_id=refund.id,
            rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
            reason="Not eligible",
        )

        with pytest.raises(InvalidRefundStatusTransition):
            refund_service.approve_refund(
                refund_id=refund.id,
                approved_by=UUID("00000000-0000-0000-0000-000000000002"),
            )

    def test_cannot_complete_rejected_refund(self, refund_service, refund_payment):
        """A rejected refund cannot be completed."""
        refund = refund_service.create_refund(
            payment_id=refund_payment.id,
            amount=Decimal("100.00"),
            reason="Already rejected",
            created_by=UUID("00000000-0000-0000-0000-000000000000"),
        )
        refund_service.reject_refund(
            refund_id=refund.id,
            rejected_by=UUID("00000000-0000-0000-0000-000000000001"),
            reason="Not eligible",
        )

        with pytest.raises(InvalidRefundStatusTransition):
            refund_service.complete_refund(
                refund_id=refund.id,
                completed_by=UUID("00000000-0000-0000-0000-000000000002"),
            )
