# Phase 15: Mappers & Schemas — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only schemas for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Design Patterns

Following the existing DensCare pattern from `patients/schemas.py` and `patients/mapper.py`:

- **Request schemas:** `ConfigDict(extra="forbid")` — reject unknown fields
- **Response schemas:** `ConfigDict(from_attributes=True)` — ORM to schema
- **Field validators:** `@field_validator` for text normalization (strip, collapse whitespace)
- **Optional fields:** Use `| None = None` for PATCH semantics
- **Mapper:** Static methods for ORM → Response transformation, avoiding `model_validate` for computed fields

> **Note on ID types in responses:** The Treatment Plan module uses `UUID` type directly in response schemas (e.g., `id: UUID`), unlike the existing Patient module which converts to `str` in the mapper (`id=str(patient.id)`). Both approaches are valid — FastAPI serializes UUIDs as strings in JSON output automatically via Pydantic v2. The `UUID` type is preferred here for type safety and consistency with the database layer.

---

## 2. Request Schemas

### 2.1 TreatmentPlanCreate

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID


class TreatmentPlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: UUID
    doctor_id: UUID
    clinical_notes: Optional[str] = Field(None, max_length=5000)
    observations: Optional[str] = Field(None, max_length=5000)
    dentist_recommendations: Optional[str] = Field(None, max_length=5000)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    diagnosis_ids: Optional[list[UUID]] = None
```

### 2.2 TreatmentPlanUpdate

```python
class TreatmentPlanUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clinical_notes: Optional[str] = Field(None, max_length=5000)
    observations: Optional[str] = Field(None, max_length=5000)
    dentist_recommendations: Optional[str] = Field(None, max_length=5000)
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None

    @field_validator("valid_from", "valid_to")
    @classmethod
    def normalize_date(cls, v: date | None) -> date | None:
        if v is None:
            return None
        return v
```

### 2.3 PlanStatusUpdate

```python
class PlanStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(min_length=1, max_length=20)
```

### 2.4 Item Schemas

```python
class ItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    procedure_id: int = Field(gt=0)
    sequence_number: int = Field(ge=1, le=999)
    tooth_number: Optional[int] = Field(None, ge=11, le=85)
    tooth_surface: Optional[str] = Field(None, max_length=10)
    quadrant: Optional[str] = Field(None, max_length=5)
    arch: Optional[str] = Field(None, max_length=10)
    estimated_cost: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)
    appointment_id: Optional[UUID] = None
    diagnosis_id: Optional[UUID] = None

    @field_validator("tooth_number")
    @classmethod
    def validate_tooth(cls, v: int | None) -> int | None:
        if v is None:
            return None
        valid_ranges = [(11, 48), (51, 85)]
        if not any(lo <= v <= hi for lo, hi in valid_ranges):
            raise ValueError(
                f"Tooth number {v} is not in valid FDI range (11-48 or 51-85)"
            )
        return v

    @field_validator("tooth_surface")
    @classmethod
    def validate_surface(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.upper().strip()
        valid_single = {"M", "D", "B", "L", "O", "I"}
        valid_multi = {"MO", "OD", "MOD", "OB", "OL", "MB", "ML", "DB", "DL", "BL"}
        if v not in valid_single and v not in valid_multi:
            raise ValueError(f"Invalid tooth surface: {v}")
        return v


class ItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    procedure_id: Optional[int] = Field(None, gt=0)
    sequence_number: Optional[int] = Field(None, ge=1, le=999)
    tooth_number: Optional[int] = Field(None, ge=11, le=85)
    tooth_surface: Optional[str] = Field(None, max_length=10)
    quadrant: Optional[str] = Field(None, max_length=5)
    arch: Optional[str] = Field(None, max_length=10)
    estimated_cost: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=2000)
    appointment_id: Optional[UUID] = None
    diagnosis_id: Optional[UUID] = None


class ItemStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_status: str = Field(min_length=1, max_length=20)


class ReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_ids: list[UUID] = Field(min_length=1)
```

### 2.5 Version Schemas

```python
class VersionCreate(BaseModel):
    """Used by service layer internally — not exposed via API."""
    model_config = ConfigDict(extra="forbid")

    change_reason: str = Field(min_length=1, max_length=500)
```

### 2.6 Approval Schemas

```python
class DoctorApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approval_notes: Optional[str] = Field(None, max_length=500)


class PatientAcknowledgmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_status: str = Field(min_length=1, max_length=20)
    approval_notes: Optional[str] = Field(None, max_length=500)

    @field_validator("patient_status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"accepted", "rejected", "changes_requested"}
        if v not in allowed:
            raise ValueError(f"patient_status must be one of: {', '.join(sorted(allowed))}")
        return v
```

### 2.7 Procedure Schemas

```python
class ProcedureCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    default_cost: Optional[Decimal] = Field(None, ge=0)
    category: str = Field(min_length=1, max_length=30)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("name")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        return v.strip()


class ProcedureUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    default_cost: Optional[Decimal] = Field(None, ge=0)
    category: Optional[str] = Field(None, min_length=1, max_length=30)
    is_active: Optional[bool] = None
```

---

## 3. Response Schemas

### 3.1 TreatmentPlanResponse

```python
class TreatmentPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_code: str
    patient_id: UUID
    patient_name: Optional[str] = None  # Computed from Patient
    doctor_id: UUID
    doctor_name: Optional[str] = None   # Computed from Doctor
    clinical_notes: Optional[str] = None
    observations: Optional[str] = None
    dentist_recommendations: Optional[str] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    status: str
    current_version: int
    items_count: int = 0                 # Computed
    is_active: bool
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
```

### 3.2 TreatmentPlanListItem

```python
class TreatmentPlanListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_code: str
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    status: str
    items_count: int = 0
    current_version: int
    created_at: datetime
```

### 3.3 TreatmentPlanListResponse

```python
class TreatmentPlanListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[TreatmentPlanListItem]
    total: int
    page: int
    page_size: int
```

### 3.4 TreatmentPlanDetailResponse

```python
class TreatmentPlanDetailResponse(TreatmentPlanResponse):
    """Full plan detail with nested items and approval."""
    items: list[ItemResponse] = []
    approval: Optional[ApprovalResponse] = None
```

### 3.5 ItemResponse

```python
class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    procedure_id: int
    procedure_code: Optional[str] = None    # Computed
    procedure_name: Optional[str] = None    # Computed
    sequence_number: int
    tooth_number: Optional[int] = None
    tooth_surface: Optional[str] = None
    quadrant: Optional[str] = None
    arch: Optional[str] = None
    estimated_cost: Optional[Decimal] = None
    discount: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None      # Computed: estimated_cost - discount
    item_status: str
    notes: Optional[str] = None
    appointment_id: Optional[UUID] = None
    diagnosis_id: Optional[UUID] = None
```

### 3.6 Version Response Schemas

```python
class VersionSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    version_number: int
    change_reason: str
    changed_by: Optional[int] = None
    created_at: datetime


class VersionDetailResponse(VersionSummaryResponse):
    """Full version with immutable snapshot."""
    items_snapshot: list[dict] = []
```

### 3.7 ApprovalResponse

```python
class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plan_id: UUID
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    patient_status: str
    patient_acknowledged_at: Optional[datetime] = None
    approval_notes: Optional[str] = None
```

### 3.8 ProcedureResponse

```python
class ProcedureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: Optional[str] = None
    default_cost: Optional[Decimal] = None
    category: str
    is_active: bool
```

---

## 4. Mapper Design

### 4.1 TreatmentPlanMapper

```python
class TreatmentPlanMapper:
    """Maps TreatmentPlan ORM instances to Pydantic response schemas."""

    @staticmethod
    def build_patient_name(plan: TreatmentPlan) -> str | None:
        if plan.patient:
            parts = filter(None, [
                plan.patient.first_name,
                plan.patient.middle_name,
                plan.patient.last_name,
            ])
            return " ".join(parts)
        return None

    @staticmethod
    def build_doctor_name(plan: TreatmentPlan) -> str | None:
        if plan.doctor and plan.doctor.user:
            return plan.doctor.user.full_name
        return None

    @classmethod
    def to_response(cls, plan: TreatmentPlan) -> TreatmentPlanResponse:
        return TreatmentPlanResponse(
            id=plan.id,
            plan_code=plan.plan_code,
            patient_id=plan.patient_id,
            patient_name=cls.build_patient_name(plan),
            doctor_id=plan.doctor_id,
            doctor_name=cls.build_doctor_name(plan),
            clinical_notes=plan.clinical_notes,
            observations=plan.observations,
            dentist_recommendations=plan.dentist_recommendations,
            valid_from=plan.valid_from,
            valid_to=plan.valid_to,
            status=plan.status,
            current_version=plan.current_version,
            items_count=len(plan.items) if plan.items else 0,
            is_active=plan.is_active,
            created_by=plan.created_by,
            updated_by=plan.updated_by,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )

    @classmethod
    def to_list_item(cls, plan: TreatmentPlan) -> TreatmentPlanListItem:
        return TreatmentPlanListItem(
            id=plan.id,
            plan_code=plan.plan_code,
            patient_name=cls.build_patient_name(plan),
            doctor_name=cls.build_doctor_name(plan),
            status=plan.status,
            items_count=len(plan.items) if plan.items else 0,
            current_version=plan.current_version,
            created_at=plan.created_at,
        )

    @classmethod
    def to_list_response(
        cls, plans: list[TreatmentPlan], total: int, page: int, page_size: int
    ) -> TreatmentPlanListResponse:
        return TreatmentPlanListResponse(
            items=[cls.to_list_item(p) for p in plans],
            total=total,
            page=page,
            page_size=page_size,
        )

    @classmethod
    def to_detail_response(cls, plan: TreatmentPlan) -> TreatmentPlanDetailResponse:
        base = cls.to_response(plan)
        return TreatmentPlanDetailResponse(
            **base.model_dump(),
            items=[ItemMapper.to_response(item) for item in (plan.items or [])],
            approval=ApprovalMapper.to_response(plan.approval) if plan.approval else None,
        )
```

### 4.2 ItemMapper

```python
class ItemMapper:
    @staticmethod
    def to_response(item: TreatmentPlanItem) -> ItemResponse:
        return ItemResponse(
            id=item.id,
            plan_id=item.plan_id,
            procedure_id=item.procedure_id,
            procedure_code=item.procedure.code if item.procedure else None,
            procedure_name=item.procedure.name if item.procedure else None,
            sequence_number=item.sequence_number,
            tooth_number=item.tooth_number,
            tooth_surface=item.tooth_surface,
            quadrant=item.quadrant,
            arch=item.arch,
            estimated_cost=item.estimated_cost,
            discount=item.discount,
            subtotal=(item.estimated_cost or 0) - (item.discount or 0),
            item_status=item.item_status,
            notes=item.notes,
            appointment_id=item.appointment_id,
            diagnosis_id=item.diagnosis_id,
        )

    @staticmethod
    def to_item_dict(item: TreatmentPlanItem) -> dict:
        """Serialize item to dict for version snapshot storage."""
        return {
            "id": str(item.id),
            "procedure_id": item.procedure_id,
            "sequence_number": item.sequence_number,
            "tooth_number": item.tooth_number,
            "tooth_surface": item.tooth_surface,
            "estimated_cost": float(item.estimated_cost) if item.estimated_cost else 0,
            "discount": float(item.discount) if item.discount else 0,
            "item_status": item.item_status,
            "notes": item.notes,
        }
```

### 4.3 VersionMapper

```python
class VersionMapper:
    @staticmethod
    def to_summary(version: TreatmentPlanVersion) -> VersionSummaryResponse:
        return VersionSummaryResponse(
            id=version.id,
            plan_id=version.plan_id,
            version_number=version.version_number,
            change_reason=version.change_reason,
            changed_by=version.changed_by,
            created_at=version.created_at,
        )

    @staticmethod
    def to_detail(version: TreatmentPlanVersion) -> VersionDetailResponse:
        return VersionDetailResponse(
            id=version.id,
            plan_id=version.plan_id,
            version_number=version.version_number,
            change_reason=version.change_reason,
            changed_by=version.changed_by,
            created_at=version.created_at,
            items_snapshot=version.items_snapshot or [],
        )
```

### 4.4 ApprovalMapper

```python
class ApprovalMapper:
    @staticmethod
    def to_response(approval: TreatmentPlanApproval) -> ApprovalResponse:
        return ApprovalResponse(
            id=approval.id,
            plan_id=approval.plan_id,
            approved_by=approval.approved_by,
            approved_at=approval.approved_at,
            patient_status=approval.patient_status,
            patient_acknowledged_at=approval.patient_acknowledged_at,
            approval_notes=approval.approval_notes,
        )
```

---

## 5. Schema-Method Mapping

| Layer | Input Schema | Output Schema |
|---|---|---|
| POST /treatment-plans | TreatmentPlanCreate | TreatmentPlanResponse |
| GET /treatment-plans | — | TreatmentPlanListResponse |
| GET /treatment-plans/{id} | — | TreatmentPlanDetailResponse |
| PATCH /treatment-plans/{id} | TreatmentPlanUpdate | TreatmentPlanResponse |
| DELETE /treatment-plans/{id} | — | 204 |
| PATCH .../status | PlanStatusUpdate | TreatmentPlanResponse |
| PATCH .../deactivate | — | TreatmentPlanResponse |
| PATCH .../activate | — | TreatmentPlanResponse |
| GET .../items | — | list[ItemResponse] |
| POST .../items | ItemCreate | ItemResponse |
| PATCH .../items/{id} | ItemUpdate | ItemResponse |
| DELETE .../items/{id} | — | 204 |
| PATCH .../items/{id}/status | ItemStatusUpdate | ItemResponse |
| POST .../items/reorder | ReorderRequest | list[ItemResponse] |
| GET .../versions | — | list[VersionSummaryResponse] |
| GET .../versions/{id} | — | VersionDetailResponse |
| GET .../approval | — | ApprovalResponse |
| POST .../approval/doctor | DoctorApprovalRequest | ApprovalResponse |
| POST .../approval/patient | PatientAcknowledgmentRequest | ApprovalResponse |
| GET /procedures | — | list[ProcedureResponse] |
| POST /procedures | ProcedureCreate | ProcedureResponse |
| PATCH /procedures/{id} | ProcedureUpdate | ProcedureResponse |

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [11-orm-model-design.md](11-orm-model-design.md) (models to map from), [05-api-design.md](05-api-design.md) (API contract) |
| **Related** | [10-architecture-design.md](10-architecture-design.md) (mapper layer), [14-service-design.md](14-service-design.md) (service calls mapper) |
| **Depends On** | [11-orm-model-design.md](11-orm-model-design.md) for ORM model classes with relationships |
| **Used By** | [14-service-design.md](14-service-design.md), [16-router-design.md](16-router-design.md) |
| **Next Reading** | [16-router-design.md](16-router-design.md) |
