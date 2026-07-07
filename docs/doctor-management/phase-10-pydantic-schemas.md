# Phase 10: Pydantic Schemas — Doctor Management Module

> **Status:** IN REVIEW | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only schemas for Doctor Profile, Specialization, and Schedule management.

---

## 1. Design Patterns

Following the existing DensCare pattern from `patients/schemas.py` and `auth/schemas.py`:

- **Request schemas:** `ConfigDict(extra="forbid")` — reject unknown fields
- **Response schemas:** `ConfigDict(from_attributes=True)` — ORM to schema
- **Field validators:** `@field_validator` for text normalization (strip, collapse whitespace)
- **Email validation:** `EmailStr` from Pydantic
- **Phone validation:** regex pattern with `@field_validator`
- **Optional fields:** Use `| None = None` for PATCH semantics

---

## 2. Request Schemas

### 2.1 DoctorCreate

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator, EmailStr
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID


class DoctorCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int = Field(gt=0)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None  # Validated against GenderEnum
    primary_phone: str = Field(min_length=10, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    qualification: Optional[str] = Field(None, max_length=500)
    registration_number: Optional[str] = Field(None, max_length=100)
    years_of_experience: Optional[int] = Field(None, ge=0, le=50)
    consultation_fee: Optional[Decimal] = Field(None, gt=0)
    consultation_duration: Optional[int] = Field(None, ge=15, le=240)
    languages_known: Optional[list[str]] = None
    profile_photo_url: Optional[str] = Field(None, max_length=500)
    biography: Optional[str] = Field(None, max_length=2000)
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)

    @field_validator("primary_phone", "emergency_contact_phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        import re
        if not re.match(r"^\+?[1-9]\d{9,14}$", v):
            raise ValueError("Invalid phone number format")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is None:
            return None
        allowed = {"male", "female", "other"}
        if v.lower() not in allowed:
            raise ValueError(f"Gender must be one of: {', '.join(allowed)}")
        return v.lower()

    @field_validator("registration_number")
    @classmethod
    def normalize_registration(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip().upper()
```

### 2.2 DoctorUpdate

All fields optional for PATCH semantics.

```python
class DoctorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    primary_phone: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = Field(None, max_length=500)
    qualification: Optional[str] = Field(None, max_length=500)
    registration_number: Optional[str] = Field(None, max_length=100)
    years_of_experience: Optional[int] = Field(None, ge=0, le=50)
    consultation_fee: Optional[Decimal] = Field(None, gt=0)
    consultation_duration: Optional[int] = Field(None, ge=15, le=240)
    languages_known: Optional[list[str]] = None
    profile_photo_url: Optional[str] = Field(None, max_length=500)
    biography: Optional[str] = Field(None, max_length=2000)
    emergency_contact_name: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=20)
    # Reuse validators from DoctorCreate
```

### 2.3 Specialization Schemas

```python
class SpecializationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=2, max_length=20)
    description: Optional[str] = Field(None, max_length=500)


class DoctorSpecializationAssign(BaseModel):
    model_config = ConfigDict(extra="forbid")

    specialization_id: int = Field(gt=0)
    is_primary: bool = False
    certification_date: Optional[date] = None
```

### 2.4 Schedule Schemas

```python
from datetime import time


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day_of_week: int = Field(ge=0, le=5)
    start_time: time
    end_time: time

    @field_validator("end_time")
    @classmethod
    def validate_end_after_start(cls, v: time, info) -> time:
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


class ScheduleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day_of_week: Optional[int] = Field(None, ge=0, le=5)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None
```

### 2.5 Status Toggle Schemas

```python
class DoctorAvailabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    available: bool


class DoctorLeaveToggle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    on_leave: bool
```

---

## 3. Response Schemas

### 3.1 DoctorResponse

```python
class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    doctor_code: str
    user_id: int
    user_full_name: Optional[str] = None  # Computed from User
    user_email: Optional[str] = None      # From User
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    primary_phone: str
    address: Optional[str] = None
    qualification: Optional[str] = None
    registration_number: Optional[str] = None
    years_of_experience: Optional[int] = None
    consultation_fee: Optional[Decimal] = None
    consultation_duration: Optional[int] = None
    languages_known: Optional[list[str]] = None
    profile_photo_url: Optional[str] = None
    biography: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    available_for_appointment: bool
    on_leave: bool
    is_active: bool
    specializations: list[DoctorSpecializationResponse] = []
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
```

### 3.2 DoctorListResponse

```python
class DoctorListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[DoctorResponse]
    total: int
    page: int
    page_size: int
```

### 3.3 DoctorAvailabilityResponse

```python
class DoctorAvailabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    is_active: bool
    available_for_appointment: bool
    on_leave: bool
    available: bool  # Computed: is_active AND available_for_appointment AND NOT on_leave
```

### 3.4 Specialization Response Schemas

```python
class SpecializationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool


class DoctorSpecializationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    specialization_id: int
    specialization_name: str
    specialization_code: str
    is_primary: bool
    certification_date: Optional[date] = None
```

### 3.5 Schedule Response Schema

```python
class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    doctor_id: UUID
    day_of_week: int
    start_time: time
    end_time: time
    is_active: bool
```

### 3.6 DoctorProfileResponse

Extended profile for self-view (returned by `GET /doctors/{id}/profile`). Includes all `DoctorResponse` fields plus the `schedules` array.

```python
class DoctorProfileResponse(DoctorResponse):
    """DoctorResponse plus schedules array for self-view."""
    schedules: list[ScheduleResponse] = []
```

> **Computed field strategy for `user_full_name` and `user_email`:**
>
> These fields are NOT columns on the `doctors` table — they belong to the `User` entity (accessed via `doctor.user.full_name` and `doctor.user.email`). Because `DoctorResponse` uses `from_attributes=True`, direct ORM-to-schema validation (`DoctorResponse.model_validate(doctor)`) cannot populate these fields automatically since they are not direct column attributes.
>
> Two approaches are available:
>
> **Approach A — Mapper function (recommended for MVP, matches existing DensCare pattern):**
> The mapper layer (Phase 3 §2.6) is responsible for constructing `DoctorResponse` objects from ORM models. After calling `model_validate(doctor)`, the mapper explicitly sets:
> ```python
> response.user_full_name = doctor.user.full_name
> response.user_email = doctor.user.email
> ```
> This is the same approach used by the existing Patient and Appointment modules for computed fields.
>
> **Approach B — `@computed_field` decorator:**
> Pydantic v2's `@computed_field` (PEP 593) can derive these values automatically:
> ```python
> from pydantic import computed_field
>
> class DoctorResponse(BaseModel):
>     model_config = ConfigDict(from_attributes=True)
>     ...
>
>     @computed_field
>     @property
>     def user_full_name(self) -> str | None:
>         return self.user.full_name if self.user else None
> ```
> This approach is cleaner but introduces coupling between the response schema and ORM relationship traversal. It also requires the ORM instance to be available after validation, which is not supported when using `from_attributes=True` — the validated object is a Pydantic model, not an ORM instance.
>
> **Decision:** **Approach A (Mapper)** is recommended for the MVP to maintain consistency with the existing DensCare module pattern. The mapper layer remains the single point of responsibility for resolving User-derived fields.

---

## 4. Schema Mapping

| Layer | Input Schema | Output Schema |
|---|---|---|
| POST /doctors | DoctorCreate | DoctorResponse |
| GET /doctors | — | DoctorListResponse |
| GET /doctors/{id} | — | DoctorResponse |
| PATCH /doctors/{id} | DoctorUpdate | DoctorResponse |
| PATCH .../deactivate | — | DoctorResponse |
| PATCH .../activate | — | DoctorResponse |
| PATCH .../availability | DoctorAvailabilityUpdate | DoctorResponse |
| PATCH .../leave-toggle | DoctorLeaveToggle | DoctorResponse |
| GET /doctors/{id}/profile | — | DoctorProfileResponse |
| GET .../availability | — | DoctorAvailabilityResponse |
| GET /specializations | — | list[SpecializationResponse] |
| POST /specializations | SpecializationCreate | SpecializationResponse |
| POST .../specializations | DoctorSpecializationAssign | DoctorSpecializationResponse |
| POST .../schedules | ScheduleCreate | ScheduleResponse |
| PATCH .../schedules/{sid} | ScheduleUpdate | ScheduleResponse |

---

## 5. Schemas Explicitly Excluded from MVP

| Schema | Feature | Future Phase |
|---|---|---|
| `CredentialCreate / CredentialResponse` | Credential management | Phase 18 |
| `LeaveCreate / LeaveResponse` | Leave management | Phase 18 |
| `LeaveApproval` | Leave approval workflow | Phase 18 |
| `CommissionCreate / CommissionResponse` | Commission configuration | Phase 18 |
| `PerformanceMetricResponse` | Performance analytics | Phase 18 |
