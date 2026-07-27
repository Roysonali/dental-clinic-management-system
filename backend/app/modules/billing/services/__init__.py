"""Billing module — service package.

The service layer owns:

- **Transaction boundaries** (commit / rollback).
- **Orchestration** (coordinating repositories, validators, and the state machine).
- **Logging** (infrastructure-level; business events are logged here).
- **Repository coordination** (multiple repositories for a single operation).
- **Validator coordination** (invoking validators in the correct order).

The service layer does NOT own:

- Business validation (validators).
- Transition rules (state machine).
- SQL (repositories).
- HTTP concerns (routers).
- Serialization / deserialization (mappers / schemas).

The ``FinancialCalculationService`` is a special case: it is a **domain
calculation service** that is completely read-only. It never commits, never
rolls back, never mutates data, and never creates audit logs. It is the single
source of truth for every financial calculation in the Billing module.

``BillingOrchestrationService`` is an **application service** that coordinates
existing domain services into complete business workflows. It never introduces
new domain rules, validations, calculations, or persistence logic.
"""

from __future__ import annotations

from app.modules.billing.services.base import BaseService
from app.modules.billing.services.billing_orchestration_service import (
    BillingDashboardResult,
    BillingOrchestrationService,
    CreditNoteWorkflowResult,
    InvoiceWorkflowResult,
    PaymentWorkflowResult,
    RefundWorkflowResult,
)
from app.modules.billing.services.credit_note_service import (
    CreditNoteService,
)
from app.modules.billing.services.document_sequence_service import (
    DocumentSequenceService,
)
from app.modules.billing.services.financial_calculation_service import (
    BillingTotals,
    FinancialCalculationService,
    InvoiceFinancialSummary,
    PatientFinancialSummary,
    PaymentFinancialSummary,
)
from app.modules.billing.services.invoice_service import InvoiceService
from app.modules.billing.services.payment_service import PaymentService
from app.modules.billing.services.receipt_service import (
    PrintableReceipt,
    ReceiptService,
)
from app.modules.billing.services.refund_service import RefundService

__all__ = [
    "BaseService",
    "BillingDashboardResult",
    "BillingOrchestrationService",
    "BillingTotals",
    "CreditNoteService",
    "CreditNoteWorkflowResult",
    "DocumentSequenceService",
    "FinancialCalculationService",
    "InvoiceFinancialSummary",
    "InvoiceService",
    "InvoiceWorkflowResult",
    "PatientFinancialSummary",
    "PaymentFinancialSummary",
    "PaymentService",
    "PaymentWorkflowResult",
    "PrintableReceipt",
    "ReceiptService",
    "RefundService",
    "RefundWorkflowResult",
]
