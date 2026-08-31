from __future__ import annotations

from datetime import (
    date,
    datetime,
    time,
    timedelta,
    timezone,
)
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.appointments.enums import (
    AppointmentStatus,
)

from app.modules.appointments.exceptions import (
    AppointmentNotFoundException,
    AppointmentValidationException,
)

from app.modules.appointments.model import (
    Appointment,
)

from app.modules.appointments.repository import (
    AppointmentRepository,
)

from app.modules.appointments.schema import (
    AppointmentCreate,
    AppointmentUpdate,
    CalendarAppointmentResponse,
    CalendarAppointmentListResponse,
)

from app.modules.patients.mapper import (
    PatientMapper,
)

from app.modules.appointments.validators import (
    AppointmentValidator,
)

from app.modules.auth.models import (
    User,
)

from app.modules.users.repository import (
    get_user_by_id,
)

from app.modules.patients.repository import (
    PatientRepository,
)

from app.modules.doctors.repositories import (
    DoctorRepository,
)


class AppointmentService:
    """
    Handles appointment workflows.

    Coordinates:
    - repositories
    - validators
    - transactions
    """

    def __init__(
        self,
        db: Session,
    ) -> None:

        self.db = db

        self.repository = (
            AppointmentRepository(
                db,
            )
        )

        self.patient_repository = (
            PatientRepository(
                db,
            )
        )

        self.doctor_repository = (
            DoctorRepository(
                db,
            )
        )

        self.validator = (
            AppointmentValidator(
                self.repository,
            )
        )

    def create(
        self,
        payload: AppointmentCreate,
        actor: User,
    ) -> Appointment:

        try:

            patient = (
                self.patient_repository
                .get_by_id(
                    payload.patient_id
                )
            )

            dentist = (
                get_user_by_id(
                    self.db,
                    payload.dentist_id
                )
            )

            self.validator.validate_patient(
                patient,
            )

            self.validator.validate_dentist(
                dentist,
            )

            # Load Doctor profile for availability/schedule checks
            doctor_profile = (
                self.doctor_repository
                .get_by_user_id(
                    dentist.id
                )
            )

            self.validator.validate_doctor_profile(
                doctor_profile,
            )

            self.validator.validate_working_day(
                payload.appointment_date,
            )

            self.validator.validate_duration(
                payload.duration_minutes,
            )

            end_time = (
                self._calculate_end_time(
                    payload.appointment_date,
                    payload.start_time,
                    payload.duration_minutes,
                )
            )

            self.validator.validate_working_hours(
                payload.start_time,
                end_time,
            )

            # Validate doctor's schedule for the requested day/time
            self.validator.validate_doctor_schedule(
                doctor=doctor_profile,
                appointment_date=payload.appointment_date,
                start_time=payload.start_time,
                end_time=end_time,
            )

            self.validator.validate_overlap(
                patient_id=patient.id,
                dentist_id=dentist.id,
                appointment_date=payload.appointment_date,
                start_time=payload.start_time,
                end_time=end_time,
            )

            appointment = Appointment(
                appointment_number=(
                    self._generate_number()
                ),
                patient_id=patient.id,
                dentist_id=dentist.id,
                appointment_date=payload.appointment_date,
                start_time=payload.start_time,
                end_time=end_time,
                duration_minutes=payload.duration_minutes,
                appointment_type=payload.appointment_type,
                status=AppointmentStatus.SCHEDULED,
                reason_for_visit=payload.reason_for_visit,
                notes=payload.notes,
                created_by=actor.id,
            )

            appointment = (
                self.repository.create(
                    appointment
                )
            )

            self.db.commit()

            return appointment

        except Exception:
            self.db.rollback()
            raise

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

        return (
            self.repository.list(
                skip=skip,
                limit=limit,
                search=search,
                status=status,
                date_from=date_from,
                date_to=date_to,
                dentist_id=dentist_id,
            )
        )

    def get(
        self,
        appointment_id: UUID,
    ) -> Appointment:

        appointment = (
            self.repository.get_by_id(
                appointment_id,
            )
        )

        if not appointment:
            raise (
                AppointmentNotFoundException(
                    "Appointment not found."
                )
            )

        return appointment

    def update(
        self,
        appointment: Appointment,
        payload: AppointmentUpdate,
        actor: User,
    ) -> Appointment:

        try:

            # Terminal appointments cannot be edited
            terminal_statuses = {
                AppointmentStatus.COMPLETED,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            }
            if appointment.status in terminal_statuses:
                raise (
                    AppointmentValidationException(
                        f"{appointment.status.value} appointments cannot be edited."
                    )
                )

            updates = (
                payload.model_dump(
                    exclude_unset=True,
                )
            )

            new_date = (
                updates.get(
                    "appointment_date",
                    appointment.appointment_date,
                )
            )

            new_start = (
                updates.get(
                    "start_time",
                    appointment.start_time,
                )
            )

            new_duration = (
                updates.get(
                    "duration_minutes",
                    appointment.duration_minutes,
                )
            )

            new_dentist = (
                updates.get(
                    "dentist_id",
                    appointment.dentist_id,
                )
            )

            end_time = (
                self._calculate_end_time(
                    new_date,
                    new_start,
                    new_duration,
                )
            )

            self.validator.validate_working_day(
                new_date,
            )

            self.validator.validate_duration(
                new_duration,
            )

            self.validator.validate_working_hours(
                new_start,
                end_time,
            )

            if (
                new_dentist
                !=
                appointment.dentist_id
            ):
                dentist = (
                    get_user_by_id(
                        self.db,
                        new_dentist,
                    )
                )

                self.validator.validate_dentist(
                    dentist,
                )

            # Validate doctor profile and schedule for the new date/time
            doctor_profile = (
                self.doctor_repository
                .get_by_user_id(
                    new_dentist
                )
            )

            self.validator.validate_doctor_profile(
                doctor_profile,
            )

            self.validator.validate_doctor_schedule(
                doctor=doctor_profile,
                appointment_date=new_date,
                start_time=new_start,
                end_time=end_time,
            )

            self.validator.validate_overlap(
                patient_id=appointment.patient_id,
                dentist_id=new_dentist,
                appointment_date=new_date,
                start_time=new_start,
                end_time=end_time,
                exclude_id=appointment.id,
            )

            for (
                field,
                value,
            ) in updates.items():

                setattr(
                    appointment,
                    field,
                    value,
                )

            appointment.end_time = (
                end_time
            )

            appointment.updated_by = (
                actor.id
            )

            appointment = (
                self.repository.update(
                    appointment
                )
            )

            self.db.commit()

            return appointment

        except Exception:
            self.db.rollback()
            raise

    def cancel(
        self,
        appointment: Appointment,
        actor: User,
    ) -> Appointment:

        try:

            self.validator.validate_status_transition(
                appointment.status,
                AppointmentStatus.CANCELLED,
            )

            appointment.status = (
                AppointmentStatus.CANCELLED
            )

            appointment.updated_by = (
                actor.id
            )

            appointment = (
                self.repository.update(
                    appointment
                )
            )

            self.db.commit()

            return appointment

        except Exception:
            self.db.rollback()
            raise

    def change_status(
        self,
        appointment: Appointment,
        new_status: AppointmentStatus,
        actor: User,
    ) -> Appointment:
        """Transition an appointment to a new status.

        Validates the transition against the allowed transition graph,
        updates the status, and persists the change.

        Args:
            appointment: The current appointment entity.
            new_status: The desired new status.
            actor: The authenticated user performing the transition.

        Returns:
            The updated appointment.

        Raises:
            InvalidAppointmentStatusTransition: If the transition is not allowed.
        """

        try:

            self.validator.validate_status_transition(
                appointment.status,
                new_status,
            )

            appointment.status = new_status
            appointment.updated_by = actor.id

            appointment = (
                self.repository.update(
                    appointment
                )
            )

            self.db.commit()

            return appointment

        except Exception:
            self.db.rollback()
            raise

    def today(
        self,
    ) -> list[Appointment]:

        return (
            self.repository.get_today(
                date.today()
            )
        )

    def list_by_patient(
        self,
        patient_id: UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Appointment], int]:
        """Return paginated appointments for a specific patient."""

        return (
            self.repository.list_by_patient(
                patient_id=patient_id,
                skip=skip,
                limit=limit,
            )
        )

    def calendar(
        self,
        start: date,
        end: date,
        dentist_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> CalendarAppointmentListResponse:
        """
        Return appointments within a bounded date range for calendar rendering.

        Range semantics: [start, end) — inclusive start, exclusive end.
        Maximum allowed range: 90 days.
        """

        max_range_days = 90

        if start >= end:
            raise AppointmentValidationException(
                "Invalid date range: 'start' must be before 'end'."
            )

        if (end - start).days > max_range_days:
            raise AppointmentValidationException(
                f"Date range exceeds maximum of {max_range_days} days."
            )

        appointments = self.repository.list_by_date_range(
            start=start,
            end=end,
            dentist_id=dentist_id,
            status=status,
        )

        items = [
            CalendarAppointmentResponse(
                id=apt.id,
                appointment_number=apt.appointment_number,
                patient_id=apt.patient_id,
                patient_name=PatientMapper.build_full_name(apt.patient),
                dentist_id=apt.dentist_id,
                dentist_name=apt.dentist.full_name,
                appointment_date=apt.appointment_date,
                start_time=apt.start_time,
                end_time=apt.end_time,
                duration_minutes=apt.duration_minutes,
                appointment_type=apt.appointment_type,
                status=apt.status,
                reason_for_visit=apt.reason_for_visit,
            )
            for apt in appointments
        ]

        return CalendarAppointmentListResponse(items=items)

    @staticmethod
    def _calculate_end_time(
        appointment_date: date,
        start_time: time,
        duration_minutes: int,
    ) -> time:

        return (
            datetime.combine(
                appointment_date,
                start_time,
            )
            +
            timedelta(
                minutes=duration_minutes,
            )
        ).time()

    def _generate_number(
        self,
    ) -> str:
        """
        Generate a unique appointment number atomically.

        Format: APT-YYYYMMDD-NNNN
        - Prefix: APT
        - Date portion: current UTC date
        - Sequence: zero-padded incrementing number

        Uses a per-day sequence row with SELECT ... FOR UPDATE
        to prevent duplicate numbers under concurrent requests.
        """

        today_prefix = (
            "APT-"
            +
            datetime.now(
                timezone.utc
            ).strftime(
                "%Y%m%d"
            )
        )

        seq_row = (
            self.repository
            .get_or_create_sequence(
                today_prefix
            )
        )

        seq_row.current_value += 1
        self.db.flush()

        return (
            f"{today_prefix}-"
            f"{seq_row.current_value:04d}"
        )