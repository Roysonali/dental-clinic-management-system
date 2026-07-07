"""
Audit log schemas.

Contains schemas for patient
record audit history.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


# ==========================================================
# SUMMARY RESPONSE
# ==========================================================

class AuditSummaryResponse(BaseModel):
    """
    Summary audit log schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Audit Log ID",
        description="Unique audit log identifier",
    )

    action: str = Field(
        ...,
        title="Action",
        description="Action performed on patient record",
        examples=["UPDATE_DIAGNOSIS"],
    )

    performed_at: datetime = Field(
        ...,
        title="Performed At",
        description="Timestamp when the action occurred",
    )


# ==========================================================
# NESTED RESPONSE
# ==========================================================

class AuditNestedResponse(BaseModel):
    """
    Nested audit log schema.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Audit Log ID",
        description="Unique audit log identifier",
    )

    action: str = Field(
        ...,
        title="Action",
        description="Action performed on patient record",
    )

    performed_by: int = Field(
        ...,
        title="Performed By",
        description="User ID who performed the action",
    )

    performed_at: datetime = Field(
        ...,
        title="Performed At",
        description="Timestamp when the action occurred",
    )


# ==========================================================
# FULL RESPONSE
# ==========================================================

class AuditResponse(BaseModel):
    """
    Full audit log response.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Audit Log ID",
        description="Unique audit log identifier",
    )

    patient_record_id: UUID = Field(
        ...,
        title="Patient Record ID",
        description="Associated patient record identifier",
    )

    action: str = Field(
        ...,
        title="Action",
        description="Action performed on patient record",
        examples=[
            "CREATE_DIAGNOSIS",
            "UPDATE_DIAGNOSIS",
            "DELETE_ATTACHMENT",
            "LOCK_RECORD",
        ],
    )

    old_value: Optional[str] = Field(
        default=None,
        title="Old Value",
        description="Previous value before modification",
    )

    new_value: Optional[str] = Field(
        default=None,
        title="New Value",
        description="New value after modification",
    )

    performed_by: int = Field(
        ...,
        title="Performed By",
        description="User ID who performed the action",
    )

    performed_at: datetime = Field(
        ...,
        title="Performed At",
        description="Timestamp when the action occurred",
    )


# ==========================================================
# LIST ITEM
# ==========================================================

class AuditListItem(BaseModel):
    """
    Audit log list item.
    """

    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
    )

    id: UUID = Field(
        ...,
        title="Audit Log ID",
        description="Unique audit log identifier",
    )

    action: str = Field(
        ...,
        title="Action",
        description="Action performed on patient record",
    )

    performed_by: int = Field(
        ...,
        title="Performed By",
        description="User ID who performed the action",
    )

    performed_at: datetime = Field(
        ...,
        title="Performed At",
        description="Timestamp when the action occurred",
    )


# ==========================================================
# LIST RESPONSE
# ==========================================================

class AuditListResponse(BaseModel):
    """
    Paginated audit log response.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    items: list[AuditListItem] = Field(
        ...,
        title="Audit Logs",
        description="Paginated audit log list",
    )

    total: int = Field(
        ...,
        ge=0,
        title="Total Records",
        description="Total number of audit records",
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