"""Billing Module — ReceiptMapper.

Stateless ORM-to-DTO conversion for the Receipt aggregate root.
Converts ``Receipt`` / ``ReceiptInvoice`` ORM instances to their
Pydantic response schemas, and create/update request DTOs back to
ORM models.

All response DTOs are constructed explicitly — no ``model_validate()``
calls — because the DTOs contain many computed / composed fields that
do not exist as direct ORM attributes (``currency_code``, ``financials``,
``patient``, ``payment``, etc.).

This mapper does NOT import InvoiceMapper, PaymentMapper, or RefundMapper
directly. Receipt-level responses embed lightweight summaries of related
entities via locally defined DTOs in the schemas package which are
self-contained.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from app.modules.billing.constants import DEFAULT_CURRENCY
from app.modules.billing.enums import PaymentMethod, ReceiptStatus
from app.modules.billing.models import (
    Receipt,
    ReceiptInvoice,
)
from app.modules.billing.schemas.receipt import (
    ReceiptAuditSummary,
    ReceiptCreateRequest,
    ReceiptDocumentMetadata,
    ReceiptFinancialSummary,
    ReceiptInvoiceSummary,
    ReceiptListItem,
    ReceiptListResponse,
    ReceiptPaymentSummary,
    ReceiptPrintMetadata,
    ReceiptRead,
    ReceiptStatusTransitionResponse,
    ReceiptSummary,
    ReceiptUpdateRequest,
)
from app.modules.billing.schemas.summaries import (
    CreatorSummary,
    PatientSummary,
)


class ReceiptMapper:
    """Stateless converter between ``Receipt`` ORM instances and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Request → ORM
    # ==================================================================

    @staticmethod
    def to_model(
        request: ReceiptCreateRequest,
        receipt_number: str,
        created_by: int,
    ) -> Receipt:
        """Convert a ``ReceiptCreateRequest`` DTO to a ``Receipt`` ORM model.

        Args:
            request: The validated create request DTO.
            receipt_number: The assigned sequential receipt number.
            created_by: User ID of the receipt creator (auth.users.id = int).

        Returns:
            A ``Receipt`` instance ready for persistence.
        """
        return Receipt(
            payment_id=request.payment_id,
            receipt_number=receipt_number.strip(),
            receipt_date=request.receipt_date,
            amount=request.amount,
            status=ReceiptStatus.GENERATED,
            created_by=created_by,
        )

    @staticmethod
    def update_model(receipt: Receipt, request: ReceiptUpdateRequest) -> Receipt:
        """Apply a ``ReceiptUpdateRequest`` to an existing ``Receipt`` model.

        Only non-``None`` fields are applied. The receipt is mutated
        in-place.

        Only fields that exist as mapped columns on the ``Receipt`` ORM
        model are updated. Fields like ``currency_code``, ``notes``, and
        ``cancellation_reason`` are not part of the Receipt model and
        are silently ignored; the service layer handles any additional
        mapping requirements.

        Args:
            receipt: The ``Receipt`` ORM instance to update.
            request: The validated update request DTO.

        Returns:
            The same ``Receipt`` instance (mutated in-place) for chaining.
        """
        if request.receipt_date is not None:
            receipt.receipt_date = request.receipt_date
        if request.amount is not None:
            receipt.amount = request.amount

        return receipt

    # ==================================================================
    # ORM → Response DTOs
    # ==================================================================

    @staticmethod
    def to_read(receipt: Receipt) -> ReceiptRead:
        """Convert a full ``Receipt`` aggregate to a ``ReceiptRead`` DTO.

        Composes nested patient, payment, invoice associations, financials,
        document metadata, print metadata, and audit summaries.

        Args:
            receipt: A ``Receipt`` ORM instance with its relationships
                loaded (payment, creator, receipt_invoices).

        Returns:
            A ``ReceiptRead`` with all nested DTOs populated.
        """
        # Resolve patient / payment summaries
        # ``receipt.payment`` is guaranteed non-None because ``payment_id``
        # is a non-nullable FK column on the Receipt model, and the
        # ``payment`` relationship uses ``lazy="selectin"`` eager loading.
        payment_summary = ReceiptMapper._to_payment_summary(receipt.payment)
        patient_summary = (
            ReceiptMapper._to_patient_summary(receipt.payment.patient)
            if receipt.payment.patient is not None
            else None
        )

        return ReceiptRead(
            id=receipt.id,
            receipt_number=receipt.receipt_number,
            document_type="receipt",
            status=receipt.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            payment=payment_summary,
            creator=ReceiptMapper._to_creator_summary(receipt.creator)
            if receipt.creator is not None
            else None,
            updater=None,
            receipt_date=receipt.receipt_date,
            amount=receipt.amount,
            currency_code=payment_summary.currency_code,
            notes=None,
            cancellation_reason=None,
            receipt_invoices=[
                ReceiptMapper._to_receipt_invoice_summary(ri)
                for ri in (receipt.receipt_invoices or [])
            ],
            financials=ReceiptMapper._compute_financial_summary(receipt),
            print_metadata=None,
            document_metadata=ReceiptDocumentMetadata(
                document_type="receipt",
                sequence_number=None,
                version=1,
                doc_version=1,
                issued_at=receipt.created_at,
                generated_at=receipt.created_at,
            ),
            audit_trail=[],
            created_at=receipt.created_at,
            created_by=receipt.created_by,
            updated_at=receipt.created_at,
            updated_by=None,
        )

    @staticmethod
    def to_summary(receipt: Receipt) -> ReceiptSummary:
        """Convert a ``Receipt`` ORM instance to a ``ReceiptSummary`` DTO.

        Args:
            receipt: A ``Receipt`` ORM instance.

        Returns:
            A ``ReceiptSummary``.
        """
        # ``receipt.payment`` is guaranteed non-None (non-nullable FK +
        # ``lazy="selectin"`` eager loading).
        payment_summary = ReceiptMapper._to_payment_summary(receipt.payment)
        patient_summary = (
            ReceiptMapper._to_patient_summary(receipt.payment.patient)
            if receipt.payment.patient is not None
            else None
        )
        receipt_invoices = receipt.receipt_invoices or []

        return ReceiptSummary(
            id=receipt.id,
            receipt_number=receipt.receipt_number,
            status=receipt.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            payment=payment_summary,
            amount=receipt.amount,
            currency_code=payment_summary.currency_code,
            receipt_date=receipt.receipt_date,
            financials=ReceiptMapper._compute_financial_summary(receipt),
            invoice_count=len(receipt_invoices),
            created_at=receipt.created_at,
        )

    @staticmethod
    def to_list_item(receipt: Receipt) -> ReceiptListItem:
        """Convert a ``Receipt`` ORM instance to a ``ReceiptListItem`` DTO.

        Args:
            receipt: A ``Receipt`` ORM instance.

        Returns:
            A ``ReceiptListItem``.
        """
        # ``receipt.payment`` is guaranteed non-None (non-nullable FK +
        # ``lazy="selectin"`` eager loading).
        payment_summary = ReceiptMapper._to_payment_summary(receipt.payment)
        patient_summary = (
            ReceiptMapper._to_patient_summary(receipt.payment.patient)
            if receipt.payment.patient is not None
            else None
        )
        receipt_invoices = receipt.receipt_invoices or []

        return ReceiptListItem(
            id=receipt.id,
            receipt_number=receipt.receipt_number,
            status=receipt.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            payment=payment_summary,
            amount=receipt.amount,
            currency_code=payment_summary.currency_code,
            receipt_date=receipt.receipt_date,
            financials=ReceiptMapper._compute_financial_summary(receipt),
            invoice_count=len(receipt_invoices),
            created_at=receipt.created_at,
        )

    @staticmethod
    def to_list_response(
        receipts: Sequence[Receipt],
        total: int,
        page: int,
        page_size: int,
    ) -> ReceiptListResponse:
        """Convert a sequence of receipts to a paginated list response.

        Args:
            receipts: Items for the current page.
            total: Total matching items across all pages.
            page: Current 1-based page number.
            page_size: Items per page.

        Returns:
            A ``ReceiptListResponse``.
        """
        return ReceiptListResponse(
            items=[ReceiptMapper.to_list_item(r) for r in receipts],
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def to_status_transition_response(
        receipt: Receipt,
        from_status: ReceiptStatus,
        to_status: ReceiptStatus,
        changed_at: datetime,
        changed_by: int,
    ) -> ReceiptStatusTransitionResponse:
        """Build a status transition response from a receipt and transition data.

        Args:
            receipt: The receipt that was transitioned.
            from_status: The previous status.
            to_status: The new status.
            changed_at: Timestamp when the transition occurred.
            changed_by: User ID who performed the transition (auth.users.id = int).

        Returns:
            A ``ReceiptStatusTransitionResponse``.
        """
        return ReceiptStatusTransitionResponse(
            receipt_id=receipt.id,
            from_status=from_status,
            to_status=to_status,
            changed_at=changed_at,
            changed_by=changed_by,
        )

    # ==================================================================
    # Supporting DTO conversions
    # ==================================================================

    @staticmethod
    def to_financial_summary(receipt: Receipt) -> ReceiptFinancialSummary:
        """Derive the financial summary for a receipt.

        Args:
            receipt: A ``Receipt`` ORM instance.

        Returns:
            A ``ReceiptFinancialSummary``.
        """
        return ReceiptMapper._compute_financial_summary(receipt)

    @staticmethod
    def to_document_metadata(receipt: Receipt) -> ReceiptDocumentMetadata:
        """Extract document metadata from a receipt.

        Args:
            receipt: A ``Receipt`` ORM instance.

        Returns:
            A ``ReceiptDocumentMetadata``.
        """
        return ReceiptDocumentMetadata(
            document_type="receipt",
            sequence_number=None,
            version=1,
            doc_version=1,
            issued_at=receipt.created_at,
            generated_at=receipt.created_at,
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
    def _to_payment_summary(payment: Any) -> ReceiptPaymentSummary:
        """Build a ``ReceiptPaymentSummary`` from a Payment ORM instance.

        ``currency_code`` is derived from the payment's allocations
        since the Payment model does not store it directly.
        """
        return ReceiptPaymentSummary(
            id=payment.id,
            payment_number=getattr(payment, "payment_number", ""),
            payment_method=(
                payment.payment_method.value
                if isinstance(payment.payment_method, PaymentMethod)
                else str(payment.payment_method)
            ),
            total_amount=payment.total_amount or Decimal("0.00"),
            payment_date=getattr(payment, "payment_date", None),
            currency_code=ReceiptMapper._payment_currency(payment),
        )

    @staticmethod
    def _to_receipt_invoice_summary(
        receipt_invoice: ReceiptInvoice,
    ) -> ReceiptInvoiceSummary:
        """Build a ``ReceiptInvoiceSummary`` from a ``ReceiptInvoice`` association.

        The invoice-level fields (``invoice_number``, ``invoice_date``,
        ``currency_code``, ``grand_total``) are read from the linked
        Invoice ORM instance.

        ``receipt_invoice.invoice`` is guaranteed non-None because
        ``invoice_id`` is part of the composite primary key on the
        ``receipt_invoices`` table (non-nullable).
        """
        invoice = receipt_invoice.invoice
        # ``invoice_id`` is part of the composite PK — always non-null.

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

        return ReceiptInvoiceSummary(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            invoice_date=invoice.invoice_date,
            currency_code=invoice.currency_code,
            grand_total=grand_total,
        )

    @staticmethod
    def _compute_financial_summary(receipt: Receipt) -> ReceiptFinancialSummary:
        """Derive the financial summary from a receipt.

        Pure computation — no business rules, no database access.
        Only transfers existing values.
        """
        total_amount = receipt.amount or Decimal("0.00")
        allocated_amount = total_amount
        unallocated_amount = Decimal("0.00")

        currency_code = DEFAULT_CURRENCY.value
        if receipt.payment is not None:
            currency_code = ReceiptMapper._payment_currency(receipt.payment)

        return ReceiptFinancialSummary(
            currency_code=currency_code,
            total_amount=total_amount,
            allocated_amount=allocated_amount,
            unallocated_amount=unallocated_amount,
        )


__all__ = ["ReceiptMapper"]
