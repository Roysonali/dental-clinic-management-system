from __future__ import annotations

from datetime import date
from uuid import UUID
from typing import Optional

from sqlalchemy import (
    false as sql_false,
    func,
    or_,
    select,
    text,
)
from sqlalchemy.orm import Session

from app.modules.patients.models import Patient


class PatientRepository:
    """
    Data access layer for Patient entities.

    Encapsulates all SQLAlchemy query logic and exposes
    clean method signatures for the service layer to consume.
    """

    def __init__(
        self,
        db: Session,
    ):
        self.db = db

    def create(
        self,
        patient: Patient,
    ) -> Patient:
        """Persist a new patient record and return the refreshed instance."""

        self.db.add(
            patient
        )

        self.db.flush()

        self.db.refresh(
            patient
        )

        return patient

    

    def exists(self, patient_id: UUID) -> bool:
        """Return ``True`` if a patient with the given id exists."""
        stmt = select(Patient.id).where(Patient.id == patient_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def get_by_id(
        self,
        patient_id: UUID,
    ) -> Optional[Patient]:
        """Retrieve a single patient by UUID primary key."""

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
        """Retrieve a single patient by their unique patient code (e.g. PAT-000001)."""

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
    ) -> tuple[list[Patient], int]:
        """
        Retrieve a paginated, filterable list of patients.

        Supports:
        - Search across patient_code, names (first, middle, last, full),
          phone, and email
        - Active/inactive status filtering
        - Cursorless pagination via offset/limit

        Returns a tuple of (items, total_count).
        """
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

                Patient.middle_name.ilike(
                    f"%{search}%"
                ),

                Patient.last_name.ilike(
                    f"%{search}%"
                ),

                # Full name match: "first + last"
                func.concat(
                    Patient.first_name,
                    " ",
                    Patient.last_name,
                ).ilike(
                    f"%{search}%"
                ),

                # Full name match: "first + middle + last"
                # Uses concat_ws (concat with separator) which properly
                # skips NULL values without leaving orphaned spaces.
                func.concat_ws(
                    " ",
                    Patient.first_name,
                    Patient.middle_name,
                    Patient.last_name,
                ).ilike(
                    f"%{search}%"
                ),

                Patient.primary_contact_number.ilike(
                    f"%{search}%"
                ),

                Patient.email.ilike(
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
        updated_by: int | None = None,
    ) -> Patient:
        """Apply field-level updates to a patient record and return the refreshed instance."""

        for (
            field,
            value,
        ) in updates.items():

            setattr(
                patient,
                field,
                value,
            )

        if updated_by is not None:
            patient.updated_by = updated_by

        self.db.flush()

        self.db.refresh(
            patient
        )

        return patient

   

    def set_active_status(
        self,
        patient: Patient,
        status: bool,
        updated_by: int | None = None,
    ) -> Patient:
        """Toggle a patient's is_active flag and return the refreshed instance."""

        patient.is_active = (
            status
        )

        if updated_by is not None:
            patient.updated_by = updated_by

        self.db.flush()

        self.db.refresh(
            patient
        )

        return patient


    def find_exact_duplicate(
        self,
        first_name: str,
        last_name: str,
        date_of_birth: date,
        phone: str,
        email: Optional[str] = None,
    ) -> Optional[Patient]:
        """
        Detect an exact duplicate patient.

        An exact match requires:
            Name + DOB + Phone
        OR
            Name + DOB + Email (when email is provided)

        Returns the matched patient or None.
        """

        email_condition = (
            Patient.email == email
            if email
            else sql_false()
        )

        stmt = (
            select(Patient)
            .where(
                Patient.first_name == first_name,
                Patient.last_name == last_name,
                Patient.date_of_birth == date_of_birth,
                or_(
                    Patient.primary_contact_number == phone,
                    email_condition,
                ),
            )
        )

        return (
            self.db.execute(stmt)
            .scalar_one_or_none()
        )
    
    def find_exact_duplicate_for_update(
        self,
        patient_id: UUID,
        first_name: str,
        last_name: str,
        date_of_birth: date,
        phone: str,
        email: Optional[str] = None,
    ) -> Optional[Patient]:
        """
        Detect an exact duplicate excluding the current patient.

        Used during update to avoid flagging the patient being updated.
        Matches on Name + DOB + Phone (+ email if provided).
        """

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
    ) -> list[Patient]:
        """
        Find all patients sharing the given phone number.

        Used for warning-level duplicate detection (non-blocking).
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
        patient_id: UUID,
        phone: str,
    ) -> Optional[Patient]:
        """
        Find the first patient (excluding current) sharing the given phone.

        Used for warning-level duplicate detection during updates.
        """

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.primary_contact_number == phone,
            )
        )

        return (
            self.db.execute(stmt)
            .scalars()
            .first()
        )


    def find_by_email(
        self,
        email: str,
    ) -> list[Patient]:
        """
        Find all patients sharing the given email address.

        Used for warning-level duplicate detection (non-blocking).
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
        patient_id: UUID,
        email: str,
    ) -> Optional[Patient]:
        """
        Find the first patient (excluding current) sharing the given email.

        Used for warning-level duplicate detection during updates.
        """

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.email == email,
            )
        )

        return (
            self.db.execute(stmt)
            .scalars()
            .first()
        )

    def find_by_name_dob(
        self,
        first_name: str,
        last_name: str,
        date_of_birth: date,
    ) -> list[Patient]:
        """
        Find all patients with the same name and date of birth.

        Used for warning-level duplicate detection (non-blocking).
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
        patient_id: UUID,
        first_name: str,
        last_name: str,
        date_of_birth: date,
    ) -> Optional[Patient]:
        """
        Find the first patient (excluding current) with the same name and DOB.

        Used for warning-level duplicate detection during updates.
        """

        stmt = (
            select(Patient)
            .where(
                Patient.id != patient_id,
                Patient.first_name == first_name,
                Patient.last_name == last_name,
                Patient.date_of_birth == date_of_birth,
            )
        )

        return (
            self.db.execute(stmt)
            .scalars()
            .first()
        )
    

    def get_next_patient_sequence(
        self,
    ) -> int:
        """
        Retrieve the next value from the patient_code_seq PostgreSQL sequence.

        Returns the raw integer used to format patient codes (e.g. PAT-000001).
        """

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