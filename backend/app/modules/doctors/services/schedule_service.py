"""Doctor Management Module — Schedule Service Layer.

Manages weekly recurring availability templates for doctors.
Each template defines the default working hours for a specific
day of the week. This is NOT an appointment calendar — actual
booked slots are managed by the Appointments module.

Transaction Rules
-----------------
* The service layer owns commit() and rollback().
* Repositories only flush() and refresh() — they NEVER commit.
* All state-changing operations wrap their logic in try/except blocks
  so that any failure triggers an automatic rollback.
"""
from __future__ import annotations

import logging
from datetime import time
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.doctors.constants import (
    ERR_DOCTOR_MUST_BE_ACTIVE,
    ERR_DOCTOR_NOT_FOUND,
    ERR_SCHEDULE_CROSS_DOCTOR,
    ERR_SCHEDULE_DUPLICATE_DAY,
    ERR_SCHEDULE_END_BEFORE_START,
    ERR_SCHEDULE_MAX_EXCEEDED,
    ERR_SCHEDULE_NOT_FOUND,
    MAX_SCHEDULE_ENTRIES_PER_DOCTOR,
)
from app.modules.doctors.exceptions import (
    DoctorNotFound,
    InvalidDoctorOperation,
    ScheduleCreationFailed,
    ScheduleNotFound,
    ScheduleUpdateFailed,
)
from app.modules.doctors.models import DoctorSchedule
from app.modules.doctors.repositories import (
    DoctorRepository,
    DoctorScheduleRepository,
)
from app.modules.doctors.schemas import ScheduleCreate, ScheduleUpdate


logger = logging.getLogger(__name__)

_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "day_of_week", "start_time", "end_time", "is_active",
})
class ScheduleService:
    """Service-layer orchestrator for doctor schedule templates.

    Responsibilities:
    * Business rule validation (doctor active, weekday uniqueness, overlap).
    * Transaction ownership (commit on success, rollback on failure).
    * Coordination between DoctorRepository and DoctorScheduleRepository.
    * Structured logging for auditability.

    The service layer is the **only** layer that calls commit().
    Repositories must call flush() / refresh() only.
    """

    def __init__(self, db: Session) -> None:
        """Initialize the service with required repositories.

        Args:
            db: Active SQLAlchemy session (injected by the router layer).
        """
        self.db = db
        self.doctor_repo = DoctorRepository(db)
        self.schedule_repo = DoctorScheduleRepository(db)

    # ------------------------------------------------------------------
    # Transaction Helper
    # ------------------------------------------------------------------

    def _run_in_transaction(
        self,
        operation: str,
        fn: callable,
        *,
        on_unexpected: type[Exception] = ScheduleCreationFailed,
        log_context: Optional[dict[str, Any]] = None,
    ) -> Any:
        """Execute a callable within a transaction boundary.

        Wraps the supplied callable with commit-on-success and
        rollback-on-failure semantics.

        Args:
            operation: Human-readable label for log messages.
            fn: Zero-argument callable containing the business logic.
            on_unexpected: Exception class for unexpected errors.
            log_context: Extra context merged into log records.

        Returns:
            The return value of *fn*, typically the affected entity.
        """
        ctx: dict[str, Any] = {"operation": operation}
        if log_context:
            ctx.update(log_context)
        try:
            result = fn()
            self.db.commit()
            logger.info("Schedule operation succeeded", extra=ctx)
            return result
        except (ScheduleCreationFailed, ScheduleUpdateFailed, InvalidDoctorOperation):
            self.db.rollback()
            raise
        except IntegrityError as exc:
            self.db.rollback()
            logger.error("Integrity violation during %s: %s", operation, exc)
            raise on_unexpected(f"Operation '{operation}' failed: integrity violation") from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error during %s", operation, extra=ctx)
            raise on_unexpected(f"Operation '{operation}' failed unexpectedly: {exc}") from exc

    # ------------------------------------------------------------------
    # Common Helpers
    # ------------------------------------------------------------------

    def _get_doctor_and_assert_active(self, doctor_id: UUID) -> None:
        """Verify a doctor exists and is active.

        Args:
            doctor_id: UUID of the doctor.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If the doctor is not active.
        """
        doctor = self.doctor_repo.get_by_id(doctor_id)
        if doctor is None:
            raise DoctorNotFound(ERR_DOCTOR_NOT_FOUND)
        if not doctor.is_active:
            raise InvalidDoctorOperation(ERR_DOCTOR_MUST_BE_ACTIVE)

    # ------------------------------------------------------------------
    # Query Methods
    # ------------------------------------------------------------------

    def list_schedule(self, doctor_id: UUID) -> list[DoctorSchedule]:
        """Retrieve all schedule entries for a doctor.

        Args:
            doctor_id: UUID of the doctor.

        Returns:
            List of DoctorSchedule entries ordered by day_of_week.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If the doctor is not active.
        """
        self._get_doctor_and_assert_active(doctor_id)
        return self.schedule_repo.get_doctor_schedule(doctor_id)


    def _validate_schedule_constraints(
        self,
        doctor_id: UUID,
        day_of_week: int,
        start_time: time,
        end_time: time,
        exclude_schedule_id: Optional[UUID] = None,
    ) -> None:
        """Validate schedule time ordering and weekday uniqueness.

        Ensures end time is after start time and that only one
        schedule entry exists per weekday. An optional
        ``exclude_schedule_id`` skips the entry being updated.

        Args:
            doctor_id: UUID of the doctor.
            day_of_week: Target day (0=Monday through 5=Saturday).
            start_time: Proposed start time.
            end_time: Proposed end time.
            exclude_schedule_id: Optional schedule ID to exclude from check.

        Raises:
            InvalidDoctorOperation: If end_time <= start_time.
            InvalidDoctorOperation: If the day already has a schedule entry.
        """
        if end_time <= start_time:
            raise InvalidDoctorOperation(ERR_SCHEDULE_END_BEFORE_START)
        existing = self.schedule_repo.get_schedule_for_day(doctor_id, day_of_week)
        if existing is not None:
            if exclude_schedule_id is None or existing.id != exclude_schedule_id:
                raise InvalidDoctorOperation(ERR_SCHEDULE_DUPLICATE_DAY)

    # ------------------------------------------------------------------
    # Write Methods
    # ------------------------------------------------------------------

    def create_schedule(
        self,
        doctor_id: UUID,
        payload: ScheduleCreate,
        *,
        actor_id: int,
    ) -> DoctorSchedule:
        """Create a new schedule entry for a doctor.

        Validates doctor existence, active status, weekday uniqueness,
        and end-time-after-start-time constraints.

        Args:
            doctor_id: UUID of the doctor.
            payload: The validated ScheduleCreate schema.
            actor_id: ID of the authenticated user.

        Returns:
            The newly created DoctorSchedule entity (refreshed).

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If validation fails.
            ScheduleCreationFailed: If persistence fails.
        """
        def _create() -> DoctorSchedule:
            self._get_doctor_and_assert_active(doctor_id)
            self._validate_schedule_constraints(
                doctor_id, payload.day_of_week,
                payload.start_time, payload.end_time,
            )
            schedule = DoctorSchedule(
                doctor_id=doctor_id,
                day_of_week=payload.day_of_week,
                start_time=payload.start_time,
                end_time=payload.end_time,
            )
            return self.schedule_repo.create(schedule)

        return self._run_in_transaction(
            "create_schedule", _create,
            log_context={"doctor_id": str(doctor_id), "day_of_week": payload.day_of_week, "actor_id": actor_id},
        )


    def update_schedule(
        self,
        doctor_id: UUID,
        schedule_id: UUID,
        payload: ScheduleUpdate,
        *,
        actor_id: int,
    ) -> DoctorSchedule:
        """Update an existing schedule entry.

        Only supplied fields are applied. If day_of_week, start_time,
        or end_time are being changed, overlap validation runs again.

        Args:
            doctor_id: UUID of the doctor.
            schedule_id: UUID of the schedule entry.
            payload: The validated ScheduleUpdate schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated DoctorSchedule entity (refreshed).

        Raises:
            DoctorNotFound: If the doctor does not exist.
            ScheduleNotFound: If the schedule entry does not exist.
            InvalidDoctorOperation: If validation fails or cross-doctor access.
            ScheduleUpdateFailed: If persistence fails.
        """
        def _update() -> DoctorSchedule:
            self._get_doctor_and_assert_active(doctor_id)
            schedule = self.schedule_repo.get_schedule_by_id_for_update(schedule_id)
            if schedule is None:
                raise ScheduleNotFound()
            if schedule.doctor_id != doctor_id:
                raise InvalidDoctorOperation(ERR_SCHEDULE_CROSS_DOCTOR)
            update_data = payload.model_dump(exclude_unset=True)
            filtered = {
                k: v for k, v in update_data.items()
                if k in _ALLOWED_UPDATE_FIELDS
            }
            if not filtered:
                return schedule
            day = filtered.get("day_of_week", schedule.day_of_week)
            start = filtered.get("start_time", schedule.start_time)
            end = filtered.get("end_time", schedule.end_time)
            self._validate_schedule_constraints(
                doctor_id, day, start, end,
                exclude_schedule_id=schedule_id,
            )
            return self.schedule_repo.update(schedule, filtered)

        return self._run_in_transaction(
            "update_schedule", _update,
            on_unexpected=ScheduleUpdateFailed,
            log_context={"doctor_id": str(doctor_id), "schedule_id": str(schedule_id), "actor_id": actor_id},
        )


    def delete_schedule(self, doctor_id: UUID, schedule_id: UUID, *, actor_id: int) -> None:
        """Delete a schedule entry.

        Args:
            doctor_id: UUID of the doctor.
            schedule_id: UUID of the schedule entry to delete.
            actor_id: ID of the authenticated user.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            ScheduleNotFound: If the schedule entry does not exist.
            InvalidDoctorOperation: If cross-doctor access.
        """
        def _delete() -> None:
            self._get_doctor_and_assert_active(doctor_id)
            schedule = self.schedule_repo.get_schedule_by_id_for_update(schedule_id)
            if schedule is None:
                raise ScheduleNotFound()
            if schedule.doctor_id != doctor_id:
                raise InvalidDoctorOperation(ERR_SCHEDULE_CROSS_DOCTOR)
            self.schedule_repo.delete(schedule)

        return self._run_in_transaction(
            "delete_schedule", _delete,
            log_context={"doctor_id": str(doctor_id), "schedule_id": str(schedule_id), "actor_id": actor_id},
        )


    def replace_week_schedule(
        self,
        doctor_id: UUID,
        schedules: list[ScheduleCreate],
        *,
        actor_id: int,
    ) -> list[DoctorSchedule]:
        """Atomically replace the entire weekly schedule for a doctor.

        All existing schedule entries are deleted and replaced with
        the provided list. The operation is atomic — if any entry
        fails validation, all changes are rolled back.

        Args:
            doctor_id: UUID of the doctor.
            schedules: List of ScheduleCreate entries for the new week.
            actor_id: ID of the authenticated user.

        Returns:
            List of newly created DoctorSchedule entities.

        Raises:
            DoctorNotFound: If the doctor does not exist.
            InvalidDoctorOperation: If validation fails.
            ScheduleCreationFailed: If persistence fails.
        """
        def _replace() -> list[DoctorSchedule]:
            self._get_doctor_and_assert_active(doctor_id)
            if len(schedules) > MAX_SCHEDULE_ENTRIES_PER_DOCTOR:
                raise InvalidDoctorOperation(ERR_SCHEDULE_MAX_EXCEEDED)
            seen_days: set[int] = set()
            for entry in schedules:
                if entry.end_time <= entry.start_time:
                    raise InvalidDoctorOperation(ERR_SCHEDULE_END_BEFORE_START)
                if entry.day_of_week in seen_days:
                    raise InvalidDoctorOperation(ERR_SCHEDULE_DUPLICATE_DAY)
                seen_days.add(entry.day_of_week)
            # Lock existing rows then atomically replace all entries
            self.schedule_repo.get_schedules_for_update(doctor_id)
            self.schedule_repo.delete_all_for_doctor(doctor_id)
            created: list[DoctorSchedule] = []
            for entry in schedules:
                schedule = DoctorSchedule(
                    doctor_id=doctor_id,
                    day_of_week=entry.day_of_week,
                    start_time=entry.start_time,
                    end_time=entry.end_time,
                )
                created.append(self.schedule_repo.create(schedule))
            return sorted(created, key=lambda s: s.day_of_week)

        return self._run_in_transaction(
            "replace_week_schedule", _replace,
            on_unexpected=ScheduleCreationFailed,
            log_context={"doctor_id": str(doctor_id), "count": len(schedules), "actor_id": actor_id},
        )
