# Phase 16: Router Design — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only router endpoints for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Design Patterns

Following `patients/routes.py` and `doctors/routes.py`:

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
from uuid import UUID

from app.database.session import get_db
from app.modules.rbac.permissions import require_roles
from app.modules.auth.models import User
from app.core.constants import (
    ROLE_ADMIN, ROLE_CHIEF_DOCTOR, DOCTOR_ROLES,
)

router = APIRouter(prefix="/treatment-plans", tags=["Treatment Plans"])
procedures_router = APIRouter(prefix="/procedures", tags=["Procedures"])
```

---

## 3. Exception Mapping

```python
EXCEPTION_MAP = {
    PlanNotFound: (status.HTTP_404_NOT_FOUND, "Treatment plan not found"),
    DuplicatePlanDetected: (status.HTTP_409_CONFLICT, "Duplicate treatment plan"),
    PlanCreationFailed: (status.HTTP_500_INTERNAL_SERVER_ERROR, "Creation failed"),
    PlanUpdateFailed: (status.HTTP_500_INTERNAL_SERVER_ERROR, "Update failed"),
    PlanValidationFailed: (status.HTTP_422_UNPROCESSABLE_ENTITY, "Validation failed"),
    InvalidPlanOperation: (status.HTTP_409_CONFLICT, "Invalid plan operation"),
    PlanNotEditable: (status.HTTP_409_CONFLICT, "Plan not editable in current status"),
    EmptyPlanTransition: (status.HTTP_409_CONFLICT, "Plan has no items"),
    PlanNotDeletable: (status.HTTP_409_CONFLICT, "Only draft plans can be deleted"),
    ItemNotFound: (status.HTTP_404_NOT_FOUND, "Item not found"),
    DuplicateItemSequence: (status.HTTP_409_CONFLICT, "Duplicate sequence number"),
    InvalidItemStatusTransition: (status.HTTP_409_CONFLICT, "Invalid item status transition"),
    ProcedureNotFound: (status.HTTP_404_NOT_FOUND, "Procedure not found"),
    DuplicateProcedureDetected: (status.HTTP_409_CONFLICT, "Duplicate procedure code"),
    InvalidToothNumber: (status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid tooth number"),
    InvalidDateRange: (status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid date range"),
    VersionNotFound: (status.HTTP_404_NOT_FOUND, "Version not found"),
    VersionImmutable: (status.HTTP_409_CONFLICT, "Version snapshots cannot be modified"),
    ApprovalNotFound: (status.HTTP_404_NOT_FOUND, "Approval not found"),
    PlanAlreadyApproved: (status.HTTP_409_CONFLICT, "Doctor already approved"),
    PatientAcknowledgmentExists: (status.HTTP_409_CONFLICT, "Patient acknowledgment exists"),
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
from app.modules.treatment.service import TreatmentPlanService


def get_treatment_plan_service(db: Session = Depends(get_db)) -> TreatmentPlanService:
    return TreatmentPlanService(db)


# Role-based auth dependencies
require_admin_or_chief = require_roles([ROLE_ADMIN, ROLE_CHIEF_DOCTOR])
require_doctor_role = require_roles(list(DOCTOR_ROLES))
require_clinical_role = require_roles([
    ROLE_ADMIN, ROLE_CHIEF_DOCTOR, *DOCTOR_ROLES, ROLE_RECEPTIONIST
])
require_doctor_or_admin = require_roles([
    ROLE_ADMIN, ROLE_CHIEF_DOCTOR, *DOCTOR_ROLES
])


def _get_doctor_by_user_id(user_id: int, db: Session) -> Doctor | None:
    """
    Resolve a Doctor profile from a User ID.

    Wraps DoctorRepository.get_by_user_id() to avoid circular imports.
    The Doctor Management module stores doctor profiles in the ``doctors``
    table with ``user_id`` referencing ``users.id``.
    """
    from app.modules.doctors.repositories.doctor_repository import DoctorRepository
    return DoctorRepository(db).get_by_user_id(user_id)


def plan_owner_or_admin(
    plan_id: UUID,
    current_user: User = Depends(require_doctor_or_admin),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    db: Session = Depends(get_db),
) -> User:
    """Two-step auth: role check + owner check."""
    if current_user.role.name in {ROLE_ADMIN, ROLE_CHIEF_DOCTOR}:
        return current_user
    plan = service.get_plan(plan_id)
    doctor = _get_doctor_by_user_id(current_user.id, db)
    if not doctor or plan.doctor_id != doctor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SELF_SERVICE_NOT_ALLOWED",
        )
    return current_user
```

---

## 5. Endpoint Definitions

### 5.1 Treatment Plan CRUD Endpoints

```python
@router.post("", response_model=TreatmentPlanResponse, status_code=201)
def create_treatment_plan(
    payload: TreatmentPlanCreate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(require_doctor_role),
):
    try:
        return service.create_plan(payload, created_by=current_user.id)
    except Exception as exc:
        handle_exception(exc)


@router.get("", response_model=TreatmentPlanListResponse)
def list_treatment_plans(
    search: str | None = None,
    patient_id: UUID | None = None,
    doctor_id: UUID | None = None,
    status: str | None = None,
    is_active: bool | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    plans, total = service.list_plans(
        search=search, patient_id=patient_id, doctor_id=doctor_id,
        status=status, is_active=is_active,
        date_from=date_from, date_to=date_to,
        page=page, page_size=page_size,
        sort_by=sort_by, sort_order=sort_order,
    )
    return TreatmentPlanMapper.to_list_response(plans, total, page, page_size)


@router.get("/{plan_id}", response_model=TreatmentPlanDetailResponse)
def get_treatment_plan(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    try:
        plan = service.get_plan(plan_id)
        return TreatmentPlanMapper.to_detail_response(plan)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{plan_id}", response_model=TreatmentPlanResponse)
def update_treatment_plan(
    plan_id: UUID,
    payload: TreatmentPlanUpdate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        plan = service.update_plan(plan_id, payload, updated_by=current_user.id)
        return TreatmentPlanMapper.to_response(plan)
    except Exception as exc:
        handle_exception(exc)


@router.delete("/{plan_id}", status_code=204)
def delete_treatment_plan(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        service.delete_plan(plan_id)
    except Exception as exc:
        handle_exception(exc)
```

### 5.2 Status & Active Endpoints

```python
@router.patch("/{plan_id}/status", response_model=TreatmentPlanResponse)
def transition_plan_status(
    plan_id: UUID,
    payload: PlanStatusUpdate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        plan = service.transition_status(plan_id, payload.status, updated_by=current_user.id)
        return TreatmentPlanMapper.to_response(plan)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{plan_id}/deactivate", response_model=TreatmentPlanResponse)
def deactivate_plan(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(require_admin_or_chief),
):
    try:
        plan = service.deactivate_plan(plan_id, updated_by=current_user.id)
        return TreatmentPlanMapper.to_response(plan)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{plan_id}/activate", response_model=TreatmentPlanResponse)
def activate_plan(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(require_admin_or_chief),
):
    try:
        plan = service.activate_plan(plan_id, updated_by=current_user.id)
        return TreatmentPlanMapper.to_response(plan)
    except Exception as exc:
        handle_exception(exc)
```

### 5.3 Item Endpoints

```python
@router.get("/{plan_id}/items", response_model=list[ItemResponse])
def list_items(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    try:
        plan = service.get_plan(plan_id)
        items = service.item_repo.get_by_plan(plan_id)
        return [ItemMapper.to_response(item) for item in items]
    except Exception as exc:
        handle_exception(exc)


@router.post("/{plan_id}/items", response_model=ItemResponse, status_code=201)
def add_item(
    plan_id: UUID,
    payload: ItemCreate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        item = service.add_item(plan_id, payload, current_user.id)
        return ItemMapper.to_response(item)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{plan_id}/items/{item_id}", response_model=ItemResponse)
def update_item(
    plan_id: UUID,
    item_id: UUID,
    payload: ItemUpdate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        item = service.update_item(plan_id, item_id, payload)
        return ItemMapper.to_response(item)
    except Exception as exc:
        handle_exception(exc)


@router.delete("/{plan_id}/items/{item_id}", status_code=204)
def remove_item(
    plan_id: UUID,
    item_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        service.remove_item(plan_id, item_id)
    except Exception as exc:
        handle_exception(exc)


@router.patch("/{plan_id}/items/{item_id}/status", response_model=ItemResponse)
def update_item_status(
    plan_id: UUID,
    item_id: UUID,
    payload: ItemStatusUpdate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(require_doctor_or_admin),
):
    try:
        item = service.update_item_status(plan_id, item_id, payload)
        return ItemMapper.to_response(item)
    except Exception as exc:
        handle_exception(exc)


@router.post("/{plan_id}/items/reorder", response_model=list[ItemResponse])
def reorder_items(
    plan_id: UUID,
    payload: ReorderRequest,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(plan_owner_or_admin),
):
    try:
        items = service.reorder_items(plan_id, payload.item_ids)
        return [ItemMapper.to_response(item) for item in items]
    except Exception as exc:
        handle_exception(exc)
```

### 5.4 Version Endpoints

```python
@router.get("/{plan_id}/versions", response_model=list[VersionSummaryResponse])
def list_versions(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    try:
        versions = service.get_versions(plan_id)
        return [VersionMapper.to_summary(v) for v in versions]
    except Exception as exc:
        handle_exception(exc)


@router.get("/{plan_id}/versions/{version_id}", response_model=VersionDetailResponse)
def get_version(
    plan_id: UUID,
    version_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    try:
        version = service.get_version(plan_id, version_id)
        return VersionMapper.to_detail(version)
    except Exception as exc:
        handle_exception(exc)
```

### 5.5 Approval Endpoints

```python
@router.get("/{plan_id}/approval", response_model=ApprovalResponse)
def get_approval(
    plan_id: UUID,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    try:
        return service.get_approval(plan_id)
    except Exception as exc:
        handle_exception(exc)


@router.post("/{plan_id}/approval/doctor", response_model=ApprovalResponse, status_code=201)
def record_doctor_approval(
    plan_id: UUID,
    payload: DoctorApprovalRequest,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(require_doctor_or_admin),
):
    try:
        return service.record_doctor_approval(plan_id, payload, approved_by=current_user.id)
    except Exception as exc:
        handle_exception(exc)


@router.post("/{plan_id}/approval/patient", response_model=ApprovalResponse, status_code=201)
def record_patient_acknowledgment(
    plan_id: UUID,
    payload: PatientAcknowledgmentRequest,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(require_doctor_or_admin),
):
    try:
        return service.record_patient_acknowledgment(plan_id, payload)
    except Exception as exc:
        handle_exception(exc)
```

### 5.6 Procedure Endpoints

```python
@procedures_router.get("", response_model=list[ProcedureResponse])
def list_procedures(
    active_only: bool = Query(default=True),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_clinical_role),
):
    return service.list_procedures(active_only=active_only)


@procedures_router.post("", response_model=ProcedureResponse, status_code=201)
def create_procedure(
    payload: ProcedureCreate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_admin_or_chief),
):
    try:
        return service.create_procedure(payload)
    except Exception as exc:
        handle_exception(exc)


@procedures_router.patch("/{procedure_id}", response_model=ProcedureResponse)
def update_procedure(
    procedure_id: int,
    payload: ProcedureUpdate,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    _: User = Depends(require_admin_or_chief),
):
    try:
        return service.update_procedure(procedure_id, payload)
    except Exception as exc:
        handle_exception(exc)
```

---

## 6. Main App Registration

In `backend/app/main.py`:

```python
from app.modules.treatment.router import router as treatment_router, procedures_router

app.include_router(treatment_router)
app.include_router(procedures_router)
```

---

## 7. Endpoints Excluded from MVP

| Endpoint | Feature | Future Phase |
|---|---|---|
| `POST /treatment-plans/{id}/payment-plan` | Payment schedule generation | Phase 18 |
| `POST /treatment-plans/{id}/insurance-claim` | Insurance claims | Phase 18 |
| `POST /treatment-plans/{id}/outcomes` | Treatment outcomes | Phase 18 |
| `POST /treatment-plans/{id}/attachments` | Document management | Phase 18 |

---

## 8. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [15-mappers-schemas.md](15-mappers-schemas.md) (schemas), [14-service-design.md](14-service-design.md) (service), [06-security-rbac.md](06-security-rbac.md) (auth) |
| **Related** | [05-api-design.md](05-api-design.md) (API contract), [09-exception-design.md](09-exception-design.md) (exception mapping) |
| **Depends On** | [14-service-design.md](14-service-design.md) for service methods, [06-security-rbac.md](06-security-rbac.md) for auth dependencies |
| **Used By** | [17-testing-strategy.md](17-testing-strategy.md) (routers tested), [main.py](backend/app/main.py) (app registration) |
| **Next Reading** | [17-testing-strategy.md](17-testing-strategy.md) |
