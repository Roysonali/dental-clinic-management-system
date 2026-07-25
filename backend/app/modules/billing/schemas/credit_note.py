"""Billing Module — Credit Note schemas.

Provides a complete set of dedicated Pydantic v2 DTOs for the Credit Note
aggregate root: create, read, summary, list, status-transition,
financial-summary, document-metadata, and related representations.

A credit note corrects an issued invoice without modifying the original
document (FI-CN-003). Credit notes follow a lifecycle:
DRAFT → ISSUED → APPLIED, or DRAFT → ISSUED → VOID.

Designed to support future scenarios: partial application, expiry,
multi-currency, and patient wallet.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.billing.enums import (
    CreditNoteStatus,
    DocumentType,
)
from app.modules.billing.schemas.base import (
    BillingBaseModel,
    BillingCreateSchema,
    BillingResponseSchema,
)
from app.modules.billing.schemas.validators import BillingValidators
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


# ======================================================================
# Embedded lightweight summaries
# ======================================================================


class CreditNoteInvoiceSummary(BaseModel):
    """Minimal invoice data embedded in credit note responses."""

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


# ======================================================================
# Base schemas
# ======================================================================


class CreditNoteBase(BillingBaseModel):
    """Shared credit note fields for create workflows.

    Does not include audit, numbering, or nested objects. Owned by request
    schemas so that response DTOs can be composed independently.
    """

    amount: PositiveDecimal = Field(
        ...,
        title="Amount",
        description="Credit note amount (must be positive and <= invoice grand total).",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        title="Reason",
        description="Reason for issuing the credit note.",
        examples=["Service charge adjustment."],
    )
    currency_code: str = Field(
        default="USD",
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 currency code.",
        examples=["USD"],
    )
    expiry_date: date | None = Field(
        default=None,
        title="Expiry Date",
        description="Optional expiry date for the credit note validity period.",
        examples=["2026-12-31"],
    )


# ======================================================================
# Request schemas
# ======================================================================


class CreditNoteCreateRequest(BillingBaseModel):
    """Request body for ``POST /credit-notes``.

    Exposes ONLY the fields consumed by ``CreditNoteService.create_credit_note()``.
    The service assigns the sequential credit note number, validates business
    rules, and persists the aggregate.
    """

    invoice_id: UUID = Field(
        ...,
        title="Invoice ID",
        description="UUID of the invoice being credited.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient the credit note belongs to.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    amount: PositiveDecimal = Field(
        ...,
        title="Amount",
        description="Credit note amount (must be positive and <= invoice grand total).",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        title="Reason",
        description="Reason for issuing the credit note.",
        examples=["Service charge adjustment."],
    )
    expiry_date: date | None = Field(
        default=None,
        title="Expiry Date",
        description="Optional expiry date for the credit note validity period.",
        examples=["2026-12-31"],
    )


class CreditNoteVoidRequest(BillingBaseModel):
    """Request body for ``POST /credit-notes/{id}/void``."""

    void_reason: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        title="Void Reason",
        description="Required reason for voiding the credit note.",
        examples=["Issued in error."],
    )


# ======================================================================
# Response schemas
# ======================================================================


class CreditNoteAuditSummary(BaseModel):
    """Lightweight audit snapshot for a credit note transition."""

    model_config = ConfigDict(frozen=True)

    action: str = Field(
        ...,
        title="Action",
        description="Audit action verb.",
        examples=["credit_applied"],
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


class CreditNoteFinancialSummary(BaseModel):
    """Financial snapshot for a credit note.

    Immutable aggregate of monetary values.
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
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Credit note amount.",
        examples=[Decimal("500.00")],
    )
    remaining_balance: Decimal = Field(
        ...,
        title="Remaining Balance",
        description="Unapplied balance (decreases as applied to invoices).",
        examples=[Decimal("500.00")],
    )


class CreditNoteDocumentMetadata(BaseModel):
    """Document metadata for a credit note."""

    model_config = ConfigDict(frozen=True)

    document_type: DocumentType = Field(
        default=DocumentType.CREDIT_NOTE,
        title="Document Type",
        description="Billing document category.",
    )
    sequence_number: int | None = Field(
        default=None,
        ge=1,
        title="Sequence Number",
        description="Sequential number within the credit note series.",
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
        description="Timestamp when the credit note was issued (UTC).",
    )
    generated_at: datetime = Field(
        ...,
        title="Generated At",
        description="Timestamp when the credit note was generated (UTC).",
    )


class CreditNoteSummary(BillingResponseSchema):
    """High-level credit note summary for dashboard and embed contexts."""

    id: UUID = Field(
        ...,
        title="Credit Note ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    credit_note_number: str = Field(
        ...,
        title="Credit Note Number",
        description="Formatted sequential credit note number.",
        examples=["CN-00001"],
    )
    status: CreditNoteStatus = Field(
        ...,
        title="Status",
        description="Current credit note lifecycle status.",
        examples=["draft"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    invoice: CreditNoteInvoiceSummary = Field(
        ...,
        title="Invoice",
        description="Linked invoice summary.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total credit note amount.",
        examples=[Decimal("500.00")],
    )
    remaining_balance: Decimal = Field(
        ...,
        title="Remaining Balance",
        description="Unapplied balance.",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        title="Reason",
        description="Reason for the credit note.",
        examples=["Service charge adjustment."],
    )
    financials: CreditNoteFinancialSummary = Field(
        ...,
        title="Financials",
        description="Credit note financial snapshot.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the credit note was created.",
    )


class CreditNoteListItem(BillingResponseSchema):
    """Lightweight credit note representation for paginated lists."""

    id: UUID = Field(
        ...,
        title="Credit Note ID",
        description="Unique identifier.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    credit_note_number: str = Field(
        ...,
        title="Credit Note Number",
        description="Formatted sequential credit note number.",
        examples=["CN-00001"],
    )
    status: CreditNoteStatus = Field(
        ...,
        title="Status",
        description="Current credit note lifecycle status.",
        examples=["draft"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    invoice: CreditNoteInvoiceSummary = Field(
        ...,
        title="Invoice",
        description="Linked invoice summary.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total credit note amount.",
        examples=[Decimal("500.00")],
    )
    remaining_balance: Decimal = Field(
        ...,
        title="Remaining Balance",
        description="Unapplied balance.",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        title="Reason",
        description="Reason for the credit note.",
        examples=["Service charge adjustment."],
    )
    financials: CreditNoteFinancialSummary = Field(
        ...,
        title="Financials",
        description="Credit note financial snapshot.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the credit note was created.",
    )


class CreditNoteListResponse(BaseModel):
    """Paginated list of credit notes for list endpoints."""

    model_config = ConfigDict(from_attributes=True)

    items: list[CreditNoteListItem] = Field(
        ...,
        title="Items",
        description="Credit notes on this page, ordered by sort criteria.",
    )
    total: int = Field(
        ...,
        ge=0,
        title="Total",
        description="Total matching credit notes.",
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


class CreditNoteRead(BillingResponseSchema, TimestampMixin, AuditMixin):
    """Full credit note aggregate returned by single credit note GET endpoints.

    Composes nested patient, invoice, financial, document, and audit summaries.
    """

    id: UUID = Field(
        ...,
        title="Credit Note ID",
        description="Unique identifier of the credit note.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    credit_note_number: str = Field(
        ...,
        title="Credit Note Number",
        description="Formatted sequential credit note number.",
        examples=["CN-00001"],
    )
    document_type: str = Field(
        default="credit_note",
        title="Document Type",
        description="Billing document category.",
    )
    status: CreditNoteStatus = Field(
        ...,
        title="Status",
        description="Current credit note lifecycle status.",
        examples=["draft"],
    )
    patient: PatientSummary = Field(
        ...,
        title="Patient",
        description="Linked patient summary.",
    )
    invoice: CreditNoteInvoiceSummary = Field(
        ...,
        title="Invoice",
        description="Linked invoice summary.",
    )
    creator: CreatorSummary | None = Field(
        default=None,
        title="Creator",
        description="User who created the credit note.",
    )
    updater: CreatorSummary | None = Field(
        default=None,
        title="Updater",
        description="User who last modified the credit note.",
    )
    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Total credit note amount.",
        examples=[Decimal("500.00")],
    )
    remaining_balance: Decimal = Field(
        ...,
        title="Remaining Balance",
        description="Unapplied balance (decreases as applied to invoices).",
        examples=[Decimal("500.00")],
    )
    reason: str = Field(
        ...,
        title="Reason",
        description="Reason for the credit note.",
        examples=["Service charge adjustment."],
    )
    issue_date: date | None = Field(
        default=None,
        title="Issue Date",
        description="Date the credit note was issued.",
        examples=["2026-07-23"],
    )
    expiry_date: date | None = Field(
        default=None,
        title="Expiry Date",
        description="Optional expiry date for the credit note validity period.",
    )
    void_reason: str | None = Field(
        default=None,
        title="Void Reason",
        description="Reason for voiding, if applicable.",
    )
    financials: CreditNoteFinancialSummary = Field(
        ...,
        title="Financials",
        description="Credit note financial snapshot.",
    )
    document_metadata: CreditNoteDocumentMetadata = Field(
        ...,
        title="Document Metadata",
        description="Document numbering and versioning metadata.",
    )
    audit_trail: list[CreditNoteAuditSummary] = Field(
        default_factory=list,
        title="Audit Trail",
        description="Ordered audit events for this credit note.",
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
    "CreditNoteAuditSummary",
    "CreditNoteBase",
    "CreditNoteCreateRequest",
    "CreditNoteDocumentMetadata",
    "CreditNoteFinancialSummary",
    "CreditNoteInvoiceSummary",
    "CreditNoteListItem",
    "CreditNoteListResponse",
    "CreditNoteRead",
    "CreditNoteSummary",
    "CreditNoteVoidRequest",
]
