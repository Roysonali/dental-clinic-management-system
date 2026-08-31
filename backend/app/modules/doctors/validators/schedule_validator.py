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
    ERR_SCHEDULE_END_BEFORE_START,
    ERR_SCHEDULE_MAX_EXCEEDED,
    MAX_SCHEDULE_ENTRIES_PER_DOCTOR,
)
from app.modules.doctors.exceptions import InvalidDoctorOperation
from app.modules.doctors.models import DoctorSchedule
from app.modules.doctors.schemas import ScheduleCreate
from ._protocols import ScheduleRepositoryProtocol


class ScheduleValidator:
    """Collection of reusable business validation rules for the Schedule aggregate.

    Every method raises a domain exception on failure.
    Validators never commit, rollback, or own transactions.
    Validators that need persistence receive a repository reference
    as an explicit parameter from the calling service.

    Example usage::

        ScheduleValidator.assert_time_ordering(payload.start_time, payload.end_time)
        ScheduleValidator.assert_no_session_overlap(sessions)
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
    # Session Overlap Detection
    # ==================================================================

    @staticmethod
    def assert_no_session_overlap(
        sessions: list[tuple[time, time]],
    ) -> None:
        """Verify that no two sessions overlap.

        Sessions may share the same day; this checks that their
        time ranges do not intersect.

        Args:
            sessions: List of (start, end) tuples.

        Raises:
            InvalidDoctorOperation: If any two sessions overlap.
        """
        for i, (s1_start, s1_end) in enumerate(sessions):
            for s2_start, s2_end in sessions[i + 1:]:
                if s1_start < s2_end and s2_start < s1_end:
                    raise InvalidDoctorOperation(
                        (
                            f"Schedule sessions overlap: "
                            f"{s1_start.strftime('%H:%M')}-"
                            f"{s1_end.strftime('%H:%M')} and "
                            f"{s2_start.strftime('%H:%M')}-"
                            f"{s2_end.strftime('%H:%M')}."
                        )
                    )

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

        Checks time ordering and detects overlapping sessions for
        the same day.  Multiple sessions per day are allowed
        (split shifts) as long as they don't overlap.

        Args:
            schedules: List of ``ScheduleCreate`` entries to validate.

        Raises:
            InvalidDoctorOperation: If any entry has ``end_time <= start_time``.
            InvalidDoctorOperation: If sessions on the same day overlap.
        """
        # Group sessions by day
        day_sessions: dict[int, list[tuple[time, time]]] = {}
        for entry in schedules:
            ScheduleValidator.assert_time_ordering(entry.start_time, entry.end_time)
            day_sessions.setdefault(entry.day_of_week, []).append(
                (entry.start_time, entry.end_time),
            )
        # Check overlap within each day
        for _day, sessions in day_sessions.items():
            ScheduleValidator.assert_no_session_overlap(sessions)
