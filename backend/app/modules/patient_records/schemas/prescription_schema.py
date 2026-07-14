"""
Prescription schemas.

Contains schemas for:

* Prescription
* PrescriptionItem
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

# ==========================================================

# PRESCRIPTION ITEM

# ==========================================================


class PrescriptionItemBase(BaseModel):
    """
    Base schema for prescription medicines.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    medicine_name: str = Field(
        ...,
        min_length=2,
        max_length=255,
        title="Medicine Name",
        description="Name of prescribed medicine",
        examples=["Amoxicillin"],
    )

    dosage: str = Field(
        ...,
        min_length=1,
        max_length=100,
        title="Dosage",
        description="Medicine dosage",
        examples=["500mg"],
    )

    frequency: str = Field(
        ...,
        min_length=1,
        max_length=100,
        title="Frequency",
        description="Medicine frequency",
        examples=["TDS"],
    )

    duration: str = Field(
        ...,
        min_length=1,
        max_length=100,
        title="Duration",
        description="Duration of medication",
        examples=["5 days"],
    )

    instructions: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Instructions",
        description="Medicine specific instructions",
        examples=["Take after meals"],
    )

    @field_validator(
        "medicine_name",
        "dosage",
        "frequency",
        "duration",
    )
    @classmethod
    def validate_required_text(
        cls,
        value: str,
    ) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "Field cannot be empty."
            )

        return value

    @field_validator("instructions")
    @classmethod
    def validate_instructions(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        return value or None


# ==========================================================

# PRESCRIPTION ITEM CREATE

# ==========================================================
class PrescriptionItemCreate(
    PrescriptionItemBase
):
    """
    Create medicine schema.
    """
    pass


# ==========================================================
# PRESCRIPTION ITEM UPDATE
# ==========================================================
class PrescriptionItemUpdate(BaseModel):
    """
    Update medicine schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    medicine_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
        title="Medicine Name",
        description="Name of prescribed medicine",
        examples=["Amoxicillin"],
    )

    dosage: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Dosage",
        description="Medicine dosage",
        examples=["500mg"],
    )

    frequency: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Frequency",
        description="Medicine frequency",
        examples=["TDS"],
    )

    duration: Optional[str] = Field(
        default=None,
        max_length=100,
        title="Duration",
        description="Duration of medication",
        examples=["5 days"],
    )

    instructions: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Instructions",
        description="Medicine specific instructions",
        examples=["Take after meals"],
    )

    @field_validator(
        "medicine_name",
        "dosage",
        "frequency",
        "duration",
    )
    @classmethod
    def validate_required_text(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        if not value:
            raise ValueError(
                "Field cannot be empty."
            )

        return value

    @field_validator("instructions")
    @classmethod
    def validate_instructions(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        return value or None


# ==========================================================
# PRESCRIPTION ITEM SUMMARY
# ========================================================== 
class PrescriptionItemSummaryResponse(BaseModel):
    """
    Summary medicine schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription Item ID",
        description="Unique prescription item identifier",
    )

    medicine_name: str = Field(
        ...,
        title="Medicine Name",
        description="Name of prescribed medicine",
    )


# ==========================================================
# PRESCRIPTION ITEM NESTED
# ==========================================================
class PrescriptionItemNestedResponse(
    BaseModel
):
    """
    Nested medicine schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription Item ID",
        description="Unique prescription item identifier",
    )

    medicine_name: str = Field(
        ...,
        title="Medicine Name",
        description="Name of prescribed medicine",
    )

    dosage: str = Field(
        ...,
        title="Dosage",
        description="Medicine dosage",
    )

    frequency: str = Field(
        ...,
        title="Frequency",
        description="Medicine frequency",
    )

    duration: str = Field(
        ...,
        title="Duration",
        description="Duration of medication",
    )


# ==========================================================
# PRESCRIPTION ITEM RESPONSE
# ==========================================================
class PrescriptionItemResponse(PrescriptionItemBase):
    """
    Full medicine response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription Item ID",
        description="Unique prescription item identifier",
    )

    prescription_id: UUID = Field(
        ...,
        title="Prescription ID",
        description="Unique prescription identifier",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the prescription item was created",
    )

    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Timestamp when the prescription item was last updated",
    )


# ==========================================================
# PRESCRIPTION
# ==========================================================
class PrescriptionBase(BaseModel):
    """
    Base prescription schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=3000,
        title="Prescription Notes",
        description="General prescription notes",
        examples=["Patient reports mild pain."],
    )

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
# PRESCRIPTION CREATE
# ==========================================================
class PrescriptionCreate(PrescriptionBase):
    """
    Create prescription schema.
    """

    items: list[
        PrescriptionItemCreate
    ] = Field(
        ...,
        min_length=1,
        max_length=20,
        title="Prescription Items",
        description="Medicines in prescription",
    )


# ==========================================================
# PRESCRIPTION UPDATE
# ==========================================================
class PrescriptionUpdate(BaseModel):
    """
    Update prescription schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=3000,
        title="Prescription Notes",
        description="General prescription notes",
        examples=["Patient reports mild pain."],
    )

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
# PRESCRIPTION SUMMARY
# ==========================================================
class PrescriptionSummaryResponse(BaseModel):
    """
    Summary prescription schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription ID",
        description="Unique prescription identifier",
    )

    prescribed_at: datetime = Field(
        ...,
        title="Prescribed At",
        description="Timestamp when the prescription was created",
    )

    medicine_count: int = Field(
        ...,
        ge=0,
        title="Medicine Count",
        description="Number of medicines in the prescription",
    )


# ==========================================================
# PRESCRIPTION NESTED
# ==========================================================
class PrescriptionNestedResponse(BaseModel):
    """
    Nested prescription schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription ID",
        description="Unique prescription identifier",
    )

    prescribed_at: datetime = Field(
        ...,
        title="Prescribed At",
        description="Timestamp when the prescription was created",
    )

    items: list[
        PrescriptionItemNestedResponse
    ] = Field(
        ...,
        title="Prescription Items",
        description="Medicines included in the prescription",
    )


class PrescriptionResponse(PrescriptionBase):
    """
    Full prescription response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription ID",
        description="Unique prescription identifier",
    )

    patient_record_id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Unique patient record identifier",
    )

    prescribed_by: int = Field(
        ...,
        title="Prescribed By",
        description="Identifier of the prescribing user",
    )

    prescribed_at: datetime = Field(
        ...,
        title="Prescribed At",
        description="Timestamp when the prescription was created",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the prescription was created",
    )

    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Timestamp when the prescription was last updated",
    )

    items: list[
        PrescriptionItemResponse
    ] = Field(
        ...,
        title="Prescription Items",
        description="Medicines included in the prescription",
    )


class PrescriptionListItem(BaseModel):
    """
    Prescription list item.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Prescription ID",
        description="Unique prescription identifier",
    )

    prescribed_at: datetime = Field(
        ...,
        title="Prescribed At",
        description="Timestamp when the prescription was created",
    )

    prescribed_by: int = Field(
        ...,
        title="Prescribed By",
        description="Identifier of the prescribing user",
    )

    medicine_count: int = Field(
        ...,
        ge=0,
        title="Medicine Count",
        description="Number of medicines in the prescription",
    )


class PrescriptionListResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
    )

    items: list[
        PrescriptionListItem
    ] = Field(
        ...,
        title="Prescription Items",
        description="Paginated prescription list items",
    )

    total: int = Field(
        ...,
        ge=0,
        title="Total Items",
        description="Total number of prescriptions",
    )

    page: int = Field(
        ...,
        ge=1,
        title="Current Page",
        description="Current page number",
    )

    page_size: int = Field(
        ...,
        ge=1,
        title="Page Size",
        description="Number of items per page",
    )

    pages: int = Field(
        ...,
        ge=0,
        title="Total Pages",
        description="Total number of pages",
    )
