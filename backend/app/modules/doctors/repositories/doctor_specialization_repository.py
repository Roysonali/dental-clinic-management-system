from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.modules.doctors.models import DoctorSpecialization


class DoctorSpecializationRepository:
    """Data access layer for the DoctorSpecialization join table."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def assign_specialization(
        self,
        doctor_specialization: DoctorSpecialization,
    ) -> DoctorSpecialization:
        self.db.add(doctor_specialization)
        self.db.flush()
        self.db.refresh(doctor_specialization)
        return doctor_specialization

    def get_primary_specialization(
        self,
        doctor_id: UUID,
    ) -> Optional[DoctorSpecialization]:
        stmt = (
            select(DoctorSpecialization)
            .options(selectinload(DoctorSpecialization.specialization))
            .where(
                DoctorSpecialization.doctor_id == doctor_id,
                DoctorSpecialization.is_primary.is_(True),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_all_specializations(
        self,
        doctor_id: UUID,
    ) -> list[DoctorSpecialization]:
        stmt = (
            select(DoctorSpecialization)
            .options(selectinload(DoctorSpecialization.specialization))
            .where(DoctorSpecialization.doctor_id == doctor_id)
            .order_by(
                DoctorSpecialization.is_primary.desc().nulls_last(),
                DoctorSpecialization.specialization_id,
            )
        )
        return list(self.db.execute(stmt).scalars().all())

    def set_primary_specialization(
        self,
        doctor_id: UUID,
        specialization_id: int,
    ) -> None:
        stmt_clear = (
            update(DoctorSpecialization)
            .where(
                DoctorSpecialization.doctor_id == doctor_id,
                DoctorSpecialization.is_primary.is_(True),
            )
            .values(is_primary=False)
        )
        self.db.execute(stmt_clear)

        stmt_set = (
            update(DoctorSpecialization)
            .where(
                DoctorSpecialization.doctor_id == doctor_id,
                DoctorSpecialization.specialization_id == specialization_id,
            )
            .values(is_primary=True)
        )
        self.db.execute(stmt_set)
        self.db.flush()

    def remove_specialization(
        self,
        doctor_id: UUID,
        specialization_id: int,
    ) -> None:
        stmt = select(DoctorSpecialization).where(
            DoctorSpecialization.doctor_id == doctor_id,
            DoctorSpecialization.specialization_id == specialization_id,
        )
        assignment = self.db.execute(stmt).scalar_one_or_none()
        if assignment is None:
            return

        was_primary = assignment.is_primary
        self.db.delete(assignment)
        self.db.flush()

        if was_primary:
            remaining = (
                select(DoctorSpecialization)
                .where(DoctorSpecialization.doctor_id == doctor_id)
                .limit(1)
            )
            next_assignment = self.db.execute(remaining).scalar_one_or_none()
            if next_assignment is not None:
                next_assignment.is_primary = True
                self.db.flush()

    def exists(self, doctor_id: UUID, specialization_id: int) -> bool:
        stmt = (
            select(DoctorSpecialization.doctor_id)
            .where(
                DoctorSpecialization.doctor_id == doctor_id,
                DoctorSpecialization.specialization_id == specialization_id,
            )
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    def has_any_specialization(self, doctor_id: UUID) -> bool:
        stmt = (
            select(DoctorSpecialization.doctor_id)
            .where(DoctorSpecialization.doctor_id == doctor_id)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    def is_specialization_assigned(self, specialization_id: int) -> bool:
        """Check whether any doctor has this specialization assigned.

        Args:
            specialization_id: ID of the specialization to check.

        Returns:
            True if at least one doctor has this specialization.
        """
        stmt = (
            select(DoctorSpecialization.doctor_id)
            .where(DoctorSpecialization.specialization_id == specialization_id)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None
