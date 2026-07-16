"""Procedure Repository — master catalog data access for the Treatment Plan module.

This repository owns persistence for the :class:`~app.modules.treatment.models.Procedure`
master catalog only. It deliberately excludes the child entities of the
Treatment Plan aggregate (``TreatmentPlanItem``, ``TreatmentPlanVersion``,
``TreatmentPlanApproval``), whose persistence is managed by
``TreatmentPlanRepository`` (a later phase).

Design notes
------------
* Follows the established DensCare repository conventions (see
  ``doctors/repositories/specialization_repository.py``): constructor takes a
  ``Session``, queries use ``select()`` / ``scalars()`` / ``scalar_one_or_none()``,
  and mutations call ``flush()`` + ``refresh()`` but **never** ``commit()`` /
  ``rollback()`` — transactions belong to the service layer.
* Logging is query-level only (duplicate lookups, expensive searches). Business
  events (create / activate / deactivate) are logged by the service layer.
* No shared pagination/query utility exists in DensCare yet, so the local
  ``_normalize_pagination`` / ``_resolve_sort_field`` helpers mirror the
  convention used by the doctor and specialization repositories.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from sqlalchemy import (
    ColumnElement,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.modules.treatment.constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    PROCEDURE_SEARCH_DEFAULT_LIMIT,
)
from app.modules.treatment.models import Procedure

logger = logging.getLogger(__name__)


class ProcedureRepository:
    """Data access layer for the ``Procedure`` master catalog.

    Encapsulates all SQLAlchemy query logic for procedures and exposes
    domain-specific method signatures for the service layer to consume.
    """

    # Fields that may be mutated through ``update()``. ``code`` and ``id`` are
    # intentionally excluded: ``code`` is the immutable business key referenced
    # by treatment plan items, and ``id`` is the primary key.
    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "name",
            "description",
            "default_cost",
            "category",
            "is_active",
        }
    )

    # Explicit column mapping for sort fields — safer to refactor than
    # ``getattr()`` against the model (renaming a column breaks loudly here
    # instead of failing silently at request time).
    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "code": Procedure.code,
        "name": Procedure.name,
        "category": Procedure.category,
        "default_cost": Procedure.default_cost,
    }

    _ALLOWED_SORT_FIELDS: frozenset[str] = frozenset(_SORT_FIELDS)

    _DEFAULT_SORT_FIELD = "code"

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
    def create(self, procedure: Procedure) -> Procedure:
        """Persist a new procedure and return the managed instance.

        No ``refresh()`` is needed: ``flush()`` populates the generated
        primary key on the in-memory instance and ``Procedure`` has no
        server-defaulted columns, so a round-trip SELECT is avoided. The
        service layer owns the transaction (no commit here).
        """
        self.db.add(procedure)
        self.db.flush()
        return procedure

    # ---------------------------------------------------------------- read
    def get_by_id(self, procedure_id: int) -> Optional[Procedure]:
        """Fetch a procedure by its integer primary key."""
        return self.db.get(Procedure, procedure_id)

    def get_by_code(self, code: str) -> Optional[Procedure]:
        """Fetch a procedure by its (case-insensitive) business code."""
        stmt = select(Procedure).where(func.lower(Procedure.code) == func.lower(code))
        return self.db.execute(stmt).scalar_one_or_none()

    def get_active_by_id(self, procedure_id: int) -> Optional[Procedure]:
        """Fetch an active procedure by primary key, or ``None`` if inactive."""
        stmt = select(Procedure).where(
            Procedure.id == procedure_id,
            Procedure.is_active.is_(True),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def list_active(self) -> list[Procedure]:
        """Return all active procedures ordered by code (for dropdowns/seeds)."""
        stmt = (
            select(Procedure)
            .where(Procedure.is_active.is_(True))
            .order_by(Procedure.code.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_all(self) -> list[Procedure]:
        """Return every procedure (active and inactive) ordered by code."""
        stmt = select(Procedure).order_by(Procedure.code.asc())
        return list(self.db.execute(stmt).scalars().all())

    def list(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
    ) -> tuple[list[Procedure], int]:
        """Return a page of procedures plus the total count.

        Args:
            page: 1-based page number (clamped to >= 1).
            page_size: page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            is_active: Optional active filter.
            category: Optional category filter (string or enum value).
            sort_by: Optional sort field (defaults to ``code``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if is_active is not None:
            filters.append(Procedure.is_active.is_(is_active))
        if category is not None:
            filters.append(Procedure.category == category)

        count_stmt = select(func.count()).select_from(Procedure)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = (
            select(Procedure)
            .order_by(order_expr)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if filters:
            stmt = stmt.where(*filters)
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def search(self, term: str, limit: int = PROCEDURE_SEARCH_DEFAULT_LIMIT) -> list[Procedure]:
        """Search procedures by code or name (case-insensitive substring).

        Intended for type-ahead UIs. Logs the lookup as a potentially expensive
        operation; it is not a business event.
        """
        term = term.strip()
        if not term:
            return []
        pattern = f"%{term}%"
        logger.debug("Procedure search: term=%r limit=%d", term, limit)
        stmt = (
            select(Procedure)
            .where(
                or_(
                    Procedure.code.ilike(pattern),
                    Procedure.name.ilike(pattern),
                )
            )
            .order_by(Procedure.code.asc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    # ------------------------------------------------------------- existence
    def exists(self, procedure_id: int) -> bool:
        """Return ``True`` if a procedure with the given id exists."""
        stmt = select(Procedure.id).where(Procedure.id == procedure_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_code(self, code: str) -> bool:
        """Return ``True`` if a procedure with the given code already exists.

        Logs duplicate-code lookups (query-level concern, not a business event)
        so callers can decide whether to raise a conflict.
        """
        stmt = (
            select(Procedure.id)
            .where(func.lower(Procedure.code) == func.lower(code))
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Duplicate procedure code lookup: %s", code)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, procedure: Procedure, updates: Mapping[str, Any]) -> Procedure:
        """Apply an allowed subset of ``updates`` to ``procedure``.

        Only fields in ``_ALLOWED_UPDATE_FIELDS`` are written; immutable or
        unknown keys (``code``, ``id``) are silently skipped. The validator /
        service layer is responsible for sending only valid fields — this
        allowlist is a safety net that prevents accidental mutation of the
        business key or primary key. Flushes but does not commit; no
        ``refresh()`` is needed because each value is already set on the
        in-memory instance and ``Procedure`` has no server-defaulted columns.
        """
        for field, value in updates.items():
            if field not in self._ALLOWED_UPDATE_FIELDS:
                continue
            setattr(procedure, field, value)
        self.db.flush()
        return procedure

    def activate(self, procedure: Procedure) -> Procedure:
        """Mark a procedure active. Flushes; transaction owned by the service.

        No ``refresh()`` — ``is_active`` is set directly on the instance and
        ``Procedure`` has no server-defaulted columns.
        """
        procedure.is_active = True
        self.db.flush()
        return procedure

    def deactivate(self, procedure: Procedure) -> Procedure:
        """Mark a procedure inactive (soft retire from the catalog).

        Flushes; transaction owned by the service. The FK from treatment plan
        items uses ``ON DELETE RESTRICT``, so deactivation (not deletion) is the
        safe way to retire a procedure still referenced by plans. No
        ``refresh()`` is needed (see :meth:`activate`).
        """
        procedure.is_active = False
        self.db.flush()
        return procedure

    def delete(self, procedure: Procedure) -> None:
        """Remove a procedure from the session.

        Hard delete — the service must ensure no treatment plan item still
        references it (``ON DELETE RESTRICT`` will otherwise raise at flush).
        """
        self.db.delete(procedure)
        self.db.flush()

    def count(self, is_active: Optional[bool] = None) -> int:
        """Count procedures, optionally filtered by active state."""
        stmt = select(func.count()).select_from(Procedure)
        if is_active is not None:
            stmt = stmt.where(Procedure.is_active.is_(is_active))
        return self.db.execute(stmt).scalar() or 0
