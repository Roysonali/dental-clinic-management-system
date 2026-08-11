"""
Attachment API Router
=====================

Production-grade FastAPI router for managing file attachments linked to
patient clinical records.

Every endpoint enforces:
* **File validation** - the service validates the actual file (magic-byte
  MIME sniffing, extension allowlist, size limit from settings) before
  anything is stored.  The client-declared ``Content-Type`` is untrusted.
* **Authorized access** - upload/delete require write roles; download,
  preview and metadata reads require read roles (admin / doctor /
  receptionist).
* **Actor propagation** - the authenticated user's ID is passed to the
  service layer for audit logging (upload, download, update, delete).
* **Finalized-record protection** - attachments cannot be uploaded,
  updated, or deleted if the parent patient record is finalized or
  soft-deleted.  Downloads/previews remain available for finalized
  records (a locked chart is still readable).
* **No path exposure** - stored files are served by opaque attachment
  UUID through authenticated endpoints; the filesystem/storage location
  is never returned.

Domain exceptions (``AttachmentNotFound``, ``AttachmentDownloadError``,
``PatientRecordBusinessRule``, ``PatientRecordNotFound``) propagate to the
global ``patient_record_exception_handler``.
"""

from __future__ import annotations

import math
from urllib.parse import quote
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response

from app.core.config import settings
from app.modules.auth.models import User
from app.modules.patient_records.dependencies.patient_record_dependencies import (
    get_attachment_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_read,
    require_patient_record_write,
)
from app.modules.patient_records.enums import AttachmentType
from app.modules.patient_records.exceptions import (
    AttachmentNotFound,
    PatientRecordBusinessRule,
)
from app.modules.patient_records.schemas.attachment_schema import (
    AttachmentListResponse,
    AttachmentResponse,
    AttachmentUpdate,
    AttachmentUpload,
)
from app.modules.patient_records.services import AttachmentService
from app.modules.patient_records.services.attachment_service import (
    is_previewable_mime_type,
)

# ---------------------------------------------------------------------------
# Router definitions
#
# Two routers are used so that:
#   - Collection endpoints live under /patient-records/{record_id}/attachments
#   - Item endpoints live under /attachments/{attachment_id}
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/patient-records/{record_id}/attachments",
    tags=["Attachments"],
)

item_router = APIRouter(
    prefix="/attachments",
    tags=["Attachments"],
)


def _content_disposition(filename: str, *, inline: bool) -> str:
    """Build a safe Content-Disposition header value for a filename.

    The original filename is user-supplied, so it is only ever placed in
    the header — never in a filesystem path.  Non-ASCII characters are
    encoded with the RFC 5987 ``filename*`` form.
    """
    disposition = "inline" if inline else "attachment"
    ascii_name = filename.encode("ascii", "ignore").decode("ascii")
    quoted = ascii_name.replace('"', "").replace("\\", "")
    if not quoted:
        quoted = "download"
    return f"{disposition}; filename=\"{quoted}\"; filename*=UTF-8''{quote(filename)}"


# ======================================================================
# POST /patient-records/{record_id}/attachments
# ======================================================================


@router.post(
    "",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Attachment",
    description=(
        "Upload a file attachment under a patient record using "
        "``multipart/form-data`` (fields: ``file``, ``attachment_type``). "
        "The parent record must exist, must not be finalized, and must "
        "not be soft-deleted.  The file is validated by magic bytes, "
        "extension and size (limit from configuration) before being "
        "stored; only metadata is persisted.  An audit entry is written "
        "on success."
    ),
    response_description="The newly created attachment record.",
)
async def upload_attachment(
    record_id: UUID,
    file: UploadFile = File(..., description="The file to upload"),
    attachment_type: AttachmentType = Form(
        ...,
        description="Attachment category (IMAGE, PDF, REPORT, SCAN, DOCUMENT)",
    ),
    current_user: User = Depends(require_patient_record_write),
    service: AttachmentService = Depends(get_attachment_service),
) -> AttachmentResponse:
    """Upload a real file attachment under a patient record."""
    # Read up to the size limit + 1 byte so an oversized file is rejected
    # without being buffered in memory beyond the limit.
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read(max_bytes + 1)

    payload = AttachmentUpload(
        file_name=file.filename or "upload",
        content=content,
        content_type=file.content_type,
        attachment_type=attachment_type,
    )

    return service.upload_attachment(
        patient_record_id=record_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# GET /patient-records/{record_id}/attachments
# ======================================================================


@router.get(
    "",
    response_model=AttachmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Attachments",
    description=(
        "Retrieve a paginated list of attachments for a patient "
        "record.  Results are ordered by most-recent first."
    ),
    response_description="Paginated list of attachments.",
)
def list_attachments(
    record_id: UUID,
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (1-based).",
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Number of records per page (max 100).",
    ),
    current_user: User = Depends(require_patient_record_read),
    service: AttachmentService = Depends(get_attachment_service),
) -> AttachmentListResponse:
    """Return a paginated list of attachments for a patient record."""
    items, total = service.list_attachments(
        patient_record_id=record_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return AttachmentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /attachments/{attachment_id}
# ======================================================================


@item_router.get(
    "/{attachment_id}",
    response_model=AttachmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Attachment",
    description=(
        "Retrieve a single attachment by its UUID.  Returns 404 if "
        "the attachment does not exist or has been soft-deleted."
    ),
    response_description="The full attachment record.",
)
def get_attachment(
    attachment_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: AttachmentService = Depends(get_attachment_service),
) -> AttachmentResponse:
    """Get a single attachment by UUID."""
    attachment = service.get_attachment(attachment_id)

    if attachment is None:
        raise AttachmentNotFound(attachment_id=attachment_id)

    return attachment


# ======================================================================
# GET /attachments/{attachment_id}/download
# ======================================================================


@item_router.get(
    "/{attachment_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download Attachment",
    description=(
        "Stream the stored file for an attachment with the original "
        "filename (``Content-Disposition: attachment``).  Requires "
        "patient-record read access; the stored file is served through "
        "this authenticated endpoint only.  Returns 404 when the "
        "attachment is a legacy metadata-only row or its stored file is "
        "missing.  Downloads are written to the audit trail."
    ),
    response_description="Raw file bytes.",
)
def download_attachment(
    attachment_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: AttachmentService = Depends(get_attachment_service),
) -> Response:
    """Download the stored file for an attachment."""
    content, attachment = service.download_attachment(
        attachment_id=attachment_id,
        actor_id=current_user.id,
    )

    return Response(
        content=content,
        media_type=attachment.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": _content_disposition(
                attachment.file_name,
                inline=False,
            ),
        },
    )


# ======================================================================
# GET /attachments/{attachment_id}/preview
# ======================================================================


@item_router.get(
    "/{attachment_id}/preview",
    status_code=status.HTTP_200_OK,
    summary="Preview Attachment",
    description=(
        "Stream the stored file inline (``Content-Disposition: inline``) "
        "for browser rendering.  Only PDF and common image formats are "
        "previewable; other types return 400.  Requires patient-record "
        "read access.  Downloads/previews are written to the audit trail."
    ),
    response_description="Raw file bytes (inline).",
)
def preview_attachment(
    attachment_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: AttachmentService = Depends(get_attachment_service),
) -> Response:
    """Stream the stored file inline for browser preview."""
    content, attachment = service.download_attachment(
        attachment_id=attachment_id,
        actor_id=current_user.id,
    )

    if not is_previewable_mime_type(attachment.mime_type):
        raise PatientRecordBusinessRule(
            message=(
                "Preview is not supported for this file type — use "
                "Download instead."
            ),
            details={"mime_type": attachment.mime_type},
        )

    return Response(
        content=content,
        media_type=attachment.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": _content_disposition(
                attachment.file_name,
                inline=True,
            ),
        },
    )


# ======================================================================
# PATCH /attachments/{attachment_id}
# ======================================================================


@item_router.patch(
    "/{attachment_id}",
    response_model=AttachmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Attachment",
    description=(
        "Partially update attachment metadata (file name, MIME type, "
        "file size, attachment type).  The stored file and its storage "
        "reference are immutable.  The parent patient record must not be "
        "finalized or soft-deleted.  An audit entry is written on "
        "success."
    ),
    response_description="The updated attachment record.",
)
def update_attachment(
    attachment_id: UUID,
    payload: AttachmentUpdate,
    current_user: User = Depends(require_patient_record_write),
    service: AttachmentService = Depends(get_attachment_service),
) -> AttachmentResponse:
    """Update attachment metadata."""
    return service.update_attachment(
        attachment_id=attachment_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# DELETE /attachments/{attachment_id}
# ======================================================================


@item_router.delete(
    "/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Attachment",
    description=(
        "Soft-delete an attachment.  The row is not removed from the "
        "database; ``is_deleted`` is set to true and the stored file is "
        "removed from storage (best-effort).  The parent patient record "
        "must not be finalized or soft-deleted."
    ),
    response_description="No content - attachment has been soft-deleted.",
)
def delete_attachment(
    attachment_id: UUID,
    current_user: User = Depends(require_patient_record_write),
    service: AttachmentService = Depends(get_attachment_service),
) -> None:
    """Soft-delete an attachment."""
    service.delete_attachment(
        attachment_id=attachment_id,
        actor_id=current_user.id,
    )
