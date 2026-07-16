"""Treatment Plan Router — REST API for the Treatment Plan aggregate.

Every endpoint is thin: parse request → call service → map response.
No business logic, no repositories, no validators, no SQL.
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)
from app.modules.auth.models import User
from app.modules.rbac.permissions import require_roles
from app.modules.treatment.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT,
)
from app.modules.treatment.dependencies import get_treatment_plan_service
from app.modules.treatment.enums import TreatmentPlanStatus
from app.modules.treatment.mappers import TreatmentPlanMapper
from app.modules.treatment.schemas.pagination import PaginatedResponse
from app.modules.treatment.schemas.treatment_plan import (
    AddItemRequest,
    CancelPlanRequest,
    CreatePlanRequest,
    DashboardSummaryResponse,
    ItemUpdateRequest,
    ReorderItemsRequest,
    RestoreVersionRequest,
    TransitionPlanRequest,
    TreatmentPlanListItem,
    TreatmentPlanResponse,
    VersionDetailResponse,
    VersionListResponse,
    VersionRequest,
)
from app.modules.treatment.services import TreatmentPlanService

router = APIRouter(
    prefix="/treatment-plans",
    tags=["Treatment Plans"],
)


# ======================================================================
# POST /treatment-plans — Create
# ======================================================================


@router.post(
    "",
    response_model=TreatmentPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Treatment Plan",
    description=(
        "Create a new treatment plan in Draft status. The plan is "
        "automatically assigned a unique plan code (TXN-XXXXXX) unless "
        "an explicit code is provided. An initial version snapshot and "
        "a pending approval record are created alongside the plan."
    ),
    response_description="The newly created treatment plan aggregate.",
)
def create_treatment_plan(
    payload: CreatePlanRequest,
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
) -> TreatmentPlanResponse:
    """Create a new treatment plan."""
    plan = service.create_plan(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        created_by=current_user.id,
        clinical_notes=payload.clinical_notes,
        observations=payload.observations,
        dentist_recommendations=payload.dentist_recommendations,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        plan_code=payload.plan_code,
    )
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# GET /treatment-plans — List (paginated)
# ======================================================================


@router.get(
    "",
    response_model=PaginatedResponse[TreatmentPlanListItem],
    summary="List Treatment Plans",
    description=(
        "Return a paginated list of treatment plans. Supports optional "
        "filtering by patient, doctor, status, active state, date range, "
        "and free-text search against plan code and patient name."
    ),
    response_description="Paginated list of treatment plan summaries.",
)
def list_treatment_plans(
    search: str | None = Query(
        default=None, description="Search across plan code and patient name."
    ),
    patient_id: UUID | None = Query(
        default=None, description="Filter by patient UUID."
    ),
    doctor_id: UUID | None = Query(
        default=None, description="Filter by doctor UUID."
    ),
    status: TreatmentPlanStatus | None = Query(
        default=None, description="Filter by plan status."
    ),
    is_active: bool | None = Query(
        default=None, description="Filter by active state."
    ),
    date_from: str | None = Query(
        default=None, description="Only plans created on or after this date (YYYY-MM-DD)."
    ),
    date_to: str | None = Query(
        default=None, description="Only plans created on or before this date (YYYY-MM-DD)."
    ),
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})."
    ),
    sort_by: str | None = Query(
        default=None,
        description="Sort field (created_at, updated_at, status, plan_code).",
    ),
    sort_order: str = Query(
        default="desc", pattern="^(asc|desc)$", description="Sort direction."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> PaginatedResponse[TreatmentPlanListItem]:
    """List treatment plans with pagination and optional filters."""
    parsed_date_from: date | None = None
    parsed_date_to: date | None = None
    if date_from:
        parsed_date_from = date.fromisoformat(date_from)
    if date_to:
        parsed_date_to = date.fromisoformat(date_to)

    items, total = service.list_plans(
        search=search,
        patient_id=patient_id,
        doctor_id=doctor_id,
        status=status,
        is_active=is_active,
        date_from=parsed_date_from,
        date_to=parsed_date_to,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return TreatmentPlanMapper.to_paginated(items, total, page, page_size)


# ======================================================================
# GET /treatment-plans/search — Search
# ======================================================================


@router.get(
    "/search",
    response_model=list[TreatmentPlanListItem],
    summary="Search Treatment Plans",
    description=(
        "Search treatment plans by plan code (case-insensitive substring). "
        "Returns an empty list for empty or whitespace-only terms."
    ),
    response_description="List of matching plans (no child entities loaded).",
)
def search_treatment_plans(
    term: str = Query(..., min_length=1, description="Search term."),
    limit: int = Query(
        default=TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT, ge=1, le=50,
        description="Max results (max 50)."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> list[TreatmentPlanListItem]:
    """Search plans by code fragment."""
    items = service.search_plans(term=term, limit=limit)
    return TreatmentPlanMapper.to_list_item_list(items)


# ======================================================================
# GET /treatment-plans/pending-review
# ======================================================================


@router.get(
    "/pending-review",
    response_model=PaginatedResponse[TreatmentPlanListItem],
    summary="List Pending Review",
    description="Return plans awaiting clinical review (UNDER_REVIEW status).",
    response_description="Paginated list of plans pending review.",
)
def list_pending_review(
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> PaginatedResponse[TreatmentPlanListItem]:
    """List plans awaiting clinical review."""
    items, total = service.list_pending_review(page=page, page_size=page_size)
    return TreatmentPlanMapper.to_paginated(items, total, page, page_size)


# ======================================================================
# GET /treatment-plans/pending-approval
# ======================================================================


@router.get(
    "/pending-approval",
    response_model=PaginatedResponse[TreatmentPlanListItem],
    summary="List Pending Approval",
    description="Return plans awaiting doctor approval.",
    response_description="Paginated list of plans pending approval.",
)
def list_pending_approval(
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> PaginatedResponse[TreatmentPlanListItem]:
    """List plans awaiting doctor approval."""
    items, total = service.list_pending_approval(page=page, page_size=page_size)
    return TreatmentPlanMapper.to_paginated(items, total, page, page_size)


# ======================================================================
# GET /treatment-plans/dashboard
# ======================================================================


@router.get(
    "/dashboard",
    response_model=DashboardSummaryResponse,
    summary="Dashboard Summary",
    description=(
        "Return aggregated plan statistics for the dashboard view: "
        "total plans, breakdown by status, and counts for pending "
        "review, approval, and acknowledgment."
    ),
    response_description="Dashboard statistics.",
)
def dashboard_summary(
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> DashboardSummaryResponse:
    """Return dashboard statistics."""
    data = service.dashboard_summary()
    return TreatmentPlanMapper.to_dashboard_summary(
        total_plans=data["total_plans"],
        by_status=data["by_status"],
        pending_review=data["pending_review"],
        pending_approval=data["pending_approval"],
        pending_acknowledgment=data["pending_acknowledgment"],
        active_plans=data["active_plans"],
    )


# ======================================================================
# GET /treatment-plans/by-patient/{patient_id}
# ======================================================================


@router.get(
    "/by-patient/{patient_id}",
    response_model=PaginatedResponse[TreatmentPlanListItem],
    summary="List Plans by Patient",
    description="Return all treatment plans for a given patient (paginated).",
    response_description="Paginated list of plans for the patient.",
)
def list_plans_by_patient(
    patient_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})."
    ),
    sort_by: str | None = Query(
        default=None,
        description="Sort field (created_at, updated_at, status, plan_code).",
    ),
    sort_order: str = Query(
        default="desc", pattern="^(asc|desc)$", description="Sort direction."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> PaginatedResponse[TreatmentPlanListItem]:
    """List plans for a specific patient."""
    items, total = service.list_by_patient(
        patient_id=patient_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return TreatmentPlanMapper.to_paginated(items, total, page, page_size)


# ======================================================================
# GET /treatment-plans/by-doctor/{doctor_id}
# ======================================================================


@router.get(
    "/by-doctor/{doctor_id}",
    response_model=PaginatedResponse[TreatmentPlanListItem],
    summary="List Plans by Doctor",
    description="Return all treatment plans for a given doctor (paginated).",
    response_description="Paginated list of plans for the doctor.",
)
def list_plans_by_doctor(
    doctor_id: UUID,
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})."
    ),
    sort_by: str | None = Query(
        default=None,
        description="Sort field (created_at, updated_at, status, plan_code).",
    ),
    sort_order: str = Query(
        default="desc", pattern="^(asc|desc)$", description="Sort direction."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> PaginatedResponse[TreatmentPlanListItem]:
    """List plans for a specific doctor."""
    items, total = service.list_by_doctor(
        doctor_id=doctor_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return TreatmentPlanMapper.to_paginated(items, total, page, page_size)


# ======================================================================
# GET /treatment-plans/count-by-status
# ======================================================================


@router.get(
    "/count-by-status",
    response_model=dict[str, int],
    summary="Count by Status",
    description="Return a breakdown of plan counts by status label.",
    response_description="{\"draft\": 12, \"proposed\": 5, ...}",
)
def count_by_status(
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> dict[str, int]:
    """Return plan counts grouped by status."""
    return service.count_by_status()


# ======================================================================
# GET /treatment-plans/count-by-doctor
# ======================================================================


@router.get(
    "/count-by-doctor",
    response_model=dict[str, int] | int,
    summary="Count by Doctor",
    description=(
        "Return plan counts grouped by doctor. Optionally filter by "
        "a specific doctor UUID to get a single count."
    ),
    response_description="{\"<uuid>\": 5, ...} or 42",
)
def count_by_doctor(
    doctor_id: UUID | None = Query(
        default=None, description="Optional doctor UUID filter."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> dict[str, int] | int:
    """Return plan counts by doctor."""
    return service.count_by_doctor(doctor_id=doctor_id)


# ======================================================================
# GET /treatment-plans/count-by-patient
# ======================================================================


@router.get(
    "/count-by-patient",
    response_model=dict[str, int] | int,
    summary="Count by Patient",
    description=(
        "Return plan counts grouped by patient. Optionally filter by "
        "a specific patient UUID to get a single count."
    ),
    response_description="{\"<uuid>\": 3, ...} or 42",
)
def count_by_patient(
    patient_id: UUID | None = Query(
        default=None, description="Optional patient UUID filter."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> dict[str, int] | int:
    """Return plan counts by patient."""
    return service.count_by_patient(patient_id=patient_id)


# ======================================================================
# GET /treatment-plans/{plan_id} — Get single plan
# ======================================================================


@router.get(
    "/{plan_id}",
    response_model=TreatmentPlanResponse,
    summary="Get Treatment Plan",
    description=(
        "Retrieve the full details of a single treatment plan by its UUID. "
        "Includes nested items (with procedure details), approval record, "
        "and version history."
    ),
    response_description="The full treatment plan aggregate.",
)
def get_treatment_plan(
    plan_id: UUID,
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Get a single treatment plan by UUID."""
    plan = service.get_plan(plan_id)
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# POST /treatment-plans/{plan_id}/items — Add item
# ======================================================================


@router.post(
    "/{plan_id}/items",
    response_model=TreatmentPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Item",
    description="Add a procedure item to a treatment plan.",
    response_description="The updated plan with the new item.",
)
def add_item(
    plan_id: UUID,
    payload: AddItemRequest,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Add a procedure item to a plan."""
    plan = service.add_item(
        plan_id=plan_id,
        procedure_id=payload.procedure_id,
        sequence_number=payload.sequence_number,
        estimated_cost=payload.estimated_cost,
        discount=payload.discount,
        tooth_number=payload.tooth_number,
        tooth_surface=payload.tooth_surface,
        quadrant=payload.quadrant,
        arch=payload.arch,
        notes=payload.notes,
    )
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# PATCH /treatment-plans/{plan_id}/items/{item_id} — Update item
# ======================================================================


@router.patch(
    "/{plan_id}/items/{item_id}",
    response_model=TreatmentPlanResponse,
    summary="Update Item",
    description=(
        "Partially update an item's mutable fields. Only the fields "
        "provided in the request body are updated. Pass ``null`` to "
        "clear a nullable field."
    ),
    response_description="The updated plan with the item changes reflected.",
)
def update_item(
    plan_id: UUID,
    item_id: UUID,
    payload: ItemUpdateRequest,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Update an item's mutable fields."""
    plan = service.update_item(
        plan_id=plan_id,
        item_id=item_id,
        procedure_id=payload.procedure_id,
        sequence_number=payload.sequence_number,
        estimated_cost=payload.estimated_cost,
        discount=payload.discount,
        tooth_number=payload.tooth_number,
        tooth_surface=payload.tooth_surface,
        quadrant=payload.quadrant,
        arch=payload.arch,
        notes=payload.notes,
    )
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# DELETE /treatment-plans/{plan_id}/items/{item_id} — Remove item
# ======================================================================


@router.delete(
    "/{plan_id}/items/{item_id}",
    response_model=TreatmentPlanResponse,
    summary="Remove Item",
    description="Remove an item from a treatment plan (only in editable statuses).",
    response_description="The updated plan with the item removed.",
)
def remove_item(
    plan_id: UUID,
    item_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Remove an item from a plan."""
    plan = service.remove_item(plan_id=plan_id, item_id=item_id)
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# PUT /treatment-plans/{plan_id}/items/reorder — Reorder items
# ======================================================================


@router.put(
    "/{plan_id}/items/reorder",
    response_model=TreatmentPlanResponse,
    summary="Reorder Items",
    description=(
        "Reorder items in a plan. Accepts an ordered list of item UUIDs. "
        "All existing items must be included exactly once."
    ),
    response_description="The updated plan with items in the new order.",
)
def reorder_items(
    plan_id: UUID,
    payload: ReorderItemsRequest,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Reorder items in a plan."""
    plan = service.reorder_items(plan_id=plan_id, item_ids=payload.item_ids)
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# Status transition endpoints
# ======================================================================


@router.post(
    "/{plan_id}/submit-for-review",
    response_model=TreatmentPlanResponse,
    summary="Submit for Review",
    description="Submit a draft plan for clinical review (DRAFT → UNDER_REVIEW).",
    response_description="The updated plan in UNDER_REVIEW status.",
)
def submit_for_review(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Submit plan for clinical review."""
    plan = service.submit_for_review(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/approve-review",
    response_model=TreatmentPlanResponse,
    summary="Approve Review",
    description="Approve a plan during clinical review (UNDER_REVIEW → PROPOSED).",
    response_description="The updated plan in PROPOSED status.",
)
def approve_review(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Approve plan review."""
    plan = service.approve_review(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/reject-review",
    response_model=TreatmentPlanResponse,
    summary="Reject Review",
    description="Reject a plan during review, returning it to draft (UNDER_REVIEW → DRAFT).",
    response_description="The updated plan in DRAFT status.",
)
def reject_review(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Reject plan review, returning to draft."""
    plan = service.reject_review(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/accept",
    response_model=TreatmentPlanResponse,
    summary="Accept Plan",
    description="Accept a proposed plan (PROPOSED → ACCEPTED).",
    response_description="The updated plan in ACCEPTED status.",
)
def accept_plan(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Accept a proposed plan."""
    plan = service.accept_plan(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/decline",
    response_model=TreatmentPlanResponse,
    summary="Decline Plan",
    description="Decline a proposed plan (PROPOSED → REJECTED).",
    response_description="The updated plan in REJECTED status.",
)
def decline_plan(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Decline a proposed plan."""
    plan = service.decline_plan(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/cancel",
    response_model=TreatmentPlanResponse,
    summary="Cancel Plan",
    description="Cancel a plan from any non-terminal status.",
    response_description="The updated plan in CANCELLED status.",
)
def cancel_plan(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Cancel a plan."""
    plan = service.cancel_plan(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/start-treatment",
    response_model=TreatmentPlanResponse,
    summary="Start Treatment",
    description="Begin treatment on an accepted plan (ACCEPTED → IN_PROGRESS).",
    response_description="The updated plan in IN_PROGRESS status.",
)
def start_treatment(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Start treatment on an accepted plan."""
    plan = service.start_treatment(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/hold",
    response_model=TreatmentPlanResponse,
    summary="Put on Hold",
    description="Put an active treatment on hold (IN_PROGRESS → ON_HOLD).",
    response_description="The updated plan in ON_HOLD status.",
)
def put_on_hold(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Put treatment on hold."""
    plan = service.put_on_hold(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/resume",
    response_model=TreatmentPlanResponse,
    summary="Resume Treatment",
    description="Resume a treatment that was on hold (ON_HOLD → IN_PROGRESS).",
    response_description="The updated plan in IN_PROGRESS status.",
)
def resume_treatment(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Resume treatment from hold."""
    plan = service.resume_treatment(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/complete",
    response_model=TreatmentPlanResponse,
    summary="Complete Treatment",
    description="Mark a treatment as completed (IN_PROGRESS/ON_HOLD → COMPLETED).",
    response_description="The updated plan in COMPLETED status (terminal).",
)
def complete_treatment(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Complete treatment."""
    plan = service.complete_treatment(
        plan_id=plan_id, updated_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# Doctor approval / patient acknowledgment
# ======================================================================


@router.post(
    "/{plan_id}/doctor-approve",
    response_model=TreatmentPlanResponse,
    summary="Doctor Approve",
    description="Record doctor approval on a proposed plan.",
    response_description="The updated plan with doctor approval recorded.",
)
def doctor_approve(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Record doctor approval on a plan."""
    plan = service.doctor_approve(
        plan_id=plan_id, approved_by=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/doctor-revoke",
    response_model=TreatmentPlanResponse,
    summary="Doctor Revoke",
    description="Revoke a doctor's approval from a proposed plan.",
    response_description="The updated plan with approval cleared.",
)
def doctor_revoke(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Revoke doctor approval."""
    plan = service.doctor_revoke(
        plan_id=plan_id, actor_id=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/patient-acknowledge",
    response_model=TreatmentPlanResponse,
    summary="Patient Acknowledge",
    description="Record patient acknowledgment (acceptance) of a proposed plan.",
    response_description="The updated plan with patient acceptance recorded.",
)
def patient_acknowledge(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Record patient acknowledgment of a plan."""
    plan = service.patient_acknowledge(
        plan_id=plan_id, actor_id=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


@router.post(
    "/{plan_id}/patient-decline",
    response_model=TreatmentPlanResponse,
    summary="Patient Decline",
    description="Record patient declining a proposed plan.",
    response_description="The updated plan with patient decline recorded.",
)
def patient_decline(
    plan_id: UUID,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Record patient declining a plan."""
    plan = service.patient_decline(
        plan_id=plan_id, actor_id=current_user.id
    )
    return TreatmentPlanMapper.to_response(plan)


# ======================================================================
# Version management
# ======================================================================


@router.post(
    "/{plan_id}/versions",
    response_model=TreatmentPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Version",
    description=(
        "Create an immutable snapshot of the plan's current items. "
        "Used before substantial modifications to preserve the existing "
        "item configuration."
    ),
    response_description="The updated plan with the new version.",
)
def create_version(
    plan_id: UUID,
    payload: VersionRequest,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Create a version snapshot."""
    plan = service.create_version(
        plan_id=plan_id,
        change_reason=payload.change_reason,
        changed_by=current_user.id,
    )
    return TreatmentPlanMapper.to_response(plan)


@router.get(
    "/{plan_id}/versions",
    response_model=VersionListResponse,
    summary="List Versions",
    description="List all version snapshots for a plan, ordered by version number.",
    response_description="List of version summaries.",
)
def list_versions(
    plan_id: UUID,
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> VersionListResponse:
    """List version snapshots for a plan."""
    versions = service.list_versions(plan_id=plan_id)
    return TreatmentPlanMapper.to_version_list(versions)


@router.get(
    "/{plan_id}/versions/{version_id}",
    response_model=VersionDetailResponse,
    summary="Get Version",
    description=(
        "Retrieve a specific version snapshot including the full items "
        "snapshot JSONB payload."
    ),
    response_description="The full version detail with items snapshot.",
)
def get_version(
    plan_id: UUID,
    version_id: UUID,
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> VersionDetailResponse:
    """Get a specific version snapshot."""
    version = service.get_version(plan_id=plan_id, version_id=version_id)
    return TreatmentPlanMapper.to_version_detail(version)


@router.post(
    "/{plan_id}/versions/{version_id}/restore",
    response_model=TreatmentPlanResponse,
    summary="Restore Version",
    description=(
        "Restore a plan's items from an earlier version snapshot. "
        "Creates a new version recording the restore event. The plan "
        "must be in an editable status."
    ),
    response_description="The updated plan restored to the given version.",
)
def restore_version(
    plan_id: UUID,
    version_id: UUID,
    payload: RestoreVersionRequest,
    current_user: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: TreatmentPlanService = Depends(get_treatment_plan_service),
) -> TreatmentPlanResponse:
    """Restore a plan from an earlier version."""
    plan = service.restore_version(
        plan_id=plan_id,
        version_id=version_id,
        changed_by=current_user.id,
    )
    return TreatmentPlanMapper.to_response(plan)
