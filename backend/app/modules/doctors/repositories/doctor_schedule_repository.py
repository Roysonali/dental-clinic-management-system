from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.doctors.models import DoctorSchedule


class DoctorScheduleRepository:
    """Data access layer for DoctorSchedule entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, schedule: DoctorSchedule) -> DoctorSchedule:
        self.db.add(schedule)
        self.db.flush()
        self.db.refresh(schedule)
        return schedule

    def get_schedule_by_id(self, schedule_id: UUID) -> Optional[DoctorSchedule]:
        return self.db.get(DoctorSchedule, schedule_id)

    def get_schedule_by_id_for_update(self, schedule_id: UUID) -> Optional[DoctorSchedule]:
        """Retrieve a schedule with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent modification of the same schedule entry.

        Args:
            schedule_id: UUID of the schedule entry.

        Returns:
            The locked DoctorSchedule entity, or None if not found.
        """
        stmt = (
            select(DoctorSchedule)
            .where(DoctorSchedule.id == schedule_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_doctor_schedule(self, doctor_id: UUID) -> list[DoctorSchedule]:
        stmt = (
            select(DoctorSchedule)
            .where(DoctorSchedule.doctor_id == doctor_id)
            .order_by(DoctorSchedule.day_of_week.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_active_schedule(self, doctor_id: UUID) -> list[DoctorSchedule]:
        stmt = (
            select(DoctorSchedule)
            .where(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.is_active.is_(True),
            )
            .order_by(DoctorSchedule.day_of_week.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_schedule_for_day(
        self,
        doctor_id: UUID,
        day_of_week: int,
    ) -> Optional[DoctorSchedule]:
        stmt = (
            select(DoctorSchedule)
            .where(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.day_of_week == day_of_week,
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def update(self, schedule: DoctorSchedule, updates: dict) -> DoctorSchedule:
        for field, value in updates.items():
            if hasattr(schedule, field):
                setattr(schedule, field, value)
        self.db.flush()
        self.db.refresh(schedule)
        return schedule

    def delete(self, schedule: DoctorSchedule) -> None:
        self.db.delete(schedule)
        self.db.flush()

    def delete_all_for_doctor(self, doctor_id: UUID) -> None:
        stmt = select(DoctorSchedule).where(DoctorSchedule.doctor_id == doctor_id)
        entries = list(self.db.execute(stmt).scalars().all())
        for entry in entries:
            self.db.delete(entry)
        self.db.flush()

    def get_schedules_for_update(self, doctor_id: UUID) -> list[DoctorSchedule]:
        """Lock and retrieve all schedule rows for a doctor.

        Uses ``SELECT ... FOR UPDATE`` to prevent concurrent
        modification of schedule entries during replace operations.

        Args:
            doctor_id: UUID of the doctor.

        Returns:
            List of locked DoctorSchedule entries.
        """
        stmt = (
            select(DoctorSchedule)
            .where(DoctorSchedule.doctor_id == doctor_id)
            .with_for_update()
            .order_by(DoctorSchedule.day_of_week.asc())
        )
        return list(self.db.execute(stmt).scalars().all())


    def count_for_doctor(self, doctor_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(DoctorSchedule)
            .where(DoctorSchedule.doctor_id == doctor_id)
        )
        return self.db.execute(stmt).scalar() or 0
