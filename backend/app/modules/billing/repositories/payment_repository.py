"""PaymentRepository — aggregate root repository.

This repository manages the ``Payment`` aggregate root. Per the
aggregate-boundary architecture decision, the child entity
(``PaymentAllocation``) does **not** get its own repository — its
persistence is coordinated here under the service layer's transaction.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``get_by_payment_number``,
  ``exists``, ``exists_by_payment_number``, ``update``, ``delete``, ``count``.
* **Eager-load reads**: ``get_with_allocations``.
* **Listing / search / filtering**: ``list``, ``search``,
  ``find_by_patient``, ``find_by_status``, ``find_by_payment_method``.
* **Statistics**: ``count_by_status``, ``count_grouped_by_status``.
* **Child-entity persistence**: ``add_allocation``, ``remove_allocation``,
  ``bulk_add_allocations``.
* **Row-locking**: ``get_for_update``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` (no ``refresh()`` — ``Payment`` has no server-defaulted columns
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
)
from app.modules.billing.enums import PaymentMethod, PaymentStatus
from app.modules.billing.models import (
    Payment,
    PaymentAllocation,
)
from app.modules.patients.models import Patient

logger = logging.getLogger(__name__)


class PaymentRepository:
    """Data access layer for the ``Payment`` aggregate root.

    Encapsulates all SQLAlchemy query logic for payment persistence and
    exposes domain-specific method signatures for the service layer to
    consume.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "reference_number",
            "is_reversed",
            "reversal_reason",
            "notes",
            "updated_by",
        }
    )

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": Payment.created_at,
        "updated_at": Payment.updated_at,
        "payment_number": Payment.payment_number,
        "payment_date": Payment.payment_date,
        "total_amount": Payment.total_amount,
        "status": Payment.status,
        "payment_method": Payment.payment_method,
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
    def create(self, payment: Payment) -> Payment:
        """Persist a new payment and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``Payment`` has no server-defaulted columns that
        require a round-trip. The service layer owns the transaction.
        """
        self.db.add(payment)
        self.db.flush()
        return payment

    # ----------------------------------------------------------------- read
    def get_by_id(self, payment_id: UUID) -> Optional[Payment]:
        """Fetch a payment by its UUID primary key."""
        return self.db.get(Payment, payment_id)

    def get_by_payment_number(self, payment_number: str) -> Optional[Payment]:
        """Fetch a payment by its (case-insensitive) business number."""
        stmt = select(Payment).where(
            func.lower(Payment.payment_number) == func.lower(payment_number)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_for_update(self, payment_id: UUID) -> Optional[Payment]:
        """Fetch a payment with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent modification of the same payment. The caller
        must ensure the payment is in a mutable state before updating.

        Args:
            payment_id: UUID of the payment.

        Returns:
            The locked Payment entity, or None if not found.
        """
        stmt = (
            select(Payment)
            .where(Payment.id == payment_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, payment_id: UUID) -> bool:
        """Return ``True`` if a payment with the given id exists."""
        stmt = select(Payment.id).where(Payment.id == payment_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_payment_number(self, payment_number: str) -> bool:
        """Return ``True`` if a payment with the given number already exists.

        Logs duplicate-number lookups (query-level concern, not a business
        event) so the service can decide whether to raise a conflict.
        """
        stmt = (
            select(Payment.id)
            .where(func.lower(Payment.payment_number) == func.lower(payment_number))
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Duplicate payment number lookup: %s", payment_number)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, payment: Payment, updates: Mapping[str, Any]) -> Payment:
        """Apply an allowed subset of ``updates`` to ``payment``.

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
            setattr(payment, field, value)
        self.db.flush()
        return payment

    def delete(self, payment: Payment) -> None:
        """Remove a payment from the session.

        Hard delete — the service must ensure no receipt or allocation still
        references it (``ON DELETE RESTRICT`` will otherwise raise at flush).
        """
        self.db.delete(payment)
        self.db.flush()

    def count(self) -> int:
        """Count all payments."""
        stmt = select(func.count()).select_from(Payment)
        return self.db.execute(stmt).scalar() or 0

    def count_by_status(self, status: PaymentStatus | str) -> int:
        """Count payments for a specific status.

        Args:
            status: ``PaymentStatus`` value or raw string.

        Returns:
            Count of payments matching the status.
        """
        status_value = status.value if isinstance(status, PaymentStatus) else status
        stmt = (
            select(func.count())
            .select_from(Payment)
            .where(Payment.status == status_value)
        )
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        patient_id: UUID | None = None,
        status: PaymentStatus | str | None = None,
        payment_method: PaymentMethod | str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Payment], int]:
        """Return a paginated, filterable list of payments.

        Args:
            patient_id: Filter by patient UUID.
            status: Filter by payment status (``PaymentStatus`` value or
                raw string).
            payment_method: Filter by payment method (``PaymentMethod`` value
                or raw string).
            date_from: Only payments created **on or after** this date.
            date_to: Only payments created **on or before** this date.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            ``selectinload``-loaded relationships (allocations, receipt) are
            **not** eager-loaded here — the caller should use
            ``get_with_allocations`` when the full aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if patient_id is not None:
            filters.append(Payment.patient_id == patient_id)
        if status is not None:
            status_value = status.value if isinstance(status, PaymentStatus) else status
            filters.append(Payment.status == status_value)
        if payment_method is not None:
            method_value = (
                payment_method.value
                if isinstance(payment_method, PaymentMethod)
                else payment_method
            )
            filters.append(Payment.payment_method == method_value)
        if date_from is not None:
            filters.append(Payment.created_at >= date_from)
        if date_to is not None:
            filters.append(Payment.created_at <= date_to)

        count_stmt = select(func.count()).select_from(Payment)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(Payment)
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
    ) -> list[Payment]:
        """Search payments by number (case-insensitive substring).

        Intended for type-ahead UIs. Does **not** return child entities; use
        ``get_by_id`` / ``get_with_allocations`` when the full aggregate is
        required.

        Logs the lookup as a potentially expensive operation; it is not a
        business event.
        """
        term = term.strip()
        if not term:
            return []
        pattern = f"%{term}%"
        logger.debug("Payment search: term=%r limit=%d", term, limit)
        stmt = (
            select(Payment)
            .where(Payment.payment_number.ilike(pattern))
            .order_by(Payment.payment_number.asc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    # ------------------------------------------------------ find_by_* filters
    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Payment], int]:
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
        status: PaymentStatus | str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Payment], int]:
        """Convenience: delegate to :meth:`list` filtered by ``status``."""
        return self.list(
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_payment_method(
        self,
        payment_method: PaymentMethod | str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Payment], int]:
        """Convenience: delegate to :meth:`list` filtered by ``payment_method``."""
        return self.list(
            payment_method=payment_method,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ------------------------------------------------------------ statistics
    def count_grouped_by_status(self) -> dict[str, int]:
        """Return a mapping of ``{status_label: count}`` for all payments.

        Example return::

            {"completed": 45, "pending": 3, "failed": 1, ...}

        The result includes **all** statuses that currently have at least one
        payment. Statuses with zero payments are omitted. Results are ordered
        by status label.
        """
        stmt = (
            select(Payment.status, func.count().label("cnt"))
            .group_by(Payment.status)
            .order_by(Payment.status)
        )
        return {row.status: row.cnt for row in self.db.execute(stmt).all()}

    # ------------------------------------------------- aggregate retrieval
    def get_total_allocated_for_payment(self, payment_id: UUID) -> Decimal:
        """Compute the total non-refund amount allocated from a payment.

        Sums all PaymentAllocation.allocated_amount where payment_id matches
        and is_refund=False. Returns ZERO_MONEY if no allocations exist.
        No commit.
        """
        from app.modules.billing.models import PaymentAllocation

        stmt = select(
            func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)
        ).where(
            PaymentAllocation.payment_id == payment_id,
            PaymentAllocation.is_refund == False,
        )
        result = self.db.execute(stmt).scalar()
        return Decimal(str(result)) if result is not None else Decimal("0.00")

    def get_with_allocations(self, payment_id: UUID) -> Optional[Payment]:
        """Load a payment with its ``allocations`` collection eagerly loaded.

        Uses ``selectinload`` so the payment row and its allocations are
        fetched in a small, bounded number of queries regardless of allocation
        count. No commit — the service owns the transaction.
        """
        logger.debug(
            "Loading payment with allocations: payment_id=%s", payment_id
        )
        stmt = (
            select(Payment)
            .where(Payment.id == payment_id)
            .options(selectinload(Payment.payment_allocations))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # -------------------------------------------- child entity persistence
    def add_allocation(self, allocation: PaymentAllocation) -> PaymentAllocation:
        """Persist a new payment allocation.

        The caller (service) is responsible for setting
        ``allocation.payment_id`` and ``allocation.invoice_id`` — this is a
        persistence operation only, not a business decision. Flushes; no
        commit; no ``refresh()`` (the allocation has no server-defaulted
        columns and its id is generated client-side).
        """
        self.db.add(allocation)
        self.db.flush()
        return allocation

    def bulk_add_allocations(
        self, allocations: list[PaymentAllocation]
    ) -> list[PaymentAllocation]:
        """Persist multiple payment allocations in a single flush.

        The caller is responsible for setting ``payment_id`` and
        ``invoice_id`` on each allocation. Flushes once for the entire batch;
        no commit.

        Args:
            allocations: List of ``PaymentAllocation`` entities to persist.

        Returns:
            The list of persisted allocations.
        """
        self.db.add_all(allocations)
        self.db.flush()
        return allocations

    def remove_allocation(self, allocation: PaymentAllocation) -> None:
        """Delete a payment allocation from the session.

        The allocation is first detached from its owning payment collection
        so the model's ``delete-orphan`` cascade removes it at flush time.
        Flushes; no commit.
        """
        payment = allocation.payment
        if payment is not None and allocation in payment.payment_allocations:
            payment.payment_allocations.remove(allocation)
        self.db.delete(allocation)
        self.db.flush()
