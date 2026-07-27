"""Billing Module — Domain enums.

Application-level string enums that back ``VARCHAR`` columns. Validation of
allowed values happens in the application layer (validators / state machines);
database ``CHECK`` constraints provide a secondary integrity guarantee.

These enums are the single source of truth for the finite value sets used by
the Billing module.
"""

from __future__ import annotations

from enum import Enum


class InvoiceStatus(str, Enum):
    """Lifecycle status of an invoice (aggregate root).

    The set of values is mirrored by the ``ck_invoice_status`` database check
    constraint and by ``VALID_INVOICE_TRANSITIONS`` in ``constants.py``. Once an
    invoice reaches ``ISSUED`` it becomes immutable (see ADR-002).
    """

    DRAFT = "draft"
    ISSUED = "issued"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    VOID = "void"

    @classmethod
    def editable_statuses(cls) -> frozenset["InvoiceStatus"]:
        """Statuses that allow line-item / amount modification."""
        return frozenset({cls.DRAFT})

    @classmethod
    def terminal_statuses(cls) -> frozenset["InvoiceStatus"]:
        """Statuses with no outgoing transitions.

        Derived from ``INVOICE_TRANSITIONS`` (constants) — single source of
        truth, no duplicated terminal set.
        """
        from app.modules.billing.constants import INVOICE_TRANSITIONS

        return frozenset(
            status for status, targets in INVOICE_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this status has no outgoing transitions."""
        return self in self.terminal_statuses()

    def is_editable(self) -> bool:
        """Return ``True`` if an invoice in this status may be edited."""
        return self in self.editable_statuses()

    def is_immutable(self) -> bool:
        """Return ``True`` if the invoice is frozen (issued or beyond)."""
        return self not in self.editable_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        """All persisted status string values (for CHECK constraints)."""
        return frozenset(member.value for member in cls)


class PaymentMethod(str, Enum):
    """Method used to settle an invoice."""

    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    INSURANCE = "insurance"
    WALLET = "wallet"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class PaymentStatus(str, Enum):
    """Lifecycle status of a payment record."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    REVERSED = "reversed"
    VOID = "void"

    @classmethod
    def editable_statuses(cls) -> frozenset["PaymentStatus"]:
        """Statuses that allow modification."""
        return frozenset({cls.PENDING})

    @classmethod
    def terminal_statuses(cls) -> frozenset["PaymentStatus"]:
        """Statuses with no outgoing transitions."""
        from app.modules.billing.constants import PAYMENT_TRANSITIONS

        return frozenset(
            status for status, targets in PAYMENT_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this status has no outgoing transitions."""
        return self in self.terminal_statuses()

    def is_editable(self) -> bool:
        """Return ``True`` if a payment in this status may be edited."""
        return self in self.editable_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class PaymentAllocationType(str, Enum):
    """Kind of payment allocation against an invoice.

    A ``REFUND`` allocation always carries a positive ``allocated_amount``
    (matching the negative-values policy in the money handling policy).
    """

    PAYMENT = "payment"
    REFUND = "refund"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class CreditNoteStatus(str, Enum):
    """Lifecycle status of a credit note."""

    DRAFT = "draft"
    ISSUED = "issued"
    APPLIED = "applied"
    VOID = "void"
    EXPIRED = "expired"

    @classmethod
    def editable_statuses(cls) -> frozenset["CreditNoteStatus"]:
        """Statuses that allow modification."""
        return frozenset({cls.DRAFT})

    @classmethod
    def terminal_statuses(cls) -> frozenset["CreditNoteStatus"]:
        """Statuses with no outgoing transitions."""
        from app.modules.billing.constants import CREDIT_NOTE_TRANSITIONS

        return frozenset(
            status for status, targets in CREDIT_NOTE_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this status has no outgoing transitions."""
        return self in self.terminal_statuses()

    def is_editable(self) -> bool:
        """Return ``True`` if a credit note in this status may be edited."""
        return self in self.editable_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class ReceiptStatus(str, Enum):
    """Lifecycle status of a receipt."""

    GENERATED = "generated"
    CANCELLED = "cancelled"

    @classmethod
    def editable_statuses(cls) -> frozenset["ReceiptStatus"]:
        """Statuses that allow modification."""
        return frozenset()

    @classmethod
    def terminal_statuses(cls) -> frozenset["ReceiptStatus"]:
        """Statuses with no outgoing transitions."""
        from app.modules.billing.constants import RECEIPT_TRANSITIONS

        return frozenset(
            status for status, targets in RECEIPT_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this status has no outgoing transitions."""
        return self in self.terminal_statuses()

    def is_editable(self) -> bool:
        """Return ``True`` if a receipt in this status may be edited."""
        return self in self.editable_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class CurrencyCode(str, Enum):
    """ISO 4217 currency codes supported by the billing module (Phase 1)."""

    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    INR = "INR"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class RefundStatus(str, Enum):
    """Lifecycle status of a refund request.

    PENDING → APPROVED → COMPLETED
    PENDING → REJECTED (terminal)

    Completed refunds are immutable. Rejected refunds may be re-attempted
    as a new request.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

    @classmethod
    def editable_statuses(cls) -> frozenset["RefundStatus"]:
        """Statuses that allow modification."""
        return frozenset({cls.PENDING})

    @classmethod
    def terminal_statuses(cls) -> frozenset["RefundStatus"]:
        """Statuses with no outgoing transitions."""
        from app.modules.billing.constants import REFUND_TRANSITIONS

        return frozenset(
            status for status, targets in REFUND_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this status has no outgoing transitions."""
        return self in self.terminal_statuses()

    def is_editable(self) -> bool:
        """Return ``True`` if a refund in this status may be edited."""
        return self in self.editable_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class DocumentType(str, Enum):
    """Document categories that own an independent sequential number series.

    Mirrors the ``document_type`` column of the ``document_sequences`` table
    (ADR-003). Each value maps to its own gap-tracked sequence.
    """

    INVOICE = "invoice"
    RECEIPT = "receipt"
    CREDIT_NOTE = "credit_note"
    PAYMENT = "payment"
    REFUND = "refund"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class AuditAction(str, Enum):
    """Audit action verbs recorded for billing financial records."""

    CREATED = "created"
    UPDATED = "updated"
    STATUS_CHANGED = "status_changed"
    COMPLETED = "completed"
    FAILED = "failed"
    ISSUED = "issued"
    CANCELLED = "cancelled"
    VOIDED = "voided"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_REVERSED = "payment_reversed"
    REFUNDED = "refunded"
    CREDIT_APPLIED = "credit_applied"
    PRICE_OVERRIDDEN = "price_overridden"
    DELETED = "deleted"
    REGENERATED = "regenerated"
    REFUND_CREATED = "refund_created"
    REFUND_APPROVED = "refund_approved"
    REFUND_REJECTED = "refund_rejected"
    REFUND_COMPLETED = "refund_completed"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class SequenceConsumptionStatus(str, Enum):
    """Status of a reserved document number (gap tracking, ADR-003)."""

    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)
