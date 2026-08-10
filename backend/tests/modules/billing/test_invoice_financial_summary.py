"""Invoice financial summary — read-time paid/outstanding correctness.

Regression tests for the P0 financial defect: ``paid_amount`` and
``outstanding_amount`` in invoice read responses used to be hardcoded to
``0.00`` by the mapper. The authoritative calculation now lives in
``FinancialCalculationService`` (BR-63: outstanding = grand_total - paid +
refunded, floored at 0) and is attached to ORM aggregates by
``InvoiceService`` via one bulk query per page (no N+1). The mapper only
transfers those values; it never queries the database.

Scenarios covered (task Phase 2):
1. Draft invoice
2. Issued invoice with no payment
3. Partially paid invoice
4. Fully paid invoice
5. Multiple allocations
6. Payment deallocation
7. Refund allocation (credit/refund scenario)
8. Zero balance (fully paid -> outstanding 0)
9. Allocating more than the outstanding amount is rejected by the service
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from uuid import uuid4

from app.modules.billing.enums import InvoiceStatus, PaymentMethod, PaymentStatus
from app.modules.billing.exceptions import PaymentExceedsInvoice
from app.modules.billing.mappers import InvoiceMapper
from app.modules.billing.models import PaymentAllocation


# ======================================================================
# Fixtures
# ======================================================================

@pytest.fixture
def invoice_service_with_financials(db):
    """InvoiceService wired with a FinancialCalculationService (as in prod DI)."""
    from tests.modules.billing.conftest import (
        _STUB_USER_INT_ID,
        _STUB_PATIENT_ID,
    )
    from app.modules.billing.repositories import (
        AuditRepository,
        CreditNoteRepository,
        DocumentSequenceRepository,
        InvoiceRepository,
        PaymentRepository,
        RefundRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        InvoiceValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        InvoiceService,
        FinancialCalculationService,
    )
    from app.modules.patients.repository import PatientRepository
    from app.modules.doctors.repositories.doctor_repository import DoctorRepository
    from app.modules.appointments.repository import AppointmentRepository
    from app.modules.treatment.repositories.treatment_plan_repository import (
        TreatmentPlanRepository,
    )
    from app.modules.patient_records.repositories import DiagnosisRepository

    invoice_repo = InvoiceRepository(db)
    payment_repo = PaymentRepository(db)
    refund_repo = RefundRepository(db)
    credit_note_repo = CreditNoteRepository(db)
    patient_repo = PatientRepository(db)
    doctor_repo = DoctorRepository(db)
    appointment_repo = AppointmentRepository(db)
    treatment_plan_repo = TreatmentPlanRepository(db)
    diagnosis_repo = DiagnosisRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    invoice_validator = InvoiceValidator(
        invoice_repo=invoice_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
        appointment_repo=appointment_repo,
        doctor_repo=doctor_repo,
        treatment_plan_repo=treatment_plan_repo,
        treatment_plan_item_repo=treatment_plan_repo,
        diagnosis_repo=diagnosis_repo,
    )
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )
    financial_calc_service = FinancialCalculationService(
        invoice_repo=invoice_repo,
        payment_repo=payment_repo,
        refund_repo=refund_repo,
        credit_note_repo=credit_note_repo,
        financial_validator=financial_validator,
    )
    return InvoiceService(
        db=db,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
        financial_calc_service=financial_calc_service,
    )


@pytest.fixture
def payment_service_with_financials(db):
    """PaymentService with invoice dependencies for allocation operations."""
    from tests.modules.billing.conftest import _STUB_USER_INT_ID
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        InvoiceRepository,
        PaymentRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        InvoiceValidator,
        PaymentValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        PaymentService,
    )
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
    invoice_validator = InvoiceValidator(invoice_repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )
    return PaymentService(
        db=db,
        payment_repo=payment_repo,
        payment_validator=payment_validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
        invoice_repo=invoice_repo,
        invoice_validator=invoice_validator,
    )


@pytest.fixture
def created_invoice(invoice_service_with_financials):
    """An issued invoice with one line item of 1500.00 (grand total 1500.00)."""
    from tests.modules.billing.conftest import (
        _STUB_USER_INT_ID,
        _STUB_PATIENT_ID,
    )
    inv = invoice_service_with_financials.create_invoice(
        patient_id=_STUB_PATIENT_ID,
        invoice_number="FIN-00001",
        currency_code="USD",
        items=[
            {"description": "Root Canal", "quantity": 1, "unit_price": Decimal("1500.00")},
        ],
        created_by=_STUB_USER_INT_ID,
    )
    issued = invoice_service_with_financials.issue_invoice(
        inv.id, issued_by=_STUB_USER_INT_ID
    )
    return issued


def _make_payment(payment_service, amount: str) -> object:
    """Create + complete a payment of the given amount."""
    from tests.modules.billing.conftest import (
        _STUB_USER_INT_ID,
        _STUB_PATIENT_ID,
    )
    payment = payment_service.create_payment(
        patient_id=_STUB_PATIENT_ID,
        amount=Decimal(amount),
        payment_method=PaymentMethod.CASH,
        payment_date=date.today(),
        created_by=_STUB_USER_INT_ID,
    )
    completed = payment_service.complete_payment(
        payment.id, completed_by=_STUB_USER_INT_ID
    )
    return completed


# ======================================================================
# 1. Draft invoice
# ======================================================================

class TestDraftInvoice:
    def test_draft_invoice_financials(self, invoice_service_with_financials):
        """A draft invoice (no payments) has paid=0; outstanding=grand_total.

        BR-63: outstanding = grand_total - paid + refunded. With no
        allocations this is the full grand total, exactly as for an issued
        invoice with no payment — the invoice is not yet collected.
        """
        from tests.modules.billing.conftest import (
            _STUB_USER_INT_ID,
            _STUB_PATIENT_ID,
        )
        draft = invoice_service_with_financials.create_invoice(
            patient_id=_STUB_PATIENT_ID,
            invoice_number="FIN-DRAFT-0001",
            currency_code="USD",
            items=[
                {"description": "Consultation", "quantity": 1, "unit_price": Decimal("100.00")},
            ],
            created_by=_STUB_USER_INT_ID,
        )
        fetched = invoice_service_with_financials.get_invoice(draft.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.paid_amount == Decimal("0.00")
        assert read.financials.outstanding_amount == Decimal("100.00")
        assert read.financials.grand_total == Decimal("100.00")


# ======================================================================
# 2. Issued invoice with no payment
# ======================================================================

class TestIssuedNoPayment:
    def test_issued_invoice_without_payment(self, created_invoice, invoice_service_with_financials):
        """Issued invoice with no payment: paid=0, outstanding=grand_total."""
        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.grand_total == Decimal("1500.00")
        assert read.financials.paid_amount == Decimal("0.00")
        assert read.financials.outstanding_amount == Decimal("1500.00")


# ======================================================================
# 3. Partially paid invoice
# ======================================================================

class TestPartiallyPaid:
    def test_partial_payment_updates_financials(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Invoice 1500, pay 1340 -> paid=1340, outstanding=160."""
        payment = _make_payment(payment_service_with_financials, "1340.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id,
            invoice_id=created_invoice.id,
            amount=Decimal("1340.00"),
            allocated_by=_STUB_USER_ID_FIXTURE(),
        )

        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.paid_amount == Decimal("1340.00")
        assert read.financials.outstanding_amount == Decimal("160.00")


# ======================================================================
# 4. Fully paid invoice
# ======================================================================

class TestFullyPaid:
    def test_full_payment_sets_outstanding_zero(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Invoice 1500, pay 1500 -> paid=1500, outstanding=0."""
        payment = _make_payment(payment_service_with_financials, "1500.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id,
            invoice_id=created_invoice.id,
            amount=Decimal("1500.00"),
            allocated_by=_STUB_USER_ID_FIXTURE(),
        )

        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.paid_amount == Decimal("1500.00")
        assert read.financials.outstanding_amount == Decimal("0.00")


# ======================================================================
# 5. Multiple allocations
# ======================================================================

class TestMultipleAllocations:
    def test_multiple_payments_accumulate(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Two payments (800 + 700) -> paid=1500, outstanding=0."""
        p1 = _make_payment(payment_service_with_financials, "800.00")
        payment_service_with_financials.allocate_payment(
            payment_id=p1.id, invoice_id=created_invoice.id,
            amount=Decimal("800.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )
        p2 = _make_payment(payment_service_with_financials, "700.00")
        payment_service_with_financials.allocate_payment(
            payment_id=p2.id, invoice_id=created_invoice.id,
            amount=Decimal("700.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )

        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.paid_amount == Decimal("1500.00")
        assert read.financials.outstanding_amount == Decimal("0.00")


# ======================================================================
# 6. Payment deallocation
# ======================================================================

class TestDeallocation:
    def test_deallocation_restores_outstanding(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Allocate 500 then deallocate -> paid=0, outstanding back to 1500."""
        payment = _make_payment(payment_service_with_financials, "500.00")
        alloc = payment_service_with_financials.allocate_payment(
            payment_id=payment.id, invoice_id=created_invoice.id,
            amount=Decimal("500.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )

        payment_service_with_financials.deallocate_payment(
            payment_id=payment.id,
            invoice_id=created_invoice.id,
            deallocated_by=_STUB_USER_ID_FIXTURE(),
        )

        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.paid_amount == Decimal("0.00")
        assert read.financials.outstanding_amount == Decimal("1500.00")


# ======================================================================
# 7. Refund allocation (credit/refund scenario)
# ======================================================================

class TestRefundAllocation:
    def test_refund_allocation_affects_outstanding(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Pay 1500, refund 300 (is_refund allocation) -> outstanding 300 (BR-63)."""
        payment = _make_payment(payment_service_with_financials, "1500.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id, invoice_id=created_invoice.id,
            amount=Decimal("1500.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )

        # Simulate a completed refund: an is_refund=True allocation on the
        # invoice. It is attached to a SECOND payment because the partial
        # unique index (payment_id, invoice_id) WHERE is_refund = FALSE is
        # compiled as a full unique index on SQLite — the refund allocation
        # must therefore not share the original payment row in unit tests.
        refund_source = _make_payment(payment_service_with_financials, "300.00")
        refund_alloc = PaymentAllocation(
            id=uuid4(),
            payment_id=refund_source.id,
            invoice_id=created_invoice.id,
            allocated_amount=Decimal("300.00"),
            is_refund=True,
            refund_reason="Patient refund",
            created_by=_STUB_USER_ID_FIXTURE(),
        )
        payment_service_with_financials._db.add(refund_alloc)
        payment_service_with_financials._db.flush()

        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        # paid stays 1500; outstanding = grand_total - paid + refunded = 300
        assert read.financials.paid_amount == Decimal("1500.00")
        assert read.financials.outstanding_amount == Decimal("300.00")


# ======================================================================
# 8. Zero balance
# ======================================================================

class TestZeroBalance:
    def test_zero_balance_after_full_payment(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Fully paid invoice has outstanding exactly 0.00."""
        payment = _make_payment(payment_service_with_financials, "1500.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id, invoice_id=created_invoice.id,
            amount=Decimal("1500.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )
        fetched = invoice_service_with_financials.get_invoice(created_invoice.id)
        read = InvoiceMapper.to_read(fetched)
        assert read.financials.outstanding_amount == Decimal("0.00")
        assert read.financials.outstanding_amount >= Decimal("0.00")


# ======================================================================
# 9. Over-allocation rejected
# ======================================================================

class TestOverAllocationRejected:
    def test_allocate_more_than_outstanding_rejected(
        self, created_invoice, payment_service_with_financials
    ):
        """Allocating 160.01 against a 160.00 outstanding is rejected (BR-63)."""
        payment = _make_payment(payment_service_with_financials, "1340.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id, invoice_id=created_invoice.id,
            amount=Decimal("1340.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )
        # Invoice 1500, allocated 1340 -> outstanding 160. Try 160.01.
        second_payment = _make_payment(payment_service_with_financials, "200.00")
        with pytest.raises(PaymentExceedsInvoice):
            payment_service_with_financials.allocate_payment(
                payment_id=second_payment.id, invoice_id=created_invoice.id,
                amount=Decimal("160.01"), allocated_by=_STUB_USER_ID_FIXTURE(),
            )

    def test_exact_outstanding_allowed(
        self, created_invoice, payment_service_with_financials
    ):
        """Allocating exactly the outstanding 160.00 is allowed."""
        payment = _make_payment(payment_service_with_financials, "1340.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id, invoice_id=created_invoice.id,
            amount=Decimal("1340.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )
        second_payment = _make_payment(payment_service_with_financials, "160.00")
        alloc = payment_service_with_financials.allocate_payment(
            payment_id=second_payment.id, invoice_id=created_invoice.id,
            amount=Decimal("160.00"), allocated_by=_STUB_USER_ID_FIXTURE(),
        )
        assert alloc.allocated_amount == Decimal("160.00")


# ======================================================================
# Mutation responses carry read-time financials (no stale zeros)
# ======================================================================

class TestMutationResponseFinancials:
    def test_issue_response_carries_financials(self, invoice_service_with_financials):
        """The issue_invoice RETURN value must carry real financials."""
        from tests.modules.billing.conftest import (
            _STUB_USER_INT_ID,
            _STUB_PATIENT_ID,
        )
        draft = invoice_service_with_financials.create_invoice(
            patient_id=_STUB_PATIENT_ID,
            invoice_number="FIN-MUT-ISSUE",
            currency_code="USD",
            items=[
                {"description": "Scaling", "quantity": 1, "unit_price": Decimal("1200.00")},
            ],
            created_by=_STUB_USER_INT_ID,
        )
        issued = invoice_service_with_financials.issue_invoice(
            draft.id, issued_by=_STUB_USER_INT_ID
        )
        read = InvoiceMapper.to_read(issued)
        assert read.financials.grand_total == Decimal("1200.00")
        assert read.financials.paid_amount == Decimal("0.00")
        assert read.financials.outstanding_amount == Decimal("1200.00")

    def test_cancel_from_partially_paid_response_carries_financials(
        self, created_invoice, invoice_service_with_financials, payment_service_with_financials
    ):
        """Cancelling an invoice with 500.00 already allocated must return the
        real paid/outstanding on the mutation response.

        Regression guard for the mapper's getattr fallback: without the
        service attaching financials to mutation returns, the cancel response
        would emit paid=0.00 / outstanding=grand_total even though 500.00 was
        already allocated (stale zeros on a financial response).
        """
        from tests.modules.billing.conftest import _STUB_USER_INT_ID

        payment = _make_payment(payment_service_with_financials, "500.00")
        payment_service_with_financials.allocate_payment(
            payment_id=payment.id,
            invoice_id=created_invoice.id,
            amount=Decimal("500.00"),
            allocated_by=_STUB_USER_ID_FIXTURE(),
        )

        cancelled = invoice_service_with_financials.cancel_invoice(
            created_invoice.id,
            cancellation_reason="Patient cancelled treatment",
            cancelled_by=_STUB_USER_INT_ID,
        )
        read = InvoiceMapper.to_read(cancelled)
        assert read.status == InvoiceStatus.CANCELLED
        assert read.financials.grand_total == Decimal("1500.00")
        assert read.financials.paid_amount == Decimal("500.00")
        assert read.financials.outstanding_amount == Decimal("1000.00")


def _STUB_USER_ID_FIXTURE() -> int:
    from tests.modules.billing.conftest import _STUB_USER_INT_ID
    return _STUB_USER_INT_ID
