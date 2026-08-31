"""
Unit tests for Appointment module business logic.

Tests cover:
- Overlap validation (cancelled/no-show freeing slots)
- Status transition lifecycle
- Doctor availability / profile / schedule validation
- Appointment number generation (atomic)
- Terminal appointment protection (edit prevention)
- IntegrityError → 409 mapping

All tests use mocked repositories/services to avoid database dependency.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, time, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.modules.appointments.enums import (
    AppointmentStatus,
    AppointmentType,
)
from app.modules.appointments.exceptions import (
    AppointmentConflictException,
    AppointmentNotFoundException,
    AppointmentValidationException,
    InvalidAppointmentStatusTransition,
)
from app.modules.appointments.model import Appointment
from app.modules.appointments.validators import AppointmentValidator
from app.modules.appointments.sequence import AppointmentSequence


# ==============================================================
# Helpers
# ==============================================================

def make_mock_appointment(
    apt_id=None,
    patient_id=None,
    dentist_id=10,
    appointment_date=None,
    start_time=None,
    end_time=None,
    duration_minutes=30,
    status=AppointmentStatus.SCHEDULED,
    appointment_type=AppointmentType.CONSULTATION,
    reason="Annual checkup",
    appointment_number="APT-20260828-0001",
):
    """Create a mock Appointment ORM with patient and dentist relationships."""
    apt = MagicMock(spec=Appointment)
    apt.id = apt_id or uuid4()
    apt.appointment_number = appointment_number
    apt.patient_id = patient_id or uuid4()
    apt.dentist_id = dentist_id
    apt.appointment_date = appointment_date or date(2026, 8, 28)
    apt.start_time = start_time or time(10, 0)
    apt.end_time = end_time or time(10, 30)
    apt.duration_minutes = duration_minutes
    apt.appointment_type = appointment_type
    apt.status = status
    apt.reason_for_visit = reason
    apt.notes = None
    apt.created_by = 1
    apt.updated_by = None
    apt.created_at = MagicMock()
    apt.updated_at = MagicMock()
    apt.patient = MagicMock()
    apt.patient.first_name = "John"
    apt.patient.middle_name = None
    apt.patient.last_name = "Smith"
    apt.dentist = MagicMock()
    apt.dentist.full_name = "Dr. Sarah Johnson"
    return apt


def make_mock_doctor_profile(
    is_active=True,
    available_for_appointment=True,
    on_leave=False,
    schedules=None,
):
    """Create a mock Doctor profile entity."""
    doctor = MagicMock()
    doctor.is_active = is_active
    doctor.available_for_appointment = available_for_appointment
    doctor.on_leave = on_leave
    doctor.schedules = schedules or []
    return doctor


def make_mock_schedule(day_of_week, start_time, end_time, is_active=True):
    """Create a mock DoctorSchedule entry."""
    sched = MagicMock()
    sched.day_of_week = day_of_week
    sched.start_time = start_time
    sched.end_time = end_time
    sched.is_active = is_active
    return sched


# ==============================================================
# Status Transition Tests
# ==============================================================

class TestStatusTransitions:
    """Tests for AppointmentValidator.validate_status_transition()."""

    def test_scheduled_to_confirmed(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
        )

    def test_scheduled_to_cancelled(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CANCELLED,
        )

    def test_scheduled_to_no_show(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.NO_SHOW,
        )

    def test_confirmed_to_checked_in(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CHECKED_IN,
        )

    def test_confirmed_to_cancelled(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CANCELLED,
        )

    def test_confirmed_to_no_show(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.NO_SHOW,
        )

    def test_checked_in_to_in_treatment(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.IN_TREATMENT,
        )

    def test_in_treatment_to_completed(self):
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.IN_TREATMENT,
            AppointmentStatus.COMPLETED,
        )

    def test_same_status_is_noop(self):
        """Transitioning to the same status should not raise."""
        AppointmentValidator.validate_status_transition(
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.SCHEDULED,
        )

    def test_invalid_scheduled_to_checked_in(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.CHECKED_IN,
            )

    def test_invalid_scheduled_to_in_treatment(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.IN_TREATMENT,
            )

    def test_invalid_scheduled_to_completed(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.SCHEDULED,
                AppointmentStatus.COMPLETED,
            )

    def test_terminal_completed_no_transition(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.COMPLETED,
                AppointmentStatus.SCHEDULED,
            )

    def test_terminal_cancelled_no_transition(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.CANCELLED,
                AppointmentStatus.SCHEDULED,
            )

    def test_terminal_no_show_no_transition(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.NO_SHOW,
                AppointmentStatus.CONFIRMED,
            )

    def test_invalid_completed_to_cancelled(self):
        with pytest.raises(InvalidAppointmentStatusTransition):
            AppointmentValidator.validate_status_transition(
                AppointmentStatus.COMPLETED,
                AppointmentStatus.CANCELLED,
            )


# ==============================================================
# Doctor Availability Tests
# ==============================================================

class TestDoctorAvailability:
    """Tests for AppointmentValidator.validate_doctor_profile()."""

    def test_valid_doctor_profile(self):
        doctor = make_mock_doctor_profile()
        AppointmentValidator.validate_doctor_profile(doctor)

    def test_no_doctor_profile(self):
        with pytest.raises(AppointmentValidationException, match="No doctor profile"):
            AppointmentValidator.validate_doctor_profile(None)

    def test_inactive_doctor_profile(self):
        doctor = make_mock_doctor_profile(is_active=False)
        with pytest.raises(AppointmentValidationException, match="inactive"):
            AppointmentValidator.validate_doctor_profile(doctor)

    def test_unavailable_doctor(self):
        doctor = make_mock_doctor_profile(available_for_appointment=False)
        with pytest.raises(AppointmentValidationException, match="not available"):
            AppointmentValidator.validate_doctor_profile(doctor)

    def test_doctor_on_leave(self):
        doctor = make_mock_doctor_profile(on_leave=True)
        with pytest.raises(AppointmentValidationException, match="on leave"):
            AppointmentValidator.validate_doctor_profile(doctor)


class TestDoctorSchedule:
    """Tests for AppointmentValidator.validate_doctor_schedule()."""

    def test_valid_schedule(self):
        """Appointment within doctor's working hours should pass."""
        schedule = make_mock_schedule(4, time(9, 0), time(17, 0))  # Friday
        doctor = make_mock_doctor_profile(schedules=[schedule])

        # 2026-08-28 is a Friday
        AppointmentValidator.validate_doctor_schedule(
            doctor,
            date(2026, 8, 28),
            time(10, 0),
            time(10, 30),
        )

    def test_no_schedule_falls_back_to_clinic_hours(self):
        """Doctor with no explicit schedule should use clinic default hours."""
        doctor = make_mock_doctor_profile(schedules=[])

        # Friday 10:00-10:30 is within clinic morning hours (10:00-13:00)
        AppointmentValidator.validate_doctor_schedule(
            doctor,
            date(2026, 8, 28),  # Friday
            time(10, 0),
            time(10, 30),
        )

    def test_no_schedule_outside_clinic_hours_rejected(self):
        """Doctor with no schedule, time outside clinic hours, should fail."""
        doctor = make_mock_doctor_profile(schedules=[])

        with pytest.raises(AppointmentValidationException, match="falls outside"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 28),  # Friday
                time(14, 0),
                time(15, 0),
            )

    def test_no_schedule_sunday_rejected(self):
        """Doctor with no schedule on Sunday (non-working day) should fail."""
        doctor = make_mock_doctor_profile(schedules=[])

        # 2026-08-30 is a Sunday
        with pytest.raises(AppointmentValidationException, match="no working schedule"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 30),  # Sunday
                time(10, 0),
                time(10, 30),
            )

    def test_outside_schedule_hours(self):
        """Appointment outside doctor's schedule should fail."""
        schedule = make_mock_schedule(4, time(9, 0), time(12, 0))  # Friday 9-12
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="falls outside"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 28),  # Friday
                time(13, 0),
                time(14, 0),
            )

    def test_schedule_end_boundary(self):
        """Appointment ending exactly at schedule end should pass."""
        schedule = make_mock_schedule(4, time(9, 0), time(12, 0))  # Friday 9-12
        doctor = make_mock_doctor_profile(schedules=[schedule])

        AppointmentValidator.validate_doctor_schedule(
            doctor,
            date(2026, 8, 28),  # Friday
            time(11, 30),
            time(12, 0),
        )

    def test_schedule_start_boundary(self):
        """Appointment starting exactly at schedule start should pass."""
        schedule = make_mock_schedule(4, time(9, 0), time(12, 0))
        doctor = make_mock_doctor_profile(schedules=[schedule])

        AppointmentValidator.validate_doctor_schedule(
            doctor,
            date(2026, 8, 28),
            time(9, 0),
            time(9, 30),
        )

    def test_inactive_schedule_rejected_no_fallback(self):
        """Inactive schedule should NOT fall back to clinic hours — schedule is authoritative."""
        schedule = make_mock_schedule(4, time(9, 0), time(12, 0), is_active=False)
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="no working schedule.*Friday"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 28),
                time(10, 0),
                time(10, 30),
            )

    def test_inactive_schedule_within_hours_rejected(self):
        """Inactive schedule, time within clinic hours, still rejected — schedule is authoritative."""
        schedule = make_mock_schedule(4, time(9, 0), time(12, 0), is_active=False)
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="no working schedule.*Friday"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 28),
                time(14, 0),
                time(15, 0),
            )

    def test_wrong_day_of_week_rejected_no_fallback(self):
        """Schedule for a different day should NOT fall back — schedule is authoritative."""
        schedule = make_mock_schedule(0, time(9, 0), time(12, 0))  # Monday
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="no working schedule.*Friday"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 28),  # Friday
                time(10, 0),
                time(10, 30),
            )


# ==============================================================
# Overlap / Slot Integrity Tests (with mocked repository)
# ==============================================================

class TestOverlapValidation:
    """Tests that overlap checks correctly handle cancelled/no-show freeing slots."""

    def _get_service(self):
        from app.modules.appointments.service import AppointmentService
        from app.modules.appointments.repository import AppointmentRepository
        from app.modules.doctors.repositories import DoctorRepository
        from app.modules.patients.repository import PatientRepository
        db = MagicMock()
        svc = AppointmentService(db)
        svc.repository = MagicMock(spec=AppointmentRepository)
        svc.validator.repository = svc.repository
        svc.doctor_repository = MagicMock(spec=DoctorRepository)
        svc.patient_repository = MagicMock(spec=PatientRepository)
        return svc

    def test_active_appointment_blocks_slot(self):
        """An active (Scheduled) appointment should block the slot."""
        service = self._get_service()
        service.repository.doctor_overlap_exists.return_value = True

        with pytest.raises(AppointmentConflictException, match="Dentist already"):
            service.validator.validate_overlap(
                patient_id=uuid4(),
                dentist_id=10,
                appointment_date=date(2026, 8, 28),
                start_time=time(10, 0),
                end_time=time(10, 30),
            )

    def test_no_overlap_passes(self):
        """No overlapping appointments should pass."""
        service = self._get_service()
        service.repository.doctor_overlap_exists.return_value = False
        service.repository.patient_overlap_exists.return_value = False

        # Should not raise
        service.validator.validate_overlap(
            patient_id=uuid4(),
            dentist_id=10,
            appointment_date=date(2026, 8, 28),
            start_time=time(10, 0),
            end_time=time(10, 30),
        )

    def test_repository_excludes_cancelled_from_overlap(self):
        """Verify the repository's overlap query excludes cancelled appointments."""
        from app.modules.appointments.repository import AppointmentRepository
        from app.modules.appointments.enums import AppointmentStatus

        # Check that the _SLOT_OCCUPYING_STATUSES set does NOT include
        # CANCELLED and NO_SHOW
        assert AppointmentStatus.CANCELLED not in AppointmentRepository._SLOT_OCCUPYING_STATUSES
        assert AppointmentStatus.NO_SHOW not in AppointmentRepository._SLOT_OCCUPYING_STATUSES

        # Verify active statuses ARE included
        assert AppointmentStatus.SCHEDULED in AppointmentRepository._SLOT_OCCUPYING_STATUSES
        assert AppointmentStatus.CONFIRMED in AppointmentRepository._SLOT_OCCUPYING_STATUSES
        assert AppointmentStatus.CHECKED_IN in AppointmentRepository._SLOT_OCCUPYING_STATUSES
        assert AppointmentStatus.IN_TREATMENT in AppointmentRepository._SLOT_OCCUPYING_STATUSES
        assert AppointmentStatus.COMPLETED in AppointmentRepository._SLOT_OCCUPYING_STATUSES


# ==============================================================
# Terminal Appointment Protection Tests
# ==============================================================

class TestTerminalAppointmentProtection:
    """Tests that terminal appointments cannot be edited."""

    def _get_service(self):
        from app.modules.appointments.service import AppointmentService
        from app.modules.appointments.repository import AppointmentRepository
        from app.modules.doctors.repositories import DoctorRepository
        from app.modules.patients.repository import PatientRepository
        db = MagicMock()
        svc = AppointmentService(db)
        svc.repository = MagicMock(spec=AppointmentRepository)
        svc.validator.repository = svc.repository
        svc.doctor_repository = MagicMock(spec=DoctorRepository)
        svc.patient_repository = MagicMock(spec=PatientRepository)
        return svc

    def _make_update_payload(self, **kwargs):
        payload = MagicMock()
        payload.model_dump.return_value = kwargs
        return payload

    def _make_editable_payload(self):
        """Return a minimal valid payload for update that won't fail other checks."""
        payload = MagicMock()
        payload.model_dump.return_value = {
            "reason_for_visit": "Updated reason",
        }
        return payload

    def test_completed_cannot_be_edited(self):
        service = self._get_service()
        apt = make_mock_appointment(status=AppointmentStatus.COMPLETED)
        payload = self._make_update_payload(reason_for_visit="Updated reason")
        actor = MagicMock()

        with pytest.raises(AppointmentValidationException, match="Completed"):
            service.update(apt, payload, actor)

    def test_cancelled_cannot_be_edited(self):
        service = self._get_service()
        apt = make_mock_appointment(status=AppointmentStatus.CANCELLED)
        payload = self._make_update_payload(reason_for_visit="Updated reason")
        actor = MagicMock()

        with pytest.raises(AppointmentValidationException, match="Cancelled"):
            service.update(apt, payload, actor)

    def test_no_show_cannot_be_edited(self):
        service = self._get_service()
        apt = make_mock_appointment(status=AppointmentStatus.NO_SHOW)
        payload = self._make_update_payload(reason_for_visit="Updated reason")
        actor = MagicMock()

        with pytest.raises(AppointmentValidationException, match="No Show"):
            service.update(apt, payload, actor)

    def test_scheduled_can_be_edited(self):
        """Scheduled appointments should not be blocked by terminal check."""
        service = self._get_service()
        apt = make_mock_appointment(status=AppointmentStatus.SCHEDULED)
        payload = self._make_editable_payload()
        actor = MagicMock()
        service.doctor_repository.get_by_user_id.return_value = make_mock_doctor_profile()
        service.repository.update.return_value = apt
        service.repository.doctor_overlap_exists.return_value = False
        service.repository.patient_overlap_exists.return_value = False

        result = service.update(apt, payload, actor)
        assert result is not None

    def test_confirmed_can_be_edited(self):
        """Confirmed appointments should not be blocked by terminal check."""
        service = self._get_service()
        apt = make_mock_appointment(status=AppointmentStatus.CONFIRMED)
        payload = self._make_editable_payload()
        actor = MagicMock()
        service.doctor_repository.get_by_user_id.return_value = make_mock_doctor_profile()
        service.repository.update.return_value = apt
        service.repository.doctor_overlap_exists.return_value = False
        service.repository.patient_overlap_exists.return_value = False

        result = service.update(apt, payload, actor)
        assert result is not None


# ==============================================================
# Appointment Number Generation Tests
# ==============================================================

class TestAppointmentNumberGeneration:
    """Tests for atomic appointment number generation."""

    def test_number_format(self):
        """Number should follow APT-YYYYMMDD-NNNN format (17 chars)."""
        service = MagicMock()
        seq_row = MagicMock()
        seq_row.current_value = 0

        service.repository = MagicMock()
        service.repository.get_or_create_sequence.return_value = seq_row
        service.db = MagicMock()

        from app.modules.appointments.service import AppointmentService
        number = AppointmentService._generate_number(service)

        assert number.startswith("APT-")
        # APT-YYYYMMDD-NNNN = 3+1+8+1+4 = 17 characters
        assert len(number) == 17
        assert seq_row.current_value == 1

    def test_sequential_numbers(self):
        """Multiple calls should produce sequential numbers."""
        service = MagicMock()
        seq_row = MagicMock()
        seq_row.current_value = 0

        service.repository = MagicMock()
        service.repository.get_or_create_sequence.return_value = seq_row
        service.db = MagicMock()

        from app.modules.appointments.service import AppointmentService

        n1 = AppointmentService._generate_number(service)
        assert seq_row.current_value == 1
        assert n1.endswith("-0001")

        n2 = AppointmentService._generate_number(service)
        assert seq_row.current_value == 2
        assert n2.endswith("-0002")

    def test_uses_atomic_sequence(self):
        """Number generation should use get_or_create_sequence (atomic lock)."""
        service = MagicMock()
        seq_row = MagicMock()
        seq_row.current_value = 0

        service.repository = MagicMock()
        service.repository.get_or_create_sequence.return_value = seq_row
        service.db = MagicMock()

        from app.modules.appointments.service import AppointmentService
        AppointmentService._generate_number(service)

        service.repository.get_or_create_sequence.assert_called_once()


# ==============================================================
# IntegrityError Handling Tests
# ==============================================================

class TestIntegrityErrorHandling:
    """Tests that IntegrityError maps to HTTP 409 Conflict."""

    def test_integrity_error_is_caught(self):
        """The router exception handler should map IntegrityError to 409."""
        from sqlalchemy.exc import IntegrityError
        from app.modules.appointments.router import _handle_service_exception
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            _handle_service_exception(
                IntegrityError("statement", "params", Exception("unique violation"))
            )

        assert exc_info.value.status_code == 409
        assert "scheduling conflict" in exc_info.value.detail.lower()


# ==============================================================
# Working Hours / Day Validation Tests
# ==============================================================

class TestWorkingHoursValidation:
    """Tests for clinic working hours and working day validation."""

    def test_morning_session_valid(self):
        AppointmentValidator.validate_working_hours(time(10, 0), time(13, 0))

    def test_evening_session_valid(self):
        AppointmentValidator.validate_working_hours(time(17, 0), time(21, 0))

    def test_morning_before_start_invalid(self):
        with pytest.raises(AppointmentValidationException, match="clinic working hours"):
            AppointmentValidator.validate_working_hours(time(9, 0), time(12, 0))

    def test_morning_after_end_invalid(self):
        with pytest.raises(AppointmentValidationException, match="clinic working hours"):
            AppointmentValidator.validate_working_hours(time(12, 0), time(14, 0))

    def test_between_sessions_invalid(self):
        with pytest.raises(AppointmentValidationException, match="clinic working hours"):
            AppointmentValidator.validate_working_hours(time(14, 0), time(16, 0))

    def test_working_day_monday(self):
        AppointmentValidator.validate_working_day(date(2026, 8, 31))  # Monday

    def test_working_day_saturday(self):
        AppointmentValidator.validate_working_day(date(2026, 8, 29))  # Saturday

    def test_sunday_closed(self):
        with pytest.raises(AppointmentValidationException, match="closed"):
            AppointmentValidator.validate_working_day(date(2026, 8, 30))  # Sunday


# ==============================================================
# Wednesday Schedule Tests (regression for Dr. Harshit scenario)
# ==============================================================

class TestWednesdaySchedule:
    """Tests verifying the Wednesday schedule mapping is correct.

    These tests specifically guard against weekday mapping regressions
    where Wednesday (day_of_week=2) could be mismatched.
    """

    def test_wednesday_schedule_accepted(self):
        """Doctor with Wednesday schedule should accept appointment on Wednesday."""
        # 2026-09-02 is a Wednesday (weekday=2)
        schedule = make_mock_schedule(2, time(9, 0), time(17, 0))  # Wednesday 9-17
        doctor = make_mock_doctor_profile(schedules=[schedule])

        AppointmentValidator.validate_doctor_schedule(
            doctor,
            date(2026, 9, 2),  # Wednesday
            time(11, 0),
            time(11, 30),
        )

    def test_wednesday_no_schedule_rejected_no_fallback(self):
        """Doctor with only Monday schedule should NOT be bookable on Wednesday."""
        # 2026-09-02 is a Wednesday (weekday=2)
        # Only Monday schedule exists — no match for Wednesday
        schedule = make_mock_schedule(0, time(9, 0), time(17, 0))  # Monday only
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="no working schedule.*Wednesday"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 9, 2),  # Wednesday
                time(11, 0),
                time(11, 30),
            )

    def test_wednesday_no_schedule_within_clinic_hours_rejected(self):
        """Doctor with only Monday schedule, even within clinic hours on Wed, should be rejected."""
        schedule = make_mock_schedule(0, time(9, 0), time(17, 0))  # Monday only
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="no working schedule.*Wednesday"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 9, 2),  # Wednesday
                time(14, 0),
                time(15, 0),
            )

    def test_wednesday_mapping_regression(self):
        """Verify Wednesday maps to day_of_week=2 (not 3 or other)."""
        from datetime import date as d
        # Wednesday = weekday() returns 2 in Python
        assert d(2026, 9, 2).weekday() == 2  # Wednesday
        assert d(2026, 9, 9).weekday() == 2  # Next Wednesday
        assert d(2026, 9, 16).weekday() == 2  # Two weeks later

    def test_each_weekday_maps_correctly(self):
        """Verify all weekdays map to the correct day_of_week values."""
        from datetime import date as d
        # 2026-08-31 is Monday (weekday=0)
        assert d(2026, 8, 31).weekday() == 0  # Monday
        assert d(2026, 9, 1).weekday() == 1   # Tuesday
        assert d(2026, 9, 2).weekday() == 2   # Wednesday
        assert d(2026, 9, 3).weekday() == 3   # Thursday
        assert d(2026, 9, 4).weekday() == 4   # Friday
        assert d(2026, 9, 5).weekday() == 5   # Saturday
        assert d(2026, 8, 30).weekday() == 6  # Sunday

    def test_duration_exceeds_session_end(self):
        """Appointment whose end time exceeds session end should fail."""
        # Friday 9:00-12:00 schedule, appointment 11:00-12:00 (30 min) = OK
        # But 11:45-12:30 (45 min) would exceed 12:00
        schedule = make_mock_schedule(4, time(9, 0), time(12, 0))  # Friday 9-12
        doctor = make_mock_doctor_profile(schedules=[schedule])

        with pytest.raises(AppointmentValidationException, match="falls outside"):
            AppointmentValidator.validate_doctor_schedule(
                doctor,
                date(2026, 8, 28),  # Friday
                time(11, 45),
                time(12, 30),  # end exceeds session end of 12:00
            )

    def test_cancelled_appointment_does_not_block_slot(self):
        """Cancelled appointments should not block the time slot."""
        from app.modules.appointments.repository import AppointmentRepository
        from app.modules.appointments.enums import AppointmentStatus

        assert AppointmentStatus.CANCELLED not in AppointmentRepository._SLOT_OCCUPYING_STATUSES
        assert AppointmentStatus.NO_SHOW not in AppointmentRepository._SLOT_OCCUPYING_STATUSES
