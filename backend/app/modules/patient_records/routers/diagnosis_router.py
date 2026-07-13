"""
Diagnosis API Router
====================

Production-grade FastAPI router for managing diagnoses attached to
patient clinical records.

Every endpoint enforces:
* **RBAC** - role-based access control (admin / doctor / receptionist).
* **Actor propagation** - the authenticated user's ID is passed to the
  service layer for audit logging.
* **Finalized-record protection** - diagnoses cannot be created, updated,
  or deleted on finalized or soft-deleted parent records (enforced by
  the service layer).
* **OpenAPI metadata** - every route carries a summary, description,
  and response description for generated docs.

Domain exceptions (``DiagnosisNotFound``, ``PatientRecordBusinessRule``)
propagate to the global ``patient_record_exception_handler`` registered
in ``core/exception_handlers.py``, which maps them to structured JSON
error responses with the correct HTTP status codes.
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
    get_diagnosis_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_read,
    require_patient_record_write,
)
from app.modules.patient_records.enums import DiagnosisType
from app.modules.patient_records.exceptions import DiagnosisNotFound
from app.modules.patient_records.schemas.diagnosis_schema import (
    DiagnosisCreate,
    DiagnosisListResponse,
    DiagnosisResponse,
    DiagnosisUpdate,
)
from app.modules.patient_records.services import DiagnosisService

# ---------------------------------------------------------------------------
# Router definitions
#
# Two routers are used so that:
#   - Collection endpoints live under /patient-records/{record_id}/diagnoses
#   - Item endpoints live under /diagnoses/{diagnosis_id}
#
# Both are tagged "Diagnoses" and are registered from main.py / the app
# include point.
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/patient-records/{record_id}/diagnoses",
    tags=["Diagnoses"],
)

item_router = APIRouter(
    prefix="/diagnoses",
    tags=["Diagnoses"],
)


# ======================================================================
# POST /patient-records/{record_id}/diagnoses
# ======================================================================


@router.post(
    "",
    response_model=DiagnosisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Diagnosis",
    description=(
        "Create a new diagnosis under a patient record.  The parent "
        "record must exist, must not be finalized, and must not be "
        "soft-deleted.  An audit entry is written on success."
    ),
    response_description="The newly created diagnosis.",
)
def create_diagnosis(
    record_id: UUID,
    payload: DiagnosisCreate,
    current_user: User = Depends(require_patient_record_write),
    service: DiagnosisService = Depends(get_diagnosis_service),
) -> DiagnosisResponse:
    """Create a diagnosis under the specified patient record."""
    return service.create_diagnosis(
        patient_record_id=record_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# GET /patient-records/{record_id}/diagnoses
# ======================================================================


@router.get(
    "",
    response_model=DiagnosisListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Diagnoses",
    description=(
        "Retrieve a paginated list of diagnoses for a patient record. "
        "Supports optional filtering by diagnosis type.  Results are "
        "ordered by most-recent first."
    ),
    response_description="Paginated list of diagnoses.",
)
def list_diagnoses(
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
    diagnosis_type: DiagnosisType | None = Query(
        default=None,
        description="Filter by diagnosis type (PROVISIONAL, CONFIRMED).",
    ),
    current_user: User = Depends(require_patient_record_read),
    service: DiagnosisService = Depends(get_diagnosis_service),
) -> DiagnosisListResponse:
    """Return a paginated, filterable list of diagnoses for a patient record."""
    items, total = service.list_diagnoses(
        patient_record_id=record_id,
        page=page,
        page_size=page_size,
        diagnosis_type=diagnosis_type,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return DiagnosisListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /diagnoses/{diagnosis_id}
# ======================================================================


@item_router.get(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Diagnosis",
    description=(
        "Retrieve a single diagnosis by its UUID.  Returns 404 if "
        "the diagnosis does not exist or has been soft-deleted."
    ),
    response_description="The full diagnosis record.",
)
def get_diagnosis(
    diagnosis_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: DiagnosisService = Depends(get_diagnosis_service),
) -> DiagnosisResponse:
    """Get a single diagnosis by UUID."""
    diagnosis = service.get_diagnosis(diagnosis_id)

    if diagnosis is None:
        raise DiagnosisNotFound(diagnosis_id=diagnosis_id)

    return diagnosis


# ======================================================================
# PATCH /diagnoses/{diagnosis_id}
# ======================================================================


@item_router.patch(
    "/{diagnosis_id}",
    response_model=DiagnosisResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Diagnosis",
    description=(
        "Partially update a diagnosis.  Only the fields provided in "
        "the request body are updated.  The parent patient record must "
        "not be finalized or soft-deleted.  An audit entry is written "
        "on success."
    ),
    response_description="The updated diagnosis.",
)
def update_diagnosis(
    diagnosis_id: UUID,
    payload: DiagnosisUpdate,
    current_user: User = Depends(require_patient_record_write),
    service: DiagnosisService = Depends(get_diagnosis_service),
) -> DiagnosisResponse:
    """Update a diagnosis."""
    return service.update_diagnosis(
        diagnosis_id=diagnosis_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# DELETE /diagnoses/{diagnosis_id}
# ======================================================================


@item_router.delete(
    "/{diagnosis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Diagnosis",
    description=(
        "Soft-delete a diagnosis.  The row is not removed from the "
        "database; ``is_deleted`` is set to true.  The parent patient "
        "record must not be finalized or soft-deleted."
    ),
    response_description="No content - diagnosis has been soft-deleted.",
)
def delete_diagnosis(
    diagnosis_id: UUID,
    current_user: User = Depends(require_patient_record_write),
    service: DiagnosisService = Depends(get_diagnosis_service),
) -> None:
    """Soft-delete a diagnosis."""
    service.delete_diagnosis(
        diagnosis_id=diagnosis_id,
        actor_id=current_user.id,
    )
