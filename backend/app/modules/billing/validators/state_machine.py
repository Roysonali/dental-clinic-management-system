"""Billing State Machine — pure workflow transition validation.

This module is the **sole authority** on whether a status transition is legal
for billing aggregates. It does **not** access the database, call repositories,
or perform any business-rule checks beyond transition legality — those belong
in the service layer and the data validators.

Design
------
* **Stateless** — every function is a pure, idempotent transformation.
* **No I/O** — zero database, network, or filesystem access.
* **No ORM** — operates on enums and strings only.
* **No hardcoded transitions** — all rules come from the transition maps
  defined in ``app.modules.billing.constants``.
* **Approved exceptions only** — raises billing exceptions from the approved
  exception hierarchy.

Integration
-----------
Called by the **service layer** before any status mutation::

    from app.modules.billing.validators.state_machine import (
        validate_invoice_transition,
    )

    def transition_invoice(self, invoice, new_status):
        validate_invoice_transition(invoice.status, new_status)
        invoice.status = new_status
        self.invoice_repo.update(invoice, {"status": new_status})
"""

from __future__ import annotations

from typing import overload

from app.modules.billing.constants import (
    CREDIT_NOTE_TRANSITIONS,
    INVOICE_TRANSITIONS,
    PAYMENT_TRANSITIONS,
    RECEIPT_TRANSITIONS,
    REFUND_TRANSITIONS,
)
from app.modules.billing.enums import (
    CreditNoteStatus,
    InvoiceStatus,
    PaymentStatus,
    ReceiptStatus,
    RefundStatus,
)
from app.modules.billing.exceptions import (
    InvalidCreditNoteStatusTransition,
    InvalidInvoiceStatusTransition,
    InvalidPaymentStatusTransition,
    InvalidReceiptStatusTransition,
    InvalidRefundStatusTransition,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_invoice_transition(
    current_status: InvoiceStatus | str,
    new_status: InvoiceStatus | str,
) -> None:
    """Validate that an invoice may transition from ``current_status`` to ``new_status``.

    Args:
        current_status: The invoice's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidInvoiceStatusTransition: If the transition is not listed in
            ``INVOICE_TRANSITIONS``, or if either value is not a recognised
            ``InvoiceStatus``.
    """
    from_status = _resolve_invoice_status(current_status)
    to_status = _resolve_invoice_status(new_status)

    allowed = INVOICE_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidInvoiceStatusTransition(
            from_status=from_status.value,
            to_status=to_status.value,
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def validate_payment_transition(
    current_status: PaymentStatus | str,
    new_status: PaymentStatus | str,
) -> None:
    """Validate that a payment may transition from ``current_status`` to ``new_status``.

    Args:
        current_status: The payment's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidPaymentStatusTransition: If the transition is not listed in
            ``PAYMENT_TRANSITIONS``, or if either value is not a recognised
            ``PaymentStatus``.
    """
    from_status = _resolve_payment_status(current_status)
    to_status = _resolve_payment_status(new_status)

    allowed = PAYMENT_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidPaymentStatusTransition(
            from_status=from_status.value,
            to_status=to_status.value,
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def validate_refund_transition(
    current_status: RefundStatus | str,
    new_status: RefundStatus | str,
) -> None:
    """Validate that a refund may transition from ``current_status`` to ``new_status``.

    Args:
        current_status: The refund's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidRefundStatusTransition: If the transition is not listed in
            ``REFUND_TRANSITIONS``, or if either value is not a recognised
            ``RefundStatus``.
    """
    from_status = _resolve_refund_status(current_status)
    to_status = _resolve_refund_status(new_status)

    allowed = REFUND_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidRefundStatusTransition(
            from_status=from_status.value,
            to_status=to_status.value,
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def validate_receipt_transition(
    current_status: ReceiptStatus | str,
    new_status: ReceiptStatus | str,
) -> None:
    """Validate that a receipt may transition from ``current_status`` to ``new_status``.

    Args:
        current_status: The receipt's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidReceiptStatusTransition: If the transition is not listed in
            ``RECEIPT_TRANSITIONS``, or if either value is not a recognised
            ``ReceiptStatus``.
    """
    from_status = _resolve_receipt_status(current_status)
    to_status = _resolve_receipt_status(new_status)

    allowed = RECEIPT_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidReceiptStatusTransition(
            from_status=from_status.value,
            to_status=to_status.value,
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def validate_credit_note_transition(
    current_status: CreditNoteStatus | str,
    new_status: CreditNoteStatus | str,
) -> None:
    """Validate that a credit note may transition from ``current_status`` to ``new_status``.

    Args:
        current_status: The credit note's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidCreditNoteStatusTransition: If the transition is not listed in
            ``CREDIT_NOTE_TRANSITIONS``, or if either value is not a recognised
            ``CreditNoteStatus``.
    """
    from_status = _resolve_credit_note_status(current_status)
    to_status = _resolve_credit_note_status(new_status)

    allowed = CREDIT_NOTE_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidCreditNoteStatusTransition(
            from_status=from_status.value,
            to_status=to_status.value,
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def validate_transition(
    aggregate: str,
    current_status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | str,
    new_status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | str,
) -> None:
    """Validate a transition for any billing aggregate by name.

    Args:
        aggregate: One of ``"invoice"``, ``"payment"``, ``"receipt"``,
            ``"credit_note"``.
        current_status: The current status.
        new_status: The requested target status.

    Raises:
        InvalidInvoiceStatusTransition: For ``"invoice"`` with an illegal
            transition.
        InvalidPaymentStatusTransition: For ``"payment"`` with an illegal
            transition.
        InvalidReceiptStatusTransition: For ``"receipt"`` with an illegal
            transition.
        InvalidCreditNoteStatusTransition: For ``"credit_note"`` with an illegal
            transition.
        ValueError: If ``aggregate`` is not a recognised billing aggregate.
    """
    match aggregate.lower():
        case "invoice":
            validate_invoice_transition(current_status, new_status)
        case "payment":
            validate_payment_transition(current_status, new_status)
        case "receipt":
            validate_receipt_transition(current_status, new_status)
        case "credit_note":
            validate_credit_note_transition(current_status, new_status)
        case "refund":
            validate_refund_transition(current_status, new_status)
        case _:
            raise ValueError(
                f"Unknown billing aggregate: {aggregate!r}. "
                f"Expected one of: invoice, payment, receipt, credit_note, refund."
            )


def can_transition(
    current_status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | str,
    new_status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | str,
    aggregate: str = "invoice",
) -> bool:
    """Return ``True`` if the transition is legal.

    Args:
        current_status: The current status.
        new_status: The requested target status.
        aggregate: One of ``"invoice"``, ``"payment"``, ``"receipt"``,
            ``"credit_note"`` (defaults to ``"invoice"``).

    Returns:
        ``True`` if the transition is allowed, ``False`` otherwise.
    """
    try:
        validate_transition(aggregate, current_status, new_status)
        return True
    except (InvalidInvoiceStatusTransition, InvalidPaymentStatusTransition,
            InvalidReceiptStatusTransition, InvalidCreditNoteStatusTransition,
            InvalidRefundStatusTransition):
        return False
    except ValueError:
        return False


def is_terminal_state(
    status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | str,
    aggregate: str = "invoice",
) -> bool:
    """Return ``True`` if ``status`` has **no** outgoing transitions.

    Args:
        status: A billing status enum member or its string value.
        aggregate: One of ``"invoice"``, ``"payment"``, ``"receipt"``,
            ``"credit_note"`` (defaults to ``"invoice"``).

    Returns:
        ``True`` if the status is terminal.
    """
    match aggregate.lower():
        case "invoice":
            resolved = _resolve_invoice_status(status)
        case "payment":
            resolved = _resolve_payment_status(status)
        case "receipt":
            resolved = _resolve_receipt_status(status)
        case "credit_note":
            resolved = _resolve_credit_note_status(status)
        case "refund":
            resolved = _resolve_refund_status(status)
        case _:
            raise ValueError(
                f"Unknown billing aggregate: {aggregate!r}. "
                f"Expected one of: invoice, payment, receipt, credit_note, refund."
            )
    return resolved.is_terminal()


def is_editable_state(
    status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | str,
    aggregate: str = "invoice",
) -> bool:
    """Return ``True`` if an entity in ``status`` may be edited.

    Args:
        status: A billing status enum member or its string value.
        aggregate: One of ``"invoice"``, ``"payment"``, ``"receipt"``,
            ``"credit_note"`` (defaults to ``"invoice"``).

    Returns:
        ``True`` if direct edits are allowed.
    """
    match aggregate.lower():
        case "invoice":
            resolved = _resolve_invoice_status(status)
        case "payment":
            resolved = _resolve_payment_status(status)
        case "receipt":
            resolved = _resolve_receipt_status(status)
        case "credit_note":
            resolved = _resolve_credit_note_status(status)
        case "refund":
            resolved = _resolve_refund_status(status)
        case _:
            raise ValueError(
                f"Unknown billing aggregate: {aggregate!r}. "
                f"Expected one of: invoice, payment, receipt, credit_note, refund."
            )
    return resolved.is_editable()


# ---------------------------------------------------------------------------
# Overloaded helper for type-safe generic transition lookup
# ---------------------------------------------------------------------------


@overload
def allowed_transitions(
    status: InvoiceStatus,
    aggregate: str = ...,
) -> frozenset[InvoiceStatus]: ...


@overload
def allowed_transitions(
    status: PaymentStatus,
    aggregate: str = ...,
) -> frozenset[PaymentStatus]: ...


@overload
def allowed_transitions(
    status: ReceiptStatus,
    aggregate: str = ...,
) -> frozenset[ReceiptStatus]: ...


@overload
def allowed_transitions(
    status: CreditNoteStatus,
    aggregate: str = ...,
) -> frozenset[CreditNoteStatus]: ...


@overload
def allowed_transitions(
    status: RefundStatus,
    aggregate: str = ...,
) -> frozenset[RefundStatus]: ...


def allowed_transitions(
    status: InvoiceStatus
    | PaymentStatus
    | ReceiptStatus
    | CreditNoteStatus
    | RefundStatus
    | str,
    aggregate: str = "invoice",
) -> frozenset[
    InvoiceStatus
] | frozenset[PaymentStatus] | frozenset[ReceiptStatus] | frozenset[CreditNoteStatus] | frozenset[RefundStatus]:
    """Return the set of statuses that ``status`` may transition to.

    Args:
        status: A billing status enum member or its string value.
        aggregate: One of ``"invoice"``, ``"payment"``, ``"receipt"``,
            ``"credit_note"`` (defaults to ``"invoice"``).

    Returns:
        A ``frozenset`` of allowed target statuses. An empty set means the
        status is terminal.
    """
    match aggregate.lower():
        case "invoice":
            resolved = _resolve_invoice_status(status)
            return INVOICE_TRANSITIONS.get(resolved, frozenset())
        case "payment":
            resolved = _resolve_payment_status(status)
            return PAYMENT_TRANSITIONS.get(resolved, frozenset())
        case "receipt":
            resolved = _resolve_receipt_status(status)
            return RECEIPT_TRANSITIONS.get(resolved, frozenset())
        case "credit_note":
            resolved = _resolve_credit_note_status(status)
            return CREDIT_NOTE_TRANSITIONS.get(resolved, frozenset())
        case "refund":
            resolved = _resolve_refund_status(status)
            return REFUND_TRANSITIONS.get(resolved, frozenset())
        case _:
            raise ValueError(
                f"Unknown billing aggregate: {aggregate!r}. "
                f"Expected one of: invoice, payment, receipt, credit_note, refund."
            )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_invoice_status(status: InvoiceStatus | str) -> InvoiceStatus:
    if isinstance(status, InvoiceStatus):
        return status
    if isinstance(status, str):
        try:
            return InvoiceStatus(status)
        except ValueError:
            raise InvalidInvoiceStatusTransition(
                from_status=status,
                to_status="unknown",
                details={
                    "received": status,
                    "expected_values": sorted(InvoiceStatus.all_values()),
                },
            )
    raise InvalidInvoiceStatusTransition(
        from_status=str(type(status).__name__),
        to_status="unknown",
        details={"received_type": type(status).__name__},
    )


def _resolve_payment_status(status: PaymentStatus | str) -> PaymentStatus:
    if isinstance(status, PaymentStatus):
        return status
    if isinstance(status, str):
        try:
            return PaymentStatus(status)
        except ValueError:
            raise InvalidPaymentStatusTransition(
                from_status=status,
                to_status="unknown",
                details={
                    "received": status,
                    "expected_values": sorted(PaymentStatus.all_values()),
                },
            )
    raise InvalidPaymentStatusTransition(
        from_status=str(type(status).__name__),
        to_status="unknown",
        details={"received_type": type(status).__name__},
    )


def _resolve_receipt_status(status: ReceiptStatus | str) -> ReceiptStatus:
    if isinstance(status, ReceiptStatus):
        return status
    if isinstance(status, str):
        try:
            return ReceiptStatus(status)
        except ValueError:
            raise InvalidReceiptStatusTransition(
                from_status=status,
                to_status="unknown",
                details={
                    "received": status,
                    "expected_values": sorted(ReceiptStatus.all_values()),
                },
            )
    raise InvalidReceiptStatusTransition(
        from_status=str(type(status).__name__),
        to_status="unknown",
        details={"received_type": type(status).__name__},
    )


def _resolve_refund_status(status: RefundStatus | str) -> RefundStatus:
    if isinstance(status, RefundStatus):
        return status
    if isinstance(status, str):
        try:
            return RefundStatus(status)
        except ValueError:
            raise InvalidRefundStatusTransition(
                from_status=status,
                to_status="unknown",
                details={
                    "received": status,
                    "expected_values": sorted(RefundStatus.all_values()),
                },
            )
    raise InvalidRefundStatusTransition(
        from_status=str(type(status).__name__),
        to_status="unknown",
        details={"received_type": type(status).__name__},
    )


def _resolve_credit_note_status(status: CreditNoteStatus | str) -> CreditNoteStatus:
    if isinstance(status, CreditNoteStatus):
        return status
    if isinstance(status, str):
        try:
            return CreditNoteStatus(status)
        except ValueError:
            raise InvalidCreditNoteStatusTransition(
                from_status=status,
                to_status="unknown",
                details={
                    "received": status,
                    "expected_values": sorted(CreditNoteStatus.all_values()),
                },
            )
    raise InvalidCreditNoteStatusTransition(
        from_status=str(type(status).__name__),
        to_status="unknown",
        details={"received_type": type(status).__name__},
    )
