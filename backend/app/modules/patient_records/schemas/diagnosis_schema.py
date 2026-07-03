from datetime import datetime
from uuid import UUID
from typing import Optional, List

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.modules.patient_records.enums import (
    DiagnosisType,
)
# ==========================================================
# BASE SCHEMA
# ==========================================================
class DiagnosisBase(BaseModel):
    """
    Base diagnosis schema containing
    common fields and validations.
    """
    model_config = ConfigDict(
    extra="forbid",
    str_strip_whitespace=True,
    )

    diagnosis_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        title="Diagnosis Name",
        description="Clinical diagnosis identified during examination",
        examples=["Dental Caries"],
    )

    diagnosis_type: DiagnosisType = Field(
        ...,
        title="Diagnosis Type",
        description="Type/category of diagnosis",
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Clinical Notes",
        description="Additional clinical observations",
        examples=["Visible occlusal caries on tooth #36"],
    )

    @field_validator("diagnosis_name")
    @classmethod
    def validate_diagnosis_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "Diagnosis name cannot be empty."
            )

        return value

    @field_validator("notes")
    @classmethod
    def validate_notes(cls,value: Optional[str],) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None


# ==========================================================
# CREATE SCHEMA
# ==========================================================

class DiagnosisCreate(DiagnosisBase):
    """
    Schema used when creating
    a diagnosis.
    """

    model_config = ConfigDict(
        extra="forbid"
    )


# ==========================================================
# UPDATE SCHEMA
# ==========================================================

class DiagnosisUpdate(BaseModel):
    """
    Schema used for partial updates.
    """

    model_config = ConfigDict(
        extra="forbid"
    )

    diagnosis_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
    )

    diagnosis_type: Optional[DiagnosisType] = None

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
    )


    @field_validator("diagnosis_name")
    @classmethod
    def validate_name(cls,value: Optional[str],) -> Optional[str]:

        if value is None:
            return value

        value = value.strip()

        if not value:
            raise ValueError(
                "Diagnosis name cannot be empty."
            )

        return value

    @field_validator("notes")
    @classmethod
    def validate_notes(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        return value or None


# ==========================================================
# NESTED RESPONSE
# ==========================================================

class DiagnosisNestedResponse(BaseModel):
    """
    Lightweight diagnosis schema
    used inside patient record
    responses.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID

    diagnosis_name: str

    diagnosis_type: DiagnosisType



# ==========================================================
# FULL RESPONSE
# ==========================================================

class DiagnosisResponse(DiagnosisBase):
    """
    Full diagnosis response.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID

    patient_record_id: UUID

    created_at: datetime

    updated_at: datetime


# ==========================================================
# LIST ITEM
# ==========================================================

class DiagnosisListItem(BaseModel):
    """
    Diagnosis item used in
    paginated responses.
    """

    model_config = ConfigDict(
        from_attributes=True
    )

    id: UUID
    diagnosis_name: str
    diagnosis_type: DiagnosisType
    created_at: datetime

# ==========================================================
# LIST RESPONSE
# ==========================================================
class DiagnosisListResponse(BaseModel):
    """
    Paginated diagnosis response.
    """
    items: List[DiagnosisListItem]
    total: int = Field(
        ...,
        ge=0,
        description="Total records",
    )

    page: int = Field(
        ...,
        ge=1,
        description="Current page",
    )

    page_size: int = Field(
        ...,
        ge=1,
        description="Records per page",
    )

    pages: int = Field(
        ...,
        ge=0,
        description="Total pages",
    )

class DiagnosisSummaryResponse(BaseModel):

        model_config = ConfigDict(
            from_attributes=True
        )

        id: UUID
        diagnosis_name: str    