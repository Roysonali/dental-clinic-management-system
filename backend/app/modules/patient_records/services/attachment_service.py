from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.enums import AttachmentType
from app.modules.patient_records.exceptions import (
    AttachmentNotFound,
    PatientRecordBusinessRule,
    PatientRecordNotFound,
)
from app.modules.patient_records.models import (
    PatientRecordAttachment,
    PatientRecordAuditLog,
)
from app.modules.patient_records.repositories import (
    AttachmentRepository,
    AuditLogRepository,
    PatientRecordRepository,
)
from app.modules.patient_records.schemas.attachment_schema import (
    AttachmentCreate,
    AttachmentUpdate,
)

from app.modules.patient_records.constants import (
    ATTACHMENT_UPLOADED,
    ATTACHMENT_BULK_UPLOADED,
    ATTACHMENT_UPDATED,
    ATTACHMENT_DELETED,
)
from app.modules.patient_records.validators import PatientRecordValidator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowed MIME types per attachment type.
# ---------------------------------------------------------------------------
_ALLOWED_IMAGE_TYPES: frozenset[str] = frozenset({
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff",
    "image/bmp",
})

_ALLOWED_DOCUMENT_TYPES: frozenset[str] = frozenset({
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
})

_ALLOWED_VIDEO_TYPES: frozenset[str] = frozenset({
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
})

# ---------------------------------------------------------------------------
# File size limits (in bytes).
# ---------------------------------------------------------------------------
_MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB


class AttachmentService:
    """Service-layer orchestrator for ``PatientRecordAttachment`` workflows.

    Attachment operations focus on file metadata management.  The service
    enforces file metadata validation rules (MIME type, file size) before
    persisting attachment records.  The actual file storage (disk, S3,
    etc.) is managed by an external infrastructure layer.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.attachment_repo = AttachmentRepository(db)
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def upload_attachment(
        self,
        patient_record_id: UUID,
        payload: AttachmentCreate,
        actor_id: int,
    ) -> PatientRecordAttachment:
        """Upload (register) a single file attachment under a patient record.

        Business rules:
        1. The patient record must exist.
        2. The patient record must not be finalised or soft-deleted.
        3. The file metadata (MIME type, size) must pass validation.

        Args:
            patient_record_id: UUID of the parent patient record.
            payload: Validated ``AttachmentCreate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The newly created ``PatientRecordAttachment``.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is immutable or file
                metadata is invalid.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)
            self._validate_file_metadata(
                file_name=payload.file_name,
                mime_type=payload.mime_type,
                file_size=payload.file_size,
                attachment_type=payload.attachment_type,
            )

            attachment = PatientRecordAttachment(
                patient_record_id=patient_record_id,
                attachment_type=payload.attachment_type,
                file_name=payload.file_name,
                file_path=payload.file_path,
                mime_type=payload.mime_type,
                file_size=payload.file_size,
            )

            attachment = self.attachment_repo.create(attachment)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=ATTACHMENT_UPLOADED,
                new_value=(
                    f"file={attachment.file_name}, "
                    f"type={attachment.attachment_type.value}"
                ),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Attachment uploaded: id=%s, record=%s, file=%s",
                attachment.id,
                patient_record_id,
                attachment.file_name,
            )

            return attachment

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to upload attachment: record=%s",
                patient_record_id,
            )
            raise

    def bulk_upload(
        self,
        patient_record_id: UUID,
        payloads: list[AttachmentCreate],
        actor_id: int,
    ) -> list[PatientRecordAttachment]:
        """Upload multiple attachments under a patient record in one transaction.

        Business rules:
        1. The patient record must exist.
        2. The patient record must not be finalised or soft-deleted.
        3. Every attachment's file metadata must pass validation.

        Args:
            patient_record_id: UUID of the parent patient record.
            payloads: List of validated ``AttachmentCreate`` schemas.
            actor_id: ID of the authenticated user.

        Returns:
            The list of newly created ``PatientRecordAttachment`` instances.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is immutable or any
                file's metadata is invalid.
        """
        if not payloads:
            return []

        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            for payload in payloads:
                self._validate_file_metadata(
                    file_name=payload.file_name,
                    mime_type=payload.mime_type,
                    file_size=payload.file_size,
                    attachment_type=payload.attachment_type,
                )

            attachments = [
                PatientRecordAttachment(
                    patient_record_id=patient_record_id,
                    attachment_type=p.attachment_type,
                    file_name=p.file_name,
                    file_path=p.file_path,
                    mime_type=p.mime_type,
                    file_size=p.file_size,
                )
                for p in payloads
            ]

            attachments = self.attachment_repo.bulk_create(attachments)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=ATTACHMENT_BULK_UPLOADED,
                new_value=f"{len(attachments)} files uploaded",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Bulk uploaded %d attachments: record=%s",
                len(attachments),
                patient_record_id,
            )

            return attachments

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to bulk upload attachments: record=%s",
                patient_record_id,
            )
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_attachment(
        self,
        attachment_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordAttachment]:
        """Retrieve a single attachment by ID.

        Read-only — no audit log or transaction needed.

        Args:
            attachment_id: UUID of the target attachment.
            include_deleted: If ``True``, soft-deleted attachments are
                included.

        Returns:
            The matching attachment, or ``None``.
        """
        return self.attachment_repo.get_by_id(
            attachment_id,
            include_deleted=include_deleted,
        )

    def list_attachments(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordAttachment], int]:
        """Return a paginated list of attachments for a patient record.

        Read-only — no audit log or transaction needed.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(attachments, total_count)``.
        """
        return self.attachment_repo.get_by_record(
            patient_record_id,
            page=page,
            page_size=page_size,
        )

    def search_attachments(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        patient_record_id: Optional[UUID] = None,
        attachment_type: Optional[AttachmentType] = None,
        file_name_query: Optional[str] = None,
    ) -> tuple[list[PatientRecordAttachment], int]:
        """Search attachments with optional filters.

        Read-only — no audit log or transaction needed.

        Supports filtering by:
        * ``patient_record_id`` — parent record.
        * ``attachment_type`` — exact type match.
        * ``file_name_query`` — case-insensitive partial file name match.

        Args:
            page: 1-indexed page number.
            page_size: Max records per page.
            patient_record_id: Optional patient record filter.
            attachment_type: Optional type filter.
            file_name_query: Optional file name search string.

        Returns:
            A tuple of ``(attachments, total_count)``.
        """
        return self.attachment_repo.search(
            page=page,
            page_size=page_size,
            patient_record_id=patient_record_id,
            attachment_type=attachment_type,
            file_name_query=file_name_query,
        )

    # ==================================================================
    # Update
    # ==================================================================

    def update_attachment(
        self,
        attachment_id: UUID,
        payload: AttachmentUpdate,
        actor_id: int,
    ) -> PatientRecordAttachment:
        """Update attachment metadata.

        Business rules:
        1. The attachment must exist.
        2. The parent patient record must not be finalised or deleted.

        Only fields explicitly provided in ``payload`` are applied
        (``exclude_unset=True``).  The ``file_path`` field is immutable
        after creation and is excluded from the allowed update fields
        in the repository layer.

        Args:
            attachment_id: UUID of the attachment to update.
            payload: Validated ``AttachmentUpdate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecordAttachment``.

        Raises:
            AttachmentNotFound: If the attachment does not exist.
            PatientRecordBusinessRule: If the parent record is immutable.
        """
        try:
            attachment = self.attachment_repo.get_by_id_or_raise(attachment_id)
            record = self.record_repo.get_by_id_or_raise(
                attachment.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            updates = payload.model_dump(exclude_unset=True)

            if not updates:
                return attachment

            attachment = self.attachment_repo.update(attachment, updates)

            self._create_audit_log(
                patient_record_id=record.id,
                action=ATTACHMENT_UPDATED,
                new_value=str(updates),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Attachment updated: id=%s, fields=%s",
                attachment.id,
                list(updates.keys()),
            )

            return attachment

        except (
            AttachmentNotFound,
            PatientRecordNotFound,
            PatientRecordBusinessRule,
        ):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update attachment: id=%s",
                attachment_id,
            )
            raise

    # ==================================================================
    # Soft delete
    # ==================================================================

    def delete_attachment(
        self,
        attachment_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete an attachment.

        Business rules:
        1. The attachment must exist.
        2. The parent patient record must not be finalised or deleted.

        Args:
            attachment_id: UUID of the attachment to soft-delete.
            actor_id: ID of the authenticated user.
        """
        try:
            attachment = self.attachment_repo.get_by_id_or_raise(attachment_id)
            record = self.record_repo.get_by_id_or_raise(
                attachment.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            if attachment.is_deleted:
                logger.info(
                    "Attachment already deleted (idempotent): id=%s",
                    attachment_id,
                )
                return

            self.attachment_repo.soft_delete(attachment)

            self._create_audit_log(
                patient_record_id=record.id,
                action=ATTACHMENT_DELETED,
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Attachment soft-deleted: id=%s, record=%s",
                attachment_id,
                record.id,
            )

        except (
            AttachmentNotFound,
            PatientRecordNotFound,
            PatientRecordBusinessRule,
        ):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to soft-delete attachment: id=%s",
                attachment_id,
            )
            raise

    # ==================================================================
    # Count
    # ==================================================================

    def count_attachments(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        attachment_type: Optional[AttachmentType] = None,
    ) -> int:
        """Count attachments matching the given filters.

        Read-only — no audit log or transaction needed.
        """
        return self.attachment_repo.count(
            patient_record_id=patient_record_id,
            attachment_type=attachment_type,
        )

    # ==================================================================
    # Internal helpers
    # ==================================================================

    @staticmethod
    def _validate_file_metadata(
        *,
        file_name: str,
        mime_type: Optional[str],
        file_size: Optional[int],
        attachment_type: AttachmentType,
    ) -> None:
        """Validate file metadata before persisting an attachment.

        Checks performed:
        1. **File size limit** — Rejects files exceeding 50 MB.
        2. **MIME type validation** — Only allows known types per
           ``AttachmentType`` category.

        Raises:
            PatientRecordBusinessRule: If any validation check fails.
        """
        if file_size is not None and file_size > _MAX_FILE_SIZE_BYTES:
            raise PatientRecordBusinessRule(
                message=(
                    f"File size {file_size} bytes exceeds maximum allowed "
                    f"size of {_MAX_FILE_SIZE_BYTES} bytes"
                ),
                details={
                    "file_name": file_name,
                    "file_size": file_size,
                    "max_size": _MAX_FILE_SIZE_BYTES,
                },
            )

        if mime_type is not None and not _is_mime_type_allowed(
            mime_type,
            attachment_type,
        ):
            raise PatientRecordBusinessRule(
                message=(
                    f"MIME type '{mime_type}' is not allowed for "
                    f"attachment type '{attachment_type.value}'"
                ),
                details={
                    "file_name": file_name,
                    "mime_type": mime_type,
                    "attachment_type": attachment_type.value,
                },
            )

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


# ==================================================================
# Module-level helper — MIME type validation
# ==================================================================

def _is_mime_type_allowed(
    mime_type: str,
    attachment_type: AttachmentType,
) -> bool:
    """Check whether a MIME type is allowed for the given attachment type.

    The mapping is:
    * ``SCAN``, ``IMAGE`` → image/* types
    * ``DOCUMENT`` → PDF, Word, plain text
    * ``VIDEO`` → mp4, mpeg, quicktime
    * ``OTHER`` → all known types
    """
    if attachment_type in (AttachmentType.SCAN, AttachmentType.IMAGE):
        return mime_type.lower() in _ALLOWED_IMAGE_TYPES

    if attachment_type == AttachmentType.DOCUMENT:
        return mime_type.lower() in _ALLOWED_DOCUMENT_TYPES

    if attachment_type == AttachmentType.VIDEO:
        return mime_type.lower() in _ALLOWED_VIDEO_TYPES

    # OTHER: allow any of the known types.
    return mime_type.lower() in (
        _ALLOWED_IMAGE_TYPES | _ALLOWED_DOCUMENT_TYPES | _ALLOWED_VIDEO_TYPES
    )
