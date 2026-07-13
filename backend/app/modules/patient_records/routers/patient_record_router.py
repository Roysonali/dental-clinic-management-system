"""
Patient Record API Router
=========================

Production-grade FastAPI router for managing patient clinical records.

Every endpoint enforces:
* **RBAC** — role-based access control (admin / doctor / receptionist).
* **Actor propagation** — the authenticated user's ID is passed to the
  service layer for audit logging.
* **Finalized-record protection** — immutable records are rejected by
  the service layer with a ``PatientRecordBusinessRule`` exception.
* **Soft-delete isolation** — deleted records are hidden by default.
* **OpenAPI metadata** — every route carries a summary, description,
  and response description for generated docs.

All business logic, validation, and audit logging lives in the service
layer — this router only delegates, maps exceptions, and returns HTTP
responses.

Domain exceptions (``PatientRecordNotFound``, ``PatientRecordConflict``,
``PatientRecordBusinessRule``) are **not** caught here — they propagate
to the global ``patient_record_exception_handler`` registered in
``core/exception_handlers.py``, which maps them to structured JSON
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
    get_patient_record_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_delete,
    require_patient_record_read,
    require_patient_record_status_change,
    require_patient_record_write,
)
from app.modules.patient_records.enums import RecordStatus
from app.modules.patient_records.exceptions import PatientRecordNotFound
from app.modules.patient_records.schemas.patient_record_schema import (
    PatientRecordCreate,
    PatientRecordFinalizeRequest,
    PatientRecordListResponse,
    PatientRecordResponse,
    PatientRecordUpdate,
)
from app.modules.patient_records.services import PatientRecordService

# ---------------------------------------------------------------------------
# Router definition
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/patient-records",
    tags=["Patient Records"],
)


# ======================================================================
# POST /patient-records
# ======================================================================


@router.post(
    "",
    response_model=PatientRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Patient Record",
    description=(
        "Create a new clinical record for a patient appointment.  "
        "Validates that the patient and appointment exist, and that "
        "the appointment does not already have a record.  The record "
        "is created in DRAFT status and an audit entry is written."
    ),
    response_description="The newly created patient record.",
)
def create_patient_record(
    payload: PatientRecordCreate,
    current_user: User = Depends(require_patient_record_write),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordResponse:
    """Create a new patient record for the given patient/appointment."""
    return service.create_patient_record(
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# GET /patient-records
# ======================================================================


@router.get(
    "",
    response_model=PatientRecordListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Patient Records",
    description=(
        "Retrieve a paginated list of patient records.  Supports "
        "optional filters for status, finalization state, patient, "
        "and free-text search against chief complaint and clinical "
        "notes.  Results are ordered by most-recent first."
    ),
    response_description="Paginated list of patient record summaries.",
)
def list_patient_records(
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
    status_filter: RecordStatus | None = Query(
        default=None,
        alias="status",
        description="Filter by record status (DRAFT, IN_PROGRESS, COMPLETED, LOCKED).",
    ),
    is_finalized: bool | None = Query(
        default=None,
        description="Filter by finalized state. Omit to return all.",
    ),
    patient_id: UUID | None = Query(
        default=None,
        description="Filter by patient UUID.",
    ),
    search: str | None = Query(
        default=None,
        description="Search term against chief complaint and clinical notes.",
    ),
    current_user: User = Depends(require_patient_record_read),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordListResponse:
    """Return a paginated, filterable list of patient records."""
    items, total = service.list_records(
        page=page,
        page_size=page_size,
        status=status_filter,
        is_finalized=is_finalized,
        patient_id=patient_id,
        search=search,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return PatientRecordListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /patient-records/{record_id}
# ======================================================================


@router.get(
    "/{record_id}",
    response_model=PatientRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Patient Record",
    description=(
        "Retrieve the full details of a single patient record by its "
        "UUID.  Includes nested diagnoses, prescriptions, follow-ups, "
        "attachments, and audit logs.  Returns a 404 error if the "
        "record does not exist or has been soft-deleted."
    ),
    response_description="The complete patient record with all relationships.",
)
def get_patient_record(
    record_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordResponse:
    """Get a single patient record by UUID."""
    return service.get_record_or_raise(record_id)


# ======================================================================
# GET /patient-records/appointment/{appointment_id}
# ======================================================================


@router.get(
    "/appointment/{appointment_id}",
    response_model=PatientRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Record by Appointment",
    description=(
        "Retrieve the patient record associated with a specific "
        "appointment.  Because each appointment has at most one "
        "record (unique constraint), this returns a single result.  "
        "Returns 404 if no record exists for the given appointment."
    ),
    response_description="The patient record for the specified appointment.",
)
def get_record_by_appointment(
    appointment_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordResponse:
    """Get the patient record for a specific appointment."""
    record = service.get_record_by_appointment(appointment_id)

    if record is None:
        raise PatientRecordNotFound(
            record_id=appointment_id,
            details={"appointment_id": str(appointment_id)},
        )

    return record


# ======================================================================
# GET /patient-records/patient/{patient_id}
# ======================================================================


@router.get(
    "/patient/{patient_id}",
    response_model=PatientRecordListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Records by Patient",
    description=(
        "Retrieve a paginated list of patient records for a specific "
        "patient, ordered by most-recent first.  Supports pagination "
        "via standard page / page_size query parameters."
    ),
    response_description="Paginated list of records for the patient.",
)
def list_records_by_patient(
    patient_id: UUID,
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
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordListResponse:
    """Get all patient records for a given patient (paginated)."""
    items, total = service.list_records(
        page=page,
        page_size=page_size,
        patient_id=patient_id,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return PatientRecordListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# PATCH /patient-records/{record_id}
# ======================================================================


@router.patch(
    "/{record_id}",
    response_model=PatientRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Patient Record",
    description=(
        "Partially update a patient record's clinical fields.  Only "
        "the fields provided in the request body are updated.  Finalized "
        "records cannot be modified.  An audit entry is written for "
        "every successful update."
    ),
    response_description="The updated patient record.",
)
def update_patient_record(
    record_id: UUID,
    payload: PatientRecordUpdate,
    current_user: User = Depends(require_patient_record_write),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordResponse:
    """Update a patient record's clinical fields."""
    return service.update_record(
        record_id=record_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# PATCH /patient-records/{record_id}/status
# ======================================================================


@router.patch(
    "/{record_id}/status",
    response_model=PatientRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Record Status",
    description=(
        "Transition a patient record to a new status.  Finalized "
        "records cannot have their status changed.  Valid status "
        "values are: DRAFT, IN_PROGRESS, COMPLETED, LOCKED."
    ),
    response_description="The patient record with the updated status.",
)
def update_record_status(
    record_id: UUID,
    new_status: RecordStatus = Query(
        ...,
        description="Target status value (DRAFT, IN_PROGRESS, COMPLETED, LOCKED).",
    ),
    current_user: User = Depends(require_patient_record_status_change),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordResponse:
    """Change the status of a patient record."""
    return service.update_status(
        record_id=record_id,
        new_status=new_status,
        actor_id=current_user.id,
    )


# ======================================================================
# POST /patient-records/{record_id}/finalize
# ======================================================================


@router.post(
    "/{record_id}/finalize",
    response_model=PatientRecordResponse,
    status_code=status.HTTP_200_OK,
    summary="Finalize Patient Record",
    description=(
        "Finalize a patient record, making it immutable.  Requires "
        "a confirmation payload with ``confirm: true``.  Once "
        "finalized, the record's status is set to COMPLETED and "
        "``is_finalized`` becomes true.  Further updates or status "
        "changes are rejected."
    ),
    response_description="The finalized patient record.",
)
def finalize_patient_record(
    record_id: UUID,
    payload: PatientRecordFinalizeRequest,
    current_user: User = Depends(require_patient_record_status_change),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> PatientRecordResponse:
    """Finalize (lock) a patient record.

    The ``PatientRecordFinalizeRequest`` schema already validates that
    ``confirm`` is ``Literal[True]``, so by the time execution reaches
    this function the confirmation is guaranteed.
    """
    return service.finalize_record(
        record_id=record_id,
        actor_id=current_user.id,
    )


# ======================================================================
# DELETE /patient-records/{record_id}
# ======================================================================


@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Patient Record",
    description=(
        "Soft-delete a patient record.  The record is not removed "
        "from the database; ``is_deleted`` is set to true so it is "
        "hidden from default queries.  Finalized records cannot be "
        "deleted.  Requires ADMIN role."
    ),
    response_description="No content — record has been soft-deleted.",
)
def delete_patient_record(
    record_id: UUID,
    current_user: User = Depends(require_patient_record_delete),
    service: PatientRecordService = Depends(get_patient_record_service),
) -> None:
    """Soft-delete a patient record (admin only)."""
    service.delete_record(
        record_id=record_id,
        actor_id=current_user.id,
    )
