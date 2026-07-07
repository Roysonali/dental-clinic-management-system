# Phase 14: Router Layer — Doctor Management Module

> **Status:** IN REVIEW | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only router endpoints for Doctor Profile, Specialization, and Schedule management.

---

## 1. Design Patterns

Following `patients/routes.py` and `appointments/router.py`:

- FastAPI `APIRouter` with prefix and tags
- Dependency injection for `db: Session` and `current_user: User`
- `require_roles()` for authorization
- Service construction via factory function
- Domain exception → HTTP exception mapping
- Pydantic response model annotations

---

## 2. Router Configuration

```python
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.modules.rbac.permissions import require_roles
from app.modules.auth.models import User

router = APIRouter(prefix="/doctors", tags=["Doctors"])
specializations_router = APIRouter(prefix="/specializations", tags=["Specializations"])
```

---

## 3. Exception Mapping

```python
EXCEPTION_MAP = {
    DoctorNotFound: (status.HTTP_404_NOT_FOUND, "Doctor not found"),
    DuplicateDoctorDetected: (status.HTTP_409_CONFLICT, "Duplicate doctor"),
    NotADoctorUser: (status.HTTP_422_UNPROCESSABLE_ENTITY, "User is not a doctor"),
    UserNotFound: (status.HTTP_404_NOT_FOUND, "User not found"),
    DoctorValidationFailed: (status.HTTP_422_UNPROCESSABLE_ENTITY, "Validation failed"),
    InvalidDoctorOperation: (status.HTTP_409_CONFLICT, "Invalid operation"),
    ScheduleOverlap: (status.HTTP_409_CONFLICT, "Schedule overlap detected"),
    SpecializationNotFound: (status.HTTP_404_NOT_FOUND, "Specialization not found"),
    ScheduleNotFound: (status.HTTP_404_NOT_FOUND, "Schedule not found"),
    DoctorUpdateFailed: (status.HTTP_500_INTERNAL_SERVER_ERROR, "Update failed"),
    DoctorCreationFailed: (status.HTTP_500_INTERNAL_SERVER_ERROR, "Creation failed"),
}


def handle_exception(exc: Exception) -> None:
    """Map domain exceptions to HTTP exceptions."""
    for exc_type, (status_code, message) in EXCEPTION_MAP.items():
        if isinstance(exc, exc_type):
            raise HTTPException(status_code=status_code, detail=str(exc) or message)
    raise HTTPException(status_code=500, detail="Internal server error")
```

---

## 4. Dependency Injection

```python
def get_doctor_service(db: Session = Depends(get_db)) -> DoctorService:
    return DoctorService(db)


# Role-based auth dependencies
from app.core.constants import (
    ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR, ROLE_RECEPTIONIST,
    DOCTOR_ROLES,
)
require_admin_or_chief = require_roles([ROLE_ADMIN, ROLE_CHIEF_DOCTOR])
require_clinical_role = require_roles([
    ROLE_ADMIN, ROLE_CHIEF_DOCTOR, ROLE_GENERAL_DOCTOR,
    ROLE_SPECIALIST_DOCTOR, ROLE_CONSULTING_DOCTOR, ROLE_RECEPTIONIST
])
require_doctor_role = require_roles(list(DOCTOR_ROLES))


def doctor_owner_or_admin(
    doctor_id: UUID,
    current_user: User = Depends(require_roles(
        [ROLE_ADMIN, ROLE_CHIEF_DOCTOR, *DOCTOR_ROLES],
    )),
    service: DoctorService = Depends(get_doctor_service),
) -> User:
    """Return current_user if admin/chief or the profile owner.
    
    Two-step auth:
    1. require_roles() checks role membership (Admin, Chief Doctor, or any Doctor role)
    2. Owner check: Admin and Chief Doctor bypass; other doctors must own the profile
    
    The role list includes ROLE_ADMIN and ROLE_CHIEF_DOCTOR because require_roles()
    runs BEFORE the owner-check body. Without them, Admin users would be rejected
    at the role check stage and never reach the admin-bypass logic.
    """
    if current_user.role.name in {ROLE_ADMIN, ROLE_CHIEF_DOCTOR}:
        return current_user
    # Check if the doctor profile's user_id matches current user
    doctor = service.get_doctor(doctor_id)
    if doctor.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SELF_SERVICE_NOT_ALLOWED",
        )
    return current_user
```

---

## 5. Endpoint Definitions

### 5.1 Doctor Profile Endpoints

```python
@router.post("", response_model=DoctorResponse, status_code=201)
def create_doctor(
    payload: DoctorCreate,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(require_admin_or_chief),
):
    try:
        return service.create_doctor(payload, created_by=current_user.id)
    except Exception as exc:
        handle_exception(exc)


@router.get("", response_model=DoctorListResponse)
def list_doctors(
    search: str | None = None,
    specialization_id: int | None = None,
    is_active: bool | None = None,
    available: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="full_name"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$"),
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_clinical_role),
):
    doctors, total = service.list_doctors(
        search=search,
        specialization_id=specialization_id,
        is_active=is_active,
        available=available,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return DoctorListResponse(
        items=[DoctorResponse.model_validate(d) for d in doctors],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{doctor_id}", response_model=DoctorResponse)
def get_doctor(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_clinical_role),
):
    try:
        return service.get_doctor(doctor_id)
    except Exception as exc:
        handle_exception(exc)


@router.get("/{doctor_id}/profile", response_model=DoctorProfileResponse)
def get_doctor_profile(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    """
    Get own detailed profile including schedules.
    Returns DoctorResponse fields plus schedules array.
    Auth: Admin/Chief Doctor (any profile), Doctor (own profile only).
    """
    try:
        return service.get_doctor_profile(doctor_id)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{doctor_id}", response_model=DoctorResponse)
def update_doctor(
    doctor_id: UUID,
    payload: DoctorUpdate,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(require_admin_or_chief),
):
    try:
        return service.update_doctor(doctor_id, payload, updated_by=current_user.id)
    except Exception as exc:
        handle_exception(exc)
```

### 5.2 Status Endpoints

```python
@router.patch("/{doctor_id}/deactivate", response_model=DoctorResponse)
def deactivate_doctor(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(require_admin_or_chief),
):
    try:
        return service.change_status(doctor_id, is_active=False, updated_by=current_user.id)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{doctor_id}/activate", response_model=DoctorResponse)
def activate_doctor(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(require_admin_or_chief),
):
    try:
        return service.change_status(doctor_id, is_active=True, updated_by=current_user.id)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{doctor_id}/availability", response_model=DoctorResponse)
def toggle_availability(
    doctor_id: UUID,
    payload: DoctorAvailabilityUpdate,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    try:
        service.toggle_availability(doctor_id, payload.available)
        return service.get_doctor(doctor_id)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{doctor_id}/leave-toggle", response_model=DoctorResponse)
def toggle_leave(
    doctor_id: UUID,
    payload: DoctorLeaveToggle,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    try:
        service.toggle_leave(doctor_id, payload.on_leave)
        return service.get_doctor(doctor_id)
    except Exception as exc:
        handle_exception(exc)


@router.get("/{doctor_id}/availability", response_model=DoctorAvailabilityResponse)
def check_availability(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_clinical_role),
):
    try:
        return service.check_availability(doctor_id)
    except Exception as exc:
        handle_exception(exc)
```

### 5.3 Specialization Endpoints

Specialization management endpoints are defined on a separate router (`specializations_router`) with prefix `/specializations`, distinct from the doctor profile router. Doctor-specific specialization assignment endpoints remain on the `doctors_router`.

```python
# ---- Specializations Router (prefix=/specializations) ----
specializations_router = APIRouter(prefix="/specializations", tags=["Specializations"])


@specializations_router.get("", response_model=list[SpecializationResponse])
def list_specializations(
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_clinical_role),
):
    return service.list_active_specializations()


@specializations_router.post("", response_model=SpecializationResponse, status_code=201)
def create_specialization(
    payload: SpecializationCreate,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_admin_or_chief),
):
    try:
        specialization = service.create_specialization(payload)
        return specialization
    except Exception as exc:
        handle_exception(exc)
```

```python
# ---- Doctor-specific specialization endpoints (on doctors router) ----
# These remain on the doctors router because they operate within the DoctorProfile aggregate

@router.get("/{doctor_id}/specializations", response_model=list[DoctorSpecializationResponse])
def get_doctor_specializations(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_clinical_role),
):
    try:
        return service.get_doctor_specializations(doctor_id)
    except Exception as exc:
        handle_exception(exc)


@router.post("/{doctor_id}/specializations", response_model=DoctorSpecializationResponse, status_code=201)
def assign_specialization(
    doctor_id: UUID,
    payload: DoctorSpecializationAssign,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_admin_or_chief),
):
    try:
        return service.assign_specialization(doctor_id, payload)
    except Exception as exc:
        handle_exception(exc)


@router.delete("/{doctor_id}/specializations/{specialization_id}", status_code=204)
def remove_specialization(
    doctor_id: UUID,
    specialization_id: int,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_admin_or_chief),
):
    try:
        service.remove_specialization(doctor_id, specialization_id)
    except Exception as exc:
        handle_exception(exc)


@router.put("/{doctor_id}/specializations/primary/{specialization_id}", status_code=204)
def set_primary_specialization(
    doctor_id: UUID,
    specialization_id: int,
    service: DoctorService = Depends(get_doctor_service),
    _: User = Depends(require_admin_or_chief),
):
    try:
        service.set_primary_specialization(doctor_id, specialization_id)
    except Exception as exc:
        handle_exception(exc)
```

### 5.4 Schedule Endpoints

```python
@router.get("/{doctor_id}/schedules", response_model=list[ScheduleResponse])
def get_schedules(
    doctor_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    try:
        return service.get_doctor_schedules(doctor_id)
    except Exception as exc:
        handle_exception(exc)


@router.post("/{doctor_id}/schedules", response_model=ScheduleResponse, status_code=201)
def create_schedule(
    doctor_id: UUID,
    payload: ScheduleCreate,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    try:
        return service.create_schedule(doctor_id, payload)
    except Exception as exc:
        handle_exception(exc)


@router.delete("/{doctor_id}/schedules/{schedule_id}", status_code=204)
def delete_schedule(
    doctor_id: UUID,
    schedule_id: UUID,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    try:
        service.delete_schedule(schedule_id)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{doctor_id}/schedules/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    doctor_id: UUID,
    schedule_id: UUID,
    payload: ScheduleUpdate,
    service: DoctorService = Depends(get_doctor_service),
    current_user: User = Depends(doctor_owner_or_admin),
):
    try:
        return service.update_schedule(schedule_id, payload, doctor_id)
    except Exception as exc:
        handle_exception(exc)
```

---

## 6. Main App Registration

In `backend/app/main.py`:

```python
from app.modules.doctors.router import router as doctors_router, specializations_router

# Register Doctor Management routes (prefix from router definition)
app.include_router(doctors_router)
app.include_router(specializations_router)
```

---

## 7. Endpoints Excluded from MVP

| Endpoint | Feature | Future Phase |
|---|---|---|
| `GET/POST /doctors/{id}/credentials` | Credential management | Phase 18 |
| `DELETE /doctors/{id}/credentials/{cid}` | Credential removal | Phase 18 |
| `GET/POST /doctors/{id}/leaves` | Leave management | Phase 18 |
| `PATCH /doctors/{id}/leaves/{lid}/approve` | Leave approval | Phase 18 |
| `GET/POST /doctors/{id}/commissions` | Commission config | Phase 18 |
| `GET /doctors/{id}/performance` | Performance analytics | Phase 18 |
| `GET /doctors/analytics/*` | Dashboards | Phase 18 |
