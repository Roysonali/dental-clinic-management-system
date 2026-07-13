from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.patient_records.enums import AttachmentType
from app.modules.patient_records.exceptions import AttachmentNotFound
from app.modules.patient_records.models import PatientRecordAttachment

# ---------------------------------------------------------------------------
# Whitelist of fields callers may modify via update().
# ---------------------------------------------------------------------------
_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "attachment_type",
    "file_name",
    "mime_type",
    "file_size",
})


class AttachmentRepository:
    """Data-access layer for ``PatientRecordAttachment``.

    Manages file metadata for attachments linked to a patient record.
    The actual file storage (disk, S3, etc.) is handled by the service
    layer — this repository only persists metadata.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ==================================================================
    # Query helpers
    # ==================================================================

    @staticmethod
    def _apply_base_filter(stmt, *, include_deleted: bool = False):
        if not include_deleted:
            stmt = stmt.where(
                PatientRecordAttachment.is_deleted.is_(False)
            )
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
        attachment: PatientRecordAttachment,
    ) -> PatientRecordAttachment:
        """Persist a new attachment metadata record.

        Args:
            attachment: Unsaved ``PatientRecordAttachment`` ORM instance.

        Returns:
            The persisted attachment with an assigned ``id``.
        """
        self.db.add(attachment)
        self.db.flush()
        self.db.refresh(attachment)

        return attachment

    def bulk_create(
        self,
        attachments: list[PatientRecordAttachment],
    ) -> list[PatientRecordAttachment]:
        """Persist multiple attachment metadata records in a single flush.

        Args:
            attachments: List of unsaved ``PatientRecordAttachment`` instances.

        Returns:
            The persisted attachments with assigned IDs.
        """
        if not attachments:
            return []

        for attachment in attachments:
            self.db.add(attachment)

        self.db.flush()

        for attachment in attachments:
            self.db.refresh(attachment)

        return attachments

    # ==================================================================
    # Read — single record
    # ==================================================================

    def get_by_id(
        self,
        attachment_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordAttachment]:
        """Retrieve an attachment by UUID.

        Args:
            attachment_id: UUID of the target attachment.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching attachment, or ``None``.
        """
        stmt = self._apply_base_filter(
            select(PatientRecordAttachment).where(
                PatientRecordAttachment.id == attachment_id
            ),
            include_deleted=include_deleted,
        )

        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_or_raise(
        self,
        attachment_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> PatientRecordAttachment:
        """Like ``get_by_id`` but raises ``AttachmentNotFound`` on a miss."""
        attachment = self.get_by_id(
            attachment_id, include_deleted=include_deleted
        )

        if attachment is None:
            raise AttachmentNotFound(attachment_id=attachment_id)

        return attachment

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
    ) -> tuple[list[PatientRecordAttachment], int]:
        """Return a paginated list of attachments for a patient record.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(attachments, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        base_where = (
            PatientRecordAttachment.patient_record_id == patient_record_id
        )

        # --- Count ---
        count_stmt = (
            select(func.count())
            .select_from(PatientRecordAttachment)
            .where(base_where)
        )
        count_stmt = self._apply_base_filter(
            count_stmt, include_deleted=include_deleted
        )

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecordAttachment)
            .where(base_where)
            .order_by(PatientRecordAttachment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    def search(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_record_id: Optional[UUID] = None,
        attachment_type: Optional[AttachmentType] = None,
        file_name_query: Optional[str] = None,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecordAttachment], int]:
        """Search attachments with optional filters.

        Supports filtering by:
        * ``patient_record_id`` — parent record.
        * ``attachment_type`` — exact type match.
        * ``file_name_query`` — case-insensitive partial match on
          ``file_name`` (search-as-you-type).

        Args:
            page: 1-indexed page number.
            page_size: Max records per page.
            patient_record_id: Optional patient record filter.
            attachment_type: Optional type filter.
            file_name_query: Optional file name search string.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(attachments, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        filters: list = []

        if patient_record_id is not None:
            filters.append(
                PatientRecordAttachment.patient_record_id
                == patient_record_id
            )

        if attachment_type is not None:
            filters.append(
                PatientRecordAttachment.attachment_type == attachment_type
            )

        if file_name_query:
            filters.append(
                PatientRecordAttachment.file_name.ilike(
                    f"%{file_name_query}%"
                )
            )

        # --- Count ---
        count_stmt = (
            select(func.count())
            .select_from(PatientRecordAttachment)
        )

        if filters:
            count_stmt = count_stmt.where(*filters)

        count_stmt = self._apply_base_filter(
            count_stmt, include_deleted=include_deleted
        )

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecordAttachment)
            .order_by(PatientRecordAttachment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    # ==================================================================
    # Update
    # ==================================================================

    def update(
        self,
        attachment: PatientRecordAttachment,
        updates: dict,
    ) -> PatientRecordAttachment:
        """Apply field-level updates to an attachment.

        Only keys in ``_ALLOWED_UPDATE_FIELDS`` are applied.
        ``file_path`` is intentionally excluded from the whitelist
        because it is set once at creation and should not change.

        Args:
            attachment: The ``PatientRecordAttachment`` ORM instance.
            updates: Dictionary of field names to new values.

        Returns:
            The refreshed attachment.
        """
        for field, value in updates.items():
            if field not in _ALLOWED_UPDATE_FIELDS:
                continue
            setattr(attachment, field, value)

        self.db.flush()
        self.db.refresh(attachment)

        return attachment

    # ==================================================================
    # Soft delete
    # ==================================================================

    def soft_delete(
        self,
        attachment: PatientRecordAttachment,
    ) -> None:
        """Idempotent soft-delete for an attachment."""
        if attachment.is_deleted:
            return

        attachment.is_deleted = True
        self.db.flush()

    # ==================================================================
    # Existence & counting
    # ==================================================================

    def exists(
        self,
        attachment_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> bool:
        """Check whether an attachment with the given ID exists."""
        stmt = (
            select(PatientRecordAttachment.id)
            .where(PatientRecordAttachment.id == attachment_id)
            .limit(1)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).first() is not None

    def count(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        attachment_type: Optional[AttachmentType] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count attachments matching the given filters.

        Args:
            patient_record_id: Optional patient record UUID filter.
            attachment_type: Optional ``AttachmentType`` filter.
            include_deleted: If ``True``, includes soft-deleted records.

        Returns:
            The total number of matching attachments.
        """
        filters: list = []

        if patient_record_id is not None:
            filters.append(
                PatientRecordAttachment.patient_record_id
                == patient_record_id
            )

        if attachment_type is not None:
            filters.append(
                PatientRecordAttachment.attachment_type == attachment_type
            )

        stmt = (
            select(func.count())
            .select_from(PatientRecordAttachment)
        )

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).scalar() or 0
