"""Billing Module — Domain exception hierarchy.

Every domain error raised by the Billing service/validator layers inherits from
:class:`BillingException`. Each concrete subclass carries a stable ``code`` (used
by clients and the global exception handler in ``app.core.exception_handlers``)
and a human-readable ``message``.

Exceptions are grouped by nature through intermediate base classes
(``*Error``) that document intent and keep the hierarchy maintainable. The
intermediate bases never carry HTTP semantics and are never raised directly —
HTTP status mapping stays in :mod:`app.core.exception_handlers`.

Per the layered architecture, exceptions are raised by the **service** and
**validator** layers and mapped to HTTP status codes at the edge, never inside
routers.
"""

from __future__ import annotations

from typing import Any


class BillingException(Exception):
    """Base exception for all Billing domain errors."""

    code: str = "BILLING_ERROR"
    default_message: str = "Billing operation failed"

    def __init__(
        self,
        message: str | None = None,
        *,
        details: Any = None,
    ) -> None:
        self.message = message or self.default_message
        self.details = details
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to the standard DensCare error envelope."""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


class BillingNotFoundError(BillingException):
    """Base for not-found domain errors (mapped to HTTP 404)."""


class BillingConflictError(BillingException):
    """Base for conflict / invalid-operation errors (mapped to HTTP 409)."""


class BillingValidationError(BillingException):
    """Base for input / validation errors (mapped to HTTP 422)."""


class BillingFinancialError(BillingException):
    """Base for financial-integrity violations (mapped to HTTP 422/400)."""


# ==========================================================
# Not found (404)
# ==========================================================
class InvoiceNotFound(BillingNotFoundError):
    """Raised when an invoice id does not resolve to a record."""

    code = "INVOICE_NOT_FOUND"
    default_message = "Invoice not found"

    def __init__(self, invoice_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Invoice not found: {invoice_id}",
            details=details or {"invoice_id": str(invoice_id)},
        )


class InvoiceLineItemNotFound(BillingNotFoundError):
    """Raised when a line item id does not resolve to a record."""

    code = "INVOICE_LINE_ITEM_NOT_FOUND"
    default_message = "Invoice line item not found"

    def __init__(self, line_item_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Invoice line item not found: {line_item_id}",
            details=details or {"line_item_id": str(line_item_id)},
        )


class PaymentNotFound(BillingNotFoundError):
    """Raised when a payment id does not resolve to a record."""

    code = "PAYMENT_NOT_FOUND"
    default_message = "Payment not found"

    def __init__(self, payment_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Payment not found: {payment_id}",
            details=details or {"payment_id": str(payment_id)},
        )


class ReceiptNotFound(BillingNotFoundError):
    """Raised when a receipt id does not resolve to a record."""

    code = "RECEIPT_NOT_FOUND"
    default_message = "Receipt not found"

    def __init__(self, receipt_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Receipt not found: {receipt_id}",
            details=details or {"receipt_id": str(receipt_id)},
        )


class CreditNoteNotFound(BillingNotFoundError):
    """Raised when a credit note id does not resolve to a record."""

    code = "CREDIT_NOTE_NOT_FOUND"
    default_message = "Credit note not found"

    def __init__(self, credit_note_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Credit note not found: {credit_note_id}",
            details=details or {"credit_note_id": str(credit_note_id)},
        )


class DocumentSequenceNotFound(BillingNotFoundError):
    """Raised when no sequence row exists for a document type."""

    code = "DOCUMENT_SEQUENCE_NOT_FOUND"
    default_message = "Document sequence not found for document type"

    def __init__(self, document_type: str, *, details: Any = None) -> None:
        super().__init__(
            f"Document sequence not found for '{document_type}'",
            details=details or {"document_type": document_type},
        )


class PatientCreditNotFound(BillingNotFoundError):
    """Raised when a patient credit id does not resolve to a record."""

    code = "PATIENT_CREDIT_NOT_FOUND"
    default_message = "Patient credit not found"

    def __init__(self, patient_credit_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Patient credit not found: {patient_credit_id}",
            details=details or {"patient_credit_id": str(patient_credit_id)},
        )


# ==========================================================
# Conflicts / invalid operations (409)
# ==========================================================
class InvoiceNotEditable(BillingConflictError):
    """Raised when an immutable (issued or beyond) invoice is modified."""

    code = "INVOICE_NOT_EDITABLE"
    default_message = "Invoice is not editable in its current status"

    def __init__(self, invoice_id: Any, status: str, *, details: Any = None) -> None:
        super().__init__(
            f"Invoice {invoice_id} is not editable in status '{status}'",
            details=details or {"invoice_id": str(invoice_id), "status": status},
        )


class InvalidInvoiceStatusTransition(BillingConflictError):
    """Raised for an illegal invoice status transition."""

    code = "INVALID_INVOICE_STATUS_TRANSITION"
    default_message = "Invalid invoice status transition"

    def __init__(
        self, from_status: str, to_status: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Invalid invoice status transition: {from_status} -> {to_status}",
            details=details or {"from": from_status, "to": to_status},
        )


class InvalidPaymentStatusTransition(BillingConflictError):
    """Raised for an illegal payment status transition."""

    code = "INVALID_PAYMENT_STATUS_TRANSITION"
    default_message = "Invalid payment status transition"

    def __init__(
        self, from_status: str, to_status: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Invalid payment status transition: {from_status} -> {to_status}",
            details=details or {"from": from_status, "to": to_status},
        )


class InvalidReceiptStatusTransition(BillingConflictError):
    """Raised for an illegal receipt status transition."""

    code = "INVALID_RECEIPT_STATUS_TRANSITION"
    default_message = "Invalid receipt status transition"

    def __init__(
        self, from_status: str, to_status: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Invalid receipt status transition: {from_status} -> {to_status}",
            details=details or {"from": from_status, "to": to_status},
        )


class InvalidCreditNoteStatusTransition(BillingConflictError):
    """Raised for an illegal credit note status transition."""

    code = "INVALID_CREDIT_NOTE_STATUS_TRANSITION"
    default_message = "Invalid credit note status transition"

    def __init__(
        self, from_status: str, to_status: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Invalid credit note status transition: {from_status} -> {to_status}",
            details=details or {"from": from_status, "to": to_status},
        )


class InvalidRefundStatusTransition(BillingConflictError):
    """Raised for an illegal refund status transition."""

    code = "INVALID_REFUND_STATUS_TRANSITION"
    default_message = "Invalid refund status transition"

    def __init__(
        self, from_status: str, to_status: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Invalid refund status transition: {from_status} -> {to_status}",
            details=details or {"from": from_status, "to": to_status},
        )


class DuplicateInvoiceDetected(BillingConflictError):
    """Raised when an invoice number collides (should be rare)."""

    code = "DUPLICATE_INVOICE"
    default_message = "An invoice with this number already exists"


class DuplicateLineItemSequence(BillingConflictError):
    """Raised when a line item sequence number is reused within an invoice."""

    code = "DUPLICATE_LINE_ITEM_SEQUENCE"
    default_message = "A line item with this sequence number already exists"

    def __init__(self, invoice_id: Any, sequence: int, *, details: Any = None) -> None:
        super().__init__(
            f"A line item with sequence {sequence} already exists in invoice {invoice_id}",
            details=details or {"invoice_id": str(invoice_id), "sequence": sequence},
        )


class InvoiceNumberAlreadyUsed(BillingConflictError):
    """Raised when a consumed invoice number is reused."""

    code = "INVOICE_NUMBER_ALREADY_USED"
    default_message = "This invoice number has already been used"

    def __init__(self, invoice_number: str, *, details: Any = None) -> None:
        super().__init__(
            f"Invoice number '{invoice_number}' has already been used",
            details=details or {"invoice_number": invoice_number},
        )


class AllocationNotFound(BillingNotFoundError):
    """Raised when a payment allocation id does not resolve."""

    code = "ALLOCATION_NOT_FOUND"
    default_message = "Payment allocation not found"

    def __init__(self, allocation_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Payment allocation not found: {allocation_id}",
            details=details or {"allocation_id": str(allocation_id)},
        )


class RefundNotFound(BillingNotFoundError):
    """Raised when a refund id does not resolve to a record."""

    code = "REFUND_NOT_FOUND"
    default_message = "Refund not found"

    def __init__(self, refund_id: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Refund not found: {refund_id}",
            details=details or {"refund_id": str(refund_id)},
        )


class PaymentAlreadyAllocated(BillingConflictError):
    """Raised when a payment is allocated beyond its total amount.

    .. note::

       This exception is intentionally retained for future use by the
       refund workflow (Sprint 5C.5+). The current allocation flow raises
       ``PaymentExceedsInvoice`` instead for a more descriptive error
       message. ``PaymentAlreadyAllocated`` will be raised by the refund
       engine when a payment has no remaining unallocated amount to refund.
    """

    code = "PAYMENT_ALREADY_ALLOCATED"
    default_message = "Payment allocation exceeds the available payment amount"


class CreditNoteNotApplicable(BillingConflictError):
    """Raised when a credit note cannot be applied (expired/void/already used)."""

    code = "CREDIT_NOTE_NOT_APPLICABLE"
    default_message = "Credit note cannot be applied in its current state"


# ==========================================================
# Validation (422)
# ==========================================================
class InvoiceValidationFailed(BillingValidationError):
    """Raised when invoice-level validation (payload/business) fails."""

    code = "INVOICE_VALIDATION_FAILED"
    default_message = "Invoice validation failed"


class LineItemValidationFailed(BillingValidationError):
    """Raised when a line item fails validation."""

    code = "LINE_ITEM_VALIDATION_FAILED"
    default_message = "Invoice line item validation failed"


class PaymentValidationFailed(BillingValidationError):
    """Raised when payment-level validation fails."""

    code = "PAYMENT_VALIDATION_FAILED"
    default_message = "Payment validation failed"


class PaymentNotEditable(BillingConflictError):
    """Raised when a non-pending payment is modified."""

    code = "PAYMENT_NOT_EDITABLE"
    default_message = "Payment is not editable in its current status"

    def __init__(self, payment_id: Any, status: str, *, details: Any = None) -> None:
        super().__init__(
            f"Payment {payment_id} is not editable in status '{status}'",
            details=details or {"payment_id": str(payment_id), "status": status},
        )


class ReceiptValidationFailed(BillingValidationError):
    """Raised when receipt-level validation fails."""

    code = "RECEIPT_VALIDATION_FAILED"
    default_message = "Receipt validation failed"


class CreditNoteValidationFailed(BillingValidationError):
    """Raised when credit note-level validation fails."""

    code = "CREDIT_NOTE_VALIDATION_FAILED"
    default_message = "Credit note validation failed"


class RefundValidationFailed(BillingValidationError):
    """Raised when refund-level validation fails."""

    code = "REFUND_VALIDATION_FAILED"
    default_message = "Refund validation failed"


class PatientCreditValidationFailed(BillingValidationError):
    """Raised when patient credit-level validation fails."""

    code = "PATIENT_CREDIT_VALIDATION_FAILED"
    default_message = "Patient credit validation failed"


# ==========================================================
# Financial integrity violations (422 / 400)
# ==========================================================
class NegativeAmountNotAllowed(BillingFinancialError):
    """Raised when a monetary value must be non-negative but is negative."""

    code = "NEGATIVE_AMOUNT_NOT_ALLOWED"
    default_message = "Monetary amount must not be negative"

    def __init__(self, field: str, value: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Field '{field}' must not be negative (got {value})",
            details=details or {"field": field, "value": str(value)},
        )


class CurrencyMismatch(BillingFinancialError):
    """Raised when mixed currencies are combined on a single document."""

    code = "CURRENCY_MISMATCH"
    default_message = "All amounts on a document must share the same currency"

    def __init__(
        self, expected: str, actual: str, *, details: Any = None
    ) -> None:
        super().__init__(
            f"Currency mismatch: expected {expected}, got {actual}",
            details=details or {"expected": expected, "actual": actual},
        )


class PrecisionExceeded(BillingFinancialError):
    """Raised when a monetary value exceeds its column precision."""

    code = "PRECISION_EXCEEDED"
    default_message = "Monetary value exceeds permitted precision"

    def __init__(self, field: str, value: Any, *, details: Any = None) -> None:
        super().__init__(
            f"Field '{field}' value {value} exceeds permitted precision",
            details=details or {"field": field, "value": str(value)},
        )


class PaymentExceedsInvoice(BillingFinancialError):
    """Raised when allocations exceed the invoice grand total."""

    code = "PAYMENT_EXCEEDS_INVOICE"
    default_message = "Allocated payments cannot exceed the invoice grand total"


class RefundExceedsPayment(BillingFinancialError):
    """Raised when a refund exceeds the original payment amount."""

    code = "REFUND_EXCEEDS_PAYMENT"
    default_message = "Refund amount cannot exceed the original payment amount"


class GrandTotalMismatch(BillingFinancialError):
    """Raised when a supplied total disagrees with the computed total."""

    code = "GRAND_TOTAL_MISMATCH"
    default_message = "Provided total does not match the computed total"

    def __init__(
        self,
        provided: Any,
        computed: Any,
        *,
        details: Any = None,
    ) -> None:
        super().__init__(
            f"Provided total {provided} does not match computed total {computed}",
            details=details or {"provided": str(provided), "computed": str(computed)},
        )


# ==========================================================
# System / infrastructure (500)
# ==========================================================
class InvoiceCreationFailed(BillingException):
    """Raised when invoice persistence fails for a non-business reason."""

    code = "INVOICE_CREATION_FAILED"
    default_message = "Failed to create invoice"


class SequenceReservationFailed(BillingException):
    """Raised when document number reservation fails."""

    code = "SEQUENCE_RESERVATION_FAILED"
    default_message = "Failed to reserve a document number"


class PaymentCreationFailed(BillingException):
    """Raised when payment persistence fails for a non-business reason."""

    code = "PAYMENT_CREATION_FAILED"
    default_message = "Failed to create payment"


class CreditNoteCreationFailed(BillingException):
    """Raised when credit note persistence fails for a non-business reason."""

    code = "CREDIT_NOTE_CREATION_FAILED"
    default_message = "Failed to create credit note"


class RefundCreationFailed(BillingException):
    """Raised when refund persistence fails for a non-business reason."""

    code = "REFUND_CREATION_FAILED"
    default_message = "Failed to process refund"
