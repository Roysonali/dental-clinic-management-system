"""
Attachment schemas.

Contains schemas for patient record
attachments and uploaded file metadata.
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
# CREATE (multipart upload payload)
# ==========================================================

class AttachmentUpload(BaseModel):
    """Internal payload handed from the router to the service for a real
    file upload.

    The HTTP endpoint accepts ``multipart/form-data`` (a raw ``file`` plus
    an ``attachment_type`` form field); this model is the service-layer
    contract so the service never depends on FastAPI types.

    Attributes:
        file_name: Original client-supplied filename (metadata only — it
            is never used as a filesystem path).
        content: Full file bytes.
        content_type: MIME type declared by the client (untrusted — the
            service re-validates against the actual file signature).
        attachment_type: DensCare attachment category the file is
            registered under.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    file_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        title="File Name",
        description="Original uploaded file name (metadata only)",
        examples=["opg_scan.jpg"],
    )

    content: bytes = Field(
        ...,
        title="File Content",
        description="Raw file bytes",
    )

    content_type: Optional[str] = Field(
        default=None,
        max_length=255,
        title="Declared Content Type",
        description="Client-declared MIME type (re-validated server-side)",
    )

    attachment_type: AttachmentType = Field(
        ...,
        title="Attachment Type",
        description="Type of attachment",
    )

    @field_validator("file_name")
    @classmethod
    def validate_file_name(
        cls,
        value: str,
    ) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field cannot be empty.")
        # Filenames are metadata only — but still reject path separators
        # so they can never be mistaken for paths downstream.
        if "/" in value or "\\" in value:
            raise ValueError(
                "File name must be a plain name, not a path."
            )
        return value


class AttachmentCreate(AttachmentBase):
    """Legacy JSON metadata registration schema.

    Deprecated — real uploads use ``AttachmentUpload`` via the multipart
    endpoint.  Kept so existing metadata-only registrations (and the
    orchestrator contracts) continue to typecheck.
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

    uploaded_by: Optional[int] = Field(
        default=None,
        title="Uploaded By",
        description="ID of the user who uploaded the file",
    )


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

    uploaded_by: Optional[int] = Field(
        default=None,
        title="Uploaded By",
        description="ID of the user who uploaded the file",
    )


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

