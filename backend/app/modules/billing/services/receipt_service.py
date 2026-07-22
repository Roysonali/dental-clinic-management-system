"""ReceiptService — service-layer orchestrator for the Receipt aggregate.

Responsibilities
----------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Receipt generation**: lock payment, validate eligibility, generate number,
  persist receipt, audit log.
* **Receipt retrieval**: read-only access to the receipt aggregate.
* **Receipt regeneration**: validate eligibility, audit, return receipt.
* **Printable DTO**: constructs a read-only representation combining receipt,
  payment, and allocation data.
* **Document numbering**: delegates to ``DocumentSequenceService`` for
  sequential receipt numbers.
* **Business validation**: delegates to ``ReceiptValidator`` and
  ``PaymentValidator``.
* **Audit integration**: records workflow events via ``AuditRepository``.

Ownership boundaries
--------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (ReceiptValidator)                |
+---------------------------+-----------------------------------+
| Receipt generation        | Persistence                       |
| workflow                  | (ReceiptRepository)               |
+---------------------------+-----------------------------------+
| Payment locking           | Row-level locking                 |
|                           | (PaymentRepository.get_for_update)|
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
from dataclasses import dataclass, field
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
    PaymentStatus,
)
from app.modules.billing.exceptions import (
    BillingValidationError,
    DocumentSequenceNotFound,
    PaymentCreationFailed,
    PaymentNotFound,
    ReceiptNotFound,
    ReceiptValidationFailed,
    SequenceReservationFailed,
)
from app.modules.billing.models import BillingAuditLog, Payment, Receipt
from app.modules.billing.repositories import (
    AuditRepository,
    PaymentRepository,
    ReceiptRepository,
)
from app.modules.billing.services.base import BaseService
from app.modules.billing.services.document_sequence_service import (
    DocumentSequenceService,
)
from app.modules.billing.validators import ReceiptValidator

from app.modules.billing.enums import ReceiptStatus


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Printable Receipt DTO
# ---------------------------------------------------------------------------


@dataclass
class PrintableReceipt:
    """Immutable, printable representation of a receipt (non-PDF, non-HTML).

    Combines receipt, payment, and allocation data into a flat DTO suitable
    for API responses. No external files or rendering — this is a structured
    data object only.
    """

    receipt_id: UUID
    receipt_number: str
    receipt_date: date
    payment_id: UUID
    payment_number: str
    payment_method: str
    patient_id: UUID
    total_amount: Decimal
    status: str
    created_by: UUID
    created_at: str


# ---------------------------------------------------------------------------
# ReceiptService
# ---------------------------------------------------------------------------


class ReceiptService(BaseService):
    """Service-layer orchestrator for the Receipt aggregate.

    Args:
        db: The active SQLAlchemy ``Session``.
        receipt_repo: ``ReceiptRepository`` for receipt persistence.
        receipt_validator: ``ReceiptValidator`` for business rules.
        payment_repo: ``PaymentRepository`` for payment locking.
        document_sequence_service: ``DocumentSequenceService`` for document
            number reservation.
        audit_repo: ``AuditRepository`` for audit event persistence.
    """

    def __init__(
        self,
        db: Session,
        receipt_repo: ReceiptRepository,
        receipt_validator: ReceiptValidator,
        payment_repo: PaymentRepository,
        document_sequence_service: DocumentSequenceService,
        audit_repo: AuditRepository,
    ) -> None:
        super().__init__(db)
        self._receipt_repo = receipt_repo
        self._receipt_validator = receipt_validator
        self._payment_repo = payment_repo
        self._document_sequence_service = document_sequence_service
        self._audit_repo = audit_repo

    # ==================================================================
    # generate_receipt
    # ==================================================================

    def generate_receipt(
        self,
        payment_id: UUID,
        generated_by: UUID,
    ) -> tuple[Receipt, PrintableReceipt]:
        """Generate a receipt for a completed payment.

        Workflow — Lock → Validate → Mutate → Audit → Commit:

        1. Lock the payment (SELECT ... FOR UPDATE).
        2. Validate payment exists.
        3. Validate receipt can be generated (payment is COMPLETED, no
           duplicate receipt).
        4. Reserve the next receipt number via ``DocumentSequenceService``.
        5. Build and persist the ``Receipt`` aggregate root.
        6. Create a ``BillingAuditLog`` entry.
        7. Commit the transaction.
        8. Build and return a ``PrintableReceipt`` DTO.

        Args:
            payment_id: UUID of the completed payment.
            generated_by: UUID of the user generating the receipt.

        Returns:
            A tuple of ``(Receipt, PrintableReceipt)`` — the persisted entity
            and its printable representation.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
            ReceiptValidationFailed: If the payment is not COMPLETED or a
                receipt already exists for this payment.
            DocumentSequenceNotFound: If no document sequence exists for
                receipts.
            SequenceReservationFailed: If document number reservation fails.
            PaymentCreationFailed: If a database error occurs.
        """
        try:
            # ── 1. Lock payment ──────────────────────────────────
            payment = self._payment_repo.get_for_update(payment_id)
            if payment is None:
                raise PaymentNotFound(payment_id)

            # ── 2. Validate generatable ───────────────────────────
            self._receipt_validator.validate_generatable(payment)

            # ── 3. Reserve receipt number ─────────────────────────
            receipt_number = (
                self._document_sequence_service.reserve_next_number(
                    DocumentType.RECEIPT, generated_by
                )
            )

            # ── 4. Build and persist the receipt ──────────────────
            receipt = Receipt(
                payment_id=payment_id,
                receipt_number=receipt_number,
                receipt_date=date.today(),
                amount=payment.total_amount,
                status=ReceiptStatus.GENERATED,
                created_by=generated_by,
            )
            self._receipt_repo.create(receipt)

            # ── 5. Audit ─────────────────────────────────────────
            audit_log = BillingAuditLog(
                entity_type="receipt",
                entity_id=receipt.id,
                action=AuditAction.CREATED,
                old_value=None,
                new_value={
                    "receipt_number": receipt.receipt_number,
                    "receipt_date": receipt.receipt_date.isoformat(),
                    "amount": str(receipt.amount),
                    "status": ReceiptStatus.GENERATED.value,
                    "payment_id": str(payment_id),
                    "payment_number": payment.payment_number,
                },
                changed_by=generated_by,
                reason="Receipt generated",
            )
            self._audit_repo.create(audit_log)

            # ── 6. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Receipt generated: id=%s, number=%s, payment=%s, amount=%s",
                str(receipt.id),
                receipt.receipt_number,
                str(payment_id),
                str(receipt.amount),
            )

            # ── 7. Build printable DTO ────────────────────────────
            printable = self._build_printable_receipt(receipt, payment)
            return receipt, printable

        except (
            PaymentNotFound,
            ReceiptValidationFailed,
            DocumentSequenceNotFound,
            BillingValidationError,
            SequenceReservationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error generating receipt for payment %s — rolled back",
                str(payment_id),
            )
            raise PaymentCreationFailed(
                f"Failed to generate receipt for payment {payment_id}"
            )

    # ==================================================================
    # get_receipt
    # ==================================================================

    def get_receipt(self, receipt_id: UUID) -> tuple[Receipt, PrintableReceipt]:
        """Fetch a receipt by its UUID.

        Read-only operation. No mutation, no commit.

        Args:
            receipt_id: UUID of the receipt.

        Returns:
            A tuple of ``(Receipt, PrintableReceipt)`` — the entity and its
            printable representation.

        Raises:
            ReceiptNotFound: If ``receipt_id`` does not resolve.
        """
        receipt = self._receipt_validator.validate_receipt_exists(receipt_id)
        payment = self._payment_repo.get_by_id(receipt.payment_id)
        printable = self._build_printable_receipt(receipt, payment)
        return receipt, printable

    # ==================================================================
    # regenerate_receipt
    # ==================================================================

    def regenerate_receipt(
        self,
        receipt_id: UUID,
        regenerated_by: UUID,
    ) -> tuple[Receipt, PrintableReceipt]:
        """Re-produce an existing receipt without creating a new financial record.

        Regeneration validates that the receipt is still in ``GENERATED``
        status, creates an audit log entry recording the regeneration event,
        and returns the receipt with its printable DTO.

        No financial data is modified — this is purely a document reproduction
        workflow.

        Workflow — Lock → Validate → Audit → Commit:

        1. Lock the receipt (SELECT ... FOR UPDATE).
        2. Validate receipt exists and is in ``GENERATED`` status.
        3. Create a ``BillingAuditLog`` entry recording the regeneration.
        4. Commit the transaction.
        5. Build and return the ``PrintableReceipt`` DTO.

        Args:
            receipt_id: UUID of the receipt to regenerate.
            regenerated_by: UUID of the user performing the regeneration.

        Returns:
            A tuple of ``(Receipt, PrintableReceipt)`` — the existing entity
            and its printable representation.

        Raises:
            ReceiptNotFound: If ``receipt_id`` does not resolve.
            ReceiptValidationFailed: If the receipt is not in GENERATED
                status and cannot be regenerated.
            PaymentCreationFailed: If a database error occurs.
        """
        try:
            # ── 1. Lock receipt ──────────────────────────────────
            receipt = self._receipt_repo.get_for_update(receipt_id)
            if receipt is None:
                raise ReceiptNotFound(receipt_id)

            # ── 2. Validate receipt is regeneratable ────────────
            self._receipt_validator.validate_regeneratable(receipt)

            # ── 3. Audit regeneration ────────────────────────────
            current = (
                receipt.status
                if isinstance(receipt.status, ReceiptStatus)
                else ReceiptStatus(receipt.status)
            )
            audit_log = BillingAuditLog(
                entity_type="receipt",
                entity_id=receipt.id,
                action=AuditAction.REGENERATED,
                old_value={
                    "status": current.value,
                },
                new_value={
                    "receipt_number": receipt.receipt_number,
                    "status": ReceiptStatus.GENERATED.value,
                    "regenerated_at": __import__(
                        "datetime"
                    ).datetime.now(
                        __import__("datetime").timezone.utc
                    ).isoformat(),
                },
                changed_by=regenerated_by,
                reason="Receipt regenerated",
            )
            self._audit_repo.create(audit_log)

            # ── 4. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Receipt regenerated: id=%s, number=%s, by=%s",
                str(receipt.id),
                receipt.receipt_number,
                str(regenerated_by),
            )

            # ── 5. Build printable DTO ────────────────────────────
            payment = self._payment_repo.get_by_id(receipt.payment_id)
            printable = self._build_printable_receipt(receipt, payment)
            return receipt, printable

        except (
            ReceiptNotFound,
            ReceiptValidationFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error regenerating receipt %s — rolled back",
                str(receipt_id),
            )
            raise PaymentCreationFailed(
                f"Failed to regenerate receipt {receipt_id}"
            )

    # ==================================================================
    # Private helpers
    # ==================================================================

    def _build_printable_receipt(
        self,
        receipt: Receipt,
        payment: Payment | None,
    ) -> PrintableReceipt:
        """Construct a ``PrintableReceipt`` DTO from domain entities.

        Args:
            receipt: The ``Receipt`` entity.
            payment: The ``Payment`` entity (may be None if only the receipt
                is available).

        Returns:
            An immutable ``PrintableReceipt`` dataclass instance.
        """
        return PrintableReceipt(
            receipt_id=receipt.id,
            receipt_number=receipt.receipt_number,
            receipt_date=receipt.receipt_date,
            payment_id=receipt.payment_id,
            payment_number=payment.payment_number if payment else "",
            payment_method=payment.payment_method.value
            if payment and hasattr(payment.payment_method, "value")
            else (payment.payment_method if payment else ""),
            patient_id=payment.patient_id if payment else UUID(int=0),
            total_amount=receipt.amount,
            status=receipt.status.value
            if isinstance(receipt.status, ReceiptStatus)
            else str(receipt.status),
            created_by=receipt.created_by,
            created_at=receipt.created_at.isoformat()
            if receipt.created_at
            else "",
        )


__all__ = ["PrintableReceipt", "ReceiptService"]
