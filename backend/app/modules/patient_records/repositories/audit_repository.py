from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.patient_records.models import PatientRecordAuditLog


class AuditLogRepository:
    """Data-access layer for "PatientRecordAuditLog".

    **Append-only repository.**  Audit logs are immutable once written:

    * No update() - historical records must never be modified.
    * No soft_delete() - audit trails must be preserved for
      regulatory compliance (HIPAA, GDPR, clinic policy).
    * No is_deleted column on the model.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _normalize_pagination(page: int, page_size: int) -> tuple[int, int]:
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 20
        elif page_size > 100:
            page_size = 100
        return page, page_size

    def create(self, audit_log: PatientRecordAuditLog) -> PatientRecordAuditLog:
        self.db.add(audit_log)
        self.db.flush()
        self.db.refresh(audit_log)
        return audit_log

    def bulk_create(self, audit_logs: list[PatientRecordAuditLog]) -> list[PatientRecordAuditLog]:
        if not audit_logs:
            return []
        for log in audit_logs:
            self.db.add(log)
        self.db.flush()
        for log in audit_logs:
            self.db.refresh(log)
        return audit_logs

    def get_by_id(self, log_id: UUID) -> Optional[PatientRecordAuditLog]:
        stmt = select(PatientRecordAuditLog).where(PatientRecordAuditLog.id == log_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_record(self, patient_record_id: UUID, *, page: int = 1, page_size: int = 20) -> tuple[list[PatientRecordAuditLog], int]:
        page, page_size = self._normalize_pagination(page, page_size)
        base_where = PatientRecordAuditLog.patient_record_id == patient_record_id
        count_stmt = select(func.count()).select_from(PatientRecordAuditLog).where(base_where)
        total: int = self.db.execute(count_stmt).scalar() or 0
        stmt = (
            select(PatientRecordAuditLog)
            .where(base_where)
            .order_by(PatientRecordAuditLog.performed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def get_by_user(self, user_id: int, *, page: int = 1, page_size: int = 20) -> tuple[list[PatientRecordAuditLog], int]:
        page, page_size = self._normalize_pagination(page, page_size)
        base_where = PatientRecordAuditLog.performed_by == user_id
        count_stmt = select(func.count()).select_from(PatientRecordAuditLog).where(base_where)
        total: int = self.db.execute(count_stmt).scalar() or 0
        stmt = (
            select(PatientRecordAuditLog)
            .where(base_where)
            .order_by(PatientRecordAuditLog.performed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def list(self, *, page: int = 1, page_size: int = 20, patient_record_id: Optional[UUID] = None, user_id: Optional[int] = None, action: Optional[str] = None) -> tuple[list[PatientRecordAuditLog], int]:
        page, page_size = self._normalize_pagination(page, page_size)
        filters: list = []
        if patient_record_id is not None:
            filters.append(PatientRecordAuditLog.patient_record_id == patient_record_id)
        if user_id is not None:
            filters.append(PatientRecordAuditLog.performed_by == user_id)
        if action is not None:
            filters.append(PatientRecordAuditLog.action == action)
        count_stmt = select(func.count()).select_from(PatientRecordAuditLog)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0
        stmt = (
            select(PatientRecordAuditLog)
            .order_by(PatientRecordAuditLog.performed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if filters:
            stmt = stmt.where(*filters)
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def count(self, *, patient_record_id: Optional[UUID] = None, user_id: Optional[int] = None, action: Optional[str] = None) -> int:
        filters: list = []
        if patient_record_id is not None:
            filters.append(PatientRecordAuditLog.patient_record_id == patient_record_id)
        if user_id is not None:
            filters.append(PatientRecordAuditLog.performed_by == user_id)
        if action is not None:
            filters.append(PatientRecordAuditLog.action == action)
        stmt = select(func.count()).select_from(PatientRecordAuditLog)
        if filters:
            stmt = stmt.where(*filters)
        return self.db.execute(stmt).scalar() or 0
