"""
Unit tests for the Appointment Calendar feature.

Tests:
- CalendarAppointmentResponse schema
- AppointmentService.calendar() range validation
- AppointmentService.calendar() response mapping
- GET /appointments/calendar endpoint
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, time, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.appointments.enums import (
    AppointmentStatus,
    AppointmentType,
)
from app.modules.appointments.exceptions import (
    AppointmentValidationException,
)
from app.modules.appointments.schema import (
    CalendarAppointmentResponse,
    CalendarAppointmentListResponse,
)


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
    apt = MagicMock()
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

    # Mock patient relationship
    apt.patient = MagicMock()
    apt.patient.first_name = "John"
    apt.patient.middle_name = None
    apt.patient.last_name = "Smith"

    # Mock dentist relationship
    apt.dentist = MagicMock()
    apt.dentist.full_name = "Dr. Sarah Johnson"

    return apt


# ==============================================================
# Schema Tests
# ==============================================================


class TestCalendarAppointmentResponse:
    def test_valid_response(self):
        resp = CalendarAppointmentResponse(
            id=uuid4(),
            appointment_number="APT-20260828-0001",
            patient_id=uuid4(),
            patient_name="John Smith",
            dentist_id=10,
            dentist_name="Dr. Sarah Johnson",
            appointment_date=date(2026, 8, 28),
            start_time=time(10, 0),
            end_time=time(10, 30),
            duration_minutes=30,
            appointment_type=AppointmentType.CONSULTATION,
            status=AppointmentStatus.SCHEDULED,
            reason_for_visit="Annual checkup",
        )
        assert resp.patient_name == "John Smith"
        assert resp.dentist_name == "Dr. Sarah Johnson"
        assert resp.duration_minutes == 30
        assert resp.appointment_type == AppointmentType.CONSULTATION
        assert resp.status == AppointmentStatus.SCHEDULED

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            CalendarAppointmentResponse()

    def test_extra_field_forbidden(self):
        with pytest.raises(ValidationError, match="extra"):
            CalendarAppointmentResponse(
                id=uuid4(),
                appointment_number="APT-20260828-0001",
                patient_id=uuid4(),
                patient_name="John Smith",
                dentist_id=10,
                dentist_name="Dr. Sarah Johnson",
                appointment_date=date(2026, 8, 28),
                start_time=time(10, 0),
                end_time=time(10, 30),
                duration_minutes=30,
                appointment_type=AppointmentType.CONSULTATION,
                status=AppointmentStatus.SCHEDULED,
                reason_for_visit="Annual checkup",
                notes="Some extra field",
            )

    def test_no_audit_fields(self):
        """CalendarAppointmentResponse must NOT have created_at/updated_at."""
        resp = CalendarAppointmentResponse(
            id=uuid4(),
            appointment_number="APT-20260828-0001",
            patient_id=uuid4(),
            patient_name="John Smith",
            dentist_id=10,
            dentist_name="Dr. Sarah Johnson",
            appointment_date=date(2026, 8, 28),
            start_time=time(10, 0),
            end_time=time(10, 30),
            duration_minutes=30,
            appointment_type=AppointmentType.CONSULTATION,
            status=AppointmentStatus.SCHEDULED,
            reason_for_visit="Annual checkup",
        )
        assert not hasattr(resp, "created_at")
        assert not hasattr(resp, "updated_at")
        assert not hasattr(resp, "created_by")
        assert not hasattr(resp, "updated_by")
        assert not hasattr(resp, "notes")


class TestCalendarAppointmentListResponse:
    def test_empty_list(self):
        resp = CalendarAppointmentListResponse(items=[])
        assert resp.items == []
        assert len(resp.items) == 0

    def test_with_items(self):
        item = CalendarAppointmentResponse(
            id=uuid4(),
            appointment_number="APT-20260828-0001",
            patient_id=uuid4(),
            patient_name="John Smith",
            dentist_id=10,
            dentist_name="Dr. Sarah Johnson",
            appointment_date=date(2026, 8, 28),
            start_time=time(10, 0),
            end_time=time(10, 30),
            duration_minutes=30,
            appointment_type=AppointmentType.CONSULTATION,
            status=AppointmentStatus.SCHEDULED,
            reason_for_visit="Annual checkup",
        )
        resp = CalendarAppointmentListResponse(items=[item])
        assert len(resp.items) == 1
        assert resp.items[0].patient_name == "John Smith"


# ==============================================================
# Service Layer Tests (using lazy import to avoid SQLAlchemy
# mapper configuration cascade)
# ==============================================================


class TestAppointmentServiceCalendar:
    @pytest.fixture
    def service_and_modules(self):
        """Lazy import to avoid triggering broken Invoice->Doctor mapper."""
        from app.modules.appointments.service import AppointmentService
        from app.modules.appointments.repository import AppointmentRepository
        db = MagicMock()
        svc = AppointmentService(db)
        svc.repository = MagicMock(spec=AppointmentRepository)
        return svc

    def _get_service(self):
        from app.modules.appointments.service import AppointmentService
        from app.modules.appointments.repository import AppointmentRepository
        db = MagicMock()
        svc = AppointmentService(db)
        svc.repository = MagicMock(spec=AppointmentRepository)
        return svc

    def test_valid_date_range(self):
        """Valid range [start, end) should call repository and return items."""
        service = self._get_service()
        apt = make_mock_appointment()
        service.repository.list_by_date_range.return_value = [apt]

        result = service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
        )

        assert isinstance(result, CalendarAppointmentListResponse)
        assert len(result.items) == 1
        assert result.items[0].patient_name == "John Smith"
        assert result.items[0].dentist_name == "Dr. Sarah Johnson"
        service.repository.list_by_date_range.assert_called_once_with(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            dentist_id=None,
            status=None,
        )

    def test_start_equals_end_rejected(self):
        """start == end should raise AppointmentValidationException."""
        service = self._get_service()
        with pytest.raises(AppointmentValidationException, match="must be before"):
            service.calendar(
                start=date(2026, 8, 28),
                end=date(2026, 8, 28),
            )
        service.repository.list_by_date_range.assert_not_called()

    def test_start_after_end_rejected(self):
        """start > end should raise AppointmentValidationException."""
        service = self._get_service()
        with pytest.raises(AppointmentValidationException, match="must be before"):
            service.calendar(
                start=date(2026, 9, 1),
                end=date(2026, 8, 1),
            )
        service.repository.list_by_date_range.assert_not_called()

    def test_range_exceeds_90_days(self):
        """Range > 90 days should raise AppointmentValidationException."""
        service = self._get_service()
        with pytest.raises(AppointmentValidationException, match="90 days"):
            service.calendar(
                start=date(2026, 1, 1),
                end=date(2026, 5, 1),
            )
        service.repository.list_by_date_range.assert_not_called()

    def test_exactly_90_days_allowed(self):
        """Range of exactly 90 days should be accepted."""
        service = self._get_service()
        service.repository.list_by_date_range.return_value = []

        result = service.calendar(
            start=date(2026, 6, 1),
            end=date(2026, 8, 30),
        )

        assert result.items == []
        service.repository.list_by_date_range.assert_called_once()

    def test_dentist_filter_passed(self):
        """Optional dentist_id filter should be forwarded to repository."""
        service = self._get_service()
        service.repository.list_by_date_range.return_value = []

        service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            dentist_id=42,
        )

        service.repository.list_by_date_range.assert_called_once_with(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            dentist_id=42,
            status=None,
        )

    def test_status_filter_passed(self):
        """Optional status filter should be forwarded to repository."""
        service = self._get_service()
        service.repository.list_by_date_range.return_value = []

        service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            status="Scheduled",
        )

        service.repository.list_by_date_range.assert_called_once_with(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            dentist_id=None,
            status="Scheduled",
        )

    def test_both_filters_passed(self):
        """Both dentist_id and status filters should be forwarded."""
        service = self._get_service()
        service.repository.list_by_date_range.return_value = []

        service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            dentist_id=5,
            status="Confirmed",
        )

        service.repository.list_by_date_range.assert_called_once_with(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
            dentist_id=5,
            status="Confirmed",
        )

    def test_empty_range_returns_empty_items(self):
        """Valid range with no appointments should return empty items list."""
        service = self._get_service()
        service.repository.list_by_date_range.return_value = []

        result = service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 8, 2),
        )

        assert result.items == []

    def test_multiple_appointments_mapped(self):
        """Multiple appointments should all be mapped correctly."""
        service = self._get_service()
        apt1 = make_mock_appointment(
            appointment_number="APT-20260828-0001",
            start_time=time(9, 0),
            end_time=time(9, 30),
        )
        apt2 = make_mock_appointment(
            appointment_number="APT-20260828-0002",
            start_time=time(14, 0),
            end_time=time(14, 45),
            duration_minutes=45,
            appointment_type=AppointmentType.PROCEDURE,
            status=AppointmentStatus.CONFIRMED,
            reason="Root canal",
        )
        service.repository.list_by_date_range.return_value = [apt1, apt2]

        result = service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
        )

        assert len(result.items) == 2
        assert result.items[0].appointment_number == "APT-20260828-0001"
        assert result.items[0].start_time == time(9, 0)
        assert result.items[1].appointment_number == "APT-20260828-0002"
        assert result.items[1].duration_minutes == 45
        assert result.items[1].appointment_type == AppointmentType.PROCEDURE
        assert result.items[1].status == AppointmentStatus.CONFIRMED

    def test_patient_name_resolved_from_mapper(self):
        """Patient name should be built using PatientMapper.build_full_name."""
        service = self._get_service()
        apt = make_mock_appointment()
        apt.patient.first_name = "Maria"
        apt.patient.middle_name = "Cruz"
        apt.patient.last_name = "Santos"
        service.repository.list_by_date_range.return_value = [apt]

        result = service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
        )

        assert result.items[0].patient_name == "Maria Cruz Santos"

    def test_dentist_name_from_user_full_name(self):
        """Dentist name should come from User.full_name."""
        service = self._get_service()
        apt = make_mock_appointment()
        apt.dentist.full_name = "Dr. Maria Reyes"
        service.repository.list_by_date_range.return_value = [apt]

        result = service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
        )

        assert result.items[0].dentist_name == "Dr. Maria Reyes"

    def test_patient_name_no_middle(self):
        """Patient name without middle name should skip it."""
        service = self._get_service()
        apt = make_mock_appointment()
        apt.patient.first_name = "Juan"
        apt.patient.middle_name = None
        apt.patient.last_name = "Dela Cruz"
        service.repository.list_by_date_range.return_value = [apt]

        result = service.calendar(
            start=date(2026, 8, 1),
            end=date(2026, 9, 1),
        )

        assert result.items[0].patient_name == "Juan Dela Cruz"


# ==============================================================
# Schema-only range validation tests
# ==============================================================


class TestCalendarRangeEdgeCases:
    """Edge case tests for calendar range validation."""

    def _get_service(self):
        from app.modules.appointments.service import AppointmentService
        from app.modules.appointments.repository import AppointmentRepository
        db = MagicMock()
        svc = AppointmentService(db)
        svc.repository = MagicMock(spec=AppointmentRepository)
        return svc

    def test_one_day_range(self):
        """A single-day range (1 day) should be accepted."""
        service = self._get_service()
        service.repository.list_by_date_range.return_value = []

        result = service.calendar(
            start=date(2026, 8, 28),
            end=date(2026, 8, 29),
        )

        assert result.items == []

    def test_max_range_is_90_days(self):
        """Range of 91 days should be rejected."""
        service = self._get_service()
        with pytest.raises(AppointmentValidationException, match="90 days"):
            service.calendar(
                start=date(2026, 1, 1),
                end=date(2026, 1, 1) + timedelta(days=91),
            )

    def test_91_day_range_rejected(self):
        """Exactly 91 days should be rejected."""
        service = self._get_service()
        with pytest.raises(AppointmentValidationException, match="90 days"):
            service.calendar(
                start=date(2026, 6, 1),
                end=date(2026, 8, 31),
            )


# ==============================================================
# All AppointmentStatus values
# ==============================================================


class TestCalendarStatusEnumValues:
    """Verify all AppointmentStatus values are usable as calendar filters."""

    def test_all_statuses_are_valid(self):
        """All enum values should be string-serializable for repository filter."""
        for status in AppointmentStatus:
            assert isinstance(status.value, str)
            assert len(status.value) > 0

    def test_expected_statuses(self):
        """Verify the expected set of appointment statuses."""
        expected = {
            "Scheduled",
            "Confirmed",
            "Checked In",
            "In Treatment",
            "Completed",
            "Cancelled",
            "No Show",
        }
        actual = {s.value for s in AppointmentStatus}
        assert actual == expected


# ==============================================================
# All AppointmentType values
# ==============================================================


class TestCalendarTypeEnumValues:
    """Verify all AppointmentType values appear in calendar responses."""

    def test_all_types_are_valid(self):
        for atype in AppointmentType:
            assert isinstance(atype.value, str)
            assert len(atype.value) > 0

    def test_expected_types(self):
        expected = {
            "Consultation",
            "Follow-Up",
            "Emergency",
            "Procedure",
            "Review",
            "Other",
        }
        actual = {t.value for t in AppointmentType}
        assert actual == expected
