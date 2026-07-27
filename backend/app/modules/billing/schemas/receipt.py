"""Billing Module — Receipt schemas.

Provides a complete set of dedicated Pydantic v2 DTOs for the Receipt
aggregate root: create, update, read, summary, list, search, filter,
status-transition, financial-summary, audit-summary, print-metadata,
payment-summary, document-metadata, and related representations.

A receipt is evidence of payment: it references one Payment and may be
associated with multiple invoices via ReceiptInvoice associations. Receipts
are immutable after creation (FI-RCP-001).

Designed to support future scenarios: advance payments, partial allocations,
multiple invoices per receipt, multiple currencies, refunds, credit notes,
patient wallet, future GST, and future insurance integrations.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.billing.enums import (
    CurrencyCode,
    DocumentType,
    ReceiptStatus,
)
from app.modules.billing.schemas.base import (
    BillingBaseModel,
    BillingCreateSchema,
    BillingResponseSchema,
    BillingUpdateSchema,
)
from app.modules.billing.schemas.common import (
    SortOrder,
)
from app.modules.billing.schemas.mixins import (
    AuditMixin,
    TimestampMixin,
)
from app.modules.billing.schemas.summaries import (
    CreatorSummary,
    PatientSummary,
)
from app.modules.billing.schemas.types import (
    PositiveDecimal,
)
from app.modules.billing.schemas.validators import BillingValidators


# ======================================================================
# Embedded lightweight summaries
# ======================================================================


class ReceiptInvoiceSummary(BaseModel):
    """Minimal invoice data embedded in receipt responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Invoice ID",
        description="Unique invoice identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    invoice_number: str = Field(
        ...,
        title="Invoice Number",
        description="Formatted sequential invoice number.",
        examples=["INV-00001"],
    )
    invoice_date: date = Field(
        ...,
        title="Invoice Date",
        description="Date the invoice was created.",
        examples=["2026-07-23"],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    grand_total: Decimal = Field(
        ...,
        title="Grand Total",
        description="Final monetary total of the invoice.",
        examples=[Decimal("3000.00")],
    )


class ReceiptPaymentSummary(BaseModel):
    """Lightweight payment data embedded in receipt responses.

    Intentionally does not import from payment.py to keep the receipt
    schema package independent.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Payment ID",
        description="Unique payment identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    payment_number: str = Field(
        ...,
        title="Payment Number",
        description="Formatted sequential payment number.",
        examples=["PAY-00001"],
    )
    payment_method: str = Field(
        ...,
        title="Payment Method",
        description="Method used to settle the payment.",
        examples=["card"],
    )
    total_amount: Decimal = Field(
        ...,
        title="Total Amount",
        description="Total payment amount recorded.",
        examples=[Decimal("1500.00")],
    )
    payment_date: date = Field(
        ...,
        title="Payment Date",
        description="Date the payment was recorded.",
        examples=["2026-07-23"],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )


# ======================================================================
# Base schemas
# ======================================================================


class ReceiptBase(BillingBaseModel):
    """Shared receipt fields for create and update workflows.

    Does not include audit, numbering, nested objects, or payment linkage.
    Owned by request schemas so that response DTOs can be composed
    independently.
    """

    receipt_date: date = Field(
        ...,
        title="Receipt Date",
        description="Date the receipt was generated.",
        examples=["2026-07-23"],
    )
    amount: PositiveDecimal = Field(
        ...,
        title="Amount",
        description="Total receipted amount (must be greater than zero).",
        examples=[Decimal("1500.00")],
    )
    currency_code: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        title="Notes",
        description="Free-text notes.",
        examples=["Receipt issued for dental treatment payment."],
    )
    cancellation_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Cancellation Reason",
        description="Reason for cancellation (required when cancelling).",
        examples=["Receipt issued in error."],
    )


# ======================================================================
# Request schemas
# ======================================================================


class ReceiptCreateRequest(BillingCreateSchema, ReceiptBase, BillingValidators):
    """Request body for ``POST /receipts``.

    Creates a new receipt. The service layer assigns the sequential receipt
    number and persists the aggregate.
    """

    payment_id: UUID = Field(
        ...,
        title="Payment ID",
        description="UUID of the payment to acknowledge (must be COMPLETED and not already receipted).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )


class ReceiptGenerateRequest(BillingBaseModel):
    """Request body for ``POST /receipts`` — router-level DTO.

    Exposes ONLY the fields consumed by ``ReceiptService.generate_receipt()``.
    The service assigns the sequential receipt number, amount, and date
    internally.
    """

    payment_id: UUID = Field(
        ...,
        title="Payment ID",
        description="UUID of the payment to acknowledge (must be COMPLETED and not already receipted).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )


class ReceiptUpdateRequest(BillingUpdateSchema, BillingValidators):
    """Request body for ``PATCH /receipts/{id}``.

    All fields are optional. Receipts are immutable after creation, so
    updates are limited to metadata fields managed by the application layer.
    """

    receipt_date: date | None = Field(
        default=None,
        title="Receipt Date",
        description="Updated receipt date.",
        examples=["2026-07-23"],
    )
    amount: PositiveDecimal | None = Field(
        default=None,
        title="Amount",
        description="Updated receipted amount.",
        examples=[Decimal("1500.00")],
    )
    currency_code: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        title="Notes",
        description="Updated free-text notes.",
    )
    cancellation_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Cancellation Reason",
        description="Updated cancellation reason.",
    )


class ReceiptSearchRequest(BillingBaseModel):
    """Query parameters for receipt search endpoints.

    Mirrors query-string search + filter semantics while keeping the
    request payload free-forbid compliant.
    """

    query: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        title="Query",
        description="Free-text search across receipt number and patient name.",
        examples=["RCT-00001"],
    )
    patient_id: UUID | None = Field(
        default=None,
        title="Patient ID",
        description="Filter by patient UUID (resolved from linked payment).",
    )
    payment_id: UUID | None = Field(
        default=None,
        title="Payment ID",
        description="Filter by payment UUID.",
    )
    status: str | None = Field(
        default=None,
        title="Status",
        description="Filter by receipt status (exact match).",
        examples=["generated"],
    )
    date_from: date | None = Field(
        default=None,
        title="Date From",
        description="Filter receipts with receipt_date on or after this date.",
    )
    date_to: date | None = Field(
        default=None,
        title="Date To",
        description="Filter receipts with receipt_date on or before this date.",
    )
    page: int = Field(
        default=1,
        ge=1,
        title="Page",
        description="1-based page number.",
        examples=[1],
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        title="Page Size",
        description="Items per page (max 100).",
        examples=[20],
    )
    sort_by: str = Field(
        default="created_at",
        title="Sort By",
        description="Field to sort by.",
        examples=["created_at"],
    )
    sort_order: SortOrder = Field(
        default=SortOrder.ASC,
        title="Sort Order",
        description="Sort direction.",
        examples=["desc"],
    )


class ReceiptFilter(BillingBaseModel):
    """Structured filter payload for advanced receipt list endpoints.

    Supports multi-valued filters returned by the UI filter panel.
    """

    statuses: list[str] | None = Field(
        default=None,
        title="Statuses",
        description="Include receipts whose status is one of these values.",
        examples=[["generated", "cancelled"]],
    )
    payment_ids: list[UUID] | None = Field(
        default=None,
        title="Payment IDs",
        description="Filter to receipts for these payments.",
    )
    patient_ids: list[UUID] | None = Field(
        default=None,
        title="Patient IDs",
        description="Filter to receipts for these patients (resolved from linked payments).",
    )
    amount_min: PositiveDecimal | None = Field(
        default=None,
        title="Amount Min",
        description="Minimum receipt amount.",
        examples=[Decimal("100.00")],
    )
    amount_max: PositiveDecimal | None = Field(
        default=None,
        title="Amount Max",
        description="Maximum receipt amount.",
        examples=[Decimal("10000.00")],
    )
    page: int = Field(
        default=1,
        ge=1,
        title="Page",
        description="1-based page number.",
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        title="Page Size",
        description="Items per page (max 100).",
    )
    sort_by: str = Field(
        default="created_at",
        title="Sort By",
        description="Field to sort by.",
    )
    sort_order: SortOrder = Field(
        default=SortOrder.ASC,
        title="Sort Order",
        description="Sort direction.",
    )

    @field_validator("statuses", mode="before")
    @classmethod
    def _normalize_statuses(cls, value: object) -> list[str] | None:
        if value is None:
            return value
        return [str(v).strip().lower() for v in value]


class ReceiptStatusTransitionRequest(BillingBaseModel):
    """Request body for receipt status transition endpoints.

    The service/validator layer enforces allowed transitions.
    """

    to_status: ReceiptStatus = Field(
        ...,
        title="To Status",
        description="Target receipt status.",
        examples=["cancelled"],
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reason",
        description="Free-text reason for the transition (required for terminal transitions).",
        examples=["Receipt issued in error."],
    )


# ======================================================================
# Response schemas
# ======================================================================


class ReceiptStatusTransitionResponse(BillingResponseSchema):
    """Confirms a successful status transition for a receipt."""

    receipt_id: UUID = Field(
        ...,
        title="Receipt ID",
        description="Receipt that was transitioned.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    from_status: ReceiptStatus = Field(
        ...,
        title="From Status",
        description="Previous receipt status.",
        examples=["generated"],
    )
    to_status: ReceiptStatus = Field(
        ...,
        title="To Status",
        description="New receipt status.",
        examples=["cancelled"],
    )
    changed_at: datetime = Field(
        ...,
        title="Changed At",
        description="Timestamp when the transition was applied.",
    )
    changed_by: int = Field(
        ...,
        title="Changed By",
        description="User ID who performed the transition (auth.users.id).",
        examples=[1],
    )


class ReceiptFinancialSummary(BaseModel):
    """Financial snapshot for a receipt.

    Immutable aggregate of monetary values. Used inside
    :class:`ReceiptRead` and as a standalone endpoint response.
    """

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    total_amount: Decimal = Field(
        ...,
        title="Total Amount",
        description="Total receipted amount.",
        examples=[Decimal("1500.00")],
    )
    allocated_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Allocated Amount",
        description="Cumulative amount explicitly allocated to invoices via this receipt.",
    )
    unallocated_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Unallocated Amount",
        description="Portion of receipt not assigned to a specific invoice.",
    )


class ReceiptAuditSummary(BaseModel):
    """Lightweight audit snapshot for a receipt transition."""

    model_config = ConfigDict(frozen=True)

    action: str = Field(
        ...,
        title="Action",
        description="Audit action verb.",
        examples=["generated"],
    )
    performed_by: CreatorSummary = Field(
        ...,
        title="Performed By",
        description="User who performed the action.",
    )
    occurred_at: datetime = Field(
        ...,
        title="Occurred At",
        description="Timestamp when the action was performed.",
    )
    reason: str | None = Field(
        default=None,
        title="Reason",
        description="Free-text reason supplied for the action.",
    )


class ReceiptPrintMetadata(BaseModel):
    """Printing metadata for a receipt document."""

    model_config = ConfigDict(frozen=True)

    receipt_number: str = Field(
        ...,
        title="Receipt Number",
        description="Formatted receipt number.",
        examples=["RCT-00001"],
    )
    print_count: int = Field(
        default=0,
        ge=0,
        title="Print Count",
        description="Number of times this receipt has been printed.",
        examples=[2],
    )
    last_printed_at: datetime | None = Field(
        default=None,
        title="Last Printed At",
        description="Timestamp of the most recent print.",
    )
    printed_by: int | None = Field(
        default=None,
        title="Printed By",
        description="User ID who last printed this receipt (auth.users.id).",
        examples=[1],
    )
    template_version: str | None = Field(
        default=None,
        title="Template Version",
        description="Identifier of the template used for printing.",
        examples=["v1"],
    )
    duplicate_copy: bool = Field(
        default=False,
        title="Duplicate Copy",
        description="True if this is a duplicate print of a previously issued receipt.",
        examples=[False],
    )
    print_notes: str | None = Field(
        default=None,
        title="Print Notes",
        description="Notes related to printing (e.g. reason for reprint).",
    )


class ReceiptDocumentMetadata(BaseModel):
    """Document metadata for a receipt."""

    model_config = ConfigDict(frozen=True)

    document_type: DocumentType = Field(
        default=DocumentType.RECEIPT,
        title="Document Type",
        description="Billing document category.",
    )
    sequence_number: int | None = Field(
        default=None,
        ge=1,
        title="Sequence Number",
        description="Sequential number within the receipt series.",
        examples=[1],
    )
    version: int = Field(
        default=1,
        ge=1,
        title="Version",
        description="Optimistic-lock version counter.",
    )
    doc_version: int = Field(
        default=1,
        ge=1,
        title="Document Version",
        description="Logical document revision number.",
    )
    issued_at: datetime | None = Field(
        default=None,
        title="Issued At",
        description="Timestamp when the receipt was issued (UTC).",
    )
    generated_at: datetime = Field(
        ...,
        title="Generated At",
        description="Timestamp when the receipt was generated (UTC).",
    )


class ReceiptSummary(BillingResponseSchema):
    """High-level receipt summary for dashboard and embed contexts."""

    id: UUID = Field(
        ...,
        title="Receipt ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    receipt_number: str = Field(
        ...,
        title="Receipt Number",
        description="Formatted sequential receipt number.",
        examples=["RCT-00001"],
    )
    status: ReceiptStatus = Field(
        ...,
        title="Status",
        description="Current receipt lifecycle status.",
        examples=["generated"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary (resolved from payment).",
    )
    payment: ReceiptPaymentSummary = Field(
        ...,
        title="Payment",
        description="Linked payment summary.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total receipted amount.",
        examples=[Decimal("1500.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    receipt_date: date = Field(
        ...,
        title="Receipt Date",
        description="Date the receipt was generated.",
        examples=["2026-07-23"],
    )
    financials: ReceiptFinancialSummary = Field(
        ...,
        title="Financials",
        description="Receipt-level financial snapshot.",
    )
    invoice_count: int = Field(
        ...,
        ge=0,
        title="Invoice Count",
        description="Number of invoices attached to this receipt.",
        examples=[2],
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the receipt was created.",
    )


class ReceiptListItem(BillingResponseSchema):
    """Lightweight receipt representation for paginated lists.

    Designed to keep transfer size low when returning many receipts.
    """

    id: UUID = Field(
        ...,
        title="Receipt ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    receipt_number: str = Field(
        ...,
        title="Receipt Number",
        description="Formatted sequential receipt number.",
        examples=["RCT-00001"],
    )
    status: ReceiptStatus = Field(
        ...,
        title="Status",
        description="Current receipt lifecycle status.",
        examples=["generated"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary (resolved from payment).",
    )
    payment: ReceiptPaymentSummary = Field(
        ...,
        title="Payment",
        description="Linked payment summary.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total receipted amount.",
        examples=[Decimal("1500.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    receipt_date: date = Field(
        ...,
        title="Receipt Date",
        description="Date the receipt was generated.",
        examples=["2026-07-23"],
    )
    financials: ReceiptFinancialSummary = Field(
        ...,
        title="Financials",
        description="Receipt-level financial snapshot.",
    )
    invoice_count: int = Field(
        ...,
        ge=0,
        title="Invoice Count",
        description="Number of invoices attached to this receipt.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the receipt was created.",
    )


class ReceiptListResponse(BaseModel):
    """Paginated list of receipts for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    items: list[ReceiptListItem] = Field(
        ...,
        title="Items",
        description="Receipts on this page, ordered by sort criteria.",
    )
    total: int = Field(
        ...,
        ge=0,
        title="Total",
        description="Total matching receipts.",
        examples=[42],
    )
    page: int = Field(
        ...,
        ge=1,
        title="Page",
        description="Current page number (1-based).",
    )
    page_size: int = Field(
        ...,
        ge=1,
        title="Page Size",
        description="Items per page.",
    )


class ReceiptRead(BillingResponseSchema, TimestampMixin, AuditMixin):
    """Full receipt aggregate returned by single-receipt GET endpoints.

    Composes nested patient, payment, invoice association, financial,
    document, print, and audit summaries. The service layer and mapper are
    responsible for populating nested objects from ORM relationships.
    """

    id: UUID = Field(
        ...,
        title="Receipt ID",
        description="Unique identifier of the receipt.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    receipt_number: str = Field(
        ...,
        title="Receipt Number",
        description="Formatted sequential receipt number.",
        examples=["RCT-00001"],
    )
    document_type: str = Field(
        default="receipt",
        title="Document Type",
        description="Billing document category.",
    )
    status: ReceiptStatus = Field(
        ...,
        title="Status",
        description="Current receipt lifecycle status.",
        examples=["generated"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary (resolved from payment).",
    )
    payment: ReceiptPaymentSummary = Field(
        ...,
        title="Payment",
        description="Linked payment summary.",
    )
    creator: CreatorSummary | None = Field(
        default=None,
        title="Creator",
        description="User who created the receipt.",
    )
    updater: CreatorSummary | None = Field(
        default=None,
        title="Updater",
        description="User who last modified the receipt (immutable after creation).",
    )
    receipt_date: date = Field(
        ...,
        title="Receipt Date",
        description="Date the receipt was generated.",
        examples=["2026-07-23"],
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total receipted amount.",
        examples=[Decimal("1500.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    notes: str | None = Field(
        default=None,
        title="Notes",
        description="Free-text notes.",
        examples=["Receipt issued for dental treatment payment."],
    )
    cancellation_reason: str | None = Field(
        default=None,
        title="Cancellation Reason",
        description="Reason for cancellation, if applicable.",
    )
    receipt_invoices: list[ReceiptInvoiceSummary] = Field(
        default_factory=list,
        title="Linked Invoices",
        description="Invoices covered by this receipt (consolidated receipts).",
    )
    financials: ReceiptFinancialSummary = Field(
        ...,
        title="Financials",
        description="Receipt-level financial snapshot.",
    )
    print_metadata: ReceiptPrintMetadata | None = Field(
        default=None,
        title="Print Metadata",
        description="Printing metadata for this receipt.",
    )
    document_metadata: ReceiptDocumentMetadata = Field(
        ...,
        title="Document Metadata",
        description="Document numbering and versioning metadata.",
    )
    audit_trail: list[ReceiptAuditSummary] = Field(
        default_factory=list,
        title="Audit Trail",
        description="Ordered audit events for this receipt.",
    )


__all__ = [
    "ReceiptAuditSummary",
    "ReceiptBase",
    "ReceiptCreateRequest",
    "ReceiptDocumentMetadata",
    "ReceiptFilter",
    "ReceiptGenerateRequest",
    "ReceiptFinancialSummary",
    "ReceiptInvoiceSummary",
    "ReceiptListResponse",
    "ReceiptListItem",
    "ReceiptPaymentSummary",
    "ReceiptPrintMetadata",
    "ReceiptRead",
    "ReceiptSearchRequest",
    "ReceiptStatusTransitionRequest",
    "ReceiptStatusTransitionResponse",
    "ReceiptSummary",
    "ReceiptUpdateRequest",
]
