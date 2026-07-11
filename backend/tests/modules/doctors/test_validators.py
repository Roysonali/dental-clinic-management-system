"""
Phase 9.1 - Validator Tests (Unit).

True unit tests for the three pure business validators of the Doctor
Management Module:

* DoctorValidator
* ScheduleValidator
* SpecializationValidator

Repositories are mocked with ``unittest.mock.MagicMock`` so these tests
exercise only validation logic and exception propagation. No database,
no service layer, no API layer is involved.
"""

import sys
from pathlib import Path
from types import SimpleNamespace
from datetime import time
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.core.constants import DOCTOR_ROLES, USER_STATUS_ACTIVE
from app.modules.doctors.constants import (
    ERR_ALREADY_ACTIVE,
    ERR_ALREADY_INACTIVE,
    ERR_CANNOT_MARK_INACTIVE_AVAILABLE,
    ERR_DOCTOR_MUST_BE_ACTIVE,
    ERR_NOT_A_DOCTOR_USER,
    ERR_PRIMARY_SPEC_NOT_IN_LIST,
    ERR_REG_NUMBER_TAKEN,
    ERR_SCHEDULE_CROSS_DOCTOR,
    ERR_SCHEDULE_DUPLICATE_DAY,
    ERR_SCHEDULE_END_BEFORE_START,
    ERR_SCHEDULE_MAX_EXCEEDED,
    ERR_SPEC_ALREADY_ACTIVE,
    ERR_SPEC_ALREADY_INACTIVE,
    ERR_SPEC_ASSIGNED_TO_DOCTORS,
    ERR_SPEC_CODE_TAKEN,
    ERR_SPEC_NAME_TAKEN,
    ERR_USER_MUST_BE_ACTIVE,
    MAX_SCHEDULE_ENTRIES_PER_DOCTOR,
)
from app.modules.doctors.exceptions import (
    DoctorUserNotFound,
    DoctorValidationFailed,
    DuplicateDoctorDetected,
    InvalidDoctorOperation,
    NotADoctorUser,
    SpecializationValidationFailed,
)
from app.modules.doctors.validators import (
    DoctorValidator,
    ScheduleValidator,
    SpecializationValidator,
)


# ======================================================================
# Test doubles
# ======================================================================


def make_user(role_name="GENERAL_DOCTOR", is_active=True, status=USER_STATUS_ACTIVE):
    user = MagicMock()
    user.is_active = is_active
    user.status = status
    role = MagicMock()
    role.name = role_name
    user.role = role
    return user


def make_doctor(is_active=True, available_for_appointment=True):
    doctor = MagicMock()
    doctor.is_active = is_active
    doctor.available_for_appointment = available_for_appointment
    return doctor


def make_schedule(doctor_id, schedule_id="SCHED-1"):
    schedule = MagicMock()
    schedule.doctor_id = doctor_id
    schedule.id = schedule_id
    return schedule


def make_specialization(is_active=True, spec_id=1):
    spec = MagicMock()
    spec.is_active = is_active
    spec.id = spec_id
    return spec


def make_schedule_create(day_of_week, start, end):
    """Build a ScheduleCreate-like object for validate_replace_list."""
    return SimpleNamespace(day_of_week=day_of_week, start_time=start, end_time=end)


# ======================================================================
# DoctorValidator
# ======================================================================


class TestDoctorValidatorUserEligibility:
    def test_assert_user_exists_returns_user(self):
        repo = MagicMock()
        repo.get_by_id.return_value = make_user()
        user = DoctorValidator.assert_user_exists(repo, 1)
        assert user is not None
        repo.get_by_id.assert_called_once_with(1)

    def test_assert_user_exists_raises_when_missing(self):
        repo = MagicMock()
        repo.get_by_id.return_value = None
        try:
            DoctorValidator.assert_user_exists(repo, 999)
            raise AssertionError("expected DoctorUserNotFound")
        except DoctorUserNotFound as exc:
            assert exc.message == "Referenced user does not exist"

    def test_assert_user_active_ok(self):
        DoctorValidator.assert_user_active(
            make_user(is_active=True, status=USER_STATUS_ACTIVE)
        )

    def test_assert_user_active_inactive_flag(self):
        try:
            DoctorValidator.assert_user_active(
                make_user(is_active=False, status=USER_STATUS_ACTIVE)
            )
            raise AssertionError("expected DoctorValidationFailed")
        except DoctorValidationFailed as exc:
            assert exc.message == ERR_USER_MUST_BE_ACTIVE

    def test_assert_user_active_wrong_status(self):
        try:
            DoctorValidator.assert_user_active(
                make_user(is_active=True, status="pending")
            )
            raise AssertionError("expected DoctorValidationFailed")
        except DoctorValidationFailed as exc:
            assert exc.message == ERR_USER_MUST_BE_ACTIVE

    def test_assert_user_has_doctor_role_ok(self):
        for role in DOCTOR_ROLES:
            DoctorValidator.assert_user_has_doctor_role(make_user(role_name=role))

    def test_assert_user_has_doctor_role_no_role(self):
        try:
            DoctorValidator.assert_user_has_doctor_role(make_user(role_name=None))
            raise AssertionError("expected NotADoctorUser")
        except NotADoctorUser as exc:
            assert exc.message == ERR_NOT_A_DOCTOR_USER

    def test_assert_user_has_doctor_role_non_doctor(self):
        try:
            DoctorValidator.assert_user_has_doctor_role(
                make_user(role_name="RECEPTIONIST")
            )
            raise AssertionError("expected NotADoctorUser")
        except NotADoctorUser as exc:
            assert exc.message == ERR_NOT_A_DOCTOR_USER

    def test_assert_no_existing_profile_ok(self):
        repo = MagicMock()
        repo.exists_by_user_id.return_value = False
        DoctorValidator.assert_no_existing_profile(repo, 1)

    def test_assert_no_existing_profile_duplicate(self):
        repo = MagicMock()
        repo.exists_by_user_id.return_value = True
        try:
            DoctorValidator.assert_no_existing_profile(repo, 1)
            raise AssertionError("expected DuplicateDoctorDetected")
        except DuplicateDoctorDetected:
            pass

    def test_assert_registration_unique_ok(self):
        repo = MagicMock()
        repo.registration_number_exists.return_value = False
        DoctorValidator.assert_registration_number_unique(repo, "REG-1")

    def test_assert_registration_unique_duplicate(self):
        repo = MagicMock()
        repo.registration_number_exists.return_value = True
        try:
            DoctorValidator.assert_registration_number_unique(repo, "REG-1")
            raise AssertionError("expected DoctorValidationFailed")
        except DoctorValidationFailed as exc:
            assert exc.message == ERR_REG_NUMBER_TAKEN

    def test_assert_registration_unique_excludes_self(self):
        repo = MagicMock()
        repo.registration_number_exists.return_value = False
        DoctorValidator.assert_registration_number_unique(
            repo, "REG-1", exclude_doctor_id="DOC-UUID"
        )
        repo.registration_number_exists.assert_called_once_with(
            "REG-1", exclude_doctor_id="DOC-UUID"
        )


class TestDoctorValidatorStateTransitions:
    def test_assert_can_activate_ok(self):
        DoctorValidator.assert_doctor_can_activate(make_doctor(is_active=False))

    def test_assert_can_activate_already_active(self):
        try:
            DoctorValidator.assert_doctor_can_activate(make_doctor(is_active=True))
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_ALREADY_ACTIVE

    def test_assert_can_deactivate_ok(self):
        DoctorValidator.assert_doctor_can_deactivate(make_doctor(is_active=True))

    def test_assert_can_deactivate_already_inactive(self):
        try:
            DoctorValidator.assert_doctor_can_deactivate(make_doctor(is_active=False))
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_ALREADY_INACTIVE

    def test_assert_can_toggle_availability_active_doctor(self):
        # Active doctor can always toggle
        DoctorValidator.assert_doctor_can_toggle_availability(
            make_doctor(is_active=True, available_for_appointment=False)
        )
        DoctorValidator.assert_doctor_can_toggle_availability(
            make_doctor(is_active=True, available_for_appointment=True)
        )

    def test_assert_can_toggle_availability_inactive_available_ok(self):
        # Inactive but available: can toggle to unavailable
        DoctorValidator.assert_doctor_can_toggle_availability(
            make_doctor(is_active=False, available_for_appointment=True)
        )

    def test_assert_can_toggle_availability_blocked(self):
        # Inactive AND unavailable: cannot toggle (would make them available)
        try:
            DoctorValidator.assert_doctor_can_toggle_availability(
                make_doctor(is_active=False, available_for_appointment=False)
            )
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_CANNOT_MARK_INACTIVE_AVAILABLE

    def test_assert_doctor_active_ok(self):
        DoctorValidator.assert_doctor_active(make_doctor(is_active=True))

    def test_assert_doctor_active_raises_when_inactive(self):
        try:
            DoctorValidator.assert_doctor_active(make_doctor(is_active=False))
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_DOCTOR_MUST_BE_ACTIVE


class TestDoctorValidatorSpecializationAssignment:
    def test_primary_specialization_valid_ok(self):
        DoctorValidator.assert_primary_specialization_valid(None, [1, 2, 3])
        DoctorValidator.assert_primary_specialization_valid(2, [1, 2, 3])

    def test_primary_specialization_valid_missing(self):
        try:
            DoctorValidator.assert_primary_specialization_valid(9, [1, 2, 3])
            raise AssertionError("expected DoctorValidationFailed")
        except DoctorValidationFailed as exc:
            assert exc.message == ERR_PRIMARY_SPEC_NOT_IN_LIST

    def test_assert_specialization_assigned_ok(self):
        repo = MagicMock()
        repo.exists.return_value = True
        DoctorValidator.assert_specialization_assigned(repo, "DOC", 1)

    def test_assert_specialization_assigned_missing(self):
        repo = MagicMock()
        repo.exists.return_value = False
        try:
            DoctorValidator.assert_specialization_assigned(repo, "DOC", 1)
            raise AssertionError("expected DoctorValidationFailed")
        except DoctorValidationFailed:
            pass


# ======================================================================
# ScheduleValidator
# ======================================================================


class TestScheduleValidator:
    def test_time_ordering_valid(self):
        ScheduleValidator.assert_time_ordering(time(9, 0), time(17, 0))

    def test_time_ordering_equal_raises(self):
        try:
            ScheduleValidator.assert_time_ordering(time(9, 0), time(9, 0))
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_END_BEFORE_START

    def test_time_ordering_reversed_raises(self):
        try:
            ScheduleValidator.assert_time_ordering(time(17, 0), time(9, 0))
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_END_BEFORE_START

    def test_weekday_unique_ok(self):
        repo = MagicMock()
        repo.get_schedule_for_day.return_value = None
        ScheduleValidator.assert_weekday_unique(repo, "DOC", 2)

    def test_weekday_unique_duplicate(self):
        repo = MagicMock()
        repo.get_schedule_for_day.return_value = make_schedule("DOC", "EXISTING")
        try:
            ScheduleValidator.assert_weekday_unique(repo, "DOC", 2)
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_DUPLICATE_DAY

    def test_weekday_unique_excludes_self(self):
        repo = MagicMock()
        repo.get_schedule_for_day.return_value = make_schedule("DOC", "SAME-ID")
        ScheduleValidator.assert_weekday_unique(
            repo, "DOC", 2, exclude_schedule_id="SAME-ID"
        )
        repo.get_schedule_for_day.assert_called_once_with("DOC", 2)

    def test_schedule_belongs_to_doctor_ok(self):
        ScheduleValidator.assert_schedule_belongs_to_doctor(
            make_schedule("DOC"), "DOC"
        )

    def test_schedule_belongs_to_doctor_mismatch(self):
        try:
            ScheduleValidator.assert_schedule_belongs_to_doctor(
                make_schedule("DOC-A"), "DOC-B"
            )
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_CROSS_DOCTOR

    def test_entry_count_not_exceeded_ok(self):
        ScheduleValidator.assert_entry_count_not_exceeded(
            MAX_SCHEDULE_ENTRIES_PER_DOCTOR
        )
        ScheduleValidator.assert_entry_count_not_exceeded(3)

    def test_entry_count_exceeded(self):
        try:
            ScheduleValidator.assert_entry_count_not_exceeded(
                MAX_SCHEDULE_ENTRIES_PER_DOCTOR + 1
            )
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_MAX_EXCEEDED

    def test_validate_replace_list_valid(self):
        schedules = [
            make_schedule_create(0, time(9, 0), time(12, 0)),
            make_schedule_create(1, time(13, 0), time(17, 0)),
        ]
        ScheduleValidator.validate_replace_list(schedules)

    def test_validate_replace_list_bad_time(self):
        schedules = [make_schedule_create(0, time(17, 0), time(9, 0))]
        try:
            ScheduleValidator.validate_replace_list(schedules)
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_END_BEFORE_START

    def test_validate_replace_list_duplicate_day(self):
        schedules = [
            make_schedule_create(0, time(9, 0), time(12, 0)),
            make_schedule_create(0, time(13, 0), time(17, 0)),
        ]
        try:
            ScheduleValidator.validate_replace_list(schedules)
            raise AssertionError("expected InvalidDoctorOperation")
        except InvalidDoctorOperation as exc:
            assert exc.message == ERR_SCHEDULE_DUPLICATE_DAY


# ======================================================================
# SpecializationValidator
# ======================================================================


class TestSpecializationValidator:
    def test_name_unique_ok(self):
        repo = MagicMock()
        repo.get_by_name.return_value = None
        SpecializationValidator.assert_name_unique(repo, "Orthodontics")

    def test_name_unique_duplicate(self):
        repo = MagicMock()
        repo.get_by_name.return_value = make_specialization()
        try:
            SpecializationValidator.assert_name_unique(repo, "Orthodontics")
            raise AssertionError("expected SpecializationValidationFailed")
        except SpecializationValidationFailed as exc:
            assert exc.message == ERR_SPEC_NAME_TAKEN

    def test_name_unique_excludes_self(self):
        repo = MagicMock()
        same = make_specialization(spec_id=7)
        repo.get_by_name.return_value = same
        SpecializationValidator.assert_name_unique(
            repo, "Orthodontics", exclude_id=7
        )
        repo.get_by_name.assert_called_once_with("Orthodontics")

    def test_code_unique_ok(self):
        repo = MagicMock()
        repo.get_by_code.return_value = None
        SpecializationValidator.assert_code_unique(repo, "ORTHO")

    def test_code_unique_duplicate(self):
        repo = MagicMock()
        repo.get_by_code.return_value = make_specialization()
        try:
            SpecializationValidator.assert_code_unique(repo, "ORTHO")
            raise AssertionError("expected SpecializationValidationFailed")
        except SpecializationValidationFailed as exc:
            assert exc.message == ERR_SPEC_CODE_TAKEN

    def test_code_unique_excludes_self(self):
        repo = MagicMock()
        same = make_specialization(spec_id=3)
        repo.get_by_code.return_value = same
        SpecializationValidator.assert_code_unique(repo, "ORTHO", exclude_id=3)
        repo.get_by_code.assert_called_once_with("ORTHO")

    def test_can_activate_ok(self):
        SpecializationValidator.assert_specialization_can_activate(
            make_specialization(is_active=False)
        )

    def test_can_activate_already_active(self):
        try:
            SpecializationValidator.assert_specialization_can_activate(
                make_specialization(is_active=True)
            )
            raise AssertionError("expected SpecializationValidationFailed")
        except SpecializationValidationFailed as exc:
            assert exc.message == ERR_SPEC_ALREADY_ACTIVE

    def test_can_deactivate_ok(self):
        SpecializationValidator.assert_specialization_can_deactivate(
            make_specialization(is_active=True)
        )

    def test_can_deactivate_already_inactive(self):
        try:
            SpecializationValidator.assert_specialization_can_deactivate(
                make_specialization(is_active=False)
            )
            raise AssertionError("expected SpecializationValidationFailed")
        except SpecializationValidationFailed as exc:
            assert exc.message == ERR_SPEC_ALREADY_INACTIVE

    def test_delete_guard_ok(self):
        repo = MagicMock()
        repo.is_specialization_assigned.return_value = False
        SpecializationValidator.assert_not_assigned_to_doctors(repo, 1)

    def test_delete_guard_assigned(self):
        repo = MagicMock()
        repo.is_specialization_assigned.return_value = True
        try:
            SpecializationValidator.assert_not_assigned_to_doctors(repo, 1)
            raise AssertionError("expected SpecializationValidationFailed")
        except SpecializationValidationFailed as exc:
            assert exc.message == ERR_SPEC_ASSIGNED_TO_DOCTORS
