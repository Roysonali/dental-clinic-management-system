"""Billing Module — Payment Router (Sprint 7.3).

Complete REST endpoints for the Payment aggregate covering read, create,
update, delete, workflow, and allocation operations.

Endpoints
---------
* ``GET    /billing/payments`` — Paginated, filterable payment list.
* ``GET    /billing/payments/{payment_id}`` — Single payment with full aggregate.
* ``POST   /billing/payments`` — Create a new payment in Pending status.
* ``PATCH  /billing/payments/{payment_id}`` — Update a Pending payment.
* ``DELETE /billing/payments/{payment_id}`` — Delete a Pending payment.
* ``POST   /billing/payments/{payment_id}/complete`` — Complete a payment.
* ``POST   /billing/payments/{payment_id}/fail`` — Mark a payment as failed.
* ``POST   /billing/payments/{payment_id}/void`` — Void a payment.
* ``POST   /billing/payments/{payment_id}/allocate`` — Allocate payment to invoice.
* ``POST   /billing/payments/{payment_id}/deallocate`` — Remove allocation.
* ``GET    /billing/payments/{payment_id}/allocations`` — List allocations.

NOT implemented
---------------
* ``POST /billing/payments/{payment_id}/refund`` — Refund is a separate aggregate
  with its own :class:`RefundService`. The PaymentService has no
  ``refund_payment()`` method. Refunds will be exposed via a future
  ``RefundRouter``.

Architecture
------------
* **Transport layer only** — no SQLAlchemy, no repositories, no validators,
  no business logic, no calculations, no transactions.
* **Thin handlers** — authenticate, authorise, invoke the service, return a
  DTO via the mapper. Nothing else.
* **Dependency injection** — ``PaymentService`` is wired via
  :func:`get_payment_service` which constructs the full stack per request.
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

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import Field

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_DENTAL_ASSISTANT,
    ROLE_RECEPTIONIST,
)
from app.modules.auth.models import User
from app.modules.billing.dependencies import get_payment_service
from app.modules.billing.enums import PaymentMethod, PaymentStatus
from app.modules.billing.mappers.payment_mapper import PaymentMapper
from app.modules.billing.routers import _COMMON_ERROR_RESPONSES
from app.modules.billing.schemas.base import BillingBaseModel
from app.modules.billing.schemas.payment import (
    PaymentAllocationSummary,
    PaymentCreateRequest,
    PaymentListResponse,
    PaymentMetadataUpdateRequest,
    PaymentRead,
)
from app.modules.billing.schemas.types import PositiveDecimal
from app.modules.billing.services.payment_service import PaymentService
from app.modules.rbac.permissions import require_roles

# ======================================================================
# Router — bound to /billing/payments via the parent billing_router
# ======================================================================

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)

# Roles permitted to read payments.
_PAYMENT_READ_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to create and update payments.
_PAYMENT_WRITE_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to perform payment workflow operations (complete, fail, void) and allocations.
_PAYMENT_WORKFLOW_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]

# Roles permitted to delete payments.
_PAYMENT_DELETE_ROLES: list[str] = [
    ROLE_ADMIN,
]


# ======================================================================
# Request bodies for workflow and allocation endpoints
# ======================================================================


class PaymentStatusChangeRequest(BillingBaseModel):
    """Request body for payment status transition endpoints.

    Carries an optional reason recorded in the audit trail.
    """

    reason: str | None = Field(
        default=None,
        max_length=500,
        title="Reason",
        description="Optional reason for the status change, recorded in the audit trail.",
        examples=["Payment confirmed by gateway."],
    )


class PaymentAllocateRequest(BillingBaseModel):
    """Request body for ``POST /billing/payments/{payment_id}/allocate``."""

    invoice_id: UUID = Field(
        ...,
        title="Invoice ID",
        description="UUID of the invoice to allocate payment to.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )
    amount: PositiveDecimal = Field(
        ...,
        title="Allocation Amount",
        description="Amount to allocate to the invoice (must be positive).",
        examples=[Decimal("1000.00")],
    )


class PaymentDeallocateRequest(BillingBaseModel):
    """Request body for ``POST /billing/payments/{payment_id}/deallocate``."""

    invoice_id: UUID = Field(
        ...,
        title="Invoice ID",
        description="UUID of the invoice to deallocate from.",
        examples=["3fa85f64-5717-4562-b3fc-2c963f66afa6"],
    )


# ======================================================================
# Read Endpoints
# ======================================================================


@router.get(
    "",
    response_model=PaymentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Payments",
    description=(
        "Retrieve a paginated, filterable list of payments. Supports "
        "filtering by patient, status, payment method, and date range, "
        "plus sorting and pagination. All filters are applied server-side; "
        "no business logic is executed in the transport layer."
    ),
    response_description="Paginated list of payment summaries.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="list_payments",
)
def list_payments(
    patient_id: UUID | None = Query(
        default=None,
        description="Filter by patient UUID.",
    ),
    payment_method: PaymentMethod | None = Query(
        default=None,
        description="Filter by payment method.",
    ),
    status_filter: PaymentStatus | None = Query(
        default=None,
        alias="status",
        description="Filter by payment status (exact match).",
    ),
    date_from: date | None = Query(
        default=None,
        description="Filter payments with payment_date on or after this date.",
    ),
    date_to: date | None = Query(
        default=None,
        description="Filter payments with payment_date on or before this date.",
    ),
    page: int = Query(
        default=1,
        ge=1,
        description="Page number (1-based).",
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Items per page (max 100).",
    ),
    sort_by: str | None = Query(
        default=None,
        description=(
            "Field to sort by. Supported values: "
            "created_at, updated_at, payment_number, payment_date, "
            "total_amount, status, payment_method. "
            "Defaults to created_at when not specified."
        ),
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="Sort direction: 'asc' or 'desc'.",
    ),
    _current_user: User = Depends(
        require_roles(_PAYMENT_READ_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentListResponse:
    """Return a paginated, filtered list of payments.

    Thin handler — validates inbound query parameters, delegates to the
    service layer for search, uses the mapper for response construction.
    """
    items, total = service.search_payments(
        patient_id=patient_id,
        payment_method=payment_method,
        status=status_filter,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return PaymentMapper.to_list_response(
        payments=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentRead,
    status_code=status.HTTP_200_OK,
    summary="Get Payment",
    description=(
        "Retrieve a single payment by its UUID. Returns the full payment "
        "aggregate including allocations, patient summary, financial summary, "
        "gateway metadata, audit timestamps, and versioning information."
    ),
    response_description="Full payment aggregate with nested entities.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
    },
    operation_id="get_payment",
)
def get_payment(
    payment_id: UUID,
    _current_user: User = Depends(
        require_roles(_PAYMENT_READ_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRead:
    """Return a single payment with full aggregate detail.

    Thin handler — delegates existence check to the service layer
    (which raises ``PaymentNotFound`` if missing) and uses the mapper
    for response construction.
    """
    payment = service.get_payment(payment_id)
    return PaymentMapper.to_read(payment)


# ======================================================================
# Create Endpoint
# ======================================================================


@router.post(
    "",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Payment",
    description=(
        "Create a new payment in Pending status. The service layer "
        "reserves a sequential payment number, validates business rules, "
        "persists the aggregate, and returns the full payment "
        "representation. The payment must be completed (POST /{id}/complete) "
        "before it can be allocated to invoices."
    ),
    response_description="The newly created payment in Pending status.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="create_payment",
)
def create_payment(
    body: PaymentCreateRequest,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WRITE_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRead:
    """Create a new payment in Pending status.

    Thin handler — validates the request DTO, delegates creation to the
    service layer, and maps the result to a response DTO.
    """
    payment = service.create_payment(
        patient_id=body.patient_id,
        amount=body.total_amount,
        payment_method=body.payment_method,
        payment_date=body.payment_date,
        created_by=_current_user.id,
        reference_number=body.reference_number,
        notes=body.notes,
    )

    return PaymentMapper.to_read(payment)


# ======================================================================
# Update Endpoint
# ======================================================================


@router.patch(
    "/{payment_id}",
    response_model=PaymentRead,
    status_code=status.HTTP_200_OK,
    summary="Update Pending Payment",
    description=(
        "Update a Pending payment's metadata. Only payments in Pending "
        "status may be edited. Supported updates include reference_number "
        "and notes. The payment is returned with its full aggregate after "
        "the update."
    ),
    response_description="The updated payment with full aggregate.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
        409: {"description": "Payment is not editable (not in Pending status)."},
    },
    operation_id="update_payment",
)
def update_payment(
    payment_id: UUID,
    body: PaymentMetadataUpdateRequest,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WRITE_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRead:
    """Update a Pending payment's metadata.

    Thin handler — validates the request DTO, delegates to the service
    layer, and maps the result to a response DTO. Only reference_number
    and notes are supported as updatable fields.
    """
    payment = service.update_payment(
        payment_id=payment_id,
        updated_by=_current_user.id,
        reference_number=body.reference_number,
        notes=body.notes,
    )

    return PaymentMapper.to_read(payment)


# ======================================================================
# Delete Endpoint
# ======================================================================


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Pending Payment",
    description=(
        "Permanently delete a Pending payment. Only payments in Pending "
        "status may be deleted. This is a hard delete — the payment "
        "record is removed from the database."
    ),
    response_description="No content — payment deleted successfully.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
        409: {"description": "Payment is not editable (not in Pending status)."},
    },
    operation_id="delete_payment",
)
def delete_payment(
    payment_id: UUID,
    _current_user: User = Depends(
        require_roles(_PAYMENT_DELETE_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> None:
    """Permanently delete a Pending payment.

    Thin handler — delegates to the service layer for existence check,
    Pending-status validation, and deletion.
    """
    service.delete_payment(payment_id=payment_id, deleted_by=_current_user.id)


# ======================================================================
# Workflow Endpoints
# ======================================================================


@router.post(
    "/{payment_id}/complete",
    response_model=PaymentRead,
    status_code=status.HTTP_200_OK,
    summary="Complete Payment",
    description=(
        "Transition a payment to Completed status. The service layer "
        "validates the status transition is allowed, updates the status, "
        "creates an audit log entry, and returns the updated payment. "
        "Only payments in Pending status may be completed."
    ),
    response_description="The completed payment.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
        409: {"description": "Invalid status transition — payment is not Pending."},
    },
    operation_id="complete_payment",
)
def complete_payment(
    payment_id: UUID,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WORKFLOW_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRead:
    """Complete a payment.

    Thin handler — delegates to the service layer which handles the
    status transition and audit logging.
    """
    payment = service.complete_payment(
        payment_id=payment_id,
        completed_by=_current_user.id,
    )

    return PaymentMapper.to_read(payment)


@router.post(
    "/{payment_id}/fail",
    response_model=PaymentRead,
    status_code=status.HTTP_200_OK,
    summary="Fail Payment",
    description=(
        "Mark a payment as Failed. An optional reason can be provided "
        "which is recorded in the audit trail. Only payments in a "
        "transition-allowed status may be marked as failed."
    ),
    response_description="The failed payment.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
        409: {"description": "Invalid status transition."},
    },
    operation_id="fail_payment",
)
def fail_payment(
    payment_id: UUID,
    body: PaymentStatusChangeRequest,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WORKFLOW_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRead:
    """Mark a payment as failed.

    Thin handler — delegates to the service layer which handles the
    status transition and audit logging.
    """
    payment = service.fail_payment(
        payment_id=payment_id,
        failed_by=_current_user.id,
        reason=body.reason,
    )

    return PaymentMapper.to_read(payment)


@router.post(
    "/{payment_id}/void",
    response_model=PaymentRead,
    status_code=status.HTTP_200_OK,
    summary="Void Payment",
    description=(
        "Void a payment. An optional reason can be provided which is "
        "recorded in the audit trail. Only payments in a transition-allowed "
        "status may be voided."
    ),
    response_description="The voided payment.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
        409: {"description": "Invalid status transition."},
    },
    operation_id="void_payment",
)
def void_payment(
    payment_id: UUID,
    body: PaymentStatusChangeRequest,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WORKFLOW_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRead:
    """Void a payment.

    Thin handler — delegates to the service layer which handles the
    status transition and audit logging.
    """
    payment = service.void_payment(
        payment_id=payment_id,
        voided_by=_current_user.id,
        reason=body.reason,
    )

    return PaymentMapper.to_read(payment)


# ======================================================================
# Allocation Endpoints
# ======================================================================


@router.post(
    "/{payment_id}/allocate",
    response_model=PaymentAllocationSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Allocate Payment to Invoice",
    description=(
        "Allocate a portion of a completed payment to a specific invoice. "
        "Both the payment and invoice are locked during the operation. "
        "Allocation requires a completed payment and a payable invoice "
        "(Issued, Partially Paid, or Overdue). Returns the newly created "
        "allocation summary."
    ),
    response_description="The newly created payment allocation.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment or invoice not found."},
        409: {
            "description": (
                "Payment is not completed, invoice is not payable, "
                "or duplicate allocation detected."
            )
        },
        422: {
            "description": (
                "Allocation exceeds payment unallocated balance or "
                "invoice outstanding balance."
            )
        },
    },
    operation_id="allocate_payment",
)
def allocate_payment(
    payment_id: UUID,
    body: PaymentAllocateRequest,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WORKFLOW_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> PaymentAllocationSummary:
    """Allocate payment to an invoice.

    Thin handler — validates the request DTO, delegates to the service
    layer for allocation orchestration, and maps the result to a response
    DTO via the mapper.
    """
    allocation = service.allocate_payment(
        payment_id=payment_id,
        invoice_id=body.invoice_id,
        amount=body.amount,
        allocated_by=_current_user.id,
    )

    return PaymentMapper.to_allocation_summary(allocation)


@router.post(
    "/{payment_id}/deallocate",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deallocate Payment from Invoice",
    description=(
        "Remove an existing allocation between a payment and an invoice. "
        "Both the payment and invoice are locked during the operation. "
        "No content is returned on success."
    ),
    response_description="No content — allocation removed successfully.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment, invoice, or allocation not found."},
    },
    operation_id="deallocate_payment",
)
def deallocate_payment(
    payment_id: UUID,
    body: PaymentDeallocateRequest,
    _current_user: User = Depends(
        require_roles(_PAYMENT_WORKFLOW_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> None:
    """Remove a payment allocation from an invoice.

    Thin handler — delegates to the service layer which handles the
    deallocation orchestration and audit logging.
    """
    service.deallocate_payment(
        payment_id=payment_id,
        invoice_id=body.invoice_id,
        deallocated_by=_current_user.id,
    )


@router.get(
    "/{payment_id}/allocations",
    response_model=list[PaymentAllocationSummary],
    status_code=status.HTTP_200_OK,
    summary="List Payment Allocations",
    description=(
        "Retrieve all allocations for a payment. Returns a list of "
        "allocation summaries including the linked invoice, allocated "
        "amount, refund status, and creation timestamp."
    ),
    response_description="List of payment allocation summaries.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Payment not found."},
    },
    operation_id="list_payment_allocations",
)
def list_payment_allocations(
    payment_id: UUID,
    _current_user: User = Depends(
        require_roles(_PAYMENT_READ_ROLES),
    ),
    service: PaymentService = Depends(get_payment_service),
) -> list[PaymentAllocationSummary]:
    """Return all allocations for a payment.

    Thin handler — delegates to the service layer and maps each
    allocation to a summary DTO via the mapper.
    """
    allocations = service.get_allocations(payment_id)
    return [
        PaymentMapper.to_allocation_summary(alloc)
        for alloc in allocations
    ]


__all__ = [
    "router",
]
