"""Procedure Router — REST API for the Procedure master catalog.

Every endpoint is thin: parse request → call service → map response.
No business logic, no repositories, no validators, no SQL.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
)
from app.modules.auth.models import User
from app.modules.rbac.permissions import require_admin, require_roles
from app.modules.treatment.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    PROCEDURE_SEARCH_DEFAULT_LIMIT,
)
from app.modules.treatment.dependencies import get_procedure_service
from app.modules.treatment.enums import ProcedureCategory
from app.modules.treatment.mappers import ProcedureMapper
from app.modules.treatment.schemas.pagination import PaginatedResponse
from app.modules.treatment.schemas.procedure import (
    ProcedureCreate,
    ProcedureResponse,
    ProcedureUpdate,
)
from app.modules.treatment.services import ProcedureService

router = APIRouter(
    prefix="/procedures",
    tags=["Procedures"],
)


# ======================================================================
# POST /procedures — Create
# ======================================================================


@router.post(
    "",
    response_model=ProcedureResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Procedure",
    description=(
        "Create a new procedure in the master catalog. The procedure code "
        "will be uppercased by the service. Validates uniqueness of the "
        "code and that the default cost is within the allowed range."
    ),
    response_description="The newly created procedure.",
)
def create_procedure(
    payload: ProcedureCreate,
    service: ProcedureService = Depends(get_procedure_service),
    _: User = Depends(require_admin),
) -> ProcedureResponse:
    """Create a procedure and return its full representation."""
    procedure = service.create_procedure(
        code=payload.code,
        name=payload.name,
        default_cost=payload.default_cost,
        category=payload.category,
        description=payload.description,
    )
    return ProcedureMapper.to_response(procedure)


# ======================================================================
# GET /procedures — List (paginated)
# ======================================================================


@router.get(
    "",
    response_model=PaginatedResponse[ProcedureResponse],
    summary="List Procedures",
    description=(
        "Return a paginated list of procedures. Supports optional "
        "filtering by active state and category, as well as sorting "
        "by any recognised field."
    ),
    response_description="Paginated list of procedures.",
)
def list_procedures(
    page: int = Query(default=1, ge=1, description="Page number (1-based)."),
    page_size: int = Query(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (max {MAX_PAGE_SIZE})."
    ),
    is_active: bool | None = Query(
        default=None, description="Filter by active state."
    ),
    category: ProcedureCategory | None = Query(
        default=None, description="Filter by procedure category."
    ),
    sort_by: str | None = Query(
        default=None,
        description="Sort field (code, name, default_cost, created_at).",
    ),
    sort_order: str = Query(
        default="asc", pattern="^(asc|desc)$", description="Sort direction."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: ProcedureService = Depends(get_procedure_service),
) -> PaginatedResponse[ProcedureResponse]:
    """List procedures with pagination and optional filters."""
    items, total = service.list_procedures(
        page=page,
        page_size=page_size,
        is_active=is_active,
        category=category,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return ProcedureMapper.to_paginated(items, total, page, page_size)


# ======================================================================
# GET /procedures/search — Search
# ======================================================================


@router.get(
    "/search",
    response_model=list[ProcedureResponse],
    summary="Search Procedures",
    description=(
        "Search procedures by code or name (case-insensitive substring). "
        "Returns an empty list for empty or whitespace-only terms."
    ),
    response_description="List of matching procedures.",
)
def search_procedures(
    term: str = Query(..., min_length=1, description="Search term."),
    limit: int = Query(
        default=PROCEDURE_SEARCH_DEFAULT_LIMIT, ge=1, le=50,
        description="Max results (max 50)."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: ProcedureService = Depends(get_procedure_service),
) -> list[ProcedureResponse]:
    """Search procedures by code or name fragment."""
    items = service.search_procedures(term=term, limit=limit)
    return ProcedureMapper.to_response_list(items)


# ======================================================================
# GET /procedures/active — List active
# ======================================================================


@router.get(
    "/active",
    response_model=list[ProcedureResponse],
    summary="List Active Procedures",
    description=(
        "Return all active procedures ordered by code. Intended for "
        "dropdowns, option selectors, and frontend form populations."
    ),
    response_description="List of active procedures.",
)
def list_active_procedures(
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: ProcedureService = Depends(get_procedure_service),
) -> list[ProcedureResponse]:
    """Return all active procedures for dropdown use."""
    items = service.list_active_procedures()
    return ProcedureMapper.to_response_list(items)


# ======================================================================
# GET /procedures/count — Count
# ======================================================================


@router.get(
    "/count",
    response_model=dict[str, int],
    summary="Count Procedures",
    description="Return the total number of procedures, optionally filtered by active state.",
    response_description="{\"count\": 42}",
)
def count_procedures(
    is_active: bool | None = Query(
        default=None, description="Filter by active state."
    ),
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: ProcedureService = Depends(get_procedure_service),
) -> dict[str, int]:
    """Return the procedure count."""
    count = service.count_procedures(is_active=is_active)
    return {"count": count}


# ======================================================================
# GET /procedures/{procedure_id} — Get by ID
# ======================================================================


@router.get(
    "/{procedure_id}",
    response_model=ProcedureResponse,
    summary="Get Procedure",
    description="Retrieve a single procedure by its integer primary key.",
    response_description="The full procedure representation.",
)
def get_procedure(
    procedure_id: int,
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: ProcedureService = Depends(get_procedure_service),
) -> ProcedureResponse:
    """Get a procedure by its integer ID."""
    procedure = service.get_procedure(procedure_id)
    return ProcedureMapper.to_response(procedure)


# ======================================================================
# GET /procedures/by-code/{code} — Get by code
# ======================================================================


@router.get(
    "/by-code/{code}",
    response_model=ProcedureResponse,
    summary="Get Procedure by Code",
    description=(
        "Retrieve a single procedure by its unique business code "
        "(case-insensitive lookup)."
    ),
    response_description="The full procedure representation.",
)
def get_procedure_by_code(
    code: str,
    _: User = Depends(
        require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])
    ),
    service: ProcedureService = Depends(get_procedure_service),
) -> ProcedureResponse:
    """Get a procedure by its business code."""
    procedure = service.get_procedure_by_code(code)
    return ProcedureMapper.to_response(procedure)


# ======================================================================
# PATCH /procedures/{procedure_id} — Update
# ======================================================================


@router.patch(
    "/{procedure_id}",
    response_model=ProcedureResponse,
    summary="Update Procedure",
    description=(
        "Partially update a procedure's mutable fields. Only the fields "
        "provided in the request body are updated. The procedure code "
        "is immutable and cannot be changed via this endpoint."
    ),
    response_description="The updated procedure representation.",
)
def update_procedure(
    procedure_id: int,
    payload: ProcedureUpdate,
    _: User = Depends(require_admin),
    service: ProcedureService = Depends(get_procedure_service),
) -> ProcedureResponse:
    """Update a procedure's mutable fields."""
    updates = payload.model_dump(exclude_unset=True)
    procedure = service.update_procedure(procedure_id, updates)
    return ProcedureMapper.to_response(procedure)


# ======================================================================
# PATCH /procedures/{procedure_id}/activate — Activate
# ======================================================================


@router.patch(
    "/{procedure_id}/activate",
    response_model=ProcedureResponse,
    summary="Activate Procedure",
    description="Activate a procedure that is currently inactive.",
    response_description="The activated procedure.",
)
def activate_procedure(
    procedure_id: int,
    _: User = Depends(require_admin),
    service: ProcedureService = Depends(get_procedure_service),
) -> ProcedureResponse:
    """Activate a procedure."""
    procedure = service.activate_procedure(procedure_id)
    return ProcedureMapper.to_response(procedure)


# ======================================================================
# PATCH /procedures/{procedure_id}/deactivate — Deactivate
# ======================================================================


@router.patch(
    "/{procedure_id}/deactivate",
    response_model=ProcedureResponse,
    summary="Deactivate Procedure",
    description="Deactivate a procedure (soft-retire from the catalog).",
    response_description="The deactivated procedure.",
)
def deactivate_procedure(
    procedure_id: int,
    _: User = Depends(require_admin),
    service: ProcedureService = Depends(get_procedure_service),
) -> ProcedureResponse:
    """Deactivate a procedure."""
    procedure = service.deactivate_procedure(procedure_id)
    return ProcedureMapper.to_response(procedure)


# ======================================================================
# DELETE /procedures/{procedure_id} — Delete
# ======================================================================


@router.delete(
    "/{procedure_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Procedure",
    description=(
        "Hard-delete a procedure. The procedure must be inactive before "
        "deletion. Will fail with a 409 Conflict if treatment plan items "
        "still reference this procedure (FK constraint)."
    ),
    response_description="No content — procedure has been deleted.",
)
def delete_procedure(
    procedure_id: int,
    _: User = Depends(require_admin),
    service: ProcedureService = Depends(get_procedure_service),
) -> None:
    """Delete a procedure (must be inactive)."""
    service.delete_procedure(procedure_id)
