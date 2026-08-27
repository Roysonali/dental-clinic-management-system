from __future__ import annotations

from datetime import date
from typing import Sequence

from app.modules.patients.models import Patient
from app.modules.patients.schemas import (
    PatientListItem,
    PatientListResponse,
    PatientProfileResponse,
    PatientResponse,
)
from app.core.constants import ProfileStatus


class PatientMapper:
    """Maps Patient ORM instances to Pydantic response schemas.

    Keeps serialization logic isolated from both the domain layer
    (models) and the presentation layer (schemas), providing a
    single place to control how data is transformed for API output.
    """

    # ==========================================
    # Utilities
    # ==========================================

    @staticmethod
    def build_full_name(
        patient: Patient,
    ) -> str:
        """Construct a patient's full name from first, middle, and last names."""

        parts = filter(None, [
            patient.first_name,
            patient.middle_name,
            patient.last_name,
        ])

        return " ".join(parts)

    @staticmethod
    def calculate_age(
        dob: date | None,
    ) -> int | None:
        """Calculate age from date of birth. Returns None if DOB is None."""

        if dob is None:
            return None

        today = date.today()

        age = (
            today.year
            - dob.year
        )

        if (
            today.month,
            today.day,
        ) < (
            dob.month,
            dob.day,
        ):
            age -= 1

        return age

    # ==========================================
    # Single Response
    # ==========================================

    @classmethod
    def to_response(
        cls,
        patient: Patient,
    ) -> PatientResponse:
        """Map a Patient ORM instance to a full PatientResponse schema."""

        return PatientResponse(

            id=str(patient.id),

            patient_code=patient.patient_code,

            first_name=patient.first_name,

            middle_name=patient.middle_name,

            last_name=patient.last_name,

            full_name=cls.build_full_name(
                patient
            ),

            date_of_birth=patient.date_of_birth,

            age=cls.calculate_age(
                patient.date_of_birth
            ),

            gender=(
                patient.gender.value
                if patient.gender
                else None
            ),

            primary_contact_number=(
                patient.primary_contact_number
            ),

            emergency_contact_number=(
                patient.emergency_contact_number
            ),

            email=patient.email,

            address=patient.address,

            remarks=patient.remarks,

            is_active=patient.is_active,

            profile_status=(
                patient.profile_status
                if patient.profile_status
                else ProfileStatus.COMPLETE
            ),

            created_by=patient.created_by,

            updated_by=patient.updated_by,

            created_at=patient.created_at,

            updated_at=patient.updated_at,
        )

    # ==========================================
    # List Item
    # ==========================================

    @classmethod
    def to_list_item(
        cls,
        patient: Patient,
    ) -> PatientListItem:
        """Map a Patient ORM instance to a lightweight PatientListItem schema."""

        return PatientListItem(

            id=str(patient.id),

            patient_code=patient.patient_code,

            full_name=cls.build_full_name(
                patient
            ),

            age=cls.calculate_age(
                patient.date_of_birth
            ),

            gender=(
                patient.gender.value
                if patient.gender
                else None
            ),            primary_contact_number=(
                patient.primary_contact_number
            ),
            is_active=patient.is_active,
            profile_status=(
                patient.profile_status
                if patient.profile_status
                else ProfileStatus.COMPLETE
            ),
        )

    # ==========================================
    # List Response
    # ==========================================

    @classmethod
    def to_list_response(
        cls,
        patients: Sequence[Patient],
        total: int,
        page: int,
        page_size: int,
    ) -> PatientListResponse:
        """Map a list of Patient ORM instances to a paginated list response."""

        return PatientListResponse(

            items=[
                cls.to_list_item(
                    patient
                )
                for patient
                in patients
            ],

            total=total,

            page=page,

            page_size=page_size,
        )

    # ==========================================
    # Profile
    # ==========================================

    @classmethod
    def to_profile_response(
        cls,
        patient: Patient,
    ) -> PatientProfileResponse:
        """Map a Patient ORM instance to a full patient profile response."""

        return PatientProfileResponse(
            **cls.to_response(
                patient
            ).model_dump()
        )