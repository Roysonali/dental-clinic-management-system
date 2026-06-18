from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.database.session import get_db

from app.modules.patients.schemas import (
    PatientCreate,
    PatientListResponse,
    PatientProfileResponse,
    PatientResponse,
    PatientStatusResponse,
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

    return PatientService(db)


# ==========================================================
# CREATE PATIENT
# ==========================================================

@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Patient",
)
def create_patient(
    payload: PatientCreate,

    current_user=Depends(
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
):

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
)
def list_patients(

    page: int = Query(
        default=1,
        ge=1,
    ),

    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
    ),

    search: str | None = Query(
        default=None,
    ),

    is_active: bool | None = Query(
        default=None,
    ),

    _: object = Depends(
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
):

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
)
def get_patient(

    patient_id: UUID,

    _: object = Depends(
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
):

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
)
def update_patient(

    patient_id: UUID,

    payload: PatientUpdate,

    _: object = Depends(
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
):

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
)
def activate_patient(

    patient_id: UUID,

    _: object = Depends(
        require_roles(
            [
                "ADMIN",
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
):

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
)
def deactivate_patient(

    patient_id: UUID,

    _: object = Depends(
        require_roles(
            [
                "ADMIN",
            ]
        )
    ),

    service: PatientService = Depends(
        get_patient_service,
    ),
):

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
)
def patient_profile(

    patient_id: UUID,

    _: object = Depends(
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
):

    return service.get_patient_profile(
        patient_id
    )