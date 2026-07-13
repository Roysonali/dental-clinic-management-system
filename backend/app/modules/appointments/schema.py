from datetime import (
    date,
    datetime,
    time,
)
from typing import Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)

from app.modules.appointments.enums import (
    AppointmentStatus,
    AppointmentType,
)


class AppointmentCreate(BaseModel):
    """
    Request schema for creating appointment.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    patient_id: UUID

    dentist_id: int = Field(
        gt=0,
    )

    appointment_date: date

    start_time: time

    duration_minutes: int = Field(
        default=30,
        ge=1,
    )

    appointment_type: AppointmentType

    reason_for_visit: str = Field(
        min_length=3,
        max_length=500,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )


class AppointmentUpdate(BaseModel):
    """
    Editable appointment fields.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    appointment_date: Optional[date] = None

    start_time: Optional[time] = None

    duration_minutes: Optional[int] = Field(
        default=None,
        ge=1,
    )

    dentist_id: Optional[int] = Field(
        default=None,
        gt=0,
    )

    appointment_type: Optional[AppointmentType] = None

    reason_for_visit: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=500,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )


class AppointmentStatusUpdate(BaseModel):
    """
    Status update request.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    status: AppointmentStatus


class AppointmentResponse(BaseModel):
    """
    Single appointment response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID

    appointment_number: str

    patient_id: UUID

    dentist_id: int

    appointment_date: date

    start_time: time

    end_time: time

    duration_minutes: int

    appointment_type: AppointmentType

    status: AppointmentStatus

    reason_for_visit: str

    notes: Optional[str]

    created_by: Optional[int]

    updated_by: Optional[int]

    created_at: datetime

    updated_at: datetime


class AppointmentListResponse(BaseModel):
    """
    List response.
    """

    total: int

    items: list[AppointmentResponse]