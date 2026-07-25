"""Billing Module — CreditNoteMapper.

Stateless ORM-to-DTO conversion for the Credit Note aggregate root.
Converts ``CreditNote`` ORM instances to their Pydantic response schemas.

All response DTOs are constructed explicitly — no ``model_validate()``
calls — because the DTOs contain many computed / composed fields that
do not exist as direct ORM attributes.

This mapper does NOT import InvoiceMapper, PaymentMapper, or RefundMapper
directly. Credit note responses embed lightweight summaries of related
entities via locally defined DTOs in the schemas package.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Sequence
from uuid import UUID

from app.modules.billing.constants import DEFAULT_CURRENCY
from app.modules.billing.enums import CreditNoteStatus
from app.modules.billing.models import CreditNote
from app.modules.billing.schemas.credit_note import (
    CreditNoteDocumentMetadata,
    CreditNoteFinancialSummary,
    CreditNoteInvoiceSummary,
    CreditNoteListItem,
    CreditNoteListResponse,
    CreditNoteRead,
    CreditNoteSummary,
)
from app.modules.billing.schemas.summaries import (
    CreatorSummary,
    PatientSummary,
)


class CreditNoteMapper:
    """Stateless converter between ``CreditNote`` ORM instances and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # ORM → Response DTOs
    # ==================================================================

    @staticmethod
    def to_read(credit_note: CreditNote) -> CreditNoteRead:
        """Convert a full ``CreditNote`` aggregate to a ``CreditNoteRead`` DTO.

        Composes nested patient, invoice, financial, document metadata,
        and audit summaries.

        Args:
            credit_note: A ``CreditNote`` ORM instance with its relationships
                loaded (invoice, patient, creator, updater).

        Returns:
            A ``CreditNoteRead`` with all nested DTOs populated.
        """
        # Resolve patient / invoice summaries
        invoice_summary = CreditNoteMapper._to_invoice_summary(credit_note)
        patient_summary = (
            CreditNoteMapper._to_patient_summary(credit_note.patient)
            if credit_note.patient is not None
            else None
        )

        return CreditNoteRead(
            id=credit_note.id,
            credit_note_number=credit_note.credit_note_number,
            document_type="credit_note",
            status=credit_note.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            invoice=invoice_summary,
            creator=CreditNoteMapper._to_creator_summary(credit_note.creator)
            if credit_note.creator is not None
            else None,
            updater=CreditNoteMapper._to_creator_summary(credit_note.updater)
            if credit_note.updater is not None
            else None,
            amount=credit_note.amount,
            remaining_balance=credit_note.remaining_balance,
            reason=credit_note.reason,
            issue_date=credit_note.issue_date,
            expiry_date=credit_note.expiry_date,
            void_reason=credit_note.void_reason,
            financials=CreditNoteMapper._compute_financial_summary(credit_note),
            document_metadata=CreditNoteDocumentMetadata(
                document_type="credit_note",
                sequence_number=None,
                version=credit_note.version,
                doc_version=credit_note.doc_version,
                issued_at=credit_note.created_at,
                generated_at=credit_note.created_at,
            ),
            audit_trail=[],
            version=credit_note.version,
            doc_version=credit_note.doc_version,
            created_at=credit_note.created_at,
            created_by=credit_note.created_by,
            updated_at=credit_note.updated_at,
            updated_by=credit_note.updated_by,
        )

    @staticmethod
    def to_summary(credit_note: CreditNote) -> CreditNoteSummary:
        """Convert a ``CreditNote`` ORM instance to a ``CreditNoteSummary`` DTO.

        Args:
            credit_note: A ``CreditNote`` ORM instance.

        Returns:
            A ``CreditNoteSummary``.
        """
        invoice_summary = CreditNoteMapper._to_invoice_summary(credit_note)
        patient_summary = (
            CreditNoteMapper._to_patient_summary(credit_note.patient)
            if credit_note.patient is not None
            else None
        )

        return CreditNoteSummary(
            id=credit_note.id,
            credit_note_number=credit_note.credit_note_number,
            status=credit_note.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            invoice=invoice_summary,
            amount=credit_note.amount,
            remaining_balance=credit_note.remaining_balance,
            reason=credit_note.reason,
            financials=CreditNoteMapper._compute_financial_summary(credit_note),
            created_at=credit_note.created_at,
        )

    @staticmethod
    def to_list_item(credit_note: CreditNote) -> CreditNoteListItem:
        """Convert a ``CreditNote`` ORM instance to a ``CreditNoteListItem`` DTO.

        Args:
            credit_note: A ``CreditNote`` ORM instance.

        Returns:
            A ``CreditNoteListItem``.
        """
        invoice_summary = CreditNoteMapper._to_invoice_summary(credit_note)
        patient_summary = (
            CreditNoteMapper._to_patient_summary(credit_note.patient)
            if credit_note.patient is not None
            else None
        )

        return CreditNoteListItem(
            id=credit_note.id,
            credit_note_number=credit_note.credit_note_number,
            status=credit_note.status,
            patient=patient_summary
            or PatientSummary(
                id=UUID("00000000-0000-0000-0000-000000000000"),
                patient_code="",
                full_name="",
                is_active=False,
            ),
            invoice=invoice_summary,
            amount=credit_note.amount,
            remaining_balance=credit_note.remaining_balance,
            reason=credit_note.reason,
            financials=CreditNoteMapper._compute_financial_summary(credit_note),
            created_at=credit_note.created_at,
        )

    @staticmethod
    def to_list_response(
        credit_notes: Sequence[CreditNote],
        total: int,
        page: int,
        page_size: int,
    ) -> CreditNoteListResponse:
        """Convert a sequence of credit notes to a paginated list response.

        Args:
            credit_notes: Items for the current page.
            total: Total matching items across all pages.
            page: Current 1-based page number.
            page_size: Items per page.

        Returns:
            A ``CreditNoteListResponse``.
        """
        return CreditNoteListResponse(
            items=[CreditNoteMapper.to_list_item(cn) for cn in credit_notes],
            total=total,
            page=page,
            page_size=page_size,
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
    def _to_invoice_summary(
        credit_note: CreditNote,
    ) -> CreditNoteInvoiceSummary:
        """Build a ``CreditNoteInvoiceSummary`` from a linked Invoice.

        ``grand_total`` is derived from the invoice's line items.
        """
        invoice = credit_note.invoice

        # Compute grand_total from items if available
        grand_total = Decimal("0.00")
        if invoice is not None and hasattr(invoice, "items") and invoice.items:
            items = invoice.items
            subtotal = sum(
                (item.unit_price or Decimal("0.00")) * (item.quantity or 0)
                for item in items
            )
            discount_total = sum(
                (item.discount_value or Decimal("0.00")) for item in items
            )
            grand_total = subtotal - discount_total
        elif invoice is not None:
            grand_total = Decimal("0.00")

        return CreditNoteInvoiceSummary(
            id=invoice.id if invoice else UUID(int=0),
            invoice_number=invoice.invoice_number if invoice else "",
            invoice_date=invoice.invoice_date if invoice else date.today(),
            currency_code=invoice.currency_code if invoice else DEFAULT_CURRENCY.value,
            grand_total=grand_total,
        )

    @staticmethod
    def _compute_financial_summary(
        credit_note: CreditNote,
    ) -> CreditNoteFinancialSummary:
        """Derive the financial summary from a credit note.

        Pure computation — no business rules, no database access.
        """
        currency_code = DEFAULT_CURRENCY.value
        if credit_note.invoice is not None:
            currency_code = credit_note.invoice.currency_code or DEFAULT_CURRENCY.value

        return CreditNoteFinancialSummary(
            currency_code=currency_code,
            amount=credit_note.amount or Decimal("0.00"),
            remaining_balance=credit_note.remaining_balance or Decimal("0.00"),
        )


__all__ = ["CreditNoteMapper"]
