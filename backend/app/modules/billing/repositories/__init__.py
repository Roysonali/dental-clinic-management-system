"""Billing module — repository package.

Exposes the aggregate-boundary repositories for the Billing module.

Per the architecture decision, only aggregate repositories are exposed:
``InvoiceRepository``, ``PaymentRepository``, ``ReceiptRepository``,
``CreditNoteRepository``, ``PatientCreditRepository``,
``DocumentSequenceRepository``, and ``AuditRepository``. Child entities
do not get their own repositories.
"""

from app.modules.billing.repositories.audit_repository import AuditRepository
from app.modules.billing.repositories.credit_note_repository import (
    CreditNoteRepository,
)
from app.modules.billing.repositories.document_sequence_repository import (
    DocumentSequenceRepository,
)
from app.modules.billing.repositories.invoice_repository import InvoiceRepository
from app.modules.billing.repositories.patient_credit_repository import (
    PatientCreditRepository,
)
from app.modules.billing.repositories.payment_repository import PaymentRepository
from app.modules.billing.repositories.receipt_repository import ReceiptRepository

__all__ = [
    "AuditRepository",
    "CreditNoteRepository",
    "DocumentSequenceRepository",
    "InvoiceRepository",
    "PatientCreditRepository",
    "PaymentRepository",
    "ReceiptRepository",
]
