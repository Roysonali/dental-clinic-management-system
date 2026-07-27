"""CreditNoteRepository — aggregate root repository.

This repository manages the ``CreditNote`` aggregate root. Credit notes are
independent aggregates that correct issued invoices without modifying the
original document.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``get_by_credit_note_number``,
  ``exists``, ``exists_by_credit_note_number``, ``update``, ``delete``,
  ``count``.
* **Listing / search / filtering**: ``list``, ``search``,
  ``find_by_invoice``, ``find_by_patient``, ``find_by_status``.
* **Statistics**: ``count_by_status``, ``count_grouped_by_status``.
* **Row-locking**: ``get_for_update``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` (no ``refresh()`` — ``CreditNote`` has no server-defaulted columns
that require refreshing beyond the client-side UUID PK) but never ``commit()``
/ ``rollback()``. Logging is query-level only (duplicate lookups, expensive
searches); business events are logged by the service layer.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session, selectinload

from app.modules.billing.constants import (
    DEFAULT_PAGE_SIZE,
    DEFAULT_SORT_FIELD,
    MAX_PAGE_SIZE,
    ZERO_MONEY,
)
from app.modules.billing.enums import CreditNoteStatus
from app.modules.billing.models import CreditNote
from app.modules.patients.models import Patient

logger = logging.getLogger(__name__)


class CreditNoteRepository:
    """Data access layer for the ``CreditNote`` aggregate root.

    Encapsulates all SQLAlchemy query logic for credit note persistence and
    exposes domain-specific method signatures for the service layer to
    consume.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "reason",
            "expiry_date",
            "void_reason",
            "updated_by",
        }
    )

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": CreditNote.created_at,
        "updated_at": CreditNote.updated_at,
        "credit_note_number": CreditNote.credit_note_number,
        "issue_date": CreditNote.issue_date,
        "amount": CreditNote.amount,
        "remaining_balance": CreditNote.remaining_balance,
        "status": CreditNote.status,
        "expiry_date": CreditNote.expiry_date,
    }

    _ALLOWED_SORT_FIELDS: frozenset[str] = frozenset(_SORT_FIELDS)

    _DEFAULT_SORT_FIELD = DEFAULT_SORT_FIELD

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
    def create(self, credit_note: CreditNote) -> CreditNote:
        """Persist a new credit note and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``CreditNote`` has no server-defaulted columns that
        require a round-trip. The service layer owns the transaction.
        """
        self.db.add(credit_note)
        self.db.flush()
        return credit_note

    # ----------------------------------------------------------------- read
    def get_by_id(self, credit_note_id: UUID) -> Optional[CreditNote]:
        """Fetch a credit note by its UUID primary key."""
        return self.db.get(CreditNote, credit_note_id)

    def get_by_credit_note_number(
        self, credit_note_number: str
    ) -> Optional[CreditNote]:
        """Fetch a credit note by its (case-insensitive) business number."""
        stmt = select(CreditNote).where(
            func.lower(CreditNote.credit_note_number)
            == func.lower(credit_note_number)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_for_update(self, credit_note_id: UUID) -> Optional[CreditNote]:
        """Fetch a credit note with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent modification of the same credit note.

        Args:
            credit_note_id: UUID of the credit note.

        Returns:
            The locked CreditNote entity, or None if not found.
        """
        stmt = (
            select(CreditNote)
            .where(CreditNote.id == credit_note_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, credit_note_id: UUID) -> bool:
        """Return ``True`` if a credit note with the given id exists."""
        stmt = select(CreditNote.id).where(CreditNote.id == credit_note_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_credit_note_number(self, credit_note_number: str) -> bool:
        """Return ``True`` if a credit note with the given number already exists.

        Logs duplicate-number lookups (query-level concern, not a business
        event) so the service can decide whether to raise a conflict.
        """
        stmt = (
            select(CreditNote.id)
            .where(
                func.lower(CreditNote.credit_note_number)
                == func.lower(credit_note_number)
            )
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug(
                "Duplicate credit note number lookup: %s", credit_note_number
            )
        return found

    # -------------------------------------------------------------- mutation
    def update(self, credit_note: CreditNote, updates: Mapping[str, Any]) -> CreditNote:
        """Apply an allowed subset of ``updates`` to ``credit_note``.

        Only fields in ``_ALLOWED_UPDATE_FIELDS`` are written; immutable,
        business-key, and workflow-managed fields are silently skipped. The
        validator / service layer is responsible for sending only valid fields
        — the allowlist is a safety net. Flushes but does not commit; no
        ``refresh()`` is needed because each value is already set on the
        in-memory instance.
        """
        for field, value in updates.items():
            if field not in self._ALLOWED_UPDATE_FIELDS:
                continue
            setattr(credit_note, field, value)
        self.db.flush()
        return credit_note

    def delete(self, credit_note: CreditNote) -> None:
        """Remove a credit note from the session.

        Hard delete — the service must ensure no allocation still references
        it (``ON DELETE RESTRICT`` will otherwise raise at flush).
        """
        self.db.delete(credit_note)
        self.db.flush()

    def count(self) -> int:
        """Count all credit notes."""
        stmt = select(func.count()).select_from(CreditNote)
        return self.db.execute(stmt).scalar() or 0

    def count_by_status(self, status: CreditNoteStatus | str) -> int:
        """Count credit notes for a specific status.

        Args:
            status: ``CreditNoteStatus`` value or raw string.

        Returns:
            Count of credit notes matching the status.
        """
        status_value = status.value if isinstance(status, CreditNoteStatus) else status
        stmt = (
            select(func.count())
            .select_from(CreditNote)
            .where(CreditNote.status == status_value)
        )
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        patient_id: UUID | None = None,
        invoice_id: UUID | None = None,
        status: CreditNoteStatus | str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[CreditNote], int]:
        """Return a paginated, filterable list of credit notes.

        Args:
            patient_id: Filter by patient UUID.
            invoice_id: Filter by invoice UUID.
            status: Filter by credit note status (``CreditNoteStatus`` value
                or raw string).
            date_from: Only credit notes created **on or after** this date.
            date_to: Only credit notes created **on or before** this date.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            ``selectinload``-loaded relationships (invoice, patient) are
            **not** eager-loaded here — the caller should use
            ``get_by_id`` when the full aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if patient_id is not None:
            filters.append(CreditNote.patient_id == patient_id)
        if invoice_id is not None:
            filters.append(CreditNote.invoice_id == invoice_id)
        if status is not None:
            status_value = (
                status.value if isinstance(status, CreditNoteStatus) else status
            )
            filters.append(CreditNote.status == status_value)
        if date_from is not None:
            filters.append(CreditNote.created_at >= date_from)
        if date_to is not None:
            filters.append(CreditNote.created_at <= date_to)

        count_stmt = select(func.count()).select_from(CreditNote)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(CreditNote)
        if filters:
            stmt = stmt.where(*filters)
        stmt = stmt.order_by(order_expr)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    # ---------------------------------------------------------------- search
    def search(
        self,
        term: str,
        limit: int = 20,
    ) -> list[CreditNote]:
        """Search credit notes by number (case-insensitive substring).

        Intended for type-ahead UIs. Does **not** return child entities; use
        ``get_by_id`` when the full aggregate is required.

        Logs the lookup as a potentially expensive operation; it is not a
        business event.
        """
        term = term.strip()
        if not term:
            return []
        pattern = f"%{term}%"
        logger.debug("Credit note search: term=%r limit=%d", term, limit)
        stmt = (
            select(CreditNote)
            .where(CreditNote.credit_note_number.ilike(pattern))
            .order_by(CreditNote.credit_note_number.asc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    # ------------------------------------------------------ find_by_* filters
    def find_by_invoice(
        self,
        invoice_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[CreditNote], int]:
        """Convenience: delegate to :meth:`list` filtered by ``invoice_id``."""
        return self.list(
            invoice_id=invoice_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[CreditNote], int]:
        """Convenience: delegate to :meth:`list` filtered by ``patient_id``."""
        return self.list(
            patient_id=patient_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_status(
        self,
        status: CreditNoteStatus | str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[CreditNote], int]:
        """Convenience: delegate to :meth:`list` filtered by ``status``."""
        return self.list(
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # --------------------------------------------------- totals (aggregate)
    def get_credit_note_totals(
        self, patient_id: UUID | None = None
    ) -> dict[str, Any]:
        """Return aggregate credit note totals using SQL aggregate functions.

        All values are computed server-side so results are correct regardless
        of credit note count.

        Args:
            patient_id: If provided, only credit notes for this patient are
                included.

        Returns:
            A dict with keys:
            - ``total_amount``: SUM of all credit note amount values
            - ``total_remaining``: SUM of all remaining_balance values
            - ``credit_note_count``: COUNT of all matching credit notes
        """
        filters = []
        if patient_id is not None:
            filters.append(CreditNote.patient_id == patient_id)

        stmt = select(
            func.coalesce(func.sum(CreditNote.amount), 0),
            func.coalesce(func.sum(CreditNote.remaining_balance), 0),
            func.count().label("cnt"),
        ).select_from(CreditNote)
        if filters:
            stmt = stmt.where(*filters)
        row = self.db.execute(stmt).one()
        return {
            "total_amount": Decimal(str(row[0])) if row[0] is not None else ZERO_MONEY,
            "total_remaining": Decimal(str(row[1])) if row[1] is not None else ZERO_MONEY,
            "credit_note_count": row[2] or 0,
        }

    # ------------------------------------------------------------ statistics
    def count_grouped_by_status(self) -> dict[str, int]:
        """Return a mapping of ``{status_label: count}`` for all credit notes.

        Example return::

            {"draft": 2, "issued": 5, "applied": 3, ...}

        The result includes **all** statuses that currently have at least one
        credit note. Statuses with zero credit notes are omitted. Results are
        ordered by status label.
        """
        stmt = (
            select(CreditNote.status, func.count().label("cnt"))
            .group_by(CreditNote.status)
            .order_by(CreditNote.status)
        )
        return {row.status: row.cnt for row in self.db.execute(stmt).all()}
