"""CreditNoteService — service-layer orchestrator for the Credit Note aggregate.

Responsibilities
----------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Credit note lifecycle**: create, issue, void, apply.
* **Document numbering**: delegates to ``DocumentSequenceService`` for
  sequential credit note numbers (CN- prefix, ADR-003).
* **Business validation**: delegates to ``CreditNoteValidator`` and
  ``FinancialValidator``.
* **Audit integration**: records workflow events via ``AuditRepository``.
* **Logging**: workflow-level business events.

Ownership boundaries
--------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (CreditNoteValidator,             |
|                           |  FinancialValidator)              |
+---------------------------+-----------------------------------+
| Credit note lifecycle     | Persistence                       |
| orchestration             | (CreditNoteRepository)            |
+---------------------------+-----------------------------------+
| Document numbering        | Row-level locking                 |
| (DocumentSequenceService) | (CreditNoteRepository)            |
+---------------------------+-----------------------------------+
| Audit event creation      | SQL                               |
| (AuditRepository)         |                                   |
+---------------------------+-----------------------------------+
| Logging                   |                                   |
+---------------------------+-----------------------------------+

Design
------
Strictly follows the Lock → Validate → Mutate → Audit → Commit pattern
for every mutating workflow. Never commits inside the repository layer.
Rolls back on any validated error or database exception.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.billing.enums import (
    AuditAction,
    CreditNoteStatus,
    DocumentType,
)
from app.modules.billing.exceptions import (
    BillingFinancialError,
    BillingValidationError,
    CreditNoteCreationFailed,
    CreditNoteNotApplicable,
    CreditNoteNotFound,
    CreditNoteValidationFailed,
    DocumentSequenceNotFound,
    InvalidCreditNoteStatusTransition,
    InvoiceNotFound,
    SequenceReservationFailed,
)
from app.modules.billing.models import BillingAuditLog, CreditNote
from app.modules.billing.repositories import AuditRepository
from app.modules.billing.repositories.credit_note_repository import (
    CreditNoteRepository,
)
from app.modules.billing.repositories.invoice_repository import (
    InvoiceRepository,
)
from app.modules.billing.services.base import BaseService
from app.modules.billing.services.document_sequence_service import (
    DocumentSequenceService,
)
from app.modules.billing.validators import FinancialValidator
from app.modules.billing.validators.credit_note_validator import (
    CreditNoteValidator,
)

logger = logging.getLogger(__name__)


class CreditNoteService(BaseService):
    """Service-layer orchestrator for the Credit Note aggregate.

    Args:
        db: The active SQLAlchemy ``Session``.
        credit_note_repo: ``CreditNoteRepository`` for aggregate persistence.
        invoice_repo: ``InvoiceRepository`` for invoice existence lookups.
        credit_note_validator: ``CreditNoteValidator`` for business rules.
        financial_validator: ``FinancialValidator`` for monetary validations.
        document_sequence_service: ``DocumentSequenceService`` for document
            number reservation.
        audit_repo: ``AuditRepository`` for audit event persistence.
    """

    def __init__(
        self,
        db: Session,
        credit_note_repo: CreditNoteRepository,
        invoice_repo: InvoiceRepository,
        credit_note_validator: CreditNoteValidator,
        financial_validator: FinancialValidator,
        document_sequence_service: DocumentSequenceService,
        audit_repo: AuditRepository,
    ) -> None:
        super().__init__(db)
        self._credit_note_repo = credit_note_repo
        self._invoice_repo = invoice_repo
        self._credit_note_validator = credit_note_validator
        self._financial = financial_validator
        self._document_sequence_service = document_sequence_service
        self._audit_repo = audit_repo

    # ==================================================================
    # create_credit_note
    # ==================================================================

    def create_credit_note(
        self,
        invoice_id: UUID,
        patient_id: UUID,
        amount: Any,
        reason: str,
        created_by: UUID,
        *,
        expiry_date: date | None = None,
    ) -> CreditNote:
        """Create a new credit note in DRAFT status.

        Workflow:
        1. Validate invoice exists.
        2. Validate amount is positive.
        3. Validate reason is non-empty and within length limit.
        4. Reserve a credit note number via ``DocumentSequenceService``.
        5. Build the ``CreditNote`` aggregate root.
        6. Create a ``BillingAuditLog`` entry.
        7. Persist via ``credit_note_repo.create()``.
        8. Commit the transaction.

        Args:
            invoice_id: UUID of the invoice being credited.
            patient_id: UUID of the patient.
            amount: Credit note amount (must be positive).
            reason: Reason for issuing the credit note.
            created_by: UUID of the user creating the credit note.
            expiry_date: Optional expiry date for the credit note.

        Returns:
            The newly created ``CreditNote`` aggregate in ``DRAFT`` status.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
            BillingValidationError: If amount or reason validation fails.
            CreditNoteValidationFailed: If business rules are violated.
        """
        try:
            # ── 1. Lock invoice and validate existence ──────────────
            # Acquire a row-level lock (SELECT ... FOR UPDATE) on the
            # invoice to prevent concurrent modification of items or
            # status between validation and the final commit. Without
            # this lock, another transaction could change the invoice
            # grand total (by adding/removing line items on a Draft
            # invoice) or transition the invoice to a terminal state
            # after the validation check below passes (Sprint 10B.2
            # finding CC-01).
            invoice = self._invoice_repo.get_for_update(invoice_id)
            if invoice is None:
                raise InvoiceNotFound(invoice_id)

            # ── 2. Validate amount ──────────────────────────────────
            validated_amount = self._financial.validate_positive_amount(
                amount, field="amount"
            )

            # ── 2b. Validate amount against invoice grand total (BR-91, FI-CN-002) ─
            # The grand total SUM query is safe because the invoice row
            # is locked: no other transaction can modify its items until
            # this transaction commits.
            grand_total = self._invoice_repo.get_invoice_grand_total(invoice_id)
            if validated_amount > grand_total:
                raise BillingFinancialError(
                    f"Credit note amount ({validated_amount}) exceeds invoice "
                    f"grand total ({grand_total})",
                    details={
                        "credit_note_amount": str(validated_amount),
                        "invoice_grand_total": str(grand_total),
                        "invoice_id": str(invoice_id),
                    },
                )

            # ── 3. Validate reason ──────────────────────────────────
            validated_reason = self._credit_note_validator.validate_reason(reason)

            # ── 4. Validate expiry date if provided ─────────────────
            if expiry_date is not None:
                self._credit_note_validator.validate_expiry_date(expiry_date)

            # ── 5. Reserve credit note number ───────────────────────
            credit_note_number = (
                self._document_sequence_service.reserve_next_number(
                    DocumentType.CREDIT_NOTE, created_by
                )
            )

            # ── 6. Build the aggregate ──────────────────────────────
            credit_note = CreditNote(
                invoice_id=invoice_id,
                patient_id=patient_id,
                credit_note_number=credit_note_number,
                amount=validated_amount,
                remaining_balance=validated_amount,
                reason=validated_reason,
                status=CreditNoteStatus.DRAFT,
                expiry_date=expiry_date,
                created_by=created_by,
            )

            # ── 7. Persist ──────────────────────────────────────────
            self._credit_note_repo.create(credit_note)

            # ── 8. Audit ────────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="credit_note",
                entity_id=credit_note.id,
                action=AuditAction.CREATED,
                old_value=None,
                new_value={
                    "credit_note_number": credit_note.credit_note_number,
                    "amount": str(credit_note.amount),
                    "reason": credit_note.reason,
                    "invoice_id": str(invoice_id),
                    "patient_id": str(patient_id),
                    "status": CreditNoteStatus.DRAFT.value,
                    "expiry_date": str(expiry_date) if expiry_date else None,
                },
                changed_by=created_by,
                reason=f"Credit note created: {credit_note.reason}",
            )
            self._audit_repo.create(audit_log)

            # ── 9. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Credit note created: id=%s, number=%s, invoice=%s, patient=%s, amount=%s",
                str(credit_note.id),
                credit_note.credit_note_number,
                str(invoice_id),
                str(patient_id),
                str(credit_note.amount),
            )
            return credit_note

        except (
            InvoiceNotFound,
            BillingValidationError,
            BillingFinancialError,
            CreditNoteValidationFailed,
            DocumentSequenceNotFound,
            SequenceReservationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error creating credit note for invoice %s — rolled back",
                str(invoice_id),
            )
            raise CreditNoteCreationFailed(
                f"Failed to create credit note for invoice {invoice_id}"
            )

    # ==================================================================
    # issue_credit_note
    # ==================================================================

    def issue_credit_note(
        self,
        credit_note_id: UUID,
        issued_by: UUID,
    ) -> CreditNote:
        """Issue a credit note, transitioning from DRAFT to ISSUED.

        Workflow:
        1. Acquire a row lock on the credit note.
        2. Validate credit note exists.
        3. Validate the status transition DRAFT → ISSUED.
        4. Validate the credit note is editable (DRAFT).
        5. Transition status to ISSUED.
        6. Create a ``BillingAuditLog`` entry.
        7. Commit the transaction.

        Args:
            credit_note_id: UUID of the credit note to issue.
            issued_by: UUID of the user issuing the credit note.

        Returns:
            The updated ``CreditNote`` aggregate in ``ISSUED`` status.

        Raises:
            CreditNoteNotFound: If ``credit_note_id`` does not resolve.
            InvalidCreditNoteStatusTransition: If the transition is not allowed.
            CreditNoteValidationFailed: If the credit note is not in DRAFT.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            credit_note = self._credit_note_repo.get_for_update(credit_note_id)
            if credit_note is None:
                raise CreditNoteNotFound(credit_note_id)

            # ── 2. Validate transition ─────────────────────────────
            old_status = credit_note.status
            self._credit_note_validator.validate_status_transition(
                credit_note, CreditNoteStatus.ISSUED
            )

            # ── 3. Validate editable state ─────────────────────────
            self._credit_note_validator.validate_editable(credit_note)

            # ── 4. Update issue date and status ────────────────────
            credit_note.status = CreditNoteStatus.ISSUED
            credit_note.issue_date = date.today()
            credit_note.updated_by = issued_by

            # ── 5. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="credit_note",
                entity_id=credit_note.id,
                action=AuditAction.ISSUED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, CreditNoteStatus)
                    else str(old_status)
                },
                new_value={
                    "status": CreditNoteStatus.ISSUED.value,
                    "issue_date": str(credit_note.issue_date),
                },
                changed_by=issued_by,
                reason="Credit note issued",
            )
            self._audit_repo.create(audit_log)

            # ── 6. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Credit note issued: id=%s, number=%s, by=%s",
                str(credit_note_id),
                credit_note.credit_note_number,
                str(issued_by),
            )
            return credit_note

        except (
            CreditNoteNotFound,
            InvalidCreditNoteStatusTransition,
            CreditNoteValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error issuing credit note %s — rolled back",
                str(credit_note_id),
            )
            raise CreditNoteCreationFailed(
                f"Failed to issue credit note {credit_note_id}"
            )

    # ==================================================================
    # void_credit_note
    # ==================================================================

    def void_credit_note(
        self,
        credit_note_id: UUID,
        voided_by: UUID,
        *,
        void_reason: str,
    ) -> CreditNote:
        """Void a credit note, transitioning from DRAFT or ISSUED to VOID.

        Workflow:
        1. Acquire a row lock on the credit note.
        2. Validate credit note exists.
        3. Validate the credit note is not in a terminal state.
        4. Validate void_reason is provided (done inside validator).
        5. Set void_reason on the credit note.
        6. Validate voidable (requires void_reason to be set).
        7. Validate the status transition to VOID.
        8. Transition status to VOID.
        9. Create a ``BillingAuditLog`` entry.
        10. Commit the transaction.

        Args:
            credit_note_id: UUID of the credit note to void.
            voided_by: UUID of the user voiding the credit note.
            void_reason: Reason for voiding (required).

        Returns:
            The updated ``CreditNote`` aggregate in ``VOID`` status.

        Raises:
            CreditNoteNotFound: If ``credit_note_id`` does not resolve.
            InvalidCreditNoteStatusTransition: If the transition is not allowed.
            CreditNoteValidationFailed: If ``void_reason`` is missing or empty.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            credit_note = self._credit_note_repo.get_for_update(credit_note_id)
            if credit_note is None:
                raise CreditNoteNotFound(credit_note_id)

            # ── 2. Set void_reason (needed for validation) ─────────
            credit_note.void_reason = void_reason.strip()

            # ── 3. Validate voidable (checks void_reason & transit.) ─
            old_status = credit_note.status
            self._credit_note_validator.validate_voidable(credit_note)

            # ── 4. Validate status transition (belt-and-suspenders) ─
            self._credit_note_validator.validate_status_transition(
                credit_note, CreditNoteStatus.VOID
            )

            # ── 5. Transition status ───────────────────────────────
            credit_note.status = CreditNoteStatus.VOID
            credit_note.updated_by = voided_by

            # ── 6. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="credit_note",
                entity_id=credit_note.id,
                action=AuditAction.VOIDED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, CreditNoteStatus)
                    else str(old_status)
                },
                new_value={
                    "status": CreditNoteStatus.VOID.value,
                    "void_reason": credit_note.void_reason,
                },
                changed_by=voided_by,
                reason=f"Credit note voided: {void_reason}",
            )
            self._audit_repo.create(audit_log)

            # ── 7. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Credit note voided: id=%s, number=%s, by=%s",
                str(credit_note_id),
                credit_note.credit_note_number,
                str(voided_by),
            )
            return credit_note

        except (
            CreditNoteNotFound,
            InvalidCreditNoteStatusTransition,
            CreditNoteValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error voiding credit note %s — rolled back",
                str(credit_note_id),
            )
            raise CreditNoteCreationFailed(
                f"Failed to void credit note {credit_note_id}"
            )

    # ==================================================================
    # apply_credit_note
    # ==================================================================

    def apply_credit_note(
        self,
        credit_note_id: UUID,
        applied_by: UUID,
    ) -> CreditNote:
        """Apply a credit note, transitioning from ISSUED to APPLIED.

        Workflow:
        1. Acquire a row lock on the credit note.
        2. Validate credit note exists.
        3. Validate the credit note is applicable (ISSUED, not expired,
           remaining balance > 0).
        4. Validate the status transition ISSUED → APPLIED.
        5. Transition status to APPLIED.
        6. Set remaining_balance to 0.
        7. Create a ``BillingAuditLog`` entry.
        8. Commit the transaction.

        Args:
            credit_note_id: UUID of the credit note to apply.
            applied_by: UUID of the user applying the credit note.

        Returns:
            The updated ``CreditNote`` aggregate in ``APPLIED`` status.

        Raises:
            CreditNoteNotFound: If ``credit_note_id`` does not resolve.
            CreditNoteNotApplicable: If the credit note cannot be applied.
            InvalidCreditNoteStatusTransition: If the transition is not allowed.
        """
        try:
            # ── 1. Lock and load ───────────────────────────────────
            credit_note = self._credit_note_repo.get_for_update(credit_note_id)
            if credit_note is None:
                raise CreditNoteNotFound(credit_note_id)

            # ── 2. Validate applicable (ISSUED, not expired, has balance) ─
            old_status = credit_note.status
            self._credit_note_validator.validate_applicable(credit_note)

            # ── 3. Validate status transition (belt-and-suspenders) ─
            self._credit_note_validator.validate_status_transition(
                credit_note, CreditNoteStatus.APPLIED
            )

            # ── 4. Transition status ───────────────────────────────
            old_balance = credit_note.remaining_balance
            credit_note.status = CreditNoteStatus.APPLIED
            credit_note.remaining_balance = Decimal("0.00")
            credit_note.updated_by = applied_by

            # ── 5. Audit ───────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="credit_note",
                entity_id=credit_note.id,
                action=AuditAction.CREDIT_APPLIED,
                old_value={
                    "status": old_status.value
                    if isinstance(old_status, CreditNoteStatus)
                    else str(old_status),
                    "remaining_balance": str(old_balance),
                },
                new_value={
                    "status": CreditNoteStatus.APPLIED.value,
                    "remaining_balance": "0.00",
                },
                changed_by=applied_by,
                reason=f"Credit note applied: {credit_note.credit_note_number}",
            )
            self._audit_repo.create(audit_log)

            # ── 6. Commit ───────────────────────────────────────────
            self._commit()

            logger.info(
                "Credit note applied: id=%s, number=%s, amount=%s, by=%s",
                str(credit_note_id),
                credit_note.credit_note_number,
                str(credit_note.amount),
                str(applied_by),
            )
            return credit_note

        except (
            CreditNoteNotFound,
            CreditNoteNotApplicable,
            InvalidCreditNoteStatusTransition,
            BillingValidationError,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error applying credit note %s — rolled back",
                str(credit_note_id),
            )
            raise CreditNoteCreationFailed(
                f"Failed to apply credit note {credit_note_id}"
            )


__all__ = ["CreditNoteService"]
