from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
)

from sqlalchemy.orm import Session

from app.database.session import (
    get_db,
)

from app.dependencies.auth import (
    get_current_user,
)

from app.modules.patients.schemas import (
    PatientCreate,
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
    db: Session = Depends(
        get_db
    ),
):

    return PatientService(
        db
    )


@router.post(
    "",
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

    return (
        service
        .create_patient(

            payload,

            current_user.id,
        )
    )


# ======================================
# LIST
# ======================================

@router.get(
    "",
)
def list_patients(

    page: int = Query(
        1,
        ge=1,
    ),

    page_size: int = Query(
        20,
        ge=1,
        le=100,
    ),

    search: str | None = None,

    is_active: bool | None = None,

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
        get_patient_service
    ),
):

    return (
        service
        .list_patients(

            page=page,

            page_size=page_size,

            search=search,

            is_active=is_active,
        )
    )


# ======================================
# GET
# ======================================

@router.get(
    "/{patient_id}",
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
        get_patient_service
    ),
):

    return (
        service
        .get_patient(
            patient_id
        )
    )


# ======================================
# UPDATE
# ======================================

@router.patch(
    "/{patient_id}",
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
        get_patient_service
    ),
):

    return (
        service
        .update_patient(

            patient_id,

            payload,
        )
    )


# ======================================
# ACTIVATE
# ======================================

@router.patch(
    "/{patient_id}/activate",
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
        get_patient_service
    ),
):

    return (
        service
        .change_patient_status(
            patient_id,
            True,
        )
    )


# ======================================
# DEACTIVATE
# ======================================

@router.patch(
    "/{patient_id}/deactivate",
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
        get_patient_service
    ),
):

    return (
        service
        .change_patient_status(
            patient_id,
            False,
        )
    )



@router.get(
    "/{patient_id}/profile",
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
        get_patient_service
    ),
):

    return (
        service
        .get_patient_profile(
            patient_id
        )
    )