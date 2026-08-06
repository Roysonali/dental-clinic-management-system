from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.modules.auth.models import User
from app.modules.doctors.constants import (
    ALLOWED_SORT_FIELDS,
    DEFAULT_PAGE_SIZE,
    DEFAULT_SORT_FIELD,
    DOCTOR_CODE_PREFIX,
    MAX_PAGE_SIZE,
)
from app.modules.doctors.models import Doctor


class DoctorRepository:
    """Data access layer for Doctor entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _normalize_pagination(page: int, page_size: int) -> tuple[int, int]:
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = DEFAULT_PAGE_SIZE
        elif page_size > MAX_PAGE_SIZE:
            page_size = MAX_PAGE_SIZE
        return page, page_size

    @staticmethod
    def _resolve_sort_field(sort_by: Optional[str]) -> str:
        if sort_by in ALLOWED_SORT_FIELDS:
            return sort_by
        return DEFAULT_SORT_FIELD

    @staticmethod
    def _build_search_filter(search: str) -> or_:
        """Build the search predicate for the documented search contract.

        Contract (UI placeholder / architecture blueprint / frontend):
        search matches **doctor code** or **doctor full name** only.

        NOTE: registration_number was previously searched here, which
        violated the documented contract — searching by registration
        number is intentionally NOT supported. The User table must be
        joined by callers when this filter is applied.
        """
        pattern = f"%{search}%"
        return or_(
            Doctor.doctor_code.ilike(pattern),
            User.full_name.ilike(pattern),
        )

    def add(self, doctor: Doctor) -> None:
        """Add a new doctor to the session without committing.

        Used by the service layer which manages its own transaction
        boundary and calls ``flush()`` / ``refresh()`` separately.
        """
        self.db.add(doctor)

    def create(self, doctor: Doctor) -> Doctor:
        self.db.add(doctor)
        self.db.flush()
        self.db.refresh(doctor)
        return doctor

    def get_by_id(self, doctor_id: UUID) -> Optional[Doctor]:
        stmt = (
            select(Doctor)
            .options(
                selectinload(Doctor.user),
                selectinload(Doctor.specializations),
                selectinload(Doctor.schedules),
            )
            .where(Doctor.id == doctor_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_user_id(self, user_id: int) -> Optional[Doctor]:
        stmt = (
            select(Doctor)
            .options(
                selectinload(Doctor.user),
                selectinload(Doctor.specializations),
                selectinload(Doctor.schedules),
            )
            .where(Doctor.user_id == user_id)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_doctor_code(self, doctor_code: str) -> Optional[Doctor]:
        stmt = (
            select(Doctor)
            .options(
                selectinload(Doctor.user),
                selectinload(Doctor.specializations),
            )
            .where(Doctor.doctor_code == doctor_code)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_registration_number(self, registration_number: str) -> Optional[Doctor]:
        stmt = (
            select(Doctor)
            .options(selectinload(Doctor.user))
            .where(Doctor.registration_number == registration_number)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        search: Optional[str] = None,
        specialization_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        is_available: Optional[bool] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "desc",
    ) -> tuple[list[Doctor], int]:
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)

        sort_column = (
            Doctor.user.property.mapper.class_.full_name
            if sort_field == "full_name"
            else Doctor.years_of_experience
        )
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if search:
            filters.append(self._build_search_filter(search))
        if specialization_id is not None:
            filters.append(
                Doctor.specializations.any(
                    Doctor.specializations.property.mapper.class_.specialization_id
                    == specialization_id
                )
            )
        if is_active is not None:
            filters.append(Doctor.is_active == is_active)
        if is_available is True:
            filters.extend([
                Doctor.is_active.is_(True),
                Doctor.available_for_appointment.is_(True),
                Doctor.on_leave.is_(False),
            ])
        elif is_available is False:
            filters.append(
                or_(
                    Doctor.is_active.is_(False),
                    Doctor.available_for_appointment.is_(False),
                    Doctor.on_leave.is_(True),
                )
            )

        # The User join is required when searching by full name OR sorting by
        # full name. Apply it to both the count and the select statements so
        # the total reflects the same filtered population (no N+1 queries —
        # a single LEFT JOIN against the users table). The count only needs
        # the join when the search filter actually references User.full_name.
        needs_user_join = bool(search) or sort_field == "full_name"

        count_stmt = select(func.count()).select_from(Doctor)
        if search:
            count_stmt = count_stmt.join(Doctor.user, isouter=True)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = (
            select(Doctor)
            .options(
                selectinload(Doctor.user),
                selectinload(Doctor.specializations),
            )
            .order_by(order_expr)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if needs_user_join:
            stmt = stmt.join(Doctor.user, isouter=True)
        if filters:
            stmt = stmt.where(*filters)
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def search(self, search_term: str, limit: int = 20) -> list[Doctor]:
        pattern = f"%{search_term}%"
        stmt = (
            select(Doctor)
            .options(selectinload(Doctor.user))
            .where(
                Doctor.doctor_code.ilike(pattern)
            )
            .order_by(Doctor.doctor_code)
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    def count(self, *, is_active: Optional[bool] = None) -> int:
        stmt = select(func.count()).select_from(Doctor)
        if is_active is not None:
            stmt = stmt.where(Doctor.is_active == is_active)
        return self.db.execute(stmt).scalar() or 0

    def update(self, doctor: Doctor, updates: dict) -> Doctor:
        for field, value in updates.items():
            if hasattr(doctor, field):
                setattr(doctor, field, value)
        self.db.flush()
        self.db.refresh(doctor)
        return doctor

    def update_availability(self, doctor: Doctor, available: bool) -> Doctor:
        doctor.available_for_appointment = available
        self.db.flush()
        self.db.refresh(doctor)
        return doctor

    def update_leave_status(self, doctor: Doctor, on_leave: bool) -> Doctor:
        doctor.on_leave = on_leave
        self.db.flush()
        self.db.refresh(doctor)
        return doctor

    def delete(self, doctor: Doctor) -> None:
        self.db.delete(doctor)
        self.db.flush()

    def exists(self, doctor_id: UUID) -> bool:
        stmt = select(Doctor.id).where(Doctor.id == doctor_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_user_id(self, user_id: int) -> bool:
        stmt = select(Doctor.id).where(Doctor.user_id == user_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_doctor_code(self, doctor_code: str) -> bool:
        stmt = select(Doctor.id).where(Doctor.doctor_code == doctor_code).limit(1)
        return self.db.execute(stmt).first() is not None

    def registration_number_exists(
        self,
        registration_number: str,
        exclude_doctor_id: UUID | None = None,
    ) -> bool:
        """Return True if a *different* doctor already owns the registration number.

        The doctor identified by ``exclude_doctor_id`` is excluded so the
        same doctor can retain (or re-submit) its own number during an
        update without triggering a false duplicate. Used by both doctor
        creation (``exclude_doctor_id=None``) and updates.

        Args:
            registration_number: The (normalized, uppercase) number to check.
            exclude_doctor_id: Optional doctor UUID to ignore in the check.

        Returns:
            True if another doctor owns the number, else False.
        """
        stmt = select(Doctor.id).where(
            Doctor.registration_number == registration_number
        )
        if exclude_doctor_id is not None:
            stmt = stmt.where(Doctor.id != exclude_doctor_id)
        return self.db.execute(stmt.limit(1)).first() is not None

    def exists_by_registration_number(self, registration_number: str) -> bool:
        """Backward-compatible alias for :meth:`registration_number_exists`."""
        return self.registration_number_exists(registration_number)

    def get_latest_doctor_code(self) -> Optional[str]:
        stmt = (
            select(Doctor.doctor_code)
            .where(Doctor.doctor_code.like(f"{DOCTOR_CODE_PREFIX}%"))
            .order_by(Doctor.doctor_code.desc())
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_active_doctors(self) -> list[Doctor]:
        stmt = (
            select(Doctor)
            .options(selectinload(Doctor.user))
            .where(
                Doctor.is_active.is_(True),
                Doctor.available_for_appointment.is_(True),
                Doctor.on_leave.is_(False),
            )
            .order_by(Doctor.doctor_code)
        )
        return list(self.db.execute(stmt).scalars().all())
