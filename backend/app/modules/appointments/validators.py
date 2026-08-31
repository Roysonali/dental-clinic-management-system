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

from app.modules.doctors.models import (
    Doctor,
    DoctorSchedule,
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

    @staticmethod
    def validate_doctor_profile(
        doctor: Optional["Doctor"],
    ) -> None:
        """Validate the Doctor profile for appointment eligibility.

        Checks:
        - Doctor profile exists (linked to the User)
        - Doctor profile is active
        - Doctor is available for appointments
        - Doctor is not on leave

        Args:
            doctor: The Doctor entity (may be None if no profile exists).

        Raises:
            AppointmentValidationException: On any validation failure.
        """

        if doctor is None:
            raise AppointmentValidationException(
                (
                    "No doctor profile found for "
                    "the selected dentist."
                )
            )

        if not doctor.is_active:
            raise AppointmentValidationException(
                (
                    "Doctor profile is inactive."
                )
            )

        if not doctor.available_for_appointment:
            raise AppointmentValidationException(
                (
                    "Doctor is not available "
                    "for appointments."
                )
            )

        if doctor.on_leave:
            raise AppointmentValidationException(
                (
                    "Doctor is currently on leave."
                )
            )

    @staticmethod
    def _find_active_session(
        start: time,
        end: time,
    ) -> Optional[tuple[time, time]]:
        """Find a clinic session window that contains [start, end)."""
        for session_start, session_end in [
            (CLINIC_MORNING_START, CLINIC_MORNING_END),
            (CLINIC_EVENING_START, CLINIC_EVENING_END),
        ]:
            if session_start <= start and end <= session_end:
                return (session_start, session_end)
        return None

    @staticmethod
    def validate_doctor_schedule(
        doctor: "Doctor",
        appointment_date: date,
        start_time: time,
        end_time: time,
    ) -> None:
        """Validate that the requested time falls within the doctor's schedule.

        The DoctorSchedule table stores weekly recurring templates:
        day_of_week (0=Monday..5=Saturday) with start/end times.

        Schedule precedence (source-of-truth hierarchy):

        1. Doctor has ZERO schedule configuration:
           → use clinic default schedule as fallback.

        2. Doctor has ANY explicit schedule configuration:
           → doctor schedule becomes authoritative.

        3. Explicit schedule exists and is active for the day:
           → use that schedule.  Multiple sessions per day are
             supported; the appointment must fit inside at least one.

        4. Explicit schedule exists but is inactive for the day:
           → doctor unavailable for that day.  DO NOT fall back
             to clinic hours.

        5. Doctor has explicit schedules, but requested weekday
           has no schedule entry:
           → doctor unavailable for that day.  DO NOT fall back
             to clinic hours.

        6. Leave / doctor availability rules (validate_doctor_profile)
           override both explicit schedules and clinic defaults.

        7. Sunday remains unavailable unless business rules
           explicitly permit it.

        Args:
            doctor: The Doctor entity with schedules loaded.
            appointment_date: The requested appointment date.
            start_time: The requested start time.
            end_time: The requested end time.

        Raises:
            AppointmentValidationException: On any schedule violation.
        """

        day_of_week = appointment_date.weekday()

        # Normalize aware → naive for comparison
        if start_time.tzinfo:
            start_time = start_time.replace(tzinfo=None)
        if end_time.tzinfo:
            end_time = end_time.replace(tzinfo=None)

        schedules = doctor.schedules or []
        has_any_schedule = len(schedules) > 0

        # Collect schedules for the requested day
        day_schedules = [
            s for s in schedules if s.day_of_week == day_of_week
        ]

        if has_any_schedule:
            # ── Doctor has explicit schedule config → it is authoritative ──

            if not day_schedules:
                # Rule 5: No schedule for this weekday → unavailable
                raise AppointmentValidationException(
                    (
                        "Doctor has no working schedule "
                        f"for {appointment_date.strftime('%A')}."
                    )
                )

            # Rule 3 / 4: Check if any active schedule for this day fits
            active_sessions: list[str] = []
            for sched in day_schedules:
                sched_start = sched.start_time
                sched_end = sched.end_time
                if sched_start.tzinfo:
                    sched_start = sched_start.replace(tzinfo=None)
                if sched_end.tzinfo:
                    sched_end = sched_end.replace(tzinfo=None)

                if sched.is_active:
                    active_sessions.append(
                        f"{sched_start.strftime('%H:%M')}-"
                        f"{sched_end.strftime('%H:%M')}"
                    )
                    if sched_start <= start_time and end_time <= sched_end:
                        return  # Fits inside this session — valid

            # Rule 4: Day exists but no active schedule fits
            if active_sessions:
                hours_str = " or ".join(active_sessions)
                raise AppointmentValidationException(
                    (
                        f"Requested time "
                        f"{start_time.strftime('%H:%M')}-"
                        f"{end_time.strftime('%H:%M')} falls outside "
                        f"doctor's schedule ({hours_str})."
                    )
                )
            else:
                raise AppointmentValidationException(
                    (
                        "Doctor has no working schedule "
                        f"for {appointment_date.strftime('%A')}."
                    )
                )

        # ── Rule 1: Doctor has ZERO schedules → clinic default fallback ──

        if day_of_week not in CLINIC_WORKING_DAYS:
            raise AppointmentValidationException(
                (
                    "Doctor has no working schedule "
                    f"for {appointment_date.strftime('%A')}."
                )
            )

        session = AppointmentValidator._find_active_session(
            start_time, end_time,
        )
        if session is None:
            morning = (
                f"{CLINIC_MORNING_START.strftime('%H:%M')}-"
                f"{CLINIC_MORNING_END.strftime('%H:%M')}"
            )
            evening = (
                f"{CLINIC_EVENING_START.strftime('%H:%M')}-"
                f"{CLINIC_EVENING_END.strftime('%H:%M')}"
            )
            raise AppointmentValidationException(
                (
                    f"Requested time {start_time.strftime('%H:%M')}-"
                    f"{end_time.strftime('%H:%M')} falls outside "
                    f"clinic working hours "
                    f"({morning} or {evening})."
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