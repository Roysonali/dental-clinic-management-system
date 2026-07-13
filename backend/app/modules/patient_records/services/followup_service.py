from __future__ import annotations

import logging
from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.exceptions import (
    FollowupNotFound,
    PatientRecordBusinessRule,
    PatientRecordNotFound,
)
from app.modules.patient_records.models import (
    PatientRecordAuditLog,
    PatientRecordFollowup,
)
from app.modules.patient_records.repositories import (
    AuditLogRepository,
    FollowupRepository,
    PatientRecordRepository,
)
from app.modules.patient_records.schemas.followup_schema import (
    FollowupCreate,
    FollowupUpdate,
)

from app.modules.patient_records.constants import (
    FOLLOWUP_CREATED,
    FOLLOWUP_UPDATED,
    FOLLOWUP_DELETED,
)
from app.modules.patient_records.validators import (
    FollowupValidator,
    PatientRecordValidator,
)

logger = logging.getLogger(__name__)


class FollowupService:
    """Service-layer orchestrator for ``PatientRecordFollowup`` workflows.

    Follow-ups represent scheduled future visits or check-ins after a
    clinical procedure.  Mutations are gated on the parent patient record —
    if the record is finalised or soft-deleted, follow-ups cannot be
    created, updated, or deleted.  Read operations are unrestricted.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.followup_repo = FollowupRepository(db)
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def create_followup(
        self,
        patient_record_id: UUID,
        payload: FollowupCreate,
        actor_id: int,
    ) -> PatientRecordFollowup:
        """Schedule a follow-up under a patient record.

        Business rules:
        1. The patient record must exist.
        2. The patient record must not be finalised or soft-deleted.

        Args:
            patient_record_id: UUID of the parent patient record.
            payload: Validated ``FollowupCreate`` schema.
            actor_id: ID of the authenticated user (for audit log).

        Returns:
            The newly created ``PatientRecordFollowup``.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is immutable.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            FollowupValidator.validate_followup_date(payload.followup_date)

            followup = PatientRecordFollowup(
                patient_record_id=patient_record_id,
                followup_date=payload.followup_date,
                notes=payload.notes,
            )

            followup = self.followup_repo.create(followup)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=FOLLOWUP_CREATED,
                new_value=(
                    f"followup_date={followup.followup_date}"
                ),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Followup created: id=%s, record=%s, date=%s",
                followup.id,
                patient_record_id,
                followup.followup_date,
            )

            return followup

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to create followup: record=%s",
                patient_record_id,
            )
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_followup(
        self,
        followup_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordFollowup]:
        """Retrieve a single follow-up by ID.

        Read-only — no audit log or transaction needed.

        Args:
            followup_id: UUID of the target follow-up.
            include_deleted: If ``True``, soft-deleted follow-ups are
                included.

        Returns:
            The matching follow-up, or ``None``.
        """
        return self.followup_repo.get_by_id(
            followup_id,
            include_deleted=include_deleted,
        )

    def list_followups(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordFollowup], int]:
        """Return a paginated list of follow-ups for a patient record.

        Read-only — no audit log or transaction needed.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(followups, total_count)``.
        """
        return self.followup_repo.get_by_record(
            patient_record_id,
            page=page,
            page_size=page_size,
        )

    def get_upcoming(
        self,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        patient_record_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordFollowup], int]:
        """Retrieve follow-ups scheduled within a date range.

        Read-only — no audit log or transaction needed.

        Useful for:
        * Daily follow-up reminders (default: today → today).
        * Weekly/Monthly follow-up planning.

        Args:
            from_date: Start of the date range (inclusive).  Defaults to
                today if not provided.
            to_date: End of the date range (inclusive).  Defaults to
                ``from_date`` if not provided.
            patient_record_id: Optional patient record UUID filter.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(followups, total_count)``.
        """
        return self.followup_repo.get_upcoming(
            from_date=from_date,
            to_date=to_date,
            patient_record_id=patient_record_id,
            page=page,
            page_size=page_size,
        )

    # ==================================================================
    # Update
    # ==================================================================

    def update_followup(
        self,
        followup_id: UUID,
        payload: FollowupUpdate,
        actor_id: int,
    ) -> PatientRecordFollowup:
        """Update a follow-up's date or clinical notes.

        Business rules:
        1. The follow-up must exist.
        2. The parent patient record must not be finalised or deleted.

        Only fields explicitly provided in ``payload`` are applied
        (``exclude_unset=True``).  The repository's field whitelist
        further restricts updates to ``followup_date`` and ``notes``.

        Args:
            followup_id: UUID of the follow-up to update.
            payload: Validated ``FollowupUpdate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecordFollowup``.

        Raises:
            FollowupNotFound: If the follow-up does not exist.
            PatientRecordBusinessRule: If the parent record is immutable.
        """
        try:
            followup = self.followup_repo.get_by_id_or_raise(followup_id)
            record = self.record_repo.get_by_id_or_raise(
                followup.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            updates = payload.model_dump(exclude_unset=True)

            if not updates:
                return followup

            # Validate date if it's being changed.
            if "followup_date" in updates:
                FollowupValidator.validate_followup_date(updates["followup_date"])

            followup = self.followup_repo.update(followup, updates)

            self._create_audit_log(
                patient_record_id=record.id,
                action=FOLLOWUP_UPDATED,
                new_value=str(updates),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Followup updated: id=%s, fields=%s",
                followup.id,
                list(updates.keys()),
            )

            return followup

        except (
            FollowupNotFound,
            PatientRecordNotFound,
            PatientRecordBusinessRule,
        ):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update followup: id=%s",
                followup_id,
            )
            raise

    # ==================================================================
    # Soft delete
    # ==================================================================

    def delete_followup(
        self,
        followup_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete a follow-up.

        Business rules:
        1. The follow-up must exist.
        2. The parent patient record must not be finalised or deleted.

        Args:
            followup_id: UUID of the follow-up to soft-delete.
            actor_id: ID of the authenticated user.
        """
        try:
            followup = self.followup_repo.get_by_id_or_raise(followup_id)
            record = self.record_repo.get_by_id_or_raise(
                followup.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            if followup.is_deleted:
                logger.info(
                    "Followup already deleted (idempotent): id=%s",
                    followup_id,
                )
                return

            self.followup_repo.soft_delete(followup)

            self._create_audit_log(
                patient_record_id=record.id,
                action=FOLLOWUP_DELETED,
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Followup soft-deleted: id=%s, record=%s",
                followup_id,
                record.id,
            )

        except (
            FollowupNotFound,
            PatientRecordNotFound,
            PatientRecordBusinessRule,
        ):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to soft-delete followup: id=%s",
                followup_id,
            )
            raise

    # ==================================================================
    # Count
    # ==================================================================

    def count_followups(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
    ) -> int:
        """Count follow-ups matching the given filters.

        Read-only — no audit log or transaction needed.
        """
        return self.followup_repo.count(
            patient_record_id=patient_record_id,
        )

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _create_audit_log(
        self,
        *,
        patient_record_id: UUID,
        action: str,
        performed_by: int,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
    ) -> PatientRecordAuditLog:
        """Create an audit log entry for a business action."""
        audit_log = PatientRecordAuditLog(
            patient_record_id=patient_record_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            performed_by=performed_by,
        )
        return self.audit_repo.create(audit_log)
