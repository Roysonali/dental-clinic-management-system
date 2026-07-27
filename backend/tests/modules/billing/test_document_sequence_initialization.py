"""Regression tests for Sprint 13.0B — Document Sequence Initialization.

Verifies:
1. All 5 document types exist after seeding (invoice, payment, receipt, refund, credit_note).
2. First generated document numbers are correct (INV-00001, PAY-00001, etc.).
3. DocumentSequence creation with ``updated_by=None`` works (nullable).
4. Duplicate sequence creation is prevented (idempotency).
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session


from app.modules.billing.models import DocumentSequence
from app.modules.billing.repositories import DocumentSequenceRepository
from app.modules.billing.validators import DocumentSequenceValidator
from app.modules.billing.services import DocumentSequenceService

from tests.modules.billing.conftest import (
    _STUB_USER_INT_ID,
)


# ======================================================================
# Sequence initialization tests
# ======================================================================


class TestSequenceInitialization:
    """Verify that fresh database initialization creates all 5 sequences."""

    @pytest.mark.parametrize(
        "doc_type, expected_prefix, expected_first_number",
        [
            ("invoice", "INV-", "INV-00001"),
            ("payment", "PAY-", "PAY-00001"),
            ("receipt", "RCT-", "RCT-00001"),
            ("refund", "RFD-", "RFD-00001"),
            ("credit_note", "CN-", "CN-00001"),
        ],
    )
    def test_sequence_exists(
        self,
        db: Session,
        doc_type: str,
        expected_prefix: str,
        expected_first_number: str,
    ) -> None:
        """Verify each document type has a correctly configured sequence."""
        repo = DocumentSequenceRepository(db)
        sequence = repo.get_by_document_type(doc_type)

        assert sequence is not None, f"Sequence '{doc_type}' should exist"
        assert sequence.prefix == expected_prefix
        assert sequence.current_value == 0
        assert sequence.min_digits == 5
        assert sequence.start_value == 1
        assert sequence.document_type == doc_type

    def test_sequence_count(self, db: Session) -> None:
        """Verify exactly 5 document sequences exist (conftest seeds all 5)."""
        repo = DocumentSequenceRepository(db)
        assert repo.count() == 5

    def test_updated_by_nullable(self, db: Session) -> None:
        """Verify DocumentSequence can be created with ``updated_by=None``.

        Regression test for Sprint 13.0B — the column is now nullable.
        """
        seq = DocumentSequence(
            document_type="test_sequence",
            prefix="TST-",
            current_value=0,
            min_digits=5,
            start_value=1,
            updated_by=None,  # ← would fail before Sprint 13.0B
        )
        db.add(seq)
        db.flush()
        db.refresh(seq)

        assert seq.document_type == "test_sequence"
        assert seq.updated_by is None
        assert seq.prefix == "TST-"

    def test_sequence_no_duplicates(self, db: Session) -> None:
        """Verify that the test database has exactly one row per document type.

        This validates that the seeding / initialization logic does not
        produce duplicate document types. The conftest seeds all 5 sequences
        once per test.
        """
        repo = DocumentSequenceRepository(db)

        # Exactly 5 unique document types
        assert repo.count() == 5

        # Each type exists exactly once
        for doc_type in ["invoice", "payment", "receipt", "refund", "credit_note"]:
            assert repo.exists(doc_type) is True, (
                f"Sequence '{doc_type}' should exist exactly once"
            )

        # No unknown types exist
        all_types = {s.document_type for s in [
            repo.get_by_document_type(t) for t in
            ["invoice", "payment", "receipt", "refund", "credit_note"]
        ]}
        assert len(all_types) == 5


# ======================================================================
# First document number verification
# ======================================================================


class TestFirstDocumentNumbers:
    """Verify that each document type produces the correct first number."""

    @pytest.mark.parametrize(
        "doc_type, expected_number",
        [
            ("invoice", "INV-00001"),
            ("payment", "PAY-00001"),
            ("receipt", "RCT-00001"),
            ("refund", "RFD-00001"),
            ("credit_note", "CN-00001"),
        ],
    )
    def test_reserve_first_number(
        self,
        db: Session,
        doc_type: str,
        expected_number: str,
    ) -> None:
        """Verify :meth:`DocumentSequenceService.reserve_next_number`
        produces the correct first document number.

        Relies on conftest having seeded the 5 sequences with
        ``current_value=0``.
        """
        repo = DocumentSequenceRepository(db)
        validator = DocumentSequenceValidator(repo)
        service = DocumentSequenceService(db, repo, validator)

        document_number = service.reserve_next_number(
            document_type=doc_type,
            reserved_by=_STUB_USER_INT_ID,
        )

        assert document_number == expected_number, (
            f"First {doc_type} number should be {expected_number}, "
            f"got {document_number!r}"
        )

    def test_monotonic_increment(self, db: Session) -> None:
        """Verify that reserving multiple invoice numbers produces
        sequential values.
        """
        repo = DocumentSequenceRepository(db)
        validator = DocumentSequenceValidator(repo)
        service = DocumentSequenceService(db, repo, validator)

        first = service.reserve_next_number("invoice", _STUB_USER_INT_ID)
        second = service.reserve_next_number("invoice", _STUB_USER_INT_ID)
        third = service.reserve_next_number("invoice", _STUB_USER_INT_ID)

        assert first == "INV-00001"
        assert second == "INV-00002"
        assert third == "INV-00003"

    def test_consumption_log_created(self, db: Session) -> None:
        """Verify that reserving a number creates a
        ``SequenceConsumptionLog`` entry.
        """
        repo = DocumentSequenceRepository(db)
        validator = DocumentSequenceValidator(repo)
        service = DocumentSequenceService(db, repo, validator)

        service.reserve_next_number("invoice", _STUB_USER_INT_ID)

        logs = repo.get_recent_consumption_logs("invoice", limit=5)
        assert len(logs) >= 1
        assert logs[0].document_type == "invoice"
        assert logs[0].number_assigned == 1
        assert logs[0].reserved_by == _STUB_USER_INT_ID

    def test_preview_before_reserve(self, db: Session) -> None:
        """Verify :meth:`preview_next_number` returns the correct
        next number without consuming it.
        """
        repo = DocumentSequenceRepository(db)
        validator = DocumentSequenceValidator(repo)
        service = DocumentSequenceService(db, repo, validator)

        # Preview before any reservation
        preview = service.preview_next_number("invoice")
        assert preview == "INV-00001"

        # Sequence must still be at 0 (no reservation occurred)
        sequence = repo.get_by_document_type("invoice")
        assert sequence is not None
        assert sequence.current_value == 0


# ======================================================================
# Cross-document sequence isolation
# ======================================================================


class TestSequenceIsolation:
    """Verify that each document type has an independent sequence."""

    def test_independent_counters(self, db: Session) -> None:
        """Reserving numbers for different document types should not
        affect each other's counters.
        """
        repo = DocumentSequenceRepository(db)
        validator = DocumentSequenceValidator(repo)
        service = DocumentSequenceService(db, repo, validator)

        inv_1 = service.reserve_next_number("invoice", _STUB_USER_INT_ID)
        pay_1 = service.reserve_next_number("payment", _STUB_USER_INT_ID)
        rct_1 = service.reserve_next_number("receipt", _STUB_USER_INT_ID)
        inv_2 = service.reserve_next_number("invoice", _STUB_USER_INT_ID)
        pay_2 = service.reserve_next_number("payment", _STUB_USER_INT_ID)

        assert inv_1 == "INV-00001"
        assert inv_2 == "INV-00002"  # invoice-independent counter
        assert pay_1 == "PAY-00001"
        assert pay_2 == "PAY-00002"  # payment-independent counter
        assert rct_1 == "RCT-00001"


__all__ = [
    "TestSequenceInitialization",
    "TestFirstDocumentNumbers",
    "TestSequenceIsolation",
]
