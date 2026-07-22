"""ReceiptValidator — aggregate business validation for Receipts.

Responsibilities
----------------
* **Receipt lifecycle**: existence, immutable, cancellable.
* **Numbering validation**: receipt number must be unique and valid format.
* **Patient ownership**: receipt belongs to the patient of the originating payment.
* **Status transitions**: delegating to the state machine.

Design
------
* **Read-only repositories**: ``ReceiptRepositoryProtocol`` injected as a
  constructor dependency, used exclusively for lookups.
* **State machine delegation**: all transition legality checks are forwarded to
  ``validate_receipt_transition`` in ``state_machine.py``.
* **Approved exceptions only**: raises ``ReceiptNotFound``,
  ``InvalidReceiptStatusTransition``, ``ReceiptValidationFailed``, and other
  billing exceptions.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = ReceiptValidator(receipt_repo)

    # Before cancelling a receipt
    receipt = validator.validate_receipt_exists(receipt_id)
    validator.validate_cancellable(receipt)
"""

from __future__ import annotations

from uuid import UUID

from app.modules.billing.constants import RECEIPT_NUMBER_MAX_LENGTH
from app.modules.billing.enums import ReceiptStatus
from app.modules.billing.exceptions import (
    InvalidReceiptStatusTransition,
    ReceiptNotFound,
    ReceiptValidationFailed,
)
from app.modules.billing.models import Payment, Receipt
from app.modules.billing.validators.protocols import ReceiptRepositoryProtocol
from app.modules.billing.validators.state_machine import (
    is_terminal_state,
    validate_receipt_transition,
)


class ReceiptValidator:
    """Aggregate business rule validator for the Receipt module.

    Args:
        receipt_repo: Read-only ``ReceiptRepositoryProtocol`` for receipt
            existence, uniqueness, and payment lookups.
    """

    def __init__(self, receipt_repo: ReceiptRepositoryProtocol) -> None:
        self._receipt_repo = receipt_repo

    # ==================================================================
    # Receipt lifecycle
    # ==================================================================

    def validate_generatable(self, payment: Payment) -> None:
        """Validate that a receipt can be generated for the given payment.

        A receipt can be generated when:
        1. The payment is in ``COMPLETED`` status.
        2. No receipt already exists for this payment (``payment_id`` is
           ``UNIQUE`` on the ``Receipt`` model).

        Args:
            payment: The payment entity (already loaded by the service).

        Raises:
            ReceiptValidationFailed: If the payment is not COMPLETED or a
                receipt already exists.
        """
        from app.modules.billing.enums import PaymentStatus

        current = (
            payment.status
            if isinstance(payment.status, PaymentStatus)
            else PaymentStatus(payment.status)
        )
        if current != PaymentStatus.COMPLETED:
            raise ReceiptValidationFailed(
                f"Cannot generate receipt for payment {payment.id}: "
                f"payment is in '{current.value}' status (must be COMPLETED).",
                details={
                    "payment_id": str(payment.id),
                    "current_status": current.value,
                    "required_status": PaymentStatus.COMPLETED.value,
                },
            )

        existing = self._receipt_repo.find_by_payment(payment.id)
        if existing is not None:
            raise ReceiptValidationFailed(
                f"A receipt already exists for payment {payment.id}: "
                f"receipt {existing.receipt_number}.",
                details={
                    "payment_id": str(payment.id),
                    "existing_receipt_id": str(existing.id),
                    "existing_receipt_number": existing.receipt_number,
                },
            )

    def validate_receipt_exists(self, receipt_id: UUID) -> Receipt:
        """Fetch a receipt by id and raise ``ReceiptNotFound`` if missing.

        Returns the loaded receipt so the service can reuse it.
        """
        receipt = self._receipt_repo.get_by_id(receipt_id)
        if receipt is None:
            raise ReceiptNotFound(receipt_id)
        return receipt

    def validate_status_transition(
        self,
        receipt: Receipt,
        new_status: ReceiptStatus | str,
    ) -> None:
        """Validate that ``receipt`` may transition to ``new_status``.

        Args:
            receipt: The receipt entity.
            new_status: The requested target status.

        Raises:
            InvalidReceiptStatusTransition: If the transition is not allowed.
        """
        validate_receipt_transition(
            current_status=receipt.status,
            new_status=new_status,
        )

    def validate_immutable(self, receipt: Receipt) -> None:
        """Validate that ``receipt`` is immutable.

        Receipts are immutable after creation (FI-RCP-001). All receipt
        statuses are treated as immutable. This method is a defensive
        no-op placeholder to maintain a consistent validator interface
        across aggregates.

        Note:
            Currently all receipt statuses are immutable, so this method
            never raises for standard receipts. It exists as a defensive
            guard for future status additions.
        """

    def validate_regeneratable(self, receipt: Receipt) -> None:
        """Validate that ``receipt`` may be regenerated.

        Regeneration is allowed only from ``GENERATED`` status. A receipt
        is always reproduced from its existing data — regeneration does
        not create a new financial record.

        Raises:
            ReceiptValidationFailed: If the receipt is not in GENERATED
                status.
        """
        current = (
            receipt.status
            if isinstance(receipt.status, ReceiptStatus)
            else ReceiptStatus(receipt.status)
        )
        if current != ReceiptStatus.GENERATED:
            raise ReceiptValidationFailed(
                f"Cannot regenerate receipt {receipt.receipt_number}: "
                f"receipt is in '{current.value}' status "
                f"(must be GENERATED).",
                details={
                    "receipt_id": str(receipt.id),
                    "receipt_number": receipt.receipt_number,
                    "current_status": current.value,
                    "required_status": ReceiptStatus.GENERATED.value,
                },
            )

    def validate_cancellable(self, receipt: Receipt) -> None:
        """Validate that a receipt can be cancelled.

        Cancellation is allowed only from GENERATED status.

        Raises:
            InvalidReceiptStatusTransition: If the receipt is not in GENERATED.
        """
        current = (
            receipt.status
            if isinstance(receipt.status, ReceiptStatus)
            else ReceiptStatus(receipt.status)
        )
        if current != ReceiptStatus.GENERATED:
            raise InvalidReceiptStatusTransition(
                from_status=current.value,
                to_status=ReceiptStatus.CANCELLED.value,
                details={
                    "receipt_id": str(receipt.id),
                    "current_status": current.value,
                },
            )

    # ==================================================================
    # Numbering
    # ==================================================================

    def validate_receipt_number_unique(
        self,
        receipt_number: str,
        exclude_receipt_id: UUID | None = None,
    ) -> None:
        """Validate that ``receipt_number`` is unique across all receipts.

        Args:
            receipt_number: The receipt number to check.
            exclude_receipt_id: Optional receipt id to exclude (for updates).

        Raises:
            ReceiptValidationFailed: If another receipt already has this number.
        """
        existing = self._receipt_repo.get_by_receipt_number(receipt_number)
        if existing is not None and existing.id != exclude_receipt_id:
            raise ReceiptValidationFailed(
                f"Receipt number '{receipt_number}' has already been used",
                details={
                    "receipt_number": receipt_number,
                    "existing_receipt_id": str(existing.id),
                },
            )

    def validate_receipt_number_format(self, receipt_number: str) -> None:
        """Validate that ``receipt_number`` is within max length and non-empty.

        Raises:
            ReceiptValidationFailed: If the number is invalid.
        """
        if not isinstance(receipt_number, str) or not receipt_number.strip():
            raise ReceiptValidationFailed(
                "Receipt number is required",
                details={"receipt_number": receipt_number},
            )

        receipt_number = receipt_number.strip()
        if len(receipt_number) > RECEIPT_NUMBER_MAX_LENGTH:
            raise ReceiptValidationFailed(
                f"Receipt number must be at most {RECEIPT_NUMBER_MAX_LENGTH} "
                f"characters. Got {len(receipt_number)}.",
                details={
                    "receipt_number": receipt_number,
                    "length": len(receipt_number),
                    "max_length": RECEIPT_NUMBER_MAX_LENGTH,
                },
            )

    # ==================================================================
    # Payment ownership
    # ==================================================================

    def validate_belongs_to_payment(
        self,
        receipt: Receipt,
        payment_id: UUID,
    ) -> None:
        """Validate that ``receipt`` belongs to ``payment_id``.

        Raises:
            ReceiptValidationFailed: If the receipt does not belong to the
                specified payment.
        """
        if receipt.payment_id != payment_id:
            raise ReceiptValidationFailed(
                f"Receipt {receipt.id} does not belong to payment {payment_id}",
                details={
                    "receipt_id": str(receipt.id),
                    "receipt_payment_id": str(receipt.payment_id),
                    "expected_payment_id": str(payment_id),
                },
            )


__all__ = ["ReceiptValidator"]
