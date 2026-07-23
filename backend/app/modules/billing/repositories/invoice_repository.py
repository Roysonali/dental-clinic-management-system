"""InvoiceRepository — aggregate root repository.

This repository manages the ``Invoice`` aggregate root. Per the
aggregate-boundary architecture decision, the child entities
(``InvoiceItem``, ``InvoiceStatusHistory``) do **not** get their own
repositories — their persistence is coordinated here under the service
layer's transaction.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``get_by_invoice_number``,
  ``exists``, ``exists_by_invoice_number``, ``update``, ``delete``, ``count``.
* **Eager-load reads**: ``get_with_items``, ``get_with_status_history``,
  ``get_complete_aggregate``.
* **Listing / search / filtering**: ``list``, ``search``,
  ``find_by_patient``, ``find_by_doctor``, ``find_by_status``,
  ``find_drafts``.
* **Statistics**: ``count_by_status``, ``count_grouped_by_status``.
* **Child-entity persistence**: ``add_item``, ``remove_item``,
  ``bulk_add_items``.
* **Row-locking**: ``get_for_update``.

Conventions follow the DensCare repository convention: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` (no ``refresh()`` — ``Invoice`` has no server-defaulted columns
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
from app.modules.billing.enums import InvoiceStatus
from app.modules.billing.models import (
    Invoice,
    InvoiceItem,
    InvoiceStatusHistory,
)
from app.modules.patients.models import Patient

logger = logging.getLogger(__name__)


class InvoiceRepository:
    """Data access layer for the ``Invoice`` aggregate root.

    Encapsulates all SQLAlchemy query logic for invoice persistence and exposes
    domain-specific method signatures for the service layer to consume.
    """

    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "notes",
            "cancellation_reason",
            "void_reason",
            "due_date",
            "updated_by",
        }
    )

    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": Invoice.created_at,
        "updated_at": Invoice.updated_at,
        "invoice_number": Invoice.invoice_number,
        "due_date": Invoice.due_date,
        "status": Invoice.status,
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
    def create(self, invoice: Invoice) -> Invoice:
        """Persist a new invoice and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``Invoice`` has no server-defaulted columns that
        require a round-trip. The service layer owns the transaction.
        """
        self.db.add(invoice)
        self.db.flush()
        return invoice

    # ----------------------------------------------------------------- read
    def get_by_id(self, invoice_id: UUID) -> Optional[Invoice]:
        """Fetch an invoice by its UUID primary key."""
        return self.db.get(Invoice, invoice_id)

    def get_by_invoice_number(self, invoice_number: str) -> Optional[Invoice]:
        """Fetch an invoice by its (case-insensitive) business number."""
        stmt = select(Invoice).where(
            func.lower(Invoice.invoice_number) == func.lower(invoice_number)
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_for_update(self, invoice_id: UUID) -> Optional[Invoice]:
        """Fetch an invoice with a row-level lock (SELECT ... FOR UPDATE).

        Prevents concurrent modification of the same invoice. The caller
        must ensure the invoice is in a mutable state (Draft) before
        updating.

        Args:
            invoice_id: UUID of the invoice.

        Returns:
            The locked Invoice entity, or None if not found.
        """
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, invoice_id: UUID) -> bool:
        """Return ``True`` if an invoice with the given id exists."""
        stmt = select(Invoice.id).where(Invoice.id == invoice_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_invoice_number(self, invoice_number: str) -> bool:
        """Return ``True`` if an invoice with the given number already exists.

        Logs duplicate-number lookups (query-level concern, not a business
        event) so the service can decide whether to raise a conflict.
        """
        stmt = (
            select(Invoice.id)
            .where(func.lower(Invoice.invoice_number) == func.lower(invoice_number))
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Duplicate invoice number lookup: %s", invoice_number)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, invoice: Invoice, updates: Mapping[str, Any]) -> Invoice:
        """Apply an allowed subset of ``updates`` to ``invoice``.

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
            setattr(invoice, field, value)
        self.db.flush()
        return invoice

    def delete(self, invoice: Invoice) -> None:
        """Remove an invoice from the session.

        Hard delete — the service must ensure no payment allocation or credit
        note still references it (``ON DELETE RESTRICT`` will otherwise raise
        at flush). ``StaleDataError`` is raised at flush time if the invoice
        was modified (version incremented) by another concurrent transaction
        — see ``lock_version`` / ``version_id_col`` on the model.
        """
        self.db.delete(invoice)
        self.db.flush()

    def count(self) -> int:
        """Count all invoices."""
        stmt = select(func.count()).select_from(Invoice)
        return self.db.execute(stmt).scalar() or 0

    def count_by_status(self, status: InvoiceStatus | str) -> int:
        """Count invoices for a specific status.

        Args:
            status: ``InvoiceStatus`` value or raw string.

        Returns:
            Count of invoices matching the status.
        """
        status_value = status.value if isinstance(status, InvoiceStatus) else status
        stmt = (
            select(func.count())
            .select_from(Invoice)
            .where(Invoice.status == status_value)
        )
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        search: str | None = None,
        patient_id: UUID | None = None,
        doctor_id: UUID | None = None,
        status: InvoiceStatus | str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Invoice], int]:
        """Return a paginated, filterable list of invoices.

        Args:
            search: Case-insensitive search across ``invoice_number`` and
                patient names.
            patient_id: Filter by patient UUID.
            doctor_id: Filter by doctor UUID.
            status: Filter by invoice status (``InvoiceStatus`` value or
                raw string).
            date_from: Only invoices created **on or after** this date.
            date_to: Only invoices created **on or before** this date.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            ``selectinload``-loaded relationships (items, status history) are
            **not** eager-loaded here — the caller should use ``get_with_*`` /
            ``get_complete_aggregate`` when the full aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        filters = []
        needs_patient_join = False

        if search:
            term = search.strip()
            if term:
                pattern = f"%{term}%"
                filters.append(
                    or_(
                        Invoice.invoice_number.ilike(pattern),
                        Patient.first_name.ilike(pattern),
                        Patient.last_name.ilike(pattern),
                    )
                )
                needs_patient_join = True

        if patient_id is not None:
            filters.append(Invoice.patient_id == patient_id)
        if doctor_id is not None:
            filters.append(Invoice.doctor_id == doctor_id)
        if status is not None:
            status_value = status.value if isinstance(status, InvoiceStatus) else status
            filters.append(Invoice.status == status_value)
        if date_from is not None:
            filters.append(Invoice.created_at >= date_from)
        if date_to is not None:
            filters.append(Invoice.created_at <= date_to)

        count_stmt = select(func.count()).select_from(Invoice)
        if needs_patient_join:
            count_stmt = count_stmt.join(Patient, Invoice.patient_id == Patient.id)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = select(Invoice)
        if needs_patient_join:
            stmt = stmt.join(Patient, Invoice.patient_id == Patient.id)
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
    ) -> list[Invoice]:
        """Search invoices by number (case-insensitive substring).

        Intended for type-ahead UIs. Does **not** return child entities; use
        ``get_by_id`` / ``get_complete_aggregate`` when the full aggregate is
        required.

        Logs the lookup as a potentially expensive operation; it is not a
        business event.
        """
        term = term.strip()
        if not term:
            return []
        pattern = f"%{term}%"
        logger.debug("Invoice search: term=%r limit=%d", term, limit)
        stmt = (
            select(Invoice)
            .where(Invoice.invoice_number.ilike(pattern))
            .order_by(Invoice.invoice_number.asc())
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
    ) -> tuple[list[Invoice], int]:
        """Convenience: delegate to :meth:`list` filtered by ``patient_id``."""
        return self.list(
            patient_id=patient_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_doctor(
        self,
        doctor_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Invoice], int]:
        """Convenience: delegate to :meth:`list` filtered by ``doctor_id``."""
        return self.list(
            doctor_id=doctor_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_by_status(
        self,
        status: InvoiceStatus | str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Invoice], int]:
        """Convenience: delegate to :meth:`list` filtered by ``status``."""
        return self.list(
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def find_drafts(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[Invoice], int]:
        """Return invoices in Draft status.

        Convenience: delegate to :meth:`list` filtered by ``DRAFT`` status.
        """
        return self.list(
            status=InvoiceStatus.DRAFT,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ------------------------------------------------------------ statistics
    def count_grouped_by_status(self) -> dict[str, int]:
        """Return a mapping of ``{status_label: count}`` for all invoices.

        Example return::

            {"draft": 12, "issued": 5, "paid": 3, ...}

        The result includes **all** statuses that currently have at least one
        invoice. Statuses with zero invoices are omitted (the caller / service
        layer can fill defaults if needed). Results are ordered by status
        label.
        """
        stmt = (
            select(Invoice.status, func.count().label("cnt"))
            .group_by(Invoice.status)
            .order_by(Invoice.status)
        )
        return {row.status: row.cnt for row in self.db.execute(stmt).all()}

    # ------------------------------------------------- aggregate retrieval
    def get_with_items(self, invoice_id: UUID) -> Optional[Invoice]:
        """Load an invoice with its ``items`` collection eagerly loaded.

        Uses ``selectinload`` so the invoice row and its items are fetched in
        a small, bounded number of queries regardless of item count. No commit
        — the service owns the transaction.
        """
        logger.debug("Loading invoice with items: invoice_id=%s", invoice_id)
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.items))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_with_status_history(
        self, invoice_id: UUID
    ) -> Optional[Invoice]:
        """Load an invoice with its status history eagerly loaded.

        Uses ``selectinload`` to keep the fetch to a fixed number of queries.
        No commit.
        """
        logger.debug(
            "Loading invoice with status history: invoice_id=%s", invoice_id
        )
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.status_history))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_total_allocated_for_invoice(self, invoice_id: UUID) -> Decimal:
        """Compute the total non-refund amount allocated to an invoice.

        Persistence-only operation — a simple SUM query with no business
        logic. Returns zero if no allocations exist. No commit.
        """
        from app.modules.billing.models import PaymentAllocation

        stmt = select(
            func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)
        ).where(
            PaymentAllocation.invoice_id == invoice_id,
            PaymentAllocation.is_refund == False,
        )
        result = self.db.execute(stmt).scalar()
        return Decimal(str(result)) if result is not None else Decimal("0.00")

    def get_invoice_grand_total(self, invoice_id: UUID) -> Decimal:
        """Compute the grand total of an invoice from its line items.

        Persistence-only operation — a simple SUM query with no business
        logic. Returns zero if no items exist (or invoice is not found).
        No commit.
        """
        stmt = select(
            func.coalesce(func.sum(InvoiceItem.net_amount), 0)
        ).where(
            InvoiceItem.invoice_id == invoice_id
        )
        result = self.db.execute(stmt).scalar()
        return Decimal(str(result)) if result is not None else Decimal("0.00")

    def get_total_refunded_for_invoice(self, invoice_id: UUID) -> Decimal:
        """Compute the total refund amount allocated to an invoice.

        Sums all PaymentAllocation.allocated_amount where invoice_id matches
        and is_refund=True. Returns ZERO_MONEY if no refund allocations exist.
        No commit.
        """
        from app.modules.billing.models import PaymentAllocation

        stmt = select(
            func.coalesce(func.sum(PaymentAllocation.allocated_amount), 0)
        ).where(
            PaymentAllocation.invoice_id == invoice_id,
            PaymentAllocation.is_refund == True,
        )
        result = self.db.execute(stmt).scalar()
        return Decimal(str(result)) if result is not None else Decimal("0.00")

    def get_complete_aggregate(
        self, invoice_id: UUID
    ) -> Optional[Invoice]:
        """Load an invoice together with items and status history.

        The single read entry point for operations that need the full
        aggregate (e.g., issuing an invoice or presenting it to a patient).
        ``selectinload`` keeps the fetch to a fixed number of queries and logs
        the (relatively expensive) eager load. No commit.
        """
        logger.debug(
            "Loading complete invoice aggregate: invoice_id=%s", invoice_id
        )
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(
                selectinload(Invoice.items),
                selectinload(Invoice.status_history),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # -------------------------------------------- child entity persistence
    def add_item(self, item: InvoiceItem) -> InvoiceItem:
        """Persist a new invoice item.

        The caller (service) is responsible for setting ``item.invoice_id``
        and ``item.sequence_number`` so the item belongs to the correct
        invoice — this is a persistence operation only, not a business
        decision. Flushes; no commit; no ``refresh()`` (the item has no
        server-defaulted columns and its id is generated client-side).
        """
        self.db.add(item)
        self.db.flush()
        return item

    def bulk_add_items(self, items: list[InvoiceItem]) -> list[InvoiceItem]:
        """Persist multiple invoice items in a single flush.

        The caller is responsible for setting ``invoice_id`` and
        ``sequence_number`` on each item. Flushes once for the entire batch;
        no commit.

        Args:
            items: List of ``InvoiceItem`` entities to persist.

        Returns:
            The list of persisted items.
        """
        self.db.add_all(items)
        self.db.flush()
        return items

    def remove_item(self, item: InvoiceItem) -> None:
        """Delete an invoice item from the session.

        The item is first detached from its owning invoice collection so the
        model's ``delete-orphan`` cascade removes it at flush time — a bare
        ``session.delete()`` on an item still referenced by the collection
        would otherwise be resurrected by the ORM. Flushes; no commit.
        """
        invoice = item.invoice
        if invoice is not None and item in invoice.items:
            invoice.items.remove(item)
        self.db.delete(item)
        self.db.flush()
