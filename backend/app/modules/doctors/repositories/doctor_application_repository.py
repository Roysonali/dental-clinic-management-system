"""Doctor Application Repository — Data access layer for the DoctorApplication entity."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.doctors.models import DoctorApplication


class DoctorApplicationRepository:
    """Data access layer for DoctorApplication entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, application: DoctorApplication) -> None:
        """Add a new application to the session without committing."""
        self.db.add(application)

    def get_by_id(self, application_id: int) -> Optional[DoctorApplication]:
        """Look up an application by primary key."""
        stmt = select(DoctorApplication).where(
            DoctorApplication.id == application_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_user_id(self, user_id: int) -> Optional[DoctorApplication]:
        """Look up an application by user_id."""
        stmt = select(DoctorApplication).where(
            DoctorApplication.user_id == user_id
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_pending_by_user_id(self, user_id: int) -> Optional[DoctorApplication]:
        """Look up a pending application for a specific user."""
        stmt = select(DoctorApplication).where(
            DoctorApplication.user_id == user_id,
            DoctorApplication.status == DoctorApplication.STATUS_PENDING,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_pending(self) -> list[DoctorApplication]:
        """Return all pending doctor applications, newest first."""
        stmt = (
            select(DoctorApplication)
            .where(DoctorApplication.status == DoctorApplication.STATUS_PENDING)
            .order_by(DoctorApplication.submitted_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_all(self) -> list[DoctorApplication]:
        """Return all doctor applications, newest first."""
        stmt = (
            select(DoctorApplication)
            .order_by(DoctorApplication.submitted_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def count_pending(self) -> int:
        """Count pending applications."""
        stmt = select(func.count()).select_from(DoctorApplication).where(
            DoctorApplication.status == DoctorApplication.STATUS_PENDING
        )
        return self.db.execute(stmt).scalar() or 0

    def registration_number_exists(
        self,
        registration_number: str,
        exclude_application_id: Optional[int] = None,
    ) -> bool:
        """Check if a registration number is already used in any application."""
        stmt = select(DoctorApplication.id).where(
            DoctorApplication.registration_number == registration_number,
        )
        if exclude_application_id is not None:
            stmt = stmt.where(DoctorApplication.id != exclude_application_id)
        return self.db.execute(stmt.limit(1)).first() is not None

    def exists_pending_by_user_id(self, user_id: int) -> bool:
        """Check if a user already has a pending doctor application."""
        stmt = select(DoctorApplication.id).where(
            DoctorApplication.user_id == user_id,
            DoctorApplication.status == DoctorApplication.STATUS_PENDING,
        )
        return self.db.execute(stmt.limit(1)).first() is not None
