from datetime import date

from app.modules.patients.models import Patient
from app.modules.patients.schemas import (
    PatientListItem,
    PatientListResponse,
    PatientProfileResponse,
    PatientResponse,
)


class PatientMapper:

    # ==========================================
    # Utilities
    # ==========================================

    @staticmethod
    def build_full_name(
        patient: Patient,
    ) -> str:

        parts = filter(None, [

            patient.first_name,

            patient.middle_name,

            patient.last_name,
        ])

        return " ".join(
            [
                p.strip()
                for p in parts
                if p
            ]
        )

    @staticmethod
    def calculate_age(
        dob: date | None,
    ) -> int |None:

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

        return PatientResponse(

            str( patient.id),

            patient_code=patient.patient_code,

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

        return PatientListItem(

            str( patient.id),

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
            ),

            primary_contact_number=(
                patient.primary_contact_number
            ),

            is_active=patient.is_active,
        )

    # ==========================================
    # List Response
    # ==========================================

    @classmethod
    def to_list_response(
        cls,
        patients,
        total: int,
        page: int,
        page_size: int,
    ) -> PatientListResponse:

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

        return PatientProfileResponse(
            **cls.to_response(
                patient
            ).model_dump()
        )