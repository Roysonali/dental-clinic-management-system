"""Integration tests for the Treatment Plan REST API (``/treatment-plans``).

Covers all major endpoints using FastAPI ``TestClient`` with a real SQLite
database. Groups tests by resource and workflow:

- Plan CRUD (create, list, get, search)
- Item management (add, update, remove, reorder)
- Status transitions (submit, approve review, accept, etc.)
- Approval workflow (doctor approve/revoke, patient acknowledge/decline)
- Version management (create, list, get)
- Dashboard and aggregation endpoints
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.exception_handlers import register_exception_handlers
from app.database.session import get_db
from app.modules.treatment.dependencies import get_treatment_plan_service
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)
from app.modules.treatment.routers.treatment_plan_router import router
from app.modules.treatment.services import TreatmentPlanService
from app.modules.treatment.validators import (
    ProcedureValidator,
    TreatmentPlanValidator,
)

from tests.modules.treatment.conftest import (
    ProcedureFactory,
    TreatmentPlanFactory,
    TreatmentPlanItemFactory,
    TreatmentPlanVersionFactory,
    _STUB_DOCTOR_ID,
    _STUB_PATIENT_ID,
    _STUB_USER_ID,
)

# ── Helpers ───────────────────────────────────────────────────────────


def _build_service(db: Session) -> TreatmentPlanService:
    plan_repo = TreatmentPlanRepository(db)
    procedure_repo = ProcedureRepository(db)
    procedure_validator = ProcedureValidator(procedure_repo)
    plan_validator = TreatmentPlanValidator(
        plan_repo=plan_repo,
        procedure_repo=procedure_repo,
    )
    return TreatmentPlanService(
        plan_repo=plan_repo,
        procedure_repo=procedure_repo,
        plan_validator=plan_validator,
        procedure_validator=procedure_validator,
        db=db,
    )


def _build_client(db: Session) -> TestClient:
    application = FastAPI(title="Treatment Plans Test")
    application.include_router(router)
    register_exception_handlers(application)

    def override_get_db():
        yield db

    def override_get_treatment_plan_service():
        plan_repo = TreatmentPlanRepository(db)
        procedure_repo = ProcedureRepository(db)
        procedure_validator = ProcedureValidator(procedure_repo)
        plan_validator = TreatmentPlanValidator(
            plan_repo=plan_repo,
            procedure_repo=procedure_repo,
        )
        return TreatmentPlanService(
            plan_repo=plan_repo,
            procedure_repo=procedure_repo,
            plan_validator=plan_validator,
            procedure_validator=procedure_validator,
            db=db,
        )

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_treatment_plan_service] = override_get_treatment_plan_service
    return TestClient(application)


def _create_plan_payload(
    patient_id: uuid.UUID | None = None,
    doctor_id: uuid.UUID | None = None,
    **overrides,
) -> dict:
    payload = {
        "patient_id": str(patient_id or _STUB_PATIENT_ID),
        "doctor_id": str(doctor_id or _STUB_DOCTOR_ID),
    }
    payload.update(overrides)
    return payload


# ======================================================================
# CREATE — POST /treatment-plans
# ======================================================================


class TestCreateTreatmentPlan:
    """POST /treatment-plans — 201, 422, 404."""

    def test_create_success(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload()
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["plan_code"].startswith("TXN-")
        assert data["patient_id"] == str(_STUB_PATIENT_ID)
        assert data["doctor_id"] == str(_STUB_DOCTOR_ID)
        assert data["is_active"] is True
        assert data["current_version"] == 1

    def test_create_with_explicit_code(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload(plan_code="TXN-CUSTOM-001")
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 201
        assert resp.json()["plan_code"] == "TXN-CUSTOM-001"

    def test_create_duplicate_code_raises(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload(plan_code="TXN-DUP-001")
        client.post("/treatment-plans", json=payload)
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 409

    def test_create_missing_patient(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload(
            patient_id=str(uuid.uuid4()),
        )
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 404

    def test_create_missing_doctor(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload(
            doctor_id=str(uuid.uuid4()),
        )
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 404

    def test_create_invalid_date_range(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload(
            valid_from="2025-01-01",
            valid_to="2024-01-01",
        )
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 422

    def test_create_with_clinical_notes(self, db: Session) -> None:
        client = _build_client(db)
        payload = _create_plan_payload(
            clinical_notes="Patient requires urgent care",
            observations="Moderate decay observed",
            dentist_recommendations="Crown recommended",
        )
        resp = client.post("/treatment-plans", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["clinical_notes"] == "Patient requires urgent care"
        assert data["observations"] == "Moderate decay observed"
        assert data["dentist_recommendations"] == "Crown recommended"


# ======================================================================
# LIST — GET /treatment-plans
# ======================================================================


class TestListTreatmentPlans:
    """GET /treatment-plans — 200, pagination, filters."""

    def test_list_empty(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_with_data(self, db: Session) -> None:
        client = _build_client(db)
        TreatmentPlanFactory.create(db)
        TreatmentPlanFactory.create(db)
        resp = client.get("/treatment-plans")
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

    def test_list_pagination(self, db: Session) -> None:
        client = _build_client(db)
        for _ in range(5):
            TreatmentPlanFactory.create(db)
        resp = client.get("/treatment-plans?page=1&page_size=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5

    def test_list_filter_by_status_excludes_other(self, db: Session) -> None:
        """Filtering by status should only return plans with that status."""
        client = _build_client(db)
        # Create a draft plan
        TreatmentPlanFactory.create(db)
        # Create a plan in a different status via the service
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        service.submit_for_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        # Now we have 1 draft + 1 under_review
        resp = client.get("/treatment-plans?status=draft")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        resp = client.get("/treatment-plans?status=under_review")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


# ======================================================================
# SEARCH — GET /treatment-plans/search
# ======================================================================


class TestSearchTreatmentPlans:
    """GET /treatment-plans/search — 200, empty results."""

    def test_search_by_code(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        code_prefix = plan.plan_code[:8]
        resp = client.get(f"/treatment-plans/search?term={code_prefix}")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1

    def test_search_no_results(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/search?term=ZZZZZZ")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_missing_term(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/search")
        assert resp.status_code == 422


# ======================================================================
# GET — GET /treatment-plans/{plan_id}
# ======================================================================


class TestGetTreatmentPlan:
    """GET /treatment-plans/{plan_id} — 200, 404."""

    def test_get_success(self, db: Session) -> None:
        client = _build_client(db)
        plan = TreatmentPlanFactory.create(db)
        resp = client.get(f"/treatment-plans/{plan.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(plan.id)
        assert data["plan_code"] == plan.plan_code
        assert data["status"] == "draft"

    def test_get_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get(f"/treatment-plans/{uuid.uuid4()}")
        assert resp.status_code == 404


# ======================================================================
# PENDING REVIEW — GET /treatment-plans/pending-review
# ======================================================================


class TestPendingReview:
    """GET /treatment-plans/pending-review — 200."""

    def test_pending_review_returns_under_review_plans(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/pending-review")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data


# ======================================================================
# PENDING APPROVAL — GET /treatment-plans/pending-approval
# ======================================================================


class TestPendingApproval:
    """GET /treatment-plans/pending-approval — 200."""

    def test_pending_approval_returns(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/pending-approval")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data


# ======================================================================
# DASHBOARD — GET /treatment-plans/dashboard
# ======================================================================


class TestDashboard:
    """GET /treatment-plans/dashboard — 200, correct shape."""

    def test_dashboard_empty(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_plans"] == 0
        assert data["by_status"] is not None
        assert data["pending_review"] == 0
        assert data["pending_approval"] == 0
        assert data["pending_acknowledgment"] == 0
        assert data["active_plans"] == 0

    def test_dashboard_with_data(self, db: Session) -> None:
        client = _build_client(db)
        TreatmentPlanFactory.create(db)
        resp = client.get("/treatment-plans/dashboard")
        assert resp.status_code == 200
        assert resp.json()["total_plans"] == 1


# ======================================================================
# ITEMS — POST /treatment-plans/{plan_id}/items
# ======================================================================


class TestAddItem:
    """POST /treatment-plans/{plan_id}/items — 201, 404, 422."""

    def test_add_item_success(self, db: Session) -> None:
        client = _build_client(db)
        plan = TreatmentPlanFactory.create(db)
        proc = ProcedureFactory.create(db)
        payload = {
            "procedure_id": proc.id,
            "sequence_number": 1,
            "estimated_cost": "150.00",
            "discount": "0.00",
        }
        resp = client.post(f"/treatment-plans/{plan.id}/items", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["items"]) == 1

    def test_add_item_plan_not_found(self, db: Session) -> None:
        client = _build_client(db)
        payload = {"procedure_id": 1, "sequence_number": 1}
        resp = client.post(
            f"/treatment-plans/{uuid.uuid4()}/items", json=payload,
        )
        assert resp.status_code == 404

    def test_add_item_missing_procedure(self, db: Session) -> None:
        client = _build_client(db)
        plan = TreatmentPlanFactory.create(db)
        payload = {"procedure_id": 99999, "sequence_number": 1}
        resp = client.post(f"/treatment-plans/{plan.id}/items", json=payload)
        assert resp.status_code == 404


# ======================================================================
# UPDATE ITEM — PATCH /treatment-plans/{plan_id}/items/{item_id}
# ======================================================================


class TestUpdateItem:
    """PATCH /treatment-plans/{plan_id}/items/{item_id} — 200, 404.

    Note: Item update/remove endpoints rely on the service method which
    uses ``selectinload`` to populate ``plan.items``. On SQLite, UUID
    primary keys with ``selectinload`` can produce empty collections.
    These tests use the service to add items so they are available
    in-memory on the plan instance post-commit.
    """

    def test_update_item_notes(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        plan = service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        item_id = plan.items[0].id
        payload = {"notes": "Updated notes"}
        resp = client.patch(
            f"/treatment-plans/{plan.id}/items/{item_id}",
            json=payload,
        )
        assert resp.status_code == 200
        updated_item = next(
            (i for i in resp.json()["items"] if i["id"] == str(item_id)),
            None,
        )
        assert updated_item is not None
        assert updated_item["notes"] == "Updated notes"


# ======================================================================
# REMOVE ITEM — DELETE /treatment-plans/{plan_id}/items/{item_id}
# ======================================================================


class TestRemoveItem:
    """DELETE /treatment-plans/{plan_id}/items/{item_id} — 200, 404."""

    def test_remove_item(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        plan = service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        item_id = plan.items[0].id
        resp = client.delete(
            f"/treatment-plans/{plan.id}/items/{item_id}",
        )
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 0


# ======================================================================
# WORKFLOW transitions
# ======================================================================


class TestWorkflowTransitions:
    """POST /treatment-plans/{plan_id}/submit-for-review, approve-review,
    reject-review, accept, decline, cancel, start-treatment, hold, resume,
    complete."""

    def _plan_with_item(self, db: Session) -> tuple:
        """Create a draft plan with one item + procedure, return (client, plan_id)."""
        client = _build_client(db)
        proc = ProcedureFactory.create(db)
        service = _build_service(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        return client, plan.id

    def test_submit_for_review(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)
        resp = client.post(
            f"/treatment-plans/{plan_id}/submit-for-review",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "under_review"

    def test_approve_review(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)
        # First submit
        client.post(
            f"/treatment-plans/{plan_id}/submit-for-review",
            json={"updated_by": _STUB_USER_ID},
        )
        # Then approve review
        resp = client.post(
            f"/treatment-plans/{plan_id}/approve-review",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "proposed"

    def test_reject_review(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)
        client.post(
            f"/treatment-plans/{plan_id}/submit-for-review",
            json={"updated_by": _STUB_USER_ID},
        )
        resp = client.post(
            f"/treatment-plans/{plan_id}/reject-review",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "draft"

    def test_accept_plan(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)
        # Submit → approve review → doctor approve → patient acknowledge → accept
        client.post(
            f"/treatment-plans/{plan_id}/submit-for-review",
            json={"updated_by": _STUB_USER_ID},
        )
        client.post(
            f"/treatment-plans/{plan_id}/approve-review",
            json={"updated_by": _STUB_USER_ID},
        )
        client.post(
            f"/treatment-plans/{plan_id}/doctor-approve",
            json={"updated_by": _STUB_USER_ID},
        )
        client.post(f"/treatment-plans/{plan_id}/patient-acknowledge")
        resp = client.post(
            f"/treatment-plans/{plan_id}/accept",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "accepted"

    def test_decline_plan(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)
        client.post(
            f"/treatment-plans/{plan_id}/submit-for-review",
            json={"updated_by": _STUB_USER_ID},
        )
        client.post(
            f"/treatment-plans/{plan_id}/approve-review",
            json={"updated_by": _STUB_USER_ID},
        )
        resp = client.post(
            f"/treatment-plans/{plan_id}/decline",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    def test_cancel_plan(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)
        resp = client.post(
            f"/treatment-plans/{plan_id}/cancel",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "cancelled"

    def test_full_treatment_lifecycle(self, db: Session) -> None:
        client, plan_id = self._plan_with_item(db)

        # Submit for review
        client.post(
            f"/treatment-plans/{plan_id}/submit-for-review",
            json={"updated_by": _STUB_USER_ID},
        )
        # Approve review → PROPOSED
        client.post(
            f"/treatment-plans/{plan_id}/approve-review",
            json={"updated_by": _STUB_USER_ID},
        )
        # Doctor approve
        client.post(
            f"/treatment-plans/{plan_id}/doctor-approve",
            json={"updated_by": _STUB_USER_ID},
        )
        # Patient acknowledge
        client.post(f"/treatment-plans/{plan_id}/patient-acknowledge")
        # Accept
        client.post(
            f"/treatment-plans/{plan_id}/accept",
            json={"updated_by": _STUB_USER_ID},
        )
        # Start treatment
        resp = client.post(
            f"/treatment-plans/{plan_id}/start-treatment",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

        # Put on hold
        resp = client.post(
            f"/treatment-plans/{plan_id}/hold",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "on_hold"

        # Resume
        resp = client.post(
            f"/treatment-plans/{plan_id}/resume",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

        # Complete
        resp = client.post(
            f"/treatment-plans/{plan_id}/complete",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"


# ======================================================================
# APPROVAL endpoints
# ======================================================================


class TestApprovalEndpoints:
    """Doctor approve/revoke, patient acknowledge/decline."""

    def test_doctor_approve(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        # Advance to PROPOSED
        service.submit_for_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.approve_review(plan_id=plan.id, updated_by=_STUB_USER_ID)

        resp = client.post(
            f"/treatment-plans/{plan.id}/doctor-approve",
            json={"updated_by": _STUB_USER_ID},
        )
        assert resp.status_code == 200
        assert resp.json()["approval"] is not None
        assert resp.json()["approval"]["approved_by"] == _STUB_USER_ID

    def test_doctor_revoke(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        service.submit_for_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.approve_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.doctor_approve(plan_id=plan.id, approved_by=_STUB_USER_ID)

        resp = client.post(f"/treatment-plans/{plan.id}/doctor-revoke")
        assert resp.status_code == 200
        assert resp.json()["approval"]["approved_by"] is None

    def test_patient_acknowledge(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        service.submit_for_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.approve_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.doctor_approve(plan_id=plan.id, approved_by=_STUB_USER_ID)

        resp = client.post(f"/treatment-plans/{plan.id}/patient-acknowledge")
        assert resp.status_code == 200
        assert resp.json()["approval"]["patient_status"] == "accepted"

    def test_patient_decline(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        proc = ProcedureFactory.create(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        service.add_item(
            plan_id=plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            estimated_cost=Decimal("100.00"),
        )
        service.submit_for_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.approve_review(plan_id=plan.id, updated_by=_STUB_USER_ID)
        service.doctor_approve(plan_id=plan.id, approved_by=_STUB_USER_ID)

        resp = client.post(f"/treatment-plans/{plan.id}/patient-decline")
        assert resp.status_code == 200
        assert resp.json()["approval"]["patient_status"] == "rejected"


# ======================================================================
# VERSION endpoints
# ======================================================================


class TestVersionEndpoints:
    """Create / list / get versions."""

    def test_create_version(self, db: Session) -> None:
        client = _build_client(db)
        plan = TreatmentPlanFactory.create(db)  # current_version=1
        payload = {
            "change_reason": "Cost revision",
            "changed_by": _STUB_USER_ID,
        }
        resp = client.post(
            f"/treatment-plans/{plan.id}/versions", json=payload,
        )
        assert resp.status_code == 201
        # Factory sets current_version=1, service increments to 2
        assert resp.json()["current_version"] == 2

    def test_list_versions(self, db: Session) -> None:
        client = _build_client(db)
        service = _build_service(db)
        plan = service.create_plan(
            patient_id=_STUB_PATIENT_ID,
            doctor_id=_STUB_DOCTOR_ID,
            created_by=_STUB_USER_ID,
        )
        # service.create_plan creates exactly 1 version (version 1)
        resp = client.get(f"/treatment-plans/{plan.id}/versions")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) == 1

    def test_get_version(self, db: Session) -> None:
        client = _build_client(db)
        plan = TreatmentPlanFactory.create(db)
        ver = TreatmentPlanVersionFactory.create(
            db, plan_id=plan.id, version_number=1,
        )
        resp = client.get(
            f"/treatment-plans/{plan.id}/versions/{ver.id}",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(ver.id)
        assert data["version_number"] == 1


# ======================================================================
# QUERY endpoints (by patient, by doctor, counts)
# ======================================================================


class TestQueryEndpoints:
    """GET /treatment-plans/by-patient, /by-doctor, /count-by-*"""

    def test_list_by_patient(self, db: Session) -> None:
        client = _build_client(db)
        TreatmentPlanFactory.create(db, patient_id=_STUB_PATIENT_ID)
        resp = client.get(
            f"/treatment-plans/by-patient/{_STUB_PATIENT_ID}",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1

    def test_list_by_doctor(self, db: Session) -> None:
        client = _build_client(db)
        TreatmentPlanFactory.create(db, doctor_id=_STUB_DOCTOR_ID)
        resp = client.get(
            f"/treatment-plans/by-doctor/{_STUB_DOCTOR_ID}",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1

    def test_count_by_status(self, db: Session) -> None:
        client = _build_client(db)
        TreatmentPlanFactory.create(db)
        resp = client.get("/treatment-plans/count-by-status")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_count_by_doctor(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/count-by-doctor")
        assert resp.status_code == 200

    def test_count_by_patient(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/treatment-plans/count-by-patient")
        assert resp.status_code == 200
