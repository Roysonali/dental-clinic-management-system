"""Comprehensive tests for Sprint 5C.6 — CreditNoteService.

Covers:
- Credit note creation (success, invalid invoice, invalid amount, invalid reason)
- Credit note issuing (success, invalid transition)
- Credit note voiding (success, missing reason, invalid transitions)
- Credit note applying (success, not applicable, already applied)
- Full lifecycle (create → issue → apply)
- Audit trail verification
- Rollback on failure
- Edge cases (expired credit note, duplicate operations)
- Status transition guards
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.billing.enums import AuditAction, CreditNoteStatus
from app.modules.billing.exceptions import (
    BillingFinancialError,
    BillingValidationError,
    CreditNoteCreationFailed,
    CreditNoteNotFound,
    CreditNoteNotApplicable,
    CreditNoteValidationFailed,
    InvalidCreditNoteStatusTransition,
    InvoiceNotFound,
    NegativeAmountNotAllowed,
)
from app.modules.billing.models import BillingAuditLog, CreditNote


# ======================================================================
# Constants
# ======================================================================

_STUB_PATIENT_ID = UUID("00000000-0000-0000-0000-000000000001")
_STUB_USER_ID = UUID("00000000-0000-0000-0000-000000000000")


# ======================================================================
# create_credit_note
# ======================================================================

class TestCreateCreditNote:
    """Tests for CreditNoteService.create_credit_note()."""

    def test_create_credit_note_success(self, credit_note_service, invoice_with_items):
        """Successfully create a credit note for an issued invoice."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Billing adjustment - overcharge",
            created_by=_STUB_USER_ID,
        )

        assert credit_note.id is not None
        assert credit_note.invoice_id == invoice_with_items.id
        assert credit_note.patient_id == _STUB_PATIENT_ID
        assert credit_note.amount == Decimal("100.00")
        assert credit_note.remaining_balance == Decimal("100.00")
        assert credit_note.reason == "Billing adjustment - overcharge"
        assert credit_note.status == CreditNoteStatus.DRAFT
        assert credit_note.credit_note_number is not None
        assert credit_note.credit_note_number.startswith("CN-")

    def test_create_credit_note_with_expiry_date(self, credit_note_service, invoice_with_items):
        """Successfully create a credit note with an expiry date."""
        future_date = date.today() + timedelta(days=90)
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Credit with expiry",
            created_by=_STUB_USER_ID,
            expiry_date=future_date,
        )

        assert credit_note.expiry_date == future_date
        assert credit_note.status == CreditNoteStatus.DRAFT

    def test_create_credit_note_invoice_not_found(self, credit_note_service):
        """Creating a credit note for a non-existent invoice raises."""
        with pytest.raises(InvoiceNotFound):
            credit_note_service.create_credit_note(
                invoice_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("100.00"),
                reason="Test",
                created_by=_STUB_USER_ID,
            )

    def test_create_credit_note_negative_amount(self, credit_note_service, invoice_with_items):
        """Creating a credit note with a negative amount raises."""
        with pytest.raises(NegativeAmountNotAllowed):
            credit_note_service.create_credit_note(
                invoice_id=invoice_with_items.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("-50.00"),
                reason="Negative amount test",
                created_by=_STUB_USER_ID,
            )

    def test_create_credit_note_zero_amount(self, credit_note_service, invoice_with_items):
        """Creating a credit note with zero amount raises."""
        with pytest.raises(NegativeAmountNotAllowed):
            credit_note_service.create_credit_note(
                invoice_id=invoice_with_items.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("0.00"),
                reason="Zero amount test",
                created_by=_STUB_USER_ID,
            )

    def test_create_credit_note_empty_reason(self, credit_note_service, invoice_with_items):
        """Creating a credit note without a reason raises."""
        with pytest.raises(CreditNoteValidationFailed):
            credit_note_service.create_credit_note(
                invoice_id=invoice_with_items.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("50.00"),
                reason="",
                created_by=_STUB_USER_ID,
            )

    def test_create_credit_note_whitespace_reason(self, credit_note_service, invoice_with_items):
        """Creating a credit note with whitespace-only reason raises."""
        with pytest.raises(CreditNoteValidationFailed):
            credit_note_service.create_credit_note(
                invoice_id=invoice_with_items.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("50.00"),
                reason="   ",
                created_by=_STUB_USER_ID,
            )

    def test_create_credit_note_numbering(self, credit_note_service, invoice_with_items):
        """Credit note numbers are sequential and use the CN- prefix."""
        cn1 = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("10.00"),
            reason="First",
            created_by=_STUB_USER_ID,
        )
        assert cn1.credit_note_number == "CN-00001"

        cn2 = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("10.00"),
            reason="Second",
            created_by=_STUB_USER_ID,
        )
        assert cn2.credit_note_number == "CN-00002"
        assert cn1.credit_note_number != cn2.credit_note_number

    def test_create_credit_note_creates_audit(self, credit_note_service, invoice_with_items):
        """Creating a credit note creates an audit entry."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("75.00"),
            reason="Audit test",
            created_by=_STUB_USER_ID,
        )

        audit = (
            credit_note_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "credit_note",
                BillingAuditLog.entity_id == credit_note.id,
                BillingAuditLog.action == AuditAction.CREATED.value,
            )
            .first()
        )
        assert audit is not None
        assert audit.changed_by == _STUB_USER_ID
        assert audit.new_value is not None
        assert audit.new_value["credit_note_number"] == credit_note.credit_note_number
        assert audit.new_value["status"] == CreditNoteStatus.DRAFT.value

    def test_create_credit_note_rollback_on_failure(self, credit_note_service, invoice_with_items):
        """Credit note creation rolls back on validation failure."""
        initial_count = credit_note_service._db.query(CreditNote).count()

        try:
            credit_note_service.create_credit_note(
                invoice_id=invoice_with_items.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("50.00"),
                reason="",
                created_by=_STUB_USER_ID,
            )
        except CreditNoteValidationFailed:
            pass

        final_count = credit_note_service._db.query(CreditNote).count()
        assert final_count == initial_count

    def test_create_credit_note_exceeds_grand_total(self, credit_note_service, invoice_with_items):
        """Creating a credit note exceeding invoice grand total raises (BR-91)."""
        with pytest.raises(BillingFinancialError):
            credit_note_service.create_credit_note(
                invoice_id=invoice_with_items.id,
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("999999.99"),
                reason="Exceeds grand total",
                created_by=_STUB_USER_ID,
            )

    def test_create_credit_note_equals_grand_total(self, credit_note_service, invoice_with_items):
        """Creating a credit note exactly equal to invoice grand total succeeds."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("200.00"),
            reason="Equals grand total",
            created_by=_STUB_USER_ID,
        )
        assert credit_note.amount == Decimal("200.00")
        assert credit_note.status == CreditNoteStatus.DRAFT


# ======================================================================
# issue_credit_note
# ======================================================================

class TestIssueCreditNote:
    """Tests for CreditNoteService.issue_credit_note()."""

    def test_issue_credit_note_success(self, credit_note_service, invoice_with_items):
        """Successfully issue a credit note (DRAFT → ISSUED)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Test credit note",
            created_by=_STUB_USER_ID,
        )

        issued = credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        assert issued.status == CreditNoteStatus.ISSUED
        assert issued.issue_date is not None

    def test_issue_credit_note_sets_issue_date(self, credit_note_service, invoice_with_items):
        """Issuing a credit note sets the issue date to today."""
        today = date.today()
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Test issue date",
            created_by=_STUB_USER_ID,
        )

        issued = credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        assert issued.issue_date == today

    def test_issue_credit_note_not_found(self, credit_note_service):
        """Issuing a non-existent credit note raises."""
        with pytest.raises(CreditNoteNotFound):
            credit_note_service.issue_credit_note(
                credit_note_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                issued_by=_STUB_USER_ID,
            )

    def test_issue_already_issued_credit_note(self, credit_note_service, invoice_with_items):
        """Issuing an already issued credit note raises (DRAFT → ISSUED only)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Double issue test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.issue_credit_note(
                credit_note_id=credit_note.id,
                issued_by=_STUB_USER_ID,
            )

    def test_issue_voided_credit_note(self, credit_note_service, invoice_with_items):
        """Issuing a voided credit note raises."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Void then issue test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="No longer needed",
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.issue_credit_note(
                credit_note_id=credit_note.id,
                issued_by=_STUB_USER_ID,
            )

    def test_issue_credit_note_creates_audit(self, credit_note_service, invoice_with_items):
        """Issuing a credit note creates an audit entry."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Audit test",
            created_by=_STUB_USER_ID,
        )

        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        audit = (
            credit_note_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "credit_note",
                BillingAuditLog.entity_id == credit_note.id,
                BillingAuditLog.action == AuditAction.ISSUED.value,
            )
            .first()
        )
        assert audit is not None
        assert audit.new_value is not None
        assert audit.new_value["status"] == CreditNoteStatus.ISSUED.value

    def test_issue_credit_note_rollback_on_db_error(self, credit_note_service, invoice_with_items, db):
        """Issuing a credit note rolls back on database error."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Rollback test",
            created_by=_STUB_USER_ID,
        )

        db.commit()

        initial_status = (
            db.query(CreditNote)
            .filter(CreditNote.id == credit_note.id)
            .first()
            .status
        )

        with patch.object(credit_note_service, '_commit', side_effect=IntegrityError("mock", "mock", "mock")):
            with pytest.raises(CreditNoteCreationFailed):
                credit_note_service.issue_credit_note(
                    credit_note_id=credit_note.id,
                    issued_by=_STUB_USER_ID,
                )

        db.rollback()

        final_credit_note = db.query(CreditNote).filter(CreditNote.id == credit_note.id).first()
        assert final_credit_note is not None
        assert final_credit_note.status == initial_status


# ======================================================================
# void_credit_note
# ======================================================================

class TestVoidCreditNote:
    """Tests for CreditNoteService.void_credit_note()."""

    def test_void_draft_credit_note(self, credit_note_service, invoice_with_items):
        """Successfully void a draft credit note (DRAFT → VOID)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Test void draft",
            created_by=_STUB_USER_ID,
        )

        voided = credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Credit note no longer required",
        )

        assert voided.status == CreditNoteStatus.VOID
        assert voided.void_reason == "Credit note no longer required"

    def test_void_issued_credit_note(self, credit_note_service, invoice_with_items):
        """Successfully void an issued credit note (ISSUED → VOID)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Test void issued",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        voided = credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Issued in error",
        )

        assert voided.status == CreditNoteStatus.VOID

    def test_void_credit_note_not_found(self, credit_note_service):
        """Voiding a non-existent credit note raises."""
        with pytest.raises(CreditNoteNotFound):
            credit_note_service.void_credit_note(
                credit_note_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                voided_by=_STUB_USER_ID,
                void_reason="Not found",
            )

    def test_void_credit_note_missing_reason(self, credit_note_service, invoice_with_items):
        """Voiding a credit note without a reason raises."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Test missing reason",
            created_by=_STUB_USER_ID,
        )

        with pytest.raises(CreditNoteValidationFailed):
            credit_note_service.void_credit_note(
                credit_note_id=credit_note.id,
                voided_by=_STUB_USER_ID,
                void_reason="",
            )

    def test_void_credit_note_whitespace_reason(self, credit_note_service, invoice_with_items):
        """Voiding a credit note with whitespace-only reason raises."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Test whitespace reason",
            created_by=_STUB_USER_ID,
        )

        with pytest.raises(CreditNoteValidationFailed):
            credit_note_service.void_credit_note(
                credit_note_id=credit_note.id,
                voided_by=_STUB_USER_ID,
                void_reason="   ",
            )

    def test_void_applied_credit_note(self, credit_note_service, invoice_with_items):
        """Voiding an already applied credit note raises (terminal state)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Already applied",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.void_credit_note(
                credit_note_id=credit_note.id,
                voided_by=_STUB_USER_ID,
                void_reason="Cannot void applied",
            )

    def test_void_already_voided_credit_note(self, credit_note_service, invoice_with_items):
        """Voiding an already voided credit note raises (terminal state)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Already voided",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="First void",
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.void_credit_note(
                credit_note_id=credit_note.id,
                voided_by=_STUB_USER_ID,
                void_reason="Second void",
            )

    def test_void_credit_note_creates_audit(self, credit_note_service, invoice_with_items):
        """Voiding a credit note creates an audit entry."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Audit void test",
            created_by=_STUB_USER_ID,
        )

        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Policy change",
        )

        audit = (
            credit_note_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "credit_note",
                BillingAuditLog.entity_id == credit_note.id,
                BillingAuditLog.action == AuditAction.VOIDED.value,
            )
            .first()
        )
        assert audit is not None
        assert audit.new_value is not None
        assert audit.new_value["status"] == CreditNoteStatus.VOID.value
        assert audit.new_value["void_reason"] == "Policy change"


# ======================================================================
# apply_credit_note
# ======================================================================

class TestApplyCreditNote:
    """Tests for CreditNoteService.apply_credit_note()."""

    def test_apply_credit_note_success(self, credit_note_service, invoice_with_items):
        """Successfully apply an issued credit note (ISSUED → APPLIED)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Test apply",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        applied = credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        assert applied.status == CreditNoteStatus.APPLIED
        assert applied.remaining_balance == Decimal("0.00")

    def test_apply_draft_credit_note(self, credit_note_service, invoice_with_items):
        """Applying a draft credit note raises (must be ISSUED)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Draft apply test",
            created_by=_STUB_USER_ID,
        )

        with pytest.raises(CreditNoteNotApplicable):
            credit_note_service.apply_credit_note(
                credit_note_id=credit_note.id,
                applied_by=_STUB_USER_ID,
            )

    def test_apply_already_applied_credit_note(self, credit_note_service, invoice_with_items):
        """Applying an already applied credit note raises (terminal state)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Already applied",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        with pytest.raises(CreditNoteNotApplicable):
            credit_note_service.apply_credit_note(
                credit_note_id=credit_note.id,
                applied_by=_STUB_USER_ID,
            )

    def test_apply_voided_credit_note(self, credit_note_service, invoice_with_items):
        """Applying a voided credit note raises (not ISSUED)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Voided",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="No longer needed",
        )

        with pytest.raises(CreditNoteNotApplicable):
            credit_note_service.apply_credit_note(
                credit_note_id=credit_note.id,
                applied_by=_STUB_USER_ID,
            )

    def test_apply_expired_credit_note(self, credit_note_service, invoice_with_items):
        """Applying an expired credit note raises."""
        yesterday = date.today() - timedelta(days=1)
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Expired test",
            created_by=_STUB_USER_ID,
            expiry_date=yesterday,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        with pytest.raises(CreditNoteNotApplicable):
            credit_note_service.apply_credit_note(
                credit_note_id=credit_note.id,
                applied_by=_STUB_USER_ID,
            )

    def test_apply_credit_note_not_found(self, credit_note_service):
        """Applying a non-existent credit note raises."""
        with pytest.raises(CreditNoteNotFound):
            credit_note_service.apply_credit_note(
                credit_note_id=UUID("00000000-0000-0000-0000-ffffffffffff"),
                applied_by=_STUB_USER_ID,
            )

    def test_apply_credit_note_creates_audit(self, credit_note_service, invoice_with_items):
        """Applying a credit note creates an audit entry."""

        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Audit apply test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        audit = (
            credit_note_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "credit_note",
                BillingAuditLog.entity_id == credit_note.id,
                BillingAuditLog.action == AuditAction.CREDIT_APPLIED.value,
            )
            .first()
        )
        assert audit is not None
        assert audit.new_value is not None
        assert audit.new_value["status"] == CreditNoteStatus.APPLIED.value
        assert audit.new_value["remaining_balance"] == "0.00"


# ======================================================================
# Full lifecycle
# ======================================================================

class TestCreditNoteLifecycle:
    """Tests for the full credit note lifecycle."""

    def test_full_lifecycle_create_issue_apply(self, credit_note_service, invoice_with_items):
        """A credit note can go through the full lifecycle: DRAFT → ISSUED → APPLIED."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Full lifecycle test",
            created_by=_STUB_USER_ID,
        )
        assert credit_note.status == CreditNoteStatus.DRAFT

        credit_note = credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        assert credit_note.status == CreditNoteStatus.ISSUED

        credit_note = credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )
        assert credit_note.status == CreditNoteStatus.APPLIED
        assert credit_note.remaining_balance == Decimal("0.00")

    def test_lifecycle_create_void_from_draft(self, credit_note_service, invoice_with_items):
        """A draft credit note can be voided."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Void from draft test",
            created_by=_STUB_USER_ID,
        )
        assert credit_note.status == CreditNoteStatus.DRAFT

        credit_note = credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Cancelled by customer",
        )
        assert credit_note.status == CreditNoteStatus.VOID

    def test_lifecycle_create_issue_void(self, credit_note_service, invoice_with_items):
        """An issued credit note can be voided."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Issue then void test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        credit_note = credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Issued in error",
        )
        assert credit_note.status == CreditNoteStatus.VOID

    def test_cannot_issue_after_apply(self, credit_note_service, invoice_with_items):
        """An applied credit note cannot be issued again."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            reason="Cannot re-issue test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.issue_credit_note(
                credit_note_id=credit_note.id,
                issued_by=_STUB_USER_ID,
            )

    def test_audit_trail_contains_all_events(self, credit_note_service, invoice_with_items):
        """The audit trail contains all lifecycle events in order."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("200.00"),
            reason="Audit trail test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        audits = (
            credit_note_service._db.query(BillingAuditLog)
            .filter(
                BillingAuditLog.entity_type == "credit_note",
                BillingAuditLog.entity_id == credit_note.id,
            )
            .order_by(BillingAuditLog.changed_at)
            .all()
        )

        assert len(audits) == 3
        actions = [a.action for a in audits]
        assert actions == [
            AuditAction.CREATED.value,
            AuditAction.ISSUED.value,
            AuditAction.CREDIT_APPLIED.value,
        ]


# ======================================================================
# Status transition guards
# ======================================================================

class TestStatusTransitions:
    """Tests for credit note status transition guards."""

    def test_draft_can_go_to_issued(self, credit_note_service, invoice_with_items):
        """DRAFT → ISSUED is allowed."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Transition test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        assert credit_note.status == CreditNoteStatus.ISSUED

    def test_draft_can_go_to_void(self, credit_note_service, invoice_with_items):
        """DRAFT → VOID is allowed."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Draft void test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Draft cancelled",
        )
        assert credit_note.status == CreditNoteStatus.VOID

    def test_issued_can_go_to_applied(self, credit_note_service, invoice_with_items):
        """ISSUED → APPLIED is allowed."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Issue apply test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )
        assert credit_note.status == CreditNoteStatus.APPLIED

    def test_issued_can_go_to_void(self, credit_note_service, invoice_with_items):
        """ISSUED → VOID is allowed."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Issue void test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Issued in error",
        )
        assert credit_note.status == CreditNoteStatus.VOID

    def test_applied_is_terminal(self, credit_note_service, invoice_with_items):
        """APPLIED → anything raises (terminal state)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Terminal test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        # Try issuing
        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.issue_credit_note(
                credit_note_id=credit_note.id,
                issued_by=_STUB_USER_ID,
            )

    def test_void_is_terminal(self, credit_note_service, invoice_with_items):
        """VOID → anything raises (terminal state)."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Terminal void test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="Cancelled",
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.issue_credit_note(
                credit_note_id=credit_note.id,
                issued_by=_STUB_USER_ID,
            )


# ======================================================================
# Duplicate operations
# ======================================================================

class TestDuplicateOperations:
    """Tests for guarding against duplicate operations."""

    def test_duplicate_issue(self, credit_note_service, invoice_with_items):
        """Issuing the same credit note twice raises."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Duplicate issue test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.issue_credit_note(
                credit_note_id=credit_note.id,
                issued_by=_STUB_USER_ID,
            )

    def test_duplicate_apply(self, credit_note_service, invoice_with_items):
        """Applying the same credit note twice raises."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Duplicate apply test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        with pytest.raises(CreditNoteNotApplicable):
            credit_note_service.apply_credit_note(
                credit_note_id=credit_note.id,
                applied_by=_STUB_USER_ID,
            )

    def test_duplicate_void(self, credit_note_service, invoice_with_items):
        """Voiding the same credit note twice raises."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="Duplicate void test",
            created_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=credit_note.id,
            voided_by=_STUB_USER_ID,
            void_reason="First void",
        )

        with pytest.raises(InvalidCreditNoteStatusTransition):
            credit_note_service.void_credit_note(
                credit_note_id=credit_note.id,
                voided_by=_STUB_USER_ID,
                void_reason="Second void",
            )


# ======================================================================
# Edge cases
# ======================================================================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_large_amount(self, credit_note_service, invoice_with_items):
        """A credit note with a large valid amount is accepted."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("150.00"),
            reason="Large amount test",
            created_by=_STUB_USER_ID,
        )
        assert credit_note.amount == Decimal("150.00")

    def test_long_reason_accepted(self, credit_note_service, invoice_with_items):
        """A long but valid reason is accepted."""
        long_reason = "Credit note issued due to overcharge on " * 10  # 400 chars
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("25.00"),
            reason=long_reason[:490],  # Under 500 char limit
            created_by=_STUB_USER_ID,
        )
        assert credit_note.reason is not None
        assert len(credit_note.reason) > 0

    def test_multiple_credit_notes_same_invoice(self, credit_note_service, invoice_with_items):
        """Multiple credit notes can be created for the same invoice."""
        cn1 = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="First credit note",
            created_by=_STUB_USER_ID,
        )
        cn2 = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("75.00"),
            reason="Second credit note",
            created_by=_STUB_USER_ID,
        )

        assert cn1.id != cn2.id
        assert cn1.credit_note_number != cn2.credit_note_number

    def test_remaining_balance_tracked_after_apply(self, credit_note_service, invoice_with_items):
        """Remaining balance is properly tracked after applying a credit note."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("150.00"),
            reason="Balance tracking test",
            created_by=_STUB_USER_ID,
        )
        assert credit_note.remaining_balance == Decimal("150.00")

        credit_note_service.issue_credit_note(
            credit_note_id=credit_note.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.apply_credit_note(
            credit_note_id=credit_note.id,
            applied_by=_STUB_USER_ID,
        )

        from app.modules.billing.models import CreditNote
        db_credit_note = (
            credit_note_service._db.query(CreditNote)
            .filter(CreditNote.id == credit_note.id)
            .first()
        )
        assert db_credit_note.remaining_balance == Decimal("0.00")

    def test_sequential_numbering_across_operations(self, credit_note_service, invoice_with_items):
        """Sequential numbering works correctly."""
        cn1 = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("10.00"),
            reason="First",
            created_by=_STUB_USER_ID,
        )
        # Issue then void so number is consumed
        credit_note_service.issue_credit_note(
            credit_note_id=cn1.id,
            issued_by=_STUB_USER_ID,
        )
        credit_note_service.void_credit_note(
            credit_note_id=cn1.id,
            voided_by=_STUB_USER_ID,
            void_reason="Cancelled",
        )

        cn2 = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("20.00"),
            reason="Second",
            created_by=_STUB_USER_ID,
        )
        assert cn2.credit_note_number == "CN-00002"

    def test_reason_stripped(self, credit_note_service, invoice_with_items):
        """Reason is stripped of leading/trailing whitespace."""
        credit_note = credit_note_service.create_credit_note(
            invoice_id=invoice_with_items.id,
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            reason="  Overcharge correction  ",
            created_by=_STUB_USER_ID,
        )
        assert credit_note.reason == "Overcharge correction"
        assert "  " not in credit_note.reason
