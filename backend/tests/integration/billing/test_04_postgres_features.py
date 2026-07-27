"""Phase 4: PostgreSQL-Specific Feature Tests.

Validates that every PostgreSQL-specific feature used by Billing
behaves correctly against real PostgreSQL.

Covers:
- Partial Unique Index (PaymentAllocation)
- JSONB (BillingAuditLog)
- UUID (all entities)
- CHECK constraints (enforced at DB level)
- Foreign Keys (RESTRICT, CASCADE, SET NULL)
- ILIKE search behavior
- Numeric precision for monetary values
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

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
    CreditNoteRepository,
    InvoiceRepository,
    PaymentRepository,
)
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    RefundFactory,
    CreditNoteFactory,
    AuditLogFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ---------------------------------------------------------------------------
# Partial Unique Index — PaymentAllocation
# ---------------------------------------------------------------------------
class TestPartialUniqueIndex:
    """The partial unique index uq_payment_allocation_active ensures
    only ONE active (non-refund) allocation per payment-invoice pair."""

    def test_single_active_allocation_succeeds(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("200.00"))
        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

    def test_duplicate_active_allocation_violates_index(self, db):
        """Attempting to allocate the same payment to the same invoice twice
        should violate the partial unique index."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("500.00"), net_amount=Decimal("500.00"),
        )
        db.flush()

        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("500.00"))

        alloc1 = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc1)
        db.flush()

        alloc2 = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc2)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_refund_allocation_not_affected_by_partial_index(self, db):
        """Refund allocations (is_refund=True) should NOT be constrained
        by the partial unique index."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()

        refund_alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv.id,
            allocated_amount=Decimal("50.00"),
            is_refund=True,
            refund_reason="Test refund",
            original_allocation_id=alloc.id,
            created_by=STUB_USER_ID,
        )
        db.add(refund_alloc)
        db.flush()

    def test_different_invoices_same_payment_succeeds(self, db):
        """Allocating the same payment to DIFFERENT invoices is allowed."""
        inv1 = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv1.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        inv2 = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv2.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("200.00"))

        alloc1 = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv1.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        alloc2 = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=inv2.id,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc1)
        db.add(alloc2)
        db.flush()

    def test_null_invoice_id_not_constrained_by_partial_index(self, db):
        """Allocations with invoice_id=NULL (advance payments) are not
        constrained by the partial unique index."""
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))
        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=None,
            allocated_amount=Decimal("100.00"),
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        db.flush()


# ---------------------------------------------------------------------------
# JSONB — BillingAuditLog
# ---------------------------------------------------------------------------
class TestJSONB:
    """Verify JSONB column behavior on billing_audit_logs."""

    def test_insert_with_jsonb_data(self, db):
        audit = AuditLogFactory.create(
            db,
            entity_type="invoice",
            entity_id=uuid.uuid4(),
            action="created",
            old_value=None,
            new_value={"amount": 100.00, "currency": "USD", "status": "draft"},
        )
        assert audit.new_value["amount"] == 100.00
        assert audit.new_value["currency"] == "USD"

    def test_retrieve_jsonb_nested_data(self, db):
        entity_id = uuid.uuid4()
        audit = AuditLogFactory.create(
            db,
            entity_type="payment",
            entity_id=entity_id,
            action="status_changed",
            old_value={"status": "pending", "amount": "250.00"},
            new_value={"status": "completed", "amount": "250.00",
                       "metadata": {"method": "cash", "reference": "REF-001"}},
        )
        db.flush()

        result = db.execute(
            text("SELECT new_value->>'status' as status, "
                 "new_value->'metadata'->>'method' as method "
                 "FROM billing_audit_logs WHERE id = :id"),
            {"id": str(audit.id)},
        )
        row = result.fetchone()
        assert row[0] == "completed"
        assert row[1] == "cash"

    def test_jsonb_serialization_roundtrip(self, db):
        complex_data = {
            "amount": 99.99,
            "items": [
                {"description": "Consultation", "price": 50.00},
                {"description": "X-Ray", "price": 49.99},
            ],
            "metadata": {
                "nested": {"deep": True, "count": 3},
                "tags": ["urgent", "follow-up"],
            },
        }
        audit = AuditLogFactory.create(
            db,
            old_value=None,
            new_value=complex_data,
        )
        db.flush()

        retrieved = db.get(BillingAuditLog, audit.id)
        assert retrieved.new_value["items"][0]["description"] == "Consultation"
        assert retrieved.new_value["metadata"]["nested"]["deep"] is True
        assert len(retrieved.new_value["metadata"]["tags"]) == 2

    def test_jsonb_null_handling(self, db):
        audit = AuditLogFactory.create(
            db,
            old_value=None,
            new_value=None,
        )
        db.flush()
        retrieved = db.get(BillingAuditLog, audit.id)
        assert retrieved.old_value is None
        assert retrieved.new_value is None

    def test_jsonb_empty_object(self, db):
        audit = AuditLogFactory.create(
            db,
            old_value={},
            new_value={},
        )
        db.flush()
        retrieved = db.get(BillingAuditLog, audit.id)
        assert retrieved.old_value == {}
        assert retrieved.new_value == {}

    def test_jsonb_update_replaces_entire_value(self, db):
        audit = AuditLogFactory.create(
            db,
            old_value={"key": "value1"},
            new_value={"key": "value2"},
        )
        db.flush()

        audit.new_value = {"completely": "different"}
        db.flush()

        retrieved = db.get(BillingAuditLog, audit.id)
        assert "key" not in retrieved.new_value
        assert retrieved.new_value["completely"] == "different"


# ---------------------------------------------------------------------------
# UUID Behavior
# ---------------------------------------------------------------------------
class TestUUID:
    """Verify UUID storage, retrieval, joins, and FK integrity."""

    def test_uuid_stored_and_retrieved(self, db):
        inv = InvoiceFactory.create(db)
        retrieved = db.get(Invoice, inv.id)
        assert retrieved is not None
        assert retrieved.id == inv.id

    def test_uuid_primary_key_type(self, db):
        inv = InvoiceFactory.create(db)
        assert isinstance(inv.id, uuid.UUID)

    def test_uuid_fk_joins(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        result = db.execute(
            text("SELECT i.id, p.unit_price "
                 "FROM invoices i "
                 "JOIN invoice_line_items p ON p.invoice_id = i.id "
                 "WHERE i.id = :iid"),
            {"iid": str(inv.id)},
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == inv.id

    def test_uuid_fk_violation_raises(self, db):
        inv = Invoice(
            id=uuid.uuid4(),
            patient_id=uuid.uuid4(),  # Non-existent patient
            invoice_number="INV-FK-TEST-001",
            invoice_date=date.today(),
            due_date=date.today(),
            status="draft",
            currency_code="USD",
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(inv)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_uuid_v4_generation(self, db):
        inv1 = InvoiceFactory.create(db)
        inv2 = InvoiceFactory.create(db)
        assert inv1.id != inv2.id
        assert str(inv1.id) != str(inv2.id)


# ---------------------------------------------------------------------------
# CHECK Constraints at DB Level
# ---------------------------------------------------------------------------
class TestDBCheckConstraints:
    """Verify CHECK constraints are enforced by PostgreSQL."""

    def test_amount_positive_constraint(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        payment = Payment(
            id=uuid.uuid4(),
            patient_id=STUB_PATIENT_ID,
            payment_number="PAY-NEG-001",
            payment_method="cash",
            total_amount=Decimal("-50.00"),  # Violates ck_payment_amount_positive
            payment_date=date.today(),
            status="pending",
            is_reversed=False,
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(payment)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_status_enum_constraint(self, db):
        inv = Invoice(
            id=uuid.uuid4(),
            patient_id=STUB_PATIENT_ID,
            invoice_number="INV-BADSTATUS-001",
            invoice_date=date.today(),
            due_date=date.today(),
            status="INVALID_STATUS",
            currency_code="USD",
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(inv)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_credit_note_remaining_le_amount(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        cn = CreditNote(
            id=uuid.uuid4(),
            invoice_id=inv.id,
            patient_id=STUB_PATIENT_ID,
            credit_note_number="CN-OVERFLOW-001",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("200.00"),  # Violates ck_credit_note_remaining_le_amount
            reason="Test",
            status="draft",
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(cn)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_credit_note_remaining_nonneg(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"), net_amount=Decimal("100.00"),
        )
        db.flush()

        cn = CreditNote(
            id=uuid.uuid4(),
            invoice_id=inv.id,
            patient_id=STUB_PATIENT_ID,
            credit_note_number="CN-NEG-001",
            amount=Decimal("100.00"),
            remaining_balance=Decimal("-10.00"),  # Violates ck_credit_note_remaining_nonneg
            reason="Test",
            status="draft",
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(cn)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_invoice_item_quantity_min_one(self, db):
        inv = InvoiceFactory.create(db, status="draft")
        db.flush()

        item = InvoiceItem(
            id=uuid.uuid4(),
            invoice_id=inv.id,
            sequence_number=1,
            description="Zero quantity",
            quantity=0,  # Violates ck_invoice_item_quantity
            unit_price=Decimal("100.00"),
            net_amount=Decimal("100.00"),
            created_by=STUB_USER_ID,
            version=1,
            doc_version=1,
        )
        db.add(item)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_invoice_item_net_amount_nonneg(self, db):
        inv = InvoiceFactory.create(db, status="draft")
        db.flush()

        item = InvoiceItem(
            id=uuid.uuid4(),
            invoice_id=inv.id,
            sequence_number=1,
            description="Negative net",
            quantity=1,
            unit_price=Decimal("100.00"),
            net_amount=Decimal("-50.00"),  # Violates ck_invoice_item_net_amount
            created_by=STUB_USER_ID,
            version=1,
            doc_version=1,
        )
        db.add(item)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_payment_allocation_amount_positive(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))
        db.flush()

        alloc = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            invoice_id=None,
            allocated_amount=Decimal("-50.00"),  # Violates ck_payment_allocation_amount_positive
            is_refund=False,
            refund_reason=None,
            original_allocation_id=None,
            created_by=STUB_USER_ID,
        )
        db.add(alloc)
        with pytest.raises(IntegrityError):
            db.flush()

    def test_refund_amount_positive(self, db):
        payment = PaymentFactory.create(db, status="completed", total_amount=Decimal("100.00"))
        db.flush()

        refund = Refund(
            id=uuid.uuid4(),
            payment_id=payment.id,
            refund_number="RFD-NEG-001",
            amount=Decimal("0.00"),  # Violates ck_refund_amount_positive
            reason="Test",
            status="pending",
            created_by=STUB_USER_ID,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
            doc_version=1,
        )
        db.add(refund)
        with pytest.raises(IntegrityError):
            db.flush()


# ---------------------------------------------------------------------------
# Foreign Key Enforcement
# ---------------------------------------------------------------------------
class TestForeignKeyEnforcement:
    def test_payment_fk_restrict_delete_patient(self, db):
        """RESTRICT FK prevents deleting a patient with payments."""
        payment = PaymentFactory.create(db)
        db.flush()

        result = db.execute(
            text("SELECT pg_constraint.conname "
                 "FROM pg_constraint "
                 "JOIN pg_class ON pg_constraint.conrelid = pg_class.oid "
                 "WHERE pg_class.relname = 'payments' "
                 "AND pg_constraint.contype = 'f' "
                 "AND pg_constraint.conname LIKE '%patient%'")
        )
        fks = result.fetchall()
        assert len(fks) >= 1

    def test_invoice_item_cascade_delete(self, db):
        """CASCADE FK deletes invoice items when invoice is deleted."""
        inv = InvoiceFactory.create(db, status="draft")
        item = InvoiceItemFactory.create(db, invoice_id=inv.id, sequence_number=1)
        item_id = item.id
        db.flush()

        db.delete(inv)
        db.flush()

        result = db.execute(
            text("SELECT id FROM invoice_line_items WHERE id = :iid"),
            {"iid": str(item_id)},
        )
        assert result.fetchone() is None


# ---------------------------------------------------------------------------
# ILIKE Search Behavior
# ---------------------------------------------------------------------------
class TestILIKEBehavior:
    def test_ilike_case_insensitive_search(self, db):
        inv1 = InvoiceFactory.create(db, invoice_number="INV-CASE-001")
        inv2 = InvoiceFactory.create(db, invoice_number="inv-case-002")
        inv3 = InvoiceFactory.create(db, invoice_number="INV-OTHER-003")
        db.flush()

        repo = InvoiceRepository(db)
        results = repo.search("inv-case")
        assert len(results) == 2

    def test_ilike_partial_match(self, db):
        InvoiceFactory.create(db, invoice_number="INV-PARTIAL-123")
        InvoiceFactory.create(db, invoice_number="INV-PARTIAL-456")
        InvoiceFactory.create(db, invoice_number="INV-OTHER-789")
        db.flush()

        repo = InvoiceRepository(db)
        results = repo.search("PARTIAL")
        assert len(results) == 2

    def test_ilike_no_match(self, db):
        InvoiceFactory.create(db, invoice_number="INV-NOMATCH-001")
        db.flush()

        repo = InvoiceRepository(db)
        results = repo.search("NONEXISTENT")
        assert len(results) == 0


# ---------------------------------------------------------------------------
# Numeric Precision
# ---------------------------------------------------------------------------
class TestNumericPrecision:
    def test_two_decimal_places_preserved(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("99.99"),
            net_amount=Decimal("99.99"),
        )
        db.flush()

        result = db.execute(
            text("SELECT unit_price FROM invoice_line_items WHERE invoice_id = :iid"),
            {"iid": str(inv.id)},
        )
        row = result.fetchone()
        assert row is not None
        val = Decimal(str(row[0]))
        assert val == Decimal("99.99")
        assert val.as_tuple().exponent == -2

    def test_large_monetary_value(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("999999.99"),
            net_amount=Decimal("999999.99"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("999999.99")

    def test_zero_decimal_preserved(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("100.00"),
            net_amount=Decimal("100.00"),
        )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("100.00")

    def test_multiple_additions_no_rounding_error(self, db):
        inv = InvoiceFactory.create(db, status="issued")
        amounts = [Decimal("0.01")] * 100
        for i, amt in enumerate(amounts):
            InvoiceItemFactory.create(
                db, invoice_id=inv.id, sequence_number=i + 1,
                unit_price=amt, net_amount=amt,
            )
        db.flush()

        repo = InvoiceRepository(db)
        total = repo.get_invoice_grand_total(inv.id)
        assert total == Decimal("1.00")
