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
        min_length=7,
        max_length=30,
    )

    emergency_contact_number: Optional[str] = Field(
        default=None,
        min_length=7,
        max_length=30,
    )

    email: Optional[EmailStr] = None

    address: Optional[str] = None

    remarks: Optional[str] = None

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

        return value.strip()

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_dob(cls, value):

        if value > date.today():

            raise ValueError(
                "date_of_birth cannot be in future"
            )

        return value



class PatientCreate(
    PatientBase
):
    pass


class PatientUpdate(
    BaseModel
):

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
        min_length=7,
        max_length=30,
    )

    emergency_contact_number: Optional[str] = Field(
        default=None,
        min_length=7,
        max_length=30,
    )

    email: Optional[
        EmailStr
    ] = None

    address: Optional[
        str
    ] = None

    remarks: Optional[
        str
    ] = None

    @field_validator(
        "date_of_birth"
    )
    @classmethod
    def validate_dob(
        cls,
        value,
    ):

        if (
            value
            and value > date.today()
        ):

            raise ValueError(
                "date_of_birth cannot be in future"
            )

        return value


class PatientResponse(
    BaseModel
):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: str

    patient_code: str

    full_name: str

    date_of_birth: date

    age: int

    gender: str

    primary_contact_number: str

    emergency_contact_number: Optional[str]

    email: Optional[str]

    address: Optional[str]

    remarks: Optional[str]

    is_active: bool

    created_at: datetime

    updated_at: datetime


class PatientListItem(
    BaseModel
):

    id: str

    patient_code: str

    full_name: str

    age: int

    gender: str

    primary_contact_number: str

    is_active: bool


class PatientListResponse(
    BaseModel
):

    items: list[
        PatientListItem
    ]

    total: int

    page: int

    page_size: int


class PatientProfileResponse(
    PatientResponse
):
    pass


class PatientStatusResponse(
    BaseModel
):

    id: str

    is_active: bool

    message: str


class DuplicatePatientWarning(
    BaseModel
):

    possible_duplicate: bool

    matches: list[str]