"""Billing Module — Invoice Router (Sprints 7.2A, 7.2B, 7.2C).

Complete REST endpoints for the Invoice aggregate covering read, create,
update, and workflow operations.

Endpoints
---------
* ``GET /billing/invoices`` — Paginated, filterable, sortable invoice list.
* ``GET /billing/invoices/{invoice_id}`` — Single invoice with full aggregate.
* ``POST /billing/invoices`` — Create a new invoice in Draft status.
* ``PATCH /billing/invoices/{invoice_id}`` — Update a Draft invoice.
* ``POST /billing/invoices/{invoice_id}/issue`` — Issue a Draft invoice.
* ``POST /billing/invoices/{invoice_id}/cancel`` — Cancel an invoice.
* ``DELETE /billing/invoices/{invoice_id}`` — Delete a Draft invoice.

Architecture
------------
* **Transport layer only** — no SQLAlchemy, no repositories, no validators,
  no business logic, no calculations, no transactions.
* **Thin handlers** — authenticate, authorise, invoke the service, return a
  DTO via the mapper. Nothing else.
* **Dependency injection** — ``InvoiceService`` is wired via
  :func:`get_invoice_service` which constructs the full stack
  (repository → validator → service) per request.
* **Response models** — Pydantic DTOs from the approved schema layer.
  ORM models are never returned directly.
* **Error responses** — use the shared ``_COMMON_ERROR_RESPONSES`` dict from
  the router package init for consistent OpenAPI documentation. Actual HTTP
  error payloads are produced by the global exception handlers.

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

import uuid
from datetime import date
from typing import Any
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
from app.modules.billing.dependencies import get_invoice_service
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.mappers.invoice_mapper import InvoiceMapper
from app.modules.billing.routers import _COMMON_ERROR_RESPONSES
from app.modules.billing.schemas.base import BillingBaseModel
from app.modules.billing.schemas.invoice import (
    InvoiceCreateRequest,
    InvoiceDraftUpdateRequest,
    InvoiceListResponse,
    InvoiceRead,
)
from app.modules.billing.schemas.invoice_item import InvoiceItemCreate
from app.modules.billing.services.invoice_service import InvoiceService
from app.modules.rbac.permissions import require_roles

# ======================================================================
# Router — bound to /billing/invoices via the parent billing_router
# ======================================================================

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
)

# Roles permitted to read invoices.
_INVOICE_READ_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to create and edit draft invoices.
_INVOICE_WRITE_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to issue and cancel invoices.
_INVOICE_WORKFLOW_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]

# Roles permitted to delete draft invoices.
_INVOICE_DELETE_ROLES: list[str] = [
    ROLE_ADMIN,
]


# ======================================================================
# Sprint 7.2B — Invoice Creation
# ======================================================================


@router.post(
    "",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Invoice",
    description=(
        "Create a new invoice in Draft status with the provided line items. "
        "The service layer assigns a temporary draft invoice number, validates "
        "business rules, persists the aggregate, and returns the full invoice "
        "representation. The invoice must be issued (POST /{id}/issue) before "
        "it becomes a financial document."
    ),
    response_description="The newly created invoice in Draft status.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="create_invoice",
)
def create_invoice(
    body: InvoiceCreateRequest,
    _current_user: User = Depends(
        require_roles(_INVOICE_WRITE_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceRead:
    """Create a new invoice in Draft status.

    Thin handler — validates the request DTO, generates a temporary draft
    invoice number, converts line items to the service-layer format,
    delegates creation to the service, and maps the result to a response DTO.
    """
    # Generate a temporary draft invoice number for the validation step.
    # This placeholder is replaced with a proper sequenced number when the
    # invoice is issued via POST /{invoice_id}/issue.
    temp_invoice_number = f"DRAFT-{uuid.uuid4().hex[:8].upper()}"

    # Convert InvoiceItemCreate objects to raw dicts for the service layer.
    items_data: list[dict[str, Any]] = [
        {
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "discount_type": item.discount_type,
            "discount_value": item.discount_value,
            "sequence_number": item.sequence_number,
            "plan_item_id": item.plan_item_id,
            "diagnosis_id": item.diagnosis_id,
            "original_price": item.original_price,
            "override_reason": item.override_reason,
            "net_amount": item.net_amount,
        }
        for item in body.items
    ]

    invoice = service.create_invoice(
        patient_id=body.patient_id,
        invoice_number=temp_invoice_number,
        currency_code=body.currency_code,
        items=items_data,
        created_by=_current_user.id,
        treatment_plan_id=body.treatment_plan_id,
        appointment_id=body.appointment_id,
        doctor_id=body.doctor_id,
        notes=body.notes,
        due_date=body.due_date,
        invoice_date=body.invoice_date,
    )

    return InvoiceMapper.to_read(invoice)


# ======================================================================
# Sprint 7.2C — Invoice Update & Workflow
# ======================================================================


# ---- PATCH /billing/invoices/{invoice_id} ---------------------------


@router.patch(
    "/{invoice_id}",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    summary="Update Draft Invoice",
    description=(
        "Update a Draft invoice's metadata and/or line items. Only invoices "
        "in Draft status may be edited. Supported updates include notes, "
        "due date, and replacement line items. The invoice is returned with "
        "its full aggregate after the update."
    ),
    response_description="The updated invoice with full aggregate.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Invoice not found."},
        409: {"description": "Invoice is not editable (not in Draft status)."},
    },
    operation_id="update_draft_invoice",
)
def update_draft_invoice(
    invoice_id: UUID,
    body: InvoiceDraftUpdateRequest,
    _current_user: User = Depends(
        require_roles(_INVOICE_WRITE_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceRead:
    """Update a Draft invoice's metadata and optionally replace line items.

    Thin handler — validates the request DTO, delegates to the service
    layer, and maps the result to a response DTO. Only notes and due_date
    are supported as updatable metadata fields in this sprint.
    """
    invoice = service.update_draft_invoice(
        invoice_id=invoice_id,
        updated_by=_current_user.id,
        notes=body.notes,
        due_date=body.due_date,
        items=None,  # Line item replacement is not exposed via this sprint.
    )

    return InvoiceMapper.to_read(invoice)


# ---- POST /billing/invoices/{invoice_id}/issue ----------------------


@router.post(
    "/{invoice_id}/issue",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    summary="Issue Invoice",
    description=(
        "Transition a Draft invoice to Issued status. The service layer "
        "reserves a sequential invoice number from the document sequence, "
        "transitions the status, creates an audit log entry, and returns "
        "the updated invoice. Once issued, the invoice becomes immutable."
    ),
    response_description="The issued invoice with a permanent invoice number.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Invoice not found."},
        409: {
            "description": (
                "Invalid status transition or invoice is not issuable "
                "(e.g. missing line items)."
            )
        },
        422: {"description": "Document sequence configuration error."},
    },
    operation_id="issue_invoice",
)
def issue_invoice(
    invoice_id: UUID,
    _current_user: User = Depends(
        require_roles(_INVOICE_WORKFLOW_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceRead:
    """Issue a Draft invoice, assigning a permanent sequential number.

    Thin handler — delegates to the service layer which handles the
    state transition, document numbering, and audit logging.
    """
    invoice = service.issue_invoice(
        invoice_id=invoice_id,
        issued_by=_current_user.id,
    )

    return InvoiceMapper.to_read(invoice)


# ---- POST /billing/invoices/{invoice_id}/cancel ---------------------


class CancelInvoiceRequest(BillingBaseModel):
    """Request body for cancelling an invoice."""

    cancellation_reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        title="Cancellation Reason",
        description="Required reason for cancelling the invoice.",
        examples=["Patient requested cancellation before treatment."],
    )


@router.post(
    "/{invoice_id}/cancel",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    summary="Cancel Invoice",
    description=(
        "Cancel an invoice from any non-terminal status. A cancellation "
        "reason is required. The invoice transitions to Cancelled status, "
        "an audit log entry is created, and the updated invoice is returned. "
        "Terminal invoices (already Cancelled or Voided) cannot be cancelled."
    ),
    response_description="The cancelled invoice.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Invoice not found."},
        409: {
            "description": (
                "Invalid status transition — invoice is in a terminal "
                "state or cancellation is not permitted."
            )
        },
        422: {"description": "Cancellation reason is required."},
    },
    operation_id="cancel_invoice",
)
def cancel_invoice(
    invoice_id: UUID,
    body: CancelInvoiceRequest,
    _current_user: User = Depends(
        require_roles(_INVOICE_WORKFLOW_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceRead:
    """Cancel an invoice from a non-terminal status.

    Thin handler — delegates to the service layer which handles the
    state transition, status history, and audit logging.
    """
    invoice = service.cancel_invoice(
        invoice_id=invoice_id,
        cancelled_by=_current_user.id,
        cancellation_reason=body.cancellation_reason,
    )

    return InvoiceMapper.to_read(invoice)


# ---- DELETE /billing/invoices/{invoice_id} --------------------------


@router.delete(
    "/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Draft Invoice",
    description=(
        "Permanently delete a Draft invoice. Only invoices in Draft "
        "status may be deleted. This is a hard delete — the invoice "
        "record and its line items are removed from the database."
    ),
    response_description="No content — invoice deleted successfully.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Invoice not found."},
        409: {"description": "Invoice is not editable (not in Draft status)."},
    },
    operation_id="delete_draft_invoice",
)
def delete_draft_invoice(
    invoice_id: UUID,
    _current_user: User = Depends(
        require_roles(_INVOICE_DELETE_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> None:
    """Permanently delete a Draft invoice.

    Thin handler — delegates to the service layer for existence check,
    Draft-status validation, and deletion.
    """
    service.delete_draft_invoice(invoice_id=invoice_id)


# ======================================================================
# Sprint 7.2A — Invoice Read Endpoints (existing)
# ======================================================================


@router.get(
    "",
    response_model=InvoiceListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Invoices",
    description=(
        "Retrieve a paginated, filterable list of invoices. Supports "
        "free-text search across invoice number and patient name, filtering "
        "by patient, doctor, status, and date range, plus sorting and "
        "pagination. All filters are applied server-side; no business "
        "logic is executed in the transport layer."
    ),
    response_description="Paginated list of invoice summaries.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="list_invoices",
)
def list_invoices(
    query: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
        description="Free-text search across invoice number and patient name.",
    ),
    patient_id: UUID | None = Query(
        default=None,
        description="Filter by patient UUID.",
    ),
    doctor_id: UUID | None = Query(
        default=None,
        description="Filter by doctor UUID.",
    ),
    status_filter: InvoiceStatus | None = Query(
        default=None,
        alias="status",
        description="Filter by invoice status (exact match, case-sensitive).",
    ),
    date_from: date | None = Query(
        default=None,
        description="Filter invoices with invoice_date on or after this date.",
    ),
    date_to: date | None = Query(
        default=None,
        description="Filter invoices with invoice_date on or before this date.",
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
            "created_at, updated_at, invoice_number, due_date, status. "
            "Defaults to created_at when not specified."
        ),
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
        description="Sort direction: 'asc' or 'desc'.",
    ),
    _current_user: User = Depends(
        require_roles(_INVOICE_READ_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceListResponse:
    """Return a paginated, filtered list of invoices.

    Thin handler — validates inbound query parameters, delegates to the
    service layer for search, uses the mapper for response construction.
    """
    items: list[Any]
    total: int

    items, total = service.search_invoices(
        term=query,
        patient_id=patient_id,
        doctor_id=doctor_id,
        status=status_filter,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return InvoiceMapper.to_list_response(
        invoices=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{invoice_id}",
    response_model=InvoiceRead,
    status_code=status.HTTP_200_OK,
    summary="Get Invoice",
    description=(
        "Retrieve a single invoice by its UUID. Returns the full invoice "
        "aggregate including line items, patient summary, doctor summary, "
        "treatment plan, appointment, financial summary, audit timestamps, "
        "and versioning information."
    ),
    response_description="Full invoice aggregate with nested entities.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Invoice not found."},
    },
    operation_id="get_invoice",
)
def get_invoice(
    invoice_id: UUID,
    _current_user: User = Depends(
        require_roles(_INVOICE_READ_ROLES),
    ),
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceRead:
    """Return a single invoice with full aggregate detail.

    Thin handler — delegates existence check to the service layer
    (which raises ``InvoiceNotFound`` if missing) and uses the mapper
    for response construction.
    """
    invoice = service.get_invoice(invoice_id)
    return InvoiceMapper.to_read(invoice)


__all__ = [
    "router",
]
