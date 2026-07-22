"""InvoiceValidator — aggregate business validation for Invoices.

Responsibilities
----------------
* **Invoice lifecycle**: existence, editable, immutable, cancellable, voidable,
  issuable, payable checks.
* **Patient ownership**: invoice belongs to the specified patient.
* **Line items**: presence, sequence uniqueness, amount validation.
* **Numbering**: invoice number uniqueness.
* **Dates**: invoice date and due date validation.
* **Status transitions**: delegating to the state machine with business-policy
  augmentation.
* **Discount**: discount amount and percentage validation.
* **Total consistency**: grand total vs computed total.
* **Currency**: currency code validation and consistency.

Design
------
* **Read-only repositories**: ``InvoiceRepositoryProtocol`` injected as a
  constructor dependency, used exclusively for lookups.
* **State machine delegation**: all transition legality checks are forwarded to
  ``validate_invoice_transition`` in ``state_machine.py`` — never duplicated
  here.
* **FinancialValidator delegation**: monetary validations are forwarded to
  ``FinancialValidator``.
* **Approved exceptions only**: raises ``InvoiceNotFound``,
  ``InvoiceNotEditable``, ``InvalidInvoiceStatusTransition``,
  ``InvoiceValidationFailed``, ``DuplicateLineItemSequence``,
  ``InvoiceNumberAlreadyUsed``, ``GrandTotalMismatch``, ``CurrencyMismatch``,
  ``NegativeAmountNotAllowed``, and other billing exceptions.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = InvoiceValidator(invoice_repo, financial_validator)

    # Before issuing an invoice
    invoice = validator.validate_invoice_exists(invoice_id)
    validator.validate_editable(invoice)
    validator.validate_has_line_items(invoice)
    validator.validate_status_transition(invoice, InvoiceStatus.ISSUED)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Sequence
from uuid import UUID

from app.modules.billing.constants import (
    INVOICE_NUMBER_MAX_LENGTH,
    MIN_LINE_ITEMS_PER_INVOICE,
)
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.exceptions import (
    CurrencyMismatch,
    DuplicateLineItemSequence,
    GrandTotalMismatch,
    InvoiceNotEditable,
    InvoiceNumberAlreadyUsed,
    InvoiceNotFound,
    InvoiceValidationFailed,
    InvalidInvoiceStatusTransition,
    NegativeAmountNotAllowed,
)
from app.modules.billing.models import Invoice, InvoiceItem
from app.modules.billing.validators.financial_validator import FinancialValidator
from app.modules.billing.validators.protocols import InvoiceRepositoryProtocol
from app.modules.billing.validators.state_machine import (
    allowed_transitions,
    is_editable_state,
    is_terminal_state,
    validate_invoice_transition,
)


class InvoiceValidator:
    """Aggregate business rule validator for the Invoice module.

    Args:
        invoice_repo: Read-only ``InvoiceRepositoryProtocol`` for invoice
            existence, uniqueness, and patient lookups.
        financial_validator: ``FinancialValidator`` instance for monetary
            validations.
    """

    def __init__(
        self,
        invoice_repo: InvoiceRepositoryProtocol,
        financial_validator: FinancialValidator,
    ) -> None:
        self._invoice_repo = invoice_repo
        self._financial = financial_validator

    # ==================================================================
    # Invoice lifecycle
    # ==================================================================

    def validate_invoice_exists(self, invoice_id: UUID) -> Invoice:
        """Fetch an invoice by id and raise ``InvoiceNotFound`` if missing.

        Returns the loaded invoice so the service can reuse it.
        """
        invoice = self._invoice_repo.get_by_id(invoice_id)
        if invoice is None:
            raise InvoiceNotFound(invoice_id)
        return invoice

    def validate_status_transition(
        self,
        invoice: Invoice,
        new_status: InvoiceStatus | str,
    ) -> None:
        """Validate that ``invoice`` may transition to ``new_status``.

        Orchestrates:
        1. ``state_machine.validate_invoice_transition`` — pure transition
           legality check.
        2. Business-policy checks for specific transitions (e.g. must have
           items before issuing).

        Raises:
            InvalidInvoiceStatusTransition: If the transition is not allowed
                per the state machine, or if business conditions are not met.
        """
        validate_invoice_transition(
            current_status=invoice.status,
            new_status=new_status,
        )

        target = (
            new_status
            if isinstance(new_status, InvoiceStatus)
            else InvoiceStatus(new_status)
        )
        if target == InvoiceStatus.ISSUED:
            self.validate_has_line_items(invoice)

    def validate_editable(self, invoice: Invoice) -> None:
        """Validate that ``invoice`` may be edited.

        Only invoices in ``DRAFT`` status may be edited.

        Raises:
            InvoiceNotEditable: If the invoice is in a non-editable status.
        """
        if not is_editable_state(invoice.status, aggregate="invoice"):
            raise InvoiceNotEditable(
                invoice_id=invoice.id,
                status=invoice.status.value
                if isinstance(invoice.status, InvoiceStatus)
                else str(invoice.status),
            )

    def validate_immutable(self, invoice: Invoice) -> None:
        """Ensure the invoice has reached an immutable state.

        This validator succeeds only when the invoice is already immutable.
        It is used as a guard before workflows that require the invoice
        to be in a non-editable state (issued, paid, overdue, cancelled,
        or void).

        Raises:
            InvoiceNotEditable:
                If the invoice is still editable (e.g. DRAFT).
        """
        if is_editable_state(invoice.status, aggregate="invoice"):
            raise InvoiceNotEditable(
                invoice_id=invoice.id,
                status=invoice.status.value
                if isinstance(invoice.status, InvoiceStatus)
                else str(invoice.status),
            )

    def validate_cancellable(self, invoice: Invoice) -> None:
        """Validate that an invoice can be cancelled from its current status.

        Cancellation is allowed from any non-terminal status. Terminal
        statuses (CANCELLED, VOID) have no outgoing transitions.

        Raises:
            InvalidInvoiceStatusTransition: If the invoice is already in a
                terminal state.
            InvoiceValidationFailed: If ``cancellation_reason`` is missing or blank.
        """
        if is_terminal_state(invoice.status, aggregate="invoice"):
            raise InvalidInvoiceStatusTransition(
                from_status=invoice.status.value
                if isinstance(invoice.status, InvoiceStatus)
                else str(invoice.status),
                to_status=InvoiceStatus.CANCELLED.value,
                details={
                    "invoice_id": str(invoice.id),
                    "current_status": invoice.status.value
                    if isinstance(invoice.status, InvoiceStatus)
                    else str(invoice.status),
                    "reason": "Cannot cancel an invoice in a terminal state",
                },
            )

        if not invoice.cancellation_reason or not str(invoice.cancellation_reason).strip():
            raise InvoiceValidationFailed(
                "cancellation_reason is required when cancelling an invoice",
                details={"invoice_id": str(invoice.id)},
            )

    def validate_voidable(self, invoice: Invoice) -> None:
        """Validate that an invoice may be voided.

        Void is allowed from any non-terminal status.

        Raises:
            InvalidInvoiceStatusTransition: If the invoice is in a terminal state.
            InvoiceValidationFailed: If ``void_reason`` is missing or blank.
        """
        if is_terminal_state(invoice.status, aggregate="invoice"):
            raise InvalidInvoiceStatusTransition(
                from_status=invoice.status.value
                if isinstance(invoice.status, InvoiceStatus)
                else str(invoice.status),
                to_status=InvoiceStatus.VOID.value,
                details={
                    "invoice_id": str(invoice.id),
                    "current_status": invoice.status.value
                    if isinstance(invoice.status, InvoiceStatus)
                    else str(invoice.status),
                    "reason": "Cannot void an invoice in a terminal state",
                },
            )

        if not invoice.void_reason or not str(invoice.void_reason).strip():
            raise InvoiceValidationFailed(
                "void_reason is required when voiding an invoice",
                details={"invoice_id": str(invoice.id)},
            )

    def validate_issuable(self, invoice: Invoice) -> None:
        """Validate that an invoice may be issued.

        Checks:
        1. Invoice is in DRAFT status.
        2. Invoice has at least one line item.

        Raises:
            InvoiceNotEditable: If the invoice is not in DRAFT.
            InvoiceValidationFailed: If the invoice has no line items.
        """
        self.validate_editable(invoice)
        self.validate_has_line_items(invoice)

    def validate_payable(self, invoice: Invoice) -> None:
        """Validate that an invoice is in a payable status.

        Payable statuses are ISSUED, PARTIALLY_PAID, OVERDUE.

        Raises:
            InvalidInvoiceStatusTransition: If the invoice cannot be paid.
        """
        payable_statuses = {
            InvoiceStatus.ISSUED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
        }
        current = (
            invoice.status
            if isinstance(invoice.status, InvoiceStatus)
            else InvoiceStatus(invoice.status)
        )
        if current not in payable_statuses:
            raise InvalidInvoiceStatusTransition(
                from_status=current.value,
                to_status="payment_allocation",
                details={
                    "invoice_id": str(invoice.id),
                    "current_status": current.value,
                    "payable_statuses": sorted(s.value for s in payable_statuses),
                },
            )

    # ==================================================================
    # Patient ownership
    # ==================================================================

    def validate_belongs_to_patient(
        self,
        invoice: Invoice,
        patient_id: UUID,
    ) -> None:
        """Validate that ``invoice`` belongs to ``patient_id``.

        Raises:
            InvoiceValidationFailed: If the invoice does not belong to the
                specified patient.
        """
        if invoice.patient_id != patient_id:
            raise InvoiceValidationFailed(
                f"Invoice {invoice.id} does not belong to patient {patient_id}",
                details={
                    "invoice_id": str(invoice.id),
                    "invoice_patient_id": str(invoice.patient_id),
                    "expected_patient_id": str(patient_id),
                },
            )

    # ==================================================================
    # Line items
    # ==================================================================

    def validate_has_line_items(self, invoice: Invoice) -> None:
        """Validate that ``invoice`` has at least one line item.

        Raises:
            InvoiceValidationFailed: If the invoice has no items.
        """
        if len(invoice.items) < MIN_LINE_ITEMS_PER_INVOICE:
            raise InvoiceValidationFailed(
                f"Invoice must contain at least {MIN_LINE_ITEMS_PER_INVOICE} "
                f"line item(s). Got {len(invoice.items)}.",
                details={
                    "invoice_id": str(invoice.id),
                    "item_count": len(invoice.items),
                    "required": MIN_LINE_ITEMS_PER_INVOICE,
                },
            )

    def validate_line_item_sequence(
        self,
        invoice: Invoice,
        sequence_number: int,
        exclude_item_id: UUID | None = None,
    ) -> None:
        """Validate that ``sequence_number`` is unique within the invoice.

        Args:
            invoice: The already-loaded invoice.
            sequence_number: The proposed sequence number.
            exclude_item_id: Optional item id to exclude (for updates).

        Raises:
            DuplicateLineItemSequence: If another item already has this
                sequence number and is not the excluded item.
        """
        for item in invoice.items:
            if item.sequence_number == sequence_number:
                if exclude_item_id is not None and item.id == exclude_item_id:
                    continue
                raise DuplicateLineItemSequence(
                    invoice_id=invoice.id,
                    sequence=sequence_number,
                )

    # ==================================================================
    # Numbering
    # ==================================================================

    def validate_invoice_number_unique(
        self,
        invoice_number: str,
        exclude_invoice_id: UUID | None = None,
    ) -> None:
        """Validate that ``invoice_number`` is unique across all invoices.

        Concurrency Note:
        Service layer must perform uniqueness validation inside a transaction
        using optimistic locking or SELECT FOR UPDATE where appropriate.
        Validators remain pure.

        Args:
            invoice_number: The invoice number to check.
            exclude_invoice_id: Optional invoice id to exclude (for updates).

        Raises:
            InvoiceNumberAlreadyUsed: If another invoice already has this number.
        """
        existing = self._invoice_repo.get_by_invoice_number(invoice_number)
        if existing is not None and existing.id != exclude_invoice_id:
            raise InvoiceNumberAlreadyUsed(
                invoice_number=invoice_number,
                details={
                    "invoice_number": invoice_number,
                    "existing_invoice_id": str(existing.id),
                },
            )

    def validate_invoice_number_format(self, invoice_number: str) -> None:
        """Validate that ``invoice_number`` is within max length and non-empty.

        Raises:
            InvoiceValidationFailed: If the number is invalid.
        """
        if not isinstance(invoice_number, str) or not invoice_number.strip():
            raise InvoiceValidationFailed(
                "Invoice number is required",
                details={"invoice_number": invoice_number},
            )

        invoice_number = invoice_number.strip()
        if len(invoice_number) > INVOICE_NUMBER_MAX_LENGTH:
            raise InvoiceValidationFailed(
                f"Invoice number must be at most {INVOICE_NUMBER_MAX_LENGTH} "
                f"characters. Got {len(invoice_number)}.",
                details={
                    "invoice_number": invoice_number,
                    "length": len(invoice_number),
                    "max_length": INVOICE_NUMBER_MAX_LENGTH,
                },
            )

    # ==================================================================
    # Dates
    # ==================================================================

    def validate_invoice_date(
        self,
        invoice_date: date | None,
        due_date: date | None = None,
    ) -> None:
        """Validate that ``invoice_date`` is a valid date.

        Args:
            invoice_date: The invoice date to validate.
            due_date: Optional due date for range validation.

        Raises:
            InvoiceValidationFailed: If the date is invalid.
        """
        if invoice_date is None:
            raise InvoiceValidationFailed(
                "Invoice date is required",
                details={"invoice_date": None},
            )

        if not isinstance(invoice_date, date):
            raise InvoiceValidationFailed(
                f"Invoice date must be a date, got {type(invoice_date).__name__!r}",
                details={"invoice_date": str(invoice_date)},
            )

        if due_date is not None and invoice_date > due_date:
            raise InvoiceValidationFailed(
                f"Invoice date ({invoice_date}) must not be after due date ({due_date})",
                details={
                    "invoice_date": str(invoice_date),
                    "due_date": str(due_date),
                },
            )

    def validate_due_date(
        self,
        due_date: date | None,
        invoice_date: date | None = None,
    ) -> None:
        """Validate that ``due_date`` is valid.

        Args:
            due_date: The due date to validate.
            invoice_date: Optional invoice date for range validation.

        Raises:
            InvoiceValidationFailed: If the date is invalid.
        """
        if due_date is None:
            raise InvoiceValidationFailed(
                "Due date is required",
                details={"due_date": None},
            )

        if not isinstance(due_date, date):
            raise InvoiceValidationFailed(
                f"Due date must be a date, got {type(due_date).__name__!r}",
                details={"due_date": str(due_date)},
            )

        if invoice_date is not None and due_date < invoice_date:
            raise InvoiceValidationFailed(
                f"Due date ({due_date}) must not be before invoice date ({invoice_date})",
                details={
                    "invoice_date": str(invoice_date),
                    "due_date": str(due_date),
                },
            )

    # ==================================================================
    # Discount
    # ==================================================================

    def validate_discount(
        self,
        discount: object,
        subtotal: object | None = None,
    ) -> Decimal:
        """Validate that a discount is non-negative and optionally <= subtotal.

        Args:
            discount: The discount amount to validate.
            subtotal: Optional subtotal for ceiling check.

        Returns:
            The validated, quantized :class:`Decimal` discount.

        Raises:
            BillingValidationError: If discount cannot be parsed.
            NegativeAmountNotAllowed: If discount is negative.
            InvoiceValidationFailed: If discount exceeds subtotal.
        """
        disc = self._financial.validate_non_negative_amount(
            discount, field="discount"
        )
        if subtotal is not None:
            sub = self._financial.validate_non_negative_amount(
                subtotal, field="subtotal"
            )
            if disc > sub:
                raise InvoiceValidationFailed(
                    f"Discount ({disc}) exceeds subtotal ({sub})",
                    details={
                        "discount": str(disc),
                        "subtotal": str(sub),
                    },
                )
        return disc

    # ==================================================================
    # Total consistency
    # ==================================================================

    def validate_total_consistency(
        self,
        provided_total: object,
        computed_total: object,
    ) -> Decimal:
        """Validate that the provided grand total matches the computed total.

        Args:
            provided_total: Total supplied by the caller.
            computed_total: Total derived from line items.

        Returns:
            The validated, quantized :class:`Decimal` computed total.

        Raises:
            GrandTotalMismatch: If the totals differ.
        """
        return self._financial.validate_grand_total_consistency(
            provided_total, computed_total
        )

    # ==================================================================
    # Currency
    # ==================================================================

    def validate_currency(self, currency: object) -> str:
        """Validate that ``currency`` is a supported ISO 4217 code.

        Args:
            currency: Candidate currency code.

        Returns:
            The validated, upper-cased currency code string.

        Raises:
            BillingValidationError: If the currency code is invalid.
        """
        return self._financial.validate_currency_code(currency)

    def validate_currency_consistency(
        self,
        currencies: Sequence[str],
        *,
        expected: str | None = None,
    ) -> str:
        """Ensure all supplied currency codes are identical.

        Args:
            currencies: Iterable of currency codes.
            expected: Optional expected currency.

        Returns:
            The agreed currency code.

        Raises:
            CurrencyMismatch: If more than one distinct currency is present.
        """
        return self._financial.validate_currency_consistency(
            currencies, expected=expected
        )


__all__ = ["InvoiceValidator"]
