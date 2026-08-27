from __future__ import annotations

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.database.session import get_db

from app.modules.auth.models import User

from app.modules.patients.schemas import (
    PatientCreate,
    PatientListResponse,
    PatientProfileResponse,
    PatientQuickCreate,
    PatientQuickCreateResponse,
    PatientResponse,
    PatientSummaryResponse,
    PatientUpdate,
)

from app.modules.patients.service import (
    PatientService,
)

from app.modules.appointments.service import (
    AppointmentService,
)
from app.modules.appointments.schema import (
    AppointmentListResponse,
)

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)

from app.modules.rbac.permissions import (
    require_roles,
)

router = APIRouter(
    prefix="/patients",
    tags=["Patients"],
)


def get_patient_service(
    db: Session = Depends(get_db),
) -> PatientService:
    """FastAPI dependency that constructs a PatientService instance."""

    return PatientService(db)


def get_appointment_service(
    db: Session = Depends(get_db),
) -> AppointmentService:
    """FastAPI dependency that constructs an AppointmentService instance."""

    return AppointmentService(db)


# ==========================================================
# CREATE PATIENT
# ==========================================================

@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Patient",
    description=(
        "Register a new patient in the system. "
        "Validates all required fields, checks for duplicate records "
        "(blocking exact matches, warning on partial matches), "
        "and auto-generates a unique patient code (PAT-XXXXXX)."
    ),
    response_description="The newly created patient record.",
)
def create_patient(
    payload: PatientCreate,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service
    ),
) -> PatientResponse:

    return service.create_patient(
        payload,
        current_user.id,
    )


# ==========================================================
# QUICK CREATE PATIENT (Phone-Call Workflow)
# ==========================================================

@router.post(
    "/quick-create",
    response_model=PatientQuickCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Quick Create Patient",
    description=(
        "Create a minimal patient record for the phone-call workflow. "
        "Accepts only name and phone (gender optional). "
        "Performs potential-match detection (non-blocking) and returns "
        "warnings alongside the newly created patient. "
        "Sets profile_status to INCOMPLETE."
    ),
    response_description="Newly created patient with potential matches and warnings.",
)
def quick_create_patient(
    payload: PatientQuickCreate,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service
    ),
) -> PatientQuickCreateResponse:

    return service.quick_create_patient(
        payload,
        current_user.id,
    )


# ==========================================================
# LIST PATIENTS
# ==========================================================

@router.get(
    "",
    response_model=PatientListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Patients",
    description=(
        "Retrieve a paginated list of patients. "
        "Supports full-text search across patient code, name, and phone. "
        "Results can be filtered by active/inactive status "
        "and are ordered by most recent first."
    ),
    response_description="Paginated list of patient summaries.",
)
def list_patients(

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

    search: str | None = Query(
        default=None,
        description="Search term to match against patient code, name, or phone.",
    ),

    is_active: bool | None = Query(
        default=None,
        description="Filter by active status. Omit to return all.",
    ),

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientListResponse:

    return service.list_patients(
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
    )


# ==========================================================
# GET PATIENT
# ==========================================================

@router.get(
    "/{patient_id}",
    response_model=PatientResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Patient",
    description=(
        "Retrieve the full details of a single patient by their UUID. "
        "Returns a 404 error if the patient does not exist."
    ),
    response_description="The full patient record.",
)
def get_patient(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientResponse:

    return service.get_patient(
        patient_id
    )


# ==========================================================
# UPDATE PATIENT
# ==========================================================

@router.patch(
    "/{patient_id}",
    response_model=PatientResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Patient",
    description=(
        "Partially update a patient's information. "
        "Only the fields provided in the request body will be updated. "
        "Validates duplicates for the updated fields and normalizes "
        "text fields (names, email, phone)."
    ),
    response_description="The updated patient record.",
)
def update_patient(

    patient_id: UUID,

    payload: PatientUpdate,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientResponse:

    return service.update_patient(
        patient_id,
        payload,
        updated_by=current_user.id,
    )


# ==========================================================
# ACTIVATE PATIENT
# ==========================================================

@router.patch(
    "/{patient_id}/activate",
    response_model=PatientResponse,
    status_code=status.HTTP_200_OK,
    summary="Activate Patient",
    description=(
        "Activate a previously deactivated patient. "
        "Returns a 400 error if the patient is already active. "
        "Requires ADMIN role."
    ),
    response_description="The patient record with updated active status.",
)
def activate_patient(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientResponse:

    return service.change_patient_status(
        patient_id,
        True,
        updated_by=current_user.id,
    )


# ==========================================================
# DEACTIVATE PATIENT
# ==========================================================

@router.patch(
    "/{patient_id}/deactivate",
    response_model=PatientResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate Patient",
    description=(
        "Deactivate a patient record. "
        "Deactivated patients are excluded from most searches by default. "
        "Returns a 400 error if the patient is already inactive. "
        "Requires ADMIN role."
    ),
    response_description="The patient record with updated active status.",
)
def deactivate_patient(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientResponse:

    return service.change_patient_status(
        patient_id,
        False,
        updated_by=current_user.id,
    )


# ==========================================================
# PATIENT PROFILE
# ==========================================================

@router.get(
    "/{patient_id}/profile",
    response_model=PatientProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Patient Profile",
    description=(
        "Retrieve a comprehensive patient profile. "
        "Returns the same data as Get Patient but is intended "
        "as an extensible endpoint for future profile-specific fields "
        "(e.g., medical history, treatment plans)."
    ),
    response_description="The full patient profile.",
)
def patient_profile(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientProfileResponse:

    return service.get_patient_profile(
        patient_id
    )


# ==========================================================
# PATIENT HUB SUMMARY
# ==========================================================

@router.get(
    "/{patient_id}/summary",
    response_model=PatientSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Patient Hub Summary",
    description=(
        "Aggregated overview for the Patient Hub. Returns entity counts, "
        "recent items (appointments, records, treatment plans, invoices), "
        "and a billing financial summary for the specified patient. "
        "Designed to minimise initial-load requests for the patient detail page."
    ),
    response_description="Patient hub summary with counts, recent items, and billing overview.",
)
def patient_summary(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
) -> PatientSummaryResponse:

    return service.get_patient_summary(patient_id)


# ==========================================================
# PATIENT APPOINTMENTS
# ==========================================================

@router.get(
    "/{patient_id}/appointments",
    response_model=AppointmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="Patient Appointments",
    description=(
        "Retrieve a paginated list of appointments for a specific patient. "
        "Supports skip/limit pagination."
    ),
    response_description="Paginated list of appointments belonging to the patient.",
)
def patient_appointments(

    patient_id: UUID,

    skip: int = Query(
        default=0,
        ge=0,
        description="Zero-based offset.",
    ),

    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Number of records per page (max 100).",
    ),

    current_user: User = Depends(
        require_roles(
            [
                ROLE_ADMIN,
                ROLE_RECEPTIONIST,
                *DOCTOR_ROLES,
            ]
        )
    ),

    patient_service: PatientService = Depends(
        get_patient_service,
    ),

    appointment_service: AppointmentService = Depends(
        get_appointment_service,
    ),
) -> AppointmentListResponse:

    # Verify patient exists (raises 404 if not found)
    patient_service.get_patient(patient_id)

    rows, total = (
        appointment_service.list_by_patient(
            patient_id=patient_id,
            skip=skip,
            limit=limit,
        )
    )

    return {
        "items": rows,
        "total": total,
    }