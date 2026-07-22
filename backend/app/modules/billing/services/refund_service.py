"""RefundService — service-layer orchestrator for the Refund aggregate.

Responsibilities
----------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Refund lifecycle**: create, approve, reject, complete.
* **Document numbering**: delegates to ``DocumentSequenceService`` for
  sequential refund numbers.
* **Business validation**: delegates to ``RefundValidator``,
  ``PaymentValidator``, and ``FinancialValidator``.
* **Audit integration**: records workflow events via ``AuditRepository``.
* **Payment allocation**: creates PaymentAllocation with is_refund=True on
  completion.
* **Logging**: workflow-level business events.

Ownership boundaries
--------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (RefundValidator,                 |
|                           |  PaymentValidator)                |
+---------------------------+-----------------------------------+
| Refund lifecycle          | Persistence                       |
| orchestration             | (RefundRepository,                |
|                           |  PaymentRepository)               |
+---------------------------+-----------------------------------+
| Document numbering        | Row-level locking                 |
| (DocumentSequenceService) | (PaymentRepository,               |
|                           |  RefundRepository)                |
+---------------------------+-----------------------------------+
| Audit event creation      | SQL                               |
| (AuditRepository)         |                                   |
+---------------------------+-----------------------------------+
| Logging                   |                                   |
+---------------------------+-----------------------------------+
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.billing.enums import (
    AuditAction,
    DocumentType,
    PaymentStatus,
    RefundStatus,
)
from app.modules.billing.exceptions import (
    BillingFinancialError,
    BillingValidationError,
    InvalidRefundStatusTransition,
    PaymentNotFound,
    PaymentValidationFailed,
    RefundCreationFailed,
    RefundExceedsPayment,
    RefundNotFound,
    RefundValidationFailed,
)
from app.modules.billing.models import BillingAuditLog, PaymentAllocation, Refund
from app.modules.billing.repositories import AuditRepository, PaymentRepository
from app.modules.billing.repositories.refund_repository import RefundRepository
from app.modules.billing.services.base import BaseService
from app.modules.billing.services.document_sequence_service import (
    DocumentSequenceService,
)
from app.modules.billing.validators import (
    FinancialValidator,
)
from app.modules.billing.validators.refund_validator import RefundValidator


logger = logging.getLogger(__name__)


class RefundService(BaseService):
    """Service-layer orchestrator for the Refund aggregate.

    Args:
        db: The active SQLAlchemy ``Session``.
        refund_repo: ``RefundRepository`` for aggregate persistence.
        payment_repo: ``PaymentRepository`` for payment locking and
            allocation persistence.
        refund_validator: ``RefundValidator`` for business rules.
        payment_validator: ``PaymentValidator`` for payment validation.
        financial_validator: ``FinancialValidator`` for monetary validations.
        document_sequence_service: ``DocumentSequenceService`` for document
            number reservation.
        audit_repo: ``AuditRepository`` for audit event persistence.
    """

    def __init__(
        self,
        db: Session,
        refund_repo: RefundRepository,
        payment_repo: PaymentRepository,
        refund_validator: RefundValidator,
        financial_validator: FinancialValidator,
        document_sequence_service: DocumentSequenceService,
        audit_repo: AuditRepository,
    ) -> None:
        super().__init__(db)
        self._refund_repo = refund_repo
        self._payment_repo = payment_repo
        self._refund_validator = refund_validator
        self._financial = financial_validator
        self._document_sequence_service = document_sequence_service
        self._audit_repo = audit_repo

    # ==================================================================
    # create_refund
    # ==================================================================

    def create_refund(
        self,
        payment_id: UUID,
        amount: Any,
        reason: str,
        created_by: UUID,
    ) -> Refund:
        """Create a new refund request in Pending status.

        Workflow:
        1. Acquire a row lock on the payment.
        2. Validate payment exists and is refundable (COMPLETED).
        3. Validate refund amount does not exceed refundable balance.
        4. Reserve a refund number via ``DocumentSequenceService``.
        5. Build the ``Refund`` aggregate root.
        6. Create a ``BillingAuditLog`` entry.
        7. Persist via ``refund_repo.create()``.
        8. Commit the transaction.

        Args:
            payment_id: UUID of the payment to refund.
            amount: Refund amount (must be positive and <= refundable balance).
            reason: Reason for the refund.
            created_by: UUID of the user creating the refund.

        Returns:
            The newly created ``Refund`` aggregate in ``PENDING`` status.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            PaymentValidationFailed: If the payment is not in COMPLETED status.
            RefundExceedsPayment: If the refund amount exceeds the payment.
            RefundValidationFailed: If amount or reason validation fails.
        """
        try:
            # ── 1. Lock payment ─────────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate payment is refundable ───────────────────
            self._refund_validator.validate_refundable_payment(payment)

            # ── 3. Validate amount ──────────────────────────────────
            validated_amount = self._financial.validate_positive_amount(
                amount, field="amount"
            )

            # Check existing outstanding refunds (PENDING + APPROVED + COMPLETED)
            # This prevents over-refunding: non-rejected refunds are committed
            # obligations against the payment (Kilo CR-001).
            existing_refunds = self._refund_repo.get_outstanding_refund_total(payment_id)
            if existing_refunds + validated_amount > payment.total_amount:
                raise RefundExceedsPayment(
                    details={
                        "payment_id": str(payment_id),
                        "payment_total": str(payment.total_amount),
                        "existing_refunds": str(existing_refunds),
                        "new_refund": str(validated_amount),
                    }
                )

            # ── 4. Reserve refund number ────────────────────────────
            refund_number = (
                self._document_sequence_service.reserve_next_number(
                    DocumentType.REFUND, created_by
                )
            )

            # ── 5. Build the aggregate ──────────────────────────────
            refund = Refund(
                payment_id=payment_id,
                refund_number=refund_number,
                amount=validated_amount,
                reason=reason.strip(),
                status=RefundStatus.PENDING,
                created_by=created_by,
            )

            # ── 6. Persist ──────────────────────────────────────────
            self._refund_repo.create(refund)

            # ── 7. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="refund",
                entity_id=refund.id,
                action=AuditAction.REFUND_CREATED,
                old_value=None,
                new_value={
                    "refund_number": refund.refund_number,
                    "amount": str(refund.amount),
                    "reason": refund.reason,
                    "payment_id": str(payment_id),
                    "status": RefundStatus.PENDING.value,
                },
                changed_by=created_by,
                reason=f"Refund created: {refund.reason}",
            )
            self._audit_repo.create(audit_log)

            # ── 8. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Refund created: id=%s, number=%s, payment=%s, amount=%s",
                str(refund.id),
                refund.refund_number,
                str(payment_id),
                str(refund.amount),
            )
            return refund

        except (
            PaymentNotFound,
            PaymentValidationFailed,
            RefundValidationFailed,
            BillingValidationError,
            BillingFinancialError,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error creating refund for payment %s — rolled back",
                str(payment_id),
            )
            raise RefundCreationFailed(
                f"Failed to create refund for payment {payment_id}"
            )

    # ==================================================================
    # approve_refund
    # ==================================================================

    def approve_refund(
        self,
        refund_id: UUID,
        approved_by: UUID,
    ) -> Refund:
        """Approve a pending refund.

        Workflow:
        1. Acquire a row lock on the refund.
        2. Validate refund exists.
        3. Validate the status transition PENDING → APPROVED.
        4. Transition status to APPROVED.
        5. Create a ``BillingAuditLog`` entry.
        6. Commit the transaction.

        Args:
            refund_id: UUID of the refund to approve.
            approved_by: UUID of the user approving the refund.

        Returns:
            The updated ``Refund`` aggregate in ``APPROVED`` status.

        Raises:
            RefundNotFound: If ``refund_id`` does not resolve.
            InvalidRefundStatusTransition: If the transition is not allowed.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            refund = self._refund_repo.get_for_update(refund_id)
            if refund is None:
                raise RefundNotFound(refund_id)

            # ── 2. Validate transition ─────────────────────────────
            old_status = refund.status
            self._refund_validator.validate_status_transition(
                refund, RefundStatus.APPROVED
            )

            # ── 3. Transition status ───────────────────────────────
            refund.status = RefundStatus.APPROVED
            refund.reviewed_by = approved_by
            refund.reviewed_at = datetime.now(timezone.utc)
            refund.updated_by = approved_by

            # ── 4. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="refund",
                entity_id=refund.id,
                action=AuditAction.REFUND_APPROVED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, RefundStatus)
                    else str(old_status)
                },
                new_value={"status": RefundStatus.APPROVED.value},
                changed_by=approved_by,
                reason="Refund approved",
            )
            self._audit_repo.create(audit_log)

            # ── 5. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Refund approved: id=%s, by=%s",
                str(refund_id),
                str(approved_by),
            )
            return refund

        except (
            RefundNotFound,
            InvalidRefundStatusTransition,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error approving refund %s — rolled back",
                str(refund_id),
            )
            raise RefundCreationFailed(
                f"Failed to approve refund {refund_id}"
            )

    # ==================================================================
    # reject_refund
    # ==================================================================

    def reject_refund(
        self,
        refund_id: UUID,
        rejected_by: UUID,
        *,
        reason: str | None = None,
    ) -> Refund:
        """Reject a pending refund.

        Workflow:
        1. Acquire a row lock on the refund.
        2. Validate refund exists.
        3. Validate the status transition PENDING → REJECTED.
        4. Validate rejection reason is provided.
        5. Transition status to REJECTED.
        6. Create a ``BillingAuditLog`` entry.
        7. Commit the transaction.

        Args:
            refund_id: UUID of the refund to reject.
            rejected_by: UUID of the user rejecting the refund.
            reason: Reason for rejection (required).

        Returns:
            The updated ``Refund`` aggregate in ``REJECTED`` status.

        Raises:
            RefundNotFound: If ``refund_id`` does not resolve.
            InvalidRefundStatusTransition: If the transition is not allowed.
            RefundValidationFailed: If rejection reason is missing.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            refund = self._refund_repo.get_for_update(refund_id)
            if refund is None:
                raise RefundNotFound(refund_id)

            # ── 2. Validate transition ─────────────────────────────
            old_status = refund.status
            self._refund_validator.validate_status_transition(
                refund, RefundStatus.REJECTED
            )

            # ── 3. Validate rejection reason ───────────────────────
            self._refund_validator.validate_rejection_reason(refund, reason)

            # ── 4. Transition status ───────────────────────────────
            refund.status = RefundStatus.REJECTED
            refund.reviewed_by = rejected_by
            refund.reviewed_at = datetime.now(timezone.utc)
            refund.rejection_reason = reason.strip() if reason else None
            refund.updated_by = rejected_by

            # ── 5. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="refund",
                entity_id=refund.id,
                action=AuditAction.REFUND_REJECTED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, RefundStatus)
                    else str(old_status)
                },
                new_value={"status": RefundStatus.REJECTED.value},
                changed_by=rejected_by,
                reason=reason.strip() if reason else "Refund rejected",
            )
            self._audit_repo.create(audit_log)

            # ── 6. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Refund rejected: id=%s, by=%s",
                str(refund_id),
                str(rejected_by),
            )
            return refund

        except (
            RefundNotFound,
            InvalidRefundStatusTransition,
            RefundValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error rejecting refund %s — rolled back",
                str(refund_id),
            )
            raise RefundCreationFailed(
                f"Failed to reject refund {refund_id}"
            )

    # ==================================================================
    # complete_refund
    # ==================================================================

    def complete_refund(
        self,
        refund_id: UUID,
        completed_by: UUID,
    ) -> Refund:
        """Complete an approved refund.

        Workflow:
        1. Acquire a row lock on the refund.
        2. Validate the status transition APPROVED → COMPLETED.
        3. Lock the payment to ensure allocation consistency.
        4. Validate total refunded does not exceed payment amount.
        5. Create a ``PaymentAllocation`` with ``is_refund=True``.
        6. Transition refund status to COMPLETED.
        7. Update payment status to REFUNDED if fully refunded.
        8. Create a ``BillingAuditLog`` entry.
        9. Commit the transaction.

        Args:
            refund_id: UUID of the refund to complete.
            completed_by: UUID of the user completing the refund.

        Returns:
            The updated ``Refund`` aggregate in ``COMPLETED`` status.

        Raises:
            RefundNotFound: If ``refund_id`` does not resolve.
            PaymentNotFound: If the underlying payment does not resolve.
            InvalidRefundStatusTransition: If the transition is not allowed.
        """
        try:
            # ── 1. Lock refund ─────────────────────────────────────
            refund = self._refund_repo.get_for_update(refund_id)
            if refund is None:
                raise RefundNotFound(refund_id)

            # ── 2. Validate transition ─────────────────────────────
            old_status = refund.status
            self._refund_validator.validate_status_transition(
                refund, RefundStatus.COMPLETED
            )

            # ── 3. Lock payment and revalidate ─────────────────────
            # Revalidate payment status after acquiring the lock: between
            # create_refund() and complete_refund() the payment could have
            # been reversed or voided (OpenCode Finding 2).
            payment = self._payment_repo.get_for_update(refund.payment_id)
            if payment is None:
                raise PaymentNotFound(refund.payment_id)
            self._refund_validator.validate_refundable_payment(payment)

            # ── 4. Validate total refunded does not exceed payment amount ─
            # Belt-and-suspenders: even though create_refund() guards against
            # over-refunding, we validate again before allocating (Kilo CR-002).
            total_refunded_before = self._refund_repo.get_completed_refund_total(payment.id)
            if total_refunded_before + refund.amount > payment.total_amount:
                raise RefundExceedsPayment(
                    details={
                        "payment_id": str(payment.id),
                        "payment_total": str(payment.total_amount),
                        "existing_refunds": str(total_refunded_before),
                        "new_refund": str(refund.amount),
                    }
                )

            # ── 5. Create refund allocation ────────────────────────
            refund_allocation = PaymentAllocation(
                payment_id=payment.id,
                invoice_id=None,
                allocated_amount=refund.amount,
                is_refund=True,
                refund_reason=refund.reason,
                original_allocation_id=None,
                created_by=completed_by,
            )
            self._payment_repo.add_allocation(refund_allocation)

            # ── 6. Transition refund status ────────────────────────
            refund.status = RefundStatus.COMPLETED
            refund.updated_by = completed_by

            # ── 7. Update payment status if fully refunded ─────────
            total_refunded_now = total_refunded_before + refund.amount
            if total_refunded_now >= payment.total_amount:
                # Validate transition through approved state machine
                # (OpenCode Finding 3)
                self._refund_validator.validate_payment_refunded_transition(
                    payment
                )
                old_payment_status = payment.status
                payment.status = PaymentStatus.REFUNDED

                # Payment status change audit
                payment_audit = BillingAuditLog(
                    entity_type="payment",
                    entity_id=payment.id,
                    action=AuditAction.REFUNDED,
                    old_value={"status": old_payment_status.value
                                if isinstance(old_payment_status, PaymentStatus)
                                else str(old_payment_status)},
                    new_value={"status": PaymentStatus.REFUNDED.value},
                    changed_by=completed_by,
                    reason=f"Payment fully refunded via refund {refund.refund_number}",
                )
                self._audit_repo.create(payment_audit)

            # ── 8. Audit refund completion ─────────────────────────
            audit_log = BillingAuditLog(
                entity_type="refund",
                entity_id=refund.id,
                action=AuditAction.REFUND_COMPLETED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, RefundStatus)
                    else str(old_status)
                },
                new_value={
                    "status": RefundStatus.COMPLETED.value,
                    "allocated_amount": str(refund.amount),
                    "allocation_id": str(refund_allocation.id),
                },
                changed_by=completed_by,
                reason=f"Refund completed: {refund.refund_number}",
            )
            self._audit_repo.create(audit_log)

            # ── 9. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Refund completed: id=%s, number=%s, amount=%s, payment=%s",
                str(refund.id),
                refund.refund_number,
                str(refund.amount),
                str(payment.id),
            )
            return refund

        except (
            RefundNotFound,
            PaymentNotFound,
            InvalidRefundStatusTransition,
            RefundExceedsPayment,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error completing refund %s — rolled back",
                str(refund_id),
            )
            raise RefundCreationFailed(
                f"Failed to complete refund {refund_id}"
            )

__all__ = ["RefundService"]
