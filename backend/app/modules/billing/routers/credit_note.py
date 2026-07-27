"""Billing Module — Credit Note Router (Sprint 7.4).

REST endpoints for the Credit Note aggregate covering create and workflow
operations.

Endpoints
---------
* ``POST /billing/credit-notes`` — Create a new credit note in Draft status.
* ``POST /billing/credit-notes/{credit_note_id}/issue`` — Issue a Draft credit note.
* ``POST /billing/credit-notes/{credit_note_id}/void`` — Void a credit note.
* ``POST /billing/credit-notes/{credit_note_id}/apply`` — Apply an issued credit note.

NOT implemented
---------------
* ``GET /billing/credit-notes`` — Not available; ``CreditNoteService`` does not
  expose a search/list method in the current sprint.
* ``GET /billing/credit-notes/{id}`` — Not available; ``CreditNoteService`` does not
  expose a get-by-id method in the current sprint.
* ``PATCH /billing/credit-notes/{id}`` — Not available; ``CreditNoteService`` does not
  expose an update method in the current sprint.
* ``DELETE /billing/credit-notes/{id}`` — Not available; ``CreditNoteService`` does not
  expose a delete method in the current sprint.

Architecture
------------
* **Transport layer only** — no SQLAlchemy, no repositories, no validators,
  no business logic, no calculations, no transactions.
* **Thin handlers** — authenticate, authorise, invoke the service, return a
  DTO via the mapper. Nothing else.
* **Dependency injection** — ``CreditNoteService`` is wired via
  :func:`get_credit_note_service` which constructs the full stack per request.

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
from app.modules.billing.dependencies import get_credit_note_service
from app.modules.billing.mappers.credit_note_mapper import CreditNoteMapper
from app.modules.billing.routers import _COMMON_ERROR_RESPONSES
from app.modules.billing.schemas.credit_note import (
    CreditNoteCreateRequest,
    CreditNoteRead,
    CreditNoteVoidRequest,
)
from app.modules.billing.services.credit_note_service import CreditNoteService
from app.modules.rbac.permissions import require_roles

# ======================================================================
# Router — bound to /billing/credit-notes via the parent billing_router
# ======================================================================

router = APIRouter(
    prefix="/credit-notes",
    tags=["Credit Notes"],
)

# Roles permitted to create credit notes (draft).
_CREDIT_NOTE_WRITE_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Roles permitted to perform credit note workflow operations (issue, void, apply).
_CREDIT_NOTE_WORKFLOW_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    *DOCTOR_ROLES,
]


# ======================================================================
# Create Endpoint
# ======================================================================


@router.post(
    "",
    response_model=CreditNoteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create Credit Note",
    description=(
        "Create a new credit note in Draft status. The service layer "
        "validates the invoice exists, validates the amount against "
        "the invoice grand total, reserves a sequential credit note "
        "number (CN- prefix), persists the credit note aggregate, "
        "creates an audit log entry, and returns the full credit note "
        "representation. The credit note must be issued "
        "(POST /{id}/issue) before it can be applied."
    ),
    response_description="The newly created credit note in Draft status.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="create_credit_note",
)
def create_credit_note(
    body: CreditNoteCreateRequest,
    _current_user: User = Depends(
        require_roles(_CREDIT_NOTE_WRITE_ROLES),
    ),
    service: CreditNoteService = Depends(get_credit_note_service),
) -> CreditNoteRead:
    """Create a new credit note in Draft status.

    Thin handler — validates the request DTO, delegates creation to the
    service layer, and maps the result to a response DTO via the mapper.
    """
    credit_note = service.create_credit_note(
        invoice_id=body.invoice_id,
        patient_id=body.patient_id,
        amount=body.amount,
        reason=body.reason,
        created_by=_current_user.id,
        expiry_date=body.expiry_date,
    )
    return CreditNoteMapper.to_read(credit_note)


# ======================================================================
# Workflow Endpoints
# ======================================================================


@router.post(
    "/{credit_note_id}/issue",
    response_model=CreditNoteRead,
    status_code=status.HTTP_200_OK,
    summary="Issue Credit Note",
    description=(
        "Issue a Draft credit note, transitioning from DRAFT to ISSUED "
        "status. The service layer validates the status transition, sets "
        "the issue date, creates an audit log entry, and returns the "
        "updated credit note. Once issued, the credit note becomes "
        "eligible for application to invoices or voiding."
    ),
    response_description="The issued credit note.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Credit note not found."},
        409: {"description": "Invalid status transition — credit note is not Draft."},
    },
    operation_id="issue_credit_note",
)
def issue_credit_note(
    credit_note_id: UUID,
    _current_user: User = Depends(
        require_roles(_CREDIT_NOTE_WORKFLOW_ROLES),
    ),
    service: CreditNoteService = Depends(get_credit_note_service),
) -> CreditNoteRead:
    """Issue a Draft credit note, assigning a permanent sequential number.

    Thin handler — delegates to the service layer which handles the
    state transition, issue date, and audit logging.
    """
    credit_note = service.issue_credit_note(
        credit_note_id=credit_note_id,
        issued_by=_current_user.id,
    )
    return CreditNoteMapper.to_read(credit_note)


@router.post(
    "/{credit_note_id}/void",
    response_model=CreditNoteRead,
    status_code=status.HTTP_200_OK,
    summary="Void Credit Note",
    description=(
        "Void a credit note from DRAFT or ISSUED status. A void reason "
        "is required and is recorded in the audit trail. The service layer "
        "validates the status transition, sets void metadata, creates an "
        "audit log entry, and returns the voided credit note."
    ),
    response_description="The voided credit note.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Credit note not found."},
        409: {"description": "Invalid status transition — credit note is in a terminal state."},
        422: {"description": "Void reason is required."},
    },
    operation_id="void_credit_note",
)
def void_credit_note(
    credit_note_id: UUID,
    body: CreditNoteVoidRequest,
    _current_user: User = Depends(
        require_roles(_CREDIT_NOTE_WORKFLOW_ROLES),
    ),
    service: CreditNoteService = Depends(get_credit_note_service),
) -> CreditNoteRead:
    """Void a credit note.

    Thin handler — delegates to the service layer which handles the
    validation, status transition, and audit logging.
    """
    credit_note = service.void_credit_note(
        credit_note_id=credit_note_id,
        voided_by=_current_user.id,
        void_reason=body.void_reason,
    )
    return CreditNoteMapper.to_read(credit_note)


@router.post(
    "/{credit_note_id}/apply",
    response_model=CreditNoteRead,
    status_code=status.HTTP_200_OK,
    summary="Apply Credit Note",
    description=(
        "Apply an issued credit note, transitioning from ISSUED to APPLIED "
        "status. The service layer validates that the credit note is "
        "applicable (ISSUED, not expired, remaining balance > 0), "
        "sets the remaining balance to zero, creates an audit log entry, "
        "and returns the applied credit note."
    ),
    response_description="The applied credit note.",
    responses={
        **_COMMON_ERROR_RESPONSES,
        404: {"description": "Credit note not found."},
        409: {
            "description": (
                "Invalid status transition — credit note is not Issued, "
                "is expired, or has zero remaining balance."
            )
        },
    },
    operation_id="apply_credit_note",
)
def apply_credit_note(
    credit_note_id: UUID,
    _current_user: User = Depends(
        require_roles(_CREDIT_NOTE_WORKFLOW_ROLES),
    ),
    service: CreditNoteService = Depends(get_credit_note_service),
) -> CreditNoteRead:
    """Apply an issued credit note.

    Thin handler — delegates to the service layer which handles the
    validation, status transition, balance update, and audit logging.
    """
    credit_note = service.apply_credit_note(
        credit_note_id=credit_note_id,
        applied_by=_current_user.id,
    )
    return CreditNoteMapper.to_read(credit_note)


__all__ = [
    "router",
]
