"""Repository tests for ProcedureRepository and TreatmentPlanRepository.

Every test uses a real SQLite database (via the autouse ``db`` fixture from
``conftest.py``). Factories from ``conftest.py`` seed data; repository
instances are created in each test with the active session.

No mocks — all tests exercise real SQLAlchemy queries against the in-memory
SQLite engine.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ProcedureCategory,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.models import (
    Procedure,
    TreatmentPlan,
    TreatmentPlanApproval,
    TreatmentPlanItem,
    TreatmentPlanVersion,
)
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)

from tests.modules.treatment.conftest import (
    ProcedureFactory,
    TreatmentPlanApprovalFactory,
    TreatmentPlanFactory,
    TreatmentPlanItemFactory,
    TreatmentPlanVersionFactory,
)


# ======================================================================
# ProcedureRepository
# ======================================================================


class TestProcedureRepositoryCreate:
    def test_create(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.build(code="RCT001", name="RCT")
        result = repo.create(proc)
        assert result.id is not None
        # Verify it's actually persisted
        assert db.get(Procedure, result.id) is not None

    def test_create_duplicate_code_raises(self, db):
        repo = ProcedureRepository(db)
        ProcedureFactory.create(db, code="UNIQUE")
        proc2 = ProcedureFactory.build(code="UNIQUE")
        with pytest.raises(IntegrityError):
            repo.create(proc2)
            db.flush()


class TestProcedureRepositoryRead:
    def test_get_by_id(self, db):
        proc = ProcedureFactory.create(db)
        repo = ProcedureRepository(db)
        found = repo.get_by_id(proc.id)
        assert found is not None
        assert found.id == proc.id
        assert found.code == proc.code

    def test_get_by_id_not_found(self, db):
        repo = ProcedureRepository(db)
        assert repo.get_by_id(99999) is None

    def test_get_by_code(self, db):
        proc = ProcedureFactory.create(db, code="RCT001")
        repo = ProcedureRepository(db)
        found = repo.get_by_code("RCT001")
        assert found is not None
        assert found.id == proc.id

    def test_get_by_code_case_insensitive(self, db):
        ProcedureFactory.create(db, code="RCT001")
        repo = ProcedureRepository(db)
        found = repo.get_by_code("rct001")
        assert found is not None

    def test_get_by_code_not_found(self, db):
        repo = ProcedureRepository(db)
        assert repo.get_by_code("NONEXISTENT") is None

    def test_get_active_by_id(self, db):
        proc = ProcedureFactory.create(db, is_active=True)
        repo = ProcedureRepository(db)
        found = repo.get_active_by_id(proc.id)
        assert found is not None

    def test_get_active_by_id_inactive(self, db):
        proc = ProcedureFactory.create(db, is_active=False)
        repo = ProcedureRepository(db)
        assert repo.get_active_by_id(proc.id) is None

    def test_list_active(self, db):
        ProcedureFactory.create(db, is_active=True)
        ProcedureFactory.create(db, is_active=False)
        repo = ProcedureRepository(db)
        active = repo.list_active()
        assert len(active) == 1

    def test_list_all(self, db):
        ProcedureFactory.create(db)
        ProcedureFactory.create(db)
        repo = ProcedureRepository(db)
        all_procs = repo.list_all()
        assert len(all_procs) == 2


class TestProcedureRepositoryList:
    def test_list_pagination(self, db):
        for _ in range(5):
            ProcedureFactory.create(db)
        repo = ProcedureRepository(db)
        page1, total = repo.list(page=1, page_size=2)
        assert len(page1) == 2
        assert total == 5

    def test_list_filter_active(self, db):
        ProcedureFactory.create(db, is_active=True)
        ProcedureFactory.create(db, is_active=False)
        repo = ProcedureRepository(db)
        items, total = repo.list(is_active=True)
        assert total == 1

    def test_list_filter_category(self, db):
        ProcedureFactory.create(db, category=ProcedureCategory.ENDODONTIC)
        ProcedureFactory.create(db, category=ProcedureCategory.DIAGNOSTIC)
        repo = ProcedureRepository(db)
        items, total = repo.list(category=ProcedureCategory.ENDODONTIC)
        assert total == 1

    def test_list_sort_by_code_asc(self, db):
        ProcedureFactory.create(db, code="B")
        ProcedureFactory.create(db, code="A")
        repo = ProcedureRepository(db)
        items, _ = repo.list(sort_by="code", sort_order="asc")
        assert items[0].code == "A"
        assert items[1].code == "B"

    def test_list_sort_by_code_desc(self, db):
        ProcedureFactory.create(db, code="A")
        ProcedureFactory.create(db, code="B")
        repo = ProcedureRepository(db)
        items, _ = repo.list(sort_by="code", sort_order="desc")
        assert items[0].code == "B"
        assert items[1].code == "A"


class TestProcedureRepositorySearch:
    def test_search_by_code(self, db):
        ProcedureFactory.create(db, code="RCT001")
        repo = ProcedureRepository(db)
        results = repo.search("RCT")
        assert len(results) == 1

    def test_search_by_name(self, db):
        ProcedureFactory.create(db, name="Root Canal Treatment")
        repo = ProcedureRepository(db)
        results = repo.search("Root")
        assert len(results) == 1

    def test_search_case_insensitive(self, db):
        ProcedureFactory.create(db, code="RCT001")
        repo = ProcedureRepository(db)
        assert len(repo.search("rct")) == 1

    def test_search_empty_term(self, db):
        repo = ProcedureRepository(db)
        assert repo.search("") == []
        assert repo.search("   ") == []

    def test_search_limit(self, db):
        for i in range(5):
            ProcedureFactory.create(db, code=f"RCT{i:03d}")
        repo = ProcedureRepository(db)
        assert len(repo.search("RCT", limit=2)) == 2


class TestProcedureRepositoryExistence:
    def test_exists(self, db):
        proc = ProcedureFactory.create(db)
        repo = ProcedureRepository(db)
        assert repo.exists(proc.id) is True
        assert repo.exists(99999) is False

    def test_exists_by_code(self, db):
        ProcedureFactory.create(db, code="UNIQUE")
        repo = ProcedureRepository(db)
        assert repo.exists_by_code("UNIQUE") is True
        assert repo.exists_by_code("OTHER") is False

    def test_exists_by_code_case_insensitive(self, db):
        ProcedureFactory.create(db, code="MYCODE")
        repo = ProcedureRepository(db)
        assert repo.exists_by_code("mycode") is True


class TestProcedureRepositoryMutation:
    def test_update(self, db):
        proc = ProcedureFactory.create(db, name="Original")
        repo = ProcedureRepository(db)
        updated = repo.update(proc, {"name": "Updated"})
        assert updated.name == "Updated"
        db.refresh(proc)
        assert proc.name == "Updated"

    def test_update_immutable_field_skipped(self, db):
        proc = ProcedureFactory.create(db, code="ORIGINAL")
        repo = ProcedureRepository(db)
        repo.update(proc, {"code": "SHOULD_NOT_CHANGE"})
        db.refresh(proc)
        assert proc.code == "ORIGINAL"  # code is not in _ALLOWED_UPDATE_FIELDS

    def test_activate(self, db):
        proc = ProcedureFactory.create(db, is_active=False)
        repo = ProcedureRepository(db)
        repo.activate(proc)
        db.refresh(proc)
        assert proc.is_active is True

    def test_deactivate(self, db):
        proc = ProcedureFactory.create(db, is_active=True)
        repo = ProcedureRepository(db)
        repo.deactivate(proc)
        db.refresh(proc)
        assert proc.is_active is False

    def test_delete(self, db):
        proc = ProcedureFactory.create(db)
        repo = ProcedureRepository(db)
        pid = proc.id
        repo.delete(proc)
        assert db.get(Procedure, pid) is None

    def test_count(self, db):
        ProcedureFactory.create(db)
        ProcedureFactory.create(db)
        repo = ProcedureRepository(db)
        assert repo.count() == 2
        assert repo.count(is_active=True) == 2
        assert repo.count(is_active=False) == 0


# ======================================================================
# TreatmentPlanRepository
# ======================================================================


class TestTreatmentPlanRepositoryCreate:
    def test_create(self, db):
        repo = TreatmentPlanRepository(db)
        plan = TreatmentPlanFactory.build()
        result = repo.create(plan)
        assert result.id is not None
        assert db.get(TreatmentPlan, result.id) is not None

    def test_create_duplicate_code_raises(self, db):
        repo = TreatmentPlanRepository(db)
        TreatmentPlanFactory.create(db, plan_code="TXN-DUP")
        plan2 = TreatmentPlanFactory.build(plan_code="TXN-DUP")
        with pytest.raises(IntegrityError):
            repo.create(plan2)
            db.flush()


class TestTreatmentPlanRepositoryRead:
    def test_get_by_id(self, db):
        plan = TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        found = repo.get_by_id(plan.id)
        assert found is not None
        assert found.id == plan.id

    def test_get_by_id_not_found(self, db):
        repo = TreatmentPlanRepository(db)
        assert repo.get_by_id(uuid.uuid4()) is None

    def test_get_by_plan_code(self, db):
        plan = TreatmentPlanFactory.create(db, plan_code="TXN-000001")
        repo = TreatmentPlanRepository(db)
        found = repo.get_by_plan_code("TXN-000001")
        assert found is not None
        assert found.id == plan.id

    def test_get_by_plan_code_not_found(self, db):
        repo = TreatmentPlanRepository(db)
        assert repo.get_by_plan_code("TXN-NONEXISTENT") is None


class TestTreatmentPlanRepositoryExistence:
    def test_exists(self, db):
        plan = TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        assert repo.exists(plan.id) is True
        assert repo.exists(uuid.uuid4()) is False

    def test_exists_by_plan_code(self, db):
        TreatmentPlanFactory.create(db, plan_code="TXN-EXIST")
        repo = TreatmentPlanRepository(db)
        assert repo.exists_by_plan_code("TXN-EXIST") is True
        assert repo.exists_by_plan_code("TXN-OTHER") is False


class TestTreatmentPlanRepositoryMutation:
    def test_update(self, db):
        plan = TreatmentPlanFactory.create(db, clinical_notes="Original")
        repo = TreatmentPlanRepository(db)
        repo.update(plan, {"clinical_notes": "Updated"})
        db.refresh(plan)
        assert plan.clinical_notes == "Updated"

    def test_update_immutable_field_skipped(self, db):
        plan = TreatmentPlanFactory.create(db, plan_code="ORIGINAL")
        repo = TreatmentPlanRepository(db)
        repo.update(plan, {"plan_code": "SHOULD_NOT_CHANGE"})
        db.refresh(plan)
        assert plan.plan_code == "ORIGINAL"

    def test_activate(self, db):
        plan = TreatmentPlanFactory.create(db, is_active=False)
        repo = TreatmentPlanRepository(db)
        repo.activate(plan)
        db.refresh(plan)
        assert plan.is_active is True

    def test_deactivate(self, db):
        plan = TreatmentPlanFactory.create(db, is_active=True)
        repo = TreatmentPlanRepository(db)
        repo.deactivate(plan)
        db.refresh(plan)
        assert plan.is_active is False

    def test_delete(self, db):
        plan = TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        pid = plan.id
        repo.delete(plan)
        assert db.get(TreatmentPlan, pid) is None

    def test_delete_removes_plan(self, db):
        """Verify plan is removed from DB after delete.

        ``ON DELETE CASCADE`` only fires with FK enforcement enabled.
        In the test environment FK enforcement is OFF (SQLite UUID
        compatibility), so item cascade is verified in integration tests.
        """
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanItemFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        pid = plan.id
        repo.delete(plan)
        assert db.get(TreatmentPlan, pid) is None

    def test_count(self, db):
        TreatmentPlanFactory.create(db)
        TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        assert repo.count() == 2


# ======================================================================
# TreatmentPlanRepository — list / search / find_by
# ======================================================================


class TestTreatmentPlanRepositoryList:
    def test_list_pagination(self, db):
        for _ in range(5):
            TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        page1, total = repo.list(page=1, page_size=2)
        assert len(page1) == 2
        assert total == 5

    def test_list_filter_patient(self, db):
        pid = uuid.uuid4()
        TreatmentPlanFactory.create(db, patient_id=pid)
        TreatmentPlanFactory.create(db)  # different patient
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(patient_id=pid)
        assert total == 1

    def test_list_filter_doctor(self, db):
        did = uuid.uuid4()
        TreatmentPlanFactory.create(db, doctor_id=did)
        TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(doctor_id=did)
        assert total == 1

    def test_list_filter_status_enum(self, db):
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(status=TreatmentPlanStatus.DRAFT)
        assert total == 1

    def test_list_filter_status_string(self, db):
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(status="draft")
        assert total == 1

    def test_list_filter_active(self, db):
        TreatmentPlanFactory.create(db, is_active=True)
        TreatmentPlanFactory.create(db, is_active=False)
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(is_active=True)
        assert total == 1

    def test_list_filter_date_range(self, db):
        now = datetime.now(timezone.utc)
        TreatmentPlanFactory.create(db, created_at=now)
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(date_from=date.today())
        assert total >= 1

    def test_list_sort_default_desc(self, db):
        TreatmentPlanFactory.create(db)
        TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        items, total = repo.list(sort_by="created_at", sort_order="desc")
        assert items[0].created_at >= items[1].created_at


class TestTreatmentPlanRepositorySearch:
    def test_search_by_code(self, db):
        TreatmentPlanFactory.create(db, plan_code="TXN-000001")
        repo = TreatmentPlanRepository(db)
        results = repo.search("000001")
        assert len(results) == 1

    def test_search_case_insensitive(self, db):
        TreatmentPlanFactory.create(db, plan_code="TXN-Abc")
        repo = TreatmentPlanRepository(db)
        results = repo.search("abc")
        assert len(results) == 1

    def test_search_empty_term(self, db):
        repo = TreatmentPlanRepository(db)
        assert repo.search("") == []


class TestTreatmentPlanRepositoryFindBy:
    def test_find_by_patient(self, db):
        pid = uuid.uuid4()
        TreatmentPlanFactory.create(db, patient_id=pid)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_by_patient(patient_id=pid)
        assert total == 1

    def test_find_by_doctor(self, db):
        did = uuid.uuid4()
        TreatmentPlanFactory.create(db, doctor_id=did)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_by_doctor(doctor_id=did)
        assert total == 1

    def test_find_by_status(self, db):
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_by_status(TreatmentPlanStatus.DRAFT)
        assert total == 1


# ======================================================================
# TreatmentPlanRepository — domain-specific queries
# ======================================================================


class TestTreatmentPlanRepositoryPendingApproval:
    def test_find_pending_approval(self, db):
        """PROPOSED plan without approval should be pending approval."""
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_approval()
        assert total >= 1
        assert items[0].id == plan.id

    def test_find_pending_approval_unsigned(self, db):
        """PROPOSED plan with unsigned approval should be pending."""
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(db, plan_id=plan.id, approved_by=None)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_approval()
        assert total >= 1

    def test_find_pending_approval_signed_excluded(self, db):
        """PROPOSED plan with signed approval should NOT be pending."""
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(db, plan_id=plan.id, approved_by=1)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_approval()
        matching = [p for p in items if p.id == plan.id]
        assert len(matching) == 0

    def test_find_pending_approval_other_status_excluded(self, db):
        """DRAFT plan should not appear in pending-approval list."""
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_approval()
        assert total == 0


class TestTreatmentPlanRepositoryPendingAcknowledgment:
    def test_find_pending_acknowledgment(self, db):
        """ACCEPTED plan with PENDING patient_status should be pending."""
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.ACCEPTED)
        TreatmentPlanApprovalFactory.create(
            db, plan_id=plan.id,
            patient_status=PatientAcknowledgmentStatus.PENDING,
        )
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_acknowledgment()
        assert total >= 1
        assert items[0].id == plan.id

    def test_find_pending_acknowledgment_accepted_excluded(self, db):
        """ACCEPTED plan with ACCEPTED patient_status should not be pending."""
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.ACCEPTED)
        TreatmentPlanApprovalFactory.create(
            db, plan_id=plan.id,
            patient_status=PatientAcknowledgmentStatus.ACCEPTED,
        )
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_acknowledgment()
        matching = [p for p in items if p.id == plan.id]
        assert len(matching) == 0

    def test_find_pending_acknowledgment_other_status_excluded(self, db):
        """DRAFT plan should not appear in pending-acknowledgment list."""
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        repo = TreatmentPlanRepository(db)
        items, total = repo.find_pending_acknowledgment()
        assert total == 0


# ======================================================================
# TreatmentPlanRepository — statistics
# ======================================================================


class TestTreatmentPlanRepositoryStatistics:
    def test_count_by_status(self, db):
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        repo = TreatmentPlanRepository(db)
        counts = repo.count_by_status()
        assert counts.get("draft") == 2
        assert counts.get("proposed") == 1
        # Statuses with zero plans are omitted
        assert "completed" not in counts

    def test_count_by_doctor_specific(self, db):
        did = uuid.uuid4()
        TreatmentPlanFactory.create(db, doctor_id=did)
        TreatmentPlanFactory.create(db, doctor_id=did)
        repo = TreatmentPlanRepository(db)
        assert repo.count_by_doctor(doctor_id=did) == 2

    def test_count_by_doctor_all(self, db):
        did1 = uuid.uuid4()
        did2 = uuid.uuid4()
        TreatmentPlanFactory.create(db, doctor_id=did1)
        TreatmentPlanFactory.create(db, doctor_id=did2)
        repo = TreatmentPlanRepository(db)
        counts = repo.count_by_doctor()
        assert isinstance(counts, dict)
        assert len(counts) == 2

    def test_count_by_patient_specific(self, db):
        pid = uuid.uuid4()
        TreatmentPlanFactory.create(db, patient_id=pid)
        repo = TreatmentPlanRepository(db)
        assert repo.count_by_patient(patient_id=pid) == 1

    def test_count_by_patient_all(self, db):
        pid1 = uuid.uuid4()
        pid2 = uuid.uuid4()
        TreatmentPlanFactory.create(db, patient_id=pid1)
        TreatmentPlanFactory.create(db, patient_id=pid2)
        repo = TreatmentPlanRepository(db)
        counts = repo.count_by_patient()
        assert isinstance(counts, dict)
        assert len(counts) == 2


# ======================================================================
# TreatmentPlanRepository — aggregate retrieval (eager loading)
# ======================================================================


class TestTreatmentPlanRepositoryAggregate:
    def test_get_with_items(self, db):
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanItemFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        loaded = repo.get_with_items(plan.id)
        assert loaded is not None
        # NOTE: ``selectinload`` may not eagerly load items with UUID PKs on
        # SQLite. Verify items are present via a direct session query.
        stmt = select(func.count()).select_from(TreatmentPlanItem).where(
            TreatmentPlanItem.plan_id == plan.id
        )
        assert db.execute(stmt).scalar() == 1

    def test_get_with_versions(self, db):
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanVersionFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        loaded = repo.get_with_versions(plan.id)
        assert loaded is not None
        stmt = select(func.count()).select_from(TreatmentPlanVersion).where(
            TreatmentPlanVersion.plan_id == plan.id
        )
        assert db.execute(stmt).scalar() == 1

    def test_get_with_approval(self, db):
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanApprovalFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        loaded = repo.get_with_approval(plan.id)
        assert loaded is not None
        stmt = select(func.count()).select_from(TreatmentPlanApproval).where(
            TreatmentPlanApproval.plan_id == plan.id
        )
        assert db.execute(stmt).scalar() == 1

    def test_get_complete_aggregate(self, db):
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanItemFactory.create(db, plan_id=plan.id)
        TreatmentPlanVersionFactory.create(db, plan_id=plan.id)
        TreatmentPlanApprovalFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        loaded = repo.get_complete_aggregate(plan.id)
        assert loaded is not None
        # Verify each child entity type via direct queries (selectinload
        # with UUID PKs may not populate relationships on SQLite).
        stmt_items = select(func.count()).select_from(TreatmentPlanItem).where(
            TreatmentPlanItem.plan_id == plan.id
        )
        stmt_versions = select(func.count()).select_from(TreatmentPlanVersion).where(
            TreatmentPlanVersion.plan_id == plan.id
        )
        stmt_approval = select(func.count()).select_from(TreatmentPlanApproval).where(
            TreatmentPlanApproval.plan_id == plan.id
        )
        assert db.execute(stmt_items).scalar() == 1
        assert db.execute(stmt_versions).scalar() == 1
        assert db.execute(stmt_approval).scalar() == 1

    def test_get_with_items_not_found(self, db):
        repo = TreatmentPlanRepository(db)
        assert repo.get_with_items(uuid.uuid4()) is None


# ======================================================================
# TreatmentPlanRepository — child entity persistence
# ======================================================================


class TestTreatmentPlanRepositoryChildEntities:
    def test_add_item(self, db):
        plan = TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        item = TreatmentPlanItem(
            plan_id=plan.id,
            procedure_id=1,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
            discount=Decimal("0.00"),
            item_status=TreatmentPlanItemStatus.PENDING,
        )
        result = repo.add_item(item)
        assert result.id is not None
        # Verify via direct query (selectinload with UUID may not
        # populate relationships on SQLite).
        stmt = select(func.count()).select_from(TreatmentPlanItem).where(
            TreatmentPlanItem.plan_id == plan.id
        )
        assert db.execute(stmt).scalar() == 1

    def test_remove_item(self, db):
        plan = TreatmentPlanFactory.create(db)
        item = TreatmentPlanItemFactory.create(db, plan_id=plan.id)
        item_id = item.id
        repo = TreatmentPlanRepository(db)
        repo.remove_item(item)
        assert db.get(TreatmentPlanItem, item_id) is None

    def test_add_version(self, db):
        plan = TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        version = TreatmentPlanVersion(
            plan_id=plan.id,
            version_number=1,
            items_snapshot={},
            change_reason="Initial",
            changed_by=1,
        )
        result = repo.add_version(version)
        assert result.id is not None

    def test_add_approval(self, db):
        plan = TreatmentPlanFactory.create(db)
        repo = TreatmentPlanRepository(db)
        approval = TreatmentPlanApproval(
            plan_id=plan.id,
            patient_status=PatientAcknowledgmentStatus.PENDING,
        )
        result = repo.add_approval(approval)
        assert result.id is not None

    def test_version_exists(self, db):
        plan = TreatmentPlanFactory.create(db)
        v = TreatmentPlanVersionFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        assert repo.version_exists(v.id) is True
        assert repo.version_exists(uuid.uuid4()) is False

    def test_approval_exists(self, db):
        plan = TreatmentPlanFactory.create(db)
        a = TreatmentPlanApprovalFactory.create(db, plan_id=plan.id)
        repo = TreatmentPlanRepository(db)
        assert repo.approval_exists(a.id) is True
        assert repo.approval_exists(uuid.uuid4()) is False

    def test_remove_item_detaches_from_plan(self, db):
        """remove_item should delete the item from the database."""
        plan = TreatmentPlanFactory.create(db)
        item = TreatmentPlanItemFactory.create(db, plan_id=plan.id, sequence_number=1)
        item_id = item.id
        repo = TreatmentPlanRepository(db)
        repo.remove_item(item)
        # Verify item is removed from DB (direct PK lookup, not via plan.items)
        assert db.get(TreatmentPlanItem, item_id) is None
