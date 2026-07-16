"""Treatment Plan module — Schema package.

Exports all request/response DTOs for the Treatment Plan public API.
"""

from __future__ import annotations

from app.modules.treatment.schemas.common import (
    PlanStatusCounts,
    StatusTransition,
)
from app.modules.treatment.schemas.pagination import (
    PaginatedResponse,
)
from app.modules.treatment.schemas.errors import (
    ErrorDetail,
    ErrorResponse,
    ValidationErrorItem,
    ValidationErrorResponse,
)
from app.modules.treatment.schemas.procedure import (
    ProcedureCreate,
    ProcedureResponse,
    ProcedureSummary,
    ProcedureUpdate,
)
from app.modules.treatment.schemas.treatment_plan import (
    AddItemRequest,
    ApprovalResponse,
    CancelPlanRequest,
    CreatePlanRequest,
    DashboardSummaryResponse,
    ItemUpdateRequest,
    ReorderItemsRequest,
    RestoreVersionRequest,
    TreatmentPlanItemResponse,
    TreatmentPlanListItem,
    TreatmentPlanResponse,
    TransitionPlanRequest,
    VersionDetailResponse,
    VersionListItem,
    VersionListResponse,
    VersionRequest,
)

__all__ = [
    # Common
    "PlanStatusCounts",
    "StatusTransition",
    # Pagination
    "PaginatedResponse",
    # Errors
    "ErrorDetail",
    "ErrorResponse",
    "ValidationErrorItem",
    "ValidationErrorResponse",
    # Procedure
    "ProcedureCreate",
    "ProcedureUpdate",
    "ProcedureSummary",
    "ProcedureResponse",
    # Treatment Plan
    "CreatePlanRequest",
    "AddItemRequest",
    "ItemUpdateRequest",
    "ReorderItemsRequest",
    "TransitionPlanRequest",
    "CancelPlanRequest",
    "RestoreVersionRequest",
    "VersionRequest",
    "TreatmentPlanItemResponse",
    "ApprovalResponse",
    "VersionListItem",
    "VersionDetailResponse",
    "VersionListResponse",
    "TreatmentPlanListItem",
    "TreatmentPlanResponse",
    "DashboardSummaryResponse",
]
