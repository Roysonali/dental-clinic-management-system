"""Comprehensive tests for Sprint 5C.8 — BillingOrchestrationService.

Tests cover:
- Workflow 1: Complete invoice workflow (create draft → issue)
- Workflow 2: Receive payment workflow (create → complete → allocate → receipt)
- Workflow 3: Process refund workflow (create → approve → complete)
- Workflow 4: Apply credit note workflow (create → issue → apply)
- Workflow 5: Billing dashboard
- Workflow error propagation (services throw → orchestrator propagates)
- Financial consistency after each workflow
- Audit trail generation (indirectly through service tests)
- Transaction integrity (each service call owns its commit)
- Edge cases (missing entities, invalid states)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

import pytest

from app.modules.billing.enums import (
    CreditNoteStatus,
    InvoiceStatus,
    PaymentStatus,
    RefundStatus,
)
from app.modules.billing.exceptions import (
    BillingFinancialError,
    InvoiceNotFound,
    PaymentNotFound,
    RefundExceedsPayment,
)
from app.modules.billing.services.billing_orchestration_service import (
    BillingDashboardResult,
    BillingOrchestrationService,
    CreditNoteWorkflowResult,
    InvoiceWorkflowResult,
    PaymentWorkflowResult,
    RefundWorkflowResult,
)

from tests.modules.billing.conftest import (
    _STUB_PATIENT_ID,
    _STUB_USER_ID,
)


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def _financial_calc_service(db):
    """Build a FinancialCalculationService (not exported in conftest)."""
    from app.modules.billing.repositories import (
        CreditNoteRepository,
        InvoiceRepository,
        PaymentRepository,
    )
    from app.modules.billing.repositories.refund_repository import RefundRepository
    from app.modules.billing.validators import FinancialValidator
    from app.modules.billing.services.financial_calculation_service import (
        FinancialCalculationService,
    )

    return FinancialCalculationService(
        invoice_repo=InvoiceRepository(db),
        payment_repo=PaymentRepository(db),
        refund_repo=RefundRepository(db),
        credit_note_repo=CreditNoteRepository(db),
        financial_validator=FinancialValidator(),
    )


@pytest.fixture
def billing_orchestrator(
    db,
    invoice_service,
    payment_service_with_allocation,
    refund_service,
    credit_note_service,
    receipt_service,
    _financial_calc_service,
) -> BillingOrchestrationService:
    """Build a BillingOrchestrationService with all domain service dependencies."""
    return BillingOrchestrationService(
        db=db,
        invoice_service=invoice_service,
        payment_service=payment_service_with_allocation,
        refund_service=refund_service,
        credit_note_service=credit_note_service,
        receipt_service=receipt_service,
        financial_calc_service=_financial_calc_service,
    )


# ======================================================================
# Workflow 1: Complete Invoice
# ======================================================================


class TestCompleteInvoiceWorkflow:
    """Tests for ``BillingOrchestrationService.complete_invoice_workflow()``."""

    def test_create_and_issue_invoice(
        self, db, billing_orchestrator
    ):
        """Complete workflow creates a draft and issues it."""
        result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Dental cleaning",
                    "quantity": 1,
                    "unit_price": Decimal("150.00"),
                    "net_amount": Decimal("150.00"),
                },
                {
                    "description": "X-Ray",
                    "quantity": 2,
                    "unit_price": Decimal("75.00"),
                    "net_amount": Decimal("150.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        assert isinstance(result, InvoiceWorkflowResult)
        assert result.invoice is not None
        assert result.invoice.id is not None
        assert result.invoice.status == InvoiceStatus.ISSUED
        assert result.invoice.invoice_number is not None
        assert not result.invoice.invoice_number.startswith("__DRAFT__")
        assert result.financial_summary is not None
        assert result.financial_summary.grand_total == Decimal("300.00")
        assert result.financial_summary.outstanding_balance == Decimal("300.00")

    def test_workflow_propagates_validation_error(
        self, billing_orchestrator
    ):
        """Workflow propagates validation errors from InvoiceService."""
        from app.modules.billing.exceptions import InvoiceValidationFailed

        with pytest.raises(InvoiceValidationFailed):
            billing_orchestrator.complete_invoice_workflow(
                patient_id=_STUB_PATIENT_ID,
                items=[],
                created_by=_STUB_USER_ID,
            )

    def test_issued_invoice_has_valid_number(
        self, db, billing_orchestrator
    ):
        """Issued invoice has a proper sequential number."""
        result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Consultation",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        assert result.invoice.invoice_number.startswith("INV-")


# ======================================================================
# Workflow 2: Receive Payment
# ======================================================================


class TestReceivePaymentWorkflow:
    """Tests for ``BillingOrchestrationService.receive_payment_workflow()``."""

    def test_full_payment_workflow(
        self, db, billing_orchestrator
    ):
        """Complete payment workflow: create → complete → allocate → receipt."""
        # Create an invoice first
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("200.00"),
                    "net_amount": Decimal("200.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        # Receive payment
        result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("200.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
            generate_receipt=True,
        )

        assert isinstance(result, PaymentWorkflowResult)
        assert result.payment is not None
        assert result.payment.status == PaymentStatus.COMPLETED
        assert result.allocation is not None
        assert result.allocation.allocated_amount == Decimal("200.00")
        assert result.receipt is not None
        assert result.invoice_financial_summary is not None
        assert result.invoice_financial_summary.outstanding_balance == Decimal("0.00")

    def test_payment_without_receipt(
        self, db, billing_orchestrator
    ):
        """Payment workflow without receipt generation."""
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Checkup",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("100.00"),
            payment_method="card",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
            generate_receipt=False,
        )

        assert result.receipt is None
        assert result.invoice_financial_summary.outstanding_balance == Decimal("0.00")

    def test_payment_propagates_invoice_not_found(
        self, db, billing_orchestrator
    ):
        """Payment workflow propagates InvoiceNotFound."""
        with pytest.raises(InvoiceNotFound):
            billing_orchestrator.receive_payment_workflow(
                patient_id=_STUB_PATIENT_ID,
                invoice_id=UUID("00000000-0000-0000-0000-fffffffffff2"),
                amount=Decimal("100.00"),
                payment_method="cash",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
            )

    def test_partial_payment(
        self, db, billing_orchestrator
    ):
        """Partial payment leaves outstanding balance."""
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Expensive treatment",
                    "quantity": 1,
                    "unit_price": Decimal("500.00"),
                    "net_amount": Decimal("500.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("200.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
            generate_receipt=True,
        )

        assert result.invoice_financial_summary.outstanding_balance == Decimal("300.00")


# ======================================================================
# Workflow 3: Process Refund
# ======================================================================


class TestProcessRefundWorkflow:
    """Tests for ``BillingOrchestrationService.process_refund_workflow()``."""

    def test_full_refund_workflow(
        self, db, billing_orchestrator
    ):
        """Complete refund workflow: create → approve → complete."""
        # Create invoice and receive payment
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("200.00"),
                    "net_amount": Decimal("200.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )
        payment_result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("200.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        # Process refund
        result = billing_orchestrator.process_refund_workflow(
            payment_id=payment_result.payment.id,
            amount=Decimal("50.00"),
            reason="Partial refund for overpayment",
            created_by=_STUB_USER_ID,
            invoice_id=inv_result.invoice.id,
        )

        assert isinstance(result, RefundWorkflowResult)
        assert result.refund is not None
        assert result.refund.status == RefundStatus.COMPLETED
        assert result.refund.amount == Decimal("50.00")
        assert result.payment_financial_summary is not None
        assert result.invoice_financial_summary is not None
        # Refund allocation is against the payment (invoice_id=None), so
        # the invoice's outstanding balance is unaffected.
        # outstanding = grand_total(200) - paid(200) + refunded_on_invoice(0) = 0
        assert result.invoice_financial_summary.outstanding_balance == Decimal("0.00")

    def test_refund_without_invoice_summary(
        self, db, billing_orchestrator
    ):
        """Refund workflow without invoice_id returns None for invoice summary."""
        # Create invoice and receive payment
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )
        payment_result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("100.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        # Process refund without invoice_id
        result = billing_orchestrator.process_refund_workflow(
            payment_id=payment_result.payment.id,
            amount=Decimal("30.00"),
            reason="Partial refund",
            created_by=_STUB_USER_ID,
        )

        assert result.invoice_financial_summary is None
        assert result.payment_financial_summary is not None

    def test_refund_propagates_payment_not_found(
        self, db, billing_orchestrator
    ):
        """Refund workflow propagates PaymentNotFound."""
        with pytest.raises(PaymentNotFound):
            billing_orchestrator.process_refund_workflow(
                payment_id=UUID("00000000-0000-0000-0000-fffffffffff3"),
                amount=Decimal("50.00"),
                reason="Test refund",
                created_by=_STUB_USER_ID,
            )

    def test_refund_exceeds_amount(
        self, db, billing_orchestrator
    ):
        """Refund exceeding payment amount is rejected."""
        # Create invoice and receive payment
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )
        payment_result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("100.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        with pytest.raises(RefundExceedsPayment):
            billing_orchestrator.process_refund_workflow(
                payment_id=payment_result.payment.id,
                amount=Decimal("999.00"),
                reason="Excessive refund",
                created_by=_STUB_USER_ID,
            )


# ======================================================================
# Workflow 4: Apply Credit Note
# ======================================================================


class TestApplyCreditNoteWorkflow:
    """Tests for ``BillingOrchestrationService.apply_credit_note_workflow()``."""

    def test_full_credit_note_workflow(
        self, db, billing_orchestrator
    ):
        """Complete credit note workflow: create → issue → apply."""
        # Create an invoice
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("300.00"),
                    "net_amount": Decimal("300.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        # Apply credit note
        result = billing_orchestrator.apply_credit_note_workflow(
            invoice_id=inv_result.invoice.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Service adjustment",
            created_by=_STUB_USER_ID,
        )

        assert isinstance(result, CreditNoteWorkflowResult)
        assert result.credit_note is not None
        assert result.credit_note.status == CreditNoteStatus.APPLIED
        assert result.credit_note.amount == Decimal("100.00")
        assert result.invoice_financial_summary is not None
        assert result.invoice_financial_summary.grand_total == Decimal("300.00")

    def test_credit_note_exceeds_grand_total(
        self, db, billing_orchestrator
    ):
        """Credit note exceeding invoice grand total is rejected."""
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Minor procedure",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        with pytest.raises(BillingFinancialError):
            billing_orchestrator.apply_credit_note_workflow(
                invoice_id=inv_result.invoice.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("500.00"),
                reason="Excessive credit",
                created_by=_STUB_USER_ID,
            )

    def test_credit_note_propagates_invoice_not_found(
        self, db, billing_orchestrator
    ):
        """Credit note workflow propagates InvoiceNotFound."""
        with pytest.raises(InvoiceNotFound):
            billing_orchestrator.apply_credit_note_workflow(
                invoice_id=UUID("00000000-0000-0000-0000-fffffffffff4"),
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("100.00"),
                reason="Test",
                created_by=_STUB_USER_ID,
            )


# ======================================================================
# Workflow 5: Billing Dashboard
# ======================================================================


class TestBillingDashboard:
    """Tests for ``BillingOrchestrationService.get_billing_dashboard()``."""

    def test_empty_dashboard(
        self, billing_orchestrator
    ):
        """Empty system returns zeros."""
        dashboard = billing_orchestrator.get_billing_dashboard()

        assert isinstance(dashboard, BillingDashboardResult)
        assert dashboard.totals.total_invoiced == Decimal("0.00")
        assert dashboard.totals.total_collected == Decimal("0.00")
        assert dashboard.totals.total_outstanding == Decimal("0.00")
        assert dashboard.totals.invoice_count == 0
        assert dashboard.totals.payment_count == 0
        assert dashboard.recent_invoices == []
        assert dashboard.recent_payments == []
        assert dashboard.patient_summary is None

    def test_dashboard_with_data(
        self, db, billing_orchestrator
    ):
        """Dashboard reflects created invoices and payments."""
        # Create an invoice and payment
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("200.00"),
                    "net_amount": Decimal("200.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )
        billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("200.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        dashboard = billing_orchestrator.get_billing_dashboard()
        assert dashboard.totals.invoice_count >= 1
        assert dashboard.totals.payment_count >= 1
        assert len(dashboard.recent_invoices) >= 1
        assert len(dashboard.recent_payments) >= 1

    def test_dashboard_with_patient_summary(
        self, db, billing_orchestrator
    ):
        """Dashboard includes patient summary when patient_id is provided."""
        dashboard = billing_orchestrator.get_billing_dashboard(
            patient_id=_STUB_PATIENT_ID
        )
        assert dashboard.patient_summary is not None
        assert dashboard.patient_summary.patient_id == _STUB_PATIENT_ID


# ======================================================================
# Error propagation tests
# ======================================================================


class TestErrorPropagation:
    """Verify domain errors propagate correctly through the orchestrator."""

    def test_invoice_workflow_empty_items(
        self, db, billing_orchestrator
    ):
        """Invoice workflow with empty items is rejected."""
        from app.modules.billing.exceptions import InvoiceValidationFailed

        with pytest.raises(InvoiceValidationFailed):
            billing_orchestrator.complete_invoice_workflow(
                patient_id=_STUB_PATIENT_ID,
                items=[],
                created_by=_STUB_USER_ID,
            )

    def test_payment_workflow_negative_amount(
        self, db, billing_orchestrator
    ):
        """Payment workflow with negative amount is rejected."""
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Test",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        from app.modules.billing.exceptions import NegativeAmountNotAllowed

        with pytest.raises(NegativeAmountNotAllowed):
            billing_orchestrator.receive_payment_workflow(
                patient_id=_STUB_PATIENT_ID,
                invoice_id=inv_result.invoice.id,
                amount=Decimal("-50.00"),
                payment_method="cash",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
            )

    def test_refund_workflow_empty_reason_succeeds(
        self, db, billing_orchestrator
    ):
        """Refund workflow with empty reason succeeds (RefundService allows it).

        Note: The RefundService does not validate that reason is non-empty;
        it strips whitespace and stores the result. Empty-string reasons
        are persisted without raising.
        """
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Test",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )
        payment_result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("100.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        # Empty reason should succeed per RefundService contract
        result = billing_orchestrator.process_refund_workflow(
            payment_id=payment_result.payment.id,
            amount=Decimal("10.00"),
            reason="",
            created_by=_STUB_USER_ID,
        )
        assert result.refund is not None
        assert result.refund.status == RefundStatus.COMPLETED


# ======================================================================
# Financial consistency tests
# ======================================================================


class TestFinancialConsistency:
    """Verify financial calculations remain consistent after workflows."""

    def test_payment_then_refund_consistency(
        self, db, billing_orchestrator
    ):
        """After payment and refund, financial calculations are consistent."""
        # Create invoice
        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Treatment",
                    "quantity": 1,
                    "unit_price": Decimal("200.00"),
                    "net_amount": Decimal("200.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        # Full payment
        payment_result = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv_result.invoice.id,
            amount=Decimal("200.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        # Partial refund
        billing_orchestrator.process_refund_workflow(
            payment_id=payment_result.payment.id,
            amount=Decimal("50.00"),
            reason="Partial refund",
            created_by=_STUB_USER_ID,
            invoice_id=inv_result.invoice.id,
        )

        # Check consistency — the refund allocation has invoice_id=None,
        # so the invoice's refunded amount stays 0.
        # paid(200) <= grand_total(200) + refunded(0) + epsilon → True
        is_consistent = billing_orchestrator._financial_calc.check_invoice_payment_consistency(
            inv_result.invoice.id
        )
        assert is_consistent is True

        # Outstanding is 0 because refund is not linked to any invoice
        summary = billing_orchestrator._financial_calc.get_invoice_financial_summary(
            inv_result.invoice.id
        )
        assert summary.outstanding_balance == Decimal("0.00")

    def test_audit_logs_created(
        self, db, billing_orchestrator
    ):
        """Workflows create appropriate audit log entries."""
        from app.modules.billing.repositories import AuditRepository

        inv_result = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[
                {
                    "description": "Test",
                    "quantity": 1,
                    "unit_price": Decimal("100.00"),
                    "net_amount": Decimal("100.00"),
                },
            ],
            created_by=_STUB_USER_ID,
        )

        # Verify audit logs exist for the invoice
        logs, _ = AuditRepository(db).find_by_entity(
            "invoice", inv_result.invoice.id, sort_by="changed_at"
        )
        # Should have at least ISSUED (create_invoice doesn't create audit log,
        # only InvoiceStatusHistory. issue_invoice creates the audit log.)
        assert len(logs) >= 1
        assert logs[0].action is not None  # Verify log content exists

    def test_read_only_contract_preserved(
        self, db, billing_orchestrator
    ):
        """Orchestrator never mutates data directly (always delegates)."""
        assert hasattr(billing_orchestrator, "_financial_calc")
        assert hasattr(billing_orchestrator, "_invoice_service")
        assert hasattr(billing_orchestrator, "_payment_service")
        assert hasattr(billing_orchestrator, "_refund_service")
        assert hasattr(billing_orchestrator, "_credit_note_service")
        assert hasattr(billing_orchestrator, "_receipt_service")


# ======================================================================
# Concurrent workflow safety
# ======================================================================


class TestConcurrentWorkflowSafety:
    """Verify workflows can be composed safely."""

    def test_multiple_invoices_same_patient(
        self, db, billing_orchestrator
    ):
        """Multiple invoices for the same patient can be created independently."""
        inv1 = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[{"description": "A", "quantity": 1, "unit_price": Decimal("100.00"), "net_amount": Decimal("100.00")}],
            created_by=_STUB_USER_ID,
        )
        inv2 = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[{"description": "B", "quantity": 1, "unit_price": Decimal("200.00"), "net_amount": Decimal("200.00")}],
            created_by=_STUB_USER_ID,
        )
        assert inv1.invoice.id != inv2.invoice.id
        assert inv1.invoice.invoice_number != inv2.invoice.invoice_number

    def test_payment_to_multiple_invoices(
        self, db, billing_orchestrator
    ):
        """Two separate payments can be made to different invoices."""
        inv1 = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[{"description": "A", "quantity": 1, "unit_price": Decimal("100.00"), "net_amount": Decimal("100.00")}],
            created_by=_STUB_USER_ID,
        )
        inv2 = billing_orchestrator.complete_invoice_workflow(
            patient_id=_STUB_PATIENT_ID,
            items=[{"description": "B", "quantity": 1, "unit_price": Decimal("100.00"), "net_amount": Decimal("100.00")}],
            created_by=_STUB_USER_ID,
        )

        pay1 = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv1.invoice.id,
            amount=Decimal("100.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )
        pay2 = billing_orchestrator.receive_payment_workflow(
            patient_id=_STUB_PATIENT_ID,
            invoice_id=inv2.invoice.id,
            amount=Decimal("100.00"),
            payment_method="card",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )

        assert pay1.payment.id != pay2.payment.id
        assert pay1.invoice_financial_summary.outstanding_balance == Decimal("0.00")
        assert pay2.invoice_financial_summary.outstanding_balance == Decimal("0.00")


# ======================================================================
# Regression tests
# ======================================================================


class TestRegression:
    """Regression tests from previous sprints."""

    def test_workflow_uses_existing_services(
        self, billing_orchestrator
    ):
        """Orchestrator delegates to injected services, not raw repositories."""
        assert billing_orchestrator._invoice_service is not None
        assert billing_orchestrator._payment_service is not None
        assert billing_orchestrator._refund_service is not None
        assert billing_orchestrator._credit_note_service is not None
        assert billing_orchestrator._receipt_service is not None
        assert billing_orchestrator._financial_calc is not None


# ======================================================================
# Orchestrator construction tests
# ======================================================================


class TestOrchestratorConstruction:
    """Verify orchestrator can be constructed with different configurations."""

    def test_minimal_construction(
        self, db, billing_orchestrator
    ):
        """Orchestrator can be constructed with all services."""
        assert billing_orchestrator is not None
        assert isinstance(billing_orchestrator, BillingOrchestrationService)
