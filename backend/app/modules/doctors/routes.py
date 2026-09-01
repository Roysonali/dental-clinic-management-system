"""Doctor Management Module — API Layer (Routers).

Implements the REST API for the Doctor aggregate (doctor CRUD, status
transitions, specializations master data, doctor↔specialization assignment,
and schedules). Routers are intentionally thin: they authenticate/authorize
via dependencies, instantiate the service through a dependency, delegate to
the service, and map the returned ORM entity to a response schema. No
business logic, repository access, or validation lives here — that belongs
to the Service / Validator layers.

Authorization model (per module RBAC spec):
- Admin / Receptionist may read any doctor record.
- A doctor may read only their own profile / schedules.
- Specialization master data is readable by all clinical roles.

Phases 8.1–8.6.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import Query
from fastapi import status
from sqlalchemy.orm import Session

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)
from app.database.session import get_db
from app.modules.auth.models import User
from app.modules.doctors.dependencies import (
    require_doctor_self_or_full_read,
    require_user_self_or_full_read,
)
from app.modules.doctors.mapper import DoctorMapper
from app.modules.doctors.schemas import (
    DoctorCreate,
    DoctorListResponse,
    DoctorProfileResponse,
    DoctorResponse,
    DoctorSpecializationAssign,
    DoctorSpecializationResponse,
    DoctorUpdate,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
    SpecializationCreate,
    SpecializationListResponse,
    SpecializationResponse,
    SpecializationUpdate,
)
from app.modules.doctors.services.doctor_service import DoctorService
from app.modules.doctors.services.schedule_service import ScheduleService
from app.modules.doctors.services.specialization_service import SpecializationService
from app.modules.rbac.permissions import (
    require_admin,
    require_roles,
)

router = APIRouter(
    prefix="/doctors",
    tags=["Doctors"],
)


def get_doctor_service(
    db: Session = Depends(get_db),
) -> DoctorService:
    """FastAPI dependency that constructs a DoctorService instance."""
    return DoctorService(db)


# Shared error responses for OpenAPI documentation. The actual responses are
# produced by the global exception handlers in app.core.exception_handlers.
_COMMON_ERROR_RESPONSES: dict[int, dict[str, object]] = {
    401: {"description": "Not authenticated."},
    403: {"description": "Insufficient permissions."},
    404: {"description": "Resource not found."},
    409: {"description": "Conflict (e.g. duplicate registration number)."},
    422: {"description": "Request validation failed."},
}


# ==========================================================
# CREATE DOCTOR
# ==========================================================

@router.post(
    "",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    summary="Create Doctor",
    description=(
        "Create a new doctor profile linked to an existing user. "
        "Business rules (user existence/role/eligibility, uniqueness of "
        "registration number and profile) are enforced by the Service and "
        "Validator layers."
    ),
    response_description="The newly created doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def create_doctor(
    payload: DoctorCreate,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.create_doctor(payload, actor_id=current_user.id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# LIST DOCTORS
# ==========================================================

@router.get(
    "",
    response_model=DoctorListResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="List Doctors",
    description=(
        "Retrieve a paginated, filterable list of doctors. Supports "
        "search by doctor code or user name, filtering by specialization, "
        "active status, and availability, plus sorting."
    ),
    response_description="Paginated list of doctor profiles.",
    responses=_COMMON_ERROR_RESPONSES,
)
def list_doctors(
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=20, ge=1, le=100, description="Records per page (max 100)."
    ),
    search: str | None = Query(
        default=None, description="Search term for doctor code or user name."
    ),
    specialization_id: int | None = Query(
        default=None, description="Filter by specialization ID."
    ),
    is_active: bool | None = Query(
        default=None, description="Filter by active status."
    ),
    is_available: bool | None = Query(
        default=None, description="Filter by availability for appointments."
    ),
    sort_by: Literal["full_name", "years_of_experience"] = Query(
        default="full_name", description="Sort field."
    ),
    sort_order: Literal["asc", "desc"] = Query(
        default="asc", description="Sort direction."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST])
    ),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorListResponse:
    doctors, total = service.list_doctors(
        page=page,
        page_size=page_size,
        search=search,
        specialization_id=specialization_id,
        is_active=is_active,
        is_available=is_available,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return DoctorMapper.to_list_response(doctors, total, page, page_size)


# ==========================================================
# GET DOCTOR BY ID
# ==========================================================

@router.get(
    "/{doctor_id}",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Get Doctor by ID",
    description="Retrieve a single doctor profile by its UUID.",
    response_description="The doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def get_doctor(
    doctor_id: UUID,
    _: User = Depends(require_doctor_self_or_full_read),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.get_doctor_by_id(doctor_id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# GET DOCTOR BY USER ID
# ==========================================================

@router.get(
    "/user/{user_id}",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Get Doctor by User ID",
    description="Retrieve a doctor profile linked to a given user account ID.",
    response_description="The doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def get_doctor_by_user(
    user_id: int,
    _: User = Depends(require_user_self_or_full_read),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.get_doctor_by_user_id(user_id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# UPDATE DOCTOR
# ==========================================================

@router.patch(
    "/{doctor_id}",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Update Doctor",
    description=(
        "Partially update a doctor's profile. Only the fields provided in "
        "the request body are applied; business rules are enforced by the "
        "Service and Validator layers."
    ),
    response_description="The updated doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def update_doctor(
    doctor_id: UUID,
    payload: DoctorUpdate,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.update_doctor(
        doctor_id, payload, actor_id=current_user.id
    )
    return DoctorMapper.to_response(doctor)


# ==========================================================
# DELETE DOCTOR
# ==========================================================

@router.delete(
    "/{doctor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Doctor",
    description="Permanently remove a doctor profile (hard delete).",
    response_description="No content returned on success.",
    responses=_COMMON_ERROR_RESPONSES,
)
def delete_doctor(
    doctor_id: UUID,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> None:
    service.delete_doctor(doctor_id, actor_id=current_user.id)


# ==========================================================
# ACTIVATE DOCTOR
# ==========================================================

@router.patch(
    "/{doctor_id}/activate",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Activate Doctor",
    description=(
        "Activate a doctor profile. Idempotent if already active; the "
        "business rule is enforced by the Service/Validator layers."
    ),
    response_description="The activated doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def activate_doctor(
    doctor_id: UUID,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.activate_doctor(doctor_id, actor_id=current_user.id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# DEACTIVATE DOCTOR
# ==========================================================

@router.patch(
    "/{doctor_id}/deactivate",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Deactivate Doctor",
    description=(
        "Deactivate a doctor profile. Idempotent if already inactive; the "
        "business rule is enforced by the Service/Validator layers."
    ),
    response_description="The deactivated doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def deactivate_doctor(
    doctor_id: UUID,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.deactivate_doctor(doctor_id, actor_id=current_user.id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# TOGGLE LEAVE
# ==========================================================

@router.patch(
    "/{doctor_id}/leave",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Toggle Doctor Leave Status",
    description=(
        "Toggle the on-leave flag for a doctor. Returns the updated profile."
    ),
    response_description="The updated doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def toggle_leave(
    doctor_id: UUID,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.toggle_leave(doctor_id, actor_id=current_user.id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# TOGGLE AVAILABILITY
# ==========================================================

@router.patch(
    "/{doctor_id}/availability",
    response_model=DoctorResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Toggle Doctor Availability",
    description=(
        "Toggle the available-for-appointment flag for a doctor. An inactive "
        "doctor cannot be marked available; this rule is enforced by the "
        "Service/Validator layers."
    ),
    response_description="The updated doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def toggle_availability(
    doctor_id: UUID,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorResponse:
    doctor = service.toggle_availability(doctor_id, actor_id=current_user.id)
    return DoctorMapper.to_response(doctor)


# ==========================================================
# ASSIGN SPECIALIZATIONS
# ==========================================================

@router.post(
    "/{doctor_id}/specializations",
    response_model=list[DoctorSpecializationResponse],
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    summary="Assign Specialization to Doctor",
    description=(
        "Assign a specialization to a doctor. If marked primary, the "
        "specialization must be in the assignment; the rule is enforced by "
        "the Service/Validator layers. Duplicate assignments are skipped."
    ),
    response_description="The created specialization assignment(s).",
    responses=_COMMON_ERROR_RESPONSES,
)
def assign_specialization(
    doctor_id: UUID,
    payload: DoctorSpecializationAssign,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> list[DoctorSpecializationResponse]:
    entries = service.assign_specializations(
        doctor_id,
        [payload.specialization_id],
        primary_specialization_id=payload.specialization_id
        if payload.is_primary
        else None,
        actor_id=current_user.id,
    )
    return [DoctorMapper.to_specialization_response(entry) for entry in entries]


# ==========================================================
# REMOVE SPECIALIZATION
# ==========================================================

@router.delete(
    "/{doctor_id}/specializations/{specialization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove Specialization from Doctor",
    description=(
        "Remove a specialization assignment from a doctor. The assignment "
        "must exist (enforced by the Service/Validator layers)."
    ),
    response_description="No content returned on success.",
    responses=_COMMON_ERROR_RESPONSES,
)
def remove_specialization(
    doctor_id: UUID,
    specialization_id: int,
    current_user: User = Depends(require_admin),
    service: DoctorService = Depends(get_doctor_service),
) -> None:
    service.remove_specialization(
        doctor_id, specialization_id, actor_id=current_user.id
    )


# ==========================================================
# DOCTOR PROFILE
# ==========================================================

@router.get(
    "/{doctor_id}/profile",
    response_model=DoctorProfileResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Get Doctor Profile",
    description=(
        "Retrieve a comprehensive doctor profile including assigned "
        "specializations and weekly schedule templates."
    ),
    response_description="The full doctor profile.",
    responses=_COMMON_ERROR_RESPONSES,
)
def get_doctor_profile(
    doctor_id: UUID,
    _: User = Depends(require_doctor_self_or_full_read),
    service: DoctorService = Depends(get_doctor_service),
) -> DoctorProfileResponse:
    doctor = service.get_doctor_profile(doctor_id)
    return DoctorMapper.to_profile_response(doctor)


# ==========================================================
# SPECIALIZATION MASTER DATA ROUTER
# ==========================================================

specialization_router = APIRouter(
    prefix="/specializations",
    tags=["Specializations"],
)


def get_specialization_service(
    db: Session = Depends(get_db),
) -> SpecializationService:
    """FastAPI dependency that constructs a SpecializationService instance."""
    return SpecializationService(db)


# ----------------------------------------------------------
# CREATE SPECIALIZATION
# ----------------------------------------------------------

@specialization_router.post(
    "",
    response_model=SpecializationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    summary="Create Specialization",
    description=(
        "Create a new dental specialization in the master list. Name and "
        "code uniqueness are enforced by the Service/Validator layers."
    ),
    response_description="The newly created specialization.",
    responses=_COMMON_ERROR_RESPONSES,
)
def create_specialization(
    payload: SpecializationCreate,
    current_user: User = Depends(require_admin),
    service: SpecializationService = Depends(get_specialization_service),
) -> SpecializationResponse:
    return service.create_specialization(payload, actor_id=current_user.id)


# ----------------------------------------------------------
# LIST SPECIALIZATIONS
# ----------------------------------------------------------

@specialization_router.get(
    "",
    response_model=SpecializationListResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="List Specializations",
    description=(
        "Retrieve a paginated list of specializations, optionally filtered "
        "by active status."
    ),
    response_description="List of specialization records.",
    responses=_COMMON_ERROR_RESPONSES,
)
def list_specializations(
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=20, ge=1, le=100, description="Records per page (max 100)."
    ),
    is_active: bool | None = Query(
        default=None, description="Filter by active status."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: SpecializationService = Depends(get_specialization_service),
) -> SpecializationListResponse:
    specializations, total = service.list_specializations(
        page=page,
        page_size=page_size,
        is_active=is_active,
    )
    return SpecializationListResponse(
        items=specializations,
        total=total,
        page=page,
        page_size=page_size,
    )


# ----------------------------------------------------------
# GET SPECIALIZATION BY ID
# ----------------------------------------------------------

@specialization_router.get(
    "/{specialization_id}",
    response_model=SpecializationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Get Specialization by ID",
    description="Retrieve a single specialization by its numeric ID.",
    response_description="The specialization record.",
    responses=_COMMON_ERROR_RESPONSES,
)
def get_specialization(
    specialization_id: int,
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: SpecializationService = Depends(get_specialization_service),
) -> SpecializationResponse:
    return service.get_specialization(specialization_id)


# ----------------------------------------------------------
# UPDATE SPECIALIZATION
# ----------------------------------------------------------

@specialization_router.patch(
    "/{specialization_id}",
    response_model=SpecializationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Update Specialization",
    description=(
        "Partially update a specialization. Name/code uniqueness is "
        "re-validated by the Service/Validator layers when changed."
    ),
    response_description="The updated specialization.",
    responses=_COMMON_ERROR_RESPONSES,
)
def update_specialization(
    specialization_id: int,
    payload: SpecializationUpdate,
    current_user: User = Depends(require_admin),
    service: SpecializationService = Depends(get_specialization_service),
) -> SpecializationResponse:
    return service.update_specialization(
        specialization_id, payload, actor_id=current_user.id
    )


# ----------------------------------------------------------
# ACTIVATE SPECIALIZATION
# ----------------------------------------------------------

@specialization_router.patch(
    "/{specialization_id}/activate",
    response_model=SpecializationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Activate Specialization",
    description="Activate a specialization. Idempotent if already active.",
    response_description="The activated specialization.",
    responses=_COMMON_ERROR_RESPONSES,
)
def activate_specialization(
    specialization_id: int,
    current_user: User = Depends(require_admin),
    service: SpecializationService = Depends(get_specialization_service),
) -> SpecializationResponse:
    return service.activate_specialization(
        specialization_id, actor_id=current_user.id
    )


# ----------------------------------------------------------
# DEACTIVATE SPECIALIZATION
# ----------------------------------------------------------

@specialization_router.patch(
    "/{specialization_id}/deactivate",
    response_model=SpecializationResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Deactivate Specialization",
    description="Deactivate a specialization. Idempotent if already inactive.",
    response_description="The deactivated specialization.",
    responses=_COMMON_ERROR_RESPONSES,
)
def deactivate_specialization(
    specialization_id: int,
    current_user: User = Depends(require_admin),
    service: SpecializationService = Depends(get_specialization_service),
) -> SpecializationResponse:
    return service.deactivate_specialization(
        specialization_id, actor_id=current_user.id
    )


# ----------------------------------------------------------
# DELETE SPECIALIZATION
# ----------------------------------------------------------

@specialization_router.delete(
    "/{specialization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Specialization",
    description=(
        "Delete a specialization. Blocked if it is still assigned to any "
        "doctor (enforced by the Service/Validator layers)."
    ),
    response_description="No content returned on success.",
    responses=_COMMON_ERROR_RESPONSES,
)
def delete_specialization(
    specialization_id: int,
    current_user: User = Depends(require_admin),
    service: SpecializationService = Depends(get_specialization_service),
) -> None:
    service.delete_specialization(specialization_id, actor_id=current_user.id)


# ==========================================================
# SCHEDULE ROUTER
# ==========================================================

schedule_router = APIRouter(
    prefix="/doctors/{doctor_id}/schedules",
    tags=["Schedules"],
)


def get_schedule_service(
    db: Session = Depends(get_db),
) -> ScheduleService:
    """FastAPI dependency that constructs a ScheduleService instance."""
    return ScheduleService(db)


# ----------------------------------------------------------
# LIST SCHEDULES
# ----------------------------------------------------------

@schedule_router.get(
    "",
    response_model=list[ScheduleResponse],
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="List Doctor Schedules",
    description=(
        "Retrieve the weekly schedule templates for a doctor, ordered by "
        "day of week. Requires an active doctor (enforced by the "
        "Service/Validator layers)."
    ),
    response_description="List of schedule entries.",
    responses=_COMMON_ERROR_RESPONSES,
)
def list_schedules(
    doctor_id: UUID,
    _: User = Depends(require_doctor_self_or_full_read),
    service: ScheduleService = Depends(get_schedule_service),
) -> list[ScheduleResponse]:
    return service.list_schedule(doctor_id)


# ----------------------------------------------------------
# CREATE SCHEDULE
# ----------------------------------------------------------

@schedule_router.post(
    "",
    response_model=ScheduleResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    summary="Create Schedule Entry",
    description=(
        "Create a weekly schedule template for a doctor. Validates doctor "
        "active status, weekday uniqueness, and end-time-after-start-time "
        "(enforced by the Service/Validator layers)."
    ),
    response_description="The newly created schedule entry.",
    responses=_COMMON_ERROR_RESPONSES,
)
def create_schedule(
    doctor_id: UUID,
    payload: ScheduleCreate,
    current_user: User = Depends(require_admin),
    service: ScheduleService = Depends(get_schedule_service),
) -> ScheduleResponse:
    return service.create_schedule(
        doctor_id, payload, actor_id=current_user.id
    )


# ----------------------------------------------------------
# UPDATE SCHEDULE
# ----------------------------------------------------------

@schedule_router.patch(
    "/{schedule_id}",
    response_model=ScheduleResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Update Schedule Entry",
    description=(
        "Partially update a schedule entry. Re-validates time ordering and "
        "weekday uniqueness when those fields change (Service/Validator "
        "layers)."
    ),
    response_description="The updated schedule entry.",
    responses=_COMMON_ERROR_RESPONSES,
)
def update_schedule(
    doctor_id: UUID,
    schedule_id: UUID,
    payload: ScheduleUpdate,
    current_user: User = Depends(require_admin),
    service: ScheduleService = Depends(get_schedule_service),
) -> ScheduleResponse:
    return service.update_schedule(
        doctor_id, schedule_id, payload, actor_id=current_user.id
    )


# ----------------------------------------------------------
# DELETE SCHEDULE
# ----------------------------------------------------------

@schedule_router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Schedule Entry",
    description=(
        "Delete a schedule entry for a doctor. Cross-doctor access is "
        "rejected by the Service/Validator layers."
    ),
    response_description="No content returned on success.",
    responses=_COMMON_ERROR_RESPONSES,
)
def delete_schedule(
    doctor_id: UUID,
    schedule_id: UUID,
    current_user: User = Depends(require_admin),
    service: ScheduleService = Depends(get_schedule_service),
) -> None:
    service.delete_schedule(doctor_id, schedule_id, actor_id=current_user.id)


# ----------------------------------------------------------
# REPLACE WEEKLY SCHEDULE
# ----------------------------------------------------------

@schedule_router.put(
    "",
    response_model=list[ScheduleResponse],
    response_model_exclude_none=True,
    status_code=status.HTTP_200_OK,
    summary="Replace Weekly Schedule",
    description=(
        "Atomically replace a doctor's entire weekly schedule. All existing "
        "entries are deleted and recreated from the provided list. The "
        "operation is validated as a whole (entry count, time ordering, and "
        "same-day session overlap) before any change is committed. "
        "Multiple non-overlapping sessions per day are allowed (split shifts)."
    ),
    response_description="The newly created schedule entries.",
    responses=_COMMON_ERROR_RESPONSES,
)
def replace_week_schedule(
    doctor_id: UUID,
    schedules: list[ScheduleCreate],
    current_user: User = Depends(require_admin),
    service: ScheduleService = Depends(get_schedule_service),
) -> list[ScheduleResponse]:
    return service.replace_week_schedule(
        doctor_id, schedules, actor_id=current_user.id
    )
