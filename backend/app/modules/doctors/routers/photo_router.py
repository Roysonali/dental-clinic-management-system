"""Doctor Profile Photo — Upload / Serve / Delete endpoints.

Option A architecture: ``POST /doctors/{doctor_id}/profile-photo`` accepts a
multipart form upload.  The stored file is served back through
``GET /doctors/{doctor_id}/profile-photo`` so the physical storage path is
never exposed.  ``DELETE`` removes the photo and cleans up the stored file.

All write endpoints require Admin role (matching existing Doctor RBAC).
The serve endpoint requires any authenticated clinical role.
"""

from __future__ import annotations

import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.storage import StorageBackend, get_local_storage
from app.database.session import get_db
from app.modules.auth.models import User
from app.modules.doctors.constants import (
    ALLOWED_PHOTO_TYPES,
    PROFILE_PHOTO_MAX_SIZE,
)
from app.modules.doctors.dependencies import (
    require_doctor_self_or_full_read,
)
from app.modules.doctors.exceptions import (
    DoctorNotFound,
    DoctorValidationFailed,
)
from app.modules.doctors.mapper import DoctorMapper
from app.modules.doctors.schemas import DoctorResponse
from app.modules.doctors.services.doctor_service import DoctorService
from app.modules.rbac.permissions import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/doctors/{doctor_id}/profile-photo",
    tags=["Doctor Profile Photo"],
)


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────


def _sniff_photo_mime(content: bytes) -> str | None:
    """Detect a photo file's MIME type from magic bytes.

    Only image types relevant to profile photos are recognised.
    Returns ``None`` for unrecognised content.
    """
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


# ──────────────────────────────────────────────────────────────
# POST /doctors/{doctor_id}/profile-photo
# ──────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Upload Doctor Profile Photo",
    description=(
        "Upload a profile photo for a doctor. Accepts JPEG, PNG, or WebP "
        "images up to 5 MB. The file is validated by magic-byte MIME sniffing "
        "before storage. If a photo already exists, it is replaced and the "
        "old file is deleted. Returns the updated doctor profile."
    ),
    response_description="The updated doctor profile with the new photo reference.",
    responses={
        400: {"description": "Invalid file type or size."},
        404: {"description": "Doctor not found."},
        422: {"description": "Validation error."},
    },
)
async def upload_profile_photo(
    doctor_id: UUID,
    file: UploadFile = File(
        ..., description="Profile photo (JPEG, PNG, WebP, max 5 MB)"
    ),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DoctorResponse:
    """Upload a profile photo for a doctor."""
    storage = get_local_storage()
    service = DoctorService(db)

    # Read the file content (up to limit + 1 to detect oversized)
    max_bytes = PROFILE_PHOTO_MAX_SIZE + 1
    content = await file.read(max_bytes)

    if len(content) > PROFILE_PHOTO_MAX_SIZE:
        raise DoctorValidationFailed(
            message=(
                f"File exceeds the maximum allowed size of "
                f"{PROFILE_PHOTO_MAX_SIZE // (1024 * 1024)} MB"
            ),
            details={
                "max_size_bytes": PROFILE_PHOTO_MAX_SIZE,
                "actual_size_bytes": len(content),
            },
        )

    if len(content) == 0:
        raise DoctorValidationFailed(
            message="Uploaded file is empty",
            details={},
        )

    # Validate MIME type via magic bytes
    mime_type = _sniff_photo_mime(content)
    if mime_type is None or mime_type not in ALLOWED_PHOTO_TYPES:
        allowed_desc = ", ".join(
            sorted(t.split("/")[-1].upper() for t in ALLOWED_PHOTO_TYPES)
        )
        raise DoctorValidationFailed(
            message=f"File type is not supported. Accepted formats: {allowed_desc}",
            details={"allowed_types": sorted(ALLOWED_PHOTO_TYPES)},
        )

    # Consistency guard: if client declared a type, it must match
    declared = (file.content_type or "").strip().lower()
    if declared and declared in ALLOWED_PHOTO_TYPES and declared != mime_type:
        raise DoctorValidationFailed(
            message=(
                f"Declared file type '{declared}' does not match the actual "
                f"file content ({mime_type})"
            ),
            details={"declared": declared, "sniffed": mime_type},
        )

    # Generate an opaque storage key
    storage_key = uuid4().hex

    # Look up the doctor
    doctor = service.get_doctor_by_id(doctor_id)
    old_storage_key = doctor.profile_photo_url

    # Save the new file first (before DB write)
    storage.save(storage_key, content)

    try:
        # Update the doctor's profile_photo_url with the storage key
        doctor.profile_photo_url = storage_key
        doctor.updated_by = current_user.id
        db.flush()
        db.refresh(doctor)
        db.commit()
    except Exception:
        # Rollback: remove the newly saved file
        try:
            storage.delete(storage_key)
        except Exception:
            logger.exception(
                "Failed to clean up stored file after DB failure: key=%s",
                storage_key,
            )
        db.rollback()
        raise

    # Best-effort delete of old file (after successful commit)
    if old_storage_key:
        try:
            storage.delete(old_storage_key)
        except Exception:
            logger.warning(
                "Failed to delete old profile photo (orphaned): "
                "doctor=%s key=%s",
                doctor_id,
                old_storage_key,
            )

    logger.info(
        "Profile photo uploaded: doctor=%s key=%s size=%d mime=%s",
        doctor_id,
        storage_key,
        len(content),
        mime_type,
    )

    return DoctorMapper.to_response(doctor)


# ──────────────────────────────────────────────────────────────
# GET /doctors/{doctor_id}/profile-photo
# ──────────────────────────────────────────────────────────────


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="Serve Doctor Profile Photo",
    description=(
        "Serve the doctor's profile photo as an inline image response. "
        "Requires any authenticated clinical role. Returns 404 if the doctor "
        "has no photo or the stored file is missing."
    ),
    response_description="Raw image bytes.",
    responses={
        404: {"description": "Doctor or photo not found."},
    },
)
def serve_profile_photo(
    doctor_id: UUID,
    current_user: User = Depends(require_doctor_self_or_full_read),
    db: Session = Depends(get_db),
) -> Response:
    """Serve the doctor's profile photo."""
    storage = get_local_storage()
    service = DoctorService(db)

    doctor = service.get_doctor_by_id(doctor_id)

    if not doctor.profile_photo_url:
        raise DoctorNotFound(message="Doctor has no profile photo")

    try:
        content = storage.open(doctor.profile_photo_url)
    except Exception:
        raise DoctorNotFound(message="Profile photo file not found")

    # Determine MIME type from magic bytes for correct Content-Type
    mime_type = _sniff_photo_mime(content) or "image/jpeg"

    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "Content-Disposition": (
                f'inline; filename="profile-{doctor.doctor_code}"'
            ),
        },
    )


# ──────────────────────────────────────────────────────────────
# DELETE /doctors/{doctor_id}/profile-photo
# ──────────────────────────────────────────────────────────────


@router.delete(
    "",
    status_code=status.HTTP_200_OK,
    summary="Remove Doctor Profile Photo",
    description=(
        "Remove the doctor's profile photo. Sets profile_photo_url to null "
        "and deletes the stored file. Returns the updated doctor profile."
    ),
    response_description="The updated doctor profile without a photo.",
    responses={
        404: {"description": "Doctor not found."},
    },
)
def remove_profile_photo(
    doctor_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DoctorResponse:
    """Remove the doctor's profile photo."""
    storage = get_local_storage()
    service = DoctorService(db)

    doctor = service.get_doctor_by_id(doctor_id)

    old_key = doctor.profile_photo_url
    if not old_key:
        # Already no photo — idempotent
        return DoctorMapper.to_response(doctor)

    doctor.profile_photo_url = None
    doctor.updated_by = current_user.id
    db.flush()
    db.refresh(doctor)
    db.commit()

    # Best-effort file cleanup
    try:
        storage.delete(old_key)
    except Exception:
        logger.warning(
            "Failed to delete stored profile photo (orphaned): "
            "doctor=%s key=%s",
            doctor_id,
            old_key,
        )

    logger.info("Profile photo removed: doctor=%s", doctor_id)

    return DoctorMapper.to_response(doctor)
