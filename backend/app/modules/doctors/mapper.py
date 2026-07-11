"""Doctor Management Module — Presentation Mapper.

Transforms Doctor ORM entities returned by the Service layer into the
Pydantic response schemas consumed by the API layer.

Keeping this mapping isolated here (rather than in routers or services)
follows the same convention as ``app.modules.patients.mapper`` and keeps
the routers extremely thin: a router calls the service, then hands the
ORM to this mapper and returns the response schema.
"""

from __future__ import annotations

from typing import Sequence

from app.modules.doctors.models import Doctor, DoctorSchedule, DoctorSpecialization
from app.modules.doctors.schemas import (
    DoctorListResponse,
    DoctorProfileResponse,
    DoctorResponse,
    DoctorSpecializationResponse,
    ScheduleResponse,
)


class DoctorMapper:
    """Maps Doctor ORM instances to Pydantic response schemas."""

    # ==================================================================
    # Specialization sub-mapping
    # ==================================================================

    @classmethod
    def to_specialization_response(
        cls,
        assignment: DoctorSpecialization,
    ) -> DoctorSpecializationResponse:
        """Map a DoctorSpecialization junction row to its response schema."""
        specialization = assignment.specialization
        return DoctorSpecializationResponse(
            specialization_id=assignment.specialization_id,
            specialization_name=specialization.name if specialization else "",
            specialization_code=specialization.code if specialization else "",
            is_primary=assignment.is_primary,
            certification_date=assignment.certification_date,
        )

    # ==================================================================
    # Schedule sub-mapping
    # ==================================================================

    @classmethod
    def to_schedule_response(
        cls,
        schedule: DoctorSchedule,
    ) -> ScheduleResponse:
        """Map a DoctorSchedule template to its response schema."""
        return ScheduleResponse(
            id=schedule.id,
            doctor_id=schedule.doctor_id,
            day_of_week=schedule.day_of_week,
            start_time=schedule.start_time,
            end_time=schedule.end_time,
            is_active=schedule.is_active,
        )

    # ==================================================================
    # Single Response
    # ==================================================================

    @classmethod
    def to_response(
        cls,
        doctor: Doctor,
    ) -> DoctorResponse:
        """Map a Doctor ORM instance to a full DoctorResponse schema."""
        return DoctorResponse(
            id=doctor.id,
            doctor_code=doctor.doctor_code,
            user_id=doctor.user_id,
            user_full_name=doctor.user.full_name if doctor.user else None,
            user_email=doctor.user.email if doctor.user else None,
            date_of_birth=doctor.date_of_birth,
            gender=doctor.gender,
            primary_phone=doctor.primary_phone,
            address=doctor.address,
            qualification=doctor.qualification,
            registration_number=doctor.registration_number,
            years_of_experience=doctor.years_of_experience,
            consultation_fee=doctor.consultation_fee,
            consultation_duration=doctor.consultation_duration,
            languages_known=doctor.languages_known,
            profile_photo_url=doctor.profile_photo_url,
            biography=doctor.biography,
            emergency_contact_name=doctor.emergency_contact_name,
            emergency_contact_phone=doctor.emergency_contact_phone,
            available_for_appointment=doctor.available_for_appointment,
            on_leave=doctor.on_leave,
            is_active=doctor.is_active,
            specializations=[
                cls.to_specialization_response(assignment)
                for assignment in doctor.specializations
            ],
            created_by=doctor.created_by,
            updated_by=doctor.updated_by,
            created_at=doctor.created_at,
            updated_at=doctor.updated_at,
        )

    # ==================================================================
    # List Response
    # ==================================================================

    @classmethod
    def to_list_response(
        cls,
        doctors: Sequence[Doctor],
        total: int,
        page: int,
        page_size: int,
    ) -> DoctorListResponse:
        """Map a list of Doctor ORM instances to a paginated list response."""
        return DoctorListResponse(
            items=[cls.to_response(doctor) for doctor in doctors],
            total=total,
            page=page,
            page_size=page_size,
        )

    # ==================================================================
    # Profile Response
    # ==================================================================

    @classmethod
    def to_profile_response(
        cls,
        doctor: Doctor,
    ) -> DoctorProfileResponse:
        """Map a Doctor ORM (with schedules + specializations loaded) to a profile response."""
        profile = cls.to_response(doctor).model_dump()
        profile["schedules"] = [
            cls.to_schedule_response(schedule) for schedule in doctor.schedules
        ]
        return DoctorProfileResponse(**profile)
