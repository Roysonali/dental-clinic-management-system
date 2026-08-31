from __future__ import annotations

from datetime import date, time
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.appointments.enums import AppointmentStatus
from app.modules.appointments.model import Appointment
from app.modules.appointments.sequence import AppointmentSequence
from app.modules.patients.models import Patient


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

        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient),
                selectinload(Appointment.dentist),
            )
            .where(
                Appointment.id == appointment_id
            )
        )

        return (
            self.db.execute(
                stmt
            ).scalar_one_or_none()
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
        search: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        dentist_id: Optional[int] = None,
    ) -> tuple[list[Appointment], int]:
        """Return paginated appointments with optional server-side filters.

        Filters are applied BEFORE pagination so that total counts
        reflect the filtered dataset.

        Args:
            skip: Zero-based offset.
            limit: Maximum rows per page.
            search: Matches appointment_number, patient name,
                    or patient phone (case-insensitive).
            status: Exact status match.
            date_from: Inclusive lower bound on appointment_date.
            date_to: Inclusive upper bound on appointment_date.
            dentist_id: Filter by dentist (user FK).
        """

        # ── Build base query with optional filters ──────────────────
        base = select(Appointment)

        if search:
            pattern = f"%{search}%"
            base = base.join(
                Appointment.patient,
                isouter=True,
            ).where(
                (
                    Appointment.appointment_number.ilike(pattern)
                )
                | (
                    Appointment.patient.has(
                        Patient.first_name.ilike(pattern)
                    )
                )
                | (
                    Appointment.patient.has(
                        Patient.last_name.ilike(pattern)
                    )
                )
                | (
                    Appointment.patient.has(
                        Patient.primary_contact_number.ilike(pattern)
                    )
                )
            )

        if status is not None:
            base = base.where(
                Appointment.status == status
            )

        if date_from is not None:
            base = base.where(
                Appointment.appointment_date >= date_from
            )

        if date_to is not None:
            base = base.where(
                Appointment.appointment_date <= date_to
            )

        if dentist_id is not None:
            base = base.where(
                Appointment.dentist_id == dentist_id
            )

        # ── Count filtered rows ────────────────────────────────────
        count_stmt = select(func.count()).select_from(base.subquery())
        total = self.db.execute(count_stmt).scalar() or 0

        # ── Fetch paginated rows with eager-loaded relationships ────
        stmt = (
            base
            .options(
                selectinload(Appointment.patient),
                selectinload(Appointment.dentist),
            )
            .order_by(Appointment.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        rows = (
            self.db.execute(stmt)
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

    # Statuses that occupy a time slot and block new bookings.
    # Cancelled / No-Show free the slot; Completed is historical
    # and still occupies the slot (the time was consumed).
    _SLOT_OCCUPYING_STATUSES = {
        AppointmentStatus.SCHEDULED,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.IN_TREATMENT,
        AppointmentStatus.COMPLETED,
    }

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
                Appointment.status.in_(
                    self._SLOT_OCCUPYING_STATUSES
                ),
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

    def get_or_create_sequence(
        self,
        date_prefix: str,
    ) -> AppointmentSequence:
        """Atomically retrieve (with row lock) or create a per-day sequence.

        Uses ``SELECT ... FOR UPDATE`` to serialize concurrent requests
        for the same date prefix, preventing duplicate appointment numbers.

        Args:
            date_prefix: The date prefix (e.g. ``"APT-20260830"``).

        Returns:
            The locked ``AppointmentSequence`` row. The caller must
            increment ``current_value`` and flush.
        """

        stmt = (
            select(AppointmentSequence)
            .where(
                AppointmentSequence.date_prefix
                == date_prefix
            )
            .with_for_update()
        )

        seq = (
            self.db.execute(
                stmt
            ).scalar_one_or_none()
        )

        if seq is None:
            seq = AppointmentSequence(
                date_prefix=date_prefix,
                current_value=0,
            )
            self.db.add(seq)
            self.db.flush()  # assigns default, persists row
            # Re-lock after insert to match the SELECT FOR UPDATE path
            stmt_lock = (
                select(AppointmentSequence)
                .where(
                    AppointmentSequence.date_prefix
                    == date_prefix
                )
                .with_for_update()
            )
            seq = (
                self.db.execute(
                    stmt_lock
                ).scalar_one()
            )

        return seq

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
                Appointment.status.in_(
                    self._SLOT_OCCUPYING_STATUSES
                ),
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

    def list_by_date_range(
        self,
        start: date,
        end: date,
        dentist_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> list[Appointment]:
        """
        Return appointments within a bounded date range.

        Range semantics: [start, end) — inclusive start, exclusive end.

        Uses selectinload for patient and dentist relationships to
        avoid N+1 queries when resolving display names.

        The query uses the existing ix_appointments_date index for
        the primary range filter, and ix_appointments_dentist_schedule
        when filtering by dentist.
        """

        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient),
                selectinload(Appointment.dentist),
            )
            .where(
                Appointment.appointment_date >= start,
                Appointment.appointment_date < end,
            )
        )

        if dentist_id is not None:
            stmt = stmt.where(
                Appointment.dentist_id == dentist_id,
            )

        if status is not None:
            stmt = stmt.where(
                Appointment.status == status,
            )

        stmt = stmt.order_by(
            Appointment.appointment_date.asc(),
            Appointment.start_time.asc(),
        )

        return (
            self.db.execute(
                stmt
            )
            .scalars()
            .all()
        )