from __future__ import annotations

from datetime import date, time
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.appointments.model import Appointment


class AppointmentRepository:
    """
    Repository responsible only for database access.
    """

    def __init__(
        self,
        db: Session,
    ) -> None:
        self.db = db

    def create(
        self,
        appointment: Appointment,
    ) -> Appointment:
        self.db.add(appointment)
        self.db.flush()
        self.db.refresh(appointment)

        return appointment

    def exists(self, appointment_id: UUID) -> bool:
        """Return ``True`` if an appointment with the given id exists."""
        stmt = select(Appointment.id).where(Appointment.id == appointment_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def get_by_id(
        self,
        appointment_id: UUID,
    ) -> Optional[Appointment]:

        return self.db.get(
            Appointment,
            appointment_id,
        )

    def get_by_appointment_number(
        self,
        appointment_number: str,
    ) -> Optional[Appointment]:

        stmt = (
            select(Appointment)
            .where(
                Appointment.appointment_number
                == appointment_number
            )
        )

        return self.db.execute(
            stmt
        ).scalar_one_or_none()

    def list(
        self,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Appointment], int]:

        total = self.db.execute(
            select(
                func.count()
            ).select_from(
                Appointment
            )
        ).scalar()

        stmt = (
            select(Appointment)
            .order_by(
                Appointment.created_at.desc()
            )
            .offset(skip)
            .limit(limit)
        )

        rows = (
            self.db.execute(
                stmt
            )
            .scalars()
            .all()
        )

        return rows, total

    def get_today(
        self,
        appointment_date: date,
    ) -> list[Appointment]:

        stmt = (
            select(Appointment)
            .where(
                Appointment.appointment_date
                == appointment_date
            )
            .order_by(
                Appointment.start_time
            )
        )

        return (
            self.db.execute(
                stmt
            )
            .scalars()
            .all()
        )

    def update(
        self,
        appointment: Appointment,
    ) -> Appointment:

        self.db.flush()

        self.db.refresh(
            appointment
        )

        return appointment

    def doctor_overlap_exists(
        self,
        dentist_id: int,
        appointment_date: date,
        start_time: time,
        end_time: time,
        exclude_id: Optional[UUID] = None,
    ) -> bool:

        stmt = (
            select(Appointment.id)
            .where(
                Appointment.dentist_id
                == dentist_id,
                Appointment.appointment_date
                == appointment_date,
                Appointment.start_time
                < end_time,
                Appointment.end_time
                > start_time,
            )
        )

        if exclude_id:
            stmt = stmt.where(
                Appointment.id
                != exclude_id
            )

        return (
            self.db.execute(
                stmt
            )
            .first()
            is not None
        )

    def list_by_patient(
        self,
        patient_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Appointment], int]:
        """Return paginated appointments for a specific patient."""

        base = (
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
        )

        total = (
            self.db.execute(
                select(func.count()).select_from(base.subquery())
            ).scalar()
        )

        stmt = (
            base
            .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
            .offset(skip)
            .limit(limit)
        )

        rows = (
            self.db.execute(stmt)
            .scalars()
            .all()
        )

        return rows, total

    def get_latest_number_prefix(
        self,
        prefix: str,
    ) -> Optional[str]:

        stmt = (
            select(Appointment.appointment_number)
            .where(
                Appointment.appointment_number.like(
                    f"{prefix}%"
                )
            )
            .order_by(Appointment.appointment_number.desc())
            .limit(1)
        )

        return (
            self.db.execute(
                stmt
            ).scalar_one_or_none()
        )

    def patient_overlap_exists(
        self,
        patient_id: UUID,
        appointment_date: date,
        start_time: time,
        end_time: time,
        exclude_id: Optional[UUID] = None,
    ) -> bool:

        stmt = (
            select(Appointment.id)
            .where(
                Appointment.patient_id
                == patient_id,
                Appointment.appointment_date
                == appointment_date,
                Appointment.start_time
                < end_time,
                Appointment.end_time
                > start_time,
            )
        )

        if exclude_id:
            stmt = stmt.where(
                Appointment.id
                != exclude_id
            )

        return (
            self.db.execute(
                stmt
            )
            .first()
            is not None
        )