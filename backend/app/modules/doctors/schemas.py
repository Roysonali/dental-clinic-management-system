"""
Doctor Management Module - Pydantic v2 Schemas (DTOs).
"""

from __future__ import annotations

import re
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from app.modules.doctors.constants import (
    MAX_CONSULTATION_DURATION,
    MAX_YEARS_EXPERIENCE,
    MIN_CONSULTATION_DURATION,
    MIN_YEARS_EXPERIENCE,
    PHONE_PATTERN,
)
from app.modules.doctors.enums import GenderEnum


# ======================================================================
# Shared Validators Mixin
# ======================================================================


class DoctorValidators:
    """Shared field-level validators reused across create and update schemas.

    Reduces duplication between DoctorCreate and DoctorUpdate
    without requiring a common base class that bundles unrelated fields.
    """

    @field_validator("primary_phone", "emergency_contact_phone", mode="before")
    @classmethod
    def normalize_and_validate_phone(cls, value: str | None) -> str | None:
        """Strip whitespace/dashes and validate format via the module's phone pattern."""
        if value is None:
            return None
        cleaned = re.sub(r"[\s\-\(\)]", "", str(value))
        if not re.match(PHONE_PATTERN, cleaned):
            raise ValueError(
                "Phone must be 10-15 digits, optionally starting with '+' "
                "(e.g. +639171234567)"
            )
        return cleaned

    @field_validator("registration_number", mode="before")
    @classmethod
    def normalize_registration_number(cls, value: str | None) -> str | None:
        """Strip whitespace, uppercase, and validate format (letters, digits, hyphens only)."""
        if value is None:
            return None
        cleaned = str(value).strip().upper()
        if not re.match(r"^[A-Z0-9\-]+$", cleaned):
            raise ValueError(
                "Registration number may only contain uppercase letters, digits, and hyphens "
                "after normalization."
            )
        return cleaned

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def validate_date_of_birth(cls, value: date | None) -> date | None:
        """Reject future dates and implausibly old dates."""
        if value is None:
            return None
        today = date.today()
        if value > today:
            raise ValueError("Date of birth cannot be in the future")
        if value.year < 1900:
            raise ValueError("Invalid date of birth - year must be >= 1900")
        return value

    @field_validator("languages_known", mode="before")
    @classmethod
    def normalize_languages(cls, value: list | None) -> list | None:
        """Trim whitespace, convert to title case, remove duplicates, and reject empty items."""
        if value is None:
            return None
        if not isinstance(value, list):
            raise ValueError("languages_known must be a list of strings")
        seen: set[str] = set()
        result: list[str] = []
        for item in value:
            if not isinstance(item, str):
                raise ValueError("Each language must be a string")
            stripped = item.strip()
            if not stripped:
                raise ValueError("Language names must not be empty or whitespace-only")
            normalized = stripped.title()
            if normalized not in seen:
                seen.add(normalized)
                result.append(normalized)
        return result

    @field_validator("biography", mode="before")
    @classmethod
    def reject_whitespace_only_biography(cls, value: str | None) -> str | None:
        """Reject biography values that are entirely whitespace."""
        if value is None:
            return None
        stripped = str(value).strip()
        if not stripped:
            raise ValueError("Biography must not be whitespace-only")
        return stripped

    @field_validator("qualification", "address", "emergency_contact_name", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Strip leading/trailing whitespace from optional text fields."""
        if value is None:
            return None
        return str(value).strip()


# ======================================================================
# Doctor Request Schemas
# ======================================================================


class DoctorCreate(DoctorValidators, BaseModel):
    """Request body for POST /doctors.

    Creates a new doctor profile linked to an existing User.
    user_id is required (the User must already exist and have
    a DOCTOR-family role). Identity fields (full_name, email) are
    resolved through the User relationship - they are not passed here.
    """

    model_config = ConfigDict(extra="forbid")

    user_id: int = Field(
        gt=0,
        title="User ID",
        description="Foreign key to the existing User with a DOCTOR-family role.",
        examples=[1],
    )

    date_of_birth: Optional[date] = Field(
        default=None,
        title="Date of Birth",
        description="Doctor's date of birth. Must not be a future date.",
        examples=["1985-06-15"],
    )

    gender: Optional[GenderEnum] = Field(
        default=None,
        title="Gender",
        description="Doctor's gender.",
        examples=["male"],
    )

    primary_phone: str = Field(
        min_length=10,
        max_length=20,
        title="Primary Phone",
        description="Primary contact number. 10-15 digits, optional leading '+'.",
        examples=["+639171234567"],
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Address",
        description="Residential or clinic address.",
        examples=["123 Rizal St., Manila"],
    )

    qualification: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Qualification",
        description="Professional qualifications (e.g. DMD, specialty training).",
        examples=["DMD, University of the Philippines"],
    )

    registration_number: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Registration Number",
        description="Professional license / registration ID. Normalized to uppercase letters, digits, and hyphens only.",
        examples=["DEN-2020-12345"],
    )

    years_of_experience: Optional[int] = Field(
        default=None,
        ge=MIN_YEARS_EXPERIENCE,
        le=MAX_YEARS_EXPERIENCE,
        title="Years of Experience",
        description=f"Years in practice ({MIN_YEARS_EXPERIENCE}-{MAX_YEARS_EXPERIENCE}).",
        examples=[10],
    )

    consultation_fee: Optional[Decimal] = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
        multiple_of=Decimal("0.01"),
        title="Consultation Fee",
        description="Fee per consultation session. Must be positive with up to 2 decimal places.",
        examples=[Decimal("800.00")],
    )

    consultation_duration: Optional[int] = Field(
        default=None,
        ge=MIN_CONSULTATION_DURATION,
        le=MAX_CONSULTATION_DURATION,
        title="Consultation Duration (minutes)",
        description=f"Minutes per appointment slot ({MIN_CONSULTATION_DURATION}-{MAX_CONSULTATION_DURATION}).",
        examples=[30],
    )

    languages_known: Optional[list[str]] = Field(
        default=None,
        title="Languages Known",
        description="Languages the doctor speaks (e.g. English, Filipino).",
        examples=[["Filipino", "English"]],
    )

    profile_photo_url: Optional[HttpUrl] = Field(
        default=None,
        title="Profile Photo URL",
        description="URL to the doctor's profile photograph.",
    )

    biography: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Biography",
        description="Professional biography or summary.",
        examples=["Experienced general dentist with 10 years of practice."],
    )

    emergency_contact_name: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Emergency Contact Name",
        description="Name of the person to contact in an emergency.",
        examples=["Maria Dela Cruz"],
    )

    emergency_contact_phone: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=20,
        title="Emergency Contact Phone",
        description="Phone number of the emergency contact.",
        examples=["+639177654321"],
    )


class DoctorUpdate(DoctorValidators, BaseModel):
    """Request body for PATCH /doctors/{id}.

    All fields optional for PATCH semantics. Only provided fields are updated.
    Reuses the exact same validators as DoctorCreate via the shared
    DoctorValidators mixin.
    """

    model_config = ConfigDict(extra="forbid")

    date_of_birth: Optional[date] = Field(
        default=None,
        title="Date of Birth",
        description="Doctor's date of birth. Must not be a future date.",
        examples=["1985-06-15"],
    )

    gender: Optional[GenderEnum] = Field(
        default=None,
        title="Gender",
        description="Doctor's gender.",
        examples=["male"],
    )

    primary_phone: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=20,
        title="Primary Phone",
        description="Primary contact number. 10-15 digits, optional leading '+'.",
        examples=["+639171234567"],
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Address",
        description="Residential or clinic address.",
        examples=["123 Rizal St., Manila"],
    )

    qualification: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Qualification",
        description="Professional qualifications (e.g. DMD, specialty training).",
        examples=["DMD, University of the Philippines"],
    )

    registration_number: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Registration Number",
        description="Professional license / registration ID. Normalized to uppercase letters, digits, and hyphens only.",
        examples=["DEN-2020-12345"],
    )

    years_of_experience: Optional[int] = Field(
        default=None,
        ge=MIN_YEARS_EXPERIENCE,
        le=MAX_YEARS_EXPERIENCE,
        title="Years of Experience",
        description=f"Years in practice ({MIN_YEARS_EXPERIENCE}-{MAX_YEARS_EXPERIENCE}).",
        examples=[10],
    )

    consultation_fee: Optional[Decimal] = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
        multiple_of=Decimal("0.01"),
        title="Consultation Fee",
        description="Fee per consultation session. Must be positive with up to 2 decimal places.",
        examples=[Decimal("800.00")],
    )

    consultation_duration: Optional[int] = Field(
        default=None,
        ge=MIN_CONSULTATION_DURATION,
        le=MAX_CONSULTATION_DURATION,
        title="Consultation Duration (minutes)",
        description=f"Minutes per appointment slot ({MIN_CONSULTATION_DURATION}-{MAX_CONSULTATION_DURATION}).",
        examples=[30],
    )

    languages_known: Optional[list[str]] = Field(
        default=None,
        title="Languages Known",
        description="Languages the doctor speaks (e.g. English, Filipino).",
        examples=[["Filipino", "English"]],
    )

    profile_photo_url: Optional[HttpUrl] = Field(
        default=None,
        title="Profile Photo URL",
        description="URL to the doctor's profile photograph.",
    )

    biography: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Biography",
        description="Professional biography or summary.",
        examples=["Experienced general dentist with 10 years of practice."],
    )

    emergency_contact_name: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Emergency Contact Name",
        description="Name of the person to contact in an emergency.",
        examples=["Maria Dela Cruz"],
    )

    emergency_contact_phone: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=20,
        title="Emergency Contact Phone",
        description="Phone number of the emergency contact.",
        examples=["+639177654321"],
    )


# ======================================================================
# Doctor Status / Toggle Request Schemas
# ======================================================================


class DoctorAvailabilityUpdate(BaseModel):
    """Request body for PATCH /doctors/{id}/availability.

    Toggles the available_for_appointment flag.
    If the doctor is inactive, this toggle is rejected by the service layer.
    """

    model_config = ConfigDict(extra="forbid")

    available: bool = Field(
        title="Available",
        description="Whether the doctor can accept new appointments.",
        examples=[True],
    )


class DoctorLeaveToggle(BaseModel):
    """Request body for PATCH /doctors/{id}/leave-toggle.

    Simple toggle - no approval workflow in MVP.
    """

    model_config = ConfigDict(extra="forbid")

    on_leave: bool = Field(
        title="On Leave",
        description="Whether the doctor is currently on leave.",
        examples=[True],
    )


# ======================================================================
# Doctor List Query Parameters
# ======================================================================


class DoctorListQueryParams(BaseModel):
    """Query parameters for GET /doctors (list/search/filter).

    Supports search by doctor code or user full_name, filter by
    specialization, active status, and availability, plus pagination
    and sorting.
    """

    search: Optional[str] = Field(
        default=None,
        max_length=200,
        title="Search",
        description="Partial match on doctor code or User full_name.",
        examples=["DOC-00001"],
    )

    specialization_id: Optional[int] = Field(
        default=None,
        gt=0,
        title="Specialization ID",
        description="Filter by specialization.",
        examples=[1],
    )

    is_active: Optional[bool] = Field(
        default=None,
        title="Is Active",
        description="Filter by active status.",
    )

    available: Optional[bool] = Field(
        default=None,
        title="Available",
        description="Filter by availability for appointments.",
    )

    page: int = Field(
        default=1,
        ge=1,
        title="Page",
        description="Page number (1-based).",
        examples=[1],
    )

    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        title="Page Size",
        description="Items per page (max 100).",
        examples=[20],
    )

    sort_by: Literal["full_name", "years_of_experience"] = Field(
        default="full_name",
        title="Sort By",
        description="Sort field.",
        examples=["full_name"],
    )

    sort_order: Literal["asc", "desc"] = Field(
        default="asc",
        title="Sort Order",
        description="Sort direction.",
        examples=["asc"],
    )


# ======================================================================
# Specialization Request Schemas
# ======================================================================


class SpecializationCreate(BaseModel):
    """Request body for POST /specializations.

    Creates a new dental specialization in the master list.
    Both name and code must be unique.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=2,
        max_length=100,
        title="Name",
        description="Display name of the specialization.",
        examples=["Orthodontics"],
    )

    code: str = Field(
        min_length=2,
        max_length=20,
        title="Code",
        description="Short code for programmatic reference.",
        examples=["ORTHO"],
    )

    description: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Description",
        description="Optional description of the specialization.",
        examples=["Diagnosis, prevention, and correction of malpositioned teeth."],
    )


class DoctorSpecializationAssign(BaseModel):
    """Request body for POST /doctors/{id}/specializations.

    Assigns a specialization to a doctor. Only one specialization
    per doctor may be primary (enforced at the DB level by a
    PostgreSQL partial unique index).
    """

    model_config = ConfigDict(extra="forbid")

    specialization_id: int = Field(
        gt=0,
        title="Specialization ID",
        description="Foreign key to the specialization being assigned.",
        examples=[1],
    )

    is_primary: bool = Field(
        default=False,
        title="Is Primary",
        description="Whether this is the doctor's primary specialization.",
        examples=[True],
    )

    certification_date: Optional[date] = Field(
        default=None,
        title="Certification Date",
        description="Date when the specialization was certified.",
        examples=["2020-06-15"],
    )


# ======================================================================
# Schedule Request Schemas
# ======================================================================


class ScheduleCreate(BaseModel):
    """Request body for POST /doctors/{id}/schedules.

    Creates a weekly recurring availability template.
    Validation ensures end_time is after start_time.
    Overlap detection is performed by the service layer.
    """

    model_config = ConfigDict(extra="forbid")

    day_of_week: int = Field(
        ge=0,
        le=5,
        title="Day of Week",
        description="0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday.",
        examples=[0],
    )

    start_time: time = Field(
        title="Start Time",
        description="Work day start time (e.g. 09:00).",
        examples=["09:00"],
    )

    end_time: time = Field(
        title="End Time",
        description="Work day end time (e.g. 17:00). Must be after start_time.",
        examples=["17:00"],
    )

    @model_validator(mode="after")
    def validate_end_after_start(self) -> "ScheduleCreate":
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ScheduleUpdate(BaseModel):
    """Request body for PATCH /doctors/{id}/schedules/{sid}.

    All fields optional for partial updates.
    """

    model_config = ConfigDict(extra="forbid")

    day_of_week: Optional[int] = Field(
        default=None,
        ge=0,
        le=5,
        title="Day of Week",
        description="0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday.",
        examples=[2],
    )

    start_time: Optional[time] = Field(
        default=None,
        title="Start Time",
        description="Work day start time.",
        examples=["09:00"],
    )

    end_time: Optional[time] = Field(
        default=None,
        title="End Time",
        description="Work day end time. Must be after start_time if both provided.",
        examples=["17:00"],
    )

    is_active: Optional[bool] = Field(
        default=None,
        title="Is Active",
        description="Whether this schedule entry is active.",
        examples=[True],
    )

    @model_validator(mode="after")
    def validate_end_after_start(self) -> "ScheduleUpdate":
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time when both are provided")
        return self


# ======================================================================
# Response Schemas
# ======================================================================


class DoctorSpecializationResponse(BaseModel):
    """Specialization assignment in a doctor profile response.

    Resolved from the DoctorSpecialization join table, including
    the specialization's name and code for display.
    """

    model_config = ConfigDict(from_attributes=True)

    specialization_id: int = Field(
        title="Specialization ID",
        description="Foreign key to the specialization.",
        examples=[1],
    )

    specialization_name: str = Field(
        title="Specialization Name",
        description="Display name resolved from the Specialization table.",
        examples=["Orthodontics"],
    )

    specialization_code: str = Field(
        title="Specialization Code",
        description="Short code resolved from the Specialization table.",
        examples=["ORTHO"],
    )

    is_primary: bool = Field(
        title="Is Primary",
        description="Whether this is the doctor's primary specialization.",
        examples=[True],
    )

    certification_date: Optional[date] = Field(
        default=None,
        title="Certification Date",
        description="Date when the specialization was certified.",
        examples=["2020-06-15"],
    )


class DoctorResponse(BaseModel):
    """Full doctor profile returned in single-resource API responses.

    Includes nested specializations array and all audit fields.
    user_full_name and user_email are populated by the mapper
    layer (Approach A per Phase 10 design decision - they are not
    direct ORM attributes).
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        title="Doctor ID",
        description="Unique identifier (UUID).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )

    doctor_code: str = Field(
        title="Doctor Code",
        description="Auto-generated unique code (e.g. DOC-00001).",
        examples=["DOC-00001"],
    )

    user_id: int = Field(
        title="User ID",
        description="Foreign key to the linked User.",
        examples=[1],
    )

    user_full_name: Optional[str] = Field(
        default=None,
        title="User Full Name",
        description="Full name resolved from the User relationship (populated by mapper).",
        examples=["Juan Dela Cruz"],
    )

    user_email: Optional[str] = Field(
        default=None,
        title="User Email",
        description="Email resolved from the User relationship (populated by mapper).",
        examples=["juan@example.com"],
    )

    date_of_birth: Optional[date] = Field(
        default=None,
        title="Date of Birth",
        description="Doctor's date of birth.",
        examples=["1985-06-15"],
    )

    gender: Optional[str] = Field(
        default=None,
        title="Gender",
        description="Doctor's gender.",
        examples=["male"],
    )

    primary_phone: str = Field(
        title="Primary Phone",
        description="Primary contact number.",
        examples=["+639171234567"],
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Address",
        description="Residential or clinic address.",
        examples=["123 Rizal St., Manila"],
    )

    qualification: Optional[str] = Field(
        default=None,
        title="Qualification",
        description="Professional qualifications.",
        examples=["DMD, University of the Philippines"],
    )

    registration_number: Optional[str] = Field(
        default=None,
        title="Registration Number",
        description="Professional license / registration ID.",
        examples=["DEN-2020-12345"],
    )

    years_of_experience: Optional[int] = Field(
        default=None,
        title="Years of Experience",
        description="Years in practice.",
        examples=[10],
    )

    consultation_fee: Optional[Decimal] = Field(
        default=None,
        title="Consultation Fee",
        description="Fee per consultation session.",
        examples=[Decimal("800.00")],
    )

    consultation_duration: Optional[int] = Field(
        default=None,
        title="Consultation Duration (minutes)",
        description="Minutes per appointment slot.",
        examples=[30],
    )

    languages_known: Optional[list[str]] = Field(
        default=None,
        title="Languages Known",
        description="Languages the doctor speaks.",
        examples=[["Filipino", "English"]],
    )

    profile_photo_url: Optional[HttpUrl] = Field(
        default=None,
        title="Profile Photo URL",
        description="URL to the doctor's profile photograph.",
    )

    biography: Optional[str] = Field(
        default=None,
        title="Biography",
        description="Professional biography or summary.",
        examples=["Experienced general dentist with 10 years of practice."],
    )

    emergency_contact_name: Optional[str] = Field(
        default=None,
        title="Emergency Contact Name",
        description="Name of the person to contact in an emergency.",
        examples=["Maria Dela Cruz"],
    )

    emergency_contact_phone: Optional[str] = Field(
        default=None,
        title="Emergency Contact Phone",
        description="Phone number of the emergency contact.",
        examples=["+639177654321"],
    )

    available_for_appointment: bool = Field(
        title="Available for Appointment",
        description="Whether the doctor is accepting new appointments.",
        examples=[True],
    )

    on_leave: bool = Field(
        title="On Leave",
        description="Whether the doctor is currently on leave.",
        examples=[False],
    )

    is_active: bool = Field(
        title="Is Active",
        description="Whether the doctor profile is active.",
        examples=[True],
    )

    specializations: list[DoctorSpecializationResponse] = Field(
        default_factory=list,
        title="Specializations",
        description="List of assigned specializations.",
    )

    created_by: Optional[int] = Field(
        default=None,
        title="Created By",
        description="User ID who created this record.",
        examples=[1],
    )

    updated_by: Optional[int] = Field(
        default=None,
        title="Updated By",
        description="User ID who last updated this record.",
        examples=[1],
    )

    created_at: datetime = Field(
        title="Created At",
        description="Timestamp when the record was created.",
        examples=["2026-07-07T10:00:00Z"],
    )

    updated_at: datetime = Field(
        title="Updated At",
        description="Timestamp when the record was last updated.",
        examples=["2026-07-07T10:00:00Z"],
    )


class DoctorProfileResponse(DoctorResponse):
    """Extended doctor profile for self-view (GET /doctors/{id}/profile).

    Includes everything from DoctorResponse plus the
    schedules array for schedule template viewing.
    """

    schedules: list["ScheduleResponse"] = Field(
        default_factory=list,
        title="Schedules",
        description="Weekly recurring availability templates.",
    )


class DoctorAvailabilityResponse(BaseModel):
    """Computed availability status (GET /doctors/{id}/availability).

    Respects INV-11 (inactive doctors are not available) and
    INV-12 (on-leave doctors are not available). The computed
    available field is the logical AND of all three flags.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        title="Doctor ID",
        description="Unique identifier (UUID).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )

    is_active: bool = Field(
        title="Is Active",
        description="Whether the doctor profile is active.",
        examples=[True],
    )

    available_for_appointment: bool = Field(
        title="Available for Appointment",
        description="Whether the doctor flag is set to accept appointments.",
        examples=[True],
    )

    on_leave: bool = Field(
        title="On Leave",
        description="Whether the doctor is currently on leave.",
        examples=[False],
    )

    available: bool = Field(
        title="Available (Computed)",
        description="Computed field: is_active AND available_for_appointment AND NOT on_leave.",
        examples=[True],
    )


class DoctorListResponse(BaseModel):
    """Paginated list of doctors with metadata.

    Matches the existing DensCare pattern from PatientListResponse.
    """

    model_config = ConfigDict(from_attributes=True)

    items: list[DoctorResponse] = Field(
        title="Items",
        description="List of doctor profiles on this page.",
    )

    total: int = Field(
        ge=0,
        title="Total",
        description="Total number of doctors matching the query.",
        examples=[15],
    )

    page: int = Field(
        ge=1,
        title="Page",
        description="Current page number (1-based).",
        examples=[1],
    )

    page_size: int = Field(
        ge=1,
        title="Page Size",
        description="Number of items per page.",
        examples=[20],
    )


class SpecializationResponse(BaseModel):
    """Specialization detail returned in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int = Field(
        title="Specialization ID",
        description="Unique identifier.",
        examples=[1],
    )

    name: str = Field(
        title="Name",
        description="Display name of the specialization.",
        examples=["Orthodontics"],
    )

    code: str = Field(
        title="Code",
        description="Short code for programmatic reference.",
        examples=["ORTHO"],
    )

    description: Optional[str] = Field(
        default=None,
        title="Description",
        description="Optional description.",
        examples=["Diagnosis, prevention, and correction of malpositioned teeth."],
    )

    is_active: bool = Field(
        title="Is Active",
        description="Whether this specialization is active.",
        examples=[True],
    )


class ScheduleResponse(BaseModel):
    """Schedule entry returned in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        title="Schedule ID",
        description="Unique identifier (UUID).",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )

    doctor_id: UUID = Field(
        title="Doctor ID",
        description="Foreign key to the doctor.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )

    day_of_week: int = Field(
        title="Day of Week",
        description="0=Monday through 5=Saturday.",
        examples=[0],
    )

    start_time: time = Field(
        title="Start Time",
        description="Work day start time.",
        examples=["09:00"],
    )

    end_time: time = Field(
        title="End Time",
        description="Work day end time.",
        examples=["17:00"],
    )

    is_active: bool = Field(
        title="Is Active",
        description="Whether this schedule entry is active.",
        examples=[True],
    )
