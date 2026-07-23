"""RefundRepository — aggregate root repository for Refund.

This repository manages the Refund aggregate root. Per the aggregate-boundary
architecture decision, the refund lifecycle mutations are coordinated here
under the service layer's transaction.

Scope
-----
* Core CRUD: ``create``, ``get_by_id``, ``get_by_refund_number``, ``exists``,
  ``exists_by_refund_number``, ``update``.
* Row-locking: ``get_for_update``.
* Listing: ``list``, ``find_by_payment``, ``find_by_status``.

Conventions follow the DensCare repository pattern: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` but never ``commit()`` / ``rollback()``.

Sorting follows the same allowlist pattern used by
:class:`~app.modules.billing.repositories.InvoiceRepository` and
:class:`~app.modules.billing.repositories.PaymentRepository` — arbitrary
``getattr()`` sorting is replaced with a controlled ``_SORT_FIELDS`` dict.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional
from uuid import UUID

from decimal import Decimal

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.modules.billing.constants import (
    DEFAULT_PAGE_SIZE,
    DEFAULT_SORT_FIELD,
    MAX_PAGE_SIZE,
    ZERO_MONEY,
)
from app.modules.billing.enums import RefundStatus
from app.modules.billing.models import Refund

logger = logging.getLogger(__name__)


class RefundRepository:
    """Data access layer for the Refund aggregate root.

    Encapsulates all SQLAlchemy query logic for refund persistence.
    Mutations flush but never commit or rollback — the service layer
    owns the transaction.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "status",
            "reviewed_by",
            "reviewed_at",
            "rejection_reason",
            "updated_by",
        }
    )

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": Refund.created_at,
        "updated_at": Refund.updated_at,
        "refund_number": Refund.refund_number,
        "amount": Refund.amount,
        "status": Refund.status,
    }

    _ALLOWED_SORT_FIELDS: frozenset[str] = frozenset(_SORT_FIELDS)

    _DEFAULT_SORT_FIELD = DEFAULT_SORT_FIELD

    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------------------------------------------------------------- create
    def create(self, refund: Refund) -> Refund:
        """Persist a new refund and return the managed instance."""
        self.db.add(refund)
        self.db.flush()
        return refund

    # ----------------------------------------------------------------- read
    def get_by_id(self, refund_id: UUID) -> Refund | None:
        """Fetch a refund by its UUID primary key."""
        return self.db.get(Refund, refund_id)

    def get_by_refund_number(self, refund_number: str) -> Refund | None:
        """Fetch a refund by its (case-insensitive) business number."""
        stmt = select(Refund).where(
            func.lower(Refund.refund_number) == func.lower(refund_number)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_for_update(self, refund_id: UUID) -> Refund | None:
        """Fetch a refund with a row-level lock (SELECT ... FOR UPDATE)."""
        stmt = (
            select(Refund)
            .where(Refund.id == refund_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, refund_id: UUID) -> bool:
        """Return ``True`` if a refund with the given id exists."""
        stmt = select(Refund.id).where(Refund.id == refund_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_refund_number(self, refund_number: str) -> bool:
        """Return ``True`` if a refund with the given number already exists."""
        stmt = (
            select(Refund.id)
            .where(func.lower(Refund.refund_number) == func.lower(refund_number))
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Duplicate refund number lookup: %s", refund_number)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, refund: Refund, updates: Mapping[str, Any]) -> Refund:
        """Apply an allowed subset of ``updates`` to ``refund``.

        Only fields in ``_ALLOWED_UPDATE_FIELDS`` are written. Flushes
        but does not commit; no refresh is needed.
        """
        for field, value in updates.items():
            if field not in self._ALLOWED_UPDATE_FIELDS:
                continue
            setattr(refund, field, value)
        self.db.flush()
        return refund

    @classmethod
    def _resolve_sort_field(cls, sort_by: Optional[str]) -> str:
        """Return ``sort_by`` if allowed, otherwise the default sort field."""
        if sort_by in cls._ALLOWED_SORT_FIELDS:
            return sort_by
        return cls._DEFAULT_SORT_FIELD

    # ---------------------------------------------------------------- list
    def list(
        self,
        payment_id: UUID | None = None,
        status: RefundStatus | str | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Refund], int]:
        """Return a paginated, filterable list of refunds.

        Args:
            payment_id: Filter by payment UUID.
            status: Filter by refund status (``RefundStatus`` value or raw
                string).
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        if payment_id is not None:
            filters.append(Refund.payment_id == payment_id)
        if status is not None:
            status_value = status.value if isinstance(status, RefundStatus) else status
            filters.append(Refund.status == status_value)

        count_stmt = select(func.count()).select_from(Refund)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(Refund)
        if filters:
            stmt = stmt.where(*filters)
        stmt = stmt.order_by(order_expr)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    # --------------------------------------------------------------- totals
    def get_completed_refund_total(self, payment_id: UUID) -> Decimal:
        """Return the sum of all completed refund amounts for a payment.

        This is a read-only aggregate query. Returns ``ZERO_MONEY`` if no
        completed refunds exist.
        """
        stmt = (
            select(func.coalesce(func.sum(Refund.amount), ZERO_MONEY))
            .where(Refund.payment_id == payment_id)
            .where(Refund.status == RefundStatus.COMPLETED.value)
        )
        result = self.db.execute(stmt).scalar()
        return result or ZERO_MONEY

    def get_outstanding_refund_total(self, payment_id: UUID) -> Decimal:
        """Return the sum of all non-rejected refund amounts for a payment.

        Includes PENDING, APPROVED, and COMPLETED refunds — every refund that
        represents an actual or potential outflow. Only REJECTED refunds are
        excluded because they are terminal and will never be completed.

        This is the correct guard for preventing over-refunding: a PENDING
        or APPROVED refund is a committed obligation against the payment.

        Returns ``ZERO_MONEY`` if no outstanding refunds exist.
        """
        stmt = (
            select(func.coalesce(func.sum(Refund.amount), ZERO_MONEY))
            .where(Refund.payment_id == payment_id)
            .where(Refund.status != RefundStatus.REJECTED.value)
        )
        result = self.db.execute(stmt).scalar()
        return result or ZERO_MONEY

    # ----------------------------------------------------------- convenience
    def find_by_payment(
        self,
        payment_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Refund], int]:
        """Convenience: delegate to :meth:`list` filtered by ``payment_id``."""
        return self.list(
            payment_id=payment_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_status(
        self,
        status: RefundStatus | str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Refund], int]:
        """Convenience: delegate to :meth:`list` filtered by ``status``."""
        return self.list(
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

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
