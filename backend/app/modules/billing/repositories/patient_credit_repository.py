"""PatientCreditRepository — aggregate root repository.

This repository manages the ``PatientCredit`` aggregate root. Patient credits
track positive balances owed to a patient from overpayments, credit notes, or
advance payments.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``exists``, ``update``, ``delete``,
  ``count``.
* **Listing / filtering**: ``list``, ``find_by_patient``,
  ``find_by_patient_and_source``.
* **Statistics**: ``count_by_patient``.
* **Row-locking**: ``get_for_update``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` (no ``refresh()`` — ``PatientCredit`` has no server-defaulted
columns that require refreshing beyond the client-side UUID PK) but never
``commit()`` / ``rollback()``. Logging is query-level only (duplicate lookups);
business events are logged by the service layer.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    func,
    select,
)
from sqlalchemy.orm import Session, selectinload

from app.modules.billing.constants import (
    DEFAULT_PAGE_SIZE,
    DEFAULT_SORT_FIELD,
    MAX_PAGE_SIZE,
)
from app.modules.billing.models import PatientCredit

logger = logging.getLogger(__name__)


class PatientCreditRepository:
    """Data access layer for the ``PatientCredit`` aggregate root.

    Encapsulates all SQLAlchemy query logic for patient credit persistence and
    exposes domain-specific method signatures for the service layer to consume.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "remaining_amount",
            "expiry_date",
            "updated_by",
        }
    )

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": PatientCredit.created_at,
        "updated_at": PatientCredit.updated_at,
        "original_amount": PatientCredit.original_amount,
        "remaining_amount": PatientCredit.remaining_amount,
        "expiry_date": PatientCredit.expiry_date,
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
    def create(self, patient_credit: PatientCredit) -> PatientCredit:
        """Persist a new patient credit and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``PatientCredit`` has no server-defaulted columns that
        require a round-trip. The service layer owns the transaction.
        """
        self.db.add(patient_credit)
        self.db.flush()
        return patient_credit

    # ----------------------------------------------------------------- read
    def get_by_id(self, patient_credit_id: UUID) -> Optional[PatientCredit]:
        """Fetch a patient credit by its UUID primary key."""
        return self.db.get(PatientCredit, patient_credit_id)

    def get_for_update(self, patient_credit_id: UUID) -> Optional[PatientCredit]:
        """Fetch a patient credit with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent modification of the same patient credit.

        Args:
            patient_credit_id: UUID of the patient credit.

        Returns:
            The locked PatientCredit entity, or None if not found.
        """
        stmt = (
            select(PatientCredit)
            .where(PatientCredit.id == patient_credit_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, patient_credit_id: UUID) -> bool:
        """Return ``True`` if a patient credit with the given id exists."""
        stmt = (
            select(PatientCredit.id)
            .where(PatientCredit.id == patient_credit_id)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    def exists_by_patient(self, patient_id: UUID) -> bool:
        """Return ``True`` if any patient credit exists for the given patient.

        Logs duplicate lookups (query-level concern, not a business event)
        so callers can decide whether to raise a conflict.
        """
        stmt = (
            select(PatientCredit.id)
            .where(PatientCredit.patient_id == patient_id)
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Patient credit lookup: patient_id=%s", patient_id)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, patient_credit: PatientCredit, updates: Mapping[str, Any]) -> PatientCredit:
        """Apply an allowed subset of ``updates`` to ``patient_credit``.

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
            setattr(patient_credit, field, value)
        self.db.flush()
        return patient_credit

    def delete(self, patient_credit: PatientCredit) -> None:
        """Remove a patient credit from the session.

        Hard delete — the service must ensure no allocation still references
        it (``ON DELETE RESTRICT`` will otherwise raise at flush).
        """
        self.db.delete(patient_credit)
        self.db.flush()

    def count(self) -> int:
        """Count all patient credits."""
        stmt = select(func.count()).select_from(PatientCredit)
        return self.db.execute(stmt).scalar() or 0

    def count_by_patient(self, patient_id: UUID) -> int:
        """Count patient credits for a specific patient.

        Args:
            patient_id: UUID of the patient.

        Returns:
            Count of patient credits for the patient.
        """
        stmt = (
            select(func.count())
            .select_from(PatientCredit)
            .where(PatientCredit.patient_id == patient_id)
        )
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        patient_id: UUID | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[PatientCredit], int]:
        """Return a paginated, filterable list of patient credits.

        Args:
            patient_id: Filter by patient UUID.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            ``selectinload``-loaded relationships (patient, source allocation,
            source credit note) are **not** eager-loaded here — the caller
            should use ``get_by_id`` when the full aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if patient_id is not None:
            filters.append(PatientCredit.patient_id == patient_id)

        count_stmt = select(func.count()).select_from(PatientCredit)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(PatientCredit)
        if filters:
            stmt = stmt.where(*filters)
        stmt = stmt.order_by(order_expr)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    # ------------------------------------------------------ find_by_* filters
    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[PatientCredit], int]:
        """Convenience: delegate to :meth:`list` filtered by ``patient_id``."""
        return self.list(
            patient_id=patient_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_patient_and_source(
        self,
        patient_id: UUID,
        source_allocation_id: UUID | None = None,
        source_credit_note_id: UUID | None = None,
    ) -> Optional[PatientCredit]:
        """Find a patient credit by patient and an optional source reference.

        Args:
            patient_id: UUID of the patient.
            source_allocation_id: Optional source allocation UUID.
            source_credit_note_id: Optional source credit note UUID.

        Returns:
            The matching PatientCredit, or None if not found.
        """
        stmt = select(PatientCredit).where(PatientCredit.patient_id == patient_id)
        if source_allocation_id is not None:
            stmt = stmt.where(
                PatientCredit.source_allocation_id == source_allocation_id
            )
        if source_credit_note_id is not None:
            stmt = stmt.where(
                PatientCredit.source_credit_note_id == source_credit_note_id
            )
        return self.db.execute(stmt).scalar_one_or_none()
