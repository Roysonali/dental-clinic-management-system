"""Phase 10: Performance Smoke Tests.

Not benchmarking — validates that critical queries complete in
reasonable time and don't exhibit obvious N+1 problems.

Documents performance characteristics for production reference.
"""

from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.modules.billing.repositories import (
    InvoiceRepository,
    PaymentRepository,
    CreditNoteRepository,
    AuditRepository,
)
from tests.integration.billing.conftest import (
    InvoiceFactory,
    InvoiceItemFactory,
    PaymentFactory,
    CreditNoteFactory,
    AuditLogFactory,
    STUB_PATIENT_ID,
    STUB_USER_ID,
)

pytestmark = pytest.mark.postgres


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _seed_large_dataset(db, num_invoices=100, items_per_invoice=5):
    """Create a moderate dataset for performance testing."""
    invoice_ids = []
    for i in range(num_invoices):
        inv = InvoiceFactory.create(
            db, status="issued",
            invoice_number=f"INV-PERF-{i:06d}",
        )
        for j in range(items_per_invoice):
            InvoiceItemFactory.create(
                db, invoice_id=inv.id, sequence_number=j + 1,
                unit_price=Decimal("100.00"),
                net_amount=Decimal("100.00"),
            )
        invoice_ids.append(inv.id)
    db.flush()
    return invoice_ids


# ---------------------------------------------------------------------------
# Invoice Search Performance
# ---------------------------------------------------------------------------
class TestInvoiceSearchPerformance:
    def test_search_100_invoices_under_threshold(self, db):
        """Verify search on 100 invoices completes under 2 seconds."""
        _seed_large_dataset(db, num_invoices=100)

        repo = InvoiceRepository(db)
        start = time.time()
        results, total = repo.list(page=1, page_size=20)
        elapsed = time.time() - start

        assert total >= 100, f"Expected >= 100 invoices, got {total}"
        assert len(results) == 20
        assert elapsed < 2.0, f"Search took {elapsed:.3f}s — possible performance issue"

    def test_search_by_term_performance(self, db):
        """Verify ILIKE search on 100 invoices completes under 2 seconds."""
        _seed_large_dataset(db, num_invoices=100)

        repo = InvoiceRepository(db)
        start = time.time()
        results = repo.search("INV-PERF-0000")
        elapsed = time.time() - start

        assert len(results) >= 1
        assert elapsed < 2.0, f"Search took {elapsed:.3f}s"

    def test_aggregate_query_performance(self, db):
        """Verify aggregate queries on 100 invoices complete under 2 seconds."""
        invoice_ids = _seed_large_dataset(db, num_invoices=100)

        repo = InvoiceRepository(db)
        start = time.time()
        for inv_id in invoice_ids[:20]:
            repo.get_invoice_grand_total(inv_id)
        elapsed = time.time() - start

        assert elapsed < 2.0, f"Aggregates took {elapsed:.3f}s"


# ---------------------------------------------------------------------------
# Payment Pagination Performance
# ---------------------------------------------------------------------------
class TestPaymentPerformance:
    def test_payment_list_pagination(self, db):
        """Verify payment listing with 50 payments completes under 2 seconds."""
        for i in range(50):
            PaymentFactory.create(
                db, status="completed",
                total_amount=Decimal("100.00"),
                payment_number=f"PAY-PERF-{i:06d}",
            )
        db.flush()

        repo = PaymentRepository(db)
        start = time.time()
        results, total = repo.list(page=1, page_size=10)
        elapsed = time.time() - start

        assert total >= 50, f"Expected >= 50 payments, got {total}"
        assert len(results) == 10
        assert elapsed < 2.0

    def test_payment_totals_performance(self, db):
        """Verify payment totals computation on 50 payments under 1 second."""
        for i in range(50):
            PaymentFactory.create(
                db, status="completed",
                total_amount=Decimal("100.00"),
                payment_number=f"PAY-TOTAL-{i:06d}",
            )
        db.flush()

        repo = PaymentRepository(db)
        start = time.time()
        totals = repo.get_payment_totals()
        elapsed = time.time() - start

        assert totals["payment_count"] >= 50
        assert elapsed < 1.0


# ---------------------------------------------------------------------------
# Dashboard Statistics Performance
# ---------------------------------------------------------------------------
class TestDashboardPerformance:
    def test_invoice_count_grouped_by_status(self, db):
        """Verify grouped count on 100 invoices completes under 1 second."""
        for i in range(50):
            InvoiceFactory.create(db, status="draft", invoice_number=f"INV-DASH-{i:04d}")
        for i in range(30):
            InvoiceFactory.create(db, status="issued", invoice_number=f"INV-DASH-{50+i:04d}")
        for i in range(20):
            InvoiceFactory.create(db, status="paid", invoice_number=f"INV-DASH-{80+i:04d}")
        db.flush()

        repo = InvoiceRepository(db)
        start = time.time()
        grouped = repo.count_grouped_by_status()
        elapsed = time.time() - start

        assert grouped["draft"] >= 50
        assert grouped["issued"] >= 30
        assert grouped["paid"] >= 20
        assert elapsed < 1.0

    def test_credit_note_totals_performance(self, db):
        """Verify credit note totals on 50 records under 1 second."""
        inv = InvoiceFactory.create(db, status="issued")
        InvoiceItemFactory.create(
            db, invoice_id=inv.id, sequence_number=1,
            unit_price=Decimal("50000.00"), net_amount=Decimal("50000.00"),
        )
        db.flush()

        for i in range(50):
            CreditNoteFactory.create(
                db, invoice_id=inv.id, patient_id=STUB_PATIENT_ID,
                amount=Decimal("100.00"), remaining_balance=Decimal("50.00"),
            )
        db.flush()

        repo = CreditNoteRepository(db)
        start = time.time()
        totals = repo.get_credit_note_totals()
        elapsed = time.time() - start

        assert totals["credit_note_count"] == 50
        assert elapsed < 1.0


# ---------------------------------------------------------------------------
# Audit Log Query Performance
# ---------------------------------------------------------------------------
class TestAuditLogPerformance:
    def test_audit_log_listing_performance(self, db):
        """Verify audit log listing on 100 entries under 1 second."""
        for i in range(100):
            AuditLogFactory.create(
                db,
                entity_type="invoice",
                entity_id=uuid.uuid4(),
                action="created",
            )
        db.flush()

        repo = AuditRepository(db)
        start = time.time()
        results, total = repo.list(page=1, page_size=20, sort_by="changed_at")
        elapsed = time.time() - start

        assert total == 100
        assert len(results) == 20
        assert elapsed < 1.0

    def test_audit_log_entity_lookup_performance(self, db):
        """Verify entity audit log lookup on 50 entries under 1 second."""
        entity_id = uuid.uuid4()
        for i in range(50):
            AuditLogFactory.create(
                db,
                entity_type="payment",
                entity_id=entity_id,
                action="status_changed",
            )
        db.flush()

        repo = AuditRepository(db)
        start = time.time()
        results, total = repo.find_by_entity("payment", entity_id, sort_by="changed_at")
        elapsed = time.time() - start

        assert total == 50
        assert elapsed < 1.0
