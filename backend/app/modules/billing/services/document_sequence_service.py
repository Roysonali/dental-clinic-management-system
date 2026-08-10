"""DocumentSequenceService — service-layer orchestrator for document numbering.

Responsibilities
----------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Sequence reservation**: validates, locks, increments, and persists
  consumption logs for document number generation (ADR-003).
* **Read-only queries**: preview and lookup without mutation.
* **Logging**: workflow-level business events.

Ownership boundaries
--------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (DocumentSequenceValidator)       |
+---------------------------+-----------------------------------+
| Sequence reservation      | Row-level locking                 |
| workflow                  | (DocumentSequenceRepository       |
|                           |  .get_for_update)                 |
+---------------------------+-----------------------------------+
| Consumption log creation  | Persistence                       |
|                           | (DocumentSequenceRepository)      |
+---------------------------+-----------------------------------+
| Logging                   | SQL                               |
+---------------------------+-----------------------------------+
"""

from __future__ import annotations

import logging

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.billing.enums import (
    DocumentType,
    SequenceConsumptionStatus,
)
from app.modules.billing.exceptions import (
    BillingValidationError,
    DocumentSequenceNotFound,
    SequenceReservationFailed,
)
from app.modules.billing.models import (
    DocumentSequence,
    SequenceConsumptionLog,
)
from app.modules.billing.repositories import DocumentSequenceRepository
from app.modules.billing.validators import DocumentSequenceValidator

from app.modules.billing.services.base import BaseService

logger = logging.getLogger(__name__)


class DocumentSequenceService(BaseService):
    """Service-layer orchestrator for document sequence numbering.

    Args:
        db: The active SQLAlchemy ``Session``.
        sequence_repo: ``DocumentSequenceRepository`` for persistence.
        sequence_validator: ``DocumentSequenceValidator`` for business rules.
    """

    def __init__(
        self,
        db: Session,
        sequence_repo: DocumentSequenceRepository,
        sequence_validator: DocumentSequenceValidator,
    ) -> None:
        super().__init__(db)
        self._sequence_repo = sequence_repo
        self._sequence_validator = sequence_validator

    # ------------------------------------------------------------------
    # reserve_next_number
    # ------------------------------------------------------------------

    def reserve_next_number(
        self,
        document_type: str | DocumentType,
        reserved_by: int,
    ) -> str:
        """Reserve the next available number for a document type.

        Workflow:
        1. Validate and normalise ``document_type``.
        2. Validate the sequence row exists.
        3. Acquire a row lock and increment ``current_value`` via the
           repository.
        4. Persist a ``SequenceConsumptionLog`` entry.
        5. Commit the transaction.
        6. Return the formatted document number
           (``{prefix}{current_value:0{min_digits}d}``).

        Args:
            document_type: The document type key (e.g. ``"invoice"`` or
                ``DocumentType.INVOICE``).
            reserved_by: Integer ID of the user reserving the number
                (``auth.users.id``; persisted as
                ``SequenceConsumptionLog.reserved_by``).

        Returns:
            The formatted document number string (e.g. ``"INV-00001"``).

        Raises:
            DocumentSequenceNotFound: If no sequence row exists for the
                document type.
            BillingValidationError: If the next number exceeds
                ``MAX_SEQUENCE_NUMBER`` or the document type is invalid.
            SequenceReservationFailed: If a database error occurs during
                reservation.
        """
        validated_type = None
        try:
            validated_type = self._sequence_validator.validate_document_type(
                document_type
            )
            sequence = self._sequence_validator.validate_sequence_exists(
                validated_type
            )

            updated_sequence = self._sequence_repo.increment(validated_type)
            if updated_sequence is None:
                raise SequenceReservationFailed(
                    f"Document sequence disappeared during reservation for "
                    f"'{validated_type}'"
                )

            consumption_log = SequenceConsumptionLog(
                document_type=validated_type,
                number_assigned=updated_sequence.current_value,
                reserved_by=reserved_by,
                status=SequenceConsumptionStatus.COMPLETED,
            )
            self._sequence_repo.persist_consumption_log(consumption_log)

            # NOTE: Deliberately no self._commit() here. The caller (e.g.
            # InvoiceService.issue_invoice) owns the transaction and shares
            # the same SQLAlchemy session. Committing here would persist the
            # sequence increment + consumption log independently, creating a
            # financial-integrity gap: if the caller's subsequent operations
            # fail and roll back, the sequence number is already consumed.
            # By deferring the commit to the caller, the increment and
            # consumption-log insert become part of the same atomic
            # transaction as the rest of the caller's work.
            #
            # The repository flush() calls (increment + persist_consumption_log)
            # still detect constraint violations immediately. On failure, this
            # method rolls back its local changes; the caller propagates the
            # rollback, which is a safe no-op on an already-rolled-back session.

            document_number = (
                f"{updated_sequence.prefix}"
                f"{updated_sequence.current_value:0{updated_sequence.min_digits}d}"
            )
            logger.info(
                "Reserved %s number: %s",
                validated_type,
                document_number,
            )
            return document_number

        except (
            DocumentSequenceNotFound,
            BillingValidationError,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Failed to reserve sequence for %s",
                validated_type,
            )
            raise SequenceReservationFailed(
                f"Failed to reserve sequence for '{validated_type}'"
            )

    # ------------------------------------------------------------------
    # preview_next_number
    # ------------------------------------------------------------------

    def preview_next_number(
        self,
        document_type: str | DocumentType,
    ) -> str:
        """Return the next document number without reserving it.

        Read-only operation. Performs no mutation, no flush, and no commit.

        Args:
            document_type: The document type key (e.g. ``"invoice"`` or
                ``DocumentType.INVOICE``).

        Returns:
            The formatted next document number string (e.g. ``"INV-00001"``).

        Raises:
            DocumentSequenceNotFound: If no sequence row exists for the
                document type.
            BillingValidationError: If the next number exceeds
                ``MAX_SEQUENCE_NUMBER`` or the document type is invalid.
        """
        validated_type = self._sequence_validator.validate_document_type(
            document_type
        )
        sequence = self._sequence_validator.validate_sequence_exists(
            validated_type
        )
        next_value = self._sequence_validator.validate_next_number(sequence)

        return (
            f"{sequence.prefix}"
            f"{next_value:0{sequence.min_digits}d}"
        )

    # ------------------------------------------------------------------
    # get_sequence
    # ------------------------------------------------------------------

    def get_sequence(
        self,
        document_type: str | DocumentType,
    ) -> DocumentSequence:
        """Fetch the document sequence for a document type.

        Read-only operation.

        Args:
            document_type: The document type key (e.g. ``"invoice"`` or
                ``DocumentType.INVOICE``).

        Returns:
            The ``DocumentSequence`` entity.

        Raises:
            DocumentSequenceNotFound: If no sequence row exists for the
                document type.
        """
        validated_type = self._sequence_validator.validate_document_type(
            document_type
        )
        return self._sequence_validator.validate_sequence_exists(validated_type)


__all__ = ["DocumentSequenceService"]
