"""Service-layer tests for ReceiptService (Sprint 5C.4).

Tests cover:
- generate_receipt: success, duplicate rejection, invalid payment state,
  rollback, audit creation, numbering
- get_receipt: success, not-found, read-only behavior
- regenerate_receipt: success, invalid receipt state, rollback, audit
- PrintableReceipt DTO construction
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.billing.enums import (
    AuditAction,
    PaymentStatus,
    ReceiptStatus,
)
from app.modules.billing.exceptions import (
    PaymentCreationFailed,
    PaymentNotFound,
    ReceiptNotFound,
    ReceiptValidationFailed,
)
from app.modules.billing.models import BillingAuditLog, Receipt
from app.modules.billing.services.receipt_service import PrintableReceipt

from tests.modules.billing.conftest import (
    _STUB_USER_ID,
    _STUB_PATIENT_ID,
    PaymentFactory,
)


# ======================================================================
# generate_receipt
# ======================================================================


class TestGenerateReceipt:
    """Tests for ReceiptService.generate_receipt()."""

    def test_generate_receipt_success(self, db, receipt_service, completed_payment):
        """Successful receipt generation for a completed payment."""
        receipt, printable = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )
        assert receipt.id is not None
        assert receipt.payment_id == completed_payment.id
        assert receipt.receipt_number.startswith("RCT-")
        assert receipt.amount == completed_payment.total_amount
        assert receipt.status == ReceiptStatus.GENERATED
        assert isinstance(printable, PrintableReceipt)
        assert printable.receipt_id == receipt.id
        assert printable.total_amount == receipt.amount

    def test_generate_receipt_creates_audit_log(
        self, db, receipt_service, completed_payment
    ):
        """Successful generation creates a BillingAuditLog entry."""
        from app.modules.billing.repositories import AuditRepository

        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        logs, _ = AuditRepository(db).find_by_entity(
            "receipt", receipt.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.CREATED.value
        assert logs[0].entity_id == receipt.id
        assert logs[0].new_value["receipt_number"] == receipt.receipt_number
        assert logs[0].new_value["amount"] == str(receipt.amount)

    def test_generate_receipt_duplicate_rejected(
        self, db, receipt_service, completed_payment
    ):
        """Generating a second receipt for the same payment is rejected."""
        receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        with pytest.raises(ReceiptValidationFailed):
            receipt_service.generate_receipt(
                payment_id=completed_payment.id,
                generated_by=_STUB_USER_ID,
            )

    def test_generate_receipt_pending_payment_rejected(
        self, db, receipt_service
    ):
        """Generating a receipt for a PENDING payment is rejected."""
        pending_payment = PaymentFactory.create(db, status=PaymentStatus.PENDING.value)

        with pytest.raises(ReceiptValidationFailed):
            receipt_service.generate_receipt(
                payment_id=pending_payment.id,
                generated_by=_STUB_USER_ID,
            )

    def test_generate_receipt_failed_payment_rejected(
        self, db, receipt_service
    ):
        """Generating a receipt for a FAILED payment is rejected."""
        failed_payment = PaymentFactory.create(db, status=PaymentStatus.FAILED.value)

        with pytest.raises(ReceiptValidationFailed):
            receipt_service.generate_receipt(
                payment_id=failed_payment.id,
                generated_by=_STUB_USER_ID,
            )

    def test_generate_receipt_void_payment_rejected(
        self, db, receipt_service
    ):
        """Generating a receipt for a VOID payment is rejected."""
        void_payment = PaymentFactory.create(db, status=PaymentStatus.VOID.value)

        with pytest.raises(ReceiptValidationFailed):
            receipt_service.generate_receipt(
                payment_id=void_payment.id,
                generated_by=_STUB_USER_ID,
            )

    def test_generate_receipt_payment_not_found(
        self, receipt_service
    ):
        """Generating a receipt for a non-existent payment is rejected."""
        with pytest.raises(PaymentNotFound):
            receipt_service.generate_receipt(
                payment_id=uuid.uuid4(),
                generated_by=_STUB_USER_ID,
            )

    def test_generate_receipt_rollback_on_db_error(
        self, db, receipt_service, completed_payment
    ):
        """DB error during generation triggers rollback."""
        with patch.object(
            receipt_service._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                receipt_service._receipt_repo,
                "create",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    receipt_service.generate_receipt(
                        payment_id=completed_payment.id,
                        generated_by=_STUB_USER_ID,
                    )
            mock_rollback.assert_called_once()

    def test_generate_receipt_rolls_back_on_validation_failure(
        self, db, receipt_service, completed_payment
    ):
        """Validation failure triggers rollback."""
        # First generate a receipt
        receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        with patch.object(
            receipt_service._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(ReceiptValidationFailed):
                receipt_service.generate_receipt(
                    payment_id=completed_payment.id,
                    generated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()

    def test_generate_receipt_generates_unique_number(
        self, db, receipt_service, completed_payment
    ):
        """Each generation produces a unique receipt number."""
        # Create another completed payment
        pay2 = PaymentFactory.create(db, status=PaymentStatus.COMPLETED.value,
                                      total_amount=Decimal("200.00"))

        receipt1, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )
        receipt2, _ = receipt_service.generate_receipt(
            payment_id=pay2.id,
            generated_by=_STUB_USER_ID,
        )

        assert receipt1.receipt_number != receipt2.receipt_number

    def test_generate_receipt_printable_contains_all_fields(
        self, db, receipt_service, completed_payment
    ):
        """PrintableReceipt DTO contains all expected fields."""
        _, printable = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )
        assert printable.receipt_id is not None
        assert printable.receipt_number is not None
        assert printable.receipt_date is not None
        assert printable.payment_id == completed_payment.id
        assert printable.payment_number == completed_payment.payment_number
        assert printable.payment_method == completed_payment.payment_method.value
        assert printable.patient_id == completed_payment.patient_id
        assert printable.total_amount == completed_payment.total_amount
        assert printable.status == ReceiptStatus.GENERATED.value
        assert printable.created_by == _STUB_USER_ID
        assert printable.created_at is not None


# ======================================================================
# get_receipt
# ======================================================================


class TestGetReceipt:
    """Tests for ReceiptService.get_receipt()."""

    def test_get_receipt_success(self, db, receipt_service, completed_payment):
        """Successful receipt retrieval."""
        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        found, printable = receipt_service.get_receipt(receipt.id)
        assert found.id == receipt.id
        assert found.receipt_number == receipt.receipt_number
        assert isinstance(printable, PrintableReceipt)
        assert printable.receipt_id == receipt.id

    def test_get_receipt_not_found(self, receipt_service):
        """Non-existent receipt raises ReceiptNotFound."""
        with pytest.raises(ReceiptNotFound):
            receipt_service.get_receipt(uuid.uuid4())

    def test_get_receipt_read_only(self, db, receipt_service, completed_payment):
        """get_receipt does not mutate state."""
        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )
        db.refresh(receipt)
        version_before = receipt.status

        receipt_service.get_receipt(receipt.id)

        db.refresh(receipt)
        assert receipt.status == version_before


# ======================================================================
# regenerate_receipt
# ======================================================================


class TestRegenerateReceipt:
    """Tests for ReceiptService.regenerate_receipt()."""

    def test_regenerate_receipt_success(
        self, db, receipt_service, completed_payment
    ):
        """Successful receipt regeneration."""
        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        regenerated, printable = receipt_service.regenerate_receipt(
            receipt_id=receipt.id,
            regenerated_by=_STUB_USER_ID,
        )
        assert regenerated.id == receipt.id
        assert regenerated.receipt_number == receipt.receipt_number
        assert regenerated.amount == receipt.amount
        assert isinstance(printable, PrintableReceipt)
        assert printable.receipt_id == receipt.id

    def test_regenerate_receipt_creates_audit_log(
        self, db, receipt_service, completed_payment
    ):
        """Regeneration creates a REGENERATED audit log entry."""
        from app.modules.billing.repositories import AuditRepository

        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        receipt_service.regenerate_receipt(
            receipt_id=receipt.id,
            regenerated_by=_STUB_USER_ID,
        )

        logs, _ = AuditRepository(db).find_by_entity(
            "receipt", receipt.id, sort_by="changed_at"
        )
        regenerated_logs = [l for l in logs if l.action == AuditAction.REGENERATED.value]
        assert len(regenerated_logs) == 1
        assert regenerated_logs[0].entity_id == receipt.id

    def test_regenerate_receipt_not_found(self, receipt_service):
        """Regenerating a non-existent receipt raises ReceiptNotFound."""
        with pytest.raises(ReceiptNotFound):
            receipt_service.regenerate_receipt(
                receipt_id=uuid.uuid4(),
                regenerated_by=_STUB_USER_ID,
            )

    def test_regenerate_cancelled_receipt_rejected(
        self, db, receipt_service, completed_payment
    ):
        """Regenerating a CANCELLED receipt is rejected."""
        from app.modules.billing.repositories import ReceiptRepository

        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        # Manually cancel the receipt (direct repo mutation for test)
        receipt.status = ReceiptStatus.CANCELLED.value
        ReceiptRepository(db).update(receipt, {"updated_by": _STUB_USER_ID})
        db.refresh(receipt)

        with pytest.raises(ReceiptValidationFailed):
            receipt_service.regenerate_receipt(
                receipt_id=receipt.id,
                regenerated_by=_STUB_USER_ID,
            )

    def test_regenerate_rollback_on_db_error(
        self, db, receipt_service, completed_payment
    ):
        """DB error during regeneration triggers rollback."""
        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        with patch.object(
            receipt_service._db, "rollback"
        ) as mock_rollback:
            with patch.object(
                receipt_service._audit_repo,
                "create",
                side_effect=IntegrityError("forced", None, None),
            ):
                with pytest.raises(PaymentCreationFailed):
                    receipt_service.regenerate_receipt(
                        receipt_id=receipt.id,
                        regenerated_by=_STUB_USER_ID,
                    )
            mock_rollback.assert_called_once()

    def test_regenerate_does_not_create_new_financial_record(
        self, db, receipt_service, completed_payment
    ):
        """Regeneration does not create a new receipt or duplicate."""
        from app.modules.billing.repositories import ReceiptRepository

        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        receipt_service.regenerate_receipt(
            receipt_id=receipt.id,
            regenerated_by=_STUB_USER_ID,
        )

        # Verify only one receipt exists for this payment
        same_receipt = ReceiptRepository(db).find_by_payment(completed_payment.id)
        assert same_receipt is not None
        assert same_receipt.id == receipt.id
        assert same_receipt.receipt_number == receipt.receipt_number

    def test_regenerate_rollback_on_validation_failure(
        self, db, receipt_service, completed_payment
    ):
        """Validation failure during regeneration triggers rollback."""
        from app.modules.billing.repositories import ReceiptRepository

        receipt, _ = receipt_service.generate_receipt(
            payment_id=completed_payment.id,
            generated_by=_STUB_USER_ID,
        )

        # Cancel the receipt so regeneration fails
        receipt.status = ReceiptStatus.CANCELLED.value
        ReceiptRepository(db).update(receipt, {"updated_by": _STUB_USER_ID})
        db.refresh(receipt)

        with patch.object(
            receipt_service._db, "rollback"
        ) as mock_rollback:
            with pytest.raises(ReceiptValidationFailed):
                receipt_service.regenerate_receipt(
                    receipt_id=receipt.id,
                    regenerated_by=_STUB_USER_ID,
                )
            mock_rollback.assert_called_once()


# ======================================================================
# PrintableReceipt DTO
# ======================================================================


class TestPrintableReceipt:
    """Tests for the PrintableReceipt DTO."""

    def test_printable_receipt_fields(self):
        """PrintableReceipt dataclass has all required fields."""
        from datetime import date

        dto = PrintableReceipt(
            receipt_id=uuid.uuid4(),
            receipt_number="RCT-00001",
            receipt_date=date.today(),
            payment_id=uuid.uuid4(),
            payment_number="PAY-00001",
            payment_method="cash",
            patient_id=uuid.uuid4(),
            total_amount=Decimal("100.00"),
            status="generated",
            created_by=uuid.uuid4(),
            created_at="2025-01-01T00:00:00+00:00",
        )
        assert dto.receipt_number == "RCT-00001"
        assert dto.total_amount == Decimal("100.00")
        assert dto.status == "generated"
