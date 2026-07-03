"""
Attachment schemas.

Contains schemas for patient record
attachments and uploaded file metadata.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.modules.patient_records.enums import (
    AttachmentType,
)


# ==========================================================
# BASE SCHEMA
# ==========================================================

class AttachmentBase(BaseModel):
    """
    Base attachment schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    attachment_type: AttachmentType = Field(
        ...,
        title="Attachment Type",
        description="Type of attachment",
    )

    file_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        title="File Name",
        description="Original uploaded file name",
        examples=["opg_scan.jpg"],
    )

    file_path: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        title="File Path",
        description="Storage path of uploaded file",
        examples=["uploads/2026/07/opg_scan.jpg"],
    )

    mime_type: Optional[str] = Field(
        default=None,
        max_length=100,
        title="MIME Type",
        description="File MIME type",
        examples=["image/jpeg"],
    )

    file_size: Optional[int] = Field(
        default=None,
        ge=0,
        title="File Size",
        description="File size in bytes",
        examples=[524288],
    )

    @field_validator(
        "file_name",
        "file_path",
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

    @field_validator("mime_type")
    @classmethod
    def validate_mime_type(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        return value or None


# ==========================================================
# CREATE
# ==========================================================

class AttachmentCreate(AttachmentBase):
    """
    Create attachment schema.
    """

    pass

# ==========================================================
# UPDATE
# ==========================================================

class AttachmentUpdate(BaseModel):
    """
    Update attachment schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    attachment_type: Optional[
        AttachmentType
    ] = None

    file_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    mime_type: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    file_size: Optional[int] = Field(
        default=None,
        ge=0,
    )

    @field_validator(
        "file_name",
        "mime_type",
    )
    @classmethod
    def validate_optional_text(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        return value or None


# ==========================================================
# SUMMARY RESPONSE
# ==========================================================

class AttachmentSummaryResponse(
    BaseModel
):
    """
    Summary attachment schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID

    attachment_type: AttachmentType

    file_name: str


# ==========================================================
# NESTED RESPONSE
# ==========================================================

class AttachmentNestedResponse(
    BaseModel
):
    """
    Nested attachment schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID

    attachment_type: AttachmentType

    file_name: str

    mime_type: Optional[str]


# ==========================================================
# FULL RESPONSE
# ==========================================================

class AttachmentResponse(
    AttachmentBase
):
    """
    Full attachment response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID

    patient_record_id: UUID

    created_at: datetime

    updated_at: datetime


# ==========================================================
# LIST ITEM
# ==========================================================

class AttachmentListItem(
    BaseModel
):
    """
    Attachment list item.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID

    attachment_type: AttachmentType

    file_name: str

    mime_type: Optional[str]

    file_size: Optional[int]

    created_at: datetime


# ==========================================================
# LIST RESPONSE
# ==========================================================

class AttachmentListResponse(
    BaseModel
):
    """
    Paginated attachment response.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    items: list[
        AttachmentListItem
    ]

    total: int = Field(
        ...,
        ge=0,
    )

    page: int = Field(
        ...,
        ge=1,
    )

    page_size: int = Field(
        ...,
        ge=1,
    )

    pages: int = Field(
        ...,
        ge=0,
    )

