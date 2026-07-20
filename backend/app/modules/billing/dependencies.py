"""Billing Module — Dependency injection.

Foundation-stage dependency providers for the Billing module.

This file establishes the FastAPI dependency plumbing without constructing
repositories, validators, or services (those are implemented in a later
sprint). It re-exports the shared SQLAlchemy session dependency
(``get_db``) so that every billing dependency resolves the request-scoped
``Session`` from a single, consistent source, and provides a structured
logger accessor used across the module.

Later sprints extend this module with factory functions such as
``get_invoice_service`` that build the full stack
(repository → validator → service) per request, exactly like the Treatment
Plan module's ``dependencies.py``.

Architecture boundary
---------------------
* Dependencies never store request-scoped state on module globals.
* Dependencies never commit, roll back, or manage the session lifecycle — that
  remains the responsibility of :func:`app.database.session.get_db`.
"""

from __future__ import annotations

import logging

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database.session import get_db


def get_billing_logger() -> logging.Logger:
    """Return the structured logger for the billing module.

    Centralizes logger naming so every billing layer logs under the same
    namespace (``app.modules.billing``).

    Returns:
        A :class:`logging.Logger` bound to the billing module.
    """
    return logging.getLogger("app.modules.billing")


def get_billing_session(
    db: Session = Depends(get_db),
) -> Session:
    """Provide the request-scoped SQLAlchemy session for billing handlers.

    Thin, typed wrapper around the application-wide ``get_db`` dependency so
    billing routers/services depend on a single, explicit provider.

    Args:
        db: Session injected by FastAPI's ``get_db``.

    Returns:
        The active :class:`~sqlalchemy.orm.Session`.
    """
    return db


__all__ = [
    "get_db",
    "get_billing_logger",
    "get_billing_session",
]
