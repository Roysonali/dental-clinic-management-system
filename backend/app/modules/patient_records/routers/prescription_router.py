"""
Prescription API Router
======================

Production-grade FastAPI router for managing prescriptions attached to
patient clinical records.

Every endpoint enforces:
* **RBAC** - role-based access control (admin / doctor / receptionist).
* **Actor propagation** - the authenticated user's ID is passed to the
  service layer for audit logging.
* **Finalized-record protection** - prescriptions cannot be created,
  updated, or deleted on finalized or soft-deleted parent records.
* **OpenAPI metadata** - every route carries a summary, description,
  and response description for generated docs.

Domain exceptions (``PrescriptionNotFound``, ``PatientRecordBusinessRule``,
``PatientRecordNotFound``) propagate to the global
``patient_record_exception_handler`` registered in
``core/exception_handlers.py``.
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
    get_prescription_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_read,
    require_patient_record_write,
)
from app.modules.patient_records.exceptions import PrescriptionNotFound
from app.modules.patient_records.schemas.prescription_schema import (
    PrescriptionCreate,
    PrescriptionListResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.modules.patient_records.services import PrescriptionService

# ---------------------------------------------------------------------------
# Router definitions
#
# Two routers are used so that:
#   - Collection endpoints live under /patient-records/{record_id}/prescriptions
#   - Item endpoints live under /prescriptions/{prescription_id}
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/patient-records/{record_id}/prescriptions",
    tags=["Prescriptions"],
)

item_router = APIRouter(
    prefix="/prescriptions",
    tags=["Prescriptions"],
)


# ======================================================================
# POST /patient-records/{record_id}/prescriptions
# ======================================================================


@router.post(
    "",
    response_model=PrescriptionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Prescription",
    description=(
        "Create a new prescription with medicine items under a patient "
        "record.  The parent record must exist, must not be finalized, "
        "and must not be soft-deleted.  The payload must include at "
        "least one medicine item.  An audit entry is written on success."
    ),
    response_description="The newly created prescription with items.",
)
def create_prescription(
    record_id: UUID,
    payload: PrescriptionCreate,
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionService = Depends(get_prescription_service),
) -> PrescriptionResponse:
    """Create a prescription under the specified patient record."""
    return service.create_prescription(
        patient_record_id=record_id,
        prescribed_by=current_user.id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# GET /patient-records/{record_id}/prescriptions
# ======================================================================


@router.get(
    "",
    response_model=PrescriptionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Prescriptions",
    description=(
        "Retrieve a paginated list of prescriptions for a patient "
        "record.  Results are ordered by most-recent first."
    ),
    response_description="Paginated list of prescriptions.",
)
def list_prescriptions(
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
    service: PrescriptionService = Depends(get_prescription_service),
) -> PrescriptionListResponse:
    """Return a paginated list of prescriptions for a patient record."""
    items, total = service.list_prescriptions(
        patient_record_id=record_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return PrescriptionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /prescriptions/{prescription_id}
# ======================================================================


@item_router.get(
    "/{prescription_id}",
    response_model=PrescriptionResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Prescription",
    description=(
        "Retrieve a single prescription by its UUID, including all "
        "medicine items.  Returns 404 if the prescription does not "
        "exist or has been soft-deleted."
    ),
    response_description="The full prescription with items.",
)
def get_prescription(
    prescription_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: PrescriptionService = Depends(get_prescription_service),
) -> PrescriptionResponse:
    """Get a single prescription by UUID."""
    prescription = service.get_prescription(prescription_id)

    if prescription is None:
        raise PrescriptionNotFound(prescription_id=prescription_id)

    return prescription


# ======================================================================
# PATCH /prescriptions/{prescription_id}
# ======================================================================


@item_router.patch(
    "/{prescription_id}",
    response_model=PrescriptionResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Prescription",
    description=(
        "Partially update a prescription's notes.  Only the ``notes`` "
        "field is mutable after creation.  The parent patient record "
        "must not be finalized or soft-deleted.  An audit entry is "
        "written on success."
    ),
    response_description="The updated prescription.",
)
def update_prescription(
    prescription_id: UUID,
    payload: PrescriptionUpdate,
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionService = Depends(get_prescription_service),
) -> PrescriptionResponse:
    """Update a prescription's notes."""
    return service.update_prescription(
        prescription_id=prescription_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# DELETE /prescriptions/{prescription_id}
# ======================================================================


@item_router.delete(
    "/{prescription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Prescription",
    description=(
        "Soft-delete a prescription.  The row is not removed from the "
        "database; ``is_deleted`` is set to true.  The parent patient "
        "record must not be finalized or soft-deleted."
    ),
    response_description="No content - prescription has been soft-deleted.",
)
def delete_prescription(
    prescription_id: UUID,
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionService = Depends(get_prescription_service),
) -> None:
    """Soft-delete a prescription."""
    service.delete_prescription(
        prescription_id=prescription_id,
        actor_id=current_user.id,
    )
