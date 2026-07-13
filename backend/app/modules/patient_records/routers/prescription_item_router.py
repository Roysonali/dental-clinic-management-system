"""
Prescription Item API Router
============================

Production-grade FastAPI router for managing medicine items within a
prescription.

Every endpoint enforces:
* **Ownership validation** - the item must belong to a prescription which
  belongs to a patient record; mutations check parent record state.
* **RBAC** - role-based access control (admin / doctor / receptionist).
* **Actor propagation** - the authenticated user's ID is passed to the
  service layer for audit logging.
* **Finalized-record protection** - items cannot be created, updated,
  or deleted if the parent patient record is finalized or soft-deleted.
* **OpenAPI metadata** - every route carries a summary, description,
  and response description for generated docs.

Domain exceptions (``PrescriptionItemNotFound``, ``PrescriptionNotFound``,
``PatientRecordBusinessRule``) propagate to the global
``patient_record_exception_handler``.
"""

from __future__ import annotations

import math
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    status,
)
from pydantic import BaseModel, Field

from app.modules.auth.models import User
from app.modules.patient_records.dependencies.patient_record_dependencies import (
    get_prescription_item_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_patient_record_read,
    require_patient_record_write,
)
from app.modules.patient_records.exceptions import PrescriptionItemNotFound
from app.modules.patient_records.schemas.prescription_schema import (
    PrescriptionItemCreate,
    PrescriptionItemResponse,
    PrescriptionItemUpdate,
)
from app.modules.patient_records.services import PrescriptionItemService


# ---------------------------------------------------------------------------
# Paginated list response (defined locally since the schema module does not
# export a dedicated ``PrescriptionItemListResponse``).
# ---------------------------------------------------------------------------


class PrescriptionItemListResponse(BaseModel):
    """Paginated prescription item list response."""

    items: list[PrescriptionItemResponse] = Field(
        ...,
        description="Paginated list of prescription items.",
    )
    total: int = Field(
        ...,
        ge=0,
        description="Total number of items.",
    )
    page: int = Field(
        ...,
        ge=1,
        description="Current page number (1-based).",
    )
    page_size: int = Field(
        ...,
        ge=1,
        description="Number of items per page.",
    )
    pages: int = Field(
        ...,
        ge=0,
        description="Total number of pages.",
    )


# ---------------------------------------------------------------------------
# Router definitions
#
# Two routers are used so that:
#   - Collection endpoints live under /prescriptions/{prescription_id}/items
#   - Item endpoints live under /prescription-items/{item_id}
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/prescriptions/{prescription_id}/items",
    tags=["Prescription Items"],
)

item_router = APIRouter(
    prefix="/prescription-items",
    tags=["Prescription Items"],
)


# ======================================================================
# POST /prescriptions/{prescription_id}/items
# ======================================================================


@router.post(
    "",
    response_model=PrescriptionItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Item",
    description=(
        "Create a single medicine item under a prescription.  The "
        "prescription must exist and its parent patient record must "
        "not be finalized or soft-deleted.  An audit entry is written "
        "on success."
    ),
    response_description="The newly created prescription item.",
)
def create_prescription_item(
    prescription_id: UUID,
    payload: PrescriptionItemCreate,
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionItemService = Depends(get_prescription_item_service),
) -> PrescriptionItemResponse:
    """Create a single medicine item under a prescription."""
    return service.create_item(
        prescription_id=prescription_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# POST /prescriptions/{prescription_id}/items/bulk
# ======================================================================


@router.post(
    "/bulk",
    response_model=list[PrescriptionItemResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bulk Create Items",
    description=(
        "Create multiple medicine items under a prescription in a "
        "single transaction.  All items must pass validation; if any "
        "item fails the entire batch is rolled back.  The prescription "
        "must exist and its parent patient record must not be finalized "
        "or soft-deleted."
    ),
    response_description="List of newly created prescription items.",
)
def bulk_create_items(
    prescription_id: UUID,
    payloads: list[PrescriptionItemCreate],
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionItemService = Depends(get_prescription_item_service),
) -> list[PrescriptionItemResponse]:
    """Create multiple medicine items in a single transaction."""
    return service.bulk_create(
        prescription_id=prescription_id,
        payloads=payloads,
        actor_id=current_user.id,
    )


# ======================================================================
# GET /prescriptions/{prescription_id}/items
# ======================================================================


@router.get(
    "",
    response_model=PrescriptionItemListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Items",
    description=(
        "Retrieve a paginated list of medicine items for a "
        "prescription.  Results are ordered by most-recent first."
    ),
    response_description="Paginated list of prescription items.",
)
def list_prescription_items(
    prescription_id: UUID,
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (1-based).",
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Number of records per page (max 100).",
    ),
    current_user: User = Depends(require_patient_record_read),
    service: PrescriptionItemService = Depends(get_prescription_item_service),
) -> PrescriptionItemListResponse:
    """Return a paginated list of items for a prescription."""
    items, total = service.list_items(
        prescription_id=prescription_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return PrescriptionItemListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /prescription-items/{item_id}
# ======================================================================


@item_router.get(
    "/{item_id}",
    response_model=PrescriptionItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Item",
    description=(
        "Retrieve a single prescription item by its UUID.  Returns "
        "404 if the item does not exist or has been soft-deleted."
    ),
    response_description="The full prescription item.",
)
def get_prescription_item(
    item_id: UUID,
    current_user: User = Depends(require_patient_record_read),
    service: PrescriptionItemService = Depends(get_prescription_item_service),
) -> PrescriptionItemResponse:
    """Get a single prescription item by UUID."""
    item = service.get_item(item_id)

    if item is None:
        raise PrescriptionItemNotFound(item_id=item_id)

    return item


# ======================================================================
# PATCH /prescription-items/{item_id}
# ======================================================================


@item_router.patch(
    "/{item_id}",
    response_model=PrescriptionItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Item",
    description=(
        "Partially update a prescription item.  Only the fields "
        "provided in the request body are updated.  The parent "
        "patient record must not be finalized or soft-deleted.  "
        "An audit entry is written on success."
    ),
    response_description="The updated prescription item.",
)
def update_prescription_item(
    item_id: UUID,
    payload: PrescriptionItemUpdate,
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionItemService = Depends(get_prescription_item_service),
) -> PrescriptionItemResponse:
    """Update a prescription item."""
    return service.update_item(
        item_id=item_id,
        payload=payload,
        actor_id=current_user.id,
    )


# ======================================================================
# DELETE /prescription-items/{item_id}
# ======================================================================


@item_router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Item",
    description=(
        "Soft-delete a prescription item.  The row is not removed "
        "from the database; ``is_deleted`` is set to true.  The "
        "parent patient record must not be finalized or soft-deleted."
    ),
    response_description="No content - item has been soft-deleted.",
)
def delete_prescription_item(
    item_id: UUID,
    current_user: User = Depends(require_patient_record_write),
    service: PrescriptionItemService = Depends(get_prescription_item_service),
) -> None:
    """Soft-delete a prescription item."""
    service.delete_item(
        item_id=item_id,
        actor_id=current_user.id,
    )
