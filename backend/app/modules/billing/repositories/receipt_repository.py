"""ReceiptRepository — aggregate root repository.

This repository manages the ``Receipt`` aggregate root. Per the
aggregate-boundary architecture decision, the child entity
(``ReceiptInvoice``) does **not** get its own repository — its persistence
is coordinated here under the service layer's transaction.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``get_by_receipt_number``,
  ``exists``, ``exists_by_receipt_number``, ``update``, ``delete``, ``count``.
* **Eager-load reads**: ``get_with_invoices``.
* **Listing / search / filtering**: ``list``, ``search``,
  ``find_by_payment``, ``find_by_patient``.
* **Child-entity persistence**: ``add_receipt_invoice``,
  ``remove_receipt_invoice``, ``bulk_add_receipt_invoices``.
* **Row-locking**: ``get_for_update``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` (no ``refresh()`` — ``Receipt`` has no server-defaulted columns
that require refreshing beyond the client-side UUID PK) but never ``commit()``
/ ``rollback()``. Logging is query-level only (duplicate lookups, expensive
searches); business events are logged by the service layer.
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
from app.modules.billing.enums import ReceiptStatus
from app.modules.billing.models import (
    Payment,
    Receipt,
    ReceiptInvoice,
)

logger = logging.getLogger(__name__)


class ReceiptRepository:
    """Data access layer for the ``Receipt`` aggregate root.

    Encapsulates all SQLAlchemy query logic for receipt persistence and
    exposes domain-specific method signatures for the service layer to
    consume.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "updated_by",
        }
    )

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": Receipt.created_at,
        "receipt_number": Receipt.receipt_number,
        "receipt_date": Receipt.receipt_date,
        "amount": Receipt.amount,
        "status": Receipt.status,
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
    def create(self, receipt: Receipt) -> Receipt:
        """Persist a new receipt and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``Receipt`` has no server-defaulted columns that
        require a round-trip. The service layer owns the transaction.
        """
        self.db.add(receipt)
        self.db.flush()
        return receipt

    # ----------------------------------------------------------------- read
    def get_by_id(self, receipt_id: UUID) -> Optional[Receipt]:
        """Fetch a receipt by its UUID primary key."""
        return self.db.get(Receipt, receipt_id)

    def get_by_receipt_number(self, receipt_number: str) -> Optional[Receipt]:
        """Fetch a receipt by its (case-insensitive) business number."""
        stmt = select(Receipt).where(
            func.lower(Receipt.receipt_number) == func.lower(receipt_number)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_for_update(self, receipt_id: UUID) -> Optional[Receipt]:
        """Fetch a receipt with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent modification of the same receipt.

        Args:
            receipt_id: UUID of the receipt.

        Returns:
            The locked Receipt entity, or None if not found.
        """
        stmt = (
            select(Receipt)
            .where(Receipt.id == receipt_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, receipt_id: UUID) -> bool:
        """Return ``True`` if a receipt with the given id exists."""
        stmt = select(Receipt.id).where(Receipt.id == receipt_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_receipt_number(self, receipt_number: str) -> bool:
        """Return ``True`` if a receipt with the given number already exists.

        Logs duplicate-number lookups (query-level concern, not a business
        event) so the service can decide whether to raise a conflict.
        """
        stmt = (
            select(Receipt.id)
            .where(func.lower(Receipt.receipt_number) == func.lower(receipt_number))
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Duplicate receipt number lookup: %s", receipt_number)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, receipt: Receipt, updates: Mapping[str, Any]) -> Receipt:
        """Apply an allowed subset of ``updates`` to ``receipt``.

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
            setattr(receipt, field, value)
        self.db.flush()
        return receipt

    def delete(self, receipt: Receipt) -> None:
        """Remove a receipt from the session.

        Hard delete — the service must ensure no other record still
        references it (``ON DELETE RESTRICT`` will otherwise raise at flush).
        """
        self.db.delete(receipt)
        self.db.flush()

    def count(self) -> int:
        """Count all receipts."""
        stmt = select(func.count()).select_from(Receipt)
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        patient_id: UUID | None = None,
        status: ReceiptStatus | str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Receipt], int]:
        """Return a paginated, filterable list of receipts.

        Args:
            patient_id: Filter by patient UUID (requires join through
                ``Payment``).
            status: Filter by receipt status (``ReceiptStatus`` value or
                raw string).
            date_from: Only receipts created **on or after** this date.
            date_to: Only receipts created **on or before** this date.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            ``selectinload``-loaded relationships (receipt invoices, payment)
            are **not** eager-loaded here — the caller should use
            ``get_with_invoices`` when the full aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        needs_payment_join = False

        if patient_id is not None:
            needs_payment_join = True
            filters.append(Payment.patient_id == patient_id)

        if status is not None:
            status_value = status.value if isinstance(status, ReceiptStatus) else status
            filters.append(Receipt.status == status_value)
        if date_from is not None:
            filters.append(Receipt.created_at >= date_from)
        if date_to is not None:
            filters.append(Receipt.created_at <= date_to)

        count_stmt = select(func.count()).select_from(Receipt)
        if needs_payment_join:
            count_stmt = count_stmt.join(Payment, Receipt.payment_id == Payment.id)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(Receipt)
        if needs_payment_join:
            stmt = stmt.join(Payment, Receipt.payment_id == Payment.id)
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
    ) -> list[Receipt]:
        """Search receipts by number (case-insensitive substring).

        Intended for type-ahead UIs. Does **not** return child entities; use
        ``get_by_id`` / ``get_with_invoices`` when the full aggregate is
        required.

        Logs the lookup as a potentially expensive operation; it is not a
        business event.
        """
        term = term.strip()
        if not term:
            return []
        pattern = f"%{term}%"
        logger.debug("Receipt search: term=%r limit=%d", term, limit)
        stmt = (
            select(Receipt)
            .where(Receipt.receipt_number.ilike(pattern))
            .order_by(Receipt.receipt_number.asc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    # ------------------------------------------------------ find_by_* filters
    def find_by_payment(
        self,
        payment_id: UUID,
    ) -> Optional[Receipt]:
        """Fetch the receipt associated with a specific payment (1:1)."""
        stmt = select(Receipt).where(Receipt.payment_id == payment_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def find_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Receipt], int]:
        """Convenience: delegate to :meth:`list` filtered by ``patient_id``."""
        return self.list(
            patient_id=patient_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ------------------------------------------------- aggregate retrieval
    def get_with_invoices(self, receipt_id: UUID) -> Optional[Receipt]:
        """Load a receipt with its ``receipt_invoices`` collection eagerly loaded.

        Uses ``selectinload`` so the receipt row and its invoice associations
        are fetched in a small, bounded number of queries. No commit — the
        service owns the transaction.
        """
        logger.debug(
            "Loading receipt with invoices: receipt_id=%s", receipt_id
        )
        stmt = (
            select(Receipt)
            .where(Receipt.id == receipt_id)
            .options(selectinload(Receipt.receipt_invoices))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # -------------------------------------------- child entity persistence
    def add_receipt_invoice(
        self, receipt_invoice: ReceiptInvoice
    ) -> ReceiptInvoice:
        """Persist a new receipt-invoice association.

        The caller (service) is responsible for setting
        ``receipt_invoice.receipt_id`` and ``receipt_invoice.invoice_id`` —
        this is a persistence operation only. Flushes; no commit; no
        ``refresh()`` (the association has no server-defaulted columns and
        its PK is composite).
        """
        self.db.add(receipt_invoice)
        self.db.flush()
        return receipt_invoice

    def bulk_add_receipt_invoices(
        self, receipt_invoices: list[ReceiptInvoice]
    ) -> list[ReceiptInvoice]:
        """Persist multiple receipt-invoice associations in a single flush.

        The caller is responsible for setting ``receipt_id`` and
        ``invoice_id`` on each association. Flushes once for the entire
        batch; no commit.

        Args:
            receipt_invoices: List of ``ReceiptInvoice`` entities to persist.

        Returns:
            The list of persisted associations.
        """
        self.db.add_all(receipt_invoices)
        self.db.flush()
        return receipt_invoices

    def remove_receipt_invoice(self, receipt_invoice: ReceiptInvoice) -> None:
        """Delete a receipt-invoice association from the session.

        The association is first detached from its owning receipt collection
        so the model's ``delete-orphan`` cascade removes it at flush time.
        Flushes; no commit.
        """
        receipt = receipt_invoice.receipt
        if receipt is not None and receipt_invoice in receipt.receipt_invoices:
            receipt.receipt_invoices.remove(receipt_invoice)
        self.db.delete(receipt_invoice)
        self.db.flush()
