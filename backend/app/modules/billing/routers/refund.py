"""Billing Module — Refund Router (Sprint 7.4).

REST endpoints for the Refund aggregate covering create and workflow
operations.

Endpoints
---------
* ``POST /billing/refunds`` — Create a new refund request in Pending status.
* ``POST /billing/refunds/{refund_id}/approve`` — Approve a pending refund.
* ``POST /billing/refunds/{refund_id}/reject`` — Reject a pending refund.
* ``POST /billing/refunds/{refund_id}/complete`` — Complete an approved refund.

NOT implemented
---------------
* ``GET /billing/refunds`` — Not available; ``RefundService`` does not
  expose a search/list method in the current sprint.
* ``GET /billing/refunds/{id}`` — Not available; ``RefundService`` does not
  expose a get-by-id method in the current sprint.
* ``PATCH /billing/refunds/{id}`` — Not available; ``RefundService`` does not
  expose an update method in the current sprint.
* ``DELETE /billing/refunds/{id}`` — Not available; ``RefundService`` does not
  expose a delete method in the current sprint.

Architecture
------------
* **Transport layer only** — no SQLAlchemy, no repositories, no validators,
  no business logic, no calculations, no transactions.
* **Thin handlers** — authenticate, authorise, invoke the service, return a
  DTO via the mapper. Nothing else.
* **Dependency injection** — ``RefundService`` is wired via
  :func:`get_refund_service` which constructs the full stack per request.

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

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import Field

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_DENTAL_ASSISTANT,
    ROLE_RECEPTIONIST,
)
from app.modules.auth.models import User
from app.modules.billing.dependencies import get_refund_service
from app.modules.billing.mappers.refund_mapper import RefundMapper
from app.modules.billing.routers import _COMMON_ERROR_RESPONSES
from app.modules.billing.schemas.base import BillingBaseModel
from app.modules.billing.schemas.refund import (
    RefundCreateRequest,
    RefundRead,
)
from app.modules.billing.services.refund_service import RefundService
from app.modules.rbac.permissions import require_roles

# ======================================================================
# Router — bound to /billing/refunds via the parent billing_router
# ======================================================================

router = APIRouter(
    prefix="/refunds",
    tags=["Refunds"],
)

# Roles permitted to create refunds.
_REFUND_WRITE_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to perform refund workflow operations (approve, reject, complete).
_REFUND_WORKFLOW_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]


# ======================================================================
# Request bodies for workflow endpoints
# ======================================================================


class RefundWorkflowRequest(BillingBaseModel):
    """Request body for refund workflow endpoints.

    Carries an optional reason recorded in the audit trail.
    """

    reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reason",
        description="Optional reason for the action, recorded in the audit trail.",
        examples=["Refund verified and approved."],
    )


# ======================================================================
# Create Endpoint
# ======================================================================


@router.post(
    "",
    response_model=RefundRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Refund",
    description=(
        "Create a new refund request in Pending status. The service layer "
        "locks the payment, validates eligibility, reserves a sequential "
        "refund number, persists the refund aggregate, creates an audit "
        "log entry, and returns the full refund representation. The refund "
        "must be approved (POST /{id}/approve) before it can be completed "
        "(POST /{id}/complete)."
    ),
    response_description="The newly created refund in Pending status.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="create_refund",
)
def create_refund(
    body: RefundCreateRequest,
    _current_user: User = Depends(
        require_roles(_REFUND_WRITE_ROLES),
    ),
    service: RefundService = Depends(get_refund_service),
) -> RefundRead:
    """Create a new refund request in Pending status.

    Thin handler — validates the request DTO, delegates creation to the
    service layer, and maps the result to a response DTO via the mapper.
    """
    refund = service.create_refund(
        payment_id=body.payment_id,
        amount=body.amount,
        reason=body.reason,
        created_by=_current_user.id,
    )
    return RefundMapper.to_read(refund)


# ======================================================================
# Workflow Endpoints
# ======================================================================


@router.post(
    "/{refund_id}/approve",
    response_model=RefundRead,
    status_code=status.HTTP_200_OK,
    summary="Approve Refund",
    description=(
        "Approve a pending refund. The service layer validates the status "
        "transition PENDING → APPROVED, updates the refund status, sets "
        "reviewer information, creates an audit log entry, and returns the "
        "updated refund. Only refunds in Pending status may be approved."
    ),
    response_description="The approved refund.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Refund not found."},
        409: {"description": "Invalid status transition — refund is not Pending."},
    },
    operation_id="approve_refund",
)
def approve_refund(
    refund_id: UUID,
    _current_user: User = Depends(
        require_roles(_REFUND_WORKFLOW_ROLES),
    ),
    service: RefundService = Depends(get_refund_service),
) -> RefundRead:
    """Approve a pending refund.

    Thin handler — delegates to the service layer which handles the
    status transition, reviewer metadata, and audit logging.
    """
    refund = service.approve_refund(
        refund_id=refund_id,
        approved_by=_current_user.id,
    )
    return RefundMapper.to_read(refund)


@router.post(
    "/{refund_id}/reject",
    response_model=RefundRead,
    status_code=status.HTTP_200_OK,
    summary="Reject Refund",
    description=(
        "Reject a pending refund. A rejection reason is required and is "
        "recorded in the audit trail. The service layer validates the "
        "status transition PENDING → REJECTED, updates the refund, and "
        "returns the updated refund."
    ),
    response_description="The rejected refund.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Refund not found."},
        409: {"description": "Invalid status transition — refund is not Pending."},
        422: {"description": "Rejection reason is required."},
    },
    operation_id="reject_refund",
)
def reject_refund(
    refund_id: UUID,
    body: RefundWorkflowRequest,
    _current_user: User = Depends(
        require_roles(_REFUND_WORKFLOW_ROLES),
    ),
    service: RefundService = Depends(get_refund_service),
) -> RefundRead:
    """Reject a pending refund.

    Thin handler — delegates to the service layer which handles the
    validation, status transition, and audit logging.
    """
    refund = service.reject_refund(
        refund_id=refund_id,
        rejected_by=_current_user.id,
        reason=body.reason,
    )
    return RefundMapper.to_read(refund)


@router.post(
    "/{refund_id}/complete",
    response_model=RefundRead,
    status_code=status.HTTP_200_OK,
    summary="Complete Refund",
    description=(
        "Complete an approved refund. The service layer validates the "
        "status transition APPROVED → COMPLETED, locks the payment, "
        "creates a refund allocation, updates the payment status if fully "
        "refunded, creates an audit log entry, and returns the completed "
        "refund. Only refunds in Approved status may be completed."
    ),
    response_description="The completed refund.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Refund or payment not found."},
        409: {
            "description": (
                "Invalid status transition — refund is not Approved."
            )
        },
        422: {
            "description": "Refund exceeds payment balance."
        },
    },
    operation_id="complete_refund",
)
def complete_refund(
    refund_id: UUID,
    _current_user: User = Depends(
        require_roles(_REFUND_WORKFLOW_ROLES),
    ),
    service: RefundService = Depends(get_refund_service),
) -> RefundRead:
    """Complete an approved refund.

    Thin handler — delegates to the service layer which handles the
    status transition, payment locking, allocation creation, and audit
    logging.
    """
    refund = service.complete_refund(
        refund_id=refund_id,
        completed_by=_current_user.id,
    )
    return RefundMapper.to_read(refund)


__all__ = [
    "router",
]
