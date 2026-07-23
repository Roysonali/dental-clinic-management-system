"""Billing Module — PaymentMapper.

Stateless ORM-to-DTO conversion for the Payment aggregate root.
Converts ``Payment`` / ``PaymentAllocation`` ORM instances to their
Pydantic response schemas, and create/update request DTOs back to
ORM models.

All response DTOs are constructed explicitly — no ``model_validate()``
calls — because the DTOs contain many computed / composed fields that
do not exist as direct ORM attributes (``currency_code``, ``financials``,
``patient``, ``creator``, etc.).

This mapper does NOT import InvoiceMapper, ReceiptMapper, or RefundMapper
directly. Payment-level responses embed lightweight summaries of related
entities via schemas defined in ``app.modules.billing.schemas`` which are
self-contained.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from app.modules.billing.constants import DEFAULT_CURRENCY
from app.modules.billing.enums import PaymentMethod, PaymentStatus
from app.modules.billing.models import (
    Payment,
    PaymentAllocation,
)
from app.modules.billing.schemas.payment import (
    PaymentAllocationSummary,
    PaymentAuditSummary,
    PaymentCreateRequest,
    PaymentFinancialSummary,
    PaymentGatewayMetadata,
    PaymentListItem,
    PaymentListResponse,
    PaymentMethodSummary,
    PaymentRead,
    PaymentSearchRequest,
    PaymentStatusTransitionResponse,
    PaymentSummary,
    PaymentUpdateRequest,
)
from app.modules.billing.schemas.summaries import (
    CreatorSummary,
    PatientSummary,
)

# ---------------------------------------------------------------------------
# Local InvoiceSummary — used inside allocation summaries
# The ``InvoiceSummary`` here is the local DTO defined in ``payment.py``,
# NOT the one in ``invoice.py``. They have different field sets.
# ---------------------------------------------------------------------------
from app.modules.billing.schemas.payment import (
    InvoiceSummary as InvoiceSummarySchema,
)


class PaymentMapper:
    """Stateless converter between ``Payment`` ORM instances and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Request → ORM
    # ==================================================================

    @staticmethod
    def to_model(
        request: PaymentCreateRequest,
        payment_number: str,
        created_by: UUID,
    ) -> Payment:
        """Convert a ``PaymentCreateRequest`` DTO to a ``Payment`` ORM model.

        Args:
            request: The validated create request DTO.
            payment_number: The assigned sequential payment number.
            created_by: UUID of the user creating the payment.

        Returns:
            A ``Payment`` instance ready for persistence.
        """
        return Payment(
            patient_id=request.patient_id,
            payment_number=payment_number.strip(),
            payment_method=request.payment_method,
            total_amount=request.total_amount,
            payment_date=request.payment_date,
            reference_number=(
                request.reference_number.strip()
                if request.reference_number
                else None
            ),
            status=PaymentStatus.PENDING,
            notes=request.notes.strip() if request.notes else None,
            created_by=created_by,
        )

    @staticmethod
    def update_model(payment: Payment, request: PaymentUpdateRequest) -> Payment:
        """Apply a ``PaymentUpdateRequest`` to an existing ``Payment`` model.

        Only non-``None`` fields are applied. The payment is mutated
        in-place.

        Args:
            payment: The ``Payment`` ORM instance to update.
            request: The validated update request DTO.

        Returns:
            The same ``Payment`` instance (mutated in-place) for chaining.
        """
        if request.total_amount is not None:
            payment.total_amount = request.total_amount
        if request.payment_method is not None:
            payment.payment_method = request.payment_method
        if request.payment_date is not None:
            payment.payment_date = request.payment_date
        if request.patient_id is not None:
            payment.patient_id = request.patient_id
        if request.reference_number is not None:
            payment.reference_number = (
                request.reference_number.strip() or None
            )
        if request.notes is not None:
            payment.notes = request.notes.strip() or None
        if request.reversal_reason is not None:
            payment.reversal_reason = (
                request.reversal_reason.strip() or None
            )

        return payment

    # ==================================================================
    # ORM → Response DTOs
    # ==================================================================

    @staticmethod
    def to_read(payment: Payment) -> PaymentRead:
        """Convert a full ``Payment`` aggregate to a ``PaymentRead`` DTO.

        Composes nested patient, creator, updater, allocations, financials,
        and gateway metadata.

        Args:
            payment: A ``Payment`` ORM instance with its relationships
                loaded (patient, creator, updater, payment_allocations).

        Returns:
            A ``PaymentRead`` with all nested DTOs populated.
        """
        return PaymentRead(
            id=payment.id,
            payment_number=payment.payment_number,
            document_type="payment",
            status=payment.status,
            patient=PaymentMapper._to_patient_summary(payment.patient)
            if payment.patient
            else PaymentMapper._empty_patient_summary(),
            creator=PaymentMapper._to_creator_summary(payment.creator)
            if payment.creator
            else None,
            updater=PaymentMapper._to_creator_summary(payment.updater)
            if payment.updater
            else None,
            payment_method=payment.payment_method,
            total_amount=payment.total_amount,
            payment_date=payment.payment_date,
            currency_code=PaymentMapper._currency_code(payment),
            reference_number=payment.reference_number,
            is_reversed=payment.is_reversed,
            reversal_reason=payment.reversal_reason,
            notes=payment.notes,
            allocations=[
                PaymentMapper._to_allocation_summary(alloc)
                for alloc in (payment.payment_allocations or [])
            ],
            financials=PaymentMapper._compute_financial_summary(payment),
            gateway_metadata=PaymentMapper._to_gateway_metadata(payment),
            version=payment.version,
            doc_version=payment.doc_version,
            created_at=payment.created_at,
            created_by=payment.created_by,
            updated_at=payment.updated_at,
            updated_by=payment.updated_by,
        )

    @staticmethod
    def to_summary(payment: Payment) -> PaymentSummary:
        """Convert a ``Payment`` ORM instance to a ``PaymentSummary`` DTO.

        Args:
            payment: A ``Payment`` ORM instance.

        Returns:
            A ``PaymentSummary``.
        """
        allocations = payment.payment_allocations or []

        return PaymentSummary(
            id=payment.id,
            payment_number=payment.payment_number,
            status=payment.status,
            patient=PaymentMapper._to_patient_summary(payment.patient)
            if payment.patient
            else PaymentMapper._empty_patient_summary(),
            payment_method=payment.payment_method,
            total_amount=payment.total_amount,
            payment_date=payment.payment_date,
            reference_number=payment.reference_number,
            financials=PaymentMapper._compute_financial_summary(payment),
            allocation_count=len(allocations),
            created_at=payment.created_at,
        )

    @staticmethod
    def to_list_item(payment: Payment) -> PaymentListItem:
        """Convert a ``Payment`` ORM instance to a ``PaymentListItem`` DTO.

        Args:
            payment: A ``Payment`` ORM instance.

        Returns:
            A ``PaymentListItem``.
        """
        allocations = payment.payment_allocations or []

        return PaymentListItem(
            id=payment.id,
            payment_number=payment.payment_number,
            status=payment.status,
            patient=PaymentMapper._to_patient_summary(payment.patient)
            if payment.patient
            else PaymentMapper._empty_patient_summary(),
            payment_method=payment.payment_method,
            total_amount=payment.total_amount,
            payment_date=payment.payment_date,
            financials=PaymentMapper._compute_financial_summary(payment),
            allocation_count=len(allocations),
            created_at=payment.created_at,
        )

    @staticmethod
    def to_list_response(
        payments: Sequence[Payment],
        total: int,
        page: int,
        page_size: int,
    ) -> PaymentListResponse:
        """Convert a sequence of payments to a paginated list response.

        Args:
            payments: Items for the current page.
            total: Total matching items across all pages.
            page: Current 1-based page number.
            page_size: Items per page.

        Returns:
            A ``PaymentListResponse``.
        """
        return PaymentListResponse(
            items=[PaymentMapper.to_list_item(p) for p in payments],
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def to_status_transition_response(
        payment: Payment,
        from_status: PaymentStatus,
        to_status: PaymentStatus,
        changed_at: datetime,
        changed_by: UUID,
    ) -> PaymentStatusTransitionResponse:
        """Build a status transition response from a payment and transition data.

        Args:
            payment: The payment that was transitioned.
            from_status: The previous status.
            to_status: The new status.
            changed_at: Timestamp when the transition occurred.
            changed_by: UUID of the user who performed the transition.

        Returns:
            A ``PaymentStatusTransitionResponse``.
        """
        return PaymentStatusTransitionResponse(
            payment_id=payment.id,
            from_status=from_status,
            to_status=to_status,
            changed_at=changed_at,
            changed_by=changed_by,
        )

    # ==================================================================
    # Supporting DTO conversions
    # ==================================================================

    @staticmethod
    def to_allocation_summary(
        allocation: PaymentAllocation,
    ) -> PaymentAllocationSummary:
        """Convert a ``PaymentAllocation`` ORM instance to a summary DTO.

        Args:
            allocation: A ``PaymentAllocation`` ORM instance with its
                invoice relationship loaded.

        Returns:
            A ``PaymentAllocationSummary``.
        """
        return PaymentMapper._to_allocation_summary(allocation)

    @staticmethod
    def to_financial_summary(
        payment: Payment,
    ) -> PaymentFinancialSummary:
        """Derive the financial summary for a payment.

        Args:
            payment: A ``Payment`` ORM instance with payment_allocations loaded.

        Returns:
            A ``PaymentFinancialSummary``.
        """
        return PaymentMapper._compute_financial_summary(payment)

    @staticmethod
    def to_gateway_metadata(payment: Payment) -> PaymentGatewayMetadata | None:
        """Extract gateway metadata from a payment record.

        Args:
            payment: A ``Payment`` ORM instance.

        Returns:
            A ``PaymentGatewayMetadata`` or ``None`` if no reference data exists.
        """
        if not payment.reference_number and not payment.payment_method:
            return None
        return PaymentGatewayMetadata(
            gateway_txn_id=payment.reference_number,
            gateway_order_id=None,
            bank_reference_number=None,
            payment_source=None,
        )

    @staticmethod
    def to_method_summary(
        payment_method: str,
        count: int,
        total_amount: Decimal,
        currency_code: str,
    ) -> PaymentMethodSummary:
        """Build a payment method summary from aggregated data.

        Args:
            payment_method: The payment method value.
            count: Number of payments using this method.
            total_amount: Sum of total_amount for this method.
            currency_code: ISO 4217 currency code.

        Returns:
            A ``PaymentMethodSummary``.
        """
        return PaymentMethodSummary(
            payment_method=payment_method,
            count=count,
            total_amount=total_amount,
            currency_code=currency_code,
        )

    # ==================================================================
    # Private helpers
    # ==================================================================

    @staticmethod
    def _to_patient_summary(patient: Any) -> PatientSummary:
        """Build a ``PatientSummary`` from a Patient ORM instance.

        The Patient ORM stores ``first_name`` / ``last_name`` separately;
        ``full_name`` is composed here for the summary DTO.
        """
        return PatientSummary(
            id=patient.id,
            patient_code=patient.patient_code,
            full_name=(
                f"{patient.first_name or ''} {patient.last_name or ''}"
            ).strip(),
            is_active=patient.is_active,
        )

    @staticmethod
    def _empty_patient_summary() -> PatientSummary:
        """Return a patient summary with default/empty values.

        Used as a safety fallback when the patient relationship is
        unexpectedly ``None``.
        """
        return PatientSummary(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            patient_code="",
            full_name="",
            is_active=False,
        )

    @staticmethod
    def _to_creator_summary(user: Any) -> CreatorSummary:
        """Build a ``CreatorSummary`` from a User ORM instance."""
        return CreatorSummary(
            id=user.id,
            full_name=user.full_name,
        )

    @staticmethod
    def _currency_code(payment: Payment) -> str:
        """Derive the currency code from the first allocation's invoice.

        If no allocation has an invoice with a known currency, returns
        the architecture-approved default.
        """
        if hasattr(payment, "payment_allocations") and payment.payment_allocations:
            for alloc in payment.payment_allocations:
                if (
                    hasattr(alloc, "invoice")
                    and alloc.invoice is not None
                    and alloc.invoice.currency_code
                ):
                    return alloc.invoice.currency_code
        return DEFAULT_CURRENCY.value

    @staticmethod
    def _to_invoice_summary(invoice: Any) -> InvoiceSummarySchema:
        """Build an ``InvoiceSummary`` from an Invoice ORM instance.

        ``grand_total`` is derived from the invoice's line items
        since the Invoice model does not store it directly (FI-INV-004).
        """
        # Compute grand_total from items
        items = invoice.items or []
        subtotal = sum(
            (item.unit_price or Decimal("0.00")) * (item.quantity or 0)
            for item in items
        )
        discount_total = sum(
            (item.discount_value or Decimal("0.00")) for item in items
        )
        grand_total = subtotal - discount_total

        patient = (
            PaymentMapper._to_patient_summary(invoice.patient)
            if invoice.patient is not None
            else PaymentMapper._empty_patient_summary()
        )

        return InvoiceSummarySchema(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            patient=patient,
            invoice_date=invoice.invoice_date,
            currency_code=invoice.currency_code,
            grand_total=grand_total,
        )

    @staticmethod
    def _to_allocation_summary(
        allocation: PaymentAllocation,
    ) -> PaymentAllocationSummary:
        """Map a single ``PaymentAllocation`` to its summary DTO."""
        invoice_summary = (
            PaymentMapper._to_invoice_summary(allocation.invoice)
            if hasattr(allocation, "invoice") and allocation.invoice is not None
            else None
        )

        return PaymentAllocationSummary(
            id=allocation.id,
            invoice=invoice_summary,
            allocated_amount=allocation.allocated_amount,
            is_refund=allocation.is_refund,
            created_at=allocation.created_at,
        )

    @staticmethod
    def _compute_financial_summary(
        payment: Payment,
    ) -> PaymentFinancialSummary:
        """Derive the financial summary from payment and allocations.

        Pure computation — no business rules, no database access.
        Only transfers existing values.
        """
        total_amount = payment.total_amount or Decimal("0.00")
        allocated_amount = Decimal("0.00")
        refunded_amount = Decimal("0.00")
        currency_code: str | None = None

        if hasattr(payment, "payment_allocations") and payment.payment_allocations:
            for alloc in payment.payment_allocations:
                if alloc.is_refund:
                    refunded_amount += alloc.allocated_amount
                else:
                    allocated_amount += alloc.allocated_amount
                if currency_code is None:
                    if (
                        hasattr(alloc, "invoice")
                        and alloc.invoice is not None
                        and alloc.invoice.currency_code
                    ):
                        currency_code = alloc.invoice.currency_code

        unallocated_amount = total_amount - allocated_amount - refunded_amount
        if unallocated_amount < Decimal("0.00"):
            unallocated_amount = Decimal("0.00")

        return PaymentFinancialSummary(
            currency_code=currency_code or DEFAULT_CURRENCY.value,
            total_amount=total_amount,
            allocated_amount=allocated_amount,
            refunded_amount=refunded_amount,
            unallocated_amount=unallocated_amount,
        )

    @staticmethod
    def _to_gateway_metadata(payment: Payment) -> PaymentGatewayMetadata | None:
        """Build gateway metadata, or ``None`` if no reference data exists."""
        if not payment.reference_number and not payment.payment_method:
            return None
        return PaymentGatewayMetadata(
            gateway_txn_id=payment.reference_number,
            gateway_order_id=None,
            bank_reference_number=None,
            payment_source=None,
        )


__all__ = ["PaymentMapper"]
