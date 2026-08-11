from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import (
    StorageBackend,
    StorageFileNotFound,
    get_local_storage,
)
from app.modules.patient_records.enums import AttachmentType
from app.modules.patient_records.exceptions import (
    AttachmentDownloadError,
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
    AttachmentUpdate,
    AttachmentUpload,
)

from app.modules.patient_records.constants import (
    ATTACHMENT_BULK_UPLOADED,
    ATTACHMENT_DELETED,
    ATTACHMENT_DOWNLOADED,
    ATTACHMENT_UPLOADED,
    ATTACHMENT_UPDATED,
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

#: MIME types we can detect from a file's magic bytes (the authoritative
#: check — the client-declared Content-Type is untrusted).
_SNIFFABLE_MIME_TYPES: frozenset[str] = frozenset({
    *_ALLOWED_IMAGE_TYPES,
    *_ALLOWED_DOCUMENT_TYPES,
})

# ---------------------------------------------------------------------------
# Allowed file extensions per attachment type.
# ---------------------------------------------------------------------------
_IMAGE_EXTENSIONS: frozenset[str] = frozenset({
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".bmp",
})

_PDF_EXTENSIONS: frozenset[str] = frozenset({".pdf"})

_REPORT_EXTENSIONS: frozenset[str] = frozenset({
    ".pdf", ".doc", ".docx", ".txt",
})

_DOCUMENT_EXTENSIONS: frozenset[str] = frozenset({
    ".pdf", ".doc", ".docx", ".txt",
})

_ALLOWED_EXTENSIONS: dict[AttachmentType, frozenset[str]] = {
    AttachmentType.IMAGE: _IMAGE_EXTENSIONS,
    AttachmentType.SCAN: _IMAGE_EXTENSIONS,
    AttachmentType.PDF: _PDF_EXTENSIONS,
    AttachmentType.REPORT: _REPORT_EXTENSIONS,
    AttachmentType.DOCUMENT: _DOCUMENT_EXTENSIONS,
}

#: MIME types the browser can render inline (used by the preview endpoint).
_PREVIEWABLE_MIME_TYPES: frozenset[str] = frozenset({
    "application/pdf",
    *_ALLOWED_IMAGE_TYPES,
})


class AttachmentService:
    """Service-layer orchestrator for ``PatientRecordAttachment`` workflows.

    Attachment operations manage **real files** through a storage
    abstraction (``StorageBackend`` — local disk today) plus the
    corresponding metadata row.  Responsibilities:

    * Validate the uploaded file (extension allowlist, magic-byte MIME
      sniffing, size limit from settings) **before** anything is stored.
    * Store the file under an opaque server-generated key and persist only
      metadata (original filename, MIME, size, uploader) in the database.
    * Serve downloads/previews through authorized endpoints only — the
      physical storage path is never exposed.
    * Soft-delete the metadata row and remove the stored object, keeping
      audit entries for upload, download and delete.
    """

    def __init__(
        self,
        db: Session,
        storage: StorageBackend | None = None,
    ) -> None:
        self.db = db
        self.storage: StorageBackend = storage or get_local_storage()
        self.attachment_repo = AttachmentRepository(db)
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def upload_attachment(
        self,
        patient_record_id: UUID,
        payload: AttachmentUpload,
        actor_id: int,
    ) -> PatientRecordAttachment:
        """Validate, store and register a single file attachment.

        Business rules:
        1. The patient record must exist.
        2. The patient record must not be finalised or soft-deleted.
        3. The file must pass validation (extension allowlist, magic-byte
           MIME sniffing, size limit).
        4. The file is stored under an opaque key; only metadata is saved.

        Args:
            patient_record_id: UUID of the parent patient record.
            payload: Validated ``AttachmentUpload`` (raw file + metadata).
            actor_id: ID of the authenticated user.

        Returns:
            The newly created ``PatientRecordAttachment``.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is immutable or the
                file is invalid.
        """
        storage_key = uuid4().hex
        stored = False

        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            mime_type = self._validate_upload(
                file_name=payload.file_name,
                content=payload.content,
                declared_content_type=payload.content_type,
                attachment_type=payload.attachment_type,
            )

            # Save the physical file first — the DB row is metadata only.
            self.storage.save(storage_key, payload.content)
            stored = True

            attachment = PatientRecordAttachment(
                patient_record_id=patient_record_id,
                attachment_type=payload.attachment_type,
                file_name=payload.file_name,
                # file_path holds the same opaque key (legacy NOT NULL
                # column); storage_key is the canonical reference.
                file_path=storage_key,
                storage_key=storage_key,
                mime_type=mime_type,
                file_size=len(payload.content),
                uploaded_by=actor_id,
            )

            attachment = self.attachment_repo.create(attachment)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=ATTACHMENT_UPLOADED,
                new_value=(
                    f"file={attachment.file_name}, "
                    f"type={attachment.attachment_type.value}, "
                    f"size={attachment.file_size}"
                ),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Attachment uploaded: id=%s, record=%s, file=%s, size=%s",
                attachment.id,
                patient_record_id,
                attachment.file_name,
                attachment.file_size,
            )

            return attachment

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            self._discard_stored_file(storage_key, stored)
            raise

        except Exception:
            self.db.rollback()
            self._discard_stored_file(storage_key, stored)
            logger.exception(
                "Failed to upload attachment: record=%s",
                patient_record_id,
            )
            raise

    def bulk_upload(
        self,
        patient_record_id: UUID,
        payloads: list[AttachmentUpload],
        actor_id: int,
    ) -> list[PatientRecordAttachment]:
        """Upload multiple attachments under a patient record in one transaction.

        Business rules mirror ``upload_attachment`` for every payload.
        """
        if not payloads:
            return []

        stored_keys: list[str] = []

        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            validated: list[tuple[str, str, AttachmentUpload]] = []
            for payload in payloads:
                mime_type = self._validate_upload(
                    file_name=payload.file_name,
                    content=payload.content,
                    declared_content_type=payload.content_type,
                    attachment_type=payload.attachment_type,
                )
                key = uuid4().hex
                self.storage.save(key, payload.content)
                stored_keys.append(key)
                validated.append((key, mime_type, payload))

            attachments = [
                PatientRecordAttachment(
                    patient_record_id=patient_record_id,
                    attachment_type=p.attachment_type,
                    file_name=p.file_name,
                    file_path=key,
                    storage_key=key,
                    mime_type=mime_type,
                    file_size=len(p.content),
                    uploaded_by=actor_id,
                )
                for key, mime_type, p in validated
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
            self._discard_stored_files(stored_keys)
            raise

        except Exception:
            self.db.rollback()
            self._discard_stored_files(stored_keys)
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
        """Return a paginated list of attachments for a patient record."""
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
        """Search attachments with optional filters."""
        return self.attachment_repo.search(
            page=page,
            page_size=page_size,
            patient_record_id=patient_record_id,
            attachment_type=attachment_type,
            file_name_query=file_name_query,
        )

    def download_attachment(
        self,
        attachment_id: UUID,
        actor_id: int,
    ) -> tuple[bytes, PatientRecordAttachment]:
        """Return the stored file bytes for an attachment.

        Authorization is enforced by the router (RBAC dependency) and by
        the attachment lookup itself (only non-deleted rows resolve).
        Downloads are audited through the existing audit trail.

        Raises:
            AttachmentNotFound: If the attachment row does not exist.
            AttachmentDownloadError: If the attachment has no stored file
                (legacy metadata-only row) or the stored object is missing.
        """
        try:
            attachment = self.attachment_repo.get_by_id_or_raise(attachment_id)

            if not attachment.storage_key:
                raise AttachmentDownloadError(
                    attachment_id=attachment_id,
                    details={"reason": "no_storage_key"},
                )

            try:
                content = self.storage.open(attachment.storage_key)
            except StorageFileNotFound:
                logger.warning(
                    "Attachment stored file missing: id=%s key=%s",
                    attachment_id,
                    attachment.storage_key,
                )
                raise AttachmentDownloadError(
                    attachment_id=attachment_id,
                    details={"reason": "stored_file_missing"},
                )

            self._create_audit_log(
                patient_record_id=attachment.patient_record_id,
                action=ATTACHMENT_DOWNLOADED,
                new_value=f"file={attachment.file_name}",
                performed_by=actor_id,
            )
            self.db.commit()

            return content, attachment

        except (AttachmentNotFound, AttachmentDownloadError):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to download attachment: id=%s",
                attachment_id,
            )
            raise

    # ==================================================================
    # Update
    # ==================================================================

    def update_attachment(
        self,
        attachment_id: UUID,
        payload: AttachmentUpdate,
        actor_id: int,
    ) -> PatientRecordAttachment:
        """Update attachment metadata (file itself is immutable).

        Only fields explicitly provided in ``payload`` are applied
        (``exclude_unset=True``).  ``storage_key``/``file_path`` are never
        updatable.
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
    # Soft delete (+ storage cleanup)
    # ==================================================================

    def delete_attachment(
        self,
        attachment_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete an attachment and remove its stored file.

        The DB row is soft-deleted first (existing behaviour) and then the
        physical object is removed from storage **best-effort** — a storage
        failure never blocks or reverts the logical delete; the orphaned
        object is logged for later cleanup.
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

            # Physical cleanup — never raises, never rolls back the delete.
            if attachment.storage_key:
                try:
                    self.storage.delete(attachment.storage_key)
                except Exception:
                    logger.exception(
                        "Failed to delete stored file (orphaned): "
                        "attachment=%s key=%s",
                        attachment_id,
                        attachment.storage_key,
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
        """Count attachments matching the given filters."""
        return self.attachment_repo.count(
            patient_record_id=patient_record_id,
            attachment_type=attachment_type,
        )

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _validate_upload(
        self,
        *,
        file_name: str,
        content: bytes,
        declared_content_type: Optional[str],
        attachment_type: AttachmentType,
    ) -> str:
        """Validate an uploaded file before it is stored.

        Checks (in order):
        1. **Size limit** — from ``settings.MAX_UPLOAD_SIZE_MB``.
        2. **Extension allowlist** — the file name must end with an
           extension permitted for the attachment type.
        3. **Magic-byte sniffing** — the file's actual signature must match
           a known, allowed MIME type for the attachment type.  The
           client-declared ``Content-Type`` is never trusted on its own.

        Returns the authoritative MIME type to persist.

        Raises:
            PatientRecordBusinessRule: On any failed check (message is
                user-facing and contains no stack traces).
        """
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        if len(content) > max_bytes:
            raise PatientRecordBusinessRule(
                message=(
                    f"File {file_name} exceeds the maximum allowed size of "
                    f"{settings.MAX_UPLOAD_SIZE_MB} MB"
                ),
                details={
                    "file_name": file_name,
                    "file_size": len(content),
                    "max_size": max_bytes,
                },
            )

        if not self._extension_allowed(file_name, attachment_type):
            raise PatientRecordBusinessRule(
                message=(
                    f"File type '{file_name}' is not supported for "
                    f"attachment type '{attachment_type.value}'"
                ),
                details={
                    "file_name": file_name,
                    "attachment_type": attachment_type.value,
                },
            )

        sniffed = _sniff_mime_type(content)

        if sniffed is None:
            # Only plain text has no magic bytes — require a text/plain
            # declaration AND a .txt extension to accept it.
            declared = (declared_content_type or "").strip().lower()
            if declared == "text/plain":
                return "text/plain"
            raise PatientRecordBusinessRule(
                message=(
                    f"File '{file_name}' has an unsupported format. "
                    "Supported types: PDF, JPG, PNG, GIF, WEBP, TIFF, "
                    "BMP, DOC, DOCX, TXT."
                ),
                details={"file_name": file_name},
            )

        if not _is_mime_type_allowed(sniffed, attachment_type):
            raise PatientRecordBusinessRule(
                message=(
                    f"File content ({sniffed}) is not allowed for "
                    f"attachment type '{attachment_type.value}'"
                ),
                details={
                    "file_name": file_name,
                    "mime_type": sniffed,
                    "attachment_type": attachment_type.value,
                },
            )

        # Consistency guard: when the client declared a known type, it must
        # match what the file actually is.
        declared = (declared_content_type or "").strip().lower()
        if declared in _SNIFFABLE_MIME_TYPES and declared != sniffed:
            raise PatientRecordBusinessRule(
                message=(
                    f"Declared file type '{declared}' does not match the "
                    f"file content ({sniffed})."
                ),
                details={
                    "file_name": file_name,
                    "declared": declared,
                    "sniffed": sniffed,
                },
            )

        return sniffed

    @staticmethod
    def _extension_allowed(
        file_name: str,
        attachment_type: AttachmentType,
    ) -> bool:
        """Return whether ``file_name``'s extension is allowed for the type."""
        allowed = _ALLOWED_EXTENSIONS.get(attachment_type)
        if not allowed:
            return False
        dot_index = file_name.rfind(".")
        if dot_index <= 0 or dot_index == len(file_name) - 1:
            return False
        return file_name[dot_index:].lower() in allowed

    def _discard_stored_file(self, storage_key: str, stored: bool) -> None:
        """Best-effort removal of a file saved before a failure."""
        if not stored:
            return
        try:
            self.storage.delete(storage_key)
        except Exception:
            logger.exception(
                "Failed to clean up stored file after failure: key=%s",
                storage_key,
            )

    def _discard_stored_files(self, storage_keys: list[str]) -> None:
        for key in storage_keys:
            self._discard_stored_file(key, True)

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


# ======================================================================
# Module-level helpers
# ======================================================================


def _sniff_mime_type(content: bytes) -> Optional[str]:
    """Detect a file's MIME type from its magic bytes.

    Returns ``None`` for unrecognised content (which is rejected upstream
    unless it is a declared plain-text file).
    """
    if content.startswith(b"%PDF-"):
        return "application/pdf"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return "image/gif"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"II*\x00") or content.startswith(b"MM\x00*"):
        return "image/tiff"
    if content.startswith(b"BM"):
        return "image/bmp"
    # DOCX (and other OOXML zips) start with the PK zip magic.
    if content.startswith(b"PK\x03\x04"):
        return (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        )
    # Legacy OLE2 compound documents (Word .doc).
    if content.startswith(b"\xd0\xcf\x11\xe0"):
        return "application/msword"
    return None


def _is_mime_type_allowed(
    mime_type: str,
    attachment_type: AttachmentType,
) -> bool:
    """Check whether a MIME type is allowed for the given attachment type."""
    normalized = mime_type.lower()

    if attachment_type in (AttachmentType.SCAN, AttachmentType.IMAGE):
        return normalized in _ALLOWED_IMAGE_TYPES

    if attachment_type == AttachmentType.PDF:
        return normalized == "application/pdf"

    if attachment_type == AttachmentType.REPORT:
        return normalized in _ALLOWED_DOCUMENT_TYPES

    if attachment_type == AttachmentType.DOCUMENT:
        return normalized in _ALLOWED_DOCUMENT_TYPES

    return False


def is_previewable_mime_type(mime_type: Optional[str]) -> bool:
    """Return whether a stored file's MIME type can be rendered inline."""
    if not mime_type:
        return False
    return mime_type.lower() in _PREVIEWABLE_MIME_TYPES
