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
        title="First Name",
        description="Patient's legal first name.",
        examples=["Juan"],
    )

    middle_name: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Middle Name",
        description="Patient's middle name (if any).",
        examples=["Reyes"],
    )

    last_name: str = Field(
        min_length=2,
        max_length=100,
        title="Last Name",
        description="Patient's legal last name or surname.",
        examples=["Dela Cruz"],
    )

    date_of_birth: date = Field(
        title="Date of Birth",
        description="Patient's date of birth. Must not be a future date.",
        examples=["1990-05-15"],
    )

    gender: GenderEnum = Field(
        title="Gender",
        description="Patient's gender identity.",
        examples=["male"],
    )

    primary_contact_number: str = Field(
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
        title="Primary Contact Number",
        description="Primary phone number. Digits only, optional leading +.",
        examples=["+639123456789"],
    )

    emergency_contact_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
        title="Emergency Contact Number",
        description="Emergency contact phone number.",
        examples=["+639987654321"],
    )

    email: Optional[EmailStr] = Field(
        default=None,
        title="Email Address",
        description="Patient's email address.",
        examples=["juan.delacruz@email.com"],
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Address",
        description="Patient's residential address.",
        examples=["123 Rizal St., Barangay San Isidro, Manila"],
    )

    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
        title="Remarks",
        description="Additional notes or remarks about the patient.",
        examples=["Allergic to penicillin."],
    )

    @field_validator(
        "first_name",
        "middle_name",
        "last_name",
        mode="before",
    )
    @classmethod
    def normalize_names(cls, value: str | None) -> str | None:
        """Strip whitespace and validate that names contain only allowed characters."""
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
    def validate_dob(cls, value: date) -> date:
        """Ensure date of birth is not in the future and is a reasonable past date."""
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
    def normalize_optional_text(cls, value: str | None) -> str | None:
        """Strip leading/trailing whitespace from optional text fields."""
        if value is None:
            return value

        return value.strip()

    @field_validator(
        "email",
        mode="before",
    )
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        """Normalize email to lowercase with trimmed whitespace."""
        if value is None:
            return value

        return value.strip().lower()

    @field_validator(
        "primary_contact_number",
        "emergency_contact_number",
        mode="before",
    )
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        """Strip spaces and hyphens from phone numbers for consistent storage."""
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
        title="First Name",
        description="Patient's legal first name.",
        examples=["Juan"],
    )

    middle_name: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Middle Name",
        description="Patient's middle name (if any).",
        examples=["Reyes"],
    )

    last_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
        title="Last Name",
        description="Patient's legal last name or surname.",
        examples=["Dela Cruz"],
    )

    date_of_birth: Optional[date] = Field(
        default=None,
        title="Date of Birth",
        description="Patient's date of birth. Must not be a future date.",
        examples=["1990-05-15"],
    )

    gender: Optional[GenderEnum] = Field(
        default=None,
        title="Gender",
        description="Patient's gender identity.",
        examples=["male"],
    )

    primary_contact_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
        title="Primary Contact Number",
        description="Primary phone number. Digits only, optional leading +.",
        examples=["+639123456789"],
    )

    emergency_contact_number: Optional[str] = Field(
        default=None,
        min_length=10,
        max_length=15,
        pattern=r"^\+?[0-9]{10,15}$",
        title="Emergency Contact Number",
        description="Emergency contact phone number.",
        examples=["+639987654321"],
    )

    email: Optional[EmailStr] = Field(
        default=None,
        title="Email Address",
        description="Patient's email address.",
        examples=["juan.delacruz@email.com"],
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Address",
        description="Patient's residential address.",
        examples=["123 Rizal St., Barangay San Isidro, Manila"],
    )

    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
        title="Remarks",
        description="Additional notes or remarks about the patient.",
        examples=["Allergic to penicillin."],
    )

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_dob(cls, value: date | None) -> date | None:
        """Ensure date of birth is not in the future and is a reasonable past date."""
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
    def normalize_names(cls, value: str | None) -> str | None:
        """Strip whitespace and validate that names contain only allowed characters."""
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
    def normalize_optional_text(cls, value: str | None) -> str | None:
        """Strip leading/trailing whitespace from optional text fields."""
        if value is None:
            return value

        return value.strip()

    @field_validator(
        "email",
        mode="before",
    )
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        """Normalize email to lowercase with trimmed whitespace."""
        if value is None:
            return value

        return value.strip().lower()

    @field_validator(
        "primary_contact_number",
        "emergency_contact_number",
        mode="before",
    )
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        """Strip spaces and hyphens from phone numbers for consistent storage."""
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

    id: str = Field(
        title="Patient ID",
        description="Unique identifier for the patient (UUID).",
        examples=["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    )

    patient_code: str = Field(
        title="Patient Code",
        description="Auto-generated unique patient code (e.g., PAT-000001).",
        examples=["PAT-000001"],
    )

    full_name: str = Field(
        title="Full Name",
        description="Computed full name combining first, middle, and last names.",
        examples=["Juan Reyes Dela Cruz"],
    )

    date_of_birth: date = Field(
        title="Date of Birth",
        description="Patient's date of birth.",
        examples=["1990-05-15"],
    )

    age: Optional[int] = Field(
        title="Age",
        description="Computed age based on date of birth.",
        examples=[34],
    )

    gender: Optional[str] = Field(
        title="Gender",
        description="Patient's gender.",
        examples=["male"],
    )

    primary_contact_number: str = Field(
        title="Primary Contact Number",
        description="Primary phone number.",
        examples=["+639123456789"],
    )

    emergency_contact_number: Optional[str] = Field(
        title="Emergency Contact Number",
        description="Emergency contact phone number.",
        default=None,
        examples=["+639987654321"],
    )

    email: Optional[str] = Field(
        title="Email Address",
        description="Patient's email address.",
        default=None,
        examples=["juan.delacruz@email.com"],
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
        title="Address",
        description="Patient's residential address.",
        examples=["123 Rizal St., Barangay San Isidro, Manila"],
    )

    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
        title="Remarks",
        description="Additional notes about the patient.",
        examples=["Allergic to penicillin."],
    )

    is_active: bool = Field(
        title="Is Active",
        description="Whether the patient record is currently active.",
        examples=[True],
    )

    created_at: datetime = Field(
        title="Created At",
        description="Timestamp when the patient record was created.",
        examples=["2025-01-15T10:30:00Z"],
    )

    updated_at: datetime = Field(
        title="Updated At",
        description="Timestamp when the patient record was last updated.",
        examples=["2025-06-20T14:45:00Z"],
    )


class PatientListItem(
    BaseModel
):
    """Lightweight patient summary for list views."""

    model_config = ConfigDict(
        from_attributes=True
    )

    id: str = Field(
        title="Patient ID",
        description="Unique identifier for the patient (UUID).",
        examples=["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    )

    patient_code: str = Field(
        title="Patient Code",
        description="Auto-generated unique patient code.",
        examples=["PAT-000001"],
    )

    full_name: str = Field(
        title="Full Name",
        description="Computed full name of the patient.",
        examples=["Juan Reyes Dela Cruz"],
    )

    age: Optional[int] = Field(
        title="Age",
        description="Computed age based on date of birth.",
        examples=[34],
    )

    gender: Optional[str] = Field(
        title="Gender",
        description="Patient's gender.",
        examples=["male"],
    )

    primary_contact_number: str = Field(
        title="Primary Contact Number",
        description="Primary phone number.",
        examples=["+639123456789"],
    )

    is_active: bool = Field(
        title="Is Active",
        description="Whether the patient record is currently active.",
        examples=[True],
    )


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
