"""Billing Module — Invoice schemas.

Provides a complete set of dedicated Pydantic v2 DTOs for the Invoice
aggregate root: create, update, read, summary, list, search, filter,
status-transition, and financial-summary representations.

Nested patient, doctor, treatment-plan, and appointment objects are
represented by lightweight summary DTOs defined here to avoid cross-module
import coupling.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.billing.enums import (
    InvoiceStatus,
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
from app.modules.billing.schemas.invoice_item import (
    InvoiceItemCreate,
    InvoiceItemSummary,
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
from app.modules.billing.schemas.types import (
    PositiveDecimal,
)


class DoctorSummary(BaseModel):
    """Minimal doctor data embedded in invoice responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Doctor ID",
        description="Unique doctor identifier.",
    )
    doctor_code: str = Field(
        ...,
        title="Doctor Code",
        description="Auto-generated doctor code (e.g. DOC-00001).",
        examples=["DOC-00001"],
    )
    user_full_name: str | None = Field(
        default=None,
        title="User Full Name",
        description="Resolved full name from the linked user record.",
        examples=["Maria Santos"],
    )
    is_active: bool = Field(
        ...,
        title="Is Active",
        description="Whether the doctor profile is active.",
        examples=[True],
    )


class TreatmentPlanSummary(BaseModel):
    """Minimal treatment plan data embedded in invoice responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Plan ID",
        description="Unique treatment plan identifier.",
    )
    plan_code: str = Field(
        ...,
        title="Plan Code",
        description="Auto-generated plan code (e.g. TXN-000001).",
        examples=["TXN-000001"],
    )
    status: str = Field(
        ...,
        title="Status",
        description="Current plan status.",
        examples=["draft"],
    )


class AppointmentSummary(BaseModel):
    """Minimal appointment data embedded in invoice responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Appointment ID",
        description="Unique appointment identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    appointment_number: str = Field(
        ...,
        title="Appointment Number",
        description="Auto-generated appointment number.",
        examples=["APT-000001"],
    )
    appointment_date: date = Field(
        ...,
        title="Appointment Date",
        description="Date of the appointment.",
        examples=["2026-07-23"],
    )


# ======================================================================
# Base schemas
# ======================================================================


class InvoiceBase(BillingBaseModel):
    """Shared invoice fields for create and update workflows.

    Does not include audit, numbering, or nested objects. Owned by
    request schemas so that response DTOs can be composed independently.
    """

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient (must exist and be active).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    treatment_plan_id: UUID | None = Field(
        default=None,
        title="Treatment Plan ID",
        description="Optional FK to the originating treatment plan.",
    )
    appointment_id: UUID | None = Field(
        default=None,
        title="Appointment ID",
        description="Optional FK to the linked appointment.",
    )
    doctor_id: UUID | None = Field(
        default=None,
        title="Doctor ID",
        description="Optional FK to the treating doctor.",
    )
    invoice_date: date = Field(
        ...,
        title="Invoice Date",
        description="Date the invoice is issued (defaults to today at app layer).",
        examples=["2026-07-23"],
    )
    due_date: date = Field(
        ...,
        title="Due Date",
        description="Payment due date (must be >= invoice_date).",
        examples=["2026-08-22"],
    )
    currency_code: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code. Single currency per invoice.",
        examples=["USD"],
    )
    notes: str | None = Field(
        default=None,
        max_length=2000,
        title="Notes",
        description="Free-text notes. Append-only after issuance.",
        examples=["Patient requested itemized breakdown."],
    )
    cancellation_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Cancellation Reason",
        description="Required when cancelling an invoice.",
        examples=["Patient requested cancellation before treatment."],
    )
    void_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Void Reason",
        description="Required when voiding an invoice.",
        examples=["Duplicate invoice issued."],
    )


# ======================================================================
# Request schemas
# ======================================================================


class InvoiceCreateRequest(BillingCreateSchema, InvoiceBase, BillingValidators):
    """Request body for ``POST /invoices``.

    Creates a new invoice in ``DRAFT`` status with the provided line
    items. The service layer assigns the sequential invoice number,
    sets defaults, and persists the aggregate.
    """

    items: list[InvoiceItemCreate] = Field(
        ...,
        min_length=1,
        title="Invoice Items",
        description="Line items to attach to the new invoice (at least one required).",
    )


class InvoiceDraftUpdateRequest(BillingUpdateSchema):
    """Request body for ``PATCH /billing/invoices/{id}``.

    Only supports updating ``notes`` and ``due_date`` on Draft invoices.
    All fields are optional — omitted fields are not modified.
    """

    notes: str | None = Field(
        default=None,
        max_length=2000,
        title="Notes",
        description="Updated free-text notes for the invoice.",
        examples=["Patient requested itemized breakdown."],
    )
    due_date: date | None = Field(
        default=None,
        title="Due Date",
        description="Updated payment due date. Must be >= invoice_date.",
        examples=["2026-09-22"],
    )


class InvoiceUpdateRequest(BillingUpdateSchema, BillingValidators):
    """Request body for ``PATCH /invoices/{id}``.

    All fields are optional. Only editable invoices (Draft) may be
    updated. Null values clear nullable fields.
    """

    patient_id: UUID | None = Field(
        default=None,
        title="Patient ID",
        description="Updated patient UUID.",
    )
    treatment_plan_id: UUID | None = Field(
        default=None,
        title="Treatment Plan ID",
        description="Updated treatment plan UUID.",
    )
    appointment_id: UUID | None = Field(
        default=None,
        title="Appointment ID",
        description="Updated appointment UUID.",
    )
    doctor_id: UUID | None = Field(
        default=None,
        title="Doctor ID",
        description="Updated doctor UUID.",
    )
    invoice_date: date | None = Field(
        default=None,
        title="Invoice Date",
        description="Updated invoice date.",
    )
    due_date: date | None = Field(
        default=None,
        title="Due Date",
        description="Updated due date.",
    )
    currency_code: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
    )
    notes: str | None = Field(
        default=None,
        max_length=2000,
        title="Notes",
        description="Updated free-text notes.",
    )
    cancellation_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Cancellation Reason",
        description="Updated cancellation reason.",
    )
    void_reason: str | None = Field(
        default=None,
        max_length=500,
        title="Void Reason",
        description="Updated void reason.",
    )


class InvoiceSearchRequest(BillingBaseModel):
    """Query parameters for invoice search endpoints.

    Mirrors query-string search + filter semantics while keeping the
    request payload free-forbid compliant.
    """

    query: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        title="Query",
        description="Free-text search across invoice number and patient name.",
        examples=["INV-00001"],
    )
    patient_id: UUID | None = Field(
        default=None,
        title="Patient ID",
        description="Filter by patient UUID.",
    )
    doctor_id: UUID | None = Field(
        default=None,
        title="Doctor ID",
        description="Filter by doctor UUID.",
    )
    status: str | None = Field(
        default=None,
        title="Status",
        description="Filter by invoice status (exact match).",
        examples=["draft"],
    )
    date_from: date | None = Field(
        default=None,
        title="Date From",
        description="Filter invoices with invoice_date on or after this date.",
    )
    date_to: date | None = Field(
        default=None,
        title="Date To",
        description="Filter invoices with invoice_date on or before this date.",
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


class InvoiceFilter(BillingBaseModel):
    """Structured filter payload for advanced invoice list endpoints.

    Supports multi-valued filters returned by the UI filter panel.
    """

    statuses: list[str] | None = Field(
        default=None,
        title="Statuses",
        description="Include invoices whose status is one of these values.",
        examples=[["draft", "issued"]],
    )
    currency_codes: list[str] | None = Field(
        default=None,
        title="Currency Codes",
        description="Filter to these ISO currency codes.",
        examples=[["USD"]],
    )
    doctor_ids: list[UUID] | None = Field(
        default=None,
        title="Doctor IDs",
        description="Filter to invoices for these doctors.",
    )
    patient_ids: list[UUID] | None = Field(
        default=None,
        title="Patient IDs",
        description="Filter to invoices for these patients.",
    )
    amount_min: PositiveDecimal | None = Field(
        default=None,
        title="Amount Min",
        description="Minimum grand_total.",
        examples=[Decimal("100.00")],
    )
    amount_max: PositiveDecimal | None = Field(
        default=None,
        title="Amount Max",
        description="Maximum grand_total.",
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

    @field_validator("currency_codes", mode="before")
    @classmethod
    def _normalize_currency_codes(cls, value: object) -> list[str] | None:
        if value is None:
            return value
        return [str(v).strip().upper() for v in value]


class InvoiceStatusTransitionRequest(BillingBaseModel):
    """Request body for invoice status transition endpoints.

    The service/validator layer enforces allowed transitions.
    """

    to_status: InvoiceStatus = Field(
        ...,
        title="To Status",
        description="Target invoice status.",
        examples=["issued"],
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reason",
        description="Free-text reason for the transition (required for terminal transitions).",
        examples=["Patient approved treatment plan."],
    )


# ======================================================================
# Response schemas
# ======================================================================


class InvoiceStatusTransitionResponse(BillingResponseSchema):
    """Confirms a successful status transition."""

    invoice_id: UUID = Field(
        ...,
        title="Invoice ID",
        description="Invoice that was transitioned.",
    )
    from_status: InvoiceStatus = Field(
        ...,
        title="From Status",
        description="Previous invoice status.",
        examples=["draft"],
    )
    to_status: InvoiceStatus = Field(
        ...,
        title="To Status",
        description="New invoice status.",
        examples=["issued"],
    )
    changed_at: datetime = Field(
        ...,
        title="Changed At",
        description="Timestamp when the transition was applied.",
    )
    changed_by: UUID = Field(
        ...,
        title="Changed By",
        description="User who performed the transition.",
    )


class InvoiceFinancialSummary(BaseModel):
    """Financial snapshot for an invoice.

    Immutable aggregate of monetary values. Used inside
    :class:`InvoiceRead` and as a standalone endpoint response.
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
    subtotal: Decimal = Field(
        ...,
        title="Subtotal",
        description="Sum of line net amounts before tax and adjustments.",
        examples=[Decimal("3000.00")],
    )
    discount_total: Decimal = Field(
        default=Decimal("0.00"),
        title="Discount Total",
        description="Total discount applied across all lines.",
    )
    tax_total: Decimal = Field(
        default=Decimal("0.00"),
        title="Tax Total",
        description="Total tax applied across all lines.",
    )
    grand_total: Decimal = Field(
        ...,
        title="Grand Total",
        description="Final monetary total after all adjustments and taxes.",
        examples=[Decimal("3100.00")],
    )
    paid_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Paid Amount",
        description="Cumulative payments applied (resolved at read time).",
    )
    outstanding_amount: Decimal = Field(
        default=Decimal("0.00"),
        title="Outstanding Amount",
        description="grand_total - paid_amount (resolved at read time).",
    )


class InvoiceSummary(BillingResponseSchema):
    """High-level invoice summary for dashboard and embed contexts."""

    id: UUID = Field(
        ...,
        title="Invoice ID",
        description="Unique identifier.",
    )
    invoice_number: str = Field(
        ...,
        title="Invoice Number",
        description="Formatted sequential invoice number.",
        examples=["INV-00001"],
    )
    status: InvoiceStatus = Field(
        ...,
        title="Status",
        description="Current invoice status.",
        examples=["draft"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    doctor: DoctorSummary | None = Field(
        default=None,
        title="Doctor",
        description="Linked doctor summary.",
    )
    invoice_date: date = Field(
        ...,
        title="Invoice Date",
        description="Date the invoice was created.",
    )
    due_date: date = Field(
        ...,
        title="Due Date",
        description="Payment due date.",
    )
    financials: InvoiceFinancialSummary = Field(
        ...,
        title="Financials",
        description="Invoice-level financial snapshot.",
    )
    item_count: int = Field(
        ...,
        ge=0,
        title="Item Count",
        description="Number of line items on this invoice.",
        examples=[3],
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the invoice was created.",
    )


class InvoiceListItem(BillingResponseSchema):
    """Lightweight invoice representation for paginated lists.

    Designed to keep transfer size low when returning many invoices.
    """

    id: UUID = Field(
        ...,
        title="Invoice ID",
        description="Unique identifier.",
    )
    invoice_number: str = Field(
        ...,
        title="Invoice Number",
        description="Formatted sequential invoice number.",
        examples=["INV-00001"],
    )
    status: InvoiceStatus = Field(
        ...,
        title="Status",
        description="Current invoice status.",
        examples=["draft"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    doctor: DoctorSummary | None = Field(
        default=None,
        title="Doctor",
        description="Linked doctor summary.",
    )
    invoice_date: date = Field(
        ...,
        title="Invoice Date",
        description="Date the invoice was created.",
    )
    due_date: date = Field(
        ...,
        title="Due Date",
        description="Payment due date.",
    )
    financials: InvoiceFinancialSummary = Field(
        ...,
        title="Financials",
        description="Invoice-level financial snapshot.",
    )
    item_count: int = Field(
        ...,
        ge=0,
        title="Item Count",
        description="Number of line items.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the invoice was created.",
    )


class InvoiceListResponse(BaseModel):
    """Paginated list of invoices for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    items: list[InvoiceListItem] = Field(
        ...,
        title="Items",
        description="Invoices on this page, ordered by sort criteria.",
    )
    total: int = Field(
        ...,
        ge=0,
        title="Total",
        description="Total matching invoices.",
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


class InvoiceRead(BillingResponseSchema, TimestampMixin, AuditMixin):
    """Full invoice aggregate returned by single-invoice GET endpoints.

    Composes nested patient, doctor, treatment plan, appointment, item,
    and financial summaries. The service layer and mapper are responsible
    for populating nested objects from ORM relationships.
    """

    id: UUID = Field(
        ...,
        title="Invoice ID",
        description="Unique identifier of the invoice.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    invoice_number: str = Field(
        ...,
        title="Invoice Number",
        description="Formatted sequential invoice number.",
        examples=["INV-00001"],
    )
    document_type: str = Field(
        default="invoice",
        title="Document Type",
        description="Billing document category.",
    )
    status: InvoiceStatus = Field(
        ...,
        title="Status",
        description="Current invoice lifecycle status.",
        examples=["draft"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    doctor: DoctorSummary | None = Field(
        default=None,
        title="Doctor",
        description="Linked treating doctor summary.",
    )
    treatment_plan: TreatmentPlanSummary | None = Field(
        default=None,
        title="Treatment Plan",
        description="Linked treatment plan summary.",
    )
    appointment: AppointmentSummary | None = Field(
        default=None,
        title="Appointment",
        description="Linked appointment summary.",
    )
    creator: CreatorSummary | None = Field(
        default=None,
        title="Creator",
        description="User who created the invoice.",
    )
    updater: CreatorSummary | None = Field(
        default=None,
        title="Updater",
        description="User who last modified the invoice.",
    )
    invoice_date: date = Field(
        ...,
        title="Invoice Date",
        description="Date the invoice was created.",
    )
    due_date: date = Field(
        ...,
        title="Due Date",
        description="Payment due date.",
    )
    currency_code: str = Field(
        ...,
        title="Currency Code",
        description="ISO 4217 currency code.",
    )
    notes: str | None = Field(
        default=None,
        title="Notes",
        description="Free-text notes (append-only after issuance).",
    )
    cancellation_reason: str | None = Field(
        default=None,
        title="Cancellation Reason",
        description="Reason for cancellation, if applicable.",
    )
    void_reason: str | None = Field(
        default=None,
        title="Void Reason",
        description="Reason for voiding, if applicable.",
    )
    items: list[InvoiceItemSummary] = Field(
        default_factory=list,
        title="Items",
        description="Ordered line items.",
    )
    financials: InvoiceFinancialSummary = Field(
        ...,
        title="Financials",
        description="Invoice-level financial snapshot.",
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


class InvoiceFinancialDetailResponse(BaseModel):
    """Deep financial breakdown for reporting and reconciliation."""

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    subtotal: Decimal = Field(
        ...,
        title="Subtotal",
        description="Sum of line net amounts before tax.",
    )
    discount_total: Decimal = Field(
        ...,
        title="Discount Total",
        description="Total discount applied across all lines.",
    )
    tax_total: Decimal = Field(
        ...,
        title="Tax Total",
        description="Total tax applied across all lines.",
    )
    grand_total: Decimal = Field(
        ...,
        title="Grand Total",
        description="Final monetary total.",
    )
    paid_amount: Decimal = Field(
        ...,
        title="Paid Amount",
        description="Cumulative payments applied.",
    )
    outstanding_amount: Decimal = Field(
        ...,
        title="Outstanding Amount",
        description="Amount still owed.",
    )
    currency_code: str = Field(
        ...,
        title="Currency Code",
        description="ISO 4217 currency code.",
    )


__all__ = [
    "AppointmentSummary",
    "CreatorSummary",
    "DoctorSummary",
    "InvoiceBase",
    "InvoiceCreateRequest",
    "InvoiceFilter",
    "InvoiceFinancialDetailResponse",
    "InvoiceFinancialSummary",
    "InvoiceListItem",
    "InvoiceListResponse",
    "InvoiceRead",
    "InvoiceSearchRequest",
    "InvoiceStatusTransitionRequest",
    "InvoiceStatusTransitionResponse",
    "InvoiceSummary",
    "InvoiceDraftUpdateRequest",
    "InvoiceUpdateRequest",
    "PatientSummary",
    "TreatmentPlanSummary",
]
