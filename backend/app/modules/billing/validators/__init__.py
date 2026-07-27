"""Billing module — validators package.

The validators layer is split into:

1. **State machine** (``state_machine.py``): Pure workflow-transition validation
   for invoice, payment, receipt, and credit note statuses. No database access,
   no repositories, no services.

2. **Protocols** (``protocols.py``): Repository protocol definitions used by
   validators for dependency inversion.

3. **FinancialValidator** (``financial_validator.py``): Centralized monetary
   and percentage validations: positive amounts, non-negative values, currency
   consistency, discount/tax rate bounds, allocation limits, refund limits,
   remaining balance checks, and grand total consistency.

4. **Entity validators**: One validator class per aggregate root:
   - ``InvoiceValidator``
   - ``PaymentValidator``
   - ``ReceiptValidator``
   - ``CreditNoteValidator``
   - ``PatientCreditValidator``
   - ``DocumentSequenceValidator``

Validators perform validation only. They do NOT perform workflows, modify the
database, commit transactions, or contain business orchestration.
"""

from app.modules.billing.validators.credit_note_validator import (
    CreditNoteValidator,
)
from app.modules.billing.validators.document_sequence_validator import (
    DocumentSequenceValidator,
)
from app.modules.billing.validators.financial_validator import (
    FinancialValidator,
)
from app.modules.billing.validators.invoice_validator import (
    InvoiceValidator,
)
from app.modules.billing.validators.patient_credit_validator import (
    PatientCreditValidator,
)
from app.modules.billing.validators.payment_validator import (
    PaymentValidator,
)
from app.modules.billing.validators.protocols import (
    CreditNoteRepositoryProtocol,
    DocumentSequenceRepositoryProtocol,
    InvoiceRepositoryProtocol,
    PatientCreditRepositoryProtocol,
    PaymentRepositoryProtocol,
    ReceiptRepositoryProtocol,
)
from app.modules.billing.validators.receipt_validator import (
    ReceiptValidator,
)
from app.modules.billing.validators.refund_validator import (
    RefundValidator,
)
from app.modules.billing.validators.state_machine import (
    allowed_transitions,
    can_transition,
    is_editable_state,
    is_terminal_state,
    validate_credit_note_transition,
    validate_invoice_transition,
    validate_payment_transition,
    validate_receipt_transition,
    validate_refund_transition,
    validate_transition,
)

__all__ = [
    "allowed_transitions",
    "can_transition",
    "CreditNoteRepositoryProtocol",
    "CreditNoteValidator",
    "DocumentSequenceRepositoryProtocol",
    "DocumentSequenceValidator",
    "FinancialValidator",
    "InvoiceRepositoryProtocol",
    "InvoiceValidator",
    "is_editable_state",
    "is_terminal_state",
    "PatientCreditRepositoryProtocol",
    "PatientCreditValidator",
    "PaymentRepositoryProtocol",
    "PaymentValidator",
    "ReceiptRepositoryProtocol",
    "ReceiptValidator",
    "RefundRepositoryProtocol",
    "RefundValidator",
    "validate_credit_note_transition",
    "validate_invoice_transition",
    "validate_payment_transition",
    "validate_receipt_transition",
    "validate_refund_transition",
    "validate_transition",
]
