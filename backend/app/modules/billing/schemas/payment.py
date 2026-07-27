"""Billing Module — Payment schemas.

Provides a complete set of dedicated Pydantic v2 DTOs for the Payment
aggregate root: create, update, read, summary, list, search, filter,
status-transition, allocation-summary, financial-summary, gateway-metadata,
audit-summary, and method-summary representations.

Nested patient, invoice, and creator objects are represented by lightweight
summary DTOs defined here to avoid cross-module import coupling.

Designed to support future scenarios: advance payments, unallocated payments,
partial allocations, multiple invoices per payment, refunds, credit notes,
patient wallet, and Razorpay / external gateway integrations.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.billing.enums import (
    PaymentMethod,
    PaymentStatus,
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
from app.modules.billing.schemas.validators import BillingValidators
from app.modules.billing.schemas.types import PositiveDecimal


class InvoiceSummary(BaseModel):
    """Minimal invoice data embedded in payment allocation responses."""

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


class PaymentBase(BillingBaseModel):
    """Shared payment fields for create and update workflows.

    Does not include audit, numbering, or nested objects. Owned by request
    schemas so that response DTOs can be composed independently.
    """

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient who made the payment (must exist and be active).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    payment_method: PaymentMethod = Field(
        ...,
        title="Payment Method",
        description="Method used to settle the payment.",
        examples=["card"],
    )
    total_amount: PositiveDecimal = Field(
        ...,
        title="Total Amount",
        description="Total payment amount (must be greater than zero).",
        examples=[Decimal("1500.00")],
    )
    payment_date: date = Field(
        ...,
        title="Payment Date",
        description="Date the payment was recorded.",
        examples=["2026-07-23"],
    )
    reference_number: str | None = Field(
        default=None,
        max_length=100,
        title="Reference Number",
        description="External transaction ID, cheque number, gateway reference, or bank reference number (null for advance/unallocated payments).",
        examples=["TXN-1234567890"],
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        title="Notes",
        description="Free-text notes.",
        examples=["Paid via online gateway."],
    )
    reversal_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reversal Reason",
        description="Reason for reversal (required when marking a payment as reversed).",
        examples=["Duplicate transaction."],
    )


# ======================================================================
# Request schemas
# ======================================================================


class PaymentCreateRequest(BillingCreateSchema, PaymentBase, BillingValidators):
    """Request body for ``POST /payments``.

    Creates a new payment. The service layer assigns the sequential payment
    number and persists the aggregate.
    """

    @field_validator("reference_number", mode="before")
    @classmethod
    def normalize_reference_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped if stripped else None


class PaymentMetadataUpdateRequest(BillingUpdateSchema):
    """Request body for ``PATCH /billing/payments/{id}``.

    Only supports updating ``reference_number`` and ``notes`` on Pending
    payments. All fields are optional — omitted fields are not modified.
    """

    reference_number: str | None = Field(
        default=None,
        max_length=100,
        title="Reference Number",
        description="Updated external transaction ID, cheque number, or gateway reference.",
        examples=["TXN-1234567890"],
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        title="Notes",
        description="Updated free-text notes for the payment.",
        examples=["Paid via online gateway."],
    )


class PaymentUpdateRequest(BillingUpdateSchema, BillingValidators):
    """Request body for ``PATCH /payments/{id}``.

    All fields are optional. Only editable payments (PENDING) may be
    updated. Null values clear nullable fields.

    Note: This schema intentionally does **not** inherit from
    ``PaymentBase`` because PATCH semantics require every field to be
    optional. ``PaymentBase.patient_id`` is required, which would violate
    the PATCH contract. Fields are declared here explicitly with
    ``Optional`` wrappers so callers can send a partial payload.

    The service layer validates that immutable fields are not overwritten.
    """

    patient_id: UUID | None = Field(
        default=None,
        title="Patient ID",
        description="Updated patient UUID.",
    )
    payment_method: PaymentMethod | None = Field(
        default=None,
        title="Payment Method",
        description="Updated payment method.",
    )
    total_amount: PositiveDecimal | None = Field(
        default=None,
        title="Total Amount",
        description="Updated total payment amount.",
    )
    payment_date: date | None = Field(
        default=None,
        title="Payment Date",
        description="Updated payment date.",
    )
    reference_number: str | None = Field(
        default=None,
        max_length=100,
        title="Reference Number",
        description="Updated external transaction ID, cheque number, or gateway reference.",
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        title="Notes",
        description="Updated free-text notes.",
    )
    reversal_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reversal Reason",
        description="Updated reversal reason.",
    )


class PaymentSearchRequest(BillingBaseModel):
    """Query parameters for payment search endpoints.

    Mirrors query-string search + filter semantics while keeping the
    request payload free-forbid compliant.
    """

    query: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        title="Query",
        description="Free-text search across payment number and patient name.",
        examples=["PAY-00001"],
    )
    patient_id: UUID | None = Field(
        default=None,
        title="Patient ID",
        description="Filter by patient UUID.",
    )
    status: str | None = Field(
        default=None,
        title="Status",
        description="Filter by payment status (exact match).",
        examples=["completed"],
    )
    payment_method: str | None = Field(
        default=None,
        title="Payment Method",
        description="Filter by payment method (exact match).",
        examples=["card"],
    )
    date_from: date | None = Field(
        default=None,
        title="Date From",
        description="Filter payments with payment_date on or after this date.",
    )
    date_to: date | None = Field(
        default=None,
        title="Date To",
        description="Filter payments with payment_date on or before this date.",
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


class PaymentFilter(BillingBaseModel):
    """Structured filter payload for advanced payment list endpoints.

    Supports multi-valued filters returned by the UI filter panel.
    """

    statuses: list[str] | None = Field(
        default=None,
        title="Statuses",
        description="Include payments whose status is one of these values.",
        examples=[["completed", "pending"]],
    )
    payment_methods: list[str] | None = Field(
        default=None,
        title="Payment Methods",
        description="Filter to these payment methods.",
        examples=[["cash", "card"]],
    )
    patient_ids: list[UUID] | None = Field(
        default=None,
        title="Patient IDs",
        description="Filter to payments for these patients.",
    )
    amount_min: PositiveDecimal | None = Field(
        default=None,
        title="Amount Min",
        description="Minimum total_amount.",
        examples=[Decimal("100.00")],
    )
    amount_max: PositiveDecimal | None = Field(
        default=None,
        title="Amount Max",
        description="Maximum total_amount.",
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





# ======================================================================
# Response schemas
# ======================================================================


class PaymentStatusTransitionResponse(BillingResponseSchema):
    """Confirms a successful status transition for a payment."""

    payment_id: UUID = Field(
        ...,
        title="Payment ID",
        description="Payment that was transitioned.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    from_status: PaymentStatus = Field(
        ...,
        title="From Status",
        description="Previous payment status.",
        examples=["pending"],
    )
    to_status: PaymentStatus = Field(
        ...,
        title="To Status",
        description="New payment status.",
        examples=["completed"],
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


class PaymentAllocationSummary(BaseModel):
    """Lightweight payment-against-invoice summary.

    Supports multiple allocations per payment, advance allocations
    (invoice is None), and refund allocations (is_refund=True).
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Allocation ID",
        description="Unique allocation identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    invoice: InvoiceSummary | None = Field(
        default=None,
        title="Invoice",
        description="Linked invoice summary (null for advance/unallocated payments or refunds).",
    )
    allocated_amount: Decimal = Field(
        ...,
        title="Allocated Amount",
        description="Amount allocated to the invoice.",
        examples=[Decimal("1000.00")],
    )
    is_refund: bool = Field(
        ...,
        title="Is Refund",
        description="True if this allocation represents a refund.",
        examples=[False],
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the allocation was created.",
    )


class PaymentFinancialSummary(BaseModel):
    """Financial snapshot for a payment.

    Immutable aggregate of monetary values. Used inside
    :class:`PaymentRead` and as a standalone endpoint response.
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
        description="Total payment amount recorded.",
        examples=[Decimal("1500.00")],
    )
    allocated_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Allocated Amount",
        description="Cumulative amount allocated to invoices (excludes refunds).",
    )
    refunded_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Refunded Amount",
        description="Cumulative refund amount issued against this payment.",
    )
    unallocated_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Unallocated Amount",
        description="total_amount - allocated_amount - refunded_amount.",
    )


class PaymentMethodSummary(BaseModel):
    """Aggregated payment statistics by method."""

    model_config = ConfigDict(frozen=True)

    payment_method: str = Field(
        ...,
        title="Payment Method",
        description="Payment method value.",
        examples=["card"],
    )
    count: int = Field(
        ...,
        ge=0,
        title="Count",
        description="Number of payments using this method.",
        examples=[15],
    )
    total_amount: Decimal = Field(
        ...,
        title="Total Amount",
        description="Sum of total_amount for this method.",
        examples=[Decimal("45000.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )


class PaymentGatewayMetadata(BaseModel):
    """Gateway / external payment metadata for a payment record.

    Carries references required for Razorpay, bank transfers, manual
    offline entries, and patient-wallet scenarios.
    """

    model_config = ConfigDict(frozen=True)

    gateway_txn_id: str | None = Field(
        default=None,
        title="Gateway Transaction ID",
        description="Gateway-side transaction / payment ID (e.g. Razorpay payId).",
        examples=["pay_1234567890"],
    )
    gateway_order_id: str | None = Field(
        default=None,
        title="Gateway Order ID",
        description="Gateway-side order / session ID created before payment.",
        examples=["order_ABCDEFGHIJ1234567890"],
    )
    bank_reference_number: str | None = Field(
        default=None,
        title="Bank Reference Number",
        description="Bank reference number for offline or bank-transfer payments.",
        examples=["BANK-REF-998877"],
    )
    payment_source: str | None = Field(
        default=None,
        title="Payment Source",
        description="Origin channel: online, offline, manual, gateway.",
        examples=["online"],
    )


class PaymentAuditSummary(BaseModel):
    """Lightweight audit snapshot for a payment transition."""

    model_config = ConfigDict(frozen=True)

    action: str = Field(
        ...,
        title="Action",
        description="Audit action verb.",
        examples=["payment_received"],
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


class PaymentSummary(BillingResponseSchema):
    """High-level payment summary for dashboard and embed contexts."""

    id: UUID = Field(
        ...,
        title="Payment ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    payment_number: str = Field(
        ...,
        title="Payment Number",
        description="Formatted sequential payment number.",
        examples=["PAY-00001"],
    )
    status: PaymentStatus = Field(
        ...,
        title="Status",
        description="Current payment lifecycle status.",
        examples=["completed"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    payment_method: PaymentMethod = Field(
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
    )
    reference_number: str | None = Field(
        default=None,
        title="Reference Number",
        description="External transaction ID, cheque number, or gateway reference.",
        examples=["TXN-1234567890"],
    )
    financials: PaymentFinancialSummary = Field(
        ...,
        title="Financials",
        description="Payment-level financial snapshot.",
    )
    allocation_count: int = Field(
        ...,
        ge=0,
        title="Allocation Count",
        description="Number of allocations attached to this payment.",
        examples=[2],
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the payment was created.",
    )


class PaymentListItem(BillingResponseSchema):
    """Lightweight payment representation for paginated lists.

    Designed to keep transfer size low when returning many payments.
    """

    id: UUID = Field(
        ...,
        title="Payment ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    payment_number: str = Field(
        ...,
        title="Payment Number",
        description="Formatted sequential payment number.",
        examples=["PAY-00001"],
    )
    status: PaymentStatus = Field(
        ...,
        title="Status",
        description="Current payment lifecycle status.",
        examples=["completed"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    payment_method: PaymentMethod = Field(
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
    )
    financials: PaymentFinancialSummary = Field(
        ...,
        title="Financials",
        description="Payment-level financial snapshot.",
    )
    allocation_count: int = Field(
        ...,
        ge=0,
        title="Allocation Count",
        description="Number of allocations attached to this payment.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the payment was created.",
    )


class PaymentListResponse(BaseModel):
    """Paginated list of payments for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    items: list[PaymentListItem] = Field(
        ...,
        title="Items",
        description="Payments on this page, ordered by sort criteria.",
    )
    total: int = Field(
        ...,
        ge=0,
        title="Total",
        description="Total matching payments.",
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


class PaymentRead(BillingResponseSchema, TimestampMixin, AuditMixin):
    """Full payment aggregate returned by single-payment GET endpoints.

    Composes nested patient, allocations, financial, gateway, and audit
    summaries. The service layer and mapper are responsible for populating
    nested objects from ORM relationships.
    """

    id: UUID = Field(
        ...,
        title="Payment ID",
        description="Unique identifier of the payment.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    payment_number: str = Field(
        ...,
        title="Payment Number",
        description="Formatted sequential payment number.",
        examples=["PAY-00001"],
    )
    document_type: str = Field(
        default="payment",
        title="Document Type",
        description="Billing document category.",
    )
    status: PaymentStatus = Field(
        ...,
        title="Status",
        description="Current payment lifecycle status.",
        examples=["completed"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    creator: CreatorSummary | None = Field(
        default=None,
        title="Creator",
        description="User who created the payment.",
    )
    updater: CreatorSummary | None = Field(
        default=None,
        title="Updater",
        description="User who last modified the payment.",
    )
    payment_method: PaymentMethod = Field(
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
    )
    currency_code: str = Field(
        ...,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    reference_number: str | None = Field(
        default=None,
        title="Reference Number",
        description="External transaction ID, cheque number, or gateway reference.",
        examples=["TXN-1234567890"],
    )
    is_reversed: bool = Field(
        ...,
        title="Is Reversed",
        description="True if the payment has been fully reversed.",
        examples=[False],
    )
    reversal_reason: str | None = Field(
        default=None,
        title="Reversal Reason",
        description="Reason for reversal, if applicable.",
    )
    notes: str | None = Field(
        default=None,
        title="Notes",
        description="Free-text notes.",
        examples=["Paid via online gateway."],
    )
    allocations: list[PaymentAllocationSummary] = Field(
        default_factory=list,
        title="Allocations",
        description="Ordered payment allocations (may be empty for advance payments).",
    )
    financials: PaymentFinancialSummary = Field(
        ...,
        title="Financials",
        description="Payment-level financial snapshot.",
    )
    gateway_metadata: PaymentGatewayMetadata | None = Field(
        default=None,
        title="Gateway Metadata",
        description="External payment gateway references (gateway txn ID, order ID, bank reference).",
        examples=[
            {
                "gateway_txn_id": "pay_1234567890",
                "gateway_order_id": "order_ABCDEFGHIJ1234567890",
                "bank_reference_number": None,
                "payment_source": "online",
            }
        ],
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
    "CreatorSummary",
    "InvoiceSummary",
    "PatientSummary",
    "PaymentAllocationSummary",
    "PaymentAuditSummary",
    "PaymentBase",
    "PaymentCreateRequest",
    "PaymentFilter",
    "PaymentFinancialSummary",
    "PaymentGatewayMetadata",
    "PaymentListItem",
    "PaymentListResponse",
    "PaymentMethodSummary",
    "PaymentRead",
    "PaymentSearchRequest",
    "PaymentMetadataUpdateRequest",
    "PaymentStatusTransitionResponse",
    "PaymentSummary",
    "PaymentUpdateRequest",
]
