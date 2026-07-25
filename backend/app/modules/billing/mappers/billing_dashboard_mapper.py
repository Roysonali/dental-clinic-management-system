"""Billing Module — BillingDashboardMapper.

Stateless mapper that converts ``BillingDashboardResult``, ``BillingTotals``,
and ``PatientFinancialSummary`` dataclass instances (from the service layer)
into their corresponding Pydantic response DTOs.

All response DTOs are constructed explicitly — no ``model_validate()`` calls.
The mapper delegates ORM → DTO conversion of recent invoices and payments
to ``InvoiceMapper`` and ``PaymentMapper`` respectively.

No business logic, no calculations, no aggregation — pure stateless mapping only.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.modules.billing.mappers.invoice_mapper import InvoiceMapper
from app.modules.billing.mappers.payment_mapper import PaymentMapper
from app.modules.billing.schemas.dashboard import (
    BillingDashboardResponse,
    BillingTotalsResponse,
    PatientFinancialSummaryResponse,
)
from app.modules.billing.services.financial_calculation_service import (
    BillingTotals,
    PatientFinancialSummary,
)
from app.modules.billing.services.billing_orchestration_service import (
    BillingDashboardResult,
)


class BillingDashboardMapper:
    """Stateless converter between service-layer dataclasses and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Public mapping methods
    # ==================================================================

    @staticmethod
    def to_dashboard_response(
        result: BillingDashboardResult,
    ) -> BillingDashboardResponse:
        """Convert a ``BillingDashboardResult`` to a ``BillingDashboardResponse`` DTO.

        Args:
            result: The aggregated dashboard result from the orchestration service.

        Returns:
            A fully populated ``BillingDashboardResponse`` with totals,
            recent items as DTOs, and optional patient summary.
        """
        # Build patient summary if present
        patient_summary: PatientFinancialSummaryResponse | None = None
        if result.patient_summary is not None:
            patient_summary = BillingDashboardMapper.to_patient_summary(
                result.patient_summary
            )

        # Map recent ORM entities via existing mappers
        recent_invoices = [
            InvoiceMapper.to_list_item(inv) for inv in result.recent_invoices
        ]
        recent_payments = [
            PaymentMapper.to_list_item(pmt) for pmt in result.recent_payments
        ]

        return BillingDashboardResponse(
            totals=BillingDashboardMapper.to_totals_response(result.totals),
            recent_invoices=recent_invoices,
            recent_payments=recent_payments,
            patient_summary=patient_summary,
            generated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def to_totals_response(
        totals: BillingTotals,
    ) -> BillingTotalsResponse:
        """Convert a ``BillingTotals`` dataclass to a ``BillingTotalsResponse`` DTO.

        Args:
            totals: System-wide billing totals from the service layer.

        Returns:
            A ``BillingTotalsResponse`` with all 10 financial and count fields.
        """
        return BillingTotalsResponse(
            total_invoiced=totals.total_invoiced,
            total_collected=totals.total_collected,
            total_refunded=totals.total_refunded,
            total_outstanding=totals.total_outstanding,
            total_credited=totals.total_credited,
            invoice_count=totals.invoice_count,
            paid_invoice_count=totals.paid_invoice_count,
            outstanding_invoice_count=totals.outstanding_invoice_count,
            payment_count=totals.payment_count,
            credit_note_count=totals.credit_note_count,
        )

    @staticmethod
    def to_patient_summary(
        summary: PatientFinancialSummary,
    ) -> PatientFinancialSummaryResponse:
        """Convert a ``PatientFinancialSummary`` dataclass to a response DTO.

        Args:
            summary: Patient-level financial summary from the service layer.

        Returns:
            A ``PatientFinancialSummaryResponse`` with all 12 fields.
        """
        return PatientFinancialSummaryResponse(
            patient_id=summary.patient_id,
            total_invoiced=summary.total_invoiced,
            total_paid=summary.total_paid,
            total_refunded=summary.total_refunded,
            total_outstanding=summary.total_outstanding,
            total_credited=summary.total_credited,
            total_credit_remaining=summary.total_credit_remaining,
            invoice_count=summary.invoice_count,
            paid_invoice_count=summary.paid_invoice_count,
            outstanding_invoice_count=summary.outstanding_invoice_count,
            payment_count=summary.payment_count,
            credit_note_count=summary.credit_note_count,
        )


__all__ = ["BillingDashboardMapper"]
