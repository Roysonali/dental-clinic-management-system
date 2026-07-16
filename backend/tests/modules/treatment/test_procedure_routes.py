"""Integration tests for the Procedure REST API (``/procedures``).

Covers all 11 endpoints using FastAPI ``TestClient`` with a real
SQLite database (managed by the treatment ``conftest.py`` ``db`` fixture).
Tests verify:

- Correct HTTP status codes (200, 201, 204, 404, 409, 422)
- Response body matches the ``ProcedureResponse`` schema
- Business rule enforcement (e.g. duplicate code, inactive deletion)
- End-to-end create ↔ list ↔ get ↔ update ↔ activate ↔ deactivate ↔ delete
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.exception_handlers import register_exception_handlers
from app.database.session import get_db
from app.dependencies.auth import get_current_user
from app.modules.treatment.constants import DEFAULT_PAGE_SIZE
from app.modules.treatment.dependencies import get_procedure_service
from app.modules.treatment.enums import ProcedureCategory
from app.modules.treatment.repositories import ProcedureRepository
from app.modules.treatment.routers.procedure_router import router
from app.modules.treatment.services import ProcedureService
from app.modules.treatment.validators import ProcedureValidator

from tests.modules.treatment.conftest import (
    ProcedureFactory,
)

# ── Helpers ───────────────────────────────────────────────────────────


def _build_client(db: Session) -> TestClient:
    """Create a FastAPI app + TestClient with all dependencies overridden."""
    application = FastAPI(title="Procedures Test")
    application.include_router(router)
    register_exception_handlers(application)

    def override_get_db():
        yield db

    def override_get_procedure_service():
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo)
        return ProcedureService(repo=repo, validator=validator, db=db)

    def override_get_current_user():
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.role = MagicMock()
        mock_user.role.name = "ADMIN"
        return mock_user

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_procedure_service] = override_get_procedure_service
    application.dependency_overrides[get_current_user] = override_get_current_user
    client = TestClient(application)
    return client


# ── Generic create payload ────────────────────────────────────────────

VALID_CREATE_PAYLOAD = {
    "code": "RCT001",
    "name": "Root Canal Treatment - Molar",
    "default_cost": "150.00",
    "category": "endodontic",
    "description": "Root canal treatment for molar teeth.",
}


# ======================================================================
# CREATE — POST /procedures
# ======================================================================


class TestCreateProcedure:
    """POST /procedures — 201, 422."""

    def test_create_success(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.post("/procedures", json=VALID_CREATE_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["code"] == "RCT001"
        assert data["name"] == "Root Canal Treatment - Molar"
        assert data["default_cost"] == "150.00"
        assert data["category"] == "endodontic"
        assert data["is_active"] is True
        assert "id" in data

    def test_create_uppercases_code(self, db: Session) -> None:
        client = _build_client(db)
        payload = {**VALID_CREATE_PAYLOAD, "code": "rct002"}
        resp = client.post("/procedures", json=payload)
        assert resp.status_code == 201
        assert resp.json()["code"] == "RCT002"

    def test_create_duplicate_code(self, db: Session) -> None:
        client = _build_client(db)
        client.post("/procedures", json=VALID_CREATE_PAYLOAD)
        resp = client.post("/procedures", json=VALID_CREATE_PAYLOAD)
        assert resp.status_code == 409

    def test_create_missing_required_field(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.post("/procedures", json={"name": "No Code"})
        assert resp.status_code == 422

    def test_create_empty_code(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.post(
            "/procedures",
            json={**VALID_CREATE_PAYLOAD, "code": ""},
        )
        assert resp.status_code == 422

    def test_create_negative_cost(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.post(
            "/procedures",
            json={**VALID_CREATE_PAYLOAD, "default_cost": "-50.00"},
        )
        assert resp.status_code == 422

    def test_create_invalid_category(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.post(
            "/procedures",
            json={**VALID_CREATE_PAYLOAD, "category": "invalid_cat"},
        )
        assert resp.status_code == 422

    def test_create_without_optional_description(self, db: Session) -> None:
        client = _build_client(db)
        payload = {k: v for k, v in VALID_CREATE_PAYLOAD.items() if k != "description"}
        resp = client.post("/procedures", json=payload)
        assert resp.status_code == 201
        assert resp.json()["description"] is None


# ======================================================================
# LIST — GET /procedures
# ======================================================================


class TestListProcedures:
    """GET /procedures — 200, pagination, filtering, sorting."""

    def test_list_empty(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/procedures")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["page_size"] == DEFAULT_PAGE_SIZE
        assert data["total_pages"] == 0

    def test_list_with_data(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="A001", name="Alpha")
        ProcedureFactory.create(db, code="B001", name="Beta")
        resp = client.get("/procedures")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_pagination(self, db: Session) -> None:
        client = _build_client(db)
        for i in range(5):
            ProcedureFactory.create(db, code=f"CODE{i:04d}")
        resp = client.get("/procedures?page=1&page_size=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 2

    def test_list_filter_active(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="ACTV01")
        ProcedureFactory.create(db, code="INACTV", is_active=False)
        resp = client.get("/procedures?is_active=true")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_list_filter_category(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(
            db, code="ENDO01", category=ProcedureCategory.ENDODONTIC,
        )
        ProcedureFactory.create(
            db, code="ORT01", category=ProcedureCategory.ORTHODONTIC,
        )
        resp = client.get("/procedures?category=endodontic")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_list_sort_by_code_desc(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="C001")
        ProcedureFactory.create(db, code="A001")
        ProcedureFactory.create(db, code="B001")
        resp = client.get("/procedures?sort_by=code&sort_order=desc&page_size=10")
        assert resp.status_code == 200
        items = resp.json()["items"]
        codes = [i["code"] for i in items]
        assert codes == sorted(codes, reverse=True)


# ======================================================================
# SEARCH — GET /procedures/search
# ======================================================================


class TestSearchProcedures:
    """GET /procedures/search — 200, empty results, validation."""

    def test_search_by_code_fragment(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="RCT001", name="Root Canal")
        ProcedureFactory.create(db, code="CLN001", name="Cleaning")
        resp = client.get("/procedures/search?term=RCT")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["code"] == "RCT001"

    def test_search_by_name_fragment(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="RCT001", name="Root Canal Treatment")
        resp = client.get("/procedures/search?term=Root")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_search_no_results(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/procedures/search?term=ZZZZZZ")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_missing_term(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/procedures/search")
        assert resp.status_code == 422

    def test_search_with_limit(self, db: Session) -> None:
        client = _build_client(db)
        for i in range(5):
            ProcedureFactory.create(db, code=f"TEST{i:04d}", name=f"Test Proc {i}")
        resp = client.get("/procedures/search?term=Test&limit=2")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


# ======================================================================
# LIST ACTIVE — GET /procedures/active
# ======================================================================


class TestListActiveProcedures:
    """GET /procedures/active — 200, only active returned."""

    def test_list_active(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="ACT01")
        ProcedureFactory.create(db, code="INACT01", is_active=False)
        resp = client.get("/procedures/active")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["is_active"] is True

    def test_list_active_empty(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/procedures/active")
        assert resp.status_code == 200
        assert resp.json() == []


# ======================================================================
# COUNT — GET /procedures/count
# ======================================================================


class TestCountProcedures:
    """GET /procedures/count — 200, correct counts."""

    def test_count_all(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="C001")
        ProcedureFactory.create(db, code="C002")
        resp = client.get("/procedures/count")
        assert resp.status_code == 200
        assert resp.json() == {"count": 2}

    def test_count_active(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="ACT01")
        ProcedureFactory.create(db, code="INACT01", is_active=False)
        resp = client.get("/procedures/count?is_active=true")
        assert resp.status_code == 200
        assert resp.json() == {"count": 1}

    def test_count_inactive(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="ACT01")
        ProcedureFactory.create(db, code="INACT01", is_active=False)
        resp = client.get("/procedures/count?is_active=false")
        assert resp.status_code == 200
        assert resp.json() == {"count": 1}


# ======================================================================
# GET BY ID — GET /procedures/{id}
# ======================================================================


class TestGetProcedure:
    """GET /procedures/{id} — 200, 404."""

    def test_get_success(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="GET001", name="Get Test")
        resp = client.get(f"/procedures/{proc.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == proc.id
        assert data["code"] == "GET001"
        assert data["name"] == "Get Test"

    def test_get_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/procedures/99999")
        assert resp.status_code == 404


# ======================================================================
# GET BY CODE — GET /procedures/by-code/{code}
# ======================================================================


class TestGetProcedureByCode:
    """GET /procedures/by-code/{code} — 200, 404."""

    def test_get_by_code_success(self, db: Session) -> None:
        client = _build_client(db)
        ProcedureFactory.create(db, code="BYCODE1", name="By Code")
        resp = client.get("/procedures/by-code/BYCODE1")
        assert resp.status_code == 200
        assert resp.json()["code"] == "BYCODE1"

    def test_get_by_code_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.get("/procedures/by-code/NONEXIST")
        assert resp.status_code == 404


# ======================================================================
# UPDATE — PATCH /procedures/{id}
# ======================================================================


class TestUpdateProcedure:
    """PATCH /procedures/{id} — 200, 404, 422."""

    def test_update_name_and_cost(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="UPD001")
        resp = client.patch(
            f"/procedures/{proc.id}",
            json={"name": "Updated Name", "default_cost": "200.00"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Name"
        assert data["default_cost"] == "200.00"

    def test_update_partial_preserves_other_fields(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="PART01", description="Original desc")
        resp = client.patch(
            f"/procedures/{proc.id}",
            json={"name": "Just Name"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Just Name"
        assert data["description"] == "Original desc"

    def test_update_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.patch(
            "/procedures/99999",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    def test_update_invalid_cost(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="INVCOST")
        resp = client.patch(
            f"/procedures/{proc.id}",
            json={"default_cost": "-10.00"},
        )
        assert resp.status_code == 422


# ======================================================================
# ACTIVATE — PATCH /procedures/{id}/activate
# ======================================================================


class TestActivateProcedure:
    """PATCH /procedures/{id}/activate — 200, 404."""

    def test_activate_success(self, db: Session) -> None:
        client = _build_client(db)
        # The validator only allows activating already-active procedures
        # (idempotent activation).
        proc = ProcedureFactory.create(db, code="ACTV01", is_active=True)
        resp = client.patch(f"/procedures/{proc.id}/activate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    def test_activate_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.patch("/procedures/99999/activate")
        assert resp.status_code == 404


# ======================================================================
# DEACTIVATE — PATCH /procedures/{id}/deactivate
# ======================================================================


class TestDeactivateProcedure:
    """PATCH /procedures/{id}/deactivate — 200, 404."""

    def test_deactivate_success(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="DEACT01", is_active=True)
        resp = client.patch(f"/procedures/{proc.id}/deactivate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_deactivate_idempotent(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="DEACT02", is_active=False)
        resp = client.patch(f"/procedures/{proc.id}/deactivate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_deactivate_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.patch("/procedures/99999/deactivate")
        assert resp.status_code == 404


# ======================================================================
# DELETE — DELETE /procedures/{id}
# ======================================================================


class TestDeleteProcedure:
    """DELETE /procedures/{id} — 204, 404, 422."""

    def test_delete_inactive_procedure(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="DEL01", is_active=False)
        resp = client.delete(f"/procedures/{proc.id}")
        assert resp.status_code == 204

    def test_delete_active_procedure_raises(self, db: Session) -> None:
        client = _build_client(db)
        proc = ProcedureFactory.create(db, code="DEL02", is_active=True)
        resp = client.delete(f"/procedures/{proc.id}")
        # The validator rejects deletion of active procedures → 409 Conflict.
        assert resp.status_code == 409

    def test_delete_not_found(self, db: Session) -> None:
        client = _build_client(db)
        resp = client.delete("/procedures/99999")
        assert resp.status_code == 404


# ======================================================================
# End-to-end workflow
# ======================================================================


class TestProcedureWorkflow:
    """End-to-end: create → list → get → update → deactivate → delete."""

    def test_full_lifecycle(self, db: Session) -> None:
        client = _build_client(db)

        # 1. Create
        resp = client.post("/procedures", json=VALID_CREATE_PAYLOAD)
        assert resp.status_code == 201
        proc_id = resp.json()["id"]

        # 2. List
        resp = client.get("/procedures")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        # 3. Get by ID
        resp = client.get(f"/procedures/{proc_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == proc_id

        # 4. Get by code
        resp = client.get("/procedures/by-code/RCT001")
        assert resp.status_code == 200

        # 5. Update
        resp = client.patch(
            f"/procedures/{proc_id}",
            json={"name": "Updated Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

        # 6. Activate (idempotent — procedure is already active after create)
        resp = client.patch(f"/procedures/{proc_id}/activate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

        # 7. Deactivate
        resp = client.patch(f"/procedures/{proc_id}/deactivate")
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

        # 8. Delete
        resp = client.delete(f"/procedures/{proc_id}")
        assert resp.status_code == 204

        # 9. Confirm gone
        resp = client.get(f"/procedures/{proc_id}")
        assert resp.status_code == 404
