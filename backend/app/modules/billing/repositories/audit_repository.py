"""AuditRepository — aggregate root repository for billing audit logs.

This repository manages the ``BillingAuditLog`` aggregate root. Audit logs are
append-only and are never modified after insert (FI-AUD-003).

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``exists``, ``count``.
* **Listing / filtering**: ``list``, ``find_by_entity``.
* **Statistics**: ``count_by_entity_type``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` but never ``commit()`` / ``rollback()``. Logging is query-level
only; business events are logged by the service layer.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    func,
    select,
)
from sqlalchemy.orm import Session

from app.modules.billing.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
)
from app.modules.billing.models import BillingAuditLog

logger = logging.getLogger(__name__)


class AuditRepository:
    """Data access layer for the ``BillingAuditLog`` aggregate root.

    Encapsulates all SQLAlchemy query logic for billing audit log persistence
    and exposes domain-specific method signatures for the service layer to
    consume.
    """

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "changed_at": BillingAuditLog.changed_at,
        "action": BillingAuditLog.action,
        "entity_type": BillingAuditLog.entity_type,
    }

    _ALLOWED_SORT_FIELDS: frozenset[str] = frozenset(_SORT_FIELDS)

    _DEFAULT_SORT_FIELD = "changed_at"

    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _normalize_pagination(page: int, page_size: int) -> tuple[int, int]:
        """Clamp pagination inputs to sane bounds."""
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = DEFAULT_PAGE_SIZE
        elif page_size > MAX_PAGE_SIZE:
            page_size = MAX_PAGE_SIZE
        return page, page_size

    @classmethod
    def _resolve_sort_field(cls, sort_by: Optional[str]) -> str:
        """Return ``sort_by`` if allowed, otherwise the default sort field."""
        if sort_by in cls._ALLOWED_SORT_FIELDS:
            return sort_by
        return cls._DEFAULT_SORT_FIELD

    # ---------------------------------------------------------------- create
    def create(self, audit_log: BillingAuditLog) -> BillingAuditLog:
        """Persist a new audit log entry and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``BillingAuditLog`` has no server-defaulted columns
        that require a round-trip. The service layer owns the transaction.
        """
        self.db.add(audit_log)
        self.db.flush()
        return audit_log

    # ----------------------------------------------------------------- read
    def get_by_id(self, audit_log_id: UUID) -> Optional[BillingAuditLog]:
        """Fetch an audit log entry by its UUID primary key."""
        return self.db.get(BillingAuditLog, audit_log_id)

    # ------------------------------------------------------------- existence
    def exists(self, audit_log_id: UUID) -> bool:
        """Return ``True`` if an audit log entry with the given id exists."""
        stmt = (
            select(BillingAuditLog.id)
            .where(BillingAuditLog.id == audit_log_id)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    def count(self) -> int:
        """Count all billing audit log entries."""
        stmt = select(func.count()).select_from(BillingAuditLog)
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        action: str | None = None,
        changed_by: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[BillingAuditLog], int]:
        """Return a paginated, filterable list of billing audit log entries.

        Args:
            entity_type: Filter by entity type (e.g. ``'invoice'``,
                ``'payment'``).
            entity_id: Filter by entity UUID.
            action: Filter by audit action verb.
            changed_by: Filter by user UUID who made the change.
            date_from: Only entries created **on or after** this date.
            date_to: Only entries created **on or before** this date.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``changed_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            ``selectinload``-loaded relationships (changer) are **not**
            eager-loaded here — the caller should use ``get_by_id``
            when the full aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if entity_type is not None:
            filters.append(BillingAuditLog.entity_type == entity_type)
        if entity_id is not None:
            filters.append(BillingAuditLog.entity_id == entity_id)
        if action is not None:
            filters.append(BillingAuditLog.action == action)
        if changed_by is not None:
            filters.append(BillingAuditLog.changed_by == changed_by)
        if date_from is not None:
            filters.append(BillingAuditLog.changed_at >= date_from)
        if date_to is not None:
            filters.append(BillingAuditLog.changed_at <= date_to)

        count_stmt = select(func.count()).select_from(BillingAuditLog)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(BillingAuditLog)
        if filters:
            stmt = stmt.where(*filters)
        stmt = stmt.order_by(order_expr)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    # ------------------------------------------------------ find_by_* filters
    def find_by_entity(
        self,
        entity_type: str,
        entity_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[BillingAuditLog], int]:
        """Convenience: delegate to :meth:`list` filtered by ``entity_type``
        and ``entity_id``."""
        return self.list(
            entity_type=entity_type,
            entity_id=entity_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ------------------------------------------------------------ statistics
    def count_by_entity_type(self) -> dict[str, int]:
        """Return a mapping of ``{entity_type: count}`` for all audit entries.

        Example return::

            {"invoice": 45, "payment": 23, "credit_note": 7, ...}

        The result includes **all** entity types that currently have at least
        one audit entry. Entity types with zero entries are omitted. Results
        are ordered by entity type label.
        """
        stmt = (
            select(BillingAuditLog.entity_type, func.count().label("cnt"))
            .group_by(BillingAuditLog.entity_type)
            .order_by(BillingAuditLog.entity_type)
        )
        return {row.entity_type: row.cnt for row in self.db.execute(stmt).all()}
