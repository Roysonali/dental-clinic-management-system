"""Billing Module.

Structured dental clinic billing: invoice-centric aggregate, line items,
payments, receipts, credit notes, and financial reporting.

This package contains the full billing module implementation including:
domain enums, constants, exceptions, dependency providers, SQLAlchemy models,
repositories, money/numbering/validation utilities, shared mixins, and shared
DTOs. Service layer, routers, validators, and tests are implemented in
subsequent sprints.
"""

from __future__ import annotations

from app.modules.billing import (
    constants,
    dependencies,
    enums,
    exceptions,
)
from app.modules.billing.repositories import (
    AuditRepository,
    CreditNoteRepository,
    DocumentSequenceRepository,
    InvoiceRepository,
    PatientCreditRepository,
    PaymentRepository,
    ReceiptRepository,
)
from app.modules.billing.schemas import common as schemas_common
from app.modules.billing.utils import (
    money,
    numbering,
    validation,
)

__all__ = [
    "AuditRepository",
    "constants",
    "CreditNoteRepository",
    "dependencies",
    "DocumentSequenceRepository",
    "enums",
    "exceptions",
    "InvoiceRepository",
    "money",
    "numbering",
    "PatientCreditRepository",
    "PaymentRepository",
    "ReceiptRepository",
    "schemas_common",
    "validation",
]
