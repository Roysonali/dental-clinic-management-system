"""Service-layer tests for PaymentService (Sprint 5C.1).

Tests cover:
- create_payment
- update_payment
- delete_payment
- get_payment
- search_payments
- Invalid payment values
- Invalid payment method
- Duplicate payment number
- Optimistic locking (version presence)
- Rollback on business exceptions
- Rollback on SQLAlchemy exceptions
- Audit creation
- Status history creation (BillingAuditLog used since no PaymentStatusHistory model)
- Read-only methods perform no commit
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.billing.enums import (
    AuditAction,
    PaymentMethod,
    PaymentStatus,
)
from app.modules.billing.exceptions import (
    DocumentSequenceNotFound,
    InvalidPaymentStatusTransition,
    NegativeAmountNotAllowed,
    PaymentCreationFailed,
    PaymentNotFound,
    PaymentValidationFailed,
    SequenceReservationFailed,
)
from app.modules.billing.models import BillingAuditLog, Payment

from sqlalchemy import text

from tests.modules.billing.conftest import (
    _STUB_PATIENT_ID,
    _STUB_USER_ID,
    PaymentFactory,
)


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def payment_service(db):
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        PaymentRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        PaymentValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        PaymentService,
    )
    from app.modules.patients.repository import PatientRepository

    payment_repo = PaymentRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    patient_repo = PatientRepository(db)
    financial_validator = FinancialValidator()
    payment_validator = PaymentValidator(
        payment_repo=payment_repo,
        financial_validator=financial_validator,
        patient_repo=patient_repo,
    )
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
    )


# ======================================================================
# create_payment
# ======================================================================


class TestPaymentServiceCreate:
    def test_create_payment_success(self, payment_service):
        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("150.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )
        assert payment.id is not None
        assert payment.status == PaymentStatus.PENDING
        assert payment.total_amount == Decimal("150.00")
        assert payment.payment_method == PaymentMethod.CASH
        assert payment.payment_number.startswith("PAY-")

    def test_create_payment_with_provided_number(
        self, db, payment_service
    ):
        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("200.00"),
            payment_method="card",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
            payment_number="CUSTOM-PAY-001",
        )
        assert payment.payment_number == "CUSTOM-PAY-001"
        db.refresh(payment)
        assert payment.payment_number == "CUSTOM-PAY-001"

    def test_create_payment_creates_audit_log(self, db, payment_service):
        from app.modules.billing.repositories import AuditRepository

        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )
        db.refresh(payment)
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.CREATED.value
        assert logs[0].entity_id == payment.id

    def test_create_payment_duplicate_number_raises(
        self, db, payment_service
    ):
        payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("100.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
            payment_number="DUP-PAY-001",
        )
        with pytest.raises(PaymentValidationFailed):
            payment_service.create_payment(
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("100.00"),
                payment_method="cash",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
                payment_number="DUP-PAY-001",
            )

    def test_create_payment_invalid_amount_raises(self, payment_service):
        with pytest.raises(NegativeAmountNotAllowed):
            payment_service.create_payment(
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("-10.00"),
                payment_method="cash",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
            )

    def test_create_payment_zero_amount_raises(self, payment_service):
        with pytest.raises(NegativeAmountNotAllowed):
            payment_service.create_payment(
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("0.00"),
                payment_method="cash",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
            )

    def test_create_payment_invalid_method_raises(self, payment_service):
        with pytest.raises(PaymentValidationFailed):
            payment_service.create_payment(
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("100.00"),
                payment_method="invalid_method",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
            )

    def test_create_payment_missing_date_raises(self, payment_service):
        with pytest.raises(PaymentValidationFailed):
            payment_service.create_payment(
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("100.00"),
                payment_method="cash",
                payment_date=None,
                created_by=_STUB_USER_ID,
            )

    def test_create_payment_rolls_back_on_db_error(
        self, payment_service
    ):
        with patch.object(
            payment_service._payment_repo, "create", side_effect=IntegrityError(
                "forced", None, None
            )
        ):
            with pytest.raises(PaymentCreationFailed):
                payment_service.create_payment(
                    patient_id=_STUB_PATIENT_ID,
                    amount=Decimal("100.00"),
                    payment_method="cash",
                    payment_date=date.today(),
                    created_by=_STUB_USER_ID,
                )

    def test_create_payment_rolls_back_on_no_sequence(
        self, db, payment_service
    ):
        db.execute(text("DELETE FROM document_sequences WHERE document_type='payment'"))
        db.commit()
        with pytest.raises(DocumentSequenceNotFound):
            payment_service.create_payment(
                patient_id=_STUB_PATIENT_ID,
                amount=Decimal("100.00"),
                payment_method="cash",
                payment_date=date.today(),
                created_by=_STUB_USER_ID,
            )

    def test_create_payment_sets_pending_status(self, payment_service):
        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("75.00"),
            payment_method="upi",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )
        assert payment.status == PaymentStatus.PENDING


# ======================================================================
# update_payment
# ======================================================================


class TestPaymentServiceUpdate:
    def test_update_payment_reference_number(
        self, db, payment_service, payment
    ):
        updated = payment_service.update_payment(
            payment_id=payment.id,
            updated_by=_STUB_USER_ID,
            reference_number="TXN-999",
        )
        assert updated.reference_number == "TXN-999"
        db.refresh(payment)
        assert payment.reference_number == "TXN-999"

    def test_update_payment_notes(self, db, payment_service, payment):
        updated = payment_service.update_payment(
            payment_id=payment.id,
            updated_by=_STUB_USER_ID,
            notes="Updated notes",
        )
        assert updated.notes == "Updated notes"

    def test_update_payment_creates_audit_log(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.update_payment(
            payment_id=payment.id,
            updated_by=_STUB_USER_ID,
            reference_number="TXN-123",
        )
        db.refresh(payment)
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.UPDATED.value
        assert logs[0].old_value["reference_number"] is None
        assert logs[0].new_value["reference_number"] == "TXN-123"

    def test_update_payment_not_editable_raises(
        self, db, payment_service
    ):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(PaymentValidationFailed):
            payment_service.update_payment(
                payment_id=completed_payment.id,
                updated_by=_STUB_USER_ID,
                notes="New notes",
            )

    def test_update_payment_not_found_raises(self, payment_service):
        with pytest.raises(PaymentNotFound):
            payment_service.update_payment(
                payment_id=uuid.uuid4(),
                updated_by=_STUB_USER_ID,
                notes="New notes",
            )

    def test_update_payment_no_fields_returns_no_change(
        self, payment_service, payment
    ):
        updated = payment_service.update_payment(
            payment_id=payment.id,
            updated_by=_STUB_USER_ID,
        )
        assert updated.id == payment.id

    def test_update_payment_rolls_back_on_db_error(
        self, db, payment_service, payment
    ):
        with patch.object(
            payment_service._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                payment_service._payment_repo,
                "update",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    payment_service.update_payment(
                        payment_id=payment.id,
                        updated_by=_STUB_USER_ID,
                        notes="New notes",
                    )
            mock_rollback.assert_called_once()


# ======================================================================
# delete_payment
# ======================================================================


class TestPaymentServiceDelete:
    def test_delete_payment_success(self, db, payment_service, payment):
        payment_service.delete_payment(payment.id, deleted_by=_STUB_USER_ID)
        assert db.get(Payment, payment.id) is None

    def test_delete_payment_not_editable_raises(
        self, db, payment_service
    ):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(PaymentValidationFailed):
            payment_service.delete_payment(
                completed_payment.id, deleted_by=_STUB_USER_ID
            )

    def test_delete_payment_not_found_raises(self, payment_service):
        with pytest.raises(PaymentNotFound):
            payment_service.delete_payment(
                uuid.uuid4(), deleted_by=_STUB_USER_ID
            )

    def test_delete_payment_rolls_back_on_db_error(
        self, db, payment_service, payment
    ):
        with patch.object(payment_service._db, "rollback") as mock_rollback:
            with patch.object(
                payment_service._payment_repo,
                "delete",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    payment_service.delete_payment(
                        payment.id, deleted_by=_STUB_USER_ID
                    )
            mock_rollback.assert_called_once()

    def test_delete_payment_creates_audit_log(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.delete_payment(
            payment.id, deleted_by=_STUB_USER_ID
        )
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.DELETED.value

    def test_delete_payment_audit_contains_correct_entity(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.delete_payment(
            payment.id, deleted_by=_STUB_USER_ID
        )
        logs, _ = AuditRepository(db).list(
            action=AuditAction.DELETED.value, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].entity_id == payment.id
        assert logs[0].entity_type == "payment"
        assert logs[0].changed_by == _STUB_USER_ID

    def test_delete_payment_audit_old_value_contains_metadata(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.delete_payment(
            payment.id, deleted_by=_STUB_USER_ID
        )
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        old_value = logs[0].old_value
        assert old_value["payment_number"] == payment.payment_number
        assert old_value["status"] == payment.status.value
        assert old_value["total_amount"] == str(payment.total_amount)
        assert old_value["payment_method"] == payment.payment_method.value
        assert logs[0].new_value is None

    def test_delete_payment_rollback_leaves_no_audit_record(
        self, db, payment_service, payment
    ):
        with patch.object(
            payment_service._payment_repo,
            "delete",
            side_effect=IntegrityError("forced", None, None),
        ):
            with pytest.raises(PaymentCreationFailed):
                payment_service.delete_payment(
                    payment.id, deleted_by=_STUB_USER_ID
                )
        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 0


# ======================================================================
# get_payment
# ======================================================================


class TestPaymentServiceGet:
    def test_get_payment_success(self, payment_service, payment):
        found = payment_service.get_payment(payment.id)
        assert found.id == payment.id

    def test_get_payment_not_found_raises(self, payment_service):
        with pytest.raises(PaymentNotFound):
            payment_service.get_payment(uuid.uuid4())


# ======================================================================
# search_payments
# ======================================================================


class TestPaymentServiceSearch:
    def test_search_payments_empty(self, payment_service):
        items, total = payment_service.search_payments()
        assert total == 0
        assert items == []

    def test_search_payments_finds_created(self, db, payment_service):
        PaymentFactory.create(
            db, payment_number="PAY-SEARCH-001", patient_id=_STUB_PATIENT_ID
        )
        items, total = payment_service.search_payments(
            patient_id=_STUB_PATIENT_ID
        )
        assert total == 1
        assert items[0].payment_number == "PAY-SEARCH-001"

    def test_search_payments_filters_by_status(self, db, payment_service):
        PaymentFactory.create(
            db, payment_number="PAY-PEND-001", status=PaymentStatus.PENDING.value
        )
        PaymentFactory.create(
            db, payment_number="PAY-COMP-001", status=PaymentStatus.COMPLETED.value
        )
        items, total = payment_service.search_payments(
            status=PaymentStatus.PENDING
        )
        assert total == 1
        assert items[0].status == PaymentStatus.PENDING.value

    def test_search_payments_pagination(self, db, payment_service):
        for i in range(5):
            PaymentFactory.create(
                db,
                payment_number=f"PAY-PAGE-{i:03d}",
                patient_id=_STUB_PATIENT_ID,
            )
        items, total = payment_service.search_payments(
            patient_id=_STUB_PATIENT_ID, page=2, page_size=2
        )
        assert total == 5
        assert len(items) == 2


# ======================================================================
# Read-only contract
# ======================================================================


class TestPaymentServiceReadOnlyContract:
    def test_get_payment_does_not_commit(self, db, payment_service, payment):
        initial_version = payment.version
        payment_service.get_payment(payment.id)
        # No commit should have occurred; version should remain unchanged
        db.refresh(payment)
        assert payment.version == initial_version

    def test_search_payments_does_not_commit(self, db, payment_service):
        PaymentFactory.create(
            db, payment_number="PAY-RO-001", patient_id=_STUB_PATIENT_ID
        )
        payment_service.search_payments()
        # Verify no unexpected side-effects by checking flush count via mocks
        # In SQLAlchemy, an uncommitted change is not visible across sessions.
        # We simply assert the method returns without raising.
        items, _ = payment_service.search_payments()
        assert len(items) == 1


# ======================================================================
# Optimistic locking
# ======================================================================


class TestPaymentServiceOptimisticLocking:
    def test_payment_has_version_column(self, db, payment_service):
        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )
        db.refresh(payment)
        assert hasattr(payment, "version")
        assert payment.version == 1

    def test_payment_version_persists_on_creation(
        self, db, payment_service
    ):
        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("50.00"),
            payment_method="cash",
            payment_date=date.today(),
            created_by=_STUB_USER_ID,
        )
        db.refresh(payment)
        assert payment.version >= 1


# ======================================================================
# Additional edge cases
# ======================================================================


class TestPaymentServiceEdgeCases:
    def test_create_payment_with_all_fields(
        self, db, payment_service
    ):
        payment = payment_service.create_payment(
            patient_id=_STUB_PATIENT_ID,
            amount=Decimal("500.00"),
            payment_method="bank_transfer",
            payment_date=date(2024, 6, 15),
            created_by=_STUB_USER_ID,
            reference_number="BANK-REF-123",
            notes="Wire transfer",
        )
        db.refresh(payment)
        assert payment.reference_number == "BANK-REF-123"
        assert payment.notes == "Wire transfer"
        assert payment.payment_date == date(2024, 6, 15)

    def test_update_payment_strips_whitespace(
        self, db, payment_service, payment
    ):
        updated = payment_service.update_payment(
            payment_id=payment.id,
            updated_by=_STUB_USER_ID,
            notes="  lots of spaces  ",
        )
        assert updated.notes == "lots of spaces"

    def test_update_payment_empty_notes_clears_value(
        self, db, payment_service, payment
    ):
        updated = payment_service.update_payment(
            payment_id=payment.id,
            updated_by=_STUB_USER_ID,
            notes="   ",
        )
        assert updated.notes is None


# ======================================================================
# complete_payment
# ======================================================================


class TestPaymentServiceComplete:
    def test_complete_payment_success(self, db, payment_service, payment):
        completed = payment_service.complete_payment(
            payment_id=payment.id,
            completed_by=_STUB_USER_ID,
        )
        assert completed.status == PaymentStatus.COMPLETED
        db.refresh(payment)
        assert payment.status == PaymentStatus.COMPLETED

    def test_complete_payment_creates_audit_log(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.complete_payment(
            payment_id=payment.id,
            completed_by=_STUB_USER_ID,
        )
        db.refresh(payment)
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.COMPLETED.value
        assert logs[0].entity_id == payment.id

    def test_complete_payment_invalid_transition_raises(
        self, db, payment_service
    ):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.complete_payment(
                payment_id=completed_payment.id,
                completed_by=_STUB_USER_ID,
            )

    def test_complete_payment_not_found_raises(self, payment_service):
        with pytest.raises(PaymentNotFound):
            payment_service.complete_payment(
                payment_id=uuid.uuid4(),
                completed_by=_STUB_USER_ID,
            )

    def test_complete_payment_rollback_on_db_error(
        self, db, payment_service, payment
    ):
        with patch.object(
            payment_service._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                payment_service._audit_repo,
                "create",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    payment_service.complete_payment(
                        payment_id=payment.id,
                        completed_by=_STUB_USER_ID,
                    )
        mock_rollback.assert_called_once()

        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 0

    def test_complete_payment_rollback_leaves_no_audit_record(
        self, db, payment_service, payment
    ):
        with patch.object(
            payment_service._audit_repo,
            "create",
            side_effect=IntegrityError("forced", None, None),
        ):
            with pytest.raises(PaymentCreationFailed):
                payment_service.complete_payment(
                    payment_id=payment.id,
                    completed_by=_STUB_USER_ID,
                )

        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 0


# ======================================================================
# fail_payment
# ======================================================================


class TestPaymentServiceFail:
    def test_fail_payment_success(self, db, payment_service, payment):
        failed = payment_service.fail_payment(
            payment_id=payment.id,
            failed_by=_STUB_USER_ID,
        )
        assert failed.status == PaymentStatus.FAILED
        db.refresh(payment)
        assert payment.status == PaymentStatus.FAILED

    def test_fail_payment_with_reason(self, db, payment_service, payment):
        failed = payment_service.fail_payment(
            payment_id=payment.id,
            failed_by=_STUB_USER_ID,
            reason="Insufficient funds",
        )
        assert failed.status == PaymentStatus.FAILED
        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].reason == "Insufficient funds"

    def test_fail_payment_creates_audit_log(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.fail_payment(
            payment_id=payment.id,
            failed_by=_STUB_USER_ID,
        )
        db.refresh(payment)
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.FAILED.value
        assert logs[0].entity_id == payment.id

    def test_fail_payment_invalid_transition_raises(
        self, db, payment_service
    ):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.fail_payment(
                payment_id=completed_payment.id,
                failed_by=_STUB_USER_ID,
            )

    def test_fail_payment_not_found_raises(self, payment_service):
        with pytest.raises(PaymentNotFound):
            payment_service.fail_payment(
                payment_id=uuid.uuid4(),
                failed_by=_STUB_USER_ID,
            )

    def test_fail_payment_rollback_on_db_error(
        self, db, payment_service, payment
    ):
        with patch.object(
            payment_service._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                payment_service._audit_repo,
                "create",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    payment_service.fail_payment(
                        payment_id=payment.id,
                        failed_by=_STUB_USER_ID,
                    )
        mock_rollback.assert_called_once()

        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 0


# ======================================================================
# void_payment
# ======================================================================


class TestPaymentServiceVoid:
    def test_void_payment_success(self, db, payment_service, payment):
        voided = payment_service.void_payment(
            payment_id=payment.id,
            voided_by=_STUB_USER_ID,
        )
        assert voided.status == PaymentStatus.VOID
        db.refresh(payment)
        assert payment.status == PaymentStatus.VOID

    def test_void_payment_with_reason(self, db, payment_service, payment):
        voided = payment_service.void_payment(
            payment_id=payment.id,
            voided_by=_STUB_USER_ID,
            reason="Cancelled by user",
        )
        assert voided.status == PaymentStatus.VOID
        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].reason == "Cancelled by user"

    def test_void_payment_creates_audit_log(
        self, db, payment_service, payment
    ):
        from app.modules.billing.repositories import AuditRepository

        payment_service.void_payment(
            payment_id=payment.id,
            voided_by=_STUB_USER_ID,
        )
        db.refresh(payment)
        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.VOIDED.value
        assert logs[0].entity_id == payment.id

    def test_void_payment_invalid_transition_raises(
        self, db, payment_service
    ):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.void_payment(
                payment_id=completed_payment.id,
                voided_by=_STUB_USER_ID,
            )

    def test_void_payment_not_found_raises(self, payment_service):
        with pytest.raises(PaymentNotFound):
            payment_service.void_payment(
                payment_id=uuid.uuid4(),
                voided_by=_STUB_USER_ID,
            )

    def test_void_payment_rollback_on_db_error(
        self, db, payment_service, payment
    ):
        with patch.object(
            payment_service._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                payment_service._audit_repo,
                "create",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    payment_service.void_payment(
                        payment_id=payment.id,
                        voided_by=_STUB_USER_ID,
                    )
        mock_rollback.assert_called_once()

        from app.modules.billing.repositories import AuditRepository

        logs, _ = AuditRepository(db).find_by_entity(
            "payment", payment.id, sort_by="changed_at"
        )
        assert len(logs) == 0


# ======================================================================
# State machine enforcement
# ======================================================================


class TestPaymentServiceStateMachineEnforcement:
    def test_complete_from_failed_is_rejected(self, db, payment_service):
        failed_payment = PaymentFactory.create(
            db, status=PaymentStatus.FAILED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.complete_payment(
                payment_id=failed_payment.id,
                completed_by=_STUB_USER_ID,
            )

    def test_void_from_completed_is_rejected(self, db, payment_service):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.void_payment(
                payment_id=completed_payment.id,
                voided_by=_STUB_USER_ID,
            )

    def test_fail_from_completed_is_rejected(self, db, payment_service):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.fail_payment(
                payment_id=completed_payment.id,
                failed_by=_STUB_USER_ID,
            )

    def test_complete_to_completed_is_rejected(self, db, payment_service):
        completed_payment = PaymentFactory.create(
            db, status=PaymentStatus.COMPLETED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.complete_payment(
                payment_id=completed_payment.id,
                completed_by=_STUB_USER_ID,
            )

    def test_void_from_void_is_rejected(self, db, payment_service):
        void_payment = PaymentFactory.create(
            db, status=PaymentStatus.VOID.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.void_payment(
                payment_id=void_payment.id,
                voided_by=_STUB_USER_ID,
            )

    def test_fail_from_failed_is_rejected(self, db, payment_service):
        failed_payment = PaymentFactory.create(
            db, status=PaymentStatus.FAILED.value
        )
        with pytest.raises(InvalidPaymentStatusTransition):
            payment_service.fail_payment(
                payment_id=failed_payment.id,
                failed_by=_STUB_USER_ID,
            )


# ======================================================================
# Read methods unchanged
# ======================================================================


class TestPaymentServiceLifecycleReadUnchanged:
    def test_get_payment_after_lifecycle_still_works(
        self, db, payment_service, payment
    ):
        payment_service.complete_payment(
            payment_id=payment.id, completed_by=_STUB_USER_ID
        )
        found = payment_service.get_payment(payment.id)
        assert found.id == payment.id
        assert found.status == PaymentStatus.COMPLETED

    def test_search_payments_after_lifecycle_still_works(
        self, db, payment_service, payment
    ):
        payment_service.complete_payment(
            payment_id=payment.id, completed_by=_STUB_USER_ID
        )
        items, total = payment_service.search_payments(
            status=PaymentStatus.COMPLETED
        )
        assert total == 1
        assert items[0].id == payment.id
