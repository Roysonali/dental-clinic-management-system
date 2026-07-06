from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.models import PatientRecordAuditLog
from app.modules.patient_records.repositories import AuditLogRepository

logger = logging.getLogger(__name__)


class AuditLogService:
    """Service-layer orchestrator for ``PatientRecordAuditLog`` operations.

    **Append-only service.**  Once an audit log entry is written it must
    never be updated or deleted — the history is immutable.  This service
    provides:

    * Write operations for recording business events.
    * Read operations for querying the audit trail.

    Read operations are free (no audit log is generated for querying the
    audit log) and require no transaction management.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def create_audit(
        self,
        *,
        patient_record_id: UUID,
        action: str,
        performed_by: int,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
    ) -> PatientRecordAuditLog:
        """Append a single audit log entry.

        Args:
            patient_record_id: UUID of the associated patient record.
            action: Machine-readable action name (e.g. ``DIAGNOSIS_CREATED``).
            performed_by: ID of the user who performed the action.
            old_value: Optional serialised previous state.
            new_value: Optional serialised new state.

        Returns:
            The newly created ``PatientRecordAuditLog``.
        """
        try:
            audit_log = PatientRecordAuditLog(
                patient_record_id=patient_record_id,
                action=action,
                old_value=old_value,
                new_value=new_value,
                performed_by=performed_by,
            )

            audit_log = self.audit_repo.create(audit_log)
            self.db.commit()

            logger.info(
                "Audit log created: id=%s, record=%s, action=%s",
                audit_log.id,
                patient_record_id,
                action,
            )

            return audit_log

        except Exception:
            self.db.rollback()
            logger.exception("Failed to create audit log: record=%s", patient_record_id)
            raise

    def bulk_create(
        self,
        entries: list[PatientRecordAuditLog],
    ) -> list[PatientRecordAuditLog]:
        """Append multiple audit log entries in a single transaction.

        All entries are flushed together for performance.  If any entry
        fails, the entire batch is rolled back.

        Args:
            entries: List of unsaved ``PatientRecordAuditLog`` instances.

        Returns:
            The persisted audit logs with assigned IDs.
        """
        if not entries:
            return []

        try:
            entries = self.audit_repo.bulk_create(entries)
            self.db.commit()

            logger.info("Bulk created %d audit log entries", len(entries))

            return entries

        except Exception:
            self.db.rollback()
            logger.exception("Failed to bulk create audit log entries")
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_audit(
        self,
        audit_id: UUID,
    ) -> Optional[PatientRecordAuditLog]:
        """Retrieve a single audit log entry by ID.

        Args:
            audit_id: UUID of the target audit log entry.

        Returns:
            The matching ``PatientRecordAuditLog``, or ``None``.
        """
        return self.audit_repo.get_by_id(audit_id)

    def list_audits(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_record_id: Optional[UUID] = None,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
    ) -> tuple[list[PatientRecordAuditLog], int]:
        """Return a paginated list of audit log entries with optional filters.

        Read-only — no audit log or transaction needed.

        Args:
            page: 1-indexed page number.
            page_size: Max records per page.
            patient_record_id: Optional patient record UUID filter.
            user_id: Optional user ID filter.
            action: Optional action name filter.

        Returns:
            A tuple of ``(audit_logs, total_count)``.
        """
        return self.audit_repo.list(
            page=page,
            page_size=page_size,
            patient_record_id=patient_record_id,
            user_id=user_id,
            action=action,
        )

    def get_audits_by_record(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordAuditLog], int]:
        """Return a paginated list of audit entries for a patient record.

        Read-only — no audit log or transaction needed.

        Args:
            patient_record_id: UUID of the patient record.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(audit_logs, total_count)``.
        """
        return self.audit_repo.get_by_record(
            patient_record_id,
            page=page,
            page_size=page_size,
        )

    def get_audits_by_user(
        self,
        user_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordAuditLog], int]:
        """Return a paginated list of audit entries performed by a user.

        Read-only — no audit log or transaction needed.

        Args:
            user_id: ID of the user.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(audit_logs, total_count)``.
        """
        return self.audit_repo.get_by_user(
            user_id,
            page=page,
            page_size=page_size,
        )

    # ==================================================================
    # Count
    # ==================================================================

    def count_audits(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        user_id: Optional[int] = None,
        action: Optional[str] = None,
    ) -> int:
        """Count audit log entries matching the given filters.

        Read-only — no audit log or transaction needed.

        Args:
            patient_record_id: Optional patient record UUID filter.
            user_id: Optional user ID filter.
            action: Optional action name filter.

        Returns:
            The total number of matching audit log entries.
        """
        return self.audit_repo.count(
            patient_record_id=patient_record_id,
            user_id=user_id,
            action=action,
        )
