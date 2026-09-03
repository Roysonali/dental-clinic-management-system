"""Treatment Plan module — Aggregate root schemas.

Request / response DTOs for the Treatment Plan aggregate and its
child entities (items, versions, approval).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.treatment.constants import (
    CLINICAL_NOTES_MAX_LENGTH,
    MAX_ESTIMATED_COST,
    MAX_ITEM_QUANTITY,
    MIN_ESTIMATED_COST,
    MIN_ITEM_QUANTITY,
    PLAN_CODE_MAX_LENGTH,
)
from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ToothArch,
    ToothQuadrant,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.schemas.common import PlanStatusCounts
from app.modules.treatment.schemas.procedure import ProcedureSummary


# ======================================================================
# Request schemas
# ======================================================================


class CreatePlanRequest(BaseModel):
    """Request body for ``POST /treatment-plans``.

    Creates a new treatment plan in Draft status with an initial
    version snapshot and a pending approval record.
    """

    model_config = ConfigDict(extra="forbid")

    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient (must exist and be active).",
    )
    doctor_id: UUID = Field(
        ...,
        title="Doctor ID",
        description="UUID of the treating doctor (must exist).",
    )
    clinical_notes: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=CLINICAL_NOTES_MAX_LENGTH,
        title="Clinical Notes",
        description="Optional clinical notes.",
    )
    observations: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=CLINICAL_NOTES_MAX_LENGTH,
        title="Observations",
        description="Optional clinical observations.",
    )
    dentist_recommendations: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=CLINICAL_NOTES_MAX_LENGTH,
        title="Dentist Recommendations",
        description="Optional dentist recommendations.",
    )
    valid_from: Optional[date] = Field(
        default=None,
        title="Valid From",
        description="Plan validity start date.",
    )
    valid_to: Optional[date] = Field(
        default=None,
        title="Valid To",
        description="Plan validity end date (must be >= valid_from).",
    )
    plan_code: Optional[str] = Field(
        default=None,
        max_length=PLAN_CODE_MAX_LENGTH,
        title="Plan Code",
        description="Optional explicit plan code. Auto-generated if omitted (TXN-XXXXXX).",
        examples=["TXN-000001"],
    )


class AddItemRequest(BaseModel):
    """Request body for ``POST /treatment-plans/{id}/items``.

    Adds a single procedure item to a treatment plan.
    """

    model_config = ConfigDict(extra="forbid")

    procedure_id: int = Field(
        ...,
        gt=0,
        title="Procedure ID",
        description="ID of the procedure from the master catalog.",
    )
    sequence_number: int = Field(
        ...,
        ge=1,
        title="Sequence Number",
        description="Ordering position within the plan (must be unique).",
        examples=[1],
    )
    quantity: int = Field(
        default=1,
        ge=MIN_ITEM_QUANTITY,
        le=MAX_ITEM_QUANTITY,
        title="Quantity",
        description="Number of units for this item (1–999).",
        examples=[1],
    )
    estimated_cost: Optional[Decimal] = Field(
        default=None,
        ge=MIN_ESTIMATED_COST,
        le=MAX_ESTIMATED_COST,
        max_digits=10,
        decimal_places=2,
        title="Estimated Cost",
        description="Override cost. Defaults to the procedure's default_cost.",
    )
    discount: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=10,
        decimal_places=2,
        title="Discount",
        description="Discount amount applied to this item. Must be <= estimated_cost.",
        examples=[Decimal("0.00")],
    )
    tooth_number: Optional[int] = Field(
        default=None,
        ge=11,
        title="Tooth Number",
        description="FDI tooth number (11-48 permanent, 51-85 primary).",
        examples=[11],
    )
    tooth_surface: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=10,
        title="Tooth Surface",
        description="Surface code(s) e.g. MOD, BOL.",
        examples=["MOD"],
    )
    quadrant: Optional[ToothQuadrant] = Field(
        default=None,
        title="Quadrant",
        description="Dental quadrant (UR, UL, LL, LR).",
    )
    arch: Optional[ToothArch] = Field(
        default=None,
        title="Arch",
        description="Dental arch (upper, lower).",
    )
    notes: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=5000,
        title="Notes",
        description="Clinical notes for this item.",
    )


class ItemUpdateRequest(BaseModel):
    """Request body for ``PATCH /treatment-plans/{plan_id}/items/{item_id}``.

    All fields are optional. Only provided fields are updated.
    Use ``null`` to clear a nullable field.
    """

    model_config = ConfigDict(extra="forbid")

    procedure_id: Optional[int] = Field(
        default=None,
        gt=0,
        title="Procedure ID",
        description="New procedure ID.",
    )
    sequence_number: Optional[int] = Field(
        default=None,
        ge=1,
        title="Sequence Number",
        description="New sequence number (must be unique per plan).",
    )
    quantity: Optional[int] = Field(
        default=None,
        ge=MIN_ITEM_QUANTITY,
        le=MAX_ITEM_QUANTITY,
        title="Quantity",
        description="New quantity (1–999).",
    )
    estimated_cost: Optional[Decimal] = Field(
        default=None,
        ge=MIN_ESTIMATED_COST,
        le=MAX_ESTIMATED_COST,
        max_digits=10,
        decimal_places=2,
        title="Estimated Cost",
        description="New estimated cost.",
    )
    discount: Optional[Decimal] = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2,
        title="Discount",
        description="New discount amount.",
    )
    tooth_number: Optional[int] = Field(
        default=None,
        title="Tooth Number",
        description="FDI tooth number. Pass ``null`` to clear.",
    )
    tooth_surface: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=10,
        title="Tooth Surface",
        description="Surface code(s). Pass ``null`` to clear.",
    )
    quadrant: Optional[ToothQuadrant] = Field(
        default=None,
        title="Quadrant",
        description="Dental quadrant. Pass ``null`` to clear.",
    )
    arch: Optional[ToothArch] = Field(
        default=None,
        title="Arch",
        description="Dental arch. Pass ``null`` to clear.",
    )
    notes: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=5000,
        title="Notes",
        description="New clinical notes.",
    )


class ReorderItemsRequest(BaseModel):
    """Request body for ``PUT /treatment-plans/{id}/items/reorder``.

    Accepts an ordered list of item UUIDs reflecting the desired
    sequence. All existing items must be included exactly once.
    """

    model_config = ConfigDict(extra="forbid")

    item_ids: list[UUID] = Field(
        ...,
        min_length=1,
        title="Item IDs",
        description="Ordered list of item UUIDs (first = sequence 1).",
        examples=[["3fa85f64-5717-4562-b3fc-2c963f66afa6"]],
    )


class TransitionPlanRequest(BaseModel):
    """Request body for workflow transition endpoints.

    Used by ``POST /treatment-plans/{id}/submit-for-review`` and
    similar transition endpoints.
    """

    model_config = ConfigDict(extra="forbid")


class CancelPlanRequest(BaseModel):
    """Request body for ``POST /treatment-plans/{id}/cancel``."""

    model_config = ConfigDict(extra="forbid")


class VersionRequest(BaseModel):
    """Request body for ``POST /treatment-plans/{id}/versions``.

    Creates an immutable snapshot of the plan's current items.
    """

    model_config = ConfigDict(extra="forbid")

    change_reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        title="Change Reason",
        description="Human-readable reason for creating this version.",
        examples=["Cost adjustment after patient consultation"],
    )


class RestoreVersionRequest(BaseModel):
    """Request body for ``POST /treatment-plans/{id}/versions/{version_id}/restore``."""

    model_config = ConfigDict(extra="forbid")


# ======================================================================
# Response schemas — child entities
# ======================================================================


class TreatmentPlanItemResponse(BaseModel):
    """A single procedure item within a treatment plan.

    Includes a nested ``ProcedureSummary`` for display purposes.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Item ID",
        description="Unique identifier of the item.",
    )
    plan_id: UUID = Field(
        ...,
        title="Plan ID",
        description="Owning treatment plan UUID.",
    )
    procedure_id: int = Field(
        ...,
        title="Procedure ID",
        description="Foreign key to the procedure catalog.",
    )
    procedure: Optional[ProcedureSummary] = Field(
        default=None,
        title="Procedure",
        description="Resolved procedure details.",
    )
    sequence_number: int = Field(
        ...,
        title="Sequence Number",
        description="Ordering position within the plan.",
    )
    quantity: int = Field(
        default=1,
        ge=MIN_ITEM_QUANTITY,
        le=MAX_ITEM_QUANTITY,
        title="Quantity",
        description="Number of units for this item.",
    )
    tooth_number: Optional[int] = Field(
        default=None,
        title="Tooth Number",
        description="FDI tooth number.",
    )
    tooth_surface: Optional[str] = Field(
        default=None,
        title="Tooth Surface",
        description="Surface code(s).",
    )
    quadrant: Optional[ToothQuadrant] = Field(
        default=None,
        title="Quadrant",
        description="Dental quadrant.",
    )
    arch: Optional[ToothArch] = Field(
        default=None,
        title="Arch",
        description="Dental arch.",
    )
    estimated_cost: Decimal = Field(
        ...,
        title="Estimated Cost",
        description="Estimated cost for this item.",
    )
    discount: Decimal = Field(
        ...,
        title="Discount",
        description="Discount applied to this item.",
    )
    item_status: TreatmentPlanItemStatus = Field(
        ...,
        title="Item Status",
        description="Current status of the item.",
        examples=["pending"],
    )
    notes: Optional[str] = Field(
        default=None,
        title="Notes",
        description="Clinical notes.",
    )
    appointment_id: Optional[UUID] = Field(
        default=None,
        title="Appointment ID",
        description="Linked appointment UUID.",
    )
    diagnosis_id: Optional[UUID] = Field(
        default=None,
        title="Diagnosis ID",
        description="Linked diagnosis UUID.",
    )


class ApprovalResponse(BaseModel):
    """Doctor approval and patient acknowledgment record for a plan."""

    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID = Field(
        ...,
        title="Approval ID",
        description="Unique identifier of the approval record.",
    )
    approved_by: Optional[int] = Field(
        default=None,
        title="Approved By",
        description="User ID of the approving doctor.",
    )
    approved_at: Optional[datetime] = Field(
        default=None,
        title="Approved At",
        description="Timestamp when the doctor approved.",
    )
    patient_status: PatientAcknowledgmentStatus = Field(
        ...,
        title="Patient Status",
        description="Patient acknowledgment status.",
        examples=["pending"],
    )
    patient_acknowledged_at: Optional[datetime] = Field(
        default=None,
        title="Patient Acknowledged At",
        description="Timestamp when the patient acknowledged.",
    )
    approval_notes: Optional[str] = Field(
        default=None,
        title="Approval Notes",
        description="Optional notes from the approval.",
    )


class VersionListItem(BaseModel):
    """Lightweight version representation for list responses."""

    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID = Field(
        ...,
        title="Version ID",
        description="Unique identifier of the version snapshot.",
    )
    version_number: int = Field(
        ...,
        title="Version Number",
        description="Sequential version number (1-based).",
    )
    change_reason: str = Field(
        ...,
        title="Change Reason",
        description="Reason for creating this version.",
    )
    changed_by: int = Field(
        ...,
        title="Changed By",
        description="User ID of the person who created this version.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the version was created.",
    )


class VersionDetailResponse(BaseModel):
    """Full version details including the item snapshot."""

    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: UUID = Field(
        ...,
        title="Version ID",
        description="Unique identifier of the version snapshot.",
    )
    plan_id: UUID = Field(
        ...,
        title="Plan ID",
        description="Owning treatment plan UUID.",
    )
    version_number: int = Field(
        ...,
        title="Version Number",
        description="Sequential version number (1-based).",
    )
    items_snapshot: dict[str, Any] = Field(
        ...,
        title="Items Snapshot",
        description="Immutable JSONB snapshot of items at this version.",
    )
    change_reason: str = Field(
        ...,
        title="Change Reason",
        description="Reason for creating this version.",
    )
    changed_by: int = Field(
        ...,
        title="Changed By",
        description="User ID of the person who created this version.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the version was created.",
    )


class VersionListResponse(BaseModel):
    """List of version snapshots for a plan."""

    model_config = ConfigDict(frozen=True)

    items: list[VersionListItem] = Field(
        ...,
        title="Items",
        description="Version snapshots ordered by version number ascending.",
    )


# ======================================================================
# Response schemas — Treatment Plan
# ======================================================================


class TreatmentPlanListItem(BaseModel):
    """Treatment plan summary for paginated list responses.

    Includes the plan's essential fields and the approval record's
    patient status for at-a-glance display.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Plan ID",
        description="Unique identifier of the treatment plan.",
    )
    plan_code: str = Field(
        ...,
        title="Plan Code",
        description="Business code (TXN-XXXXXX).",
        examples=["TXN-000001"],
    )
    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient.",
    )
    doctor_id: UUID = Field(
        ...,
        title="Doctor ID",
        description="UUID of the treating doctor.",
    )
    status: TreatmentPlanStatus = Field(
        ...,
        title="Status",
        description="Current plan status.",
        examples=["draft"],
    )
    current_version: int = Field(
        ...,
        title="Current Version",
        description="Current business version number.",
    )
    is_active: bool = Field(
        ...,
        title="Is Active",
        description="Whether the plan is active (soft-archive flag).",
    )
    item_count: int = Field(
        default=0,
        ge=0,
        title="Item Count",
        description="Number of items in the plan.",
    )
    total_estimated_cost: Decimal = Field(
        default=Decimal("0.00"),
        title="Total Estimated Cost",
        description="Sum of estimated costs across all items.",
    )
    created_by: Optional[int] = Field(
        default=None,
        title="Created By",
        description="User ID of the plan creator.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the plan was created.",
    )
    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Timestamp when the plan was last updated.",
    )


class TreatmentPlanResponse(BaseModel):
    """Full treatment plan aggregate response.

    Includes nested items (with procedure details), approval record,
    and version summaries. Used for single-plan GET responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(
        ...,
        title="Plan ID",
        description="Unique identifier of the treatment plan.",
    )
    plan_code: str = Field(
        ...,
        title="Plan Code",
        description="Business code (TXN-XXXXXX).",
        examples=["TXN-000001"],
    )
    patient_id: UUID = Field(
        ...,
        title="Patient ID",
        description="UUID of the patient.",
    )
    doctor_id: UUID = Field(
        ...,
        title="Doctor ID",
        description="UUID of the treating doctor.",
    )
    clinical_notes: Optional[str] = Field(
        default=None,
        title="Clinical Notes",
        description="Clinical notes.",
    )
    observations: Optional[str] = Field(
        default=None,
        title="Observations",
        description="Clinical observations.",
    )
    dentist_recommendations: Optional[str] = Field(
        default=None,
        title="Dentist Recommendations",
        description="Dentist recommendations.",
    )
    valid_from: Optional[date] = Field(
        default=None,
        title="Valid From",
        description="Plan validity start date.",
    )
    valid_to: Optional[date] = Field(
        default=None,
        title="Valid To",
        description="Plan validity end date.",
    )
    status: TreatmentPlanStatus = Field(
        ...,
        title="Status",
        description="Current plan status.",
        examples=["draft"],
    )
    current_version: int = Field(
        ...,
        title="Current Version",
        description="Current business version number.",
    )
    is_active: bool = Field(
        ...,
        title="Is Active",
        description="Whether the plan is active.",
    )
    items: list[TreatmentPlanItemResponse] = Field(
        default_factory=list,
        title="Items",
        description="Procedure items in the plan (ordered by sequence).",
    )
    approval: Optional[ApprovalResponse] = Field(
        default=None,
        title="Approval",
        description="Doctor approval and patient acknowledgment record.",
    )
    versions: list[VersionListItem] = Field(
        default_factory=list,
        title="Versions",
        description="Version history (ordered by version number).",
    )
    created_by: Optional[int] = Field(
        default=None,
        title="Created By",
        description="User ID of the plan creator.",
    )
    updated_by: Optional[int] = Field(
        default=None,
        title="Updated By",
        description="User ID who last updated the plan.",
    )
    created_at: datetime = Field(
        ...,
        title="Created At",
        description="Timestamp when the plan was created.",
    )
    updated_at: datetime = Field(
        ...,
        title="Updated At",
        description="Timestamp when the plan was last updated.",
    )


# ======================================================================
# Dashboard
# ======================================================================


class DashboardSummaryResponse(BaseModel):
    """Aggregated plan statistics for the dashboard view."""

    model_config = ConfigDict(frozen=True)

    total_plans: int = Field(
        ...,
        ge=0,
        title="Total Plans",
        description="Total number of treatment plans.",
    )
    by_status: PlanStatusCounts = Field(
        ...,
        title="By Status",
        description="Breakdown of plan counts by status.",
    )
    pending_review: int = Field(
        ...,
        ge=0,
        title="Pending Review",
        description="Number of plans awaiting clinical review.",
    )
    pending_approval: int = Field(
        ...,
        ge=0,
        title="Pending Approval",
        description="Number of plans awaiting doctor approval.",
    )
    pending_acknowledgment: int = Field(
        ...,
        ge=0,
        title="Pending Acknowledgment",
        description="Number of plans awaiting patient acknowledgment.",
    )
    active_plans: int = Field(
        ...,
        ge=0,
        title="Active Plans",
        description="Number of active treatment plans.",
    )
