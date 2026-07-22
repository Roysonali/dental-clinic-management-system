"""Service-layer tests for InvoiceService (Sprint 5B.1).

Tests cover:
- create_invoice
- update_draft_invoice
- delete_draft_invoice
- get_invoice
- search_invoices
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.modules.billing.enums import AuditAction, InvoiceStatus
from app.modules.billing.exceptions import (
    BillingValidationError,
    InvoiceCreationFailed,
    InvoiceNotFound,
    InvoiceNotEditable,
    InvoiceNumberAlreadyUsed,
    InvoiceValidationFailed,
    InvalidInvoiceStatusTransition,
    NegativeAmountNotAllowed,
)
from app.modules.billing.models import (
    BillingAuditLog,
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
)

from tests.modules.billing.conftest import (
    _STUB_USER_ID,
    InvoiceFactory,
    InvoiceItemFactory,
)


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def invoice_service(db):
    from app.modules.billing.repositories import (
        AuditRepository,
        DocumentSequenceRepository,
        InvoiceRepository,
    )
    from app.modules.billing.validators import (
        DocumentSequenceValidator,
        FinancialValidator,
        InvoiceValidator,
    )
    from app.modules.billing.services import (
        DocumentSequenceService,
        InvoiceService,
    )

    repo = InvoiceRepository(db)
    audit_repo = AuditRepository(db)
    doc_seq_repo = DocumentSequenceRepository(db)
    financial_validator = FinancialValidator()
    validator = InvoiceValidator(repo, financial_validator)
    doc_seq_validator = DocumentSequenceValidator(doc_seq_repo)
    document_sequence_service = DocumentSequenceService(
        db, doc_seq_repo, doc_seq_validator
    )
    return InvoiceService(
        db=db,
        invoice_repo=repo,
        invoice_validator=validator,
        financial_validator=financial_validator,
        document_sequence_service=document_sequence_service,
        audit_repo=audit_repo,
    )


@pytest.fixture
def sample_item_data():
    return {
        "description": "Root canal treatment",
        "quantity": 1,
        "unit_price": Decimal("150.00"),
    }


@pytest.fixture
def sample_items():
    return [
        {
            "description": "Root canal treatment",
            "quantity": 1,
            "unit_price": Decimal("150.00"),
        },
        {
            "description": "Dental filling",
            "quantity": 2,
            "unit_price": Decimal("80.00"),
            "discount_value": Decimal("10.00"),
        },
    ]


# ======================================================================
# create_invoice
# ======================================================================


class TestInvoiceServiceCreate:
    def test_create_invoice_success(self, invoice_service, sample_items):
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000001",
            currency_code="USD",
            items=sample_items,
            created_by=_STUB_USER_ID,
        )
        assert invoice.id is not None
        assert invoice.status == InvoiceStatus.DRAFT
        assert invoice.currency_code == "USD"
        assert len(invoice.items) == 2

    def test_create_invoice_stores_items(self, db, invoice_service, sample_items):
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000002",
            currency_code="USD",
            items=sample_items,
            created_by=_STUB_USER_ID,
        )
        # Verify items are persisted
        db.refresh(invoice)
        assert len(invoice.items) == 2
        descs = {item.description for item in invoice.items}
        assert "Root canal treatment" in descs
        assert "Dental filling" in descs

    def test_create_invoice_assigns_sequence_numbers(
        self, db, invoice_service, sample_items
    ):
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000003",
            currency_code="USD",
            items=sample_items,
            created_by=_STUB_USER_ID,
        )
        assert invoice.items[0].sequence_number == 1
        assert invoice.items[1].sequence_number == 2

    def test_create_invoice_auto_computes_net_amount(
        self, db, invoice_service, sample_items
    ):
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000004",
            currency_code="USD",
            items=sample_items,
            created_by=_STUB_USER_ID,
        )
        # Item 1: 150 * 1 - 0 = 150
        # Item 2: 80 * 2 - 10 = 150
        nets = {item.sequence_number: item.net_amount for item in invoice.items}
        assert nets[1] == Decimal("150.00")
        assert nets[2] == Decimal("150.00")

    def test_create_invoice_uses_provided_sequence(
        self, db, invoice_service
    ):
        items = [
            {
                "description": "Item A",
                "quantity": 1,
                "unit_price": Decimal("50.00"),
                "sequence_number": 2,
            },
            {
                "description": "Item B",
                "quantity": 1,
                "unit_price": Decimal("50.00"),
                "sequence_number": 1,
            },
        ]
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000005",
            currency_code="USD",
            items=items,
            created_by=_STUB_USER_ID,
        )
        seqs = [item.sequence_number for item in invoice.items]
        # Should be re-sorted by sequence_number
        assert seqs == [1, 2]

    def test_create_invoice_negative_unit_price_raises(self, invoice_service):
        with pytest.raises(NegativeAmountNotAllowed):
            invoice_service.create_invoice(
                patient_id=_STUB_USER_ID,
                invoice_number="INV-000006",
                currency_code="USD",
                items=[
                    {
                        "description": "Bad item",
                        "quantity": 1,
                        "unit_price": Decimal("-10.00"),
                    }
                ],
                created_by=_STUB_USER_ID,
            )

    def test_create_invoice_duplicate_sequence_raises(self, invoice_service):
        with pytest.raises(InvoiceValidationFailed):
            invoice_service.create_invoice(
                patient_id=_STUB_USER_ID,
                invoice_number="INV-000007",
                currency_code="USD",
                items=[
                    {
                        "description": "Item A",
                        "quantity": 1,
                        "unit_price": Decimal("50.00"),
                        "sequence_number": 1,
                    },
                    {
                        "description": "Item B",
                        "quantity": 1,
                        "unit_price": Decimal("50.00"),
                        "sequence_number": 1,
                    },
                ],
                created_by=_STUB_USER_ID,
            )

    def test_create_invoice_duplicate_number_raises(self, db, invoice_service):
        invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000008",
            currency_code="USD",
            items=[{"description": "Item", "quantity": 1, "unit_price": Decimal("50.00")}],
            created_by=_STUB_USER_ID,
        )
        with pytest.raises(InvoiceNumberAlreadyUsed):
            invoice_service.create_invoice(
                patient_id=_STUB_USER_ID,
                invoice_number="INV-000008",
                currency_code="USD",
                items=[{"description": "Item 2", "quantity": 1, "unit_price": Decimal("50.00")}],
                created_by=_STUB_USER_ID,
            )

    def test_create_invoice_no_items_raises(self, invoice_service):
        with pytest.raises(InvoiceValidationFailed):
            invoice_service.create_invoice(
                patient_id=_STUB_USER_ID,
                invoice_number="INV-000009",
                currency_code="USD",
                items=[],
                created_by=_STUB_USER_ID,
            )

    def test_create_invoice_invalid_currency_raises(self, invoice_service):
        with pytest.raises(BillingValidationError):
            invoice_service.create_invoice(
                patient_id=_STUB_USER_ID,
                invoice_number="INV-000010",
                currency_code="INVALID",
                items=[{"description": "Item", "quantity": 1, "unit_price": Decimal("50.00")}],
                created_by=_STUB_USER_ID,
            )

    def test_create_invoice_status_history_created(self, db, invoice_service):
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000011",
            currency_code="USD",
            items=[{"description": "Item", "quantity": 1, "unit_price": Decimal("50.00")}],
            created_by=_STUB_USER_ID,
        )
        db.refresh(invoice)
        assert len(invoice.status_history) >= 1
        assert invoice.status_history[0].to_status == InvoiceStatus.DRAFT.value

    def test_create_invoice_defaults_due_date(self, db, invoice_service):
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000012",
            currency_code="USD",
            items=[{"description": "Item", "quantity": 1, "unit_price": Decimal("50.00")}],
            created_by=_STUB_USER_ID,
        )
        expected = invoice.invoice_date + __import__("datetime").timedelta(days=30)
        assert invoice.due_date == expected

    def test_create_invoice_uses_provided_due_date(self, db, invoice_service):
        expected_due = date(2026, 12, 31)
        invoice = invoice_service.create_invoice(
            patient_id=_STUB_USER_ID,
            invoice_number="INV-000013",
            currency_code="USD",
            items=[{"description": "Item", "quantity": 1, "unit_price": Decimal("50.00")}],
            created_by=_STUB_USER_ID,
            due_date=expected_due,
        )
        assert invoice.due_date == expected_due


# ======================================================================
# update_draft_invoice
# ======================================================================


class TestInvoiceServiceUpdateDraft:
    def test_update_draft_invoice_notes(self, db, invoice_service, invoice):
        updated = invoice_service.update_draft_invoice(
            invoice_id=invoice.id,
            updated_by=_STUB_USER_ID,
            notes="Updated notes",
        )
        assert updated.notes == "Updated notes"

    def test_update_draft_invoice_due_date(self, db, invoice_service, invoice):
        new_due = date(2026, 12, 31)
        updated = invoice_service.update_draft_invoice(
            invoice_id=invoice.id,
            updated_by=_STUB_USER_ID,
            due_date=new_due,
        )
        assert updated.due_date == new_due

    def test_update_draft_invoice_replaces_items(
        self, db, invoice_service, invoice
    ):
        InvoiceItemFactory.create(db, invoice_id=invoice.id, sequence_number=1)
        InvoiceItemFactory.create(db, invoice_id=invoice.id, sequence_number=2)
        db.refresh(invoice)
        assert len(invoice.items) == 2

        updated = invoice_service.update_draft_invoice(
            invoice_id=invoice.id,
            updated_by=_STUB_USER_ID,
            items=[
                {
                    "description": "New item",
                    "quantity": 3,
                    "unit_price": Decimal("200.00"),
                }
            ],
        )
        db.refresh(updated)
        assert len(updated.items) == 1
        assert updated.items[0].description == "New item"

    def test_update_draft_invoice_not_found_raises(self, invoice_service):
        with pytest.raises(InvoiceNotFound):
            invoice_service.update_draft_invoice(
                invoice_id=uuid.uuid4(),
                updated_by=_STUB_USER_ID,
            )

    def test_update_draft_invoice_not_editable_raises(
        self, db, invoice_service
    ):
        issued_invoice = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        with pytest.raises(InvoiceNotEditable):
            invoice_service.update_draft_invoice(
                invoice_id=issued_invoice.id,
                updated_by=_STUB_USER_ID,
            )

    def test_update_draft_invoice_empty_items_raises(self, invoice_service, invoice):
        with pytest.raises(InvoiceValidationFailed):
            invoice_service.update_draft_invoice(
                invoice_id=invoice.id,
                updated_by=_STUB_USER_ID,
                items=[],
            )


# ======================================================================
# delete_draft_invoice
# ======================================================================


class TestInvoiceServiceDeleteDraft:
    def test_delete_draft_invoice_success(self, db, invoice_service, invoice):
        invoice_service.delete_draft_invoice(invoice.id)
        assert db.get(Invoice, invoice.id) is None

    def test_delete_draft_invoice_not_found_raises(self, invoice_service):
        with pytest.raises(InvoiceNotFound):
            invoice_service.delete_draft_invoice(uuid.uuid4())

    def test_delete_draft_invoice_not_editable_raises(self, db, invoice_service):
        issued_invoice = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        with pytest.raises(InvoiceNotEditable):
            invoice_service.delete_draft_invoice(issued_invoice.id)


# ======================================================================
# get_invoice
# ======================================================================


class TestInvoiceServiceGetInvoice:
    def test_get_invoice_success(self, invoice_service, invoice):
        found = invoice_service.get_invoice(invoice.id)
        assert found.id == invoice.id

    def test_get_invoice_not_found_raises(self, invoice_service):
        with pytest.raises(InvoiceNotFound):
            invoice_service.get_invoice(uuid.uuid4())


# ======================================================================
# issue_invoice
# ======================================================================


class TestInvoiceServiceIssue:
    def test_issue_invoice_success(self, db, invoice_service, invoice_with_items):
        invoice = invoice_service.issue_invoice(
            invoice_id=invoice_with_items.id,
            issued_by=_STUB_USER_ID,
        )
        assert invoice.status == InvoiceStatus.ISSUED
        assert invoice.invoice_number == "INV-00001"
        db.refresh(invoice)
        assert len(invoice.status_history) == 1
        assert invoice.status_history[-1].to_status == InvoiceStatus.ISSUED.value

    def test_issue_invoice_not_found_raises(self, invoice_service):
        with pytest.raises(InvoiceNotFound):
            invoice_service.issue_invoice(
                invoice_id=uuid.uuid4(),
                issued_by=_STUB_USER_ID,
            )

    def test_issue_invoice_not_issuable_raises(self, db, invoice_service):
        issued_invoice = InvoiceFactory.create(db, status=InvoiceStatus.ISSUED.value)
        with pytest.raises(InvalidInvoiceStatusTransition):
            invoice_service.issue_invoice(
                invoice_id=issued_invoice.id,
                issued_by=_STUB_USER_ID,
            )

    def test_issue_invoice_no_items_raises(self, db, invoice_service, invoice):
        with pytest.raises(InvoiceValidationFailed):
            invoice_service.issue_invoice(
                invoice_id=invoice.id,
                issued_by=_STUB_USER_ID,
            )

    def test_issue_invoice_creates_audit_log(self, db, invoice_service, invoice_with_items):
        from app.modules.billing.repositories import AuditRepository

        invoice_service.issue_invoice(
            invoice_id=invoice_with_items.id,
            issued_by=_STUB_USER_ID,
        )
        audit_repo = AuditRepository(db)
        logs, _ = audit_repo.find_by_entity(
            "invoice", invoice_with_items.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.ISSUED.value


# ======================================================================
# cancel_invoice
# ======================================================================


class TestInvoiceServiceCancel:
    def test_cancel_invoice_success(self, db, invoice_service, invoice):
        invoice = invoice_service.cancel_invoice(
            invoice_id=invoice.id,
            cancelled_by=_STUB_USER_ID,
            cancellation_reason="Patient request",
        )
        assert invoice.status == InvoiceStatus.CANCELLED
        assert invoice.cancellation_reason == "Patient request"
        db.refresh(invoice)
        assert len(invoice.status_history) == 1
        assert invoice.status_history[-1].to_status == InvoiceStatus.CANCELLED.value
        assert invoice.status_history[-1].reason == "Patient request"

    def test_cancel_invoice_not_found_raises(self, invoice_service):
        with pytest.raises(InvoiceNotFound):
            invoice_service.cancel_invoice(
                invoice_id=uuid.uuid4(),
                cancelled_by=_STUB_USER_ID,
                cancellation_reason="Test",
            )

    def test_cancel_invoice_terminal_raises(self, db, invoice_service):
        cancelled_invoice = InvoiceFactory.create(
            db, status=InvoiceStatus.CANCELLED.value, cancellation_reason="preseed"
        )
        with pytest.raises(InvalidInvoiceStatusTransition):
            invoice_service.cancel_invoice(
                invoice_id=cancelled_invoice.id,
                cancelled_by=_STUB_USER_ID,
                cancellation_reason="Double cancel",
            )

    def test_cancel_invoice_paid_status_raises(self, db, invoice_service):
        paid_invoice = InvoiceFactory.create(
            db, status=InvoiceStatus.PAID.value, cancellation_reason="preseed"
        )
        db.commit()
        original_status = paid_invoice.status
        with pytest.raises(InvalidInvoiceStatusTransition):
            invoice_service.cancel_invoice(
                invoice_id=paid_invoice.id,
                cancelled_by=_STUB_USER_ID,
                cancellation_reason="Refund request",
            )
        db.refresh(paid_invoice)
        assert paid_invoice.status == original_status
        assert len(paid_invoice.status_history) == 0

        from app.modules.billing.repositories import AuditRepository

        audit_repo = AuditRepository(db)
        logs, _ = audit_repo.find_by_entity(
            "invoice", paid_invoice.id, sort_by="changed_at"
        )
        assert len(logs) == 0

    def test_cancel_invoice_empty_reason_raises(self, db, invoice_service, invoice):
        with pytest.raises(InvoiceValidationFailed):
            invoice_service.cancel_invoice(
                invoice_id=invoice.id,
                cancelled_by=_STUB_USER_ID,
                cancellation_reason="   ",
            )

    def test_cancel_invoice_creates_audit_log(self, db, invoice_service, invoice):
        from app.modules.billing.repositories import AuditRepository

        invoice_service.cancel_invoice(
            invoice_id=invoice.id,
            cancelled_by=_STUB_USER_ID,
            cancellation_reason="Test cancel",
        )
        audit_repo = AuditRepository(db)
        logs, _ = audit_repo.find_by_entity(
            "invoice", invoice.id, sort_by="changed_at"
        )
        assert len(logs) == 1
        assert logs[0].action == AuditAction.CANCELLED.value


# ======================================================================
# search_invoices
# ======================================================================


class TestInvoiceServiceSearch:
    def test_search_invoices_empty(self, invoice_service):
        items, total = invoice_service.search_invoices()
        assert total == 0
        assert items == []

    def test_search_invoices_finds_created(self, db, invoice_service):
        InvoiceFactory.create(db, invoice_number="INV-SEARCH-001")
        items, total = invoice_service.search_invoices(term="SEARCH")
        assert total == 1
        assert items[0].invoice_number == "INV-SEARCH-001"

    def test_search_invoices_filters_by_status(self, db, invoice_service):
        InvoiceFactory.create(db, invoice_number="INV-DRAFT-001", status="draft")
        InvoiceFactory.create(db, invoice_number="INV-ISSUED-001", status="issued")
        items, total = invoice_service.search_invoices(status="draft")
        assert total == 1
        assert items[0].status == "draft"

    def test_search_invoices_pagination(self, db, invoice_service):
        for i in range(5):
            InvoiceFactory.create(db, invoice_number=f"INV-PAGE-{i:03d}")
        items, total = invoice_service.search_invoices(
            page=2, page_size=2
        )
        assert total == 5
        assert len(items) == 2
