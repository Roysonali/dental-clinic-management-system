from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.modules.patient_records.enums import RecordStatus
from app.modules.patient_records.exceptions import PatientRecordConflict, PatientRecordNotFound
from app.modules.patient_records.models import PatientRecord

# ---------------------------------------------------------------------------
# Default load options — reused by every read method so that all five child
# relationships are eagerly fetched via selectinload (one extra query per
# relationship, avoiding the N+1 problem and the cartesian-product explosion
# that joinedload would cause with multiple to-many relationships).
# ---------------------------------------------------------------------------
_DEFAULT_LOAD_OPTIONS = [
    selectinload(PatientRecord.diagnoses),
    selectinload(PatientRecord.prescriptions),
    selectinload(PatientRecord.attachments),
    selectinload(PatientRecord.followups),
    selectinload(PatientRecord.audit_logs),
]

# ---------------------------------------------------------------------------
# Whitelist of fields that callers are allowed to modify via update_record.
# Any key not in this set is silently ignored, preventing accidental writes
# to immutable fields (id, created_at, is_deleted, etc.).
# ---------------------------------------------------------------------------
_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "chief_complaint",
    "clinical_notes",
    "doctor_remarks",
    "treatment_recommendation",
    "systemic_diseases",
    "surgeries",
    "medications",
    "habits",
    "medical_alerts",
    "allergies",
    "dental_history",
})


class PatientRecordRepository:
    """Data-access layer for the ``PatientRecord`` entity.

    Encapsulates all SQLAlchemy query logic and exposes clean method
    signatures for the service layer. Every public method that reads
    a single record accepts an ``include_deleted`` parameter (default
    ``False``) so that soft-deleted records are hidden by default but
    can still be accessed when needed (e.g., for undo operations or
    audit trails).

    Transactions are *not* committed here — the caller (service layer)
    owns the commit lifecycle via a shared session.
    """

    def __init__(self, db: Session) -> None:
        """Initialise the repository with an active database session.

        Args:
            db: Active SQLAlchemy session (injected by FastAPI dependency).
        """
        self.db = db

    # ==================================================================
    # Query helpers
    # ==================================================================

    @staticmethod
    def _apply_base_filter(stmt, *, include_deleted: bool = False):
        """Add the ``is_deleted=False`` clause unless ``include_deleted``
        is explicitly set to ``True``.

        Most client code should never see soft-deleted records. This
        helper keeps every read method consistent without repeating the
        same WHERE clause.
        """
        if not include_deleted:
            stmt = stmt.where(PatientRecord.is_deleted.is_(False))
        return stmt

    @staticmethod
    def _apply_eager_load(stmt):
        """Attach the default ``selectinload`` options so that all child
        relationships are fetched in secondary queries.

        The model already declares ``lazy=\"selectin\"`` on relationships,
        so this is technically redundant for the *first* access of each
        attribute.  Applying the options explicitly here guarantees the
        behaviour even if the model configuration changes, and makes the
        loading strategy visible in the repository layer.
        """
        return stmt.options(*_DEFAULT_LOAD_OPTIONS)

    # ==================================================================
    # Pagination helpers
    # ==================================================================

    @staticmethod
    def _normalize_pagination(
        page: int,
        page_size: int,
    ) -> tuple[int, int]:
        """Clamp pagination parameters to safe, production-grade bounds.

        * ``page < 1`` → clamped to ``1``.
        * ``page_size < 1`` → clamped to ``20``.
        * ``page_size > 100`` → clamped to ``100`` (prevents
          accidental or malicious unbounded queries).

        Returns:
            A ``(page, page_size)`` tuple with both values in valid ranges.
        """
        if page < 1:
            page = 1

        if page_size < 1:
            page_size = 20
        elif page_size > 100:
            page_size = 100

        return page, page_size

    @staticmethod
    def _build_filters(
        *,
        status: Optional[RecordStatus] = None,
        is_finalized: Optional[bool] = None,
        patient_id: Optional[UUID] = None,
        search: Optional[str] = None,
    ) -> list:
        """Build a list of SQLAlchemy WHERE clauses from optional filter
        parameters.

        Each non-``None`` argument produces one filter expression.  All
        filters are combined with AND.  This method centralises filter
        construction so that ``list_records`` and ``count`` (and any
        future read method) share identical filter logic.

        Args:
            status: Optional ``RecordStatus`` filter.
            is_finalized: Optional finalized-flag filter.
            patient_id: Optional patient UUID filter.
            search: Optional free-text search term applied against
                ``chief_complaint`` and ``clinical_notes``.

        Returns:
            A list of SQLAlchemy filter expressions (may be empty).
        """
        filters: list = []

        if patient_id is not None:
            filters.append(PatientRecord.patient_id == patient_id)

        if status is not None:
            filters.append(PatientRecord.status == status)

        if is_finalized is not None:
            filters.append(PatientRecord.is_finalized == is_finalized)

        if search:
            filters.append(
                or_(
                    PatientRecord.chief_complaint.ilike(f"%{search}%"),
                    PatientRecord.clinical_notes.ilike(f"%{search}%"),
                )
            )

        return filters

    # ==================================================================
    # Create
    # ==================================================================

    def create_patient_record(
        self,
        patient_record: PatientRecord,
    ) -> PatientRecord:
        """Persist a new patient record and return the refreshed instance.

        Args:
            patient_record: Unsaved ``PatientRecord`` ORM instance.

        Returns:
            The persisted record with an assigned ``id`` and all
            relationships eagerly loaded.

        Raises:
            PatientRecordConflict: If an appointment already has a record
                (the ``appointment_id`` column has a unique constraint).
        """
        self.db.add(patient_record)

        try:
            self.db.flush()
        except IntegrityError as exc:
            # Only convert UNIQUE constraint violations into a domain
            # PatientRecordConflict (409).  Other IntegrityErrors (NOT NULL,
            # FK violations, etc.) must propagate as-is so they surface
            # the real database error rather than a misleading 409.
            diag = getattr(exc.orig, 'diag', None)
            constraint_name = getattr(diag, 'constraint_name', None) if diag else None
            if constraint_name and 'appointment_id' in str(constraint_name):
                raise PatientRecordConflict(
                    message=(
                        f"A record already exists for appointment "
                        f"{patient_record.appointment_id}"
                    ),
                    details={"appointment_id": str(patient_record.appointment_id)},
                ) from exc
            raise

        self.db.refresh(patient_record)

        return patient_record

    # ==================================================================
    # Read — single record
    # ==================================================================

    def get_by_id(
        self,
        record_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecord]:
        """Retrieve a patient record by its UUID primary key.

        Args:
            record_id: UUID of the target patient record.
            include_deleted: If ``True``, soft-deleted records are also
                returned.  Default ``False``.

        Returns:
            The matching ``PatientRecord`` with all relationships eagerly
            loaded, or ``None`` if no active (or no matching) record exists.
        """
        stmt = self._apply_base_filter(
            select(PatientRecord).where(PatientRecord.id == record_id),
            include_deleted=include_deleted,
        )
        stmt = self._apply_eager_load(stmt)

        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_appointment(
        self,
        appointment_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecord]:
        """Retrieve the patient record associated with a given appointment.

        Because ``appointment_id`` has a unique constraint, this is a
        one-to-one lookup that returns at most one result.

        Args:
            appointment_id: UUID of the appointment.
            include_deleted: If ``True``, soft-deleted records are also
                returned.  Default ``False``.

        Returns:
            The matching ``PatientRecord``, or ``None``.
        """
        stmt = self._apply_base_filter(
            select(PatientRecord).where(
                PatientRecord.appointment_id == appointment_id
            ),
            include_deleted=include_deleted,
        )
        stmt = self._apply_eager_load(stmt)

        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_or_raise(
        self,
        record_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> PatientRecord:
        """Like ``get_by_id`` but raises ``PatientRecordNotFound`` on
        a miss — saves the caller a null-check.

        This is the preferred method for service-layer code that cannot
        proceed without a valid record.
        """
        record = self.get_by_id(record_id, include_deleted=include_deleted)

        if record is None:
            raise PatientRecordNotFound(record_id=record_id)

        return record

    # ==================================================================
    # Read — collections
    # ==================================================================

    def get_by_patient(
        self,
        patient_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecord], int]:
        """Return a paginated list of patient records for a given patient,
        ordered by most-recent first.

        Args:
            patient_id: UUID of the patient.
            page: 1-indexed page number.  Default 1.
            page_size: Max records per page.  Default 20.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(records, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        base_where = PatientRecord.patient_id == patient_id

        # --- Count ---
        count_stmt = select(func.count()).select_from(PatientRecord).where(base_where)
        count_stmt = self._apply_base_filter(count_stmt, include_deleted=include_deleted)

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecord)
            .where(base_where)
            .order_by(PatientRecord.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        stmt = self._apply_eager_load(stmt)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    def list_records(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[RecordStatus] = None,
        is_finalized: Optional[bool] = None,
        patient_id: Optional[UUID] = None,
        search: Optional[str] = None,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecord], int]:
        """Return a paginated, filterable list of patient records.

        Supports the following optional filters:

        * ``status`` — exact match on ``RecordStatus``.
        * ``is_finalized`` — boolean flag.
        * ``patient_id`` — exact patient match.
        * ``search`` — case-insensitive partial match against
          ``chief_complaint`` and ``clinical_notes`` (combined with OR).

        All filters are additive (AND).  Results are ordered by
        ``created_at DESC``.

        Args:
            page: 1-indexed page number.  Default 1.
            page_size: Max records per page.  Default 20.
            status: Optional ``RecordStatus`` filter.
            is_finalized: Optional finalized-flag filter.
            patient_id: Optional patient UUID filter.
            search: Optional free-text search term.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(records, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        filters = self._build_filters(
            status=status,
            is_finalized=is_finalized,
            patient_id=patient_id,
            search=search,
        )

        # --- Count ---
        count_stmt = select(func.count()).select_from(PatientRecord)

        if filters:
            count_stmt = count_stmt.where(*filters)

        count_stmt = self._apply_base_filter(count_stmt, include_deleted=include_deleted)

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecord)
            .order_by(PatientRecord.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        stmt = self._apply_eager_load(stmt)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    # ==================================================================
    # Update
    # ==================================================================

    def update_record(
        self,
        record: PatientRecord,
        updates: dict,
    ) -> PatientRecord:
        """Apply field-level updates to an existing patient record.

        Only keys present in ``_ALLOWED_UPDATE_FIELDS`` are applied;
        all other keys are silently ignored.  This whitelist prevents
        accidental modifications to immutable or system-managed columns
        (``id``, ``patient_id``, ``appointment_id``, ``created_at``,
        ``updated_at``, ``is_deleted``, ``is_finalized``).

        The record is flushed and refreshed before being returned so
        that DB-generated timestamps and any side-effect changes (e.g.
        triggers, computed columns) are reflected in the returned object.

        Args:
            record: The ``PatientRecord`` ORM instance to update (must
                already be persisted).
            updates: Dictionary mapping attribute names to new values.

        Returns:
            The refreshed ``PatientRecord`` with all relationships loaded.
        """
        for field, value in updates.items():
            if field not in _ALLOWED_UPDATE_FIELDS:
                continue
            setattr(record, field, value)

        self.db.flush()
        self.db.refresh(record)

        return record

    def update_status(
        self,
        record: PatientRecord,
        new_status: RecordStatus,
    ) -> PatientRecord:
        """Update the ``status`` field of a patient record.

        This is intentionally a separate method (rather than routing
        through ``update_record``) because status transitions often
        carry domain-specific side-effects that the service layer
        coordinates (e.g., audit logging, validation).

        The record is refreshed after flush so that DB-generated
        ``updated_at`` reflects the change and the returned object
        is fully synchronised with the database.

        Args:
            record: The ``PatientRecord`` ORM instance to update.
            new_status: The target ``RecordStatus`` value.

        Returns:
            The refreshed patient record.
        """
        record.status = new_status

        self.db.flush()
        self.db.refresh(record)

        return record

    def finalize_record(
        self,
        record: PatientRecord,
    ) -> PatientRecord:
        """Mark a patient record as finalised.

        Once finalised, the record is considered immutable for clinical
        purposes.  The ``is_finalized`` boolean is set to ``True``, and
        the ``status`` is advanced to ``FINALIZED``.

        The record is refreshed after flush so that the caller receives
        a fully synchronised object with the latest ``updated_at`` and
        any other DB-generated values.

        Args:
            record: The ``PatientRecord`` ORM instance to finalise.

        Returns:
            The refreshed patient record.
        """
        record.is_finalized = True
        record.status = RecordStatus.FINALIZED

        self.db.flush()
        self.db.refresh(record)

        return record

    # ==================================================================
    # Soft delete
    # ==================================================================

    def soft_delete(
        self,
        record: PatientRecord,
    ) -> None:
        """Soft-delete a patient record by setting ``is_deleted`` to ``True``.

        This method is **idempotent**: calling it multiple times on the
        same record has no additional effect beyond the first call.

        The row is not removed from the database; it is merely hidden
        from all default queries.  This is the preferred deletion
        strategy for regulated medical data.

        The caller is responsible for loading the record before calling
        this method (e.g. via ``get_by_id_or_raise``).  The repository
        does **not** re-query the database here — it operates on the
        already-loaded ORM instance.

        Args:
            record: The ``PatientRecord`` ORM instance to soft-delete.
        """
        if record.is_deleted:
            return

        record.is_deleted = True

        self.db.flush()

    # ==================================================================
    # Existence & counting
    # ==================================================================

    def exists(
        self,
        record_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> bool:
        """Check whether a patient record with the given ID exists.

        Args:
            record_id: UUID to check.
            include_deleted: If ``True``, soft-deleted records also count
                as existing.  Default ``False``.

        Returns:
            ``True`` if a matching record is found, ``False`` otherwise.
        """
        stmt = (
            select(PatientRecord.id)
            .where(PatientRecord.id == record_id)
            .limit(1)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).first() is not None

    def count(
        self,
        *,
        status: Optional[RecordStatus] = None,
        is_finalized: Optional[bool] = None,
        patient_id: Optional[UUID] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count patient records matching the given filters.

        All filter parameters are optional and additive (AND).
        Filter logic is delegated to ``_build_filters`` so that
        it stays consistent with ``list_records``.

        Args:
            status: Optional ``RecordStatus`` filter.
            is_finalized: Optional finalized-flag filter.
            patient_id: Optional patient UUID filter.
            include_deleted: If ``True``, soft-deleted records are included
                in the count.

        Returns:
            The total number of matching records.
        """
        filters = self._build_filters(
            status=status,
            is_finalized=is_finalized,
            patient_id=patient_id,
        )

        stmt = select(func.count()).select_from(PatientRecord)

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).scalar() or 0
