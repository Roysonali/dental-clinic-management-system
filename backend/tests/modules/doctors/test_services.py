import uuid
from datetime import date, time
from decimal import Decimal
from unittest.mock import MagicMock, call, patch

import pytest
from sqlalchemy.exc import IntegrityError

from app.modules.doctors.models import Doctor, DoctorSchedule, DoctorSpecialization, Specialization
from app.modules.doctors.services.doctor_service import DoctorService
from app.modules.doctors.services.schedule_service import ScheduleService
from app.modules.doctors.services.specialization_service import SpecializationService
from app.modules.doctors.schemas import DoctorCreate, DoctorUpdate, ScheduleCreate, ScheduleUpdate, SpecializationCreate, SpecializationUpdate
from app.modules.doctors.exceptions import (
    DoctorNotFound, DoctorCreationFailed, DoctorUpdateFailed,
    InvalidDoctorOperation, DuplicateDoctorDetected,
    DoctorValidationFailed, NotADoctorUser, DoctorUserNotFound,
    SpecializationNotFound, ScheduleNotFound, ScheduleCreationFailed,
    SpecializationCreationFailed, SpecializationUpdateFailed,
    SpecializationValidationFailed,
)
from app.modules.doctors.constants import ERR_DOCTOR_NOT_FOUND
from app.core.constants import USER_STATUS_ACTIVE

from pydantic import HttpUrl


# ======================================================================
# Regression: Pydantic HttpUrl → str for psycopg2 compatibility
# ======================================================================


class TestDoctorCreateWithPhotoUrl:
    """Regression: verify profile_photo_url (Pydantic HttpUrl) is converted to
    str before reaching the ORM model / psycopg2.

    In production, passing an HttpUrl object to PostgreSQL via psycopg2
    raises "can't adapt type 'HttpUrl'". The service layer is responsible
    for converting HttpUrl → str at the domain-to-persistence boundary.
    """

    def test_create_with_valid_profile_photo_url(
        self, db, doctor_user, admin_user
    ):
        """Creating a doctor with a profile_photo_url should succeed, and the
        value stored in the database should be a plain string (not HttpUrl)."""
        from app.modules.doctors.services.doctor_service import DoctorService
        from app.modules.doctors.schemas import DoctorCreate

        service = DoctorService(db)
        payload = DoctorCreate(
            user_id=doctor_user.id,
            primary_phone="+639171234567",
            profile_photo_url=HttpUrl("https://example.com/photo.jpg"),
        )
        doctor = service.create_doctor(payload, actor_id=admin_user.id)

        # Verify the ORM attribute is a plain string, not an HttpUrl
        assert isinstance(doctor.profile_photo_url, str), (
            f"Expected str, got {type(doctor.profile_photo_url)}"
        )
        assert doctor.profile_photo_url == "https://example.com/photo.jpg"

        # Verify the database also stores a plain string
        db.expire(doctor)  # Force reload from DB
        reloaded = db.get(type(doctor), doctor.id)
        assert isinstance(reloaded.profile_photo_url, str)
        assert reloaded.profile_photo_url == "https://example.com/photo.jpg"

    def test_create_without_profile_photo_url(
        self, db, doctor_user, admin_user
    ):
        """Creating a doctor without profile_photo_url should work (None)."""
        from app.modules.doctors.services.doctor_service import DoctorService
        from app.modules.doctors.schemas import DoctorCreate

        service = DoctorService(db)
        payload = DoctorCreate(
            user_id=doctor_user.id,
            primary_phone="+639171234567",
        )
        doctor = service.create_doctor(payload, actor_id=admin_user.id)
        assert doctor.profile_photo_url is None

    def test_create_with_null_profile_photo_url(
        self, db, doctor_user, admin_user
    ):
        """Creating a doctor with profile_photo_url=None should work."""
        from app.modules.doctors.services.doctor_service import DoctorService
        from app.modules.doctors.schemas import DoctorCreate

        service = DoctorService(db)
        payload = DoctorCreate(
            user_id=doctor_user.id,
            primary_phone="+639171234567",
            profile_photo_url=None,
        )
        doctor = service.create_doctor(payload, actor_id=admin_user.id)
        assert doctor.profile_photo_url is None

    def test_update_profile_photo_url(
        self, db, doctor_user, admin_user
    ):
        """Updating profile_photo_url should convert HttpUrl → str."""
        from app.modules.doctors.services.doctor_service import DoctorService
        from app.modules.doctors.schemas import DoctorCreate, DoctorUpdate
        from tests.modules.doctors.conftest import DoctorFactory

        # Create a doctor first without photo
        service = DoctorService(db)
        doctor = DoctorFactory.create(db, user_id=doctor_user.id)

        # Now update the profile_photo_url
        update_payload = DoctorUpdate(
            profile_photo_url=HttpUrl("https://example.com/updated.jpg"),
        )
        updated = service.update_doctor(
            doctor.id, update_payload, actor_id=admin_user.id
        )

        assert isinstance(updated.profile_photo_url, str), (
            f"Expected str, got {type(updated.profile_photo_url)}"
        )
        assert updated.profile_photo_url == "https://example.com/updated.jpg"

    def test_update_clear_profile_photo_url(
        self, db, doctor_user, admin_user
    ):
        """Setting profile_photo_url to None via update should clear it."""
        from app.modules.doctors.services.doctor_service import DoctorService
        from app.modules.doctors.schemas import DoctorUpdate
        from tests.modules.doctors.conftest import DoctorFactory

        # Create a doctor with a photo URL
        doctor = DoctorFactory.create(
            db, user_id=doctor_user.id,
            profile_photo_url="https://example.com/photo.jpg",
        )
        assert doctor.profile_photo_url is not None

        # Update to clear it
        service = DoctorService(db)
        update_payload = DoctorUpdate(profile_photo_url=None)
        updated = service.update_doctor(
            doctor.id, update_payload, actor_id=admin_user.id
        )
        assert updated.profile_photo_url is None

