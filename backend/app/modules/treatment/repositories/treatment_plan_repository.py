"""TreatmentPlanRepository — aggregate root repository.

This repository manages the ``TreatmentPlan`` aggregate root. Per the
aggregate-boundary architecture decision, the child entities
(``TreatmentPlanItem``, ``TreatmentPlanVersion``, ``TreatmentPlanApproval``)
do **not** get their own repositories — their persistence is coordinated here
under the service layer's transaction.

Scope
-----
* **Core CRUD**: ``create``, ``get_by_id``, ``get_by_plan_code``,
  ``exists``, ``exists_by_plan_code``, ``update``, ``delete``, ``count``.
* **Eager-load reads**: ``get_with_items``, ``get_with_versions``,
  ``get_with_approval``, ``get_complete_aggregate``.
* **Listing / search / filtering**: ``list``, ``search``,
  ``find_by_patient``, ``find_by_doctor``, ``find_by_status``,
  ``find_pending_approval``, ``find_pending_acknowledgment``.
* **Statistics**: ``count_by_status``, ``count_by_doctor``,
  ``count_by_patient``.
* **Child-entity persistence**: ``add_item``, ``remove_item``,
  ``add_version``, ``add_approval``, ``version_exists``,
  ``approval_exists``.

Conventions follow ``procedure_repository.py``: constructor takes a
``Session``; queries use the SQLAlchemy 2.x ``select()`` API; mutations call
``flush()`` (no ``refresh()`` — ``TreatmentPlan`` has no server-defaulted
columns and the UUID PK is populated client-side) but never ``commit()`` /
``rollback()``. Logging is query-level only (duplicate lookups); business
events are logged by the service layer.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Mapping, Optional
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    func,
    or_,
    select,
)
from sqlalchemy.orm import Session, selectinload

from app.modules.treatment.constants import (
    DEFAULT_PAGE_SIZE,
    DEFAULT_SORT_FIELD,
    MAX_PAGE_SIZE,
    TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT,
)
from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.models import (
    TreatmentPlan,
    TreatmentPlanApproval,
    TreatmentPlanItem,
    TreatmentPlanVersion,
)
from app.modules.patients.models import Patient

logger = logging.getLogger(__name__)


class TreatmentPlanRepository:
    """Data access layer for the ``TreatmentPlan`` aggregate root.

    Encapsulates all SQLAlchemy query logic for plan persistence and exposes
    domain-specific method signatures for the service layer to consume.
    """

    # Mutable, directly-settable plan fields. Immutable/business-key fields
    # (``id``, ``plan_code``, ``patient_id``, ``doctor_id``, ``created_by``,
    # ``created_at``, ``updated_at``, ``lock_version``) are excluded so the
    # generic ``update()`` can never overwrite them. ``status`` and
    # ``current_version`` are also excluded: they are managed exclusively by
    # the state machine / versioning logic in the service layer, never by a
    # free-form field update — this keeps workflow transitions on the single
    # authorised code path.
    _ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset(
        {
            "clinical_notes",
            "observations",
            "dentist_recommendations",
            "valid_from",
            "valid_to",
            "updated_by",
        }
    )

    # Explicit column mapping for sort fields — safer to refactor than
    # ``getattr()`` against the model (renaming a column breaks loudly here
    # instead of failing silently at request time).
    _SORT_FIELDS: dict[str, ColumnElement[Any]] = {
        "created_at": TreatmentPlan.created_at,
        "updated_at": TreatmentPlan.updated_at,
        "status": TreatmentPlan.status,
        "plan_code": TreatmentPlan.plan_code,
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
            return sort_by  # type: ignore[return-value]
        return cls._DEFAULT_SORT_FIELD

    # ---------------------------------------------------------------- create
    def create(self, plan: TreatmentPlan) -> TreatmentPlan:
        """Persist a new treatment plan and return the managed instance.

        No ``refresh()`` is needed: the UUID primary key is generated
        client-side and ``TreatmentPlan`` has no server-defaulted columns. The
        service layer owns the transaction.
        """
        self.db.add(plan)
        self.db.flush()
        return plan

    # ----------------------------------------------------------------- read
    def get_by_id(self, plan_id: UUID) -> Optional[TreatmentPlan]:
        """Fetch a plan by its UUID primary key."""
        return self.db.get(TreatmentPlan, plan_id)

    def get_by_plan_code(self, plan_code: str) -> Optional[TreatmentPlan]:
        """Fetch a plan by its (canonical, uppercase) business code."""
        stmt = select(TreatmentPlan).where(TreatmentPlan.plan_code == plan_code)
        return self.db.execute(stmt).scalar_one_or_none()

    # ------------------------------------------------------------- existence
    def exists(self, plan_id: UUID) -> bool:
        """Return ``True`` if a plan with the given id exists."""
        stmt = select(TreatmentPlan.id).where(TreatmentPlan.id == plan_id).limit(1)
        return self.db.execute(stmt).first() is not None

    def exists_by_plan_code(self, plan_code: str) -> bool:
        """Return ``True`` if a plan with the given code already exists.

        Logs duplicate-code lookups (query-level concern, not a business event)
        so the service can decide whether to raise a conflict.
        """
        stmt = (
            select(TreatmentPlan.id)
            .where(TreatmentPlan.plan_code == plan_code)
            .limit(1)
        )
        found = self.db.execute(stmt).first() is not None
        if found:
            logger.debug("Duplicate treatment plan code lookup: %s", plan_code)
        return found

    # -------------------------------------------------------------- mutation
    def update(self, plan: TreatmentPlan, updates: Mapping[str, Any]) -> TreatmentPlan:
        """Apply an allowed subset of ``updates`` to ``plan``.

        Only fields in ``_ALLOWED_UPDATE_FIELDS`` are written; immutable,
        business-key, and workflow-managed fields are silently skipped. The
        validator / service layer is responsible for sending only valid
        fields — the allowlist is a safety net. Flushes but does not commit;
        no ``refresh()`` is needed because each value is already set on the
        in-memory instance.
        """
        for field, value in updates.items():
            if field not in self._ALLOWED_UPDATE_FIELDS:
                continue
            setattr(plan, field, value)
        self.db.flush()
        return plan

    def delete(self, plan: TreatmentPlan) -> None:
        """Remove a plan from the session.

        Hard delete — cascades to its child entities (items, versions,
        approvals) per the model's ``cascade="all, delete-orphan"``. The
        service must enforce the business rule that only draft plans may be
        deleted; ``patient_id`` / ``doctor_id`` FKs use ``ON DELETE RESTRICT``.

        ``StaleDataError`` is raised at flush time if the plan was modified
        (version incremented) by another concurrent transaction — see
        ``lock_version`` / ``version_id_col`` on the model.
        """
        self.db.delete(plan)
        self.db.flush()

    # -------------------------------------------------- activation control
    def activate(self, plan: TreatmentPlan) -> TreatmentPlan:
        """Mark a plan active.

        Flushes; transaction owned by the service. ``StaleDataError`` is
        raised at flush time if the plan was modified concurrently (see
        ``lock_version`` / ``version_id_col``). No ``refresh()`` needed:
        ``is_active`` is set directly on the in-memory instance.

        Mirrors ``ProcedureRepository.activate()``.
        """
        plan.is_active = True
        self.db.flush()
        return plan

    def deactivate(self, plan: TreatmentPlan) -> TreatmentPlan:
        """Mark a plan inactive (soft archive).

        Flushes; transaction owned by the service. This is the intended way
        to retire a plan — hard ``delete()`` is reserved for ``draft`` plans.
        ``StaleDataError`` is raised at flush time if the plan was modified
        concurrently (see ``lock_version`` / ``version_id_col``).

        Mirrors ``ProcedureRepository.deactivate()``.
        """
        plan.is_active = False
        self.db.flush()
        return plan

    def count(self) -> int:
        """Count all treatment plans."""
        stmt = select(func.count()).select_from(TreatmentPlan)
        return self.db.execute(stmt).scalar() or 0

    # ---------------------------------------------------------------- list
    def list(
        self,
        search: str | None = None,
        patient_id: UUID | None = None,
        doctor_id: UUID | None = None,
        status: TreatmentPlanStatus | str | None = None,
        is_active: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[TreatmentPlan], int]:
        """Return a paginated, filterable list of treatment plans.

        Args:
            search: Case-insensitive search across ``plan_code``, patient
                ``first_name``, and patient ``last_name``.
            patient_id: Filter by patient UUID.
            doctor_id: Filter by doctor UUID.
            status: Filter by plan status (``TreatmentPlanStatus`` value or
                raw string).
            is_active: Filter by active/inactive state.
            date_from: Only plans created **on or after** this date.
            date_to: Only plans created **on or before** this date.
            page: 1-based page number (clamped to >= 1).
            page_size: Page size (clamped to ``[1, MAX_PAGE_SIZE]``).
            sort_by: Optional sort field (defaults to ``created_at``).
            sort_order: ``"asc"`` or ``"desc"``.

        Returns:
            A tuple of ``(items, total)``.

        Note:
            The join to ``Patient`` is performed **only** when ``search`` is
            provided, keeping the common no-search path free of unnecessary
            joins. ``selectinload``-loaded relationships (items, versions,
            approval) are **not** eager-loaded here — the caller should use
            ``get_with_*`` / ``get_complete_aggregate`` when the full
            aggregate graph is needed.
        """
        page, page_size = self._normalize_pagination(page, page_size)
        sort_field = self._resolve_sort_field(sort_by)
        sort_column = self._SORT_FIELDS[sort_field]
        order_expr = sort_column.asc() if sort_order == "asc" else sort_column.desc()

        # Build filter list and track joins needed
        filters: list = []
        needs_patient_join = False

        if search:
            term = search.strip()
            if term:
                pattern = f"%{term}%"
                filters.append(
                    or_(
                        TreatmentPlan.plan_code.ilike(pattern),
                        Patient.first_name.ilike(pattern),
                        Patient.last_name.ilike(pattern),
                    )
                )
                needs_patient_join = True

        if patient_id is not None:
            filters.append(TreatmentPlan.patient_id == patient_id)
        if doctor_id is not None:
            filters.append(TreatmentPlan.doctor_id == doctor_id)
        if status is not None:
            status_value = status.value if isinstance(status, TreatmentPlanStatus) else status
            filters.append(TreatmentPlan.status == status_value)
        if is_active is not None:
            filters.append(TreatmentPlan.is_active.is_(is_active))
        if date_from is not None:
            filters.append(TreatmentPlan.created_at >= date_from)
        if date_to is not None:
            filters.append(TreatmentPlan.created_at <= date_to)

        # --- Count query ---
        count_stmt = select(func.count()).select_from(TreatmentPlan)
        if needs_patient_join:
            count_stmt = count_stmt.join(Patient, TreatmentPlan.patient_id == Patient.id)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data query ---
        stmt = select(TreatmentPlan)
        if needs_patient_join:
            stmt = stmt.join(Patient, TreatmentPlan.patient_id == Patient.id)
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
        limit: int = TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT,
    ) -> list[TreatmentPlan]:
        """Search treatment plans by ``plan_code`` (case-insensitive substring).

        Intended for type-ahead UIs or quick-find workflows. Does **not**
        return child entities; use ``get_by_id`` / ``get_complete_aggregate``
        when the full aggregate is required.

        Logs the lookup as a potentially expensive operation; it is not a
        business event.
        """
        term = term.strip()
        if not term:
            return []
        pattern = f"%{term}%"
        logger.debug("Treatment plan search: term=%r limit=%d", term, limit)
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.plan_code.ilike(pattern))
            .order_by(TreatmentPlan.plan_code.asc())
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
    ) -> tuple[list[TreatmentPlan], int]:
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
    ) -> tuple[list[TreatmentPlan], int]:
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
        status: TreatmentPlanStatus | str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[TreatmentPlan], int]:
        """Convenience: delegate to :meth:`list` filtered by ``status``."""
        return self.list(
            status=status,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    # ------------------------------------------ domain-specific queries
    def find_pending_approval(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> tuple[list[TreatmentPlan], int]:
        """Find plans awaiting doctor approval.

        Returns plans in ``PROPOSED`` status where **no** approval record
        exists yet, **or** the existing approval record has not been signed
        (``approved_by IS NULL``). Results ordered by creation date (oldest
        first) to surface the longest-waiting plans.

        Uses ``selectinload`` on the ``approval`` relationship to avoid the
        N+1 implied by the ``has()`` / ``~has()`` EXISTS subqueries.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        filters = [
            TreatmentPlan.status == TreatmentPlanStatus.PROPOSED.value,
            or_(
                ~TreatmentPlan.approval.has(),  # No approval record at all
                TreatmentPlan.approval.has(
                    TreatmentPlanApproval.approved_by.is_(None)
                ),  # Not yet signed
            ),
        ]

        count_stmt = (
            select(func.count())
            .select_from(TreatmentPlan)
            .where(*filters)
        )
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = (
            select(TreatmentPlan)
            .where(*filters)
            .options(selectinload(TreatmentPlan.approval))
            .order_by(TreatmentPlan.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    def find_pending_acknowledgment(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> tuple[list[TreatmentPlan], int]:
        """Find plans awaiting patient acknowledgment.

        Returns plans in ``ACCEPTED`` status where the associated approval
        record has ``patient_status == PENDING``. Results ordered by creation
        date (oldest first).

        Uses ``selectinload`` on the ``approval`` relationship to avoid an N+1
        when iterating results.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        filters = [
            TreatmentPlan.status == TreatmentPlanStatus.ACCEPTED.value,
            TreatmentPlan.approval.has(
                TreatmentPlanApproval.patient_status
                == PatientAcknowledgmentStatus.PENDING.value
            ),
        ]

        count_stmt = (
            select(func.count())
            .select_from(TreatmentPlan)
            .where(*filters)
        )
        total: int = self.db.execute(count_stmt).scalar() or 0

        stmt = (
            select(TreatmentPlan)
            .where(*filters)
            .options(selectinload(TreatmentPlan.approval))
            .order_by(TreatmentPlan.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.execute(stmt).scalars().all())
        return items, total

    # ------------------------------------------------------------ statistics
    def count_by_status(self) -> dict[str, int]:
        """Return a mapping of ``{status_label: count}`` for all plans.

        Example return::

            {"draft": 12, "proposed": 5, "accepted": 3, ...}

        The result includes **all** statuses that currently have at least one
        plan. Statuses with zero plans are omitted (the caller / service layer
        can fill defaults if needed). Results are ordered by status label.
        """
        stmt = (
            select(TreatmentPlan.status, func.count().label("cnt"))
            .group_by(TreatmentPlan.status)
            .order_by(TreatmentPlan.status)
        )
        return {row.status: row.cnt for row in self.db.execute(stmt).all()}

    def count_by_doctor(
        self,
        doctor_id: UUID | None = None,
    ) -> int | dict[str, int]:
        """Count plans, optionally for a specific doctor.

        Args:
            doctor_id: If provided, returns a plain ``int`` count of plans for
                that doctor. If ``None``, returns a mapping of
                ``{doctor_id: count}`` for all doctors.

        Returns:
            ``int`` when ``doctor_id`` is given, otherwise a ``dict``.
        """
        if doctor_id is not None:
            stmt = (
                select(func.count())
                .select_from(TreatmentPlan)
                .where(TreatmentPlan.doctor_id == doctor_id)
            )
            return self.db.execute(stmt).scalar() or 0

        stmt = (
            select(TreatmentPlan.doctor_id, func.count().label("cnt"))
            .group_by(TreatmentPlan.doctor_id)
            .order_by(TreatmentPlan.doctor_id)
        )
        return {str(row.doctor_id): row.cnt for row in self.db.execute(stmt).all()}

    def count_by_patient(
        self,
        patient_id: UUID | None = None,
    ) -> int | dict[str, int]:
        """Count plans, optionally for a specific patient.

        Args:
            patient_id: If provided, returns a plain ``int`` count of plans
                for that patient. If ``None``, returns a mapping of
                ``{patient_id: count}`` for all patients.

        Returns:
            ``int`` when ``patient_id`` is given, otherwise a ``dict``.
        """
        if patient_id is not None:
            stmt = (
                select(func.count())
                .select_from(TreatmentPlan)
                .where(TreatmentPlan.patient_id == patient_id)
            )
            return self.db.execute(stmt).scalar() or 0

        stmt = (
            select(TreatmentPlan.patient_id, func.count().label("cnt"))
            .group_by(TreatmentPlan.patient_id)
            .order_by(TreatmentPlan.patient_id)
        )
        return {str(row.patient_id): row.cnt for row in self.db.execute(stmt).all()}

    # ------------------------------------------------- aggregate retrieval
    def get_with_items(self, plan_id: UUID) -> Optional[TreatmentPlan]:
        """Load a plan with its ``items`` collection eagerly loaded.

        Uses ``selectinload`` so the plan row and its items are fetched in a
        small, bounded number of queries regardless of item count (avoids the
        N+1 behaviour of ``joinedload``). Patient/doctor/audit relationships are
        loaded by the model's own ``selectin`` defaults. No commit — the
        service owns the transaction.
        """
        logger.debug("Loading treatment plan with items: plan_id=%s", plan_id)
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.id == plan_id)
            .options(selectinload(TreatmentPlan.items))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_with_versions(self, plan_id: UUID) -> Optional[TreatmentPlan]:
        """Load a plan with its version snapshots eagerly loaded.

        ``selectinload`` keeps the fetch to a fixed number of queries. No commit.
        """
        logger.debug("Loading treatment plan with versions: plan_id=%s", plan_id)
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.id == plan_id)
            .options(selectinload(TreatmentPlan.versions))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_with_approval(self, plan_id: UUID) -> Optional[TreatmentPlan]:
        """Load a plan with its approval/acknowledgment record eagerly loaded.

        ``selectinload`` keeps the fetch to a fixed number of queries. No commit.
        """
        logger.debug("Loading treatment plan with approval: plan_id=%s", plan_id)
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.id == plan_id)
            .options(selectinload(TreatmentPlan.approval))
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_complete_aggregate(
        self, plan_id: UUID
    ) -> Optional[TreatmentPlan]:
        """Load a plan together with items, versions, and approval.

        The single read entry point for operations that need the full aggregate
        (e.g., generating a version snapshot or presenting a plan to a patient).
        ``selectinload`` keeps the fetch to a fixed number of queries and logs
        the (relatively expensive) eager load. No commit.
        """
        logger.debug(
            "Loading complete treatment plan aggregate: plan_id=%s", plan_id
        )
        stmt = (
            select(TreatmentPlan)
            .where(TreatmentPlan.id == plan_id)
            .options(
                selectinload(TreatmentPlan.items),
                selectinload(TreatmentPlan.versions),
                selectinload(TreatmentPlan.approval),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    # -------------------------------------------- child entity persistence
    def add_item(self, item: TreatmentPlanItem) -> TreatmentPlanItem:
        """Persist a new plan item.

        The caller (service) is responsible for setting ``item.plan_id`` so the
        item belongs to the correct plan — this is a persistence operation only,
        not a business decision. Flushes; no commit; no ``refresh()`` (the item
        has no server-defaulted columns and its id is generated client-side).
        """
        self.db.add(item)
        self.db.flush()
        return item

    def remove_item(self, item: TreatmentPlanItem) -> None:
        """Delete a plan item from the session.

        The item is first detached from its owning plan collection so the
        model's ``delete-orphan`` cascade removes it at flush time — a bare
        ``session.delete()`` on an item still referenced by the collection would
        otherwise be resurrected by the ORM. Flushes; no commit.
        """
        plan = item.plan
        if plan is not None and item in plan.items:
            plan.items.remove(item)
        self.db.delete(item)
        self.db.flush()

    def add_version(self, version: TreatmentPlanVersion) -> TreatmentPlanVersion:
        """Persist an immutable version snapshot.

        The caller sets ``version.plan_id`` and ``changed_by``. Persistence-only;
        flushes; no commit. Version-number uniqueness is guaranteed by the
        ``uq_tp_version_number`` constraint at flush time.
        """
        self.db.add(version)
        self.db.flush()
        return version

    def add_approval(
        self, approval: TreatmentPlanApproval
    ) -> TreatmentPlanApproval:
        """Persist the plan's approval/acknowledgment record.

        The caller sets ``approval.plan_id`` (and ``approved_by`` when the
        doctor approves). This is a persistence operation — *when* to approve is
        a service-layer business decision. Flushes; no commit.
        """
        self.db.add(approval)
        self.db.flush()
        return approval

    def version_exists(self, version_id: UUID) -> bool:
        """Return ``True`` if a plan version with the given id exists."""
        stmt = (
            select(TreatmentPlanVersion.id)
            .where(TreatmentPlanVersion.id == version_id)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    def approval_exists(self, approval_id: UUID) -> bool:
        """Return ``True`` if an approval record with the given id exists."""
        stmt = (
            select(TreatmentPlanApproval.id)
            .where(TreatmentPlanApproval.id == approval_id)
            .limit(1)
        )
        return self.db.execute(stmt).first() is not None

    # ------------------------------------------------- item lookup (Sprint 12A.1)
    def get_item_plan_id(self, item_id: UUID) -> UUID | None:
        """Return the ``plan_id`` that owns the given treatment plan item.

        Returns ``None`` if the item does not exist. Single query collapses
        both existence check and metadata fetch.
        """
        stmt = (
            select(TreatmentPlanItem.plan_id)
            .where(TreatmentPlanItem.id == item_id)
            .limit(1)
        )
        return self.db.execute(stmt).scalar_one_or_none()
