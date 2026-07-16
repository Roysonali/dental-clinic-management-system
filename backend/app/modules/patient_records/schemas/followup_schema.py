"""
Follow-up schemas.

Contains schemas for patient
record follow-up management.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

# ==========================================================
# BASE SCHEMA
# ==========================================================

class FollowupBase(BaseModel):
    """
    Base follow-up schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    followup_date: date = Field(
        ...,
        title="Follow-up Date",
        description="Scheduled follow-up date",
        examples=["2026-07-15"],
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Clinical Notes",
        description="Follow-up instructions or clinical notes",
        examples=[
            "Review pain and swelling after root canal treatment."
        ],
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
# CREATE
# ==========================================================

class FollowupCreate(FollowupBase):
    """
    Create follow-up schema.
    """
    pass

# ==========================================================
# UPDATE
# ==========================================================

class FollowupUpdate(BaseModel):
    """
    Update follow-up schema.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    followup_date: Optional[date] = Field(
        default=None,
        title="Follow-up Date",
        description="Scheduled follow-up date",
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        title="Clinical Notes",
        description="Follow-up instructions or clinical notes",
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
# SUMMARY RESPONSE
# ==========================================================

class FollowupSummaryResponse(BaseModel):
    """
    Summary follow-up schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Follow-up ID",
        description="Unique follow-up identifier",
    )

    followup_date: date = Field(
        ...,
        title="Follow-up Date",
        description="Scheduled follow-up date",
    )

# ==========================================================
# NESTED RESPONSE
# ==========================================================

class FollowupNestedResponse(BaseModel):
    """
    Nested follow-up schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Follow-up ID",
        description="Unique follow-up identifier",
    )

    followup_date: date = Field(
        ...,
        title="Follow-up Date",
        description="Scheduled follow-up date",
    )

    notes: Optional[str] = Field(
        default=None,
        title="Clinical Notes",
        description="Follow-up instructions or clinical notes",
    )

# ==========================================================
# FULL RESPONSE
# ==========================================================

class FollowupResponse(FollowupBase):
    """
    Full follow-up response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Follow-up ID",
        description="Unique follow-up identifier",
    )

    patient_record_id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Associated patient record identifier",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the follow-up was created",
    )

    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Timestamp when the follow-up was last updated",
    )

# ==========================================================
# LIST ITEM
# ==========================================================

class FollowupListItem(BaseModel):
    """
    Follow-up list item.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Follow-up ID",
        description="Unique follow-up identifier",
    )

    followup_date: date = Field(
        ...,
        title="Follow-up Date",
        description="Scheduled follow-up date",
    )

    notes: Optional[str] = Field(
        default=None,
        title="Clinical Notes",
        description="Follow-up instructions or clinical notes",
    )

    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the follow-up was created",
    )

# ==========================================================
# LIST RESPONSE
# ==========================================================

class FollowupListResponse(BaseModel):
    """
    Paginated follow-up response.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    items: list[FollowupListItem] = Field(
        ...,
        title="Follow-ups",
        description="Paginated follow-up list",
    )

    total: int = Field(
        ...,
        ge=0,
        title="Total Records",
        description="Total number of follow-ups",
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
        description="Records per page",
    )

    pages: int = Field(
        ...,
        ge=0,
        title="Total Pages",
        description="Total number of pages",
    )

