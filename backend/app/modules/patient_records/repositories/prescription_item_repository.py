from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.patient_records.exceptions import PrescriptionItemNotFound
from app.modules.patient_records.models import PatientRecordPrescriptionItem


_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "medicine_name",
    "dosage",
    "frequency",
    "duration",
    "instructions",
})


class PrescriptionItemRepository:
    """Data-access layer for "PatientRecordPrescriptionItem"."""

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _apply_base_filter(stmt, *, include_deleted: bool = False):
        if not include_deleted:
            stmt = stmt.where(PatientRecordPrescriptionItem.is_deleted.is_(False))
        return stmt

    @staticmethod
    def _normalize_pagination(page: int, page_size: int) -> tuple[int, int]:
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 20
        elif page_size > 100:
            page_size = 100
        return page, page_size

    def create(self, item: PatientRecordPrescriptionItem) -> PatientRecordPrescriptionItem:
        self.db.add(item)
        self.db.flush()
        self.db.refresh(item)
        return item

    def bulk_create(self, items: list[PatientRecordPrescriptionItem]) -> list[PatientRecordPrescriptionItem]:
        if not items:
            return []
        for item in items:
            self.db.add(item)
        self.db.flush()
        for item in items:
            self.db.refresh(item)
        return items

    def get_by_id(self, item_id: UUID, *, include_deleted: bool = False) -> Optional[PatientRecordPrescriptionItem]:
        stmt = self._apply_base_filter(
            select(PatientRecordPrescriptionItem).where(PatientRecordPrescriptionItem.id == item_id),
            include_deleted=include_deleted,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_prescription(self, prescription_id: UUID, *, page: int = 1, page_size: int = 20, include_deleted: bool = False) -> tuple[list[PatientRecordPrescriptionItem], int]:
        page, page_size = self._normalize_pagination(page, page_size)
        base_where = PatientRecordPrescriptionItem.prescription_id == prescription_id
        count_stmt = select(func.count()).select_from(PatientRecordPrescriptionItem).where(base_where)
        count_stmt = self._apply_base_filter(count_stmt, include_deleted=include_deleted)
        total: int = self.db.execute(count_stmt).scalar() or 0
        stmt = (
            select(PatientRecordPrescriptionItem)
            .where(base_where)
            .order_by(PatientRecordPrescriptionItem.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def update(self, item: PatientRecordPrescriptionItem, updates: dict) -> PatientRecordPrescriptionItem:
        for field, value in updates.items():
            if field not in _ALLOWED_UPDATE_FIELDS:
                continue
            setattr(item, field, value)
        self.db.flush()
        self.db.refresh(item)
        return item

    def soft_delete(self, item: PatientRecordPrescriptionItem) -> None:
        if item.is_deleted:
            return
        item.is_deleted = True
        self.db.flush()

    def exists(self, item_id: UUID, *, include_deleted: bool = False) -> bool:
        stmt = select(PatientRecordPrescriptionItem.id).where(PatientRecordPrescriptionItem.id == item_id).limit(1)
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        return self.db.execute(stmt).first() is not None

    def count(self, *, prescription_id: Optional[UUID] = None, include_deleted: bool = False) -> int:
        filters: list = []
        if prescription_id is not None:
            filters.append(PatientRecordPrescriptionItem.prescription_id == prescription_id)
        stmt = select(func.count()).select_from(PatientRecordPrescriptionItem)
        if filters:
            stmt = stmt.where(*filters)
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        return self.db.execute(stmt).scalar() or 0
