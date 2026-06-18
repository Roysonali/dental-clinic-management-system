from uuid import UUID
from typing import Optional

from sqlalchemy import (
    func,
    or_,
    select,
    text,
)
from sqlalchemy.orm import Session

from app.modules.patients.models import Patient


class PatientRepository:

    def __init__(
        self,
        db: Session,
    ):
        self.db = db

    def create(
        self,
        patient: Patient,
    ) -> Patient:

        self.db.add(
            patient
        )

        self.db.flush()

        self.db.refresh(
            patient
        )

        return patient

    

    def get_by_id(
        self,
        patient_id: UUID,
    ) -> Optional[Patient]:

        stmt = (
            select(
                Patient
            )
            .where(
                Patient.id
                == patient_id
            )
        )

        return (
            self.db.execute(
                stmt
            )
            .scalar_one_or_none()
        )

    

    def get_by_patient_code(
        self,
        patient_code: str,
    ) -> Optional[Patient]:

        stmt = (
            select(
                Patient
            )
            .where(
                Patient.patient_code
                == patient_code
            )
        )

        return (
            self.db.execute(
                stmt
            )
            .scalar_one_or_none()
        )

   
    def list(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[
            str
        ] = None,
        is_active: Optional[
            bool
        ] = None,
    ):

        stmt = select(
            Patient
        )

        count_stmt = (
            select(
                func.count()
            )
            .select_from(
                Patient
            )
        )

        if search:

            search_filter = or_(

                Patient.patient_code.ilike(
                    f"%{search}%"
                ),

                Patient.first_name.ilike(
                    f"%{search}%"
                ),

                Patient.last_name.ilike(
                    f"%{search}%"
                ),

                Patient.primary_contact_number.ilike(
                    f"%{search}%"
                ),
            )

            stmt = stmt.where(
                search_filter
            )

            count_stmt = (
                count_stmt.where(
                    search_filter
                )
            )

        if (
            is_active
            is not None
        ):

            stmt = stmt.where(
                Patient.is_active
                == is_active
            )

            count_stmt = (
                count_stmt.where(
                    Patient.is_active
                    == is_active
                )
            )

        stmt = (

            stmt

            .order_by(
                Patient.created_at.desc()
            )

            .offset(
                (
                    page - 1
                )
                * page_size
            )

            .limit(
                page_size
            )
        )

        items = (

            self.db.execute(
                stmt
            )

            .scalars()

            .all()
        )

        total = (

            self.db.execute(
                count_stmt
            )

            .scalar()
        )

        return (
            items,
            total,
        )


    def update(
        self,
        patient: Patient,
        updates: dict,
    ) -> Patient:

        for (
            field,
            value,
        ) in updates.items():

            setattr(
                patient,
                field,
                value,
            )

        self.db.flush()

        self.db.refresh(
            patient
        )

        return patient

   

    def set_active_status(
        self,
        patient: Patient,
        status: bool,
    ) -> Patient:

        patient.is_active = (
            status
        )

        self.db.flush()

        self.db.refresh(
            patient
        )

        return patient


    def find_exact_duplicate(
        self,
        first_name: str,
        last_name: str,
        date_of_birth,
        phone: str,
        email: Optional[str] = None,
    ) -> Optional[Patient]:
        """
        Returns a patient only when ALL important identifying
        fields match.

        Exact Duplicate Rule:
        Name + DOB + Phone
        OR
        Name + DOB + Email
        """

        stmt = (
            select(Patient)
            .where(
                Patient.first_name == first_name,
                Patient.last_name == last_name,
                Patient.date_of_birth == date_of_birth,
                or_(
                    Patient.primary_contact_number == phone,
                    Patient.email == email if email else False,
                ),
            )
        )

        return (
            self.db.execute(stmt)
            .scalar_one_or_none()
        )
    
    def find_exact_duplicate_for_update(
        self,
        patient_id,
        first_name: str,
        last_name: str,
        date_of_birth,
        phone: str,
        email: str | None,
    ):

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.first_name == first_name,
                Patient.last_name == last_name,
                Patient.date_of_birth == date_of_birth,
                Patient.primary_contact_number == phone,
            )
        )

        if email:
            stmt = stmt.where(
                Patient.email == email
            )

        return (
            self.db.execute(stmt)
            .scalar_one_or_none()
        )


    def find_by_phone(
        self,
        phone: str,
    ):
        """
        Returns all patients having the same phone number.
        Used only for warnings.
        """

        stmt = (
            select(Patient)
            .where(
                Patient.primary_contact_number == phone
            )
        )

        return (
            self.db.execute(stmt)
            .scalars()
            .all()
        )
    
    def find_by_phone_for_update(
        self,
        patient_id,
        phone: str,
    ):

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.primary_contact_number == phone,
            )
        )

        return (
            self.db.execute(stmt)
            .scalar_one_or_none()
        )


    def find_by_email(
        self,
        email: str,
    ):
        """
        Returns all patients having the same email.
        Used only for warnings.
        """

        stmt = (
            select(Patient)
            .where(
                Patient.email == email
            )
        )

        return (
            self.db.execute(stmt)
            .scalars()
            .all()
        )

    def find_by_email_for_update(
        self,
        patient_id,
        email: str,
    ):

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.email == email,
            )
        )

        return (
            self.db.execute(stmt)
            .scalar_one_or_none()
        )

    def find_by_name_dob(
        self,
        first_name: str,
        last_name: str,
        date_of_birth,
    ):
        """
        Returns patients with same name and DOB.
        Used only for warnings.
        """

        stmt = (
            select(Patient)
            .where(
                Patient.first_name == first_name,
                Patient.last_name == last_name,
                Patient.date_of_birth == date_of_birth,
            )
        )

        return (
            self.db.execute(stmt)
            .scalars()
            .all()
        )

    def find_by_name_dob_for_update(
        self,
        patient_id,
        first_name,
        last_name,
        dob,
    ):

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.first_name == first_name,
                Patient.last_name == last_name,
                Patient.date_of_birth == dob,
            )
        )

        return (
            self.db.execute(stmt)
            .scalar_one_or_none()
        )
    

    def get_next_patient_sequence(
        self,
    ) -> int:

        stmt = text(
            """
            SELECT nextval(
                'patient_code_seq'
            )
            """
        )

        result = (
            self.db.execute(
                stmt
            )
            .scalar()
        )

        return int(
            result
        )