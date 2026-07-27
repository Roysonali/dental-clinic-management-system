"""Billing Module — Dashboard and Summary response schemas.

Provides Pydantic v2 DTOs for the billing reporting endpoints covering
system-wide totals, patient-specific summaries, and the full dashboard
with recent activity.

These schemas mirror the dataclasses in ``FinancialCalculationService``
(BillingTotals, PatientFinancialSummary) so the router layers remain
independent of Python dataclass internals.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.billing.schemas.base import BillingResponseSchema
from app.modules.billing.schemas.invoice import InvoiceListItem
from app.modules.billing.schemas.payment import PaymentListItem


# ======================================================================
# Totals — system-wide or patient-level
# ======================================================================


class BillingTotalsResponse(BillingResponseSchema):
    """Aggregate billing-wide financial totals.

    Mirrors the ``BillingTotals`` dataclass from
    ``FinancialCalculationService``. All monetary values are quantized
    :class:`Decimal` strings.
    """

    model_config = ConfigDict(from_attributes=True)

    total_invoiced: Decimal = Field(
        ...,
        title="Total Invoiced",
        description="Sum of all invoice grand totals.",
        examples=[Decimal("15000.00")],
    )
    total_collected: Decimal = Field(
        ...,
        title="Total Collected",
        description="Sum of all non-refund payment allocations.",
        examples=[Decimal("12000.00")],
    )
    total_refunded: Decimal = Field(
        ...,
        title="Total Refunded",
        description="Sum of all refund payment allocations.",
        examples=[Decimal("500.00")],
    )
    total_outstanding: Decimal = Field(
        ...,
        title="Total Outstanding",
        description="Remaining balance (invoiced - collected + refunded, floored at 0).",
        examples=[Decimal("3500.00")],
    )
    total_credited: Decimal = Field(
        ...,
        title="Total Credited",
        description="Sum of all credit note amounts.",
        examples=[Decimal("200.00")],
    )
    invoice_count: int = Field(
        ...,
        ge=0,
        title="Invoice Count",
        description="Total number of invoices (paid + outstanding).",
        examples=[42],
    )
    paid_invoice_count: int = Field(
        ...,
        ge=0,
        title="Paid Invoice Count",
        description="Number of invoices with zero outstanding balance.",
        examples=[30],
    )
    outstanding_invoice_count: int = Field(
        ...,
        ge=0,
        title="Outstanding Invoice Count",
        description="Number of invoices with a positive outstanding balance.",
        examples=[12],
    )
    payment_count: int = Field(
        ...,
        ge=0,
        title="Payment Count",
        description="Total number of payments recorded.",
        examples=[35],
    )
    credit_note_count: int = Field(
        ...,
        ge=0,
        title="Credit Note Count",
        description="Total number of credit notes.",
        examples=[5],
    )


class PatientFinancialSummaryResponse(BillingResponseSchema):
    """Aggregate financial position for a single patient.

    Mirrors the ``PatientFinancialSummary`` dataclass from
    ``FinancialCalculationService``.
    """

    model_config = ConfigDict(from_attributes=True)

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    total_invoiced: Decimal = Field(
        ...,
        title="Total Invoiced",
        description="Sum of all invoice grand totals for this patient.",
        examples=[Decimal("5000.00")],
    )
    total_paid: Decimal = Field(
        ...,
        title="Total Paid",
        description="Sum of all non-refund payment allocations for this patient.",
        examples=[Decimal("4000.00")],
    )
    total_refunded: Decimal = Field(
        ...,
        title="Total Refunded",
        description="Sum of all refund allocations for this patient.",
        examples=[Decimal("200.00")],
    )
    total_outstanding: Decimal = Field(
        ...,
        title="Total Outstanding",
        description="Remaining balance for this patient.",
        examples=[Decimal("1200.00")],
    )
    total_credited: Decimal = Field(
        ...,
        title="Total Credited",
        description="Sum of all credit note amounts for this patient.",
        examples=[Decimal("100.00")],
    )
    total_credit_remaining: Decimal = Field(
        ...,
        title="Total Credit Remaining",
        description="Unapplied credit note balance for this patient.",
        examples=[Decimal("50.00")],
    )
    invoice_count: int = Field(
        ...,
        ge=0,
        title="Invoice Count",
        description="Total invoices for this patient.",
        examples=[10],
    )
    paid_invoice_count: int = Field(
        ...,
        ge=0,
        title="Paid Invoice Count",
        description="Invoices with zero outstanding balance.",
        examples=[7],
    )
    outstanding_invoice_count: int = Field(
        ...,
        ge=0,
        title="Outstanding Invoice Count",
        description="Invoices with positive outstanding balance.",
        examples=[3],
    )
    payment_count: int = Field(
        ...,
        ge=0,
        title="Payment Count",
        description="Total payments recorded for this patient.",
        examples=[8],
    )
    credit_note_count: int = Field(
        ...,
        ge=0,
        title="Credit Note Count",
        description="Total credit notes for this patient.",
        examples=[2],
    )


# ======================================================================
# Dashboard response
# ======================================================================


class BillingDashboardResponse(BillingResponseSchema):
    """Full billing dashboard with aggregated totals and recent activity.

    Combines billing-wide financial totals, recent invoices, recent
    payments, and an optional patient-level financial summary.
    """

    model_config = ConfigDict(from_attributes=True)

    totals: BillingTotalsResponse = Field(
        ...,
        title="Totals",
        description="System-wide billing financial totals.",
    )
    recent_invoices: list[InvoiceListItem] = Field(
        default_factory=list,
        title="Recent Invoices",
        description="Most recently created invoices (up to 5).",
    )
    recent_payments: list[PaymentListItem] = Field(
        default_factory=list,
        title="Recent Payments",
        description="Most recently created payments (up to 5).",
    )
    patient_summary: PatientFinancialSummaryResponse | None = Field(
        default=None,
        title="Patient Summary",
        description=(
            "Patient-level financial summary when a patient_id filter "
            "is applied. Null for system-wide dashboard."
        ),
    )
    generated_at: datetime = Field(
        ...,
        title="Generated At",
        description="Timestamp when the dashboard snapshot was generated.",
    )


__all__ = [
    "BillingDashboardResponse",
    "BillingTotalsResponse",
    "PatientFinancialSummaryResponse",
]
