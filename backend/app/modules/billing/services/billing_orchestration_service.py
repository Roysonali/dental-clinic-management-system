"""BillingOrchestrationService — Application-layer orchestration service.

Design
------
This is an **application service** (not a domain service). It coordinates
existing domain services into complete business workflows without introducing
new domain rules, validations, calculations, or persistence logic.

Responsibilities
----------------
- **Coordinate** existing services in the correct sequence.
- **Translate** workflow-level exceptions where appropriate.
- **Aggregate** results from multiple service calls into combined DTOs.
- **Return** unified responses that bundle entities with financial summaries.

Non-responsibilities (MUST NOT do)
----------------------------------
- Duplicate domain rules already implemented elsewhere.
- Duplicate validation logic.
- Duplicate financial calculations.
- Bypass repositories.
- Bypass validators.
- Generate document numbers directly.
- Manipulate ORM entities directly.
- Recalculate money.
- Change entity status directly.
- Own transactions (each service owns its own commit/rollback).

Transaction model
-----------------
Each service call is an independent business transaction. The orchestrator
does NOT wrap multiple service calls in a single database transaction because
each workflow step represents a distinct business event that should be
persisted independently:

- Creating a draft invoice and issuing it are separate business events.
- Creating a payment, completing it, and allocating it are separate events.
- Creating a refund, approving it, and completing it are separate events.

This preserves the existing service contracts and avoids nested commits.

Future compatibility
--------------------
- New workflows can be added by composing existing service methods.
- When tax support is added, workflow DTOs can be extended with tax fields
  without modifying the orchestration logic.
- When insurance is added, new workflow methods can be added alongside
  existing ones.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.billing.enums import PaymentStatus
from app.modules.billing.exceptions import (
    InvoiceNotFound,
    PaymentNotFound,
)
from app.modules.billing.models import CreditNote, Invoice, Payment, Refund
from app.modules.billing.services.credit_note_service import CreditNoteService
from app.modules.billing.services.invoice_service import InvoiceService
from app.modules.billing.services.payment_service import PaymentService
from app.modules.billing.services.receipt_service import (
    PrintableReceipt,
    ReceiptService,
)
from app.modules.billing.services.refund_service import RefundService
from app.modules.billing.services.financial_calculation_service import (
    BillingTotals,
    FinancialCalculationService,
    InvoiceFinancialSummary,
    PatientFinancialSummary,
    PaymentFinancialSummary,
)

logger = logging.getLogger(__name__)


# ======================================================================
# Workflow DTOs
# ======================================================================


@dataclass(frozen=True)
class InvoiceWorkflowResult:
    """Result of the complete invoice workflow (create → issue).

    Bundles the issued invoice with its financial snapshot.
    """

    invoice: Invoice | None = None
    financial_summary: InvoiceFinancialSummary | None = None


@dataclass(frozen=True)
class PaymentWorkflowResult:
    """Result of the receive-payment workflow.

    Bundles the payment, allocation, receipt, and updated invoice financials.
    """

    payment: Payment | None = None
    allocation: Any | None = None  # PaymentAllocation (avoid ORM import in public API)
    receipt: PrintableReceipt | None = None
    invoice_financial_summary: InvoiceFinancialSummary | None = None


@dataclass(frozen=True)
class RefundWorkflowResult:
    """Result of the process-refund workflow.

    Bundles the completed refund with updated payment and invoice financials.
    """

    refund: Refund | None = None
    payment_financial_summary: PaymentFinancialSummary | None = None
    invoice_financial_summary: InvoiceFinancialSummary | None = None


@dataclass(frozen=True)
class CreditNoteWorkflowResult:
    """Result of the apply-credit-note workflow.

    Bundles the applied credit note with updated invoice financials.
    """

    credit_note: CreditNote | None = None
    invoice_financial_summary: InvoiceFinancialSummary | None = None


@dataclass(frozen=True)
class BillingDashboardResult:
    """Aggregated billing dashboard data.

    Combines system-wide totals with recent activity lists.
    """

    totals: BillingTotals = field(default_factory=BillingTotals)
    recent_invoices: list[Invoice] = field(default_factory=list)
    recent_payments: list[Payment] = field(default_factory=list)
    patient_summary: PatientFinancialSummary | None = None


# ======================================================================
# Orchestration Service
# ======================================================================


class BillingOrchestrationService:
    """Application-layer orchestrator for complete billing workflows.

    Coordinates existing domain services. Never introduces new domain rules.

    Args:
        db: The active SQLAlchemy ``Session`` (used only for constructing
            service instances if needed; services manage their own sessions).
        invoice_service: ``InvoiceService`` for invoice operations.
        payment_service: ``PaymentService`` for payment and allocation ops.
        refund_service: ``RefundService`` for refund operations.
        credit_note_service: ``CreditNoteService`` for credit note operations.
        receipt_service: ``ReceiptService`` for receipt generation.
        financial_calc_service: ``FinancialCalculationService`` for read-only
            financial calculations and summaries.
    """

    def __init__(
        self,
        db: Session,
        invoice_service: InvoiceService,
        payment_service: PaymentService,
        refund_service: RefundService,
        credit_note_service: CreditNoteService,
        receipt_service: ReceiptService,
        financial_calc_service: FinancialCalculationService,
    ) -> None:
        self._db = db
        self._invoice_service = invoice_service
        self._payment_service = payment_service
        self._refund_service = refund_service
        self._credit_note_service = credit_note_service
        self._receipt_service = receipt_service
        self._financial_calc = financial_calc_service

    # ==================================================================
    # Workflow 1: Complete Invoice (Create Draft → Issue)
    # ==================================================================

    def complete_invoice_workflow(
        self,
        patient_id: UUID,
        items: list[dict[str, Any]],
        created_by: UUID,
        *,
        treatment_plan_id: UUID | None = None,
        appointment_id: UUID | None = None,
        doctor_id: UUID | None = None,
        notes: str | None = None,
        due_date: date | None = None,
        invoice_date: date | None = None,
        currency_code: str = "USD",
        invoice_number: str | None = None,
    ) -> InvoiceWorkflowResult:
        """Execute the complete invoice lifecycle: create draft → issue.

        Delegates to ``InvoiceService`` for all domain validation and
        persistence. Uses ``FinancialCalculationService`` for the summary.

        Args:
            patient_id: UUID of the patient.
            items: List of line-item dicts (see ``InvoiceService.create_invoice``).
            created_by: UUID of the user.
            treatment_plan_id: Optional linked treatment plan.
            appointment_id: Optional linked appointment.
            doctor_id: Optional linked doctor.
            notes: Optional invoice notes.
            due_date: Optional due date (defaults to 30 days from invoice date).
            invoice_date: Optional invoice date (defaults to today).
            currency_code: ISO 4217 currency code (default ``USD``).
            invoice_number: Optional invoice number. If omitted, a sequential
                number is generated by ``DocumentSequenceService`` during issue.

        Returns:
            An ``InvoiceWorkflowResult`` with the issued invoice and its
            financial snapshot.

        Raises:
            InvoiceValidationFailed: If invoice validation fails.
            DocumentSequenceNotFound: If no document sequence configured.
            InvoiceCreationFailed: If persistence fails.
        """
        # ── Step 1: Create draft invoice ──────────────────────────
        # Use a short unique placeholder number; it will be replaced on
        # issue. The max length is 30 chars (INVOICE_NUMBER_MAX_LENGTH).
        placeholder_number = invoice_number or f"DRFT_{uuid.uuid4().hex[:8]}"
        invoice = self._invoice_service.create_invoice(
            patient_id=patient_id,
            invoice_number=placeholder_number,
            currency_code=currency_code,
            items=items,
            created_by=created_by,
            treatment_plan_id=treatment_plan_id,
            appointment_id=appointment_id,
            doctor_id=doctor_id,
            notes=notes,
            due_date=due_date,
            invoice_date=invoice_date,
        )

        # ── Step 2: Issue the invoice ─────────────────────────────
        issued_invoice = self._invoice_service.issue_invoice(
            invoice_id=invoice.id,
            issued_by=created_by,
        )

        # ── Step 3: Build financial summary (read-only) ───────────
        summary = self._financial_calc.get_invoice_financial_summary(
            issued_invoice.id
        )

        logger.info(
            "Invoice workflow complete: id=%s, number=%s",
            str(issued_invoice.id),
            issued_invoice.invoice_number,
        )
        return InvoiceWorkflowResult(
            invoice=issued_invoice,
            financial_summary=summary,
        )

    # ==================================================================
    # Workflow 2: Receive Payment (Create → Complete → Allocate → Receipt)
    # ==================================================================

    def receive_payment_workflow(
        self,
        patient_id: UUID,
        invoice_id: UUID,
        amount: Any,
        payment_method: Any,
        payment_date: date,
        created_by: UUID,
        *,
        reference_number: str | None = None,
        notes: str | None = None,
        generate_receipt: bool = True,
    ) -> PaymentWorkflowResult:
        """Execute the complete payment lifecycle: create → complete → allocate → receipt.

        Workflow:
        1. Create a pending payment.
        2. Complete the payment.
        3. Allocate the full payment amount to the invoice.
        4. Optionally generate a receipt.
        5. Return updated financial summary.

        Args:
            patient_id: UUID of the patient.
            invoice_id: UUID of the invoice to pay.
            amount: Payment amount (must match allocation amount).
            payment_method: Payment method.
            payment_date: Date of payment.
            created_by: UUID of the user.
            reference_number: Optional transaction reference.
            notes: Optional notes.
            generate_receipt: Whether to generate a receipt (default True).

        Returns:
            A ``PaymentWorkflowResult`` with the payment, allocation,
            receipt (if generated), and financial summary.

        Raises:
            PaymentValidationFailed: If payment validation fails.
            InvoiceNotFound: If invoice does not exist.
            PaymentExceedsInvoice: If allocation exceeds outstanding balance.
            ReceiptValidationFailed: If receipt generation fails.
        """
        # Validate invoice exists upfront for a better error message
        invoice = self._invoice_service.get_invoice(invoice_id)

        # ── Step 1: Create payment (Pending status) ──────────────
        payment = self._payment_service.create_payment(
            patient_id=patient_id,
            amount=amount,
            payment_method=payment_method,
            payment_date=payment_date,
            created_by=created_by,
            reference_number=reference_number,
            notes=notes,
        )

        # ── Step 2: Complete the payment ─────────────────────────
        completed_payment = self._payment_service.complete_payment(
            payment_id=payment.id,
            completed_by=created_by,
        )

        # ── Step 3: Allocate full payment amount to invoice ──────
        allocation = self._payment_service.allocate_payment(
            payment_id=completed_payment.id,
            invoice_id=invoice_id,
            amount=amount,
            allocated_by=created_by,
        )

        # ── Step 4: Generate receipt (optional) ──────────────────
        printable_receipt: PrintableReceipt | None = None
        if generate_receipt:
            _, printable_receipt = self._receipt_service.generate_receipt(
                payment_id=completed_payment.id,
                generated_by=created_by,
            )

        # ── Step 5: Build financial summary (read-only) ──────────
        summary = self._financial_calc.get_invoice_financial_summary(invoice_id)

        logger.info(
            "Payment workflow complete: payment=%s, invoice=%s, amount=%s",
            str(completed_payment.id),
            str(invoice_id),
            str(amount),
        )
        return PaymentWorkflowResult(
            payment=completed_payment,
            allocation=allocation,
            receipt=printable_receipt,
            invoice_financial_summary=summary,
        )

    # ==================================================================
    # Workflow 3: Process Refund (Create → Approve → Complete)
    # ==================================================================

    def process_refund_workflow(
        self,
        payment_id: UUID,
        amount: Any,
        reason: str,
        created_by: UUID,
        *,
        invoice_id: UUID | None = None,
    ) -> RefundWorkflowResult:
        """Execute the complete refund lifecycle: create → approve → complete.

        Workflow:
        1. Create a pending refund.
        2. Approve the refund.
        3. Complete the refund (creates refund allocation).
        4. Return updated payment and invoice financial summaries.

        Args:
            payment_id: UUID of the payment to refund.
            amount: Refund amount.
            reason: Reason for the refund.
            created_by: UUID of the user.
            invoice_id: Optional invoice UUID for the financial summary.
                If provided, the invoice financial summary is included.

        Returns:
            A ``RefundWorkflowResult`` with the completed refund and
            financial summaries.

        Raises:
            PaymentNotFound: If payment does not exist.
            RefundExceedsPayment: If refund exceeds refundable balance.
            InvalidRefundStatusTransition: If status transition is invalid.
        """
        # ── Step 1: Create refund (Pending status) ───────────────
        refund = self._refund_service.create_refund(
            payment_id=payment_id,
            amount=amount,
            reason=reason,
            created_by=created_by,
        )

        # ── Step 2: Approve the refund ───────────────────────────
        approved_refund = self._refund_service.approve_refund(
            refund_id=refund.id,
            approved_by=created_by,
        )

        # ── Step 3: Complete the refund ──────────────────────────
        completed_refund = self._refund_service.complete_refund(
            refund_id=approved_refund.id,
            completed_by=created_by,
        )

        # ── Step 4: Build financial summaries (read-only) ────────
        payment_summary = self._financial_calc.get_payment_financial_summary(
            payment_id
        )

        invoice_summary: InvoiceFinancialSummary | None = None
        if invoice_id is not None:
            try:
                invoice_summary = self._financial_calc.get_invoice_financial_summary(
                    invoice_id
                )
            except InvoiceNotFound:
                logger.warning(
                    "Invoice %s not found for refund workflow summary — skipping",
                    str(invoice_id),
                )

        logger.info(
            "Refund workflow complete: refund=%s, number=%s, amount=%s",
            str(completed_refund.id),
            completed_refund.refund_number,
            str(completed_refund.amount),
        )
        return RefundWorkflowResult(
            refund=completed_refund,
            payment_financial_summary=payment_summary,
            invoice_financial_summary=invoice_summary,
        )

    # ==================================================================
    # Workflow 4: Apply Credit Note (Create → Issue → Apply)
    # ==================================================================

    def apply_credit_note_workflow(
        self,
        invoice_id: UUID,
        patient_id: UUID,
        amount: Any,
        reason: str,
        created_by: UUID,
        *,
        expiry_date: date | None = None,
    ) -> CreditNoteWorkflowResult:
        """Execute the complete credit note lifecycle: create → issue → apply.

        Workflow:
        1. Create a draft credit note.
        2. Issue the credit note.
        3. Apply the credit note (sets remaining_balance to 0).
        4. Return updated invoice financial summary.

        Args:
            invoice_id: UUID of the invoice being credited.
            patient_id: UUID of the patient.
            amount: Credit note amount.
            reason: Reason for the credit note.
            created_by: UUID of the user.
            expiry_date: Optional expiry date.

        Returns:
            A ``CreditNoteWorkflowResult`` with the applied credit note
            and updated invoice financial summary.

        Raises:
            InvoiceNotFound: If invoice does not exist.
            CreditNoteValidationFailed: If validation fails.
            CreditNoteNotApplicable: If credit note cannot be applied.
        """
        # ── Step 1: Create draft credit note ─────────────────────
        credit_note = self._credit_note_service.create_credit_note(
            invoice_id=invoice_id,
            patient_id=patient_id,
            amount=amount,
            reason=reason,
            created_by=created_by,
            expiry_date=expiry_date,
        )

        # ── Step 2: Issue the credit note ────────────────────────
        issued_cn = self._credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=created_by,
        )

        # ── Step 3: Apply the credit note ────────────────────────
        applied_cn = self._credit_note_service.apply_credit_note(
            credit_note_id=issued_cn.id,
            applied_by=created_by,
        )

        # ── Step 4: Build financial summary (read-only) ──────────
        summary = self._financial_calc.get_invoice_financial_summary(invoice_id)

        logger.info(
            "Credit note workflow complete: credit_note=%s, number=%s, amount=%s",
            str(applied_cn.id),
            applied_cn.credit_note_number,
            str(applied_cn.amount),
        )
        return CreditNoteWorkflowResult(
            credit_note=applied_cn,
            invoice_financial_summary=summary,
        )

    # ==================================================================
    # Workflow 5: Billing Dashboard
    # ==================================================================

    def get_billing_dashboard(
        self,
        *,
        patient_id: UUID | None = None,
    ) -> BillingDashboardResult:
        """Build the billing dashboard with aggregated totals and recent activity.

        Delegates to ``FinancialCalculationService`` for all financial
        aggregation. Queries services for recent records.

        Args:
            patient_id: Optional patient UUID for a patient-specific
                dashboard. If provided, the patient summary is included.

        Returns:
            A ``BillingDashboardResult`` with billing-wide totals,
            recent invoices and payments, and optionally a patient summary.
        """
        # ── Totals via FinancialCalculationService (read-only) ───
        totals = self._financial_calc.calculate_billing_totals()

        # ── Recent records ──────────────────────────────────────
        recent_invoices, _ = self._invoice_service.search_invoices(
            page=1,
            page_size=5,
            sort_by="created_at",
            sort_order="desc",
        )
        recent_payments, _ = self._payment_service.search_payments(
            page=1,
            page_size=5,
            sort_by="created_at",
            sort_order="desc",
        )

        # ── Patient summary (optional) ──────────────────────────
        patient_summary: PatientFinancialSummary | None = None
        if patient_id is not None:
            patient_summary = self._financial_calc.calculate_patient_financial_summary(
                patient_id
            )

        logger.info(
            "Billing dashboard built: invoices=%d, payments=%d, outstanding=%s",
            totals.invoice_count,
            totals.payment_count,
            str(totals.total_outstanding),
        )
        return BillingDashboardResult(
            totals=totals,
            recent_invoices=recent_invoices,
            recent_payments=recent_payments,
            patient_summary=patient_summary,
        )


__all__ = [
    "BillingOrchestrationService",
    "BillingDashboardResult",
    "CreditNoteWorkflowResult",
    "InvoiceWorkflowResult",
    "PaymentWorkflowResult",
    "RefundWorkflowResult",
]
