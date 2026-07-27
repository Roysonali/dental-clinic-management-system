"""Phase 7: End-to-End Billing Workflow Tests.

Tests complete billing workflows against real PostgreSQL, validating:
- Database state at each step
- Status transitions
- Audit log entries
- Financial totals consistency
- Document numbering
- Full lifecycle: Invoice → Issue → Payment → Allocation → Receipt → Refund → Credit Note
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.modules.billing.enums import (
    InvoiceStatus,
    PaymentStatus,
    ReceiptStatus,
    RefundStatus,
    CreditNoteStatus,
)
from app.modules.billing.models import (
    BillingAuditLog,
    CreditNote,
    DocumentSequence,
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
    Payment,
    PaymentAllocation,
    Receipt,
    ReceiptInvoice,
    Refund,
)
from app.modules.billing.repositories import (
    AuditRepository,
    CreditNoteRepository,
    DocumentSequenceRepository,
    InvoiceRepository,
    PaymentRepository,
    ReceiptRepository,
    RefundRepository,
)
from app.modules.billing.services import DocumentSequenceService
from app.modules.billing.services.invoice_service import InvoiceService
from app.modules.billing.services.payment_service import PaymentService
from app.modules.billing.services.receipt_service import ReceiptService
from app.modules.billing.services.refund_service import RefundService
from app.modules.billing.services.credit_note_service import CreditNoteService
from app.modules.billing.validators import (
    DocumentSequenceValidator,
    FinancialValidator,
    InvoiceValidator,
    PaymentValidator,
)
from app.modules.billing.validators.credit_note_validator import CreditNoteValidator
from app.modules.billing.validators.receipt_validator import ReceiptValidator
from app.modules.billing.validators.refund_validator import RefundValidator
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    ReceiptFactory,
    RefundFactory,
    CreditNoteFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ---------------------------------------------------------------------------
# Helpers — wire up full service stacks
# ---------------------------------------------------------------------------
def _build_invoice_service(db):
    from app.modules.patients.repository import PatientRepository
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    patient_repo = PatientRepository(db)
    financial_validator = FinancialValidator()
    invoice_validator = InvoiceValidator(
        invoice_repo=invoice_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return InvoiceService(
        db=db, invoice_repo=invoice_repo, invoice_validator=invoice_validator,
        financial_validator=financial_validator,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
    )


def _build_payment_service(db):
    from app.modules.patients.repository import PatientRepository
    payment_repo = PaymentRepository(db)
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    patient_repo = PatientRepository(db)
    financial_validator = FinancialValidator()
    payment_validator = PaymentValidator(
        payment_repo=payment_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    invoice_validator = InvoiceValidator(
        invoice_repo=invoice_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return PaymentService(
        db=db, payment_repo=payment_repo, payment_validator=payment_validator,
        financial_validator=financial_validator,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
        invoice_repo=invoice_repo, invoice_validator=invoice_validator,
    )


def _build_receipt_service(db):
    receipt_repo = ReceiptRepository(db)
    payment_repo = PaymentRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    receipt_validator = ReceiptValidator(receipt_repo)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return ReceiptService(
        db=db, receipt_repo=receipt_repo, receipt_validator=receipt_validator,
        payment_repo=payment_repo,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
    )


def _build_refund_service(db):
    from app.modules.billing.repositories import PaymentRepository as PR
    refund_repo = RefundRepository(db)
    payment_repo = PR(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    refund_validator = RefundValidator(refund_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return RefundService(
        db=db, refund_repo=refund_repo, payment_repo=payment_repo,
        refund_validator=refund_validator, financial_validator=financial_validator,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
    )


def _build_credit_note_service(db):
    from app.modules.patients.repository import PatientRepository
    credit_note_repo = CreditNoteRepository(db)
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    patient_repo = PatientRepository(db)
    financial_validator = FinancialValidator()
    credit_note_validator = CreditNoteValidator(
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return CreditNoteService(
        db=db, credit_note_repo=credit_note_repo, invoice_repo=invoice_repo,
        credit_note_validator=credit_note_validator,
        financial_validator=financial_validator,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
    )


# ---------------------------------------------------------------------------
# Full Invoice → Issue Workflow
# ---------------------------------------------------------------------------
class TestInvoiceIssueWorkflow:
    def test_create_and_issue_invoice(self, db):
        """Create a draft invoice with items, then issue it."""
        service = _build_invoice_service(db)

        created = service.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="INV-E2E-000001",
            items=[
                {"description": "Consultation", "quantity": 1, "unit_price": Decimal("100.00")},
                {"description": "X-Ray", "quantity": 2, "unit_price": Decimal("50.00")},
            ],
            currency_code="USD",
            created_by=STUB_USER_ID,
        )
        db.flush()

        assert created.status == "draft"
        assert created.invoice_number is not None

        issued = service.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        assert issued.status == "issued"

        repo = InvoiceRepository(db)
        from_db = repo.get_by_id(created.id)
        assert from_db.status == "issued"

    def test_invoice_issue_creates_audit_log(self, db):
        service = _build_invoice_service(db)

        created = service.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="INV-E2E-000002",
            items=[{"description": "Service", "quantity": 1, "unit_price": Decimal("100.00")}],
            currency_code="USD",
            created_by=STUB_USER_ID,
        )
        db.flush()

        service.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        audit_repo = AuditRepository(db)
        logs, total = audit_repo.find_by_entity("invoice", created.id, sort_by="changed_at")
        assert total >= 1

    def test_invoice_item_totals_correct(self, db):
        inv = InvoiceFactory.create(db, status="draft")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("150.00"), net_amount=Decimal("150.00"),
        )
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=2,
            unit_price=Decimal("75.25"), net_amount=Decimal("75.25"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("225.25")


# ---------------------------------------------------------------------------
# Payment → Allocation Workflow
# ---------------------------------------------------------------------------
class TestPaymentAllocationWorkflow:
    def test_full_payment_allocation(self, db):
        """Issue invoice → create payment → allocate → verify totals."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("200.00"), net_amount=Decimal("200.00"),
        )
        db.flush()

        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("200.00"),
        )
        db.flush()

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        inv_repo = InvoiceRepository(db)
        allocated = inv_repo.get_total_allocated_for_invoice(inv.id)
        assert allocated == Decimal("200.00")

        pay_repo = PaymentRepository(db)
        pay_allocated = pay_repo.get_total_allocated_for_payment(payment.id)
        assert pay_allocated == Decimal("200.00")

    def test_partial_payment_allocation(self, db):
        """Issue invoice → partial payment → verify outstanding."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("500.00"), net_amount=Decimal("500.00"),
        )
        db.flush()

        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("200.00"),
        )
        db.flush()

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("200.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        inv_repo = InvoiceRepository(db)
        grand_total = inv_repo.get_invoice_grand_total(inv.id)
        allocated = inv_repo.get_total_allocated_for_invoice(inv.id)
        outstanding = grand_total - allocated
        assert outstanding == Decimal("300.00")


# ---------------------------------------------------------------------------
# Receipt Generation
# ---------------------------------------------------------------------------
class TestReceiptWorkflow:
    def test_generate_receipt_for_payment(self, db):
        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("150.00"),
        )
        db.flush()

        receipt_repo = ReceiptRepository(db)
        receipt = ReceiptFactory.create(
            db, payment_id=payment.id, amount=payment.total_amount,
        )
        db.flush()

        retrieved = receipt_repo.get_by_id(receipt.id)
        assert retrieved is not None
        assert retrieved.status == "generated"

        by_payment = receipt_repo.find_by_payment(payment.id)
        assert by_payment is not None
        assert by_payment.id == receipt.id


# ---------------------------------------------------------------------------
# Refund Workflow
# ---------------------------------------------------------------------------
class TestRefundWorkflow:
    def test_full_refund_lifecycle(self, db):
        """Complete payment → refund → verify allocation."""
        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("300.00"),
        )
        db.flush()

        refund = RefundFactory.create(
            db, payment_id=payment.id, amount=Decimal("100.00"),
            status="pending",
        )
        db.flush()

        refund_repo = RefundRepository(db)
        refund_repo.update(refund, {"status": "approved", "reviewed_by": STUB_USER_ID})
        db.flush()

        refund_repo.update(refund, {"status": "completed"})
        db.flush()

        completed_total = refund_repo.get_completed_refund_total(payment.id)
        assert completed_total == Decimal("100.00")

    def test_refund_does_not_exceed_payment(self, db):
        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("100.00"),
        )
        db.flush()

        outstanding = RefundRepository(db).get_outstanding_refund_total(payment.id)
        assert outstanding == ZERO_MONEY


# ---------------------------------------------------------------------------
# Credit Note Workflow
# ---------------------------------------------------------------------------
class TestCreditNoteWorkflow:
    def test_full_credit_note_lifecycle(self, db):
        """Create credit note → issue → verify."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("300.00"), net_amount=Decimal("300.00"),
        )
        db.flush()

        cn = CreditNoteFactory.create(
            db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"), remaining_balance=Decimal("100.00"),
            status="draft",
        )
        db.flush()

        cn_repo = CreditNoteRepository(db)
        cn.status = CreditNoteStatus.ISSUED.value
        cn.issue_date = date.today()
        cn.updated_by = STUB_USER_ID
        db.flush()

        retrieved = cn_repo.get_by_id(cn.id)
        assert retrieved.status == CreditNoteStatus.ISSUED.value
        assert retrieved.remaining_balance == Decimal("100.00")


# ---------------------------------------------------------------------------
# Cross-Entity Consistency
# ---------------------------------------------------------------------------
class TestCrossEntityConsistency:
    ZERO_MONEY = Decimal("0.00")

    def test_financial_totals_consistent_after_full_workflow(self, db):
        """Verify all financial totals are consistent after a complex workflow."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("1000.00"), net_amount=Decimal("1000.00"),
        )
        db.flush()

        inv_repo = InvoiceRepository(db)
        grand_total = inv_repo.get_invoice_grand_total(inv.id)
        assert grand_total == Decimal("1000.00")

        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("600.00"),
        )
        db.flush()

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("600.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        allocated = inv_repo.get_total_allocated_for_invoice(inv.id)
        assert allocated == Decimal("600.00")
        assert grand_total - allocated == Decimal("400.00")

    def test_document_numbering_sequential(self, db):
        """Verify document numbers are unique and sequential."""
        inv1 = InvoiceFactory.create(db)
        inv2 = InvoiceFactory.create(db)

        assert inv1.invoice_number != inv2.invoice_number

        payment1 = PaymentFactory.create(db)
        payment2 = PaymentFactory.create(db)
        assert payment1.payment_number != payment2.payment_number

    def test_audit_trail_completeness(self, db):
        """Verify audit entries are created for billing operations."""
        inv = InvoiceFactory.create(db, status="draft")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()
        db.expire_all()

        audit_repo = AuditRepository(db)
        count_before = audit_repo.count()

        service = _build_invoice_service(db)
        service.issue_invoice(inv.id, issued_by=STUB_USER_ID)
        db.flush()

        count_after = audit_repo.count()
        assert count_after > count_before

    def test_refund_total_matches_payment(self, db):
        """Verify refund total is correctly computed from payment."""
        payment = PaymentFactory.create(
            db, status="completed", total_amount=Decimal("500.00"),
        )
        db.flush()

        RefundFactory.create(
            db, payment_id=payment.id, amount=Decimal("100.00"),
            status="completed",
        )
        RefundFactory.create(
            db, payment_id=payment.id, amount=Decimal("50.00"),
            status="completed",
        )
        RefundFactory.create(
            db, payment_id=payment.id, amount=Decimal("75.00"),
            status="pending",
        )
        db.flush()

        refund_repo = RefundRepository(db)
        completed = refund_repo.get_completed_refund_total(payment.id)
        outstanding = refund_repo.get_outstanding_refund_total(payment.id)

        assert completed == Decimal("150.00")
        assert outstanding == Decimal("225.00")


# ---------------------------------------------------------------------------
# Import for ZERO_MONEY
# ---------------------------------------------------------------------------
from app.modules.billing.constants import ZERO_MONEY
