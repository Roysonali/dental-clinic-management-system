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
    PatientResponse,
    PatientUpdate,
)

from app.modules.patients.service import (
    PatientService,
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
                "ADMIN",
                "RECEPTIONIST",
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
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
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
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
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
                "ADMIN",
                "RECEPTIONIST",
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
        "Returns a 409 error if the patient is already active. "
        "Requires ADMIN role."
    ),
    response_description="The patient record with updated active status.",
)
def activate_patient(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                "ADMIN",
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
        "Returns a 409 error if the patient is already inactive. "
        "Requires ADMIN role."
    ),
    response_description="The patient record with updated active status.",
)
def deactivate_patient(

    patient_id: UUID,

    current_user: User = Depends(
        require_roles(
            [
                "ADMIN",
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
                "ADMIN",
                "RECEPTIONIST",
                "DOCTOR",
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