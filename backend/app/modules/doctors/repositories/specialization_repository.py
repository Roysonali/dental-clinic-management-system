from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.doctors.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.modules.doctors.models import Specialization


class SpecializationRepository:
    """Data access layer for Specialization entities.

    Encapsulates all SQLAlchemy query logic and exposes clean
    method signatures for the service layer to consume.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
        "name",
        "code",
        "description",
        "is_active",
    })

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

    def create(self, specialization: Specialization) -> Specialization:
        self.db.add(specialization)
        self.db.flush()
        self.db.refresh(specialization)
        return specialization

    def get_by_id(self, specialization_id: int) -> Optional[Specialization]:
        return self.db.get(Specialization, specialization_id)

    def get_by_id_for_update(self, specialization_id: int) -> Optional[Specialization]:
        stmt = (
            select(Specialization)
            .where(Specialization.id == specialization_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_name(self, name: str) -> Optional[Specialization]:
        stmt = (
            select(Specialization)
            .where(func.lower(Specialization.name) == func.lower(name))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, code: str) -> Optional[Specialization]:
        stmt = (
            select(Specialization)
            .where(func.lower(Specialization.code) == func.lower(code))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_ids(self, ids: list[int]) -> list[Specialization]:
        if not ids:
            return []
        stmt = select(Specialization).where(Specialization.id.in_(ids))
        return self.db.execute(stmt).scalars().all()

    def list(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        is_active: Optional[bool] = None,
    ) -> tuple[list[Specialization], int]:
        page, page_size = self._normalize_pagination(page, page_size)
        filters = []
        if is_active is not None:
            filters.append(Specialization.is_active == is_active)
        count_stmt = select(func.count()).select_from(Specialization)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0
        stmt = (
            select(Specialization)
            .order_by(Specialization.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if filters:
            stmt = stmt.where(*filters)
        items = self.db.execute(stmt).scalars().all()
        return items, total

    def list_active(self) -> list[Specialization]:
        stmt = (
            select(Specialization)
            .where(Specialization.is_active.is_(True))
            .order_by(Specialization.name.asc())
        )
        return self.db.execute(stmt).scalars().all()

    def update(self, specialization: Specialization, updates: dict) -> Specialization:
        for field, value in updates.items():
            if field not in self._ALLOWED_UPDATE_FIELDS:
                continue
            setattr(specialization, field, value)
        self.db.flush()
        self.db.refresh(specialization)
        return specialization

    def delete(self, specialization: Specialization) -> None:
        self.db.delete(specialization)
        self.db.flush()

    def exists(self, specialization_id: int) -> bool:
        stmt = select(Specialization.id).where(Specialization.id == specialization_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_name(self, name: str) -> bool:
        stmt = (
            select(Specialization.id)
            .where(func.lower(Specialization.name) == func.lower(name))
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    def exists_by_code(self, code: str) -> bool:
        stmt = (
            select(Specialization.id)
            .where(func.lower(Specialization.code) == func.lower(code))
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None