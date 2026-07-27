"""PaymentValidator — aggregate business validation for Payments.

Responsibilities
----------------
* **Payment lifecycle**: existence, editable, reversible, already-reversed.
* **Amount validation**: positive amount, precision, non-negative.
* **Allocation validation**: allocation amounts, over-allocation prevention.
* **Refund validation**: refund amount does not exceed original.
* **Payment method validation**: method is a recognised ``PaymentMethod``.
* **Numbering uniqueness**: payment number must be unique.
* **Date validation**: payment date is valid.
* **Status transitions**: delegating to the state machine.

Design
------
* **Read-only repositories**: ``PaymentRepositoryProtocol`` injected as a
  constructor dependency, used exclusively for lookups.
* **State machine delegation**: all transition legality checks are forwarded to
  ``validate_payment_transition`` in ``state_machine.py``.
* **FinancialValidator delegation**: monetary validations are forwarded to
  ``FinancialValidator``.
* **Approved exceptions only**: raises ``PaymentNotFound``,
  ``InvalidPaymentStatusTransition``, ``PaymentValidationFailed``,
  ``NegativeAmountNotAllowed``, ``PaymentExceedsInvoice``,
  ``RefundExceedsPayment``, and other billing exceptions.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = PaymentValidator(payment_repo, financial_validator)

    # Before reversing a payment
    payment = validator.validate_payment_exists(payment_id)
    validator.validate_reversible(payment)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Sequence
from uuid import UUID

from app.modules.billing.constants import PAYMENT_NUMBER_MAX_LENGTH
from app.modules.billing.enums import PaymentMethod, PaymentStatus
from app.modules.billing.exceptions import (
    InvalidPaymentStatusTransition,
    NegativeAmountNotAllowed,
    PaymentExceedsInvoice,
    PaymentNotFound,
    PaymentValidationFailed,
    RefundExceedsPayment,
)
from app.modules.billing.models import Payment, PaymentAllocation
from app.modules.billing.validators.financial_validator import FinancialValidator
from app.modules.billing.validators.protocols import (
    PatientRepositoryProtocol,
    PaymentRepositoryProtocol,
)
from app.modules.billing.validators.state_machine import (
    is_editable_state,
    is_terminal_state,
    validate_payment_transition,
)


class PaymentValidator:
    """Aggregate business rule validator for the Payment module.

    Args:
        payment_repo: Read-only ``PaymentRepositoryProtocol`` for payment
            existence, uniqueness, and allocation lookups.
        financial_validator: ``FinancialValidator`` instance for monetary
            validations.
        patient_repo: Optional ``PatientRepositoryProtocol`` for patient
            existence checks (Sprint 12A FK hardening).
    """

    def __init__(
        self,
        payment_repo: PaymentRepositoryProtocol,
        financial_validator: FinancialValidator,
        patient_repo: PatientRepositoryProtocol | None = None,
    ) -> None:
        self._payment_repo = payment_repo
        self._financial = financial_validator
        self._patient_repo = patient_repo

    # ==================================================================
    # Payment lifecycle
    # ==================================================================

    def validate_payment_exists(self, payment_id: UUID) -> Payment:
        """Fetch a payment by id and raise ``PaymentNotFound`` if missing.

        Returns the loaded payment so the service can reuse it.
        """
        payment = self._payment_repo.get_by_id(payment_id)
        if payment is None:
            raise PaymentNotFound(payment_id)
        return payment

    def validate_status_transition(
        self,
        payment: Payment,
        new_status: PaymentStatus | str,
    ) -> None:
        """Validate that ``payment`` may transition to ``new_status``.

        Args:
            payment: The payment entity.
            new_status: The requested target status.

        Raises:
            InvalidPaymentStatusTransition: If the transition is not allowed.
        """
        validate_payment_transition(
            current_status=payment.status,
            new_status=new_status,
        )

    def validate_editable(self, payment: Payment) -> None:
        """Validate that ``payment`` may be edited.

        Only payments in ``PENDING`` status may be edited.

        Raises:
            PaymentValidationFailed: If the payment is not editable.
        """
        if not is_editable_state(payment.status, aggregate="payment"):
            raise PaymentValidationFailed(
                f"Payment {payment.id} is not editable in status "
                f"'{payment.status.value if isinstance(payment.status, PaymentStatus) else payment.status}'.",
                details={
                    "payment_id": str(payment.id),
                    "current_status": payment.status.value
                    if isinstance(payment.status, PaymentStatus)
                    else str(payment.status),
                },
            )

    def validate_allocatable(self, payment: Payment) -> None:
        """Validate that ``payment`` is in a status that may be allocated.

        Only payments in ``COMPLETED`` status may have allocations created
        or modified. Allocations represent distribution of settled funds
        to invoices.

        Raises:
            PaymentValidationFailed: If the payment is not COMPLETED.
        """
        current = (
            payment.status
            if isinstance(payment.status, PaymentStatus)
            else PaymentStatus(payment.status)
        )
        if current != PaymentStatus.COMPLETED:
            raise PaymentValidationFailed(
                f"Payment {payment.id} is not in COMPLETED status "
                f"(current: '{current.value}') and cannot be allocated.",
                details={
                    "payment_id": str(payment.id),
                    "current_status": current.value,
                    "required_status": PaymentStatus.COMPLETED.value,
                },
            )

    def validate_reversible(self, payment: Payment) -> None:
        """Validate that ``payment`` may be reversed.

        Only payments in ``COMPLETED`` status may be reversed.

        Raises:
            InvalidPaymentStatusTransition: If the payment is not in COMPLETED.
            PaymentValidationFailed: If the payment is already reversed or
                ``reversal_reason`` is missing or blank.
        """
        if payment.is_reversed:
            raise PaymentValidationFailed(
                f"Payment {payment.id} is already reversed.",
                details={"payment_id": str(payment.id)},
            )

        current = (
            payment.status
            if isinstance(payment.status, PaymentStatus)
            else PaymentStatus(payment.status)
        )
        if current != PaymentStatus.COMPLETED:
            raise InvalidPaymentStatusTransition(
                from_status=current.value,
                to_status=PaymentStatus.REVERSED.value,
                details={
                    "payment_id": str(payment.id),
                    "current_status": current.value,
                },
            )

        if not payment.reversal_reason or not str(payment.reversal_reason).strip():
            raise PaymentValidationFailed(
                "reversal_reason is required when reversing a payment",
                details={"payment_id": str(payment.id)},
            )

    def validate_already_reversed(self, payment: Payment) -> None:
        """Validate that ``payment`` has not already been reversed.

        Raises:
            PaymentValidationFailed: If the payment is already reversed.
        """
        if payment.is_reversed:
            raise PaymentValidationFailed(
                f"Payment {payment.id} is already reversed.",
                details={"payment_id": str(payment.id)},
            )

    # ==================================================================
    # Amount validators
    # ==================================================================

    def validate_amount_positive(
        self,
        value: object,
        *,
        field: str = "total_amount",
    ) -> Decimal:
        """Validate that the payment amount is positive.

        Args:
            value: The amount to validate.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` amount.

        Raises:
            NegativeAmountNotAllowed: If ``value`` is not positive.
        """
        return self._financial.validate_positive_amount(value, field=field)

    def validate_amount_non_negative(
        self,
        value: object,
        *,
        field: str = "amount",
    ) -> Decimal:
        """Validate that an amount is non-negative.

        Args:
            value: The amount to validate.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` amount.
        """
        return self._financial.validate_non_negative_amount(value, field=field)

    # ==================================================================
    # Allocation validators
    # ==================================================================

    def validate_allocation_amount(
        self,
        payment: Payment,
        allocation_amount: object,
        existing_allocations: Sequence[PaymentAllocation] | None = None,
        *,
        field: str = "allocated_amount",
    ) -> Decimal:
        """Validate that an allocation amount is valid and does not over-allocate.

        Args:
            payment: The payment being allocated.
            allocation_amount: The proposed allocation amount.
            existing_allocations: Optional existing allocations (for new
                allocations, pass the current list).
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` allocation.

        Raises:
            PaymentExceedsInvoice: If the total allocated exceeds the payment.
        """
        alloc = self._financial.validate_positive_amount(
            allocation_amount, field=field
        )

        total_allocated = sum(
            a.allocated_amount for a in (existing_allocations or payment.payment_allocations)
        )
        if total_allocated + alloc > payment.total_amount:
            raise PaymentExceedsInvoice(
                details={
                    "payment_id": str(payment.id),
                    "payment_total": str(payment.total_amount),
                    "total_allocated": str(total_allocated),
                    "new_allocation": str(alloc),
                }
            )
        return alloc

    def validate_no_over_allocation(
        self,
        payment: Payment,
        new_allocation_total: object,
    ) -> None:
        """Validate that the total allocated does not exceed the payment amount.

        .. note::

           This method is intentionally retained for future use by the
           refund workflow (Sprint 5C.5+). It is not currently called by
           any service method — the allocation flow computes over-allocation
           inline to avoid an extra pass over the allocation collection.

        Args:
            payment: The payment being validated.
            new_allocation_total: The proposed total allocation.

        Raises:
            PaymentExceedsInvoice: If ``new_allocation_total`` exceeds the
                payment total.
        """
        total = self._financial.validate_non_negative_amount(
            new_allocation_total, field="total_allocated"
        )
        if total > payment.total_amount:
            raise PaymentExceedsInvoice(
                details={
                    "payment_id": str(payment.id),
                    "payment_total": str(payment.total_amount),
                    "total_allocated": str(total),
                }
            )

    def validate_refund_amount(
        self,
        payment: Payment,
        refund_amount: object,
        existing_refund_total: object,
    ) -> Decimal:
        """Validate that a refund amount does not exceed limits.

        Args:
            payment: The payment being refunded.
            refund_amount: The proposed refund amount.
            existing_refund_total: Sum of existing refunds for this payment.

        Returns:
            The validated, quantized :class:`Decimal` refund amount.

        Raises:
            RefundExceedsPayment: If the total refund exceeds the payment.
            NegativeAmountNotAllowed: If ``refund_amount`` is negative.
        """
        ref = self._financial.validate_positive_amount(
            refund_amount, field="refund_amount"
        )
        existing = self._financial.validate_non_negative_amount(
            existing_refund_total, field="existing_refund_total"
        )
        if existing + ref > payment.total_amount:
            raise RefundExceedsPayment(
                details={
                    "payment_id": str(payment.id),
                    "payment_total": str(payment.total_amount),
                    "existing_refunds": str(existing),
                    "new_refund": str(ref),
                }
            )
        return ref

    # ==================================================================
    # Payment method
    # ==================================================================

    def validate_payment_method(self, method: object) -> PaymentMethod:
        """Validate that ``method`` is a recognised payment method.

        Args:
            method: Candidate payment method.

        Returns:
            The validated :class:`PaymentMethod` member.

        Raises:
            PaymentValidationFailed: If the method is invalid.
        """
        if isinstance(method, PaymentMethod):
            return method
        if isinstance(method, str):
            try:
                return PaymentMethod(method)
            except ValueError:
                raise PaymentValidationFailed(
                    f"Unrecognised payment method: {method!r}. "
                    f"Must be one of: {', '.join(sorted(PaymentMethod.all_values()))}",
                    details={
                        "method": method,
                        "allowed": sorted(PaymentMethod.all_values()),
                    },
                )
        raise PaymentValidationFailed(
            f"Payment method must be a string or PaymentMethod enum. "
            f"Got {type(method).__name__!r}.",
            details={"received_type": type(method).__name__},
        )

    # ==================================================================
    # Numbering
    # ==================================================================

    def validate_payment_number_unique(
        self,
        payment_number: str,
        exclude_payment_id: UUID | None = None,
    ) -> None:
        """Validate that ``payment_number`` is unique across all payments.

        Concurrency Note:
        Service layer must perform uniqueness validation inside a transaction
        using optimistic locking or SELECT FOR UPDATE where appropriate.
        Validators remain pure.

        Args:
            payment_number: The payment number to check.
            exclude_payment_id: Optional payment id to exclude (for updates).

        Raises:
            PaymentValidationFailed: If another payment already has this number.
        """
        existing = self._payment_repo.get_by_payment_number(payment_number)
        if existing is not None and existing.id != exclude_payment_id:
            raise PaymentValidationFailed(
                f"Payment number '{payment_number}' has already been used",
                details={
                    "payment_number": payment_number,
                    "existing_payment_id": str(existing.id),
                },
            )

    def validate_payment_number_format(self, payment_number: str) -> None:
        """Validate that ``payment_number`` is within max length and non-empty.

        Raises:
            PaymentValidationFailed: If the number is invalid.
        """
        if not isinstance(payment_number, str) or not payment_number.strip():
            raise PaymentValidationFailed(
                "Payment number is required",
                details={"payment_number": payment_number},
            )

        payment_number = payment_number.strip()
        if len(payment_number) > PAYMENT_NUMBER_MAX_LENGTH:
            raise PaymentValidationFailed(
                f"Payment number must be at most {PAYMENT_NUMBER_MAX_LENGTH} "
                f"characters. Got {len(payment_number)}.",
                details={
                    "payment_number": payment_number,
                    "length": len(payment_number),
                    "max_length": PAYMENT_NUMBER_MAX_LENGTH,
                },
            )

    # ==================================================================
    # Date
    # ==================================================================

    def validate_payment_date(self, payment_date: date | None) -> None:
        """Validate that ``payment_date`` is a valid date.

        Raises:
            PaymentValidationFailed: If the date is invalid.
        """
        if payment_date is None:
            raise PaymentValidationFailed(
                "Payment date is required",
                details={"payment_date": None},
            )
        if not isinstance(payment_date, date):
            raise PaymentValidationFailed(
                f"Payment date must be a date, got {type(payment_date).__name__!r}",
                details={"payment_date": str(payment_date)},
            )

    # ==================================================================
    # Foreign-key existence validation (Sprint 12A)
    # ==================================================================

    def validate_patient_exists(self, patient_id: UUID) -> None:
        """Validate that a patient with the given id exists.

        Raises ``PatientNotFound`` (404) if the patient does not exist.
        Uses ``PatientRepositoryProtocol`` for the lookup — no persistence
        or transaction management.

        Raises:
            PatientNotFound: If ``patient_id`` does not resolve to an existing
                patient record.
        """
        if self._patient_repo is None:
            raise RuntimeError(
                "PatientRepositoryProtocol is required for patient existence "
                "validation but was not provided to PaymentValidator"
            )
        if not self._patient_repo.exists(patient_id):
            from app.modules.patients.exceptions import PatientNotFound
            raise PatientNotFound()


__all__ = ["PaymentValidator"]
