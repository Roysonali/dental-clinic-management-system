"""Billing Module — Receipt Router (Sprint 7.4).

REST endpoints for the Receipt aggregate covering generate, retrieve,
and regenerate operations.

Endpoints
---------
* ``GET    /billing/receipts/{receipt_id}`` — Single receipt with full aggregate.
* ``POST   /billing/receipts`` — Generate a receipt for a completed payment.
* ``POST   /billing/receipts/{receipt_id}/regenerate`` — Regenerate an existing receipt.

Architecture
------------
* **Transport layer only** — no SQLAlchemy, no repositories, no validators,
  no business logic, no calculations, no transactions.
* **Thin handlers** — authenticate, authorise, invoke the service, return a
  DTO via the mapper. Nothing else.
* **Dependency injection** — ``ReceiptService`` is wired via
  :func:`get_receipt_service` which constructs the full stack per request.
* **Response models** — Pydantic DTOs from the approved schema layer.
  ORM models are never returned directly.

OpenAPI compliance
------------------
Every endpoint includes:
* ``summary``
* ``description``
* ``response_model``
* ``status_code``
* ``responses``
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_DENTAL_ASSISTANT,
    ROLE_RECEPTIONIST,
)
from app.modules.auth.models import User
from app.modules.billing.dependencies import get_receipt_service
from app.modules.billing.mappers.receipt_mapper import ReceiptMapper
from app.modules.billing.routers import _COMMON_ERROR_RESPONSES
from app.modules.billing.schemas.receipt import (
    ReceiptGenerateRequest,
    ReceiptRead,
)
from app.modules.billing.services.receipt_service import ReceiptService
from app.modules.rbac.permissions import require_roles

# ======================================================================
# Router — bound to /billing/receipts via the parent billing_router
# ======================================================================

router = APIRouter(
    prefix="/receipts",
    tags=["Receipts"],
)

# Roles permitted to read receipts.
_RECEIPT_READ_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to generate receipts.
_RECEIPT_WRITE_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to regenerate receipts.
_RECEIPT_WORKFLOW_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]


# ======================================================================
# Read Endpoints
# ======================================================================


@router.get(
    "/{receipt_id}",
    response_model=ReceiptRead,
    status_code=status.HTTP_200_OK,
    summary="Get Receipt",
    description=(
        "Retrieve a single receipt by its UUID. Returns the full receipt "
        "aggregate including the linked payment, patient, amount, "
        "financial summary, and audit timestamps."
    ),
    response_description="Full receipt aggregate with nested entities.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Receipt not found."},
    },
    operation_id="get_receipt",
)
def get_receipt(
    receipt_id: UUID,
    _current_user: User = Depends(
        require_roles(_RECEIPT_READ_ROLES),
    ),
    service: ReceiptService = Depends(get_receipt_service),
) -> ReceiptRead:
    """Return a single receipt with full aggregate detail.

    Thin handler — delegates existence check to the service layer
    (which raises ``ReceiptNotFound`` if missing) and uses the mapper
    for response construction.
    """
    receipt, _printable = service.get_receipt(receipt_id)
    return ReceiptMapper.to_read(receipt)


# ======================================================================
# Create / Generate Endpoint
# ======================================================================


@router.post(
    "",
    response_model=ReceiptRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate Receipt",
    description=(
        "Generate a receipt for a completed payment. The service layer "
        "locks the payment, validates eligibility, reserves a sequential "
        "receipt number, persists the receipt, creates an audit log entry, "
        "and returns the full receipt representation. The receipt is "
        "immutable after generation."
    ),
    response_description="The newly generated receipt.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="generate_receipt",
)
def generate_receipt(
    body: ReceiptGenerateRequest,
    _current_user: User = Depends(
        require_roles(_RECEIPT_WRITE_ROLES),
    ),
    service: ReceiptService = Depends(get_receipt_service),
) -> ReceiptRead:
    """Generate a receipt for a completed payment.

    Thin handler — validates the request DTO, delegates generation to the
    service layer, and maps the result to a response DTO via the mapper.
    """
    receipt, _printable = service.generate_receipt(
        payment_id=body.payment_id,
        generated_by=_current_user.id,
    )
    return ReceiptMapper.to_read(receipt)


# ======================================================================
# Workflow Endpoint — Regenerate
# ======================================================================


@router.post(
    "/{receipt_id}/regenerate",
    response_model=ReceiptRead,
    status_code=status.HTTP_200_OK,
    summary="Regenerate Receipt",
    description=(
        "Re-produce an existing receipt without creating a new financial "
        "record. Validates that the receipt is still in GENERATED status, "
        "creates an audit log entry recording the regeneration event, and "
        "returns the receipt. No financial data is modified — this is "
        "purely a document reproduction workflow."
    ),
    response_description="The regenerated receipt.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Receipt not found."},
        422: {"description": "Receipt is not in GENERATED status and cannot be regenerated."},
    },
    operation_id="regenerate_receipt",
)
def regenerate_receipt(
    receipt_id: UUID,
    _current_user: User = Depends(
        require_roles(_RECEIPT_WORKFLOW_ROLES),
    ),
    service: ReceiptService = Depends(get_receipt_service),
) -> ReceiptRead:
    """Regenerate an existing receipt.

    Thin handler — delegates to the service layer which handles the
    validation, audit logging, and returns the receipt.
    """
    receipt, _printable = service.regenerate_receipt(
        receipt_id=receipt_id,
        regenerated_by=_current_user.id,
    )
    return ReceiptMapper.to_read(receipt)


__all__ = [
    "router",
]
