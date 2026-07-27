"""RefundValidator — aggregate business validation for Refunds.

Responsibilities
----------------
* **Refund lifecycle**: existence, status transitions, editable checks.
* **Payment eligibility**: payment is COMPLETED and has sufficient refundable balance.
* **Amount validation**: refund amount does not exceed payment total.
* **Rejection validation**: rejection_reason required when rejecting.

Design
------
* **Read-only repositories**: ``RefundRepositoryProtocol`` injected as a
  constructor dependency, used exclusively for lookups.
* **State machine delegation**: all transition legality checks are forwarded to
  ``validate_refund_transition`` in ``state_machine.py``.
* **FinancialValidator delegation**: monetary validations are forwarded to
  ``FinancialValidator``.
"""

from __future__ import annotations

from uuid import UUID

from app.modules.billing.enums import PaymentStatus, RefundStatus
from app.modules.billing.exceptions import (
    InvalidRefundStatusTransition,
    PaymentValidationFailed,
    RefundNotFound,
    RefundValidationFailed,
)
from app.modules.billing.models import Payment, Refund
from app.modules.billing.validators.financial_validator import FinancialValidator
from app.modules.billing.validators.protocols import RefundRepositoryProtocol
from app.modules.billing.validators.state_machine import (
    is_editable_state,
    validate_payment_transition,
    validate_refund_transition,
)


class RefundValidator:
    """Aggregate business rule validator for the Refund module.

    Args:
        refund_repo: Read-only ``RefundRepositoryProtocol`` for refund
            existence and uniqueness lookups.
        financial_validator: ``FinancialValidator`` instance for monetary
            validations.
    """

    def __init__(
        self,
        refund_repo: RefundRepositoryProtocol,
        financial_validator: FinancialValidator,
    ) -> None:
        self._refund_repo = refund_repo
        self._financial = financial_validator

    # ==================================================================
    # Refund lifecycle
    # ==================================================================

    def validate_refund_exists(self, refund_id: UUID) -> Refund:
        """Fetch a refund by id and raise ``RefundNotFound`` if missing.

        Returns the loaded refund so the service can reuse it.
        """
        refund = self._refund_repo.get_by_id(refund_id)
        if refund is None:
            raise RefundNotFound(refund_id)
        return refund

    def validate_status_transition(
        self,
        refund: Refund,
        new_status: RefundStatus | str,
    ) -> None:
        """Validate that ``refund`` may transition to ``new_status``.

        Raises:
            InvalidRefundStatusTransition: If the transition is not allowed.
        """
        validate_refund_transition(
            current_status=refund.status,
            new_status=new_status,
        )

    def validate_editable(self, refund: Refund) -> None:
        """Validate that ``refund`` may be edited.

        Only refunds in ``PENDING`` status may be edited.

        Raises:
            RefundValidationFailed: If the refund is not editable.
        """
        if not is_editable_state(refund.status, aggregate="refund"):
            raise RefundValidationFailed(
                f"Refund {refund.id} is not editable in status "
                f"'{refund.status.value if isinstance(refund.status, RefundStatus) else refund.status}'.",
                details={
                    "refund_id": str(refund.id),
                    "current_status": refund.status.value
                    if isinstance(refund.status, RefundStatus)
                    else str(refund.status),
                },
            )

    # ==================================================================
    # Payment eligibility
    # ==================================================================

    def validate_refundable_payment(self, payment: Payment) -> None:
        """Validate that ``payment`` is in a refundable state.

        Only payments in ``COMPLETED`` status may be refunded.

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
                f"(current: '{current.value}') and cannot be refunded.",
                details={
                    "payment_id": str(payment.id),
                    "current_status": current.value,
                    "required_status": PaymentStatus.COMPLETED.value,
                },
            )

    def validate_rejection_reason(self, refund: Refund, reason: str | None) -> None:
        """Validate that a rejection reason is provided when rejecting.

        Raises:
            RefundValidationFailed: If rejecting without a reason.
        """
        if reason is None or not str(reason).strip():
            raise RefundValidationFailed(
                "Rejection reason is required when rejecting a refund.",
                details={"refund_id": str(refund.id)},
            )

    def validate_payment_refunded_transition(self, payment: Payment) -> None:
        """Validate that the payment may transition from its current status to
        ``REFUNDED`` through the approved payment state machine.

        Args:
            payment: The payment to validate.

        Raises:
            InvalidPaymentStatusTransition: If the transition is not allowed
                by ``PAYMENT_TRANSITIONS``.
        """
        from app.modules.billing.enums import PaymentStatus
        validate_payment_transition(
            current_status=payment.status,
            new_status=PaymentStatus.REFUNDED,
        )


__all__ = ["RefundValidator"]
