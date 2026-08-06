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



# ======================================================================
# F1 regression: GET /doctors/{id}/profile must not crash when schedules
# exist, and schedules must be ordered by day_of_week.
# ======================================================================


class TestDoctorProfileScheduleSorting:
    """Regression for the F1 production finding.

    Previously ``get_doctor_profile`` sorted schedules with
    ``key=lambda s: s.day_of_week.value``. ``day_of_week`` is a plain
    Integer column (0=Monday..5=Saturday), NOT an Enum — calling
    ``.value`` raised AttributeError and produced HTTP 500 whenever a
    doctor had at least one schedule.
    """

    def test_profile_with_zero_schedules(self, db, doctor_user, admin_user):
        """A doctor with no schedules loads without error."""
        from tests.modules.doctors.conftest import DoctorFactory
        from app.modules.doctors.services.doctor_service import DoctorService

        doctor = DoctorFactory.create(db, user_id=doctor_user.id)
        service = DoctorService(db)
        profile = service.get_doctor_profile(doctor.id)
        assert profile.schedules == []

    def test_profile_with_one_schedule(self, db, doctor_user, admin_user):
        """A doctor with a single schedule loads without error."""
        from tests.modules.doctors.conftest import DoctorFactory, ScheduleFactory
        from app.modules.doctors.services.doctor_service import DoctorService

        doctor = DoctorFactory.create(db, user_id=doctor_user.id)
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=2)
        # Expire the identity map so the (eagerly-cached empty) schedules
        # collection is reloaded — mirrors a fresh request-scoped session.
        db.expire_all()
        service = DoctorService(db)
        profile = service.get_doctor_profile(doctor.id)
        assert [s.day_of_week for s in profile.schedules] == [2]

    def test_profile_with_multiple_schedules_ordered(self, db, doctor_user, admin_user):
        """Multiple schedules are returned ordered by day_of_week."""
        from tests.modules.doctors.conftest import DoctorFactory, ScheduleFactory
        from app.modules.doctors.services.doctor_service import DoctorService

        doctor = DoctorFactory.create(db, user_id=doctor_user.id)
        # Insert out of order on purpose.
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=4)
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=0)
        ScheduleFactory.create(db, doctor_id=doctor.id, day_of_week=2)
        db.expire_all()
        service = DoctorService(db)
        profile = service.get_doctor_profile(doctor.id)
        assert [s.day_of_week for s in profile.schedules] == [0, 2, 4]
