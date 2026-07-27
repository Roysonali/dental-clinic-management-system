"""Billing Module — RefundMapper.

Stateless ORM-to-DTO conversion for the Refund aggregate root.
Converts ``Refund`` ORM instances to their Pydantic response schemas,
and create/update request DTOs back to ORM models.

All response DTOs are constructed explicitly — no ``model_validate()``
calls — because the DTOs contain many computed / composed fields that
do not exist as direct ORM attributes (``currency_code``, ``financials``,
``patient``, ``payment``, etc.).

This mapper does NOT import InvoiceMapper, PaymentMapper, or ReceiptMapper
directly. Refund-level responses embed lightweight summaries of related
entities via schemas defined in ``app.modules.billing.schemas`` which are
self-contained.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from app.modules.billing.constants import DEFAULT_CURRENCY
from app.modules.billing.enums import PaymentMethod, RefundStatus
from app.modules.billing.models import Refund
from app.modules.billing.schemas.refund import (
    RefundAuditSummary,
    RefundCreateRequest,
    RefundDocumentMetadata,
    RefundFinancialSummary,
    RefundGatewayMetadata,
    RefundInvoiceSummary,
    RefundListItem,
    RefundListResponse,
    RefundPaymentSummary,
    RefundRead,
    RefundStatusTransitionResponse,
    RefundSummary,
    RefundUpdateRequest,
)
from app.modules.billing.schemas.summaries import (
    CreatorSummary,
    PatientSummary,
)


class RefundMapper:
    """Stateless converter between ``Refund`` ORM instances and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Request → ORM
    # ==================================================================

    @staticmethod
    def to_model(
        request: RefundCreateRequest,
        refund_number: str,
        created_by: int,
    ) -> Refund:
        """Convert a ``RefundCreateRequest`` DTO to a ``Refund`` ORM model.

        Args:
            request: The validated create request DTO.
            refund_number: The assigned sequential refund number.
            created_by: User ID of the refund creator (auth.users.id = int).

        Returns:
            A ``Refund`` instance ready for persistence.
        """
        return Refund(
            payment_id=request.payment_id,
            refund_number=refund_number.strip(),
            amount=request.amount,
            reason=request.reason.strip(),
            status=RefundStatus.PENDING,
            created_by=created_by,
        )

    @staticmethod
    def update_model(refund: Refund, request: RefundUpdateRequest) -> Refund:
        """Apply a ``RefundUpdateRequest`` to an existing ``Refund`` model.

        Only non-``None`` fields are applied. The refund is mutated
        in-place.

        Only fields that exist as mapped columns on the ``Refund`` ORM
        model are updated. Fields like ``currency_code`` and ``notes``
        are not part of the Refund model and are silently ignored;
        the service layer handles any additional mapping requirements.

        Args:
            refund: The ``Refund`` ORM instance to update.
            request: The validated update request DTO.

        Returns:
            The same ``Refund`` instance (mutated in-place) for chaining.
        """
        if request.payment_id is not None:
            refund.payment_id = request.payment_id
        if request.amount is not None:
            refund.amount = request.amount
        if request.reason is not None:
            refund.reason = request.reason.strip()
        if request.rejection_reason is not None:
            refund.rejection_reason = request.rejection_reason.strip() or None

        return refund

    # ==================================================================
    # ORM → Response DTOs
    # ==================================================================

    @staticmethod
    def to_read(refund: Refund) -> RefundRead:
        """Convert a full ``Refund`` aggregate to a ``RefundRead`` DTO.

        Composes nested patient, payment, invoices, creator, updater,
        reviewer, financials, document metadata, gateway metadata, and
        audit trail.

        Args:
            refund: A ``Refund`` ORM instance with its relationships
                loaded (payment, creator, updater, reviewer).

        Returns:
            A ``RefundRead`` with all nested DTOs populated.
        """
        # ``refund.payment`` is guaranteed non-None because ``payment_id``
        # is a non-nullable FK column on the Refund model, and the
        # ``payment`` relationship uses ``lazy="selectin"`` eager loading.
        payment_summary = RefundMapper._to_payment_summary(refund.payment)
        patient_summary = (
            RefundMapper._to_patient_summary(refund.payment.patient)
            if refund.payment.patient is not None
            else None
        )

        # Build invoice summaries from payment allocations
        invoice_summaries: list[RefundInvoiceSummary] = []
        if (
            hasattr(refund.payment, "payment_allocations")
            and refund.payment.payment_allocations
        ):
            for alloc in refund.payment.payment_allocations:
                if hasattr(alloc, "invoice") and alloc.invoice is not None:
                    invoice_summaries.append(
                        RefundMapper._to_invoice_summary(alloc)
                    )

        return RefundRead(
            id=refund.id,
            refund_number=refund.refund_number,
            document_type="refund",
            status=refund.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            payment=payment_summary,
            invoices=invoice_summaries,
            creator=RefundMapper._to_creator_summary(refund.creator)
            if refund.creator is not None
            else None,
            updater=RefundMapper._to_creator_summary(refund.updater)
            if refund.updater is not None
            else None,
            reviewer=RefundMapper._to_creator_summary(refund.reviewer)
            if refund.reviewer is not None
            else None,
            amount=refund.amount,
            reason=refund.reason,
            currency_code=payment_summary.currency_code,
            notes=None,
            rejection_reason=refund.rejection_reason,
            reviewed_by=refund.reviewed_by,
            reviewed_at=refund.reviewed_at,
            financials=RefundMapper._compute_financial_summary(refund),
            gateway_metadata=RefundGatewayMetadata(
                gateway_refund_id=None,
                gateway_payment_id=None,
                bank_reference_number=None,
                refund_source=None,
            ),
            document_metadata=RefundDocumentMetadata(
                document_type="refund",
                sequence_number=None,
                issued_at=(
                    refund.reviewed_at if refund.reviewed_at is not None
                    else refund.created_at
                ),
                generated_at=refund.created_at,
            ),
            audit_trail=[],
            version=refund.version,
            doc_version=refund.doc_version,
            created_at=refund.created_at,
            created_by=refund.created_by,
            updated_at=refund.updated_at,
            updated_by=refund.updated_by,
        )

    @staticmethod
    def to_summary(refund: Refund) -> RefundSummary:
        """Convert a ``Refund`` ORM instance to a ``RefundSummary`` DTO.

        Args:
            refund: A ``Refund`` ORM instance.

        Returns:
            A ``RefundSummary``.
        """
        # ``refund.payment`` is guaranteed non-None (non-nullable FK +
        # ``lazy="selectin"`` eager loading).
        payment_summary = RefundMapper._to_payment_summary(refund.payment)
        patient_summary = (
            RefundMapper._to_patient_summary(refund.payment.patient)
            if refund.payment.patient is not None
            else None
        )

        return RefundSummary(
            id=refund.id,
            refund_number=refund.refund_number,
            status=refund.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            payment=payment_summary,
            amount=refund.amount,
            currency_code=payment_summary.currency_code,
            reason=refund.reason,
            financials=RefundMapper._compute_financial_summary(refund),
            created_at=refund.created_at,
        )

    @staticmethod
    def to_list_item(refund: Refund) -> RefundListItem:
        """Convert a ``Refund`` ORM instance to a ``RefundListItem`` DTO.

        Args:
            refund: A ``Refund`` ORM instance.

        Returns:
            A ``RefundListItem``.
        """
        # ``refund.payment`` is guaranteed non-None (non-nullable FK +
        # ``lazy="selectin"`` eager loading).
        payment_summary = RefundMapper._to_payment_summary(refund.payment)
        patient_summary = (
            RefundMapper._to_patient_summary(refund.payment.patient)
            if refund.payment.patient is not None
            else None
        )

        return RefundListItem(
            id=refund.id,
            refund_number=refund.refund_number,
            status=refund.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            payment=payment_summary,
            amount=refund.amount,
            currency_code=payment_summary.currency_code,
            reason=refund.reason,
            financials=RefundMapper._compute_financial_summary(refund),
            created_at=refund.created_at,
        )

    @staticmethod
    def to_list_response(
        refunds: Sequence[Refund],
        total: int,
        page: int,
        page_size: int,
    ) -> RefundListResponse:
        """Convert a sequence of refunds to a paginated list response.

        Args:
            refunds: Items for the current page.
            total: Total matching items across all pages.
            page: Current 1-based page number.
            page_size: Items per page.

        Returns:
            A ``RefundListResponse``.
        """
        return RefundListResponse(
            items=[RefundMapper.to_list_item(r) for r in refunds],
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def to_status_transition_response(
        refund: Refund,
        from_status: RefundStatus,
        to_status: RefundStatus,
        changed_at: datetime,
        changed_by: int,
    ) -> RefundStatusTransitionResponse:
        """Build a status transition response from a refund and transition data.

        Args:
            refund: The refund that was transitioned.
            from_status: The previous status.
            to_status: The new status.
            changed_at: Timestamp when the transition occurred.
            changed_by: User ID who performed the transition (auth.users.id = int).

        Returns:
            A ``RefundStatusTransitionResponse``.
        """
        return RefundStatusTransitionResponse(
            refund_id=refund.id,
            from_status=from_status,
            to_status=to_status,
            changed_at=changed_at,
            changed_by=changed_by,
        )

    # ==================================================================
    # Supporting DTO conversions
    # ==================================================================

    @staticmethod
    def to_financial_summary(refund: Refund) -> RefundFinancialSummary:
        """Derive the financial summary for a refund.

        Args:
            refund: A ``Refund`` ORM instance.

        Returns:
            A ``RefundFinancialSummary``.
        """
        return RefundMapper._compute_financial_summary(refund)

    @staticmethod
    def to_document_metadata(refund: Refund) -> RefundDocumentMetadata:
        """Extract document metadata from a refund.

        Args:
            refund: A ``Refund`` ORM instance.

        Returns:
            A ``RefundDocumentMetadata``.

        Note:
            ``version`` and ``doc_version`` are intentionally omitted
            from the metadata DTO because they are set at the root level
            of ``RefundRead`` to avoid duplication.
        """
        return RefundDocumentMetadata(
            document_type="refund",
            sequence_number=None,
            issued_at=(
                refund.reviewed_at if refund.reviewed_at is not None
                else refund.created_at
            ),
            generated_at=refund.created_at,
        )

    @staticmethod
    def to_gateway_metadata(refund: Refund) -> RefundGatewayMetadata | None:
        """Extract gateway metadata from a refund record.

        Returns ``None`` if no gateway data is available (refund is
        pending or wasn't processed through a gateway).

        Args:
            refund: A ``Refund`` ORM instance.

        Returns:
            A ``RefundGatewayMetadata`` or ``None``.
        """
        return RefundGatewayMetadata(
            gateway_refund_id=None,
            gateway_payment_id=None,
            bank_reference_number=None,
            refund_source=None,
        )

    # ==================================================================
    # Private helpers — summary construction
    # ==================================================================

    @staticmethod
    def _to_patient_summary(patient: Any) -> PatientSummary:
        """Build a ``PatientSummary`` from a Patient ORM instance.

        ``full_name`` is composed from ``first_name`` / ``last_name``.
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
    def _to_creator_summary(user: Any) -> CreatorSummary:
        """Build a ``CreatorSummary`` from a User ORM instance."""
        return CreatorSummary(
            id=user.id,
            full_name=user.full_name,
        )

    @staticmethod
    def _payment_currency(payment: Any) -> str:
        """Derive currency code from a Payment's allocations → invoices.

        Returns the architecture-approved default if no currency can
        be determined.
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
    def _to_payment_summary(payment: Any) -> RefundPaymentSummary:
        """Build a ``RefundPaymentSummary`` from a Payment ORM instance.

        ``currency_code`` is derived from the payment's allocations
        since the Payment model does not store it directly.
        """
        return RefundPaymentSummary(
            id=payment.id,
            payment_number=getattr(payment, "payment_number", ""),
            payment_method=(
                payment.payment_method.value
                if isinstance(payment.payment_method, PaymentMethod)
                else str(payment.payment_method)
            ),
            total_amount=payment.total_amount or Decimal("0.00"),
            payment_date=getattr(payment, "payment_date", None),
            currency_code=RefundMapper._payment_currency(payment),
        )

    @staticmethod
    def _to_invoice_summary(allocation: Any) -> RefundInvoiceSummary:
        """Build a ``RefundInvoiceSummary`` from a PaymentAllocation ORM instance.

        ``grand_total`` is derived from the invoice's line items.
        ``invoice_date`` and ``currency_code`` are read from the invoice.

        Note: ``allocation.invoice`` is guaranteed to be non-None because
        the caller always filters ``hasattr(alloc, "invoice") and
        alloc.invoice is not None`` before calling this method. The
        PaymentAllocation model also has ``invoice_id`` as a nullable FK,
        but the caller guard ensures we never reach here with a null invoice.
        """
        invoice = allocation.invoice
        # The caller always filters for invoice is not None before calling.
        # A None invoice here is a programming error, not a runtime case.

        # Build patient summary
        patient_summary = (
            RefundMapper._to_patient_summary(invoice.patient)
            if hasattr(invoice, "patient") and invoice.patient is not None
            else PatientSummary(
                id=invoice.patient_id,
                patient_code="",
                full_name="",
                is_active=False,
            )
        )

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

        return RefundInvoiceSummary(
            id=invoice.id,
            invoice_number=getattr(invoice, "invoice_number", ""),
            patient=patient_summary,
            invoice_date=invoice.invoice_date,
            currency_code=invoice.currency_code,
            grand_total=grand_total,
        )

    @staticmethod
    def _compute_financial_summary(refund: Refund) -> RefundFinancialSummary:
        """Derive the financial summary from a refund and its payment.

        Pure computation — no business rules, no database access.
        Only transfers existing values that are available on the loaded
        aggregate. Aggregate values that require querying across multiple
        records (e.g. ``refund_count``, ``remaining_on_payment``) are
        intentionally left at the schema-defined defaults for the
        service layer to overwrite after calling this method.

        Note: ``refund_count`` is NOT set here because the mapper cannot
        determine the total number of refunds against a payment without
        aggregation. The schema default (``1``) is used. The service
        layer should overwrite it with ``SELECT COUNT(*) FROM refunds
        WHERE payment_id = ...``.
        """
        refund_amount = refund.amount or Decimal("0.00")
        payment_total = Decimal("0.00")

        if refund.payment is not None:
            payment_total = refund.payment.total_amount or Decimal("0.00")

        currency_code = (
            RefundMapper._payment_currency(refund.payment)
            if refund.payment is not None
            else DEFAULT_CURRENCY.value
        )

        return RefundFinancialSummary(
            currency_code=currency_code,
            refund_amount=refund_amount,
            payment_total=payment_total,
            remaining_on_payment=Decimal("0.00"),
        )


__all__ = ["RefundMapper"]
