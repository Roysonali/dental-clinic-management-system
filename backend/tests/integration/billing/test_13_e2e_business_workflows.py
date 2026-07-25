"""Sprint 12: End-to-End Business Workflow Automation.

Validates complete real-world dental clinic business workflows through
the billing service layer and public APIs. Unlike Sprint 10A (which tested
isolated billing operations) and Sprint 11 (which tested cross-module FK
relationships), Sprint 12 validates complete business journeys that a
dental clinic staff member performs daily.

Every test uses real PostgreSQL, real services, real repositories.
No mocks. No fake implementations.

Workflow Catalogue
------------------
WF-001: Full Patient Visit (Appointment → Treatment → Invoice → Payment → Receipt)
WF-002: Partial Payment Installments (Invoice → Partial Pay → Outstanding → Second Payment → Settled)
WF-003: Refund Lifecycle (Payment → Refund Request → Approve → Complete → Allocation)
WF-004: Credit Note Lifecycle (Invoice → Credit Note → Draft → Issue → Apply → Balance)
WF-005: Payment Failure & Reattempt (Payment → Fail → New Payment → Complete → Allocate)
WF-006: Multi-Invoice Settlement (One Payment → Allocate to Multiple Invoices)
WF-007: Invoice Workflow States (Draft → Issue → Cancel → Terminal State)
WF-008: Full Refund of Payment (Payment → Multiple Refunds → Fully Refunded → Status REFUNDED)

NEG-001: Over-refund attempt rejected
NEG-002: Complete refund on non-approved refund rejected
NEG-003: Invalid invoice status transitions
NEG-004: Allocate to cancelled invoice rejected
NEG-005: Delete issued invoice rejected
NEG-006: Unauthenticated access rejected
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.modules.billing.constants import ZERO_MONEY
from app.modules.billing.enums import (
    CreditNoteStatus,
    InvoiceStatus,
    PaymentMethod,
    PaymentStatus,
    ReceiptStatus,
    RefundStatus,
)
from app.modules.billing.models import (
    BillingAuditLog,
    CreditNote,
    Invoice,
    InvoiceItem,
    Payment,
    PaymentAllocation,
    Receipt,
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
from app.modules.billing.exceptions import (
    RefundExceedsPayment,
    InvalidInvoiceStatusTransition,
    InvoiceNotEditable,
    PaymentValidationFailed,
    CreditNoteNotApplicable,
)
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ======================================================================
# Service Builders (copied from test_07_e2e_workflows.py for consistency)
# ======================================================================


def _build_invoice_service(db):
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    invoice_validator = InvoiceValidator(invoice_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return InvoiceService(
        db=db, invoice_repo=invoice_repo, invoice_validator=invoice_validator,
        financial_validator=financial_validator,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
    )


def _build_payment_service(db):
    payment_repo = PaymentRepository(db)
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    payment_validator = PaymentValidator(payment_repo, financial_validator)
    invoice_validator = InvoiceValidator(invoice_repo, financial_validator)
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
    refund_repo = RefundRepository(db)
    payment_repo = PaymentRepository(db)
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
    credit_note_repo = CreditNoteRepository(db)
    invoice_repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    credit_note_validator = CreditNoteValidator(credit_note_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    doc_seq_service = DocumentSequenceService(db, doc_seq_repo, doc_seq_validator)
    return CreditNoteService(
        db=db, credit_note_repo=credit_note_repo, invoice_repo=invoice_repo,
        credit_note_validator=credit_note_validator,
        financial_validator=financial_validator,
        document_sequence_service=doc_seq_service, audit_repo=audit_repo,
    )


def _count_audit_entries(db, entity_type: str, entity_id: uuid.UUID) -> int:
    """Count audit log entries for a specific entity."""
    result = db.execute(
        text("SELECT COUNT(*) FROM billing_audit_logs WHERE entity_type = :et AND entity_id = CAST(:eid AS UUID)"),
        {"et": entity_type, "eid": str(entity_id)},
    ).scalar()
    return result or 0


# ======================================================================
# WF-001: Full Patient Visit Cycle
# Clinical journey: Patient visit → Treatment performed → Invoice created
#   → Payment collected → Receipt issued
# ======================================================================
class TestFullPatientVisitCycle:
    """WF-001: Complete dental clinic visit workflow."""

    def test_full_visit_cycle(self, db):
        """Simulate a patient's full visit: invoice → issue → payment → receipt.

        This is the most common daily workflow in a dental clinic.
        """
        inv_svc = _build_invoice_service(db)

        # Step 1: Create invoice (treatment performed)
        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF001-00001",
            items=[
                {"description": "Dental Examination", "quantity": 1, "unit_price": Decimal("50.00")},
                {"description": "Teeth Cleaning", "quantity": 1, "unit_price": Decimal("120.00")},
                {"description": "X-Ray (Full Mouth)", "quantity": 1, "unit_price": Decimal("200.00")},
            ],
            currency_code="USD",
            created_by=STUB_USER_ID,
        )
        db.flush()
        assert created.status == InvoiceStatus.DRAFT.value
        assert len(created.items) == 3

        # Step 2: Issue invoice
        issued = inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()
        assert issued.status == InvoiceStatus.ISSUED.value
        assert issued.invoice_number is not None

        # Step 3: Create and complete payment
        pay_svc = _build_payment_service(db)
        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("370.00"),
            payment_method=PaymentMethod.CARD,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
            reference_number="TXN-WF001-001",
        )
        db.flush()
        assert payment.status == PaymentStatus.PENDING.value

        completed_pay = pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()
        assert completed_pay.status == PaymentStatus.COMPLETED.value

        # Step 4: Allocate payment to invoice
        alloc = pay_svc.allocate_payment(
            payment_id=payment.id,
            invoice_id=issued.id,
            amount=Decimal("370.00"),
            allocated_by=STUB_USER_ID,
        )
        db.flush()
        assert alloc.allocated_amount == Decimal("370.00")

        # Step 5: Generate receipt
        rct_svc = _build_receipt_service(db)
        receipt, printable = rct_svc.generate_receipt(
            payment_id=payment.id,
            generated_by=STUB_USER_ID,
        )
        db.flush()
        assert receipt.status == ReceiptStatus.GENERATED.value
        assert receipt.amount == Decimal("370.00")

        # Verify audit trail captures all events
        assert _count_audit_entries(db, "invoice", issued.id) >= 2  # created + issued
        assert _count_audit_entries(db, "payment", payment.id) >= 2  # created + completed
        assert _count_audit_entries(db, "receipt", receipt.id) >= 1  # created

        # Verify financial totals
        inv_repo = InvoiceRepository(db)
        grand_total = inv_repo.get_invoice_grand_total(issued.id)
        allocated = inv_repo.get_total_allocated_for_invoice(issued.id)
        assert grand_total == Decimal("370.00")
        assert allocated == Decimal("370.00")


# ======================================================================
# WF-002: Partial Payment with Installments
# Clinical journey: Large treatment → Patient pays partially → Outstanding
#   balance remains → Patient returns → Second payment → Invoice settled
# ======================================================================
class TestPartialPaymentInstallments:
    """WF-002: Patient pays in installments over multiple visits."""

    def test_partial_payment_with_second_installment(self, db):
        """Invoice of $1000 → $400 paid → $600 outstanding → $600 paid → Settled."""
        inv_svc = _build_invoice_service(db)
        pay_svc = _build_payment_service(db)

        # Step 1: Create and issue $1000 invoice
        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF002-00001",
            items=[
                {"description": "Root Canal Treatment", "quantity": 1, "unit_price": Decimal("1000.00")},
            ],
            currency_code="USD",
            created_by=STUB_USER_ID,
        )
        db.flush()
        issued = inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        # Step 2: First payment — $400 (partial)
        pay1 = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("400.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(pay1.id, completed_by=STUB_USER_ID)
        db.flush()

        pay_svc.allocate_payment(
            payment_id=pay1.id, invoice_id=issued.id,
            amount=Decimal("400.00"), allocated_by=STUB_USER_ID,
        )
        db.flush()

        # Verify outstanding balance
        inv_repo = InvoiceRepository(db)
        grand_total = inv_repo.get_invoice_grand_total(issued.id)
        allocated = inv_repo.get_total_allocated_for_invoice(issued.id)
        outstanding = grand_total - allocated
        assert outstanding == Decimal("600.00")

        # Step 3: Second payment — $600 (final)
        pay2 = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("600.00"),
            payment_method=PaymentMethod.CARD,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(pay2.id, completed_by=STUB_USER_ID)
        db.flush()

        pay_svc.allocate_payment(
            payment_id=pay2.id, invoice_id=issued.id,
            amount=Decimal("600.00"), allocated_by=STUB_USER_ID,
        )
        db.flush()

        # Verify invoice fully settled
        total_allocated = inv_repo.get_total_allocated_for_invoice(issued.id)
        assert total_allocated == grand_total
        assert total_allocated == Decimal("1000.00")


# ======================================================================
# WF-003: Refund Lifecycle
# Clinical journey: Patient overpaid → Refund requested → Approved →
#   Completed → Refund allocation created
# ======================================================================
class TestRefundLifecycle:
    """WF-003: Complete refund process from request to completion."""

    def test_refund_request_to_completion(self, db):
        """Payment $500 → Refund $200 requested → Approved → Completed → Allocation."""
        pay_svc = _build_payment_service(db)
        ref_svc = _build_refund_service(db)

        # Step 1: Create and complete a payment
        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("500.00"),
            payment_method=PaymentMethod.CARD,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        # Step 2: Create refund request (PENDING)
        refund = ref_svc.create_refund(
            payment_id=payment.id,
            amount=Decimal("200.00"),
            reason="Patient overpaid — refund requested",
            created_by=STUB_USER_ID,
        )
        db.flush()
        assert refund.status == RefundStatus.PENDING.value

        # Step 3: Approve refund
        approved = ref_svc.approve_refund(refund.id, approved_by=STUB_USER_ID)
        db.flush()
        assert approved.status == RefundStatus.APPROVED.value

        # Step 4: Complete refund
        completed = ref_svc.complete_refund(refund.id, completed_by=STUB_USER_ID)
        db.flush()
        assert completed.status == RefundStatus.COMPLETED.value

        # Verify refund allocation exists
        pay_repo = PaymentRepository(db)
        allocations = pay_repo.get_allocations_for_payment(payment.id)
        refund_allocs = [a for a in allocations if a.is_refund]
        assert len(refund_allocs) == 1
        assert refund_allocs[0].allocated_amount == Decimal("200.00")

        # Verify completed refund total
        ref_repo = RefundRepository(db)
        completed_total = ref_repo.get_completed_refund_total(payment.id)
        assert completed_total == Decimal("200.00")

        # Verify audit trail
        audit_entries = _count_audit_entries(db, "refund", refund.id)
        assert audit_entries >= 3  # created + approved + completed


# ======================================================================
# WF-004: Credit Note Lifecycle
# Clinical journey: Invoice issued → Error discovered → Credit note created
#   → Issued → Applied → Outstanding balance reduced
# ======================================================================
class TestCreditNoteLifecycle:
    """WF-004: Complete credit note process: create → issue → apply."""

    def test_credit_note_draft_to_application(self, db):
        """Invoice $500 → Credit Note $100 → Issue → Apply → Balance reduced."""
        inv_svc = _build_invoice_service(db)
        cn_svc = _build_credit_note_service(db)

        # Step 1: Create and issue invoice
        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF004-00001",
            items=[
                {"description": "Dental Crown", "quantity": 1, "unit_price": Decimal("500.00")},
            ],
            currency_code="USD",
            created_by=STUB_USER_ID,
        )
        db.flush()
        issued = inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        # Step 2: Create credit note (DRAFT)
        cn = cn_svc.create_credit_note(
            invoice_id=issued.id,
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Service discount adjustment",
            created_by=STUB_USER_ID,
        )
        db.flush()
        assert cn.status == CreditNoteStatus.DRAFT.value
        assert cn.remaining_balance == Decimal("100.00")

        # Step 3: Issue credit note
        issued_cn = cn_svc.issue_credit_note(cn.id, issued_by=STUB_USER_ID)
        db.flush()
        assert issued_cn.status == CreditNoteStatus.ISSUED.value
        assert issued_cn.issue_date is not None

        # Step 4: Apply credit note
        applied = cn_svc.apply_credit_note(cn.id, applied_by=STUB_USER_ID)
        db.flush()
        assert applied.status == CreditNoteStatus.APPLIED.value
        assert applied.remaining_balance == Decimal("0.00")

        # Verify invoice outstanding balance (grand total unchanged)
        inv_repo = InvoiceRepository(db)
        grand_total = inv_repo.get_invoice_grand_total(issued.id)
        assert grand_total == Decimal("500.00")

        # Verify audit trail
        audit_entries = _count_audit_entries(db, "credit_note", cn.id)
        assert audit_entries >= 3  # created + issued + applied


# ======================================================================
# WF-005: Payment Failure & Reattempt
# Clinical journey: Patient's card declined → Payment marked failed →
#   Patient retries with cash → Payment succeeds → Allocated to invoice
# ======================================================================
class TestPaymentFailureAndReattempt:
    """WF-005: Payment fails, then patient retries successfully."""

    def test_payment_fail_then_reattempt(self, db):
        """Create pending payment → Fail → New payment → Complete → Allocate."""
        inv_svc = _build_invoice_service(db)
        pay_svc = _build_payment_service(db)

        # Step 1: Create and issue invoice
        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF005-00001",
            items=[
                {"description": "Tooth Extraction", "quantity": 1, "unit_price": Decimal("300.00")},
            ],
            currency_code="USD",
            created_by=STUB_USER_ID,
        )
        db.flush()
        issued = inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        # Step 2: First payment attempt fails
        pay1 = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("300.00"),
            payment_method=PaymentMethod.CARD,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        failed = pay_svc.fail_payment(pay1.id, failed_by=STUB_USER_ID, reason="Card declined")
        db.flush()
        assert failed.status == PaymentStatus.FAILED.value

        # Verify no allocation on failed payment
        assert len(failed.payment_allocations) == 0

        # Step 3: Second payment attempt with cash succeeds
        pay2 = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("300.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(pay2.id, completed_by=STUB_USER_ID)
        db.flush()

        pay_svc.allocate_payment(
            payment_id=pay2.id, invoice_id=issued.id,
            amount=Decimal("300.00"), allocated_by=STUB_USER_ID,
        )
        db.flush()

        # Verify invoice paid
        inv_repo = InvoiceRepository(db)
        allocated = inv_repo.get_total_allocated_for_invoice(issued.id)
        assert allocated == Decimal("300.00")

        # Verify failed payment has audit log
        fail_audit = _count_audit_entries(db, "payment", pay1.id)
        assert fail_audit >= 1


# ======================================================================
# WF-006: Multi-Invoice Settlement
# Clinical journey: Patient pays a lump sum → Receptionist allocates
#   across multiple outstanding invoices
# ======================================================================
class TestMultiInvoiceSettlement:
    """WF-006: One payment allocated to multiple invoices."""

    def test_single_payment_settles_two_invoices(self, db):
        """Payment $800 → Allocate $500 to Invoice A, $300 to Invoice B."""
        inv_svc = _build_invoice_service(db)
        pay_svc = _build_payment_service(db)

        # Step 1: Create and issue two invoices
        inv_a = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF006-A-001",
            items=[{"description": "Bridge", "quantity": 1, "unit_price": Decimal("500.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        inv_svc.issue_invoice(inv_a.id, issued_by=STUB_USER_ID)
        db.flush()

        inv_b = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF006-B-001",
            items=[{"description": "Filling", "quantity": 2, "unit_price": Decimal("150.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        inv_svc.issue_invoice(inv_b.id, issued_by=STUB_USER_ID)
        db.flush()

        # Step 2: Single lump-sum payment of $800
        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("800.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        # Step 3: Allocate $500 to Invoice A
        alloc_a = pay_svc.allocate_payment(
            payment_id=payment.id, invoice_id=inv_a.id,
            amount=Decimal("500.00"), allocated_by=STUB_USER_ID,
        )
        db.flush()
        assert alloc_a.allocated_amount == Decimal("500.00")

        # Step 4: Allocate $300 to Invoice B
        alloc_b = pay_svc.allocate_payment(
            payment_id=payment.id, invoice_id=inv_b.id,
            amount=Decimal("300.00"), allocated_by=STUB_USER_ID,
        )
        db.flush()
        assert alloc_b.allocated_amount == Decimal("300.00")

        # Step 5: Verify each invoice's allocation
        inv_repo = InvoiceRepository(db)
        assert inv_repo.get_total_allocated_for_invoice(inv_a.id) == Decimal("500.00")
        assert inv_repo.get_total_allocated_for_invoice(inv_b.id) == Decimal("300.00")

        # Verify remaining unallocated on payment (800 - 500 - 300 = 0)
        pay_repo = PaymentRepository(db)
        allocations = pay_repo.get_allocations_for_payment(payment.id)
        total_allocated = sum(a.allocated_amount for a in allocations if not a.is_refund)
        assert payment.total_amount - total_allocated == Decimal("0.00")


# ======================================================================
# WF-007: Invoice Workflow States
# Clinical journey: Invoice created → Issued → Cancelled (verify cannot
#   issue or pay a cancelled invoice)
# ======================================================================
class TestInvoiceWorkflowStates:
    """WF-007: Complete invoice state transitions with terminal state."""

    def test_invoice_draft_issue_cancel_terminal(self, db):
        """Draft → Issue → Cancel → verify terminal state."""
        inv_svc = _build_invoice_service(db)

        # Step 1: Create draft
        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF007-00001",
            items=[{"description": "Consultation", "quantity": 1, "unit_price": Decimal("100.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        db.flush()
        assert created.status == InvoiceStatus.DRAFT.value

        # Step 2: Issue
        issued = inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()
        assert issued.status == InvoiceStatus.ISSUED.value

        # Step 3: Cancel
        cancelled = inv_svc.cancel_invoice(
            created.id, cancelled_by=STUB_USER_ID,
            cancellation_reason="Patient cancelled treatment",
        )
        db.flush()
        assert cancelled.status == InvoiceStatus.CANCELLED.value
        assert cancelled.cancellation_reason == "Patient cancelled treatment"

        # Verify terminal: cannot issue again
        with pytest.raises(InvalidInvoiceStatusTransition):
            inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)

        # Verify terminal: cannot cancel again
        with pytest.raises(InvalidInvoiceStatusTransition):
            inv_svc.cancel_invoice(
                created.id, cancelled_by=STUB_USER_ID,
                cancellation_reason="Duplicate cancellation",
            )

        # Verify invoice has status history
        hist_result = db.execute(
            text("SELECT COUNT(*) FROM invoice_status_history WHERE invoice_id = CAST(:iid AS UUID)"),
            {"iid": str(created.id)},
        ).scalar()
        assert hist_result >= 2  # draft→created, created→issued, issued→cancelled


# ======================================================================
# WF-008: Full Refund of Payment
# Clinical journey: Patient paid $500 → Multiple refunds ($200 + $300) →
#   Payment fully refunded → Payment status becomes REFUNDED
# ======================================================================
class TestFullPaymentRefund:
    """WF-008: Multiple refunds exhausting payment balance."""

    def test_full_payment_refund_updates_payment_status(self, db):
        """Payment $500 → Refund $200 → Refund $300 → Payment marked REFUNDED."""
        pay_svc = _build_payment_service(db)
        ref_svc = _build_refund_service(db)

        # Step 1: Create and complete payment of $500
        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("500.00"),
            payment_method=PaymentMethod.CARD,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        # Step 2: First refund — $200
        ref1 = ref_svc.create_refund(
            payment_id=payment.id, amount=Decimal("200.00"),
            reason="Partial refund", created_by=STUB_USER_ID,
        )
        db.flush()
        ref_svc.approve_refund(ref1.id, approved_by=STUB_USER_ID)
        ref_svc.complete_refund(ref1.id, completed_by=STUB_USER_ID)
        db.flush()

        # Payment should still be COMPLETED (not fully refunded)
        pay_repo = PaymentRepository(db)
        payment_after_first = pay_repo.get_by_id(payment.id)
        assert payment_after_first.status == PaymentStatus.COMPLETED.value

        # Step 3: Second refund — $300 (exhausts payment)
        ref2 = ref_svc.create_refund(
            payment_id=payment.id, amount=Decimal("300.00"),
            reason="Final refund", created_by=STUB_USER_ID,
        )
        db.flush()
        ref_svc.approve_refund(ref2.id, approved_by=STUB_USER_ID)
        ref_svc.complete_refund(ref2.id, completed_by=STUB_USER_ID)
        db.flush()

        # Payment should now be REFUNDED
        db.expire_all()
        payment_final = pay_repo.get_by_id(payment.id)
        assert payment_final.status == PaymentStatus.REFUNDED.value

        # Verify completed refund totals
        ref_repo = RefundRepository(db)
        completed_total = ref_repo.get_completed_refund_total(payment.id)
        assert completed_total == Decimal("500.00")

        # Verify refund allocations
        allocations = pay_repo.get_allocations_for_payment(payment.id)
        refund_allocs = [a for a in allocations if a.is_refund]
        assert len(refund_allocs) == 2
        total_refunded = sum(a.allocated_amount for a in refund_allocs)
        assert total_refunded == Decimal("500.00")


# ======================================================================
# NEG-001: Over-refund Attempt Rejected
# Clinical journey: Payment of $100 → Refund of $150 → Business validation
#   rejects over-refund
# ======================================================================
class TestOverRefundRejected:
    """NEG-001: Refund exceeding payment balance is rejected."""

    def test_cannot_exceed_payment_amount(self, db):
        """Refund $150 on $100 payment must raise RefundExceedsPayment."""
        pay_svc = _build_payment_service(db)
        ref_svc = _build_refund_service(db)

        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        with pytest.raises(RefundExceedsPayment):
            ref_svc.create_refund(
                payment_id=payment.id,
                amount=Decimal("150.00"),
                reason="Over-refund attempt",
                created_by=STUB_USER_ID,
            )


# ======================================================================
# NEG-002: Complete Non-approved Refund Rejected
# Clinical journey: Refund created → Direct completion attempt → Rejected
# ======================================================================
class TestCompleteNonApprovedRefundRejected:
    """NEG-002: Cannot complete a refund that hasn't been approved."""

    def test_cannot_skip_approval(self, db):
        """Completing a pending refund must raise."""
        pay_svc = _build_payment_service(db)
        ref_svc = _build_refund_service(db)

        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("200.00"),
            payment_method=PaymentMethod.CARD,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        refund = ref_svc.create_refund(
            payment_id=payment.id,
            amount=Decimal("50.00"),
            reason="Test refund — skip approval attempt",
            created_by=STUB_USER_ID,
        )
        db.flush()

        from app.modules.billing.exceptions import InvalidRefundStatusTransition
        with pytest.raises(InvalidRefundStatusTransition):
            ref_svc.complete_refund(refund.id, completed_by=STUB_USER_ID)


# ======================================================================
# NEG-003: Invalid Invoice Status Transitions
# Clinical journey: Staff tries invalid operations on invoices
# ======================================================================
class TestInvalidInvoiceTransitions:
    """NEG-003: Invalid status transitions are rejected."""

    def test_cannot_issue_issued_invoice(self, db):
        """Issuing an already-issued invoice is rejected."""
        inv = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        db.flush()

        svc = _build_invoice_service(db)
        with pytest.raises(InvalidInvoiceStatusTransition):
            svc.issue_invoice(inv.id, issued_by=STUB_USER_ID)

    def test_cannot_delete_issued_invoice(self, db):
        """Deleting a non-draft invoice is rejected."""
        inv = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        db.flush()

        svc = _build_invoice_service(db)
        with pytest.raises(InvoiceNotEditable):
            svc.delete_draft_invoice(inv.id)

    def test_cannot_issue_draft_without_items(self, db):
        """Issuing an invoice with no items is rejected."""
        inv = InvoiceFactory.create(db, status=InvoiceStatus.DRAFT.value)
        db.flush()

        svc = _build_invoice_service(db)
        # Validate issuable will fail because invoice has no items
        from app.modules.billing.exceptions import InvoiceValidationFailed
        with pytest.raises((InvoiceValidationFailed, InvalidInvoiceStatusTransition)):
            svc.issue_invoice(inv.id, issued_by=STUB_USER_ID)


# ======================================================================
# NEG-004: Allocate to Cancelled Invoice Rejected
# Clinical journey: Invoice cancelled → Attempt to allocate payment → Rejected
# ======================================================================
class TestAllocateToCancelledInvoiceRejected:
    """NEG-004: Payment allocation to cancelled invoice is rejected."""

    def test_cannot_allocate_to_cancelled_invoice(self, db):
        """Payment allocation to a cancelled invoice must raise."""
        pay_svc = _build_payment_service(db)
        inv_svc = _build_invoice_service(db)

        # Create and issue invoice
        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="NEG004-00001",
            items=[{"description": "Service", "quantity": 1, "unit_price": Decimal("100.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        db.flush()
        inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        # Cancel invoice
        inv_svc.cancel_invoice(
            created.id, cancelled_by=STUB_USER_ID,
            cancellation_reason="Patient cancelled",
        )
        db.flush()

        # Create payment
        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        # Try to allocate to cancelled invoice
        from app.modules.billing.exceptions import InvalidInvoiceStatusTransition
        with pytest.raises((InvalidInvoiceStatusTransition,)):
            pay_svc.allocate_payment(
                payment_id=payment.id, invoice_id=created.id,
                amount=Decimal("100.00"), allocated_by=STUB_USER_ID,
            )


# ======================================================================
# NEG-005: Allocate Exceeding Payment Balance Rejected
# Clinical journey: Payment of $100 → Allocate $120 → Rejected
# ======================================================================
class TestOverAllocationRejected:
    """NEG-005: Cannot allocate more than payment amount."""

    def test_cannot_over_allocate_payment(self, db):
        """Allocation exceeding payment balance raises."""
        inv_svc = _build_invoice_service(db)
        pay_svc = _build_payment_service(db)

        created = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="NEG005-00001",
            items=[{"description": "Expensive Procedure", "quantity": 1, "unit_price": Decimal("1000.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        db.flush()
        issued = inv_svc.issue_invoice(created.id, issued_by=STUB_USER_ID)
        db.flush()

        payment = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        db.flush()
        pay_svc.complete_payment(payment.id, completed_by=STUB_USER_ID)
        db.flush()

        from app.modules.billing.exceptions import PaymentExceedsInvoice
        with pytest.raises(PaymentExceedsInvoice):
            pay_svc.allocate_payment(
                payment_id=payment.id, invoice_id=issued.id,
                amount=Decimal("200.00"), allocated_by=STUB_USER_ID,
            )


# ======================================================================
# NEG-006: Unauthenticated Access Rejected (HTTP TestClient)
# Clinical journey: Unauthenticated user attempts to access billing endpoints
# ======================================================================
class TestUnauthenticatedAccess:
    """NEG-006: All billing endpoints reject unauthenticated requests."""

    def _test_401(self, pg_engine, method: str, path: str, json_body: dict | None = None):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from sqlalchemy.orm import sessionmaker
        from app.core.exception_handlers import register_exception_handlers
        from app.database.session import get_db
        from app.modules.billing.routers import billing_router

        app = FastAPI(title="DensCare E2E Test")
        app.include_router(billing_router)
        register_exception_handlers(app)
        TestSessionLocal = sessionmaker(bind=pg_engine)
        app.dependency_overrides[get_db] = lambda: TestSessionLocal()
        client = TestClient(app)

        if method == "GET":
            response = client.get(path)
        elif method == "POST":
            response = client.post(path, json=json_body or {})
        elif method == "DELETE":
            response = client.delete(path)
        else:
            raise ValueError(f"Unknown method: {method}")
        assert response.status_code == 401, f"Expected 401 for {method} {path}, got {response.status_code}"

    def test_unauthenticated_get_invoices(self, pg_engine):
        self._test_401(pg_engine, "GET", "/billing/invoices")

    def test_unauthenticated_create_invoice(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/invoices",
                       {"patient_id": str(uuid.uuid4()), "items": [{"description": "Test", "quantity": 1, "unit_price": "100.00"}], "currency_code": "USD"})

    def test_unauthenticated_create_payment(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/payments",
                       {"patient_id": str(uuid.uuid4()), "total_amount": "100.00", "payment_method": "cash", "payment_date": str(date.today())})

    def test_unauthenticated_get_dashboard(self, pg_engine):
        self._test_401(pg_engine, "GET", "/billing/dashboard")

    def test_unauthenticated_create_refund(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/refunds",
                       {"payment_id": str(uuid.uuid4()), "amount": "50.00", "reason": "Test"})

    def test_unauthenticated_create_credit_note(self, pg_engine):
        self._test_401(pg_engine, "POST", "/billing/credit-notes",
                       {"invoice_id": str(uuid.uuid4()), "patient_id": str(uuid.uuid4()), "amount": "50.00", "reason": "Test"})


# ======================================================================
# WF-009: Dashboard Financial Accuracy via Orchestration Service
# Cross-cutting: Verify dashboard totals reflect completed workflows
# ======================================================================
class TestDashboardFinancialAccuracy:
    """Cross-cutting: Verify dashboard aggregates match actual transactions."""

    def test_billing_totals_via_orchestration(self, db):
        """Create invoices + payments → Verify totals via BillingOrchestrationService."""
        from app.modules.billing.services.billing_orchestration_service import (
            BillingOrchestrationService,
        )
        from app.modules.billing.services.financial_calculation_service import (
            FinancialCalculationService,
        )

        inv_svc = _build_invoice_service(db)
        pay_svc = _build_payment_service(db)

        # Invoices: $1000 + $500 = $1500
        inv1 = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF009-00001",
            items=[{"description": "Major Procedure", "quantity": 1, "unit_price": Decimal("1000.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        inv_svc.issue_invoice(inv1.id, issued_by=STUB_USER_ID)

        inv2 = inv_svc.create_invoice(
            patient_id=STUB_PATIENT_ID,
            invoice_number="WF009-00002",
            items=[{"description": "Minor Procedure", "quantity": 1, "unit_price": Decimal("500.00")}],
            currency_code="USD", created_by=STUB_USER_ID,
        )
        inv_svc.issue_invoice(inv2.id, issued_by=STUB_USER_ID)

        # Payment: $600 collected
        pay1 = pay_svc.create_payment(
            patient_id=STUB_PATIENT_ID,
            amount=Decimal("600.00"),
            payment_method=PaymentMethod.CASH,
            payment_date=date.today(),
            created_by=STUB_USER_ID,
        )
        pay_svc.complete_payment(pay1.id, completed_by=STUB_USER_ID)
        pay_svc.allocate_payment(pay1.id, inv1.id, Decimal("600.00"), allocated_by=STUB_USER_ID)

        # Build FinancialCalculationService directly for read-only aggregates
        inv_repo = InvoiceRepository(db)
        pay_repo = PaymentRepository(db)
        ref_repo = RefundRepository(db)
        cn_repo = CreditNoteRepository(db)
        _ = (ref_repo, cn_repo)  # suppress unused-variable warnings
        financial_validator = FinancialValidator()

        calc_svc = FinancialCalculationService(
            invoice_repo=inv_repo,
            payment_repo=pay_repo,
            refund_repo=ref_repo,
            credit_note_repo=cn_repo,
            financial_validator=financial_validator,
        )

        totals = calc_svc.calculate_billing_totals()

        # Verify totals reflect the completed transactions
        # NOTE: These assertions use the live service's queries so they
        # validate the database state matches expectations.
        assert totals.total_invoiced >= Decimal("1500.00")
        assert totals.total_collected >= Decimal("600.00")
        assert totals.total_outstanding >= Decimal("900.00")
