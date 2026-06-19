from datetime import date, datetime
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

from app.core.constants import GenderEnum


class PatientBase(BaseModel):
    """Base schema with shared fields and normalization logic for patient operations."""

    model_config = ConfigDict(
        extra="forbid"
    )

    first_name: str = Field(
        min_length=2,
        max_length=100,
    )

    middle_name: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    last_name: str = Field(
        min_length=2,
        max_length=100,
    )

    date_of_birth: date

    gender: GenderEnum

    primary_contact_number: str = Field(
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
    )

    emergency_contact_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
    )

    email: Optional[EmailStr] = None

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    @field_validator(
        "first_name",
        "middle_name",
        "last_name",
        mode="before",
    )
    @classmethod
    def normalize_names(cls, value):
        if value is None:
            return value

        value = value.strip()
        # Allow alphabetic characters, spaces, hyphens, and apostrophes
        allowed = {" ", "-", "'"}
        if value and not all(
            c.isalpha() or c in allowed
            for c in value
        ):
            raise ValueError(
                "Name should contain only alphabetic characters, spaces, hyphens, and apostrophes."
            )

        return value

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_dob(cls, value):
        today = date.today()

        if value > today:
            raise ValueError(
                "date_of_birth cannot be in future"
            )
        if value.year < 1900:
            raise ValueError(
                "Invalid date of birth."
            )

        return value

    @field_validator(
        "address",
        "remarks",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(
        cls,
        value,
    ):
        if value is None:
            return value

        return value.strip()

    @field_validator(
        "email",
        mode="before",
    )
    @classmethod
    def normalize_email(
        cls,
        value,
    ):
        if value is None:
            return value

        return value.strip().lower()

    @field_validator(
        "primary_contact_number",
        "emergency_contact_number",
        mode="before",
    )
    @classmethod
    def normalize_phone(
        cls,
        value,
    ):
        if value is None:
            return value

        return (
            str(value)
            .replace(" ", "")
            .replace("-", "")
            .strip()
        )


class PatientCreate(
    PatientBase
):
    """Schema for creating a new patient. Inherits all validations from PatientBase."""
    pass


class PatientUpdate(
    BaseModel
):
    """Schema for updating an existing patient. All fields are optional for partial updates."""

    model_config = ConfigDict(
        extra="forbid"
    )

    first_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    middle_name: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    last_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )

    date_of_birth: Optional[date] = None

    gender: Optional[GenderEnum] = None

    primary_contact_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
    )

    emergency_contact_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
    )

    email: Optional[
        EmailStr
    ] = None

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_dob(
        cls,
        value,
    ):
        today = date.today()

        if value:

            if value > today:
                raise ValueError(
                    "Date of birth cannot be in future."
                )

            if value.year < 1900:
                raise ValueError(
                    "Invalid date of birth."
                )

        return value

    @field_validator(
        "first_name",
        "middle_name",
        "last_name",
        mode="before",
    )
    @classmethod
    def normalize_names(cls, value):
        if value is None:
            return value

        value = value.strip()
        allowed = {" ", "-", "'"}
        if value and not all(
            c.isalpha() or c in allowed
            for c in value
        ):
            raise ValueError(
                "Name should contain only alphabetic characters, spaces, hyphens, and apostrophes."
            )

        return value

    @field_validator(
        "address",
        "remarks",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(
        cls,
        value,
    ):
        if value is None:
            return value

        return value.strip()

    @field_validator(
        "email",
        mode="before",
    )
    @classmethod
    def normalize_email(
        cls,
        value,
    ):
        if value is None:
            return value

        return value.strip().lower()

    @field_validator(
        "primary_contact_number",
        "emergency_contact_number",
        mode="before",
    )
    @classmethod
    def normalize_phone(
        cls,
        value,
    ):
        if value is None:
            return value

        return (
            str(value)
            .replace(" ", "")
            .replace("-", "")
            .strip()
        )


class PatientResponse(
    BaseModel
):
    """Complete patient details returned in single-patient API responses."""

    model_config = ConfigDict(
        from_attributes=True
    )

    id: str

    patient_code: str

    full_name: str

    date_of_birth: date

    age: Optional[int]

    gender: Optional[str]

    primary_contact_number: str

    emergency_contact_number: Optional[str]

    email: Optional[str]

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    is_active: bool

    created_at: datetime

    updated_at: datetime


class PatientListItem(
    BaseModel
):
    """Lightweight patient summary for list views."""

    model_config = ConfigDict(
        from_attributes=True
    )

    id: str

    patient_code: str

    full_name: str

    age: Optional[int]

    gender: Optional[str]

    primary_contact_number: str

    is_active: bool


class PatientListResponse(
    BaseModel
):
    """Paginated list of patient summaries with metadata."""

    model_config = ConfigDict(
        from_attributes=True
    )

    items: list[
        PatientListItem
    ]

    total: int

    page: int

    page_size: int


class PatientProfileResponse(
    PatientResponse
):
    """Full patient profile. Extends PatientResponse for future profile-specific fields."""
    pass


class PatientStatusResponse(
    BaseModel
):
    """Response returned after activating or deactivating a patient."""

    model_config = ConfigDict(
        from_attributes=True
    )

    id: str

    is_active: bool

    message: str
