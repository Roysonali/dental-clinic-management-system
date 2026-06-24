from datetime import (
    date,
    time,
)
from typing import Optional
from uuid import UUID

from app.core.constants import (
    ALLOWED_APPOINTMENT_DURATIONS,
    CLINIC_EVENING_END,
    CLINIC_EVENING_START,
    CLINIC_MORNING_END,
    CLINIC_MORNING_START,
    CLINIC_WORKING_DAYS,
    ROLE_CHIEF_DOCTOR,
    ROLE_CONSULTING_DOCTOR,
    ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR,
)

from app.modules.appointments.enums import (
    AppointmentStatus,
)

from app.modules.appointments.exceptions import (
    AppointmentConflictException,
    AppointmentValidationException,
    InvalidAppointmentStatusTransition,
)

from app.modules.appointments.repository import (
    AppointmentRepository,
)

from app.modules.auth.models import (
    User,
)

from app.modules.patients.models import (
    Patient,
)


class AppointmentValidator:
    """
    Central business validation layer.

    Responsible only for enforcing business rules.
    No persistence.
    No transactions.
    """

    def __init__(
        self,
        repository: AppointmentRepository,
    ) -> None:

        self.repository = repository

    @staticmethod
    def validate_working_day(
        appointment_date: date,
    ) -> None:

        if appointment_date.weekday() not in CLINIC_WORKING_DAYS:
            raise AppointmentValidationException(
                "Clinic remains closed on this day."
            )

    @staticmethod
    def validate_duration(
        duration_minutes: int,
    ) -> None:

        if (
            duration_minutes
            not in ALLOWED_APPOINTMENT_DURATIONS
        ):
            raise AppointmentValidationException(
                "Invalid appointment duration."
            )

    @staticmethod
    def validate_working_hours(
        start_time: time,
        end_time: time,
    ) -> None:

        # normalize aware → naive
        if start_time.tzinfo:
            start_time = start_time.replace(
                tzinfo=None,
            )

        if end_time.tzinfo:
            end_time = end_time.replace(
                tzinfo=None,
            )

        morning_valid = (
            CLINIC_MORNING_START
            <= start_time
            and
            end_time
            <= CLINIC_MORNING_END
        )

        evening_valid = (
            CLINIC_EVENING_START
            <= start_time
            and
            end_time
            <= CLINIC_EVENING_END
        )

        if not (
            morning_valid
            or evening_valid
        ):
            raise AppointmentValidationException(
                (
                    "Appointment must be within "
                    "clinic working hours."
                )
            )

    @staticmethod
    def validate_patient(
        patient: Patient,
    ) -> None:

        if patient is None:
            raise AppointmentValidationException(
                "Patient not found."
            )

        if not patient.is_active:
            raise AppointmentValidationException(
                "Only active patients can be booked."
            )

    @staticmethod
    def validate_dentist(
        dentist: User,
    ) -> None:

        if dentist is None:
            raise AppointmentValidationException(
                "Dentist not found."
            )

        if not dentist.is_active:
            raise AppointmentValidationException(
                "Only active dentists can receive appointments."
            )

        allowed_roles = {
            ROLE_CHIEF_DOCTOR,
            ROLE_GENERAL_DOCTOR,
            ROLE_SPECIALIST_DOCTOR,
            ROLE_CONSULTING_DOCTOR,
        }

        role_name = (
            dentist.role.name
            if dentist.role
            else None
        )

        if role_name not in allowed_roles:
            raise AppointmentValidationException(
                (
                    "Selected user "
                    "is not a dentist."
                )
            )

    def validate_overlap(
        self,
        patient_id: UUID,
        dentist_id: int,
        appointment_date: date,
        start_time: time,
        end_time: time,
        exclude_id: Optional[UUID] = None,
    ) -> None:

        doctor_busy = (
            self.repository.doctor_overlap_exists(
                dentist_id=dentist_id,
                appointment_date=appointment_date,
                start_time=start_time,
                end_time=end_time,
                exclude_id=exclude_id,
            )
        )

        if doctor_busy:
            raise AppointmentConflictException(
                "Dentist already has an appointment."
            )

        patient_busy = (
            self.repository.patient_overlap_exists(
                patient_id=patient_id,
                appointment_date=appointment_date,
                start_time=start_time,
                end_time=end_time,
                exclude_id=exclude_id,
            )
        )

        if patient_busy:
            raise AppointmentConflictException(
                "Patient already has an appointment."
            )

    @staticmethod
    def validate_status_transition(
        current: AppointmentStatus,
        new: AppointmentStatus,
    ) -> None:

        transitions = {
            AppointmentStatus.SCHEDULED: {
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            },

            AppointmentStatus.CONFIRMED: {
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.NO_SHOW,
            },

            AppointmentStatus.CHECKED_IN: {
                AppointmentStatus.IN_TREATMENT,
            },

            AppointmentStatus.IN_TREATMENT: {
                AppointmentStatus.COMPLETED,
            },
        }

        allowed = transitions.get(
            current,
            set(),
        )

        if (
            current != new
            and new not in allowed
        ):
            raise InvalidAppointmentStatusTransition(
                (
                    f"Invalid appointment transition: "
                    f"{current.value} → {new.value}"
                )
            )