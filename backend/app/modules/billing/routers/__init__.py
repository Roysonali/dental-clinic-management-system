"""Billing Module — Router Infrastructure (Sprint 7.1).

This package establishes the routing foundation for the Billing module.
It provides the parent :class:`~fastapi.APIRouter` that future sub-routers
(invoice, payment, receipt, credit note, refund) will be registered into.

Architecture
------------
* ``billing_router`` — parent router bound to ``/billing`` with tag ``Billing``.
  It is the single export point consumed by ``main.py``.
* Future sub-routers are created in sibling modules (e.g. ``invoice.py``,
  ``payment.py``) and attached here via ``include_router(...)``,
  keeping the registration point visible in a single location.
* The common error responses dict (``_COMMON_ERROR_RESPONSES``) is shared by all
  billing routers for consistent OpenAPI documentation.

Usage (once sub-routers exist)::

    from app.modules.billing.routers.invoice import router as invoice_router
    billing_router.include_router(invoice_router)

Transport-layer only — no SQLAlchemy, no repositories, no validators,
no business logic, no calculations, no transactions.
"""

from __future__ import annotations

from fastapi import APIRouter

# ======================================================================
# Parent Billing Router
# ======================================================================

billing_router = APIRouter(
    prefix="/billing",
    tags=["Billing"],
)

# ======================================================================
# Shared OpenAPI error responses
#
# Used by every billing router via the ``responses`` parameter of each
# endpoint decorator. The actual error payloads are produced by the global
# exception handlers in ``app.core.exception_handlers``.
# ======================================================================

_COMMON_ERROR_RESPONSES: dict[int, dict[str, object]] = {
    401: {"description": "Not authenticated."},
    403: {"description": "Insufficient permissions."},
    404: {"description": "Billing resource not found."},
    409: {"description": "Conflict or invalid state transition."},
    422: {"description": "Request validation or financial integrity failed."},
}

# ======================================================================
# Sub-router registration
#
# Future sub-routers are registered below as they are implemented.
# ======================================================================

from app.modules.billing.routers.invoice import router as invoice_router  # noqa: E402

billing_router.include_router(invoice_router)

from app.modules.billing.routers.payment import router as payment_router  # noqa: E402

billing_router.include_router(payment_router)

from app.modules.billing.routers.receipt import router as receipt_router  # noqa: E402

billing_router.include_router(receipt_router)

from app.modules.billing.routers.refund import router as refund_router  # noqa: E402

billing_router.include_router(refund_router)

from app.modules.billing.routers.credit_note import router as credit_note_router  # noqa: E402

billing_router.include_router(credit_note_router)

from app.modules.billing.routers.dashboard import router as dashboard_router  # noqa: E402

billing_router.include_router(dashboard_router)
# ======================================================================

__all__ = [
    "billing_router",
    "_COMMON_ERROR_RESPONSES",
]
