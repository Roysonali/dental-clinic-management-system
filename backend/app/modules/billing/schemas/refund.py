"""Billing Module — Refund schemas.

Provides a complete set of dedicated Pydantic v2 DTOs for the Refund
aggregate root: create, update, read, summary, list, search, filter,
status-transition, financial-summary, audit-summary, gateway-metadata,
document-metadata, payment-summary, and invoice-summary representations.

A refund represents a request to return funds from a completed payment
back to the patient. Refunds follow an approval lifecycle:
PENDING → APPROVED → COMPLETED, or PENDING → REJECTED.

Designed to support future scenarios: partial refunds, multiple refunds
per payment, wallet refunds, Razorpay refunds, bank refunds, cheque
refunds, cash refunds, refund approvals, refund rejection, refund
reversal, refund cancellation, audit history, future GST, future
insurance, future credit notes, and future multi-currency.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.billing.enums import (
    DocumentType,
    RefundStatus,
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


class RefundPaymentSummary(BaseModel):
    """Minimal payment data embedded in refund responses.

    Intentionally does not import from payment.py to keep the refund
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
        description="Method used to settle the original payment.",
        examples=["card"],
    )
    total_amount: Decimal = Field(
        ...,
        title="Total Amount",
        description="Total original payment amount.",
        examples=[Decimal("1500.00")],
    )
    payment_date: date = Field(
        ...,
        title="Payment Date",
        description="Date the original payment was recorded.",
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


class RefundInvoiceSummary(BaseModel):
    """Minimal invoice data embedded in refund responses.

    Intentionally does not import from invoice.py or payment.py to keep the
    refund schema package independent.
    """

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
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
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


# ======================================================================
# Base schemas
# ======================================================================


class RefundBase(BillingBaseModel):
    """Shared refund fields for create and update workflows.

    Does not include audit, numbering, or nested objects. Owned by request
    schemas so that response DTOs can be composed independently.
    """

    payment_id: UUID = Field(
        ...,
        title="Payment ID",
        description="UUID of the payment being refunded (must be COMPLETED).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    amount: PositiveDecimal = Field(
        ...,
        title="Amount",
        description="Refund amount (must be greater than zero; may be less than or equal to the original payment amount).",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        title="Reason",
        description="Reason for the refund.",
        examples=["Patient cancelled treatment."],
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
        examples=["Refund processed due to duplicate charge."],
    )
    rejection_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Rejection Reason",
        description="Reason for rejection (required when rejecting a refund).",
        examples=["Refund request exceeds eligible amount."],
    )


# ======================================================================
# Request schemas
# ======================================================================


class RefundCreateRequest(BillingBaseModel):
    """Request body for ``POST /refunds``.

    Exposes ONLY the fields consumed by ``RefundService.create_refund()``.
    The service assigns the sequential refund number, validates the payment,
    and persists the aggregate.
    """

    payment_id: UUID = Field(
        ...,
        title="Payment ID",
        description="UUID of the payment being refunded (must be COMPLETED).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    amount: PositiveDecimal = Field(
        ...,
        title="Amount",
        description="Refund amount (must be greater than zero; may be less than or equal to the original payment amount).",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        title="Reason",
        description="Reason for the refund.",
        examples=["Patient cancelled treatment."],
    )

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped if stripped else None


class RefundUpdateRequest(BillingUpdateSchema, BillingValidators):
    """Request body for ``PATCH /refunds/{id}``.

    All fields are optional. Only editable refunds (PENDING) may be
    updated. Null values clear nullable fields.
    """

    payment_id: UUID | None = Field(
        default=None,
        title="Payment ID",
        description="Updated payment UUID.",
    )
    amount: PositiveDecimal | None = Field(
        default=None,
        title="Amount",
        description="Updated refund amount.",
        examples=[Decimal("500.00")],
    )
    reason: str | None = Field(
        default=None,
        min_length=1,
        max_length=1000,
        title="Reason",
        description="Updated refund reason.",
        examples=["Patient cancelled treatment."],
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
    rejection_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Rejection Reason",
        description="Updated rejection reason.",
    )


class RefundSearchRequest(BillingBaseModel):
    """Query parameters for refund search endpoints.

    Mirrors query-string search + filter semantics while keeping the
    request payload free-forbid compliant.
    """

    query: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        title="Query",
        description="Free-text search across refund number and patient name.",
        examples=["RFD-00001"],
    )
    payment_id: UUID | None = Field(
        default=None,
        title="Payment ID",
        description="Filter by payment UUID.",
    )
    patient_id: UUID | None = Field(
        default=None,
        title="Patient ID",
        description="Filter by patient UUID (resolved from linked payment).",
    )
    status: str | None = Field(
        default=None,
        title="Status",
        description="Filter by refund status (exact match).",
        examples=["pending"],
    )
    date_from: date | None = Field(
        default=None,
        title="Date From",
        description="Filter refunds with created_at on or after this date.",
    )
    date_to: date | None = Field(
        default=None,
        title="Date To",
        description="Filter refunds with created_at on or before this date.",
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


class RefundFilter(BillingBaseModel):
    """Structured filter payload for advanced refund list endpoints.

    Supports multi-valued filters returned by the UI filter panel.
    """

    statuses: list[str] | None = Field(
        default=None,
        title="Statuses",
        description="Include refunds whose status is one of these values.",
        examples=[["pending", "approved"]],
    )
    payment_ids: list[UUID] | None = Field(
        default=None,
        title="Payment IDs",
        description="Filter to refunds for these payments.",
    )
    patient_ids: list[UUID] | None = Field(
        default=None,
        title="Patient IDs",
        description="Filter to refunds for these patients (resolved from linked payments).",
    )
    amount_min: PositiveDecimal | None = Field(
        default=None,
        title="Amount Min",
        description="Minimum refund amount.",
        examples=[Decimal("100.00")],
    )
    amount_max: PositiveDecimal | None = Field(
        default=None,
        title="Amount Max",
        description="Maximum refund amount.",
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


class RefundStatusTransitionRequest(BillingBaseModel):
    """Request body for refund status transition endpoints.

    The service/validator layer enforces allowed transitions.
    """

    to_status: RefundStatus = Field(
        ...,
        title="To Status",
        description="Target refund status.",
        examples=["approved"],
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reason",
        description="Free-text reason for the transition (required for terminal transitions).",
        examples=["Refund verified and approved."],
    )


# ======================================================================
# Response schemas
# ======================================================================


class RefundStatusTransitionResponse(BillingResponseSchema):
    """Confirms a successful status transition for a refund."""

    refund_id: UUID = Field(
        ...,
        title="Refund ID",
        description="Refund that was transitioned.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    from_status: RefundStatus = Field(
        ...,
        title="From Status",
        description="Previous refund status.",
        examples=["pending"],
    )
    to_status: RefundStatus = Field(
        ...,
        title="To Status",
        description="New refund status.",
        examples=["approved"],
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


class RefundFinancialSummary(BaseModel):
    """Financial snapshot for a refund.

    Immutable aggregate of monetary values. Used inside
    :class:`RefundRead` and as a standalone endpoint response.
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
    refund_amount: Decimal = Field(
        ...,
        title="Refund Amount",
        description="Amount refunded.",
        examples=[Decimal("500.00")],
    )
    payment_total: Decimal = Field(
        ...,
        title="Payment Total",
        description="Total amount of the original payment.",
        examples=[Decimal("1500.00")],
    )
    remaining_on_payment: Decimal = Field(
        default=Decimal("0.00"),
        title="Remaining on Payment",
        description="Amount remaining on the payment after this refund (payment_total - sum of all refunds).",
    )
    refund_count: int = Field(
        default=1,
        ge=1,
        title="Refund Count",
        description="Total number of refunds issued against this payment (including this one).",
        examples=[1],
    )


class RefundAuditSummary(BaseModel):
    """Lightweight audit snapshot for a refund transition."""

    model_config = ConfigDict(frozen=True)

    action: str = Field(
        ...,
        title="Action",
        description="Audit action verb.",
        examples=["refund_created"],
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


class RefundGatewayMetadata(BaseModel):
    """Gateway / external refund metadata for a refund record.

    Carries references required for Razorpay refunds, bank transfers,
    manual offline refunds, and patient-wallet scenarios.
    """

    model_config = ConfigDict(frozen=True)

    gateway_refund_id: str | None = Field(
        default=None,
        title="Gateway Refund ID",
        description="Gateway-side refund / settlement ID (e.g. Razorpay rfndId).",
        examples=["rfnd_1234567890"],
    )
    gateway_payment_id: str | None = Field(
        default=None,
        title="Gateway Payment ID",
        description="Gateway-side original payment ID (e.g. Razorpay payId).",
        examples=["pay_1234567890"],
    )
    bank_reference_number: str | None = Field(
        default=None,
        title="Bank Reference Number",
        description="Bank reference number for offline or bank-transfer refunds.",
        examples=["BANK-REF-998877"],
    )
    refund_source: str | None = Field(
        default=None,
        title="Refund Source",
        description="Origin channel: online, offline, wallet, gateway.",
        examples=["online"],
    )


class RefundDocumentMetadata(BaseModel):
    """Document metadata for a refund.

    Note: ``version`` and ``doc_version`` are intentionally **not** included
    here because they duplicate the root-level fields on
    :class:`RefundRead`. The root-level ``version`` (optimistic-lock) and
    ``doc_version`` (logical revision) are the single source of truth.
    """

    model_config = ConfigDict(frozen=True)

    document_type: DocumentType = Field(
        default=DocumentType.REFUND,
        title="Document Type",
        description="Billing document category.",
    )
    sequence_number: int | None = Field(
        default=None,
        ge=1,
        title="Sequence Number",
        description="Sequential number within the refund series.",
        examples=[1],
    )
    issued_at: datetime | None = Field(
        default=None,
        title="Issued At",
        description="Timestamp when the refund was issued (UTC).",
    )
    generated_at: datetime = Field(
        ...,
        title="Generated At",
        description="Timestamp when the refund was generated (UTC).",
    )


class RefundSummary(BillingResponseSchema):
    """High-level refund summary for dashboard and embed contexts."""

    id: UUID = Field(
        ...,
        title="Refund ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    refund_number: str = Field(
        ...,
        title="Refund Number",
        description="Formatted sequential refund number.",
        examples=["RFD-00001"],
    )
    status: RefundStatus = Field(
        ...,
        title="Status",
        description="Current refund lifecycle status.",
        examples=["pending"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary (resolved from payment).",
    )
    payment: RefundPaymentSummary = Field(
        ...,
        title="Payment",
        description="Linked payment summary.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total refund amount.",
        examples=[Decimal("500.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    reason: str = Field(
        ...,
        title="Reason",
        description="Reason for the refund.",
        examples=["Patient cancelled treatment."],
    )
    financials: RefundFinancialSummary = Field(
        ...,
        title="Financials",
        description="Refund-level financial snapshot.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the refund was created.",
    )


class RefundListItem(BillingResponseSchema):
    """Lightweight refund representation for paginated lists.

    Designed to keep transfer size low when returning many refunds.
    """

    id: UUID = Field(
        ...,
        title="Refund ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    refund_number: str = Field(
        ...,
        title="Refund Number",
        description="Formatted sequential refund number.",
        examples=["RFD-00001"],
    )
    status: RefundStatus = Field(
        ...,
        title="Status",
        description="Current refund lifecycle status.",
        examples=["pending"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary (resolved from payment).",
    )
    payment: RefundPaymentSummary = Field(
        ...,
        title="Payment",
        description="Linked payment summary.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total refund amount.",
        examples=[Decimal("500.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    reason: str = Field(
        ...,
        title="Reason",
        description="Reason for the refund.",
        examples=["Patient cancelled treatment."],
    )
    financials: RefundFinancialSummary = Field(
        ...,
        title="Financials",
        description="Refund-level financial snapshot.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the refund was created.",
    )


class RefundListResponse(BaseModel):
    """Paginated list of refunds for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    items: list[RefundListItem] = Field(
        ...,
        title="Items",
        description="Refunds on this page, ordered by sort criteria.",
    )
    total: int = Field(
        ...,
        ge=0,
        title="Total",
        description="Total matching refunds.",
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


class RefundRead(BillingResponseSchema, TimestampMixin, AuditMixin):
    """Full refund aggregate returned by single-refund GET endpoints.

    Composes nested patient, payment, invoice, financial, document,
    gateway, and audit summaries. The service layer and mapper are
    responsible for populating nested objects from ORM relationships.
    """

    id: UUID = Field(
        ...,
        title="Refund ID",
        description="Unique identifier of the refund.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    refund_number: str = Field(
        ...,
        title="Refund Number",
        description="Formatted sequential refund number.",
        examples=["RFD-00001"],
    )
    document_type: str = Field(
        default="refund",
        title="Document Type",
        description="Billing document category.",
    )
    status: RefundStatus = Field(
        ...,
        title="Status",
        description="Current refund lifecycle status.",
        examples=["pending"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary (resolved from payment).",
    )
    payment: RefundPaymentSummary = Field(
        ...,
        title="Payment",
        description="Linked payment summary.",
    )
    invoices: list[RefundInvoiceSummary] = Field(
        default_factory=list,
        title="Invoices",
        description="Invoices associated with this refund (resolved from the linked payment's allocations).",
    )
    creator: CreatorSummary | None = Field(
        default=None,
        title="Creator",
        description="User who created the refund.",
    )
    updater: CreatorSummary | None = Field(
        default=None,
        title="Updater",
        description="User who last modified the refund.",
    )
    reviewer: CreatorSummary | None = Field(
        default=None,
        title="Reviewer",
        description="User who approved or rejected the refund.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total refund amount.",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        title="Reason",
        description="Reason for the refund.",
        examples=["Patient cancelled treatment."],
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
        examples=["Refund processed due to duplicate charge."],
    )
    rejection_reason: str | None = Field(
        default=None,
        title="Rejection Reason",
        description="Reason for rejection, if applicable.",
    )
    reviewed_by: int | None = Field(
        default=None,
        title="Reviewed By",
        description="User ID who approved or rejected the refund (auth.users.id).",
        examples=[1],
    )
    reviewed_at: datetime | None = Field(
        default=None,
        title="Reviewed At",
        description="Timestamp when the refund was approved or rejected.",
    )
    financials: RefundFinancialSummary = Field(
        ...,
        title="Financials",
        description="Refund-level financial snapshot.",
    )
    gateway_metadata: RefundGatewayMetadata | None = Field(
        default=None,
        title="Gateway Metadata",
        description="External payment gateway references (gateway refund ID, payment ID, bank reference).",
    )
    document_metadata: RefundDocumentMetadata = Field(
        ...,
        title="Document Metadata",
        description="Document numbering and versioning metadata.",
    )
    audit_trail: list[RefundAuditSummary] = Field(
        default_factory=list,
        title="Audit Trail",
        description="Ordered audit events for this refund.",
    )
    version: int = Field(
        ...,
        ge=1,
        title="Version",
        description="Optimistic-lock version counter.",
    )
    doc_version: int = Field(
        ...,
        ge=1,
        title="Document Version",
        description="Logical document revision number.",
    )


__all__ = [
    "RefundAuditSummary",
    "RefundBase",
    "RefundCreateRequest",
    "RefundDocumentMetadata",
    "RefundFilter",
    "RefundFinancialSummary",
    "RefundGatewayMetadata",
    "RefundInvoiceSummary",
    "RefundListItem",
    "RefundListResponse",
    "RefundPaymentSummary",
    "RefundRead",
    "RefundSearchRequest",
    "RefundStatusTransitionRequest",
    "RefundStatusTransitionResponse",
    "RefundSummary",
    "RefundUpdateRequest",
]
