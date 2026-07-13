"""
Edge Case, Stress, and Boundary Tests for the Doctor Management Module.

Covers:
- Unicode strings (emoji, CJK, special chars, RTL, zero-width)
- Very long strings (max length boundaries)
- Max/min values for integers, decimals, dates
- Empty payloads and null handling
- Invalid enum values
- Repeated idempotent operations
- Concurrent operation stress tests
"""

from __future__ import annotations
from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.core.exception_handlers import register_exception_handlers
from app.modules.doctors.routes import router, specialization_router, schedule_router
from app.database.base import Base
from tests.modules.doctors.conftest import UserFactory, DoctorFactory, SpecializationFactory
from tests.modules.doctors.conftest import engine


# ======================================================================
# Constants & Helpers
# ======================================================================


BASE_PAYLOAD = {
    "primary_phone": "+639171234567",
    "qualification": "DMD",
    "biography": "Experienced dentist.",
}


@pytest.fixture(scope="function")
def app():
    application = FastAPI()
    application.include_router(router)
    application.include_router(specialization_router)
    application.include_router(schedule_router)
    register_exception_handlers(application)
    Base.metadata.create_all(bind=engine)
    return application


@pytest.fixture(scope="function")
def client(app, db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ======================================================================
# Unicode / Non-ASCII Text Tests
# ======================================================================


class TestUnicodeStrings:
    """DoctorCreate: unicode qualification, biography, address."""

    def test_cjk_qualification(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       qualification="Dentista Clinico \u4e2d\u6587")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201
        assert resp.json()["qualification"] is not None

    def test_emoji_biography(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       biography="Doctor \u2728")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_diacritics_address(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       address="\u00c1\u00e9\u00ef\u00f1\u00fc Street")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_arabic_qualification(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       qualification="\u0637\u0628\u064a\u0628")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_zero_width_space_in_biography(self, client, doctor_user, admin_token):
        bio = "Normal\u200btext"
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, biography=bio)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_rtl_mark_in_address(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       address="Clinic\u200fBuilding")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_mixed_script_qualification(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       qualification="\u4e2d\u6587 \u2728")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201


# ======================================================================
# Very Long Strings / Max Length Tests
# ======================================================================


class TestVeryLongStrings:
    """DoctorCreate: boundary tests for text field max_length."""

    def test_max_length_qualification(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       qualification="Q" * 500)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_exceeds_max_length_address(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       address="A" * 501)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_exceeds_max_biography(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       biography="B" * 2001)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_exceeds_max_emergency_contact_name(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       emergency_contact_name="E" * 101,
                       emergency_contact_phone="+639177654321")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_exceeds_max_registration_number(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       registration_number="R" * 101)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422


# ======================================================================
# Max/Min Value Tests
# ======================================================================


class TestMaxMinValues:
    """DoctorCreate: boundary tests for numeric fields."""

    def test_zero_experience(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, years_of_experience=0)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_max_experience(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, years_of_experience=50)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_exceeds_max_experience(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, years_of_experience=51)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_min_consultation_duration(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, consultation_duration=15)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_max_consultation_duration(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, consultation_duration=240)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_min_consultation_fee(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, consultation_fee=0.01)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_zero_consultation_fee_rejected(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, consultation_fee=0.00)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_very_large_fee(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, consultation_fee=99999999.99)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201


# ======================================================================
# Null / Missing Field Handling
# ======================================================================


class TestNullHandling:
    """DoctorCreate: ensure optional fields accept null/missing."""

    def test_all_optional_fields_null(self, client, doctor_user, admin_token):
        payload = {"user_id": doctor_user.id, "primary_phone": "+639171234567"}
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201
        data = resp.json()
        # null fields are excluded from response when response_model_exclude_none=True
        assert "date_of_birth" not in data
        assert "address" not in data
        assert "biography" not in data

    def test_null_languages_known(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, languages_known=None)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_empty_languages_list(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, languages_known=[])
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_null_gender(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, gender=None)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201


# ======================================================================
# Empty Payload / Validation Tests
# ======================================================================


class TestEmptyAndInvalidPayloads:
    """DoctorCreate: malformed, missing, and invalid data rejection."""

    def test_empty_extra_field_rejected(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, unknown_field="should_fail")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_invalid_gender(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, gender="alien")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_biography_whitespace_only(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, biography="   ")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_future_date_of_birth(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       date_of_birth="2099-01-01")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_pre_1900_date_of_birth(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id,
                       date_of_birth="1800-01-01")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_phone_too_short(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, primary_phone="+63917")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_negative_experience(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, years_of_experience=-1)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_registration_number_invalid_chars(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, registration_number="bad!!!")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_registration_number_none(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, registration_number=None)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_phone_with_spaces_and_dashes(self, client, doctor_user, admin_token):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id, primary_phone="+63-917-123-4567")
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 201


# ======================================================================
# Idempotent / Repeated Operations
# ======================================================================


class TestIdempotentOperations:
    """Repeated calls to toggle endpoints produce predictable results."""

    def test_repeated_activate(self, client, admin_token, db):
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="repeat_act@t.com")
        d = DoctorFactory.create(db, user_id=u.id, is_active=False)
        resp1 = client.patch(f"/doctors/{d.id}/activate", headers=auth_header(admin_token))
        assert resp1.status_code == 200
        resp2 = client.patch(f"/doctors/{d.id}/activate", headers=auth_header(admin_token))
        assert resp2.status_code == 400

    def test_repeated_deactivate(self, client, admin_token, doctor):
        resp1 = client.patch(f"/doctors/{doctor.id}/deactivate", headers=auth_header(admin_token))
        assert resp1.status_code == 200
        resp2 = client.patch(f"/doctors/{doctor.id}/deactivate", headers=auth_header(admin_token))
        assert resp2.status_code == 400

    def test_repeated_toggle_leave(self, client, admin_token, doctor):
        for i in range(6):
            resp = client.patch(f"/doctors/{doctor.id}/leave", headers=auth_header(admin_token))
            assert resp.status_code == 200
            expected = (i % 2 == 0)
            assert resp.json()["on_leave"] is expected

    def test_repeated_toggle_availability(self, client, admin_token, doctor):
        for _ in range(6):
            resp = client.patch(f"/doctors/{doctor.id}/availability", headers=auth_header(admin_token))
            assert resp.status_code == 200

    def test_repeated_specialization_assign(self, client, admin_token, doctor, specialization):
        payload = {"specialization_id": specialization.id, "is_primary": True}
        resp1 = client.post(f"/doctors/{doctor.id}/specializations", json=payload, headers=auth_header(admin_token))
        assert resp1.status_code == 201
        resp2 = client.post(f"/doctors/{doctor.id}/specializations", json=payload, headers=auth_header(admin_token))
        assert resp2.status_code == 201

    def test_repeated_schedule_replace(self, client, admin_token, doctor):
        sched = [{"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"}]
        for _ in range(3):
            resp = client.put(f"/doctors/{doctor.id}/schedules", json=sched, headers=auth_header(admin_token))
            assert resp.status_code == 200

    def test_repeated_update_same_field(self, client, admin_token, doctor):
        for _ in range(3):
            resp = client.patch(f"/doctors/{doctor.id}", json={"qualification": "Same Value"},
                               headers=auth_header(admin_token))
            assert resp.status_code == 200
            assert resp.json()["qualification"] == "Same Value"

    def test_create_same_user_rejected(self, client, admin_token, doctor_user, doctor):
        payload = dict(BASE_PAYLOAD, user_id=doctor_user.id)
        resp = client.post("/doctors", json=payload, headers=auth_header(admin_token))
        assert resp.status_code == 409


# ======================================================================
# Immutable Field Protection
# ======================================================================


class TestImmutableFieldProtection:
    """Verify that immutable/read-only fields cannot be modified via update."""

    def test_extra_field_rejected(self, client, admin_token, doctor):
        resp = client.patch(f"/doctors/{doctor.id}", json={"doctor_code": "DOC-NEW"},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_assign_specialization_extra_field(self, client, admin_token, doctor, specialization):
        payload = {"specialization_id": specialization.id, "is_primary": True,
                    "unknown_field": "should_fail"}
        resp = client.post(f"/doctors/{doctor.id}/specializations", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_schedule_create_extra_field(self, client, admin_token, doctor):
        payload = {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00",
                   "extra": "rejected"}
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_specialization_update_extra_field(self, client, admin_token, specialization):
        resp = client.patch(f"/specializations/{specialization.id}", json={"is_active": False},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422


# ======================================================================
# Concurrent / Stress Tests
# ======================================================================


class TestStressSequential:
    """Sequential stress tests (no threading) that validate multiple
    rapid-fire operations against the same doctor.

    These tests are run sequentially rather than concurrently because
    the shared SQLAlchemy session + SQLite backend does not support
    true concurrent writes across threads.
    """

    def test_many_schedule_replace_sequential(self, client, admin_token, doctor):
        """Replace schedule 10 times in sequence to simulate rapid updates."""
        for i in range(10):
            sched = [{"day_of_week": i % 6, "start_time": "09:00", "end_time": "17:00"}]
            resp = client.put(f"/doctors/{doctor.id}/schedules", json=sched,
                              headers=auth_header(admin_token))
            assert resp.status_code == 200, f"Request {i} failed: {resp.status_code}"

    def test_many_doctor_creations_sequential(self, client, admin_token, db):
        """Create 5 doctors sequentially to stress the creation path."""
        for i in range(5):
            u = UserFactory.create(db, role_name="GENERAL_DOCTOR",
                                   email=f"stress{i}@t.com")
            payload = {"user_id": u.id, "primary_phone": "+639171234567"}
            resp = client.post("/doctors", json=payload,
                               headers=auth_header(admin_token))
            assert resp.status_code == 201, f"Creation {i} failed: {resp.status_code}"

    def test_many_status_toggles_sequential(self, client, admin_token, db):
        """Toggle activate/deactivate 5 times on the same doctor.

        Each toggle alternates the doctor's active state, so every
        activate call should succeed (doctor is inactive after deactivate).
        """
        u = UserFactory.create(db, role_name="GENERAL_DOCTOR", email="stress_toggle@t.com")
        d = DoctorFactory.create(db, user_id=u.id, is_active=False)
        for i in range(5):
            resp = client.patch(f"/doctors/{d.id}/activate",
                                headers=auth_header(admin_token))
            assert resp.status_code == 200, f"Activate {i} failed: {resp.status_code}"
            resp = client.patch(f"/doctors/{d.id}/deactivate",
                                headers=auth_header(admin_token))
            assert resp.status_code == 200, f"Deactivate {i} failed: {resp.status_code}"

    def test_many_reads_sequential(self, client, admin_token, doctor):
        """Read the same doctor 20 times sequentially."""
        for i in range(20):
            resp = client.get(f"/doctors/{doctor.id}",
                              headers=auth_header(admin_token))
            assert resp.status_code == 200, f"Read {i} failed: {resp.status_code}"


# ======================================================================
# Boundary / Edge Case Tests for Schedule & Specialization
# ======================================================================


class TestScheduleEdgeCases:
    """Schedule CRUD edge cases: boundaries, odd times, empty state."""

    def test_midnight_to_midnight(self, client, admin_token, doctor):
        payload = {"day_of_week": 0, "start_time": "00:00", "end_time": "23:59"}
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_same_time_rejected(self, client, admin_token, doctor):
        payload = {"day_of_week": 0, "start_time": "09:00", "end_time": "09:00"}
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_schedule_empty_list(self, client, admin_token, doctor):
        resp = client.get(f"/doctors/{doctor.id}/schedules", headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_replace_with_empty_list(self, client, admin_token, doctor, schedule):
        resp = client.put(f"/doctors/{doctor.id}/schedules", json=[],
                          headers=auth_header(admin_token))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_saturday_boundary(self, client, admin_token, doctor):
        payload = {"day_of_week": 5, "start_time": "09:00", "end_time": "17:00"}
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 201

    def test_sunday_rejected(self, client, admin_token, doctor):
        payload = {"day_of_week": 6, "start_time": "09:00", "end_time": "17:00"}
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_delete_nonexistent_schedule(self, client, admin_token, doctor):
        payload = {"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"}
        resp = client.post(f"/doctors/{doctor.id}/schedules", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 201
        sched_id = resp.json()["id"]
        resp = client.delete(f"/doctors/{doctor.id}/schedules/{sched_id}",
                            headers=auth_header(admin_token))
        assert resp.status_code == 204
        resp = client.delete(f"/doctors/{doctor.id}/schedules/{sched_id}",
                            headers=auth_header(admin_token))
        assert resp.status_code == 404


class TestSpecializationEdgeCases:
    """Specialization CRUD edge cases."""

    def test_empty_code_rejected(self, client, admin_token):
        resp = client.post("/specializations", json={"name": "Test", "code": ""},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_empty_name_rejected(self, client, admin_token):
        resp = client.post("/specializations", json={"name": "", "code": "TEST"},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_name_too_short(self, client, admin_token):
        resp = client.post("/specializations", json={"name": "X", "code": "TEST"},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_code_too_long(self, client, admin_token):
        resp = client.post("/specializations", json={"name": "Test", "code": "A" * 21},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_duplicate_name_across_case(self, client, admin_token, db):
        from tests.modules.doctors.conftest import SpecializationFactory
        SpecializationFactory.create(db, name="UniqueName", code="UNQ1")
        resp = client.post("/specializations", json={"name": "UniqueName", "code": "UNQ2"},
                           headers=auth_header(admin_token))
        assert resp.status_code == 422

    def test_assign_nonexistent_specialization(self, client, admin_token, doctor):
        payload = {"specialization_id": 99999, "is_primary": False}
        resp = client.post(f"/doctors/{doctor.id}/specializations", json=payload,
                           headers=auth_header(admin_token))
        assert resp.status_code == 404
