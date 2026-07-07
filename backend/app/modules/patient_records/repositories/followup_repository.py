from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.patient_records.exceptions import FollowupNotFound
from app.modules.patient_records.models import PatientRecordFollowup

# ---------------------------------------------------------------------------
# Whitelist of fields callers may modify via update().
# ---------------------------------------------------------------------------
_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "followup_date",
    "notes",
})


class FollowupRepository:
    """Data-access layer for ``PatientRecordFollowup``.

    Follow-ups represent scheduled future visits or check-ins after a
    clinical procedure.  They carry a date and optional clinical notes.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ==================================================================
    # Query helpers
    # ==================================================================

    @staticmethod
    def _apply_base_filter(stmt, *, include_deleted: bool = False):
        if not include_deleted:
            stmt = stmt.where(PatientRecordFollowup.is_deleted.is_(False))
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

    # ==================================================================
    # Create
    # ==================================================================

    def create(
        self,
        followup: PatientRecordFollowup,
    ) -> PatientRecordFollowup:
        """Persist a new follow-up and return the refreshed instance.

        Args:
            followup: Unsaved ``PatientRecordFollowup`` ORM instance.

        Returns:
            The persisted follow-up with an assigned ``id``.
        """
        self.db.add(followup)
        self.db.flush()
        self.db.refresh(followup)

        return followup

    # ==================================================================
    # Read — single record
    # ==================================================================

    def get_by_id(
        self,
        followup_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordFollowup]:
        """Retrieve a follow-up by UUID.

        Args:
            followup_id: UUID of the target follow-up.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching follow-up, or ``None``.
        """
        stmt = self._apply_base_filter(
            select(PatientRecordFollowup).where(
                PatientRecordFollowup.id == followup_id
            ),
            include_deleted=include_deleted,
        )

        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_or_raise(
        self,
        followup_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> PatientRecordFollowup:
        """Like ``get_by_id`` but raises ``FollowupNotFound`` on a miss."""
        followup = self.get_by_id(followup_id, include_deleted=include_deleted)

        if followup is None:
            raise FollowupNotFound(followup_id=followup_id)

        return followup

    # ==================================================================
    # Read — collections
    # ==================================================================

    def get_by_record(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecordFollowup], int]:
        """Return a paginated list of follow-ups for a patient record.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(followups, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        base_where = (
            PatientRecordFollowup.patient_record_id == patient_record_id
        )

        # --- Count ---
        count_stmt = (
            select(func.count())
            .select_from(PatientRecordFollowup)
            .where(base_where)
        )
        count_stmt = self._apply_base_filter(
            count_stmt, include_deleted=include_deleted
        )

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecordFollowup)
            .where(base_where)
            .order_by(PatientRecordFollowup.followup_date.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    def get_upcoming(
        self,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        patient_record_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecordFollowup], int]:
        """Return a paginated list of follow-ups within a date range.

        This is useful for:
        * Daily follow-up reminders (``from_date=today, to_date=today``).
        * Weekly/Monthly follow-up planning.

        Args:
            from_date: Start of the date range (inclusive).  Defaults to
                today if not provided.
            to_date: End of the date range (inclusive).  Defaults to
                ``from_date`` if not provided.
            patient_record_id: Optional patient record UUID filter.
            page: 1-indexed page number.
            page_size: Max records per page.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(followups, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        # Default date range: today → today
        today = date.today()

        if from_date is None:
            from_date = today

        if to_date is None:
            to_date = from_date

        filters: list = [
            PatientRecordFollowup.followup_date >= from_date,
            PatientRecordFollowup.followup_date <= to_date,
        ]

        if patient_record_id is not None:
            filters.append(
                PatientRecordFollowup.patient_record_id
                == patient_record_id
            )

        # --- Count ---
        count_stmt = (
            select(func.count())
            .select_from(PatientRecordFollowup)
            .where(*filters)
        )
        count_stmt = self._apply_base_filter(
            count_stmt, include_deleted=include_deleted
        )

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecordFollowup)
            .where(*filters)
            .order_by(PatientRecordFollowup.followup_date.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    # ==================================================================
    # Update
    # ==================================================================

    def update(
        self,
        followup: PatientRecordFollowup,
        updates: dict,
    ) -> PatientRecordFollowup:
        """Apply field-level updates to a follow-up.

        Only keys in ``_ALLOWED_UPDATE_FIELDS`` are applied.

        Args:
            followup: The ``PatientRecordFollowup`` ORM instance.
            updates: Dictionary of field names to new values.

        Returns:
            The refreshed follow-up.
        """
        for field, value in updates.items():
            if field not in _ALLOWED_UPDATE_FIELDS:
                continue
            setattr(followup, field, value)

        self.db.flush()
        self.db.refresh(followup)

        return followup

    # ==================================================================
    # Soft delete
    # ==================================================================

    def soft_delete(
        self,
        followup: PatientRecordFollowup,
    ) -> None:
        """Idempotent soft-delete for a follow-up."""
        if followup.is_deleted:
            return

        followup.is_deleted = True
        self.db.flush()

    # ==================================================================
    # Existence & counting
    # ==================================================================

    def exists(
        self,
        followup_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> bool:
        """Check whether a follow-up with the given ID exists."""
        stmt = (
            select(PatientRecordFollowup.id)
            .where(PatientRecordFollowup.id == followup_id)
            .limit(1)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).first() is not None

    def count(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count follow-ups matching the given filters.

        Args:
            patient_record_id: Optional patient record UUID filter.
            include_deleted: If ``True``, includes soft-deleted records.

        Returns:
            The total number of matching follow-ups.
        """
        filters: list = []

        if patient_record_id is not None:
            filters.append(
                PatientRecordFollowup.patient_record_id
                == patient_record_id
            )

        stmt = select(func.count()).select_from(PatientRecordFollowup)

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).scalar() or 0
