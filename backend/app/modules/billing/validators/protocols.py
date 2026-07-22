"""Billing module — repository protocols for validators.

Protocols expose only the methods required by validators, keeping the
validator layer decoupled from full repository implementations.
"""

from __future__ import annotations

from uuid import UUID

from app.modules.billing.models import (
    CreditNote,
    DocumentSequence,
    Invoice,
    PatientCredit,
    Payment,
    Receipt,
)


class InvoiceRepositoryProtocol:
    """Minimal invoice repository interface for validators."""

    def get_by_id(self, invoice_id: UUID) -> Invoice | None:
        raise NotImplementedError

    def get_by_invoice_number(self, invoice_number: str) -> Invoice | None:
        raise NotImplementedError

    def exists(self, invoice_id: UUID) -> bool:
        raise NotImplementedError

    def exists_by_invoice_number(self, invoice_number: str) -> bool:
        raise NotImplementedError

    def get_with_items(self, invoice_id: UUID) -> Invoice | None:
        raise NotImplementedError

    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = 20,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Invoice], int]:
        raise NotImplementedError


class PaymentRepositoryProtocol:
    """Minimal payment repository interface for validators."""

    def get_by_id(self, payment_id: UUID) -> Payment | None:
        raise NotImplementedError

    def get_by_payment_number(self, payment_number: str) -> Payment | None:
        raise NotImplementedError

    def exists(self, payment_id: UUID) -> bool:
        raise NotImplementedError

    def exists_by_payment_number(self, payment_number: str) -> bool:
        raise NotImplementedError

    def get_with_allocations(self, payment_id: UUID) -> Payment | None:
        raise NotImplementedError


class ReceiptRepositoryProtocol:
    """Minimal receipt repository interface for validators."""

    def get_by_id(self, receipt_id: UUID) -> Receipt | None:
        raise NotImplementedError

    def get_by_receipt_number(self, receipt_number: str) -> Receipt | None:
        raise NotImplementedError

    def exists(self, receipt_id: UUID) -> bool:
        raise NotImplementedError

    def exists_by_receipt_number(self, receipt_number: str) -> bool:
        raise NotImplementedError

    def find_by_payment(self, payment_id: UUID) -> Receipt | None:
        raise NotImplementedError


class CreditNoteRepositoryProtocol:
    """Minimal credit note repository interface for validators."""

    def get_by_id(self, credit_note_id: UUID) -> CreditNote | None:
        raise NotImplementedError

    def get_by_credit_note_number(
        self, credit_note_number: str
    ) -> CreditNote | None:
        raise NotImplementedError

    def exists(self, credit_note_id: UUID) -> bool:
        raise NotImplementedError

    def exists_by_credit_note_number(self, credit_note_number: str) -> bool:
        raise NotImplementedError

    def find_by_invoice(
        self,
        invoice_id: UUID,
        page: int = 1,
        page_size: int = 20,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[CreditNote], int]:
        raise NotImplementedError

    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = 20,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[CreditNote], int]:
        raise NotImplementedError


class PatientCreditRepositoryProtocol:
    """Minimal patient credit repository interface for validators."""

    def get_by_id(self, patient_credit_id: UUID) -> PatientCredit | None:
        raise NotImplementedError

    def exists(self, patient_credit_id: UUID) -> bool:
        raise NotImplementedError

    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = 20,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[PatientCredit], int]:
        raise NotImplementedError

    def find_by_patient_and_source(
        self,
        patient_id: UUID,
        source_allocation_id: UUID | None = None,
        source_credit_note_id: UUID | None = None,
    ) -> PatientCredit | None:
        raise NotImplementedError


class RefundRepositoryProtocol:
    """Minimal refund repository interface for validators."""

    def get_by_id(self, refund_id: UUID) -> Refund | None:
        raise NotImplementedError

    def get_by_refund_number(self, refund_number: str) -> Refund | None:
        raise NotImplementedError

    def exists(self, refund_id: UUID) -> bool:
        raise NotImplementedError

    def exists_by_refund_number(self, refund_number: str) -> bool:
        raise NotImplementedError


class DocumentSequenceRepositoryProtocol:
    """Minimal document sequence repository interface for validators."""

    def get_by_document_type(self, document_type: str) -> DocumentSequence | None:
        raise NotImplementedError

    def exists(self, document_type: str) -> bool:
        raise NotImplementedError

    def get_for_update(self, document_type: str) -> DocumentSequence | None:
        raise NotImplementedError

    def increment(self, document_type: str) -> DocumentSequence | None:
        raise NotImplementedError
