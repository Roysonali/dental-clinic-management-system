from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patients.models import Patient
from app.modules.patients.repository import (
    PatientRepository,
)
from app.modules.patients.mapper import (
    PatientMapper,
)
from app.modules.patients.schemas import (
    PatientCreate,
    PatientUpdate,
)
from app.modules.patients.exceptions import (
    DuplicatePatientDetected,
    InvalidPatientOperation,
    PatientCreationFailed,
    PatientNotFound,
    PatientUpdateFailed,
)


class PatientService:

    def __init__(
        self,
        db: Session,
    ):

        self.db = db

        self.repository = (
            PatientRepository(
                db
            )
        )

    

    @staticmethod
    def _normalize_text(
        value,
    ):

        if value is None:
            return None

        return (
            str(value)
            .strip().title()
        )

    def _generate_patient_code(
        self,
    ):

        sequence = (

            self.repository
            .get_next_patient_sequence()
        )
        if sequence is None:
            raise PatientCreationFailed(
            details="Failed to generate patient sequence"
        )

        return (
            f"PAT-{sequence:06d}"
        )

    def _check_duplicates(
        self,
        payload: PatientCreate,
    ):
        """
        Checks for duplicate patients.

        Returns:
            list[str] -> Warning messages

        Raises:
            DuplicatePatientDetected -> Exact duplicate found
        """

        warnings = []

        first_name = self._normalize_text(payload.first_name)
        last_name = self._normalize_text(payload.last_name)

        email = (
            self._normalize_text(payload.email).lower()
            if payload.email
            else None
        )

        # --------------------------------------------------
        # Exact duplicate (BLOCK)
        # --------------------------------------------------

        exact_duplicate = self.repository.find_exact_duplicate(
            first_name=first_name,
            last_name=last_name,
            date_of_birth=payload.date_of_birth,
            phone=payload.primary_contact_number,
            email=email,
        )

        if exact_duplicate:

            raise DuplicatePatientDetected(
                details={
                    "patient_code": exact_duplicate.patient_code,
                    "name": f"{exact_duplicate.first_name} {exact_duplicate.last_name}",
                    "message": "Patient already exists."
                }
            )

        # --------------------------------------------------
        # Phone warning
        # --------------------------------------------------

        if self.repository.find_by_phone(
            payload.primary_contact_number
        ):
            warnings.append(
                "Primary contact number already exists."
            )

        # --------------------------------------------------
        # Email warning
        # --------------------------------------------------

        if email:

            if self.repository.find_by_email(email):

                warnings.append(
                    "Email address already exists."
                )

        # --------------------------------------------------
        # Name + DOB warning
        # --------------------------------------------------

        if self.repository.find_by_name_dob(
            first_name,
            last_name,
            payload.date_of_birth,
        ):

            warnings.append(
                "Patient with same name and date of birth already exists."
            )

        return warnings

   
    def create_patient(
        self,
        payload: PatientCreate,
        created_by,
    ):

        try:

            warnings = self._check_duplicates(
                payload
            )

            patient = Patient(

                patient_code=(
                    self
                    ._generate_patient_code()
                ),

                first_name=(
                    self
                    ._normalize_text(
                        payload.first_name
                    )
                ),

                middle_name=(
                    self
                    ._normalize_text(
                        payload.middle_name
                    )
                ),

                last_name=(
                    self
                    ._normalize_text(
                        payload.last_name
                    )
                ),

                date_of_birth=(
                    payload.date_of_birth
                ),

                gender=(
                    payload.gender
                ),

                primary_contact_number=(
                    payload.primary_contact_number
                ),

                emergency_contact_number=(
                    payload.emergency_contact_number
                ),

                email=(
                    self._normalize_text(
                        payload.email
                    ).lower()
                    if payload.email
                    else None
                ),

               address=self._normalize_text(payload.address),
               remarks=self._normalize_text(payload.remarks),

                created_by=(
                    created_by
                ),
            )

            patient = (
                self
                .repository
                .create(
                    patient
                )
            )

            self.db.commit()

            response = PatientMapper.to_response(patient)

            return PatientMapper.to_response(patient)

        except DuplicatePatientDetected:
            self.db.rollback()
            raise

        except Exception as e:

            self.db.rollback()

            print(
                "PATIENT CREATE ERROR:",
                repr(e)
            )

            raise PatientCreationFailed(
                details=str(e)
            )

   

    def get_patient(
        self,
        patient_id: UUID,
    ):

        patient = (

            self.repository
            .get_by_id(
                patient_id
            )
        )

        if not patient:

            raise (
                PatientNotFound()
            )

        return (
            PatientMapper
            .to_response(
                patient
            )
        )

  

    def list_patients(
        self,
        page=1,
        page_size=20,
        search=None,
        is_active=None,
    ):

        (
            patients,
            total,
        ) = (

            self.repository
            .list(

                page=page,

                page_size=page_size,

                search=search,

                is_active=is_active,
            )
        )

        return (
            PatientMapper
            .to_list_response(

                patients,

                total,

                page,

                page_size,
            )
        )

  

    def update_patient(
        self,
        patient_id: UUID,
        payload: PatientUpdate,
    ):

        try:

            patient = (
                self.repository
                .get_by_id(
                    patient_id
                )
            )

            if not patient:

                raise (
                    PatientNotFound()
                )

            updates = payload.model_dump(exclude_none=True)

            # Normalize text fields
            for field in [
                "first_name",
                "middle_name",
                "last_name",
                "address",
                "remarks",
            ]:
                if field in updates:
                    updates[field] = self._normalize_text(
                        updates[field]
                    )

            # Normalize email
            if "email" in updates and updates["email"]:
                updates["email"] = (
                    updates["email"]
                    .strip()
                    .lower()
                )

            # --------------------------------------------------
            # Duplicate validation
            # --------------------------------------------------
            warnings = self._check_update_duplicates(
                patient,
                updates,
            )

            # --------------------------------------------------
            # Update patient
            # --------------------------------------------------
            patient = (
                self.repository
                .update(
                    patient,
                    updates,
                )
            )

            self.db.commit()

            response = (
             PatientMapper
                .to_response(
                    patient
                )
            )

            return PatientMapper.to_response(patient)
    
        except PatientNotFound:
            self.db.rollback()
            raise

        except DuplicatePatientDetected:
            self.db.rollback()
            raise

        except Exception as e:

            self.db.rollback()

            raise PatientUpdateFailed(
            details=str(e)
        )


    def change_patient_status(
        self,
        patient_id: UUID,
        active: bool,
    ):

        patient = (
            self.repository
            .get_by_id(
                patient_id
            )
        )

        if not patient:

            raise (
                PatientNotFound()
            )

        if patient.is_active == active:

            raise (
                InvalidPatientOperation(
                    details=(
                        "status already set"
                    )
                )
            )

        patient = (
            self.repository
            .set_active_status(
                patient,
                active,
            )
        )

        self.db.commit()

        return (
            PatientMapper
            .to_response(
                patient
            )
        )


    def get_patient_profile(
        self,
        patient_id: UUID,
    ):

        patient = (
            self.repository
            .get_by_id(
                patient_id
            )
        )

        if not patient:

            raise (
                PatientNotFound()
            )

        return (
            PatientMapper
            .to_profile_response(
                patient
            )
        )
    
    def _check_update_duplicates(
        self,
        patient: Patient,
        updates: dict,
    ):
        """
        Checks duplicates while updating.
        Ignores the current patient.
        """

        warnings = []

        first_name = updates.get(
            "first_name",
            patient.first_name,
        )

        last_name = updates.get(
            "last_name",
            patient.last_name,
        )

        dob = updates.get(
            "date_of_birth",
            patient.date_of_birth,
        )

        phone = updates.get(
            "primary_contact_number",
            patient.primary_contact_number,
        )

        email = updates.get(
            "email",
            patient.email,
        )

        exact = (
            self.repository.find_exact_duplicate_for_update(
                patient.id,
                first_name,
                last_name,
                dob,
                phone,
                email,
            )
        )

        if exact:

            raise DuplicatePatientDetected(
                details={
                    "patient_code": exact.patient_code,
                    "name": f"{exact.first_name} {exact.last_name}",
                    "message": "Patient already exists."
                }
            )

        if self.repository.find_by_phone_for_update(
            patient.id,
            phone,
        ):
            warnings.append(
                "Primary contact number already exists."
            )

        if email:

            if self.repository.find_by_email_for_update(
                patient.id,
                email,
            ):
                warnings.append(
                    "Email address already exists."
                )

        if self.repository.find_by_name_dob_for_update(
            patient.id,
            first_name,
            last_name,
            dob,
        ):
            warnings.append(
                "Patient with same name and date of birth already exists."
            )

        return warnings