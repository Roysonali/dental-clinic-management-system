"""
Audit Log API Router
====================

Production-grade read-only FastAPI router for querying patient record
audit logs.

Every endpoint enforces:
* **Read only** - no create, update, or delete operations.
* **Immutability** - audit logs are append-only; once written they can
  never be modified or deleted (enforced by the repository layer).
* **Admin restrictions** - only ADMIN and CHIEF_DOCTOR roles can query
  audit logs, as they contain sensitive action history.
* **Pagination** - all list endpoints support page / page_size.
* **OpenAPI metadata** - every route carries a summary, description,
  and response description for generated docs.

Domain exceptions propagate to the global
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

from app.modules.auth.models import User
from app.modules.patient_records.dependencies.patient_record_dependencies import (
    get_audit_log_service,
)
from app.modules.patient_records.dependencies.permissions import (
    require_audit_read,
)
from app.modules.patient_records.schemas.audit_schema import (
    AuditListResponse,
    AuditResponse,
)
from app.modules.patient_records.exceptions import PatientRecordNotFound
from app.modules.patient_records.services import AuditLogService

# ---------------------------------------------------------------------------
# Router definition
#
# Two routers are used so that:
#   - Record-specific endpoint: /patient-records/{record_id}/audit
#   - Standalone endpoints: /audit/{audit_id} and /audit/user/{user_id}
#
# All endpoints are read-only and require admin-level access
# (ADMIN or CHIEF_DOCTOR).
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/patient-records/{record_id}/audit",
    tags=["Audit Logs"],
)

item_router = APIRouter(
    prefix="/audit",
    tags=["Audit Logs"],
)


# ======================================================================
# GET /patient-records/{record_id}/audit
# ======================================================================


@router.get(
    "",
    response_model=AuditListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Audit Logs (by Record)",
    description=(
        "Retrieve a paginated list of audit log entries for a specific "
        "patient record.  Results are ordered by most-recent first.  "
        "Requires admin-level access (ADMIN or CHIEF_DOCTOR)."
    ),
    response_description="Paginated list of audit log entries.",
)
def list_audits_by_record(
    record_id: UUID,
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
    current_user: User = Depends(require_audit_read),
    service: AuditLogService = Depends(get_audit_log_service),
) -> AuditListResponse:
    """Return paginated audit entries for a patient record."""
    items, total = service.get_audits_by_record(
        patient_record_id=record_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return AuditListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


# ======================================================================
# GET /audit/{audit_id}
# ======================================================================


@item_router.get(
    "/{audit_id}",
    response_model=AuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Audit Entry",
    description=(
        "Retrieve a single audit log entry by its UUID.  Returns 404 "
        "if the entry does not exist.  Requires admin-level access "
        "(ADMIN or CHIEF_DOCTOR)."
    ),
    response_description="The full audit log entry.",
)
def get_audit_entry(
    audit_id: UUID,
    current_user: User = Depends(require_audit_read),
    service: AuditLogService = Depends(get_audit_log_service),
) -> AuditResponse:
    """Get a single audit log entry by UUID."""
    audit = service.get_audit(audit_id)

    if audit is None:
        raise PatientRecordNotFound(
            details={"audit_id": str(audit_id)},
        )

    return audit


# ======================================================================
# GET /audit/user/{user_id}
# ======================================================================


@item_router.get(
    "/user/{user_id}",
    response_model=AuditListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Audit Logs (by User)",
    description=(
        "Retrieve a paginated list of audit log entries performed by "
        "a specific user.  Results are ordered by most-recent first.  "
        "Requires admin-level access (ADMIN or CHIEF_DOCTOR)."
    ),
    response_description="Paginated list of audit log entries for the user.",
)
def list_audits_by_user(
    user_id: int,
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
    current_user: User = Depends(require_audit_read),
    service: AuditLogService = Depends(get_audit_log_service),
) -> AuditListResponse:
    """Return paginated audit entries for a specific user."""
    items, total = service.get_audits_by_user(
        user_id=user_id,
        page=page,
        page_size=page_size,
    )

    pages = math.ceil(total / page_size) if page_size > 0 else 0

    return AuditListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
