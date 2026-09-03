"""Billing Module — Dashboard & Financial Summary Router (Sprint 7.5).

REST endpoints for billing reporting and dashboard views covering
system-wide financial totals and recent activity.

Endpoints
---------
* ``GET /billing/dashboard`` — Full dashboard with totals + recent activity.
* ``GET /billing/summary`` — System-wide financial totals summary.

NOT implemented
---------------
The following reporting endpoints are **not** available in the current
sprint because no service methods exist:

* ``GET /billing/revenue`` — No service method.
* ``GET /billing/outstanding`` — No service method.
* ``GET /billing/cashflow`` — No service method.
* ``GET /billing/aging`` — No service method.
* ``GET /billing/daily`` — No service method.
* ``GET /billing/monthly`` — No service method.
* ``GET /billing/yearly`` — No service method.
* ``GET /billing/statistics`` — No service method.
* ``GET /billing/kpis`` — No service method.

Architecture
------------
* **Transport layer only** — no SQLAlchemy, no repositories, no validators,
  no business logic, no calculations, no transactions.
* **Thin handlers** — authenticate, authorise, invoke the service, map to
  DTOs. Nothing else.
* **Dependency injection** — ``BillingOrchestrationService`` is wired via
  :func:`get_billing_orchestration_service` which constructs the full stack
  per request.
* **Mapper reuse** — ``InvoiceMapper.to_list_item()`` and
  ``PaymentMapper.to_list_item()`` are used to convert ORM models in the
  dashboard response. No new mapping logic required.

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

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.constants import (
    DOCTOR_ROLES,
    ROLE_ADMIN,
    ROLE_DENTAL_ASSISTANT,
    ROLE_RECEPTIONIST,
    ROLE_CHIEF_DOCTOR,
)
from app.modules.auth.models import User
from app.modules.billing.dependencies import (
    get_billing_orchestration_service,
)
from app.modules.billing.mappers.billing_dashboard_mapper import (
    BillingDashboardMapper,
)
from app.modules.billing.routers import _COMMON_ERROR_RESPONSES
from app.modules.billing.schemas.dashboard import (
    BillingDashboardResponse,
    BillingTotalsResponse,
)
from app.modules.billing.services.billing_orchestration_service import (
    BillingOrchestrationService,
)
from app.modules.rbac.permissions import require_roles

# ======================================================================
# Router — bound to /billing via the parent billing_router
# ======================================================================

router = APIRouter(
    prefix="",
    tags=["Billing Reports"],
)

# Roles permitted to read billing reports and dashboards.
# Operational billing (invoices, payments) retains wider access — only
# aggregate revenue/analytics is ADMIN-only per the RBAC security policy.
_REPORT_READ_ROLES: list[str] = [
    ROLE_ADMIN,
    ROLE_RECEPTIONIST,
    ROLE_DENTAL_ASSISTANT,
    *DOCTOR_ROLES,
]

# Revenue-sensitive roles — aggregate clinic financial data is visible
# only to the ADMIN role.  Chief doctors, receptionists, doctors and
# assistants may perform operational billing work (invoices, payments)
# but must not see system-wide revenue totals.
_REVENUE_READ_ROLES: list[str] = [
    ROLE_ADMIN,
]


# ======================================================================
# Dashboard Endpoint
# ======================================================================


@router.get(
    "/dashboard",
    response_model=BillingDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Billing Dashboard",
    description=(
        "Returns the full billing dashboard including system-wide financial "
        "totals (total invoiced, collected, refunded, outstanding, credited, "
        "and entity counts), the 5 most recent invoices, the 5 most recent "
        "payments, and an optional patient-level financial summary when a "
        "patient_id filter is provided."
    ),
    response_description="Billing dashboard with totals and recent activity.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="get_billing_dashboard",
)
def get_billing_dashboard(
    patient_id: UUID | None = Query(
        default=None,
        title="Patient ID",
        description="Optional patient UUID to include a patient-level financial summary.",
    ),
    _current_user: User = Depends(
        require_roles(_REVENUE_READ_ROLES),
    ),
    service: BillingOrchestrationService = Depends(get_billing_orchestration_service),
) -> BillingDashboardResponse:
    """Return the billing dashboard with aggregated totals and recent activity.

    Thin handler — delegates to the service and mapper. No calculations,
    no DTO construction, no timestamp generation performed here.

    Revenue visibility is restricted to ADMIN — non-admin roles receive
    403 Forbidden per the RBAC security policy.
    """
    result = service.get_billing_dashboard(patient_id=patient_id)
    return BillingDashboardMapper.to_dashboard_response(result)


# ======================================================================
# Summary Endpoint
# ======================================================================


@router.get(
    "/summary",
    response_model=BillingTotalsResponse,
    status_code=status.HTTP_200_OK,
    summary="Billing Summary",
    description=(
        "Returns aggregate billing-wide financial totals only: total "
        "invoiced, collected, refunded, outstanding, credited, and entity "
        "counts. This is a lightweight alternative to the full dashboard "
        "for use in widgets and embedded views."
    ),
    response_description="Billing-wide financial totals summary.",
    responses=_COMMON_ERROR_RESPONSES,
    operation_id="get_billing_summary",
)
def get_billing_summary(
    _current_user: User = Depends(
        require_roles(_REVENUE_READ_ROLES),
    ),
    service: BillingOrchestrationService = Depends(get_billing_orchestration_service),
) -> BillingTotalsResponse:
    """Return system-wide financial totals.

    Thin handler — delegates to the service and mapper. No calculations,
    no DTO construction performed here.

    Revenue visibility is restricted to ADMIN — non-admin roles receive
    403 Forbidden per the RBAC security policy.
    """
    result = service.get_billing_dashboard(patient_id=None)
    return BillingDashboardMapper.to_totals_response(result.totals)


__all__ = [
    "router",
]
