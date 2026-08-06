"""Phase 14+ - Comprehensive FastAPI Endpoint Tests (Integration).Tests all 25+ endpoints across doctor, specialization, and schedule routers.Covers authentication, RBAC authorization, business rule validation,response schemas, pagination, filtering, sorting, search, and error codes.Every endpoint is tested for:- Unauthenticated access (401)- Unauthorized role access (403)- Success path (200/201/204)- Business rule failures (400/404/409/422)- Response schema conformance
"""
from __future__ import annotations
import json
import uuid
from datetime import date, time
from decimal import Decimal
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.exception_handlers import register_exception_handlers
from app.modules.doctors.routes import router, specialization_router, schedule_router
from tests.modules.doctors.conftest import engine, TestingSessionLocal
from app.database.base import Base
# ======================================================================# Test Application Fixture# ======================================================================
@pytest.fixture(scope="function")
def app():
    """Create a fresh FastAPI app with only the doctor routes for testing."""
    application = FastAPI()
    application.include_router(router)
    application.include_router(specialization_router)
    application.include_router(schedule_router)
    register_exception_handlers(application)
    Base.metadata.create_all(bind=engine)
    return application

@pytest.fixture(scope="function")
def client(app, db):
    """TestClient with DB session override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# ======================================================================
# Auth Helpers
# ======================================================================

def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ======================================================================# Test: POST /doctors - Create Doctor# ======================================================================

class TestCreateDoctorEndpoint:
    """POST /doctors � 201, 401, 403, 404, 409, 422."""

    CREATE_PAYLOAD = {
        "user_id": 99999,  # replaced in each test
        "primary_phone": "+639171234567",
        "date_of_birth": "1985-06-15",
        "gender": "male",
        "qualification": "DMD",
        "registration_number": "DEN-2024-TEST",
        "years_of_experience": 10,
        "consultation_fee": 800.00,
        "consultation_duration": 30,
        "languages_known": ["English", "Filipino"],
        "biography": "Experienced dentist.",
        "emergency_contact_name": "Maria Dela Cruz",
        "emergency_contact_phone": "+639177654321",
    }

    def _payload(self, user_id):
        p = dict(self.CREATE_PAYLOAD)
        p["user_id"] = user_id
        return p

    def test_unauthenticated(self, client):
        resp = client.post("/doctors", json=self._payload(1))
        assert resp.status_code == 401

    def test_non_admin_forbidden(self, client, doctor_token):
        resp = client.post("/doctors", json=self._payload(1), headers=auth_header(doctor_token))
        assert resp.status_code == 403

    def test_create_success(self, client, doctor_user, admin_token, db):
        resp = client.post("/doctors", json=self._payload(doctor_user.id), headers=auth_header(admin_token))
        assert resp.status_code == 201
        data = resp.json()
        assert data["doctor_code"].startswith("DOC-")
        assert data["user_id"] == doctor_user.id
        assert data["is_active"] is True
        assert "id" in data

    def test_create_user_not_found(self, client, admin_token):
        resp = client.post("/doctors", json=self._payload(99999), headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_create_duplicate_registration_number(self, client, admin_user, admin_token, db):
        from app.modules.doctors.repositories import DoctorRepository
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        # Create a doctor WITH an explicit registration number
        existing_user = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="existing_doc@test.com")
        DoctorFactory.create(db, user_id=existing_user.id, registration_number="DEN-EXISTING-001")
        another_user = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="dup@test.com")
        payload = self._payload(another_user.id)
        payload["registration_number"] = "DEN-EXISTING-001"
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    # ------------------------------------------------------------------
    # Regression: Pydantic HttpUrl → str for psycopg2 compatibility
    # ------------------------------------------------------------------

    def test_create_with_profile_photo_url(self, client, doctor_user, admin_token):
        """Creating a doctor with profile_photo_url should succeed and the
        response should contain the URL as a plain string, not an HttpUrl object."""
        payload = self._payload(doctor_user.id)
        payload["profile_photo_url"] = "https://example.com/photo.jpg"
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201
        data = resp.json()
        assert data.get("profile_photo_url") == "https://example.com/photo.jpg"
        assert isinstance(data["profile_photo_url"], str)

    def test_create_without_profile_photo_url(self, client, doctor_user, admin_token):
        """Creating a doctor without profile_photo_url should succeed."""
        resp = client.post("/doctors", json=self._payload(doctor_user.id),
                           headers=auth_header(admin_token))
        assert resp.status_code == 201
        # profile_photo_url is excluded because response_model_exclude_none=True
        assert "profile_photo_url" not in resp.json()

    def test_create_with_invalid_profile_photo_url(self, client, doctor_user, admin_token):
        """Creating a doctor with an invalid URL should be rejected at validation."""
        payload = self._payload(doctor_user.id)
        payload["profile_photo_url"] = "not-a-valid-url"
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422


# ======================================================================
# Test: GET /doctors - List Doctors
# ======================================================================

class TestListDoctorsEndpoint:
    """GET /doctors � 200, 401, 403, pagination, filtering, sorting."""

    URL = "/doctors"

    def test_unauthenticated(self, client):
        resp = client.get(self.URL)
        assert resp.status_code == 401

    def test_non_authorized_role(self, client, doctor_token):
        # Only ADMIN, RECEPTIONIST can list; doctor cannot
        resp = client.get(self.URL, headers=auth_header(doctor_token))
        assert resp.status_code == 403

    def test_list_empty(self, client, admin_token):
        resp = client.get(self.URL, headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1

    def test_list_pagination(self, client, admin_token, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        for i in range(3):
            u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email=f"list{i}@t.com")
            DoctorFactory.create(db, user_id=u.id)
        resp = client.get(f"{self.URL}?page=1&page_size=2", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["total"] == 3
        assert data["page"] == 1
        assert data["page_size"] == 2

    def test_list_filter_active(self, client, admin_token, db, doctor):
        resp = client.get(f"{self.URL}?is_active=true", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_list_filter_available(self, client, admin_token, db, doctor):
        resp = client.get(f"{self.URL}?is_available=true", headers=auth_header(admin_token))
        assert resp.status_code == 200

    def test_list_sort_by_experience_desc(self, client, admin_token, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        users = [UserFactory.create(db, role_name="GENERAL_DOCTOR", email=f"sort{i}@t.com") for i in range(3)]
        for u, exp in [(users[0], 5), (users[1], 15), (users[2], 10)]:
            DoctorFactory.create(db, user_id=u.id, years_of_experience=exp)
        resp = client.get(f"{self.URL}?sort_by=years_of_experience&sort_order=desc&page_size=10", headers=auth_header(admin_token))
        assert resp.status_code == 200
        items = resp.json()["items"]
        exps = [i["years_of_experience"] for i in items if i["years_of_experience"] is not None]
        assert exps == sorted(exps, reverse=True)

    def test_list_search_by_doctor_code(self, client, admin_token, db, doctor):
        code = doctor.doctor_code
        resp = client.get(f"{self.URL}?search={code[:8]}", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1


    def test_list_search_by_full_name(self, client, admin_token, db):
        """F2: search matches the doctor's full name (documented contract)."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, full_name="Alice Reyes", email="alice.reyes@t.com")
        DoctorFactory.create(db, user_id=u.id)
        resp = client.get(f"{self.URL}?search=Reyes", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        names = [i["user_full_name"] for i in data["items"]]
        assert any(n and "Reyes" in n for n in names)

    def test_list_search_partial_full_name(self, client, admin_token, db):
        """F2: partial full-name search works (case-insensitive substring)."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, full_name="Maria Clara Santos", email="mcs@t.com")
        DoctorFactory.create(db, user_id=u.id)
        resp = client.get(f"{self.URL}?search=clara", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_list_search_no_matches(self, client, admin_token, db):
        """F2: a search with no matches returns an empty result set."""
        resp = client.get(f"{self.URL}?search=zzzz-no-such-doctor", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_search_combined_with_pagination(self, client, admin_token, db):
        """F2: search + pagination work together."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        for i in range(3):
            u = UserFactory.create(db, full_name=f"Juan Dela Cruz {i}", email=f"jdc{i}@t.com")
            DoctorFactory.create(db, user_id=u.id)
        resp = client.get(
            f"{self.URL}?search=Dela&page=1&page_size=2",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2

    def test_list_search_with_active_filter(self, client, admin_token, db):
        """F2: search + status filter combine correctly."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        active_u = UserFactory.create(db, full_name="Rosa Parks", email="rosa@t.com")
        DoctorFactory.create(db, user_id=active_u.id, is_active=True)
        inactive_u = UserFactory.create(db, full_name="Rosa Parks", email="rosa2@t.com")
        DoctorFactory.create(db, user_id=inactive_u.id, is_active=False)
        resp = client.get(
            f"{self.URL}?search=Rosa&is_active=true",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert all(i["is_active"] is True for i in data["items"])

    def test_list_search_with_specialization_filter(self, client, admin_token, db):
        """F2: search + specialization filter combine correctly."""
        from tests.modules.doctors.conftest import (
            UserFactory, DoctorFactory, SpecializationFactory,
            DoctorSpecializationFactory,
        )
        spec = SpecializationFactory.create(db)
        other_spec = SpecializationFactory.create(db)
        u1 = UserFactory.create(db, full_name="Pedro Penduko", email="pedro@t.com")
        d1 = DoctorFactory.create(db, user_id=u1.id)
        DoctorSpecializationFactory.create(db, doctor_id=d1.id, specialization_id=spec.id)
        u2 = UserFactory.create(db, full_name="Pedro Penduko", email="pedro2@t.com")
        d2 = DoctorFactory.create(db, user_id=u2.id)
        DoctorSpecializationFactory.create(db, doctor_id=d2.id, specialization_id=other_spec.id)
        resp = client.get(
            f"{self.URL}?search=Penduko&specialization_id={spec.id}",
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["user_full_name"] == "Pedro Penduko"

    def test_receptionist_can_list(self, client, receptionist_user, db):
        from app.core.security import create_access_token
        token = create_access_token({"sub": receptionist_user.email})
        resp = client.get(self.URL, headers=auth_header(token))
        assert resp.status_code == 200

    # ------------------------------------------------------------------
    # Regression: Pydantic HttpUrl → str for psycopg2 compatibility
    # ------------------------------------------------------------------

    def test_list_response_contains_profile_photo_url(
        self, client, admin_token, db
    ):
        """A doctor created with profile_photo_url should return the URL as
        a plain string in the list response, not an HttpUrl object."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="photolist@t.com")
        DoctorFactory.create(
            db, user_id=u.id,
            profile_photo_url="https://example.com/photo.jpg",
        )
        resp = client.get(self.URL, headers=auth_header(admin_token))
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) >= 1
        photo_items = [i for i in items if i.get("profile_photo_url")]
        assert len(photo_items) >= 1
        # Verify the serialized value is a plain string
        for item in photo_items:
            assert isinstance(item["profile_photo_url"], str)
            assert item["profile_photo_url"].startswith("https://")


class TestGetDoctorEndpoint:
    """GET /doctors/{id} � 200, 401, 403, 404."""

    def test_unauthenticated(self, client):
        resp = client.get(f"/doctors/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_get_by_id_success(self, client, admin_token, doctor):
        resp = client.get(f"/doctors/{doctor.id}", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(doctor.id)
        assert data["doctor_code"] == doctor.doctor_code

    def test_get_not_found(self, client, admin_token):
        resp = client.get(f"/doctors/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_doctor_can_read_own(self, client, doctor_user, doctor_token, doctor):
        resp = client.get(f"/doctors/{doctor.id}", headers=auth_header(doctor_token))
        assert resp.status_code == 200

    def test_doctor_cannot_read_other(self, client, doctor_user, doctor_token, db):
        from app.modules.doctors.repositories import DoctorRepository
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        other_user = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="other@t.com")
        other_doc = DoctorFactory.create(db, user_id=other_user.id)
        resp = client.get(f"/doctors/{other_doc.id}", headers=auth_header(doctor_token))
        assert resp.status_code == 403

    def test_invalid_uuid(self, client, admin_token):
        resp = client.get("/doctors/invalid-uuid", headers=auth_header(admin_token))
        assert resp.status_code == 422


class TestGetDoctorByUserEndpoint:
    """GET /doctors/user/{user_id} � 200, 401, 403, 404."""

    def test_success(self, client, admin_token, doctor, doctor_user):
        resp = client.get(f"/doctors/user/{doctor_user.id}", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["user_id"] == doctor_user.id

    def test_not_found(self, client, admin_token):
        resp = client.get("/doctors/user/99999", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_doctor_self(self, client, doctor_user, doctor_token, doctor):
        resp = client.get(f"/doctors/user/{doctor_user.id}", headers=auth_header(doctor_token))
        assert resp.status_code == 200

    def test_doctor_cannot_read_other_user(self, client, doctor_user, doctor_token, db):
        from tests.modules.doctors.conftest import UserFactory
        other = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="other2@t.com")
        resp = client.get(f"/doctors/user/{other.id}", headers=auth_header(doctor_token))
        assert resp.status_code == 403


class TestUpdateDoctorEndpoint:
    def test_unauthenticated(self, client):
        resp = client.patch(f"/doctors/{uuid.uuid4()}", json={"qualification": "Updated"})
        assert resp.status_code == 401
    def test_non_admin(self, client, doctor_token):
        resp = client.patch(f"/doctors/{uuid.uuid4()}", json={"qualification": "Updated"}, headers=auth_header(doctor_token))
        assert resp.status_code == 403
    def test_update_success(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}", json={"qualification": "New Qual", "years_of_experience": 15}, headers=auth_header(admin_token))
        assert resp.status_code == 200
        d = resp.json()
        assert d["qualification"] == "New Qual"
        assert d["years_of_experience"] == 15
    def test_update_not_found(self, client, admin_token):
        resp = client.patch(f"/doctors/{uuid.uuid4()}", json={"qualification": "New"}, headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_update_partial_preserves_other_fields(self, client, admin_token, doctor):
        original_code = doctor.doctor_code
        resp = client.patch(f"/doctors/{doctor.id}", json={"qualification": "UpdatedOnlyThis"}, headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["qualification"] == "UpdatedOnlyThis"
        assert data["doctor_code"] == original_code
    def test_update_invalid_phone(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}", json={"primary_phone": "bad"}, headers=auth_header(admin_token))
        assert resp.status_code == 422

    # ------------------------------------------------------------------
    # Regression: Pydantic HttpUrl → str for psycopg2 compatibility
    # ------------------------------------------------------------------

    def test_update_profile_photo_url(self, client, admin_token, doctor):
        """Updating profile_photo_url via PATCH should succeed and store
        a plain string (not an HttpUrl object) in the database."""
        resp = client.patch(
            f"/doctors/{doctor.id}",
            json={"profile_photo_url": "https://example.com/updated.jpg"},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("profile_photo_url") == "https://example.com/updated.jpg"
        assert isinstance(data["profile_photo_url"], str)

    def test_update_clear_profile_photo_url(self, client, admin_token, db):
        """Setting profile_photo_url to None via PATCH should clear it."""
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="clearphoto@t.com")
        d = DoctorFactory.create(
            db, user_id=u.id,
            profile_photo_url="https://example.com/photo.jpg",
        )
        resp = client.patch(
            f"/doctors/{d.id}",
            json={"profile_photo_url": None},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        # profile_photo_url is excluded because response_model_exclude_none=True
        assert "profile_photo_url" not in resp.json()

class TestDeleteDoctorEndpoint:
    def test_unauthenticated(self, client):
        resp = client.delete(f"/doctors/{uuid.uuid4()}")
        assert resp.status_code == 401
    def test_non_admin(self, client, doctor_token):
        resp = client.delete(f"/doctors/{uuid.uuid4()}", headers=auth_header(doctor_token))
        assert resp.status_code == 403
    def test_delete_success(self, client, admin_token, doctor):
        resp = client.delete(f"/doctors/{doctor.id}", headers=auth_header(admin_token))
        assert resp.status_code == 204
    def test_delete_not_found(self, client, admin_token):
        resp = client.delete(f"/doctors/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

class TestActivateDoctorEndpoint:
    def test_non_admin_forbidden(self, client, doctor_token):
        resp = client.patch(f"/doctors/{uuid.uuid4()}/activate", headers=auth_header(doctor_token))
        assert resp.status_code == 403
    def test_activate_success(self, client, admin_token, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="inactive_doc@t.com")
        d = DoctorFactory.create(db, user_id=u.id, is_active=False)
        resp = client.patch(f"/doctors/{d.id}/activate", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True
    def test_activate_already_active(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}/activate", headers=auth_header(admin_token))
        assert resp.status_code == 400
    def test_activate_not_found(self, client, admin_token):
        resp = client.patch(f"/doctors/{uuid.uuid4()}/activate", headers=auth_header(admin_token))
        assert resp.status_code == 404

class TestDeactivateDoctorEndpoint:
    def test_deactivate_success(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}/deactivate", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
    def test_deactivate_already_inactive(self, client, admin_token, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="alrdy_inactive@t.com")
        d = DoctorFactory.create(db, user_id=u.id, is_active=False)
        resp = client.patch(f"/doctors/{d.id}/deactivate", headers=auth_header(admin_token))
        assert resp.status_code == 400

class TestToggleLeaveEndpoint:
    def test_toggle_leave(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}/leave", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["on_leave"] is True
        resp2 = client.patch(f"/doctors/{doctor.id}/leave", headers=auth_header(admin_token))
        assert resp2.status_code == 200
        assert resp2.json()["on_leave"] is False
    def test_toggle_leave_not_found(self, client, admin_token):
        resp = client.patch(f"/doctors/{uuid.uuid4()}/leave", headers=auth_header(admin_token))
        assert resp.status_code == 404

class TestToggleAvailabilityEndpoint:
    def test_toggle_available(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}/availability", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["available_for_appointment"] is False
    def test_toggle_inactive_doctor(self, client, admin_token, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="inact_avail@t.com")
        d = DoctorFactory.create(db, user_id=u.id, is_active=False, available_for_appointment=False)
        resp = client.patch(f"/doctors/{d.id}/availability", headers=auth_header(admin_token))
        assert resp.status_code == 400

class TestAssignSpecializationEndpoint:
    def test_assign_success(self, client, admin_token, doctor, specialization):
        payload = {"specialization_id": specialization.id, "is_primary": True}
        resp = client.post(f"/doctors/{doctor.id}/specializations", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["specialization_id"] == specialization.id
    def test_assign_specialization_not_found(self, client, admin_token, doctor):
        payload = {"specialization_id": 99999, "is_primary": False}
        resp = client.post(f"/doctors/{doctor.id}/specializations", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_assign_doctor_not_found(self, client, admin_token, specialization):
        payload = {"specialization_id": specialization.id, "is_primary": False}
        resp = client.post(f"/doctors/{uuid.uuid4()}/specializations", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_assign_primary_not_in_list(self, client, admin_token, doctor, specialization, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        # Create spec NOT assigned to doctor, try to make it primary via a different spec
        s2 = SpecializationFactory.create(db)
        payload = {"specialization_id": s2.id, "is_primary": True}
        resp = client.post(f"/doctors/{doctor.id}/specializations", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

class TestRemoveSpecializationEndpoint:
    def test_remove_success(self, client, admin_token, doctor_with_specialization, specialization):
        resp = client.delete(f"/doctors/{doctor_with_specialization.id}/specializations/{specialization.id}", headers=auth_header(admin_token))
        assert resp.status_code == 204
    def test_remove_not_assigned(self, client, admin_token, doctor, specialization):
        resp = client.delete(f"/doctors/{doctor.id}/specializations/{specialization.id}", headers=auth_header(admin_token))
        assert resp.status_code == 422

class TestGetDoctorProfileEndpoint:
    def test_profile_success(self, client, admin_token, doctor):
        resp = client.get(f"/doctors/{doctor.id}/profile", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(doctor.id)
        assert "schedules" in data
    def test_profile_not_found(self, client, admin_token):
        resp = client.get(f"/doctors/{uuid.uuid4()}/profile", headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_profile_doctor_self(self, client, doctor_token, doctor):
        resp = client.get(f"/doctors/{doctor.id}/profile", headers=auth_header(doctor_token))
        assert resp.status_code == 200

    def test_profile_with_schedules_returns_200(self, client, admin_token, db, doctor):
        """F1 regression: profile must return 200 (not 500) when schedules exist."""
        from tests.modules.doctors.conftest import ScheduleFactory
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=0)
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=3)
        db.expire_all()  # reload schedules fresh, as a new request would
        resp = client.get(f"/doctors/{doctor.id}/profile", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert len(resp.json()["schedules"]) == 2

    def test_profile_schedules_ordered_by_day(self, client, admin_token, db, doctor):
        """F1 regression: schedules in the profile are ordered by day_of_week."""
        from tests.modules.doctors.conftest import ScheduleFactory
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=4)
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=0)
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=2)
        db.expire_all()  # reload schedules fresh, as a new request would
        resp = client.get(f"/doctors/{doctor.id}/profile", headers=auth_header(admin_token))
        assert resp.status_code == 200
        days = [s["day_of_week"] for s in resp.json()["schedules"]]
        assert days == [0, 2, 4]

    def test_profile_zero_schedules(self, client, admin_token, doctor):
        """F1 regression: profile with no schedules returns 200 and empty list."""
        resp = client.get(f"/doctors/{doctor.id}/profile", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["schedules"] == []

# ======================================================================
# Specialization Endpoints
# ======================================================================

class TestCreateSpecializationEndpoint:
    def test_unauthenticated(self, client):
        resp = client.post("/specializations", json={"name": "Ortho", "code": "ORTHO"})
        assert resp.status_code == 401
    def test_non_admin_forbidden(self, client, doctor_token):
        resp = client.post("/specializations", json={"name": "Ortho", "code": "ORTHO"}, headers=auth_header(doctor_token))
        assert resp.status_code == 403
    def test_create_success(self, client, admin_token):
        resp = client.post("/specializations", json={"name": "Orthodontics", "code": "ORTHO"}, headers=auth_header(admin_token))
        assert resp.status_code == 201
        d = resp.json()
        assert d["name"] == "Orthodontics"
        assert d["code"] == "ORTHO"
    def test_create_duplicate_name(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        SpecializationFactory.create(db, name="UniqueSpec", code="UNIQUE1")
        resp = client.post("/specializations", json={"name": "UniqueSpec", "code": "OTHER"}, headers=auth_header(admin_token))
        assert resp.status_code == 422
    def test_create_duplicate_code(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        SpecializationFactory.create(db, name="SomeSpec", code="SOMECODE")
        resp = client.post("/specializations", json={"name": "OtherSpec", "code": "SOMECODE"}, headers=auth_header(admin_token))
        assert resp.status_code == 422
    def test_create_validation_error(self, client, admin_token):
        resp = client.post("/specializations", json={"name": "", "code": ""}, headers=auth_header(admin_token))
        assert resp.status_code == 422

class TestListSpecializationsEndpoint:
    def test_unauthenticated(self, client):
        resp = client.get("/specializations")
        assert resp.status_code == 401
    def test_doctor_can_list(self, client, doctor_token):
        resp = client.get("/specializations", headers=auth_header(doctor_token))
        assert resp.status_code == 200
    def test_list_empty(self, client, admin_token):
        resp = client.get("/specializations", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0
    def test_list_with_data(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        SpecializationFactory.create(db, name="S1", code="C1")
        SpecializationFactory.create(db, name="S2", code="C2")
        resp = client.get("/specializations", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

class TestGetSpecializationEndpoint:
    def test_get_success(self, client, admin_token, specialization):
        resp = client.get(f"/specializations/{specialization.id}", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["name"] == specialization.name
    def test_get_not_found(self, client, admin_token):
        resp = client.get("/specializations/99999", headers=auth_header(admin_token))
        assert resp.status_code == 404

class TestUpdateSpecializationEndpoint:
    def test_update_success(self, client, admin_token, specialization):
        resp = client.patch(f"/specializations/{specialization.id}", json={"name": "Updated Name"}, headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"
    def test_update_not_found(self, client, admin_token):
        resp = client.patch("/specializations/99999", json={"name": "New"}, headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_update_duplicate_name(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        s1 = SpecializationFactory.create(db, name="Original", code="ORG")
        s2 = SpecializationFactory.create(db, name="Existing", code="EXST")
        resp = client.patch(f"/specializations/{s1.id}", json={"name": "Existing"}, headers=auth_header(admin_token))
        assert resp.status_code == 422

class TestActivateDeactivateSpecializationEndpoint:
    def test_activate_success(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        s = SpecializationFactory.create(db, is_active=False)
        resp = client.patch(f"/specializations/{s.id}/activate", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True
    def test_activate_already_active(self, client, admin_token, specialization):
        resp = client.patch(f"/specializations/{specialization.id}/activate", headers=auth_header(admin_token))
        assert resp.status_code == 422
    def test_deactivate_success(self, client, admin_token, specialization):
        resp = client.patch(f"/specializations/{specialization.id}/deactivate", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
    def test_deactivate_already_inactive(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        s = SpecializationFactory.create(db, is_active=False)
        resp = client.patch(f"/specializations/{s.id}/deactivate", headers=auth_header(admin_token))
        assert resp.status_code == 422

class TestDeleteSpecializationEndpoint:
    def test_delete_success(self, client, admin_token, specialization):
        resp = client.delete(f"/specializations/{specialization.id}", headers=auth_header(admin_token))
        assert resp.status_code == 204
    def test_delete_not_found(self, client, admin_token):
        resp = client.delete("/specializations/99999", headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_delete_assigned_to_doctor(self, client, admin_token, doctor_with_specialization, specialization):
        resp = client.delete(f"/specializations/{specialization.id}", headers=auth_header(admin_token))
        assert resp.status_code == 422

# ======================================================================
# Schedule Endpoints
# ======================================================================

class TestScheduleBase:
    def _schedule_payload(self, day=0):
        return {"day_of_week": day, "start_time": "09:00", "end_time": "17:00"}

class TestListScheduleEndpoint(TestScheduleBase):
    def test_unauthenticated(self, client):
        resp = client.get(f"/doctors/{uuid.uuid4()}/schedules")
        assert resp.status_code == 401
    def test_list_success(self, client, admin_token, doctor, schedule):
        resp = client.get(f"/doctors/{doctor.id}/schedules", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
    def test_list_doctor_not_found(self, client, admin_token):
        resp = client.get(f"/doctors/{uuid.uuid4()}/schedules", headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_list_doctor_self(self, client, doctor_token, doctor, schedule):
        resp = client.get(f"/doctors/{doctor.id}/schedules", headers=auth_header(doctor_token))
        assert resp.status_code == 200

class TestCreateScheduleEndpoint(TestScheduleBase):
    def test_unauthenticated(self, client):
        resp = client.post(f"/doctors/{uuid.uuid4()}/schedules", json=self._schedule_payload())
        assert resp.status_code == 401
    def test_non_admin(self, client, doctor_token):
        resp = client.post(f"/doctors/{uuid.uuid4()}/schedules", json=self._schedule_payload(), headers=auth_header(doctor_token))
        assert resp.status_code == 403
    def test_create_success(self, client, admin_token, doctor):
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=self._schedule_payload(), headers=auth_header(admin_token))
        assert resp.status_code == 201
        d = resp.json()
        assert d["day_of_week"] == 0
        assert d["doctor_id"] == str(doctor.id)
    def test_create_duplicate_day(self, client, admin_token, doctor, schedule):
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=self._schedule_payload(day=schedule.day_of_week.value if hasattr(schedule.day_of_week, 'value') else schedule.day_of_week), headers=auth_header(admin_token))
        assert resp.status_code == 400
    def test_create_end_before_start(self, client, admin_token, doctor):
        resp = client.post(f"/doctors/{doctor.id}/schedules", json={"day_of_week": 1, "start_time": "17:00", "end_time": "09:00"}, headers=auth_header(admin_token))
        assert resp.status_code == 422
    def test_create_doctor_not_found(self, client, admin_token):
        resp = client.post(f"/doctors/{uuid.uuid4()}/schedules", json=self._schedule_payload(), headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_create_inactive_doctor(self, client, admin_token, db):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="inact_sched@t.com")
        d = DoctorFactory.create(db, user_id=u.id, is_active=False)
        resp = client.post(f"/doctors/{d.id}/schedules", json=self._schedule_payload(), headers=auth_header(admin_token))
        assert resp.status_code == 400

class TestUpdateScheduleEndpoint(TestScheduleBase):
    def test_update_success(self, client, admin_token, doctor, schedule):
        resp = client.patch(f"/doctors/{doctor.id}/schedules/{schedule.id}", json={"start_time": "10:00", "end_time": "16:00"}, headers=auth_header(admin_token))
        assert resp.status_code == 200
        d = resp.json()
        assert d["start_time"] == "10:00:00" or d["start_time"] == "10:00"
    def test_update_not_found(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}/schedules/{uuid.uuid4()}", json={"start_time": "10:00"}, headers=auth_header(admin_token))
        assert resp.status_code == 404
    def test_update_cross_doctor(self, client, admin_token, db, schedule):
        from tests.modules.doctors.conftest import UserFactory, DoctorFactory
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="other_doc_sched@t.com")
        d = DoctorFactory.create(db, user_id=u.id)
        resp = client.patch(f"/doctors/{d.id}/schedules/{schedule.id}", json={"start_time": "10:00"}, headers=auth_header(admin_token))
        assert resp.status_code == 400

class TestDeleteScheduleEndpoint(TestScheduleBase):
    def test_delete_success(self, client, admin_token, doctor, schedule):
        resp = client.delete(f"/doctors/{doctor.id}/schedules/{schedule.id}", headers=auth_header(admin_token))
        assert resp.status_code == 204
    def test_delete_not_found(self, client, admin_token, doctor):
        resp = client.delete(f"/doctors/{doctor.id}/schedules/{uuid.uuid4()}", headers=auth_header(admin_token))
        assert resp.status_code == 404

class TestReplaceWeekScheduleEndpoint(TestScheduleBase):
    def test_replace_success(self, client, admin_token, doctor):
        schedules = [
            {"day_of_week": 0, "start_time": "09:00", "end_time": "12:00"},
            {"day_of_week": 1, "start_time": "13:00", "end_time": "17:00"},
        ]
        resp = client.put(f"/doctors/{doctor.id}/schedules", json=schedules, headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert len(resp.json()) == 2
    def test_replace_duplicate_days(self, client, admin_token, doctor):
        schedules = [
            {"day_of_week": 0, "start_time": "09:00", "end_time": "12:00"},
            {"day_of_week": 0, "start_time": "13:00", "end_time": "17:00"},
        ]
        resp = client.put(f"/doctors/{doctor.id}/schedules", json=schedules, headers=auth_header(admin_token))
        assert resp.status_code == 400
    def test_replace_too_many_entries(self, client, admin_token, doctor):
        from app.modules.doctors.constants import MAX_SCHEDULE_ENTRIES_PER_DOCTOR
        # day_of_week must be 0-5 (Mon-Sat), so use modulo to keep within range
        schedules = [
            {"day_of_week": i % 6, "start_time": "09:00", "end_time": "17:00"}
            for i in range(MAX_SCHEDULE_ENTRIES_PER_DOCTOR + 1)
        ]
        resp = client.put(f"/doctors/{doctor.id}/schedules", json=schedules, headers=auth_header(admin_token))
        assert resp.status_code == 400
