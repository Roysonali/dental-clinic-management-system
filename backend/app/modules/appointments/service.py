from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
)
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
    ) -> tuple[list[Appointment], int]:

        return (
            self.repository.list(
                skip,
                limit,
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

            if (
                appointment.status
                ==
                AppointmentStatus.COMPLETED
            ):
                raise (
                    AppointmentValidationException(
                        "Completed appointments cannot be edited."
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

    def today(
        self,
    ) -> list[Appointment]:

        return (
            self.repository.get_today(
                date.today()
            )
        )

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
        Generate a unique appointment number.

        Format: APT-YYYYMMDD-NNNN
        - Prefix: APT
        - Date portion: current UTC date
        - Sequence: zero-padded incrementing number

        Queries the repository for the highest existing
        sequence for today to ensure uniqueness.
        """

        today_prefix = (
            "APT-"
            +
            datetime.now(
                timezone.utc
            ).strftime(
                "%Y%m%d"
            )
            +
            "-"
        )

        latest = (
            self.repository.get_latest_number_prefix(
                today_prefix,
            )
        )

        if latest:
            # Extract sequence, increment
            seq = int(
                latest.split("-")[-1]
            ) + 1
        else:
            seq = 1

        return (
            today_prefix
            +
            f"{seq:04d}"
        )