"""FinancialCalculationService — centralized domain calculation service.

THIS IS THE SINGLE SOURCE OF TRUTH for every financial calculation used
anywhere in the Billing module. No other service invents its own calculations.

Design
------
* **Read-only** — never mutates data, never commits, never rolls back.
* **Pure calculations** — all monetary arithmetic uses ``Decimal`` and
  ``MONEY_QUANTIZE_EXPONENT``.
* **Repository delegation** — orchestrates existing repository aggregate
  methods. Only adds the bare minimum of new aggregate queries when missing.
* **Validator reuse** — leverages ``FinancialValidator`` where validation
  already exists (e.g., currency checks, amount parsing).
* **Stateless** — holds no mutable state; instances are safely shared.

Usage
-----
    calc = FinancialCalculationService(
        invoice_repo=invoice_repo,
        payment_repo=payment_repo,
        refund_repo=refund_repo,
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
    )
    paid = calc.calculate_invoice_paid_amount(invoice_id)

Contract
--------
* Every method returns a quantized ``Decimal`` (or structured dict/summary).
* Every method raises ``InvoiceNotFound``, ``PaymentNotFound``, or other
  domain exceptions when the entity does not exist.
* No method performs writes, commits, rollbacks, audit logging, state
  transitions, or document number generation.

Future compatibility
--------------------
* When tax support is added in a future phase, add a
  ``calculate_invoice_tax_total()`` method that reads from a new repository
  aggregate without modifying any existing calculation.
* When insurance is added, the patient summary can be extended with an
  ``insurance_covered`` field without changing existing calculation logic.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from app.modules.billing.constants import MONEY_QUANTIZE_EXPONENT, ZERO_MONEY
from app.modules.billing.enums import InvoiceStatus, PaymentStatus
from app.modules.billing.exceptions import (
    CreditNoteNotFound,
    InvoiceNotFound,
    PaymentNotFound,
)
from app.modules.billing.repositories import (
    CreditNoteRepository,
    InvoiceRepository,
    PaymentRepository,
)
from app.modules.billing.repositories.refund_repository import RefundRepository
from app.modules.billing.validators import FinancialValidator

logger = logging.getLogger(__name__)


# ======================================================================
# Data transfer objects for aggregate summaries
# ======================================================================


@dataclass(frozen=True)
class InvoiceFinancialSummary:
    """Read-only financial snapshot of a single invoice.

    All monetary fields are quantized :class:`Decimal` values.
    """

    invoice_id: UUID
    invoice_number: str
    status: str
    grand_total: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    total_refunded: Decimal = Decimal("0.00")
    outstanding_balance: Decimal = Decimal("0.00")
    currency_code: str = "USD"


@dataclass(frozen=True)
class PaymentFinancialSummary:
    """Read-only financial snapshot of a single payment."""

    payment_id: UUID
    payment_number: str
    status: str
    total_amount: Decimal = Decimal("0.00")
    total_allocated: Decimal = Decimal("0.00")
    unallocated_amount: Decimal = Decimal("0.00")
    total_refunded: Decimal = Decimal("0.00")
    remaining_refundable_balance: Decimal = Decimal("0.00")


@dataclass(frozen=True)
class PatientFinancialSummary:
    """Aggregate financial position for a patient.

    This is a point-in-time snapshot computed at call time. All monetary
    fields are quantized :class:`Decimal` values.
    """

    patient_id: UUID
    total_invoiced: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    total_refunded: Decimal = Decimal("0.00")
    total_outstanding: Decimal = Decimal("0.00")
    total_credited: Decimal = Decimal("0.00")
    total_credit_remaining: Decimal = Decimal("0.00")
    invoice_count: int = 0
    paid_invoice_count: int = 0
    outstanding_invoice_count: int = 0
    payment_count: int = 0
    credit_note_count: int = 0


@dataclass(frozen=True)
class BillingTotals:
    """Aggregate billing-wide totals for dashboard/reporting."""

    total_invoiced: Decimal = Decimal("0.00")
    total_collected: Decimal = Decimal("0.00")
    total_refunded: Decimal = Decimal("0.00")
    total_outstanding: Decimal = Decimal("0.00")
    total_credited: Decimal = Decimal("0.00")
    invoice_count: int = 0
    paid_invoice_count: int = 0
    outstanding_invoice_count: int = 0
    payment_count: int = 0
    credit_note_count: int = 0


# ======================================================================
# Service
# ======================================================================


class FinancialCalculationService:
    """Centralized read-only financial calculation service.

    All monetary calculations use the module's shared ``MONEY_QUANTIZE_EXPONENT``
    and ``Decimal``. No mutations, no commits, no rollbacks.

    Args:
        invoice_repo: ``InvoiceRepository`` for invoice aggregates.
        payment_repo: ``PaymentRepository`` for payment aggregates.
        refund_repo: ``RefundRepository`` for refund totals.
        credit_note_repo: ``CreditNoteRepository`` for credit notes.
        financial_validator: ``FinancialValidator`` for monetary validation.
    """

    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        payment_repo: PaymentRepository,
        refund_repo: RefundRepository,
        credit_note_repo: CreditNoteRepository,
        financial_validator: FinancialValidator,
    ) -> None:
        self._invoice_repo = invoice_repo
        self._payment_repo = payment_repo
        self._refund_repo = refund_repo
        self._credit_note_repo = credit_note_repo
        self._financial = financial_validator

    # ==================================================================
    # Invoice calculations
    # ==================================================================

    def calculate_invoice_grand_total(self, invoice_id: UUID) -> Decimal:
        """Return the grand total (sum of line-item net amounts) for an invoice.

        Delegates to ``InvoiceRepository.get_invoice_grand_total()``.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            The grand total as a quantized :class:`Decimal`.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        self._require_invoice_exists(invoice_id)
        total = self._invoice_repo.get_invoice_grand_total(invoice_id)
        return total.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_invoice_paid_amount(self, invoice_id: UUID) -> Decimal:
        """Return the total amount paid (non-refund allocations) for an invoice.

        Delegates to ``InvoiceRepository.get_total_allocated_for_invoice()``
        which sums non-refund PaymentAllocation records.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            The total paid amount as a quantized :class:`Decimal`.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        self._require_invoice_exists(invoice_id)
        total = self._invoice_repo.get_total_allocated_for_invoice(invoice_id)
        return total.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_invoice_refunded_amount(self, invoice_id: UUID) -> Decimal:
        """Return the total refund amount allocated to an invoice.

        Delegates to ``InvoiceRepository.get_total_refunded_for_invoice()``
        which sums PaymentAllocation records with is_refund=True.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            The total refunded amount as a quantized :class:`Decimal`.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        self._require_invoice_exists(invoice_id)
        total = self._invoice_repo.get_total_refunded_for_invoice(invoice_id)
        return total.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_invoice_outstanding_balance(self, invoice_id: UUID) -> Decimal:
        """Compute the outstanding balance on an invoice.

        Formula::

            outstanding = grand_total - paid_amount + refunded_amount

        Where:
        - ``grand_total`` is the sum of line-item net amounts.
        - ``paid_amount`` is the sum of non-refund allocations.
        - ``refunded_amount`` is the sum of refund allocations.

        The result is floored at zero (a negative result means overpaid).

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            The outstanding balance as a non-negative quantized :class:`Decimal`.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        grand_total = self.calculate_invoice_grand_total(invoice_id)
        paid = self.calculate_invoice_paid_amount(invoice_id)
        refunded = self.calculate_invoice_refunded_amount(invoice_id)
        balance = (grand_total - paid + refunded).quantize(MONEY_QUANTIZE_EXPONENT)
        return balance if balance >= ZERO_MONEY else ZERO_MONEY

    def calculate_invoice_balance_summary(
        self, invoice_id: UUID
    ) -> dict[str, Decimal]:
        """Return a dictionary with all balance components for an invoice.

        Returns:
            A dict with keys ``grand_total``, ``paid_amount``,
            ``refunded_amount``, and ``outstanding_balance``.
        """
        grand_total = self.calculate_invoice_grand_total(invoice_id)
        paid = self.calculate_invoice_paid_amount(invoice_id)
        refunded = self.calculate_invoice_refunded_amount(invoice_id)
        outstanding = self.calculate_invoice_outstanding_balance(invoice_id)
        return {
            "grand_total": grand_total,
            "paid_amount": paid,
            "refunded_amount": refunded,
            "outstanding_balance": outstanding,
        }

    def get_invoice_financial_summary(self, invoice_id: UUID) -> InvoiceFinancialSummary:
        """Return the full :class:`InvoiceFinancialSummary` for an invoice.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            An ``InvoiceFinancialSummary`` dataclass with all financial fields.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        invoice = self._invoice_repo.get_by_id(invoice_id)
        if invoice is None:
            raise InvoiceNotFound(invoice_id)

        grand_total = self.calculate_invoice_grand_total(invoice_id)
        paid = self.calculate_invoice_paid_amount(invoice_id)
        refunded = self.calculate_invoice_refunded_amount(invoice_id)
        outstanding = self.calculate_invoice_outstanding_balance(invoice_id)

        return InvoiceFinancialSummary(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            status=invoice.status.value
            if isinstance(invoice.status, InvoiceStatus)
            else str(invoice.status),
            grand_total=grand_total,
            total_paid=paid,
            total_refunded=refunded,
            outstanding_balance=outstanding,
            currency_code=invoice.currency_code,
        )

    # ==================================================================
    # Payment calculations
    # ==================================================================

    def calculate_payment_allocated_amount(self, payment_id: UUID) -> Decimal:
        """Return the total amount allocated (non-refund) from a payment.

        Delegates to ``PaymentRepository.get_total_allocated_for_payment()``.

        Args:
            payment_id: UUID of the payment.

        Returns:
            The total allocated amount as a quantized :class:`Decimal`.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        self._require_payment_exists(payment_id)
        total = self._payment_repo.get_total_allocated_for_payment(payment_id)
        return total.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_payment_unallocated_amount(self, payment_id: UUID) -> Decimal:
        """Compute the unallocated (available) amount on a payment.

        Formula::

            unallocated = total_amount - allocated_amount

        Where ``allocated_amount`` is the sum of non-refund allocations.

        Args:
            payment_id: UUID of the payment.

        Returns:
            The unallocated amount as a non-negative quantized :class:`Decimal`.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        payment = self._require_payment_exists(payment_id)
        allocated = self.calculate_payment_allocated_amount(payment_id)
        unallocated = (payment.total_amount - allocated).quantize(
            MONEY_QUANTIZE_EXPONENT
        )
        return unallocated if unallocated >= ZERO_MONEY else ZERO_MONEY

    def calculate_payment_refunded_amount(self, payment_id: UUID) -> Decimal:
        """Return the total amount of completed refunds for a payment.

        Delegates to ``RefundRepository.get_completed_refund_total()``.

        Args:
            payment_id: UUID of the payment.

        Returns:
            The total refunded amount as a quantized :class:`Decimal`.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        self._require_payment_exists(payment_id)
        total = self._refund_repo.get_completed_refund_total(payment_id)
        return total.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_payment_outstanding_refund_total(self, payment_id: UUID) -> Decimal:
        """Return the total amount of outstanding (non-rejected) refunds.

        Includes PENDING, APPROVED, and COMPLETED refunds — every refund
        that represents an actual or potential outflow. Only REJECTED refunds
        are excluded.

        Delegates to ``RefundRepository.get_outstanding_refund_total()``.

        Args:
            payment_id: UUID of the payment.

        Returns:
            The outstanding refund total as a quantized :class:`Decimal`.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        self._require_payment_exists(payment_id)
        total = self._refund_repo.get_outstanding_refund_total(payment_id)
        return total.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_payment_remaining_refundable_balance(
        self, payment_id: UUID
    ) -> Decimal:
        """Compute the remaining refundable balance on a payment.

        Formula::

            remaining = total_amount - outstanding_refund_total

        Where ``outstanding_refund_total`` includes PENDING, APPROVED, and
        COMPLETED refunds (all non-rejected refunds).

        Args:
            payment_id: UUID of the payment.

        Returns:
            The remaining refundable balance as a non-negative quantized
            :class:`Decimal`.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        payment = self._require_payment_exists(payment_id)
        outstanding = self.calculate_payment_outstanding_refund_total(payment_id)
        remaining = (payment.total_amount - outstanding).quantize(
            MONEY_QUANTIZE_EXPONENT
        )
        return remaining if remaining >= ZERO_MONEY else ZERO_MONEY

    def get_payment_financial_summary(
        self, payment_id: UUID
    ) -> PaymentFinancialSummary:
        """Return the full :class:`PaymentFinancialSummary` for a payment.

        Args:
            payment_id: UUID of the payment.

        Returns:
            A ``PaymentFinancialSummary`` dataclass with all financial fields.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        payment = self._payment_repo.get_by_id(payment_id)
        if payment is None:
            raise PaymentNotFound(payment_id)

        allocated = self.calculate_payment_allocated_amount(payment_id)
        unallocated = self.calculate_payment_unallocated_amount(payment_id)
        refunded = self.calculate_payment_refunded_amount(payment_id)
        remaining_refundable = self.calculate_payment_remaining_refundable_balance(
            payment_id
        )

        return PaymentFinancialSummary(
            payment_id=payment.id,
            payment_number=payment.payment_number,
            status=payment.status.value if isinstance(payment.status, PaymentStatus) else str(payment.status),
            total_amount=payment.total_amount,
            total_allocated=allocated,
            unallocated_amount=unallocated,
            total_refunded=refunded,
            remaining_refundable_balance=remaining_refundable,
        )

    # ==================================================================
    # Credit note calculations
    # ==================================================================

    def calculate_credit_note_remaining_balance(
        self, credit_note_id: UUID
    ) -> Decimal:
        """Return the remaining (unapplied) balance on a credit note.

        Reads directly from the ``CreditNote.remaining_balance`` field.

        Args:
            credit_note_id: UUID of the credit note.

        Returns:
            The remaining balance as a quantized :class:`Decimal`.

        Raises:
            CreditNoteNotFound: If ``credit_note_id`` does not resolve.
        """
        credit_note = self._credit_note_repo.get_by_id(credit_note_id)
        if credit_note is None:
            raise CreditNoteNotFound(credit_note_id)
        return credit_note.remaining_balance.quantize(MONEY_QUANTIZE_EXPONENT)

    def calculate_credit_note_applied_amount(
        self, credit_note_id: UUID
    ) -> Decimal:
        """Compute the applied (used) amount of a credit note.

        Formula::

            applied = original_amount - remaining_balance

        Args:
            credit_note_id: UUID of the credit note.

        Returns:
            The applied amount as a quantized :class:`Decimal`.

        Raises:
            CreditNoteNotFound: If ``credit_note_id`` does not resolve.
        """
        credit_note = self._credit_note_repo.get_by_id(credit_note_id)
        if credit_note is None:
            raise CreditNoteNotFound(credit_note_id)
        applied = (credit_note.amount - credit_note.remaining_balance).quantize(
            MONEY_QUANTIZE_EXPONENT
        )
        return applied if applied >= ZERO_MONEY else ZERO_MONEY

    # ==================================================================
    # Patient financial summary
    # ==================================================================

    def calculate_patient_financial_summary(
        self, patient_id: UUID
    ) -> PatientFinancialSummary:
        """Compute the aggregate financial position for a patient.

        This method queries multiple repositories using SQL aggregate
        functions to build a point-in-time snapshot. All monetary values are
        quantized to the module's money scale.

        Unlike the previous page-scanning implementation, this version
        computes all totals server-side so results are correct regardless
        of invoice/payment/credit-note count.

        Args:
            patient_id: UUID of the patient.

        Returns:
            A ``PatientFinancialSummary`` dataclass with all aggregated fields.
        """
        # ── Use server-side aggregates for financial totals ──────────
        invoice_aggs = self._invoice_repo.get_invoice_aggregates(
            patient_id=patient_id
        )
        payment_totals = self._payment_repo.get_payment_totals(
            patient_id=patient_id
        )
        cn_totals = self._credit_note_repo.get_credit_note_totals(
            patient_id=patient_id
        )

        total_invoiced = invoice_aggs["total_grand_total"]
        total_paid = invoice_aggs["total_paid"]
        total_refunded = invoice_aggs["total_refunded"]
        total_outstanding = (
            total_invoiced - total_paid + total_refunded
        ).quantize(MONEY_QUANTIZE_EXPONENT)
        if total_outstanding < ZERO_MONEY:
            total_outstanding = ZERO_MONEY

        return PatientFinancialSummary(
            patient_id=patient_id,
            total_invoiced=total_invoiced.quantize(MONEY_QUANTIZE_EXPONENT),
            total_paid=total_paid.quantize(MONEY_QUANTIZE_EXPONENT),
            total_refunded=total_refunded.quantize(MONEY_QUANTIZE_EXPONENT),
            total_outstanding=total_outstanding.quantize(MONEY_QUANTIZE_EXPONENT),
            total_credited=cn_totals["total_amount"].quantize(
                MONEY_QUANTIZE_EXPONENT
            ),
            total_credit_remaining=cn_totals["total_remaining"].quantize(
                MONEY_QUANTIZE_EXPONENT
            ),
            invoice_count=invoice_aggs["paid_count"]
            + invoice_aggs["outstanding_count"],
            paid_invoice_count=invoice_aggs["paid_count"],
            outstanding_invoice_count=invoice_aggs["outstanding_count"],
            payment_count=payment_totals["payment_count"],
            credit_note_count=cn_totals["credit_note_count"],
        )

    # ==================================================================
    # Billing totals (dashboard/reporting)
    # ==================================================================

    def calculate_billing_totals(self) -> BillingTotals:
        """Compute aggregate billing-wide totals for the entire system.

        This is a dashboard-level summary. Unlike the previous page-scanning
        implementation, all values are computed via SQL aggregate functions
        so results are correct regardless of data volume.

        For large datasets, consider caching or using a materialized view
        in production.

        Returns:
            A ``BillingTotals`` dataclass with all aggregated fields.
        """
        # ── Use server-side aggregates for financial totals ──────────
        invoice_aggs = self._invoice_repo.get_invoice_aggregates()
        payment_totals = self._payment_repo.get_payment_totals()
        cn_totals = self._credit_note_repo.get_credit_note_totals()

        total_invoiced = invoice_aggs["total_grand_total"]
        total_paid = invoice_aggs["total_paid"]
        total_refunded = invoice_aggs["total_refunded"]
        total_outstanding = (
            total_invoiced - total_paid + total_refunded
        ).quantize(MONEY_QUANTIZE_EXPONENT)
        if total_outstanding < ZERO_MONEY:
            total_outstanding = ZERO_MONEY

        return BillingTotals(
            total_invoiced=total_invoiced.quantize(MONEY_QUANTIZE_EXPONENT),
            total_collected=total_paid.quantize(MONEY_QUANTIZE_EXPONENT),
            total_refunded=total_refunded.quantize(MONEY_QUANTIZE_EXPONENT),
            total_outstanding=total_outstanding.quantize(MONEY_QUANTIZE_EXPONENT),
            total_credited=cn_totals["total_amount"].quantize(
                MONEY_QUANTIZE_EXPONENT
            ),
            invoice_count=invoice_aggs["paid_count"]
            + invoice_aggs["outstanding_count"],
            paid_invoice_count=invoice_aggs["paid_count"],
            outstanding_invoice_count=invoice_aggs["outstanding_count"],
            payment_count=payment_totals["payment_count"],
            credit_note_count=cn_totals["credit_note_count"],
        )

    # ==================================================================
    # Consistency checks
    # ==================================================================

    def check_invoice_payment_consistency(self, invoice_id: UUID) -> bool:
        """Verify that the payment allocations for an invoice balance correctly.

        Checks that: ``paid <= grand_total + refunded + epsilon``
        at the money quantization scale.

        Mathematical reasoning:
        ``paid`` is the sum of non-refund allocations (money received by the
        practice). ``refunded`` is the sum of refund allocations (money
        returned to the patient). The effective net payment to the practice is
        ``paid - refunded``, which must not exceed the grand total (plus a tiny
        epsilon to absorb floating-point quantisation drift).

        Rearranged: ``paid <= grand_total + refunded + epsilon``.

        The old invariant ``paid + refunded <= grand_total + epsilon`` was
        incorrect because it double-counted refunds as both a reduction of paid
        and an addition to the balance due. Consider an invoice of $200 that is
        fully paid ($200 allocated non-refund) and then $50 is refunded:

        - Old check: 200 + 50 <= 200 + 0.01 → 250 <= 200.01 → FALSE ❌
        - New check: 200 <= 200 + 50 + 0.01 → 200 <= 250.01 → TRUE  ✅

        This is a read-only consistency check for reconciliation purposes.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            ``True`` if the invoice's allocations are consistent.

        Raises:
            InvoiceNotFound: If ``invoice_id`` does not resolve.
        """
        grand_total = self.calculate_invoice_grand_total(invoice_id)
        paid = self.calculate_invoice_paid_amount(invoice_id)
        refunded = self.calculate_invoice_refunded_amount(invoice_id)
        return paid <= (grand_total + refunded + MONEY_QUANTIZE_EXPONENT)

    def check_payment_allocation_consistency(self, payment_id: UUID) -> bool:
        """Verify that a payment's allocations do not exceed its total.

        Checks that: ``allocated_amount <= total_amount + epsilon``

        Args:
            payment_id: UUID of the payment.

        Returns:
            ``True`` if the payment's allocations are consistent.

        Raises:
            PaymentNotFound: If ``payment_id`` does not resolve.
        """
        payment = self._payment_repo.get_by_id(payment_id)
        if payment is None:
            raise PaymentNotFound(payment_id)
        allocated = self.calculate_payment_allocated_amount(payment_id)
        refunded = self.calculate_payment_refunded_amount(payment_id)
        return (allocated + refunded) <= (
            payment.total_amount + MONEY_QUANTIZE_EXPONENT
        )

    # ==================================================================
    # Private helpers
    # ==================================================================

    def _require_invoice_exists(self, invoice_id: UUID) -> None:
        """Raise ``InvoiceNotFound`` if the invoice does not exist."""
        if not self._invoice_repo.exists(invoice_id):
            raise InvoiceNotFound(invoice_id)

    def _require_payment_exists(self, payment_id: UUID):
        """Raise ``PaymentNotFound`` if the payment does not exist.

        Returns:
            The ``Payment`` entity for further use.
        """
        payment = self._payment_repo.get_by_id(payment_id)
        if payment is None:
            raise PaymentNotFound(payment_id)
        return payment


__all__ = [
    "FinancialCalculationService",
    "InvoiceFinancialSummary",
    "PaymentFinancialSummary",
    "PatientFinancialSummary",
    "BillingTotals",
]
