"""DocumentSequenceValidator — business validation for Document Sequences.

Responsibilities
----------------
* **Sequence existence**: sequence row exists for the document type.
* **Document type validation**: type is a recognised ``DocumentType``.
* **Prefix validation**: prefix format is valid.
* **Overflow prevention**: next number does not exceed ``MAX_SEQUENCE_NUMBER``.
* **Next number validation**: sequence is ready for the next assignment.
* **Configuration validation**: min_digits, start_value, prefix are valid.

Design
------
* **Read-only repositories**: ``DocumentSequenceRepositoryProtocol`` injected
  as a constructor dependency, used exclusively for lookups.
* **No I/O beyond repository reads**: never modifies the database.
* **Approved exceptions only**: raises ``DocumentSequenceNotFound``,
  ``BillingValidationError``, and other billing exceptions.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = DocumentSequenceValidator(sequence_repo)

    # Before reserving a number
    sequence = validator.validate_sequence_exists(DocumentType.INVOICE)
    validator.validate_next_number(sequence)
"""

from __future__ import annotations

from app.modules.billing.constants import (
    MAX_SEQUENCE_NUMBER,
)
from app.modules.billing.enums import DocumentType
from app.modules.billing.exceptions import (
    BillingValidationError,
    DocumentSequenceNotFound,
)
from app.modules.billing.models import DocumentSequence
from app.modules.billing.validators.protocols import DocumentSequenceRepositoryProtocol


class DocumentSequenceValidator:
    """Business rule validator for the Document Sequence module.

    Args:
        sequence_repo: Read-only ``DocumentSequenceRepositoryProtocol`` for
            sequence existence and configuration lookups.
    """

    def __init__(
        self,
        sequence_repo: DocumentSequenceRepositoryProtocol,
    ) -> None:
        self._sequence_repo = sequence_repo

    # ==================================================================
    # Sequence existence
    # ==================================================================

    def validate_sequence_exists(self, document_type: str) -> DocumentSequence:
        """Fetch a document sequence and raise ``DocumentSequenceNotFound`` if missing.

        Args:
            document_type: The document type key (e.g. ``"invoice"``).

        Returns:
            The loaded ``DocumentSequence`` entity.

        Raises:
            DocumentSequenceNotFound: If no sequence row exists for the type.
        """
        sequence = self._sequence_repo.get_by_document_type(document_type)
        if sequence is None:
            raise DocumentSequenceNotFound(document_type)
        return sequence

    def validate_sequence_type_exists(self, document_type: str) -> DocumentSequence | None:
        """Return the sequence if it exists, or ``None``.

        This is a non-raising version of :meth:`validate_sequence_exists`
        useful when the caller wants to handle the missing case itself.
        """
        return self._sequence_repo.get_by_document_type(document_type)

    # ==================================================================
    # Document type validation
    # ==================================================================

    def validate_document_type(self, document_type: object) -> str:
        """Validate that ``document_type`` is a recognised document type.

        Args:
            document_type: Candidate document type (string or enum).

        Returns:
            The validated, lower-cased document type string.

        Raises:
            BillingValidationError: If the document type is invalid.
        """
        if isinstance(document_type, DocumentType):
            return document_type.value
        if isinstance(document_type, str):
            try:
                return DocumentType(document_type).value
            except ValueError:
                raise BillingValidationError(
                    f"Unrecognised document type: {document_type!r}. "
                    f"Must be one of: {', '.join(sorted(DocumentType.all_values()))}",
                    details={
                        "document_type": document_type,
                        "allowed": sorted(DocumentType.all_values()),
                    },
                )
        raise BillingValidationError(
            f"Document type must be a string or DocumentType enum. "
            f"Got {type(document_type).__name__!r}.",
            details={"received_type": type(document_type).__name__},
        )

    # ==================================================================
    # Prefix validation
    # ==================================================================

    def validate_prefix(self, prefix: str) -> str:
        """Validate that ``prefix`` is a valid sequence prefix.

        Prefix must be non-empty, uppercase alphanumeric with hyphens only.

        Args:
            prefix: The prefix string to validate.

        Returns:
            The validated prefix string.

        Raises:
            BillingValidationError: If the prefix is invalid.
        """
        if not isinstance(prefix, str) or not prefix.strip():
            raise BillingValidationError(
                "Document sequence prefix is required",
                details={"prefix": prefix},
            )

        prefix = prefix.strip()
        if len(prefix) > 10:
            raise BillingValidationError(
                f"Document sequence prefix must be at most 10 characters. "
                f"Got {len(prefix)}.",
                details={"prefix": prefix, "length": len(prefix), "max_length": 10},
            )

        for ch in prefix:
            if not (ch.isalnum() or ch == "-"):
                raise BillingValidationError(
                    f"Document sequence prefix must contain only alphanumeric "
                    f"characters and hyphens. Found {ch!r}.",
                    details={"prefix": prefix, "invalid_character": ch},
                )

        return prefix

    # ==================================================================
    # Overflow prevention
    # ==================================================================

    def validate_no_overflow(self, current_value: int) -> int:
        """Validate that ``current_value`` has not reached the overflow limit.

        Args:
            current_value: The current sequence value.

        Returns:
            The validated current value.

        Raises:
            BillingValidationError: If ``current_value`` >= ``MAX_SEQUENCE_NUMBER``.
        """
        if current_value >= MAX_SEQUENCE_NUMBER:
            raise BillingValidationError(
                f"Document sequence has reached maximum value {MAX_SEQUENCE_NUMBER}. "
                f"Current value: {current_value}.",
                details={
                    "current_value": current_value,
                    "max_sequence_number": MAX_SEQUENCE_NUMBER,
                },
            )
        return current_value

    # ==================================================================
    # Next number validation
    # ==================================================================

    def validate_next_number(
        self,
        sequence: DocumentSequence,
        next_value: int | None = None,
    ) -> int:
        """Validate that the next number can be assigned.

        Args:
            sequence: The document sequence entity.
            next_value: Optional explicit next value; defaults to
                ``sequence.current_value + 1``.

        Returns:
            The validated next sequence value.

        Raises:
            BillingValidationError: If the next number cannot be assigned.
        """
        if next_value is None:
            next_value = sequence.current_value + 1

        if next_value < 1:
            raise BillingValidationError(
                f"Next sequence value must be >= 1. Got {next_value}.",
                details={"next_value": next_value},
            )

        self.validate_no_overflow(next_value)
        return next_value

    # ==================================================================
    # Configuration validation
    # ==================================================================

    def validate_configuration(
        self,
        prefix: str,
        min_digits: int,
        start_value: int | None = None,
    ) -> dict[str, object]:
        """Validate document sequence configuration values.

        Args:
            prefix: The prefix string.
            min_digits: Minimum zero-pad width.
            start_value: Optional starting sequence value.

        Returns:
            A dict with validated configuration values.

        Raises:
            BillingValidationError: If any configuration value is invalid.
        """
        validated_prefix = self.validate_prefix(prefix)

        if not isinstance(min_digits, int) or min_digits < 1:
            raise BillingValidationError(
                f"min_digits must be a positive integer. Got {min_digits!r}.",
                details={"min_digits": min_digits},
            )

        validated_start = 1
        if start_value is not None:
            if not isinstance(start_value, int) or start_value < 1:
                raise BillingValidationError(
                    f"start_value must be a positive integer. Got {start_value!r}.",
                    details={"start_value": start_value},
                )
            validated_start = start_value

        return {
            "prefix": validated_prefix,
            "min_digits": min_digits,
            "start_value": validated_start,
        }


__all__ = ["DocumentSequenceValidator"]
