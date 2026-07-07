"""
Attachment API Router
=====================

Production-grade FastAPI router for managing file attachments linked to
patient clinical records.

Every endpoint enforces:
* **MIME validation** - the service layer validates MIME types against
  allowed types per attachment category (image, document, video).
* **File validation** - file size is validated against a 50 MB limit.
* **RBAC** - role-based access control (admin / doctor / receptionist).
* **Actor propagation** - the authenticated user's ID is passed to the
  service layer for audit logging.
* **Finalized-record protection** - attachments cannot be uploaded,
  updated, or deleted if the parent patient record is finalized or
  soft-deleted.
* **OpenAPI metadata** - every route carries a summary, description,
  and response description for generated docs.

Domain exceptions (``AttachmentNotFound``, ``PatientRecordBusinessRule``,
``PatientRecordNotFound``) propagate to the global
``patient_record_exception_handler``.
"""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    status,
)

from app.modules.auth.models import User
from app.modules.patient_records.dependencies.patient_record_dependencies import (
    get_attachment_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_read,
    require_patient_record_write,
)
from app.modules.patient_records.exceptions import AttachmentNotFound
from app.modules.patient_records.schemas.attachment_schema import (
    AttachmentCreate,
    AttachmentListResponse,
    AttachmentResponse,
    AttachmentUpdate,
)
from app.modules.patient_records.services import AttachmentService

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


# ======================================================================
# POST /patient-records/{record_id}/attachments
# ======================================================================


@router.post(
    "",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Attachment",
    description=(
        "Register a file attachment under a patient record.  The "
        "parent record must exist, must not be finalized, and must "
        "not be soft-deleted.  MIME type and file size are validated "
        "against allowed types (image, document, video) and a 50 MB "
        "limit.  An audit entry is written on success."
    ),
    response_description="The newly created attachment record.",
)
def upload_attachment(
    record_id: UUID,
    payload: AttachmentCreate,
    current_user: User = Depends(require_patient_record_write),
    service: AttachmentService = Depends(get_attachment_service),
) -> AttachmentResponse:
    """Register a file attachment under a patient record."""
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
# PATCH /attachments/{attachment_id}
# ======================================================================


@item_router.patch(
    "/{attachment_id}",
    response_model=AttachmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Attachment",
    description=(
        "Partially update attachment metadata (file name, MIME type, "
        "file size, attachment type).  The ``file_path`` is immutable "
        "after creation.  The parent patient record must not be "
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
        "database; ``is_deleted`` is set to true.  The parent patient "
        "record must not be finalized or soft-deleted."
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
