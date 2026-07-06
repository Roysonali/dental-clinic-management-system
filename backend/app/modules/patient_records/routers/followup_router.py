"""
Follow-up API Router
====================

Production-grade FastAPI router for managing follow-up appointments
scheduled under patient clinical records.

Every endpoint enforces:
* **Future date validation** - follow-up dates must be today or a future
  date (validated by ``FollowupValidator`` in the service layer).
* **RBAC** - role-based access control (admin / doctor / receptionist).
* **Actor propagation** - the authenticated user's ID is passed to the
  service layer for audit logging.
* **Finalized-record protection** - follow-ups cannot be created, updated,
  or deleted if the parent patient record is finalized or soft-deleted.
* **OpenAPI metadata** - every route carries a summary, description,
  and response description for generated docs.

Domain exceptions (``FollowupNotFound``, ``PatientRecordBusinessRule``,
``PatientRecordNotFound``) propagate to the global
``patient_record_exception_handler``.
"""

from __future__ import annotations

import math
from datetime import date
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    status,
)

from app.modules.auth.models import User
from app.modules.patient_records.dependencies.patient_record_dependencies import (
    get_followup_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_read,
    require_patient_record_write,
)
from app.modules.patient_records.exceptions import FollowupNotFound
from app.modules.patient_records.schemas.followup_schema import (
    FollowupCreate,
    FollowupListResponse,
    FollowupResponse,
    FollowupUpdate,
)
from app.modules.patient_records.services import FollowupService

# ---------------------------------------------------------------------------
# Router definitions
#
# Two routers are used so that:
#   - Collection endpoints live under /patient-records/{record_id}/followups
#   - Item + upcoming endpoints live under /followups
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/patient-records/{record_id}/followups",
    tags=["Follow-ups"],
)

item_router = APIRouter(
    prefix="/followups",
    tags=["Follow-ups"],
)


# ======================================================================
# POST /patient-records/{record_id}/followups
# ======================================================================


@router.post(
    "",
    response_model=FollowupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Follow-up",
    description=(
        "Schedule a follow-up appointment under a patient record.  "
        "The follow-up date must be today or a future date.  The parent "
        "record must exist, must not be finalized, and must not be "
        "soft-deleted.  An audit entry is written on success."
    ),
    response_description="The newly created follow-up.",
)
def create_followup(
    record_id: UUID,
    payload: FollowupCreate,
    current_user: User = Depends(require_patient_record_write),
    service: FollowupService = Depends(get_followup_service),
) -> FollowupResponse:
    """Schedule a follow-up under a patient record."""
    return service.create_followup(
        patient_record_id=record_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# GET /patient-records/{record_id}/followups
# ======================================================================


@router.get(
    "",
    response_model=FollowupListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Follow-ups",
    description=(
        "Retrieve a paginated list of follow-ups for a patient "
        "record.  Results are ordered by most-recent first."
    ),
    response_description="Paginated list of follow-ups.",
)
def list_followups(
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
    service: FollowupService = Depends(get_followup_service),
) -> FollowupListResponse:
    """Return a paginated list of follow-ups for a patient record."""
    items, total = service.list_followups(
        patient_record_id=record_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return FollowupListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /followups/upcoming
# ======================================================================


@item_router.get(
    "/upcoming",
    response_model=FollowupListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Upcoming Follow-ups",
    description=(
        "Retrieve follow-ups scheduled within an optional date range.  "
        "Defaults to today's follow-ups if no range is specified.  "
        "Useful for daily reminders, weekly planning, or monthly "
        "follow-up reviews."
    ),
    response_description="Paginated list of upcoming follow-ups.",
)
def list_upcoming_followups(
    from_date: date | None = Query(
        default=None,
        description="Start of date range (inclusive).  Defaults to today.",
    ),
    to_date: date | None = Query(
        default=None,
        description="End of date range (inclusive).  Defaults to from_date.",
    ),
    patient_record_id: UUID | None = Query(
        default=None,
        description="Optional filter by patient record UUID.",
    ),
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
    service: FollowupService = Depends(get_followup_service),
) -> FollowupListResponse:
    """Return a paginated list of upcoming follow-ups within a date range."""
    items, total = service.get_upcoming(
        from_date=from_date,
        to_date=to_date,
        patient_record_id=patient_record_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return FollowupListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /followups/{followup_id}
# ======================================================================


@item_router.get(
    "/{followup_id}",
    response_model=FollowupResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Follow-up",
    description=(
        "Retrieve a single follow-up by its UUID.  Returns 404 if "
        "the follow-up does not exist or has been soft-deleted."
    ),
    response_description="The full follow-up record.",
)
def get_followup(
    followup_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: FollowupService = Depends(get_followup_service),
) -> FollowupResponse:
    """Get a single follow-up by UUID."""
    followup = service.get_followup(followup_id)

    if followup is None:
        raise FollowupNotFound(followup_id=followup_id)

    return followup


# ======================================================================
# PATCH /followups/{followup_id}
# ======================================================================


@item_router.patch(
    "/{followup_id}",
    response_model=FollowupResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Follow-up",
    description=(
        "Partially update a follow-up's date or clinical notes.  "
        "If the date is changed, it must still be today or a future "
        "date.  The parent patient record must not be finalized or "
        "soft-deleted.  An audit entry is written on success."
    ),
    response_description="The updated follow-up.",
)
def update_followup(
    followup_id: UUID,
    payload: FollowupUpdate,
    current_user: User = Depends(require_patient_record_write),
    service: FollowupService = Depends(get_followup_service),
) -> FollowupResponse:
    """Update a follow-up."""
    return service.update_followup(
        followup_id=followup_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# DELETE /followups/{followup_id}
# ======================================================================


@item_router.delete(
    "/{followup_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Follow-up",
    description=(
        "Soft-delete a follow-up.  The row is not removed from the "
        "database; ``is_deleted`` is set to true.  The parent patient "
        "record must not be finalized or soft-deleted."
    ),
    response_description="No content - follow-up has been soft-deleted.",
)
def delete_followup(
    followup_id: UUID,
    current_user: User = Depends(require_patient_record_write),
    service: FollowupService = Depends(get_followup_service),
) -> None:
    """Soft-delete a follow-up."""
    service.delete_followup(
        followup_id=followup_id,
        actor_id=current_user.id,
    )
