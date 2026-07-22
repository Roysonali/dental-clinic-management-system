"""Billing module — base service class.

Provides minimal shared infrastructure for all billing services:

- Injected SQLAlchemy session
- Module-level logger
- Shared transaction helper (commit with defensive rollback)

This class is intentionally lightweight. It does NOT provide:
- CRUD methods
- Repository methods
- Business logic
- Invoice / payment / document sequence logic
- Transaction decorators
- Generic service locator
- Reflection or magic dependency injection
"""

from __future__ import annotations

import logging

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class BaseService:
    """Minimal base class for billing services.

    Args:
        db: The active SQLAlchemy ``Session``. The service layer owns
            commit and rollback on this session.
    """

    def __init__(self, db: Session) -> None:
        self._db = db
        self._logger = logger

    def _commit(self) -> None:
        """Commit the current transaction.

        Rolls back on any ``IntegrityError`` or ``SQLAlchemyError`` and
        re-raises the original exception so the caller never sees stale
        transaction state.

        Raises:
            The original exception after rollback.
        """
        try:
            self._db.commit()
        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            self._logger.exception(
                "Database error during commit — transaction rolled back"
            )
            raise


__all__ = ["BaseService"]
