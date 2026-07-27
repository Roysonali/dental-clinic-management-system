"""Billing Module — Metadata DTOs.

Value objects and metadata envelopes that are embedded inside response DTOs.
These are immutable (``frozen=True``) so they can be safely shared and cached.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BillingMetadata(BaseModel):
    """Top-level metadata for billing API responses."""

    model_config = ConfigDict(frozen=True)

    request_id: str | None = Field(
        default=None,
        title="Request ID",
        description="Unique request identifier for tracing and support.",
    )
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        title="Generated At",
        description="Timezone-aware UTC timestamp when the response payload was generated.",
    )
    environment: str | None = Field(
        default=None,
        title="Environment",
        description="Deployment environment label (e.g. ``prod``, ``staging``).",
    )


class AuditMetadata(BaseModel):
    """Audit metadata attached to financial record responses."""

    model_config = ConfigDict(frozen=True)

    action: str = Field(
        ...,
        title="Action",
        description="Audit action verb (e.g. ``created``, ``status_changed``).",
        examples=["created"],
    )
    changed_by: int = Field(
        ...,
        title="Changed By",
        description="User ID who performed the action (auth.users.id).",
        examples=[1],
    )
    occurred_at: datetime = Field(
        ...,
        title="Occurred At",
        description="When the action occurred (UTC).",
    )
    reason: str | None = Field(
        default=None,
        title="Reason",
        description="Optional free-text reason for the change.",
    )


class DocumentMetadata(BaseModel):
    """Document-level metadata for issued billing documents."""

    model_config = ConfigDict(frozen=True)

    document_number: str = Field(
        ...,
        title="Document Number",
        description="Formatted document number (e.g. ``INV-00001``).",
    )
    document_type: str = Field(
        ...,
        title="Document Type",
        description="Billing document category (invoice, receipt, ...).",
    )
    issued_at: datetime | None = Field(
        default=None,
        title="Issued At",
        description="When the document was issued (UTC).",
    )


class FinancialMetadata(BaseModel):
    """Financial summary metadata for invoices and receipts."""

    model_config = ConfigDict(frozen=True)

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
        description="Sum of net amounts before discounts and tax.",
        examples=[Decimal("1000.00")],
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
        description="Final monetary total after all applicable adjustments and taxes.",
    )


__all__ = [
    "AuditMetadata",
    "BillingMetadata",
    "DocumentMetadata",
    "FinancialMetadata",
]
