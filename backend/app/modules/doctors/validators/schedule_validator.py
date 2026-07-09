"""Doctor Management Module — Schedule Pure Business Validation.

Extracted from ``ScheduleService`` to separate validation concerns
from transaction ownership and orchestration.

Each method is a ``@staticmethod`` — no state, no side effects, no
transaction management.  Validators that need data access receive a
repository as an explicit parameter (keeping the layer pure and
framework-independent).

Raises:
    DoctorException subclasses on every violation (never returns
    ``False`` or ``None`` to indicate failure — uses exceptions).
"""

from __future__ import annotations

from datetime import time
from typing import Optional
from uuid import UUID

from app.modules.doctors.constants import (
    ERR_SCHEDULE_CROSS_DOCTOR,
    ERR_SCHEDULE_DUPLICATE_DAY,
    ERR_SCHEDULE_END_BEFORE_START,
    ERR_SCHEDULE_MAX_EXCEEDED,
    MAX_SCHEDULE_ENTRIES_PER_DOCTOR,
)
from app.modules.doctors.exceptions import InvalidDoctorOperation
from app.modules.doctors.models import DoctorSchedule
from app.modules.doctors.schemas import ScheduleCreate


class ScheduleValidator:
    """Collection of reusable business validation rules for the Schedule aggregate.

    Every method raises a domain exception on failure.
    Validators never commit, rollback, or own transactions.
    Validators that need persistence receive a repository reference
    as an explicit parameter from the calling service.

    Example usage::

        ScheduleValidator.assert_time_ordering(payload.start_time, payload.end_time)
        ScheduleValidator.assert_weekday_unique(sched_repo, doctor_id, payload.day_of_week)
    """

    # ==================================================================
    # Time Ordering
    # ==================================================================

    @staticmethod
    def assert_time_ordering(start_time: time, end_time: time) -> None:
        """Verify that end time is strictly after start time.

        Args:
            start_time: Proposed start time.
            end_time: Proposed end time.

        Raises:
            InvalidDoctorOperation: If ``end_time <= start_time``.
        """
        if end_time <= start_time:
            raise InvalidDoctorOperation(ERR_SCHEDULE_END_BEFORE_START)

    # ==================================================================
    # Weekday Uniqueness
    # ==================================================================

    @staticmethod
    def assert_weekday_unique(
        schedule_repo,
        doctor_id: UUID,
        day_of_week: int,
        exclude_schedule_id: Optional[UUID] = None,
    ) -> None:
        """Verify that no schedule entry already exists for this weekday.

        Args:
            schedule_repo: Repository with a ``get_schedule_for_day(
                doctor_id, day_of_week)`` method returning an optional
                ``DoctorSchedule``.
            doctor_id: UUID of the doctor.
            day_of_week: Target day (0=Monday through 5=Saturday).
            exclude_schedule_id: Optional schedule ID to exclude from
                the check (for updates).

        Raises:
            InvalidDoctorOperation: If the day already has a schedule entry.
        """
        existing = schedule_repo.get_schedule_for_day(doctor_id, day_of_week)
        if existing is not None:
            if exclude_schedule_id is None or existing.id != exclude_schedule_id:
                raise InvalidDoctorOperation(ERR_SCHEDULE_DUPLICATE_DAY)

    # ==================================================================
    # Ownership Validation
    # ==================================================================

    @staticmethod
    def assert_schedule_belongs_to_doctor(
        schedule: DoctorSchedule,
        doctor_id: UUID,
    ) -> None:
        """Verify that a schedule entry belongs to the specified doctor.

        Args:
            schedule: The ``DoctorSchedule`` entity to check.
            doctor_id: UUID of the expected owning doctor.

        Raises:
            InvalidDoctorOperation: If the schedule does not belong to
                the doctor (cross-doctor access detected).
        """
        if schedule.doctor_id != doctor_id:
            raise InvalidDoctorOperation(ERR_SCHEDULE_CROSS_DOCTOR)

    # ==================================================================
    # Entry Count Limit
    # ==================================================================

    @staticmethod
    def assert_entry_count_not_exceeded(
        count: int,
        max_entries: int = MAX_SCHEDULE_ENTRIES_PER_DOCTOR,
    ) -> None:
        """Verify that the number of schedule entries does not exceed the limit.

        Args:
            count: The number of entries being created.
            max_entries: Maximum allowed entries (default: module constant).

        Raises:
            InvalidDoctorOperation: If ``count > max_entries``.
        """
        if count > max_entries:
            raise InvalidDoctorOperation(ERR_SCHEDULE_MAX_EXCEEDED)

    # ==================================================================
    # Replace-Week List Validator
    # ==================================================================

    @staticmethod
    def validate_replace_list(schedules: list[ScheduleCreate]) -> None:
        """Validate a complete replacement schedule list.

        Checks both time ordering and duplicate day conflicts within
        the input list (does **not** query the database).  The caller
        is responsible for checking the database-level weekday
        uniqueness separately.

        Args:
            schedules: List of ``ScheduleCreate`` entries to validate.

        Raises:
            InvalidDoctorOperation: If any entry has ``end_time <= start_time``.
            InvalidDoctorOperation: If any two entries share the same day.
        """
        seen_days: set[int] = set()
        for entry in schedules:
            if entry.end_time <= entry.start_time:
                raise InvalidDoctorOperation(ERR_SCHEDULE_END_BEFORE_START)
            if entry.day_of_week in seen_days:
                raise InvalidDoctorOperation(ERR_SCHEDULE_DUPLICATE_DAY)
            seen_days.add(entry.day_of_week)
