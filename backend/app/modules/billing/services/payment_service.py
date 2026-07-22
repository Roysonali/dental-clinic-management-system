"""PaymentService — service-layer orchestrator for the Payment aggregate.

Responsibilities
---------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Core lifecycle**: create, read, update-pending, delete-pending, complete,
  fail, void, search.
* **Document numbering**: delegates to ``DocumentSequenceService`` for
  sequential payment numbers.
* **Business validation**: delegates to ``PaymentValidator``,
  ``InvoiceValidator``, and ``FinancialValidator``.
* **Allocation management**: allocate_payment, deallocate_payment,
  get_allocations, get_unallocated_amount (Sprint 5C.3).
* **Audit integration**: records workflow events via ``AuditRepository``.
* **Read-only queries**: get and search without mutation.
* **Logging**: workflow-level business events.

Ownership boundaries
-------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (PaymentValidator,                |
|                           |  InvoiceValidator)                |
+---------------------------+-----------------------------------+
| Payment creation workflow | Persistence                       |
|                           | (PaymentRepository)               |
+---------------------------+-----------------------------------+
| Allocation orchestration  | Row-level locking                 |
| (lock invoice + payment)  | (InvoiceRepository,               |
|                           |  PaymentRepository)               |
+---------------------------+-----------------------------------+
| Document numbering        | SQL                               |
| (DocumentSequenceService) |                                   |
+---------------------------+-----------------------------------+
| Audit event creation      | SQL                               |
| (AuditRepository)         |                                   |
+---------------------------+-----------------------------------+
| Logging                   |                                   |
+---------------------------+-----------------------------------+
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.billing.constants import DEFAULT_PAGE_SIZE
from app.modules.billing.enums import (
    AuditAction,
    DocumentType,
    PaymentMethod,
    PaymentStatus,
)
from app.modules.billing.exceptions import (
    AllocationNotFound,
    BillingFinancialError,
    BillingValidationError,
    DocumentSequenceNotFound,
    InvalidInvoiceStatusTransition,
    InvalidPaymentStatusTransition,
    InvoiceNotFound,
    PaymentCreationFailed,
    PaymentExceedsInvoice,
    PaymentNotFound,
    PaymentValidationFailed,
    SequenceReservationFailed,
)
from app.modules.billing.models import BillingAuditLog, Payment, PaymentAllocation
from app.modules.billing.repositories import AuditRepository, PaymentRepository
from app.modules.billing.repositories.invoice_repository import InvoiceRepository
from app.modules.billing.services.base import BaseService
from app.modules.billing.services.document_sequence_service import (
    DocumentSequenceService,
)
from app.modules.billing.validators import (
    FinancialValidator,
    InvoiceValidator,
    PaymentValidator,
)


logger = logging.getLogger(__name__)


class PaymentService(BaseService):
    """Service-layer orchestrator for the Payment aggregate.

    Args:
        db: The active SQLAlchemy ``Session``.
        payment_repo: ``PaymentRepository`` for aggregate persistence.
        payment_validator: ``PaymentValidator`` for business rules.
        financial_validator: ``FinancialValidator`` for monetary validations.
        document_sequence_service: ``DocumentSequenceService`` for document
            number reservation.
        audit_repo: ``AuditRepository`` for audit event persistence.
        invoice_repo: ``InvoiceRepository`` for invoice locking and
            allocation queries.
        invoice_validator: ``InvoiceValidator`` for invoice business rules.
    """

    def __init__(
        self,
        db: Session,
        payment_repo: PaymentRepository,
        payment_validator: PaymentValidator,
        financial_validator: FinancialValidator,
        document_sequence_service: DocumentSequenceService,
        audit_repo: AuditRepository,
        invoice_repo: InvoiceRepository | None = None,
        invoice_validator: InvoiceValidator | None = None,
    ) -> None:
        super().__init__(db)
        self._payment_repo = payment_repo
        self._payment_validator = payment_validator
        self._financial = financial_validator
        self._document_sequence_service = document_sequence_service
        self._audit_repo = audit_repo
        self._invoice_repo = invoice_repo
        self._invoice_validator = invoice_validator

    # ==================================================================
    # create_payment
    # ==================================================================

    def create_payment(
        self,
        patient_id: UUID,
        amount: Any,
        payment_method: Any,
        payment_date: date,
        created_by: UUID,
        *,
        reference_number: str | None = None,
        notes: str | None = None,
        payment_number: str | None = None,
    ) -> Payment:
        """Create a new payment in Pending status.

        Workflow:
        1. Validate payment amount is positive.
        2. Validate payment method.
        3. Validate payment date.
        4. Reserve or validate the payment number.
        5. Build the ``Payment`` aggregate root.
        6. Create the initial ``BillingAuditLog`` entry.
        7. Persist the aggregate via ``payment_repo.create()``.
        8. Commit the transaction.

        Args:
            patient_id: UUID of the payment owner.
            amount: Total payment amount (must be positive).
            payment_method: Payment method (``PaymentMethod`` member or
                recognised string).
            payment_date: Date the payment was recorded.
            created_by: UUID of the user creating the payment.
            reference_number: Optional transaction reference (gateway ID,
                cheque number, etc.).
            notes: Optional free-text notes.
            payment_number: Optional sequential number. If omitted, the next
                available number is reserved via
                ``DocumentSequenceService``.

        Returns:
            The newly created ``Payment`` aggregate in ``Pending`` status.

        Raises:
            PaymentNotFound: If ``patient_id`` does not resolve (not expected
                at creation time but kept for consistency).
            PaymentValidationFailed: If amount, method, or date validation
                fails.
            DocumentSequenceNotFound: If no document sequence exists for
                payments.
            SequenceReservationFailed: If document number reservation fails
                due to a database error.
            PaymentCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Validate amount ──────────────────────────────────
            validated_amount = self._financial.validate_positive_amount(
                amount, field="total_amount"
            )

            # ── 2. Validate payment method ──────────────────────────
            validated_method = self._payment_validator.validate_payment_method(
                payment_method
            )

            # ── 3. Validate payment date ────────────────────────────
            self._payment_validator.validate_payment_date(payment_date)

            # ── 4. Reserve or validate payment number ───────────────
            if payment_number is None:
                reserved_number = (
                    self._document_sequence_service.reserve_next_number(
                        DocumentType.PAYMENT, created_by
                    )
                )
            else:
                reserved_number = str(payment_number).strip()
                self._payment_validator.validate_payment_number_format(
                    reserved_number
                )
                self._payment_validator.validate_payment_number_unique(
                    reserved_number
                )

            # ── 5. Build the aggregate ──────────────────────────────
            payment = Payment(
                patient_id=patient_id,
                payment_number=reserved_number,
                payment_method=validated_method,
                total_amount=validated_amount,
                payment_date=payment_date,
                status=PaymentStatus.PENDING,
                reference_number=reference_number.strip()
                if reference_number
                else None,
                notes=notes.strip() if notes else None,
                created_by=created_by,
            )

            # ── 6. Persist so payment.id is available ────────────────
            self._payment_repo.create(payment)

            # ── 7. Create audit log ─────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment.id,
                action=AuditAction.CREATED,
                old_value=None,
                new_value={
                    "payment_number": payment.payment_number,
                    "total_amount": str(payment.total_amount),
                    "payment_method": payment.payment_method.value,
                    "status": PaymentStatus.PENDING.value,
                    "reference_number": payment.reference_number,
                },
                changed_by=created_by,
                reason="Payment created",
            )
            self._audit_repo.create(audit_log)

            # ── 8. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment created: id=%s, number=%s, patient=%s, amount=%s",
                str(payment.id),
                payment.payment_number,
                str(patient_id),
                str(payment.total_amount),
            )
            return payment

        except (
            PaymentNotFound,
            PaymentValidationFailed,
            DocumentSequenceNotFound,
            BillingValidationError,
            SequenceReservationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error creating payment for patient %s — rolled back",
                str(patient_id),
            )
            raise PaymentCreationFailed(
                f"Failed to create payment for patient {patient_id}"
            )

    # ==================================================================
    # update_payment
    # ==================================================================

    def update_payment(
        self,
        payment_id: UUID,
        updated_by: UUID,
        *,
        reference_number: str | None = None,
        notes: str | None = None,
    ) -> Payment:
        """Update a Pending payment.

        Workflow:
        1. Acquire a row lock on the payment.
        2. Validate payment exists.
        3. Validate the payment is editable (Pending).
        4. Apply allowed mutable updates (reference_number, notes).
        5. Create a ``BillingAuditLog`` entry.
        6. Commit the transaction.

        Args:
            payment_id: UUID of the payment to update.
            updated_by: UUID of the user performing the update.
            reference_number: Optional replacement transaction reference.
            notes: Optional replacement notes.

        Returns:
            The updated ``Payment`` aggregate.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            PaymentValidationFailed: If the payment is not in Pending status
                or a business validation fails.
            PaymentCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate editable ────────────────────────────────
            self._payment_validator.validate_editable(payment)

            # ── 3. Capture old values ───────────────────────────────
            old_values: dict[str, Any] = {}
            new_values: dict[str, Any] = {}

            if reference_number is not None:
                old_values["reference_number"] = payment.reference_number
                new_values["reference_number"] = (
                    reference_number.strip() or None
                )

            if notes is not None:
                old_values["notes"] = payment.notes
                new_values["notes"] = notes.strip() or None

            update_fields: dict[str, Any] = {"updated_by": updated_by}
            if reference_number is not None:
                update_fields["reference_number"] = (
                    reference_number.strip() or None
                )
            if notes is not None:
                update_fields["notes"] = notes.strip() or None

            # ── 4. Apply updates ────────────────────────────────────
            self._payment_repo.update(payment, update_fields)

            # ── 5. Audit ────────────────────────────────────────────
            if old_values:
                audit_log = BillingAuditLog(
                    entity_type="payment",
                    entity_id=payment.id,
                    action=AuditAction.UPDATED,
                    old_value=old_values,
                    new_value=new_values,
                    changed_by=updated_by,
                )
                self._audit_repo.create(audit_log)

            # ── 6. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment updated: id=%s, number=%s, by=%s",
                str(payment_id),
                payment.payment_number,
                str(updated_by),
            )
            return payment

        except (
            PaymentNotFound,
            PaymentValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error updating payment %s — rolled back",
                str(payment_id),
            )
            raise PaymentCreationFailed(
                f"Failed to update payment {payment_id}"
            )

    # ==================================================================
    # delete_payment
    # ==================================================================

    def delete_payment(self, payment_id: UUID, deleted_by: UUID) -> None:
        """Delete a Pending payment.

        Workflow:
        1. Acquire a row lock on the payment.
        2. Validate payment exists and is editable (Pending).
        3. Create a ``BillingAuditLog`` entry recording the deletion.
        4. Delete via ``payment_repo.delete()``.
        5. Commit the transaction.

        Args:
            payment_id: UUID of the payment to delete.
            deleted_by: UUID of the user deleting the payment.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            PaymentValidationFailed: If the payment is not in Pending status.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate editable ────────────────────────────────
            self._payment_validator.validate_editable(payment)

            # ── 3. Create audit log ─────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment.id,
                action=AuditAction.DELETED,
                old_value={
                    "payment_number": payment.payment_number,
                    "status": payment.status.value
                    if isinstance(payment.status, PaymentStatus)
                    else str(payment.status),
                    "total_amount": str(payment.total_amount),
                    "payment_method": payment.payment_method.value,
                },
                new_value=None,
                changed_by=deleted_by,
                reason="Payment deleted",
            )
            self._audit_repo.create(audit_log)

            # ── 4. Delete ───────────────────────────────────────────
            self._payment_repo.delete(payment)

            # ── 5. Commit ───────────────────────────────────────────
            self._commit()

            logger.info("Payment deleted: id=%s", str(payment_id))

        except (
            PaymentNotFound,
            PaymentValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error deleting payment %s — rolled back",
                str(payment_id),
            )
            raise PaymentCreationFailed(
                f"Failed to delete payment {payment_id}"
            )

    # ==================================================================
    # complete_payment
    # ==================================================================

    def complete_payment(
        self,
        payment_id: UUID,
        completed_by: UUID,
    ) -> Payment:
        """Transition a payment to ``COMPLETED`` status.

        Workflow:
        1. Acquire a row lock on the payment.
        2. Validate payment exists.
        3. Validate the status transition is allowed.
        4. Transition status → COMPLETED.
        5. Create a ``BillingAuditLog`` entry.
        6. Commit the transaction.

        Args:
            payment_id: UUID of the payment to complete.
            completed_by: UUID of the user completing the payment.

        Returns:
            The updated ``Payment`` aggregate in ``COMPLETED`` status.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            PaymentValidationFailed: If the payment is not in a state that
                may be completed.
            InvalidPaymentStatusTransition: If the transition is not allowed
                by the state machine.
            PaymentCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate status transition ──────────────────────
            old_status = payment.status
            self._payment_validator.validate_status_transition(
                payment, PaymentStatus.COMPLETED
            )

            # ── 3. Transition status ───────────────────────────────
            payment.status = PaymentStatus.COMPLETED
            payment.updated_by = completed_by

            # ── 4. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment.id,
                action=AuditAction.COMPLETED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, PaymentStatus)
                    else str(old_status)
                },
                new_value={"status": PaymentStatus.COMPLETED.value},
                changed_by=completed_by,
                reason="Payment completed",
            )
            self._audit_repo.create(audit_log)

            # ── 5. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment completed: id=%s, by=%s",
                str(payment_id),
                str(completed_by),
            )
            return payment

        except (
            PaymentNotFound,
            PaymentValidationFailed,
            InvalidPaymentStatusTransition,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error completing payment %s — rolled back",
                str(payment_id),
            )
            raise PaymentCreationFailed(
                f"Failed to complete payment {payment_id}"
            )

    # ==================================================================
    # fail_payment
    # ==================================================================

    def fail_payment(
        self,
        payment_id: UUID,
        failed_by: UUID,
        *,
        reason: str | None = None,
    ) -> Payment:
        """Transition a payment to ``FAILED`` status.

        Workflow:
        1. Acquire a row lock on the payment.
        2. Validate payment exists.
        3. Validate the status transition is allowed.
        4. Transition status → FAILED.
        5. Create a ``BillingAuditLog`` entry with the failure reason.
        6. Commit the transaction.

        Args:
            payment_id: UUID of the payment to mark as failed.
            failed_by: UUID of the user marking the payment as failed.
            reason: Optional failure reason stored in the audit record.
                The ``Payment`` model does not have a dedicated failure
                reason column; the reason is captured in the audit trail.

        Returns:
            The updated ``Payment`` aggregate in ``FAILED`` status.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            PaymentValidationFailed: If the payment is not in a state that
                may be marked as failed.
            InvalidPaymentStatusTransition: If the transition is not allowed
                by the state machine.
            PaymentCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate status transition ──────────────────────
            old_status = payment.status
            self._payment_validator.validate_status_transition(
                payment, PaymentStatus.FAILED
            )

            # ── 3. Transition status ───────────────────────────────
            payment.status = PaymentStatus.FAILED
            payment.updated_by = failed_by

            # ── 4. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment.id,
                action=AuditAction.FAILED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, PaymentStatus)
                    else str(old_status)
                },
                new_value={"status": PaymentStatus.FAILED.value},
                changed_by=failed_by,
                reason=reason.strip() if reason and str(reason).strip() else "Payment failed",
            )
            self._audit_repo.create(audit_log)

            # ── 5. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment failed: id=%s, by=%s",
                str(payment_id),
                str(failed_by),
            )
            return payment

        except (
            PaymentNotFound,
            PaymentValidationFailed,
            InvalidPaymentStatusTransition,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error failing payment %s — rolled back",
                str(payment_id),
            )
            raise PaymentCreationFailed(
                f"Failed to fail payment {payment_id}"
            )

    # ==================================================================
    # void_payment
    # ==================================================================

    def void_payment(
        self,
        payment_id: UUID,
        voided_by: UUID,
        *,
        reason: str | None = None,
    ) -> Payment:
        """Transition a payment to ``VOID`` status.

        Workflow:
        1. Acquire a row lock on the payment.
        2. Validate payment exists.
        3. Validate the status transition is allowed.
        4. Transition status → VOID.
        5. Create a ``BillingAuditLog`` entry with the void reason.
        6. Commit the transaction.

        Args:
            payment_id: UUID of the payment to void.
            voided_by: UUID of the user voiding the payment.
            reason: Optional void reason stored in the audit record.
                The ``Payment`` model does not have a dedicated void
                reason column; the reason is captured in the audit trail.

        Returns:
            The updated ``Payment`` aggregate in ``VOID`` status.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            PaymentValidationFailed: If the payment is not in a state that
                may be voided.
            InvalidPaymentStatusTransition: If the transition is not allowed
                by the state machine.
            PaymentCreationFailed: If a database error occurs during
                persistence.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate status transition ──────────────────────
            old_status = payment.status
            self._payment_validator.validate_status_transition(
                payment, PaymentStatus.VOID
            )

            # ── 3. Transition status ───────────────────────────────
            payment.status = PaymentStatus.VOID
            payment.updated_by = voided_by

            # ── 4. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment.id,
                action=AuditAction.VOIDED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, PaymentStatus)
                    else str(old_status)
                },
                new_value={"status": PaymentStatus.VOID.value},
                changed_by=voided_by,
                reason=reason.strip() if reason and str(reason).strip() else "Payment voided",
            )
            self._audit_repo.create(audit_log)

            # ── 5. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment voided: id=%s, by=%s",
                str(payment_id),
                str(voided_by),
            )
            return payment

        except (
            PaymentNotFound,
            PaymentValidationFailed,
            InvalidPaymentStatusTransition,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error voiding payment %s — rolled back",
                str(payment_id),
            )
            raise PaymentCreationFailed(
                f"Failed to void payment {payment_id}"
            )

    # ==================================================================
    # get_payment
    # ==================================================================

    def get_payment(self, payment_id: UUID) -> Payment:
        """Fetch a payment by its UUID.

        Read-only operation. No mutation, no commit.

        Args:
            payment_id: UUID of the payment.

        Returns:
            The ``Payment`` entity.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        return self._payment_validator.validate_payment_exists(payment_id)

    # ==================================================================
    # search_payments
    # ==================================================================

    def search_payments(
        self,
        *,
        patient_id: UUID | None = None,
        payment_method: PaymentMethod | str | None = None,
        status: PaymentStatus | str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Payment], int]:
        """Search and filter payments.

        Read-only operation. No mutation, no commit.

        Args:
            patient_id: Filter by patient UUID.
            payment_method: Filter by payment method.
            status: Filter by payment status.
            date_from: Only payments created **on or after** this date.
            date_to: Only payments created **on or before** this date.
            page: 1-based page number.
            page_size: Page size.
            sort_by: Sort field.
            sort_order: ``\"asc\"`` or ``\"desc\"``.

        Returns:
            A tuple of ``(items, total)``.
        """
        return self._payment_repo.list(
            patient_id=patient_id,
            status=status,
            payment_method=payment_method,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ==================================================================
    # Sprint 5C.3 — Allocation Engine
    # ==================================================================

    # ----------------------------------------------------------------
    # allocate_payment
    # ----------------------------------------------------------------

    def allocate_payment(
        self,
        payment_id: UUID,
        invoice_id: UUID,
        amount: Any,
        allocated_by: UUID,
    ) -> PaymentAllocation:
        """Allocate a portion of a payment to a specific invoice.

        Workflow — Lock → Validate → Mutate → Audit → Commit:

        1. Lock payment and invoice (SELECT ... FOR UPDATE).
        2. Validate payment exists and is COMPLETED.
        3. Validate invoice exists and is payable (ISSUED/PARTIALLY_PAID/OVERDUE).
        4. Validate allocation amount is positive.
        5. Validate payment has sufficient unallocated balance.
        6. Validate invoice has sufficient outstanding balance.
        7. Check for duplicate allocation (same payment+invoice).
        8. Create the ``PaymentAllocation`` record.
        9. Create a ``BillingAuditLog`` entry.
        10. Commit the transaction.

        Args:
            payment_id: UUID of the payment to allocate from.
            invoice_id: UUID of the invoice to allocate to.
            amount: Amount to allocate (must be positive).
            allocated_by: UUID of the user performing the allocation.

        Returns:
            The newly created ``PaymentAllocation``.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            PaymentValidationFailed: If payment is not COMPLETED.
            PaymentExceedsInvoice: If allocation exceeds unallocated
                payment balance or invoice outstanding balance.
            InvalidPaymentStatusTransition: If the invoice is not in a
                payable status.
            PaymentCreationFailed: If a database error occurs.
        """
        try:
            # ── 1a. Lock payment ──────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 1b. Lock invoice ──────────────────────────────────
            self._ensure_invoice_repo()
            invoice = self._invoice_repo.get_for_update(invoice_id)  # type: ignore[union-attr]
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            # ── 2. Validate payment is allocatable (COMPLETED) ────
            self._payment_validator.validate_allocatable(payment)

            # ── 3. Validate invoice is payable (ISSUED/PARTIALLY_PAID/OVERDUE)
            self._ensure_invoice_validator()
            self._invoice_validator.validate_payable(invoice)  # type: ignore[union-attr]

            # ── 4. Validate allocation amount is positive ─────────
            validated_amount = self._financial.validate_positive_amount(
                amount, field="allocated_amount"
            )

            # ── 5. Compute payment's already allocated amount ─────
            allocated_on_payment = sum(
                a.allocated_amount
                for a in payment.payment_allocations
                if not a.is_refund
            )
            unallocated_on_payment = payment.total_amount - allocated_on_payment

            if validated_amount > unallocated_on_payment:
                raise PaymentExceedsInvoice(
                    details={
                        "payment_id": str(payment_id),
                        "payment_total": str(payment.total_amount),
                        "already_allocated": str(allocated_on_payment),
                        "requested": str(validated_amount),
                        "available": str(unallocated_on_payment),
                    }
                )

            # ── 6. Compute invoice's outstanding balance ──────────
            grand_total = self._invoice_repo.get_invoice_grand_total(invoice_id)
            total_allocated_to_invoice = (
                self._invoice_repo.get_total_allocated_for_invoice(invoice_id)
            )
            outstanding = grand_total - total_allocated_to_invoice

            if validated_amount > outstanding:
                raise PaymentExceedsInvoice(
                    details={
                        "invoice_id": str(invoice_id),
                        "grand_total": str(grand_total),
                        "already_allocated": str(total_allocated_to_invoice),
                        "requested": str(validated_amount),
                        "outstanding": str(outstanding),
                    }
                )

            # ── 7. Check for duplicate allocation ─────────────────
            for alloc in payment.payment_allocations:
                if (
                    alloc.invoice_id == invoice_id
                    and not alloc.is_refund
                ):
                    raise PaymentValidationFailed(
                        f"Payment {payment_id} already has an allocation "
                        f"to invoice {invoice_id}.",
                        details={
                            "payment_id": str(payment_id),
                            "invoice_id": str(invoice_id),
                            "existing_allocation_id": str(alloc.id),
                            "existing_amount": str(alloc.allocated_amount),
                        },
                    )

            # ── 8. Create the allocation ──────────────────────────
            allocation = PaymentAllocation(
                payment_id=payment_id,
                invoice_id=invoice_id,
                allocated_amount=validated_amount,
                is_refund=False,
                created_by=allocated_by,
            )
            self._payment_repo.add_allocation(allocation)

            # ── 9. Audit ──────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment_id,
                action=AuditAction.PAYMENT_RECEIVED,
                old_value={
                    "available_balance": str(unallocated_on_payment),
                },
                new_value={
                    "allocated_amount": str(validated_amount),
                    "invoice_id": str(invoice_id),
                    "invoice_number": invoice.invoice_number,
                    "remaining_unallocated": str(
                        unallocated_on_payment - validated_amount
                    ),
                },
                changed_by=allocated_by,
                reason=f"Payment allocated to invoice {invoice.invoice_number}",
            )
            self._audit_repo.create(audit_log)

            # ── 10. Commit ────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment allocation created: payment=%s, invoice=%s, amount=%s, by=%s",
                str(payment_id),
                str(invoice_id),
                str(validated_amount),
                str(allocated_by),
            )
            return allocation

        except (
            PaymentNotFound,
            InvoiceNotFound,
            PaymentValidationFailed,
            InvalidPaymentStatusTransition,
            InvalidInvoiceStatusTransition,
            PaymentExceedsInvoice,
            BillingValidationError,
            BillingFinancialError,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error allocating payment %s to invoice %s — rolled back",
                str(payment_id),
                str(invoice_id),
            )
            raise PaymentCreationFailed(
                f"Failed to allocate payment {payment_id} to invoice {invoice_id}"
            )

    # ----------------------------------------------------------------
    # deallocate_payment
    # ----------------------------------------------------------------

    def deallocate_payment(
        self,
        payment_id: UUID,
        invoice_id: UUID,
        deallocated_by: UUID,
    ) -> None:
        """Remove an allocation between a payment and an invoice.

        Workflow — Lock → Validate → Mutate → Audit → Commit:

        1. Lock payment and invoice (SELECT ... FOR UPDATE).
        2. Validate payment exists.
        3. Validate invoice exists.
        4. Find the allocation record for this payment+invoice pair.
        5. Remove the allocation via ``payment_repo.remove_allocation()``.
        6. Create a ``BillingAuditLog`` entry.
        7. Commit the transaction.

        Args:
            payment_id: UUID of the payment.
            invoice_id: UUID of the invoice.
            deallocated_by: UUID of the user performing the deallocation.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            AllocationNotFound: If no allocation exists for this pair.
            PaymentCreationFailed: If a database error occurs.
        """
        try:
            # ── 1a. Lock payment ──────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 1b. Lock invoice ──────────────────────────────────
            self._ensure_invoice_repo()
            invoice = self._invoice_repo.get_for_update(invoice_id)  # type: ignore[union-attr]
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            # ── 2. Find the allocation ────────────────────────────
            target_allocation: PaymentAllocation | None = None
            for alloc in payment.payment_allocations:
                if alloc.invoice_id == invoice_id and not alloc.is_refund:
                    target_allocation = alloc
                    break

            if target_allocation is None:
                raise AllocationNotFound(
                    f"allocation(payment={payment_id}, invoice={invoice_id})",
                    details={
                        "payment_id": str(payment_id),
                        "invoice_id": str(invoice_id),
                    },
                )

            removed_amount = target_allocation.allocated_amount

            # ── 3. Remove the allocation ──────────────────────────
            self._payment_repo.remove_allocation(target_allocation)

            # ── 4. Audit ──────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="payment",
                entity_id=payment_id,
                action=AuditAction.PAYMENT_REVERSED,
                old_value={
                    "removed_allocation_id": str(target_allocation.id),
                    "removed_amount": str(removed_amount),
                    "invoice_id": str(invoice_id),
                },
                new_value={
                    "allocation_removed": True,
                    "invoice_id": str(invoice_id),
                },
                changed_by=deallocated_by,
                reason=f"Payment allocation to invoice {invoice.invoice_number} removed",
            )
            self._audit_repo.create(audit_log)

            # ── 5. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Payment deallocation: payment=%s, invoice=%s, amount=%s, by=%s",
                str(payment_id),
                str(invoice_id),
                str(removed_amount),
                str(deallocated_by),
            )

        except (
            PaymentNotFound,
            InvoiceNotFound,
            AllocationNotFound,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error deallocating payment %s from invoice %s — rolled back",
                str(payment_id),
                str(invoice_id),
            )
            raise PaymentCreationFailed(
                f"Failed to deallocate payment {payment_id} from invoice {invoice_id}"
            )

    # ----------------------------------------------------------------
    # get_allocations
    # ----------------------------------------------------------------

    def get_allocations(self, payment_id: UUID) -> list[PaymentAllocation]:
        """Return all allocations for a payment.

        Read-only operation. No mutation, no commit. Uses
        ``get_with_allocations`` to lazy-load the payment's allocation
        collection in a single query.

        Args:
            payment_id: UUID of the payment.

        Returns:
            List of ``PaymentAllocation`` records for the payment.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        payment = self._payment_repo.get_with_allocations(payment_id)
        if payment is None:
            raise PaymentNotFound(payment_id)
        return list(payment.payment_allocations)

    # ----------------------------------------------------------------
    # get_unallocated_amount
    # ----------------------------------------------------------------

    def get_unallocated_amount(self, payment_id: UUID) -> Decimal:
        """Return the unallocated (available) amount on a payment.

        Read-only operation. No mutation, no commit.

        Computed as::

            payment.total_amount - sum(allocated_amount for non-refund allocations)

        Args:
            payment_id: UUID of the payment.

        Returns:
            The remaining unallocated balance as a :class:`Decimal`.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        payment = self._payment_validator.validate_payment_exists(payment_id)
        allocated = sum(
            a.allocated_amount
            for a in payment.payment_allocations
            if not a.is_refund
        )
        remaining = payment.total_amount - allocated
        return remaining.quantize(Decimal("0.01"))

    # ==================================================================
    # Private helpers
    # ==================================================================

    def _ensure_invoice_repo(self) -> None:
        """Ensure invoice_repo is available; raise if not configured."""
        if self._invoice_repo is None:
            raise RuntimeError(
                "InvoiceRepository is required for allocation operations. "
                "Pass invoice_repo to PaymentService constructor."
            )

    def _ensure_invoice_validator(self) -> None:
        """Ensure invoice_validator is available; raise if not configured."""
        if self._invoice_validator is None:
            raise RuntimeError(
                "InvoiceValidator is required for allocation operations. "
                "Pass invoice_validator to PaymentService constructor."
            )


__all__ = ["PaymentService"]
