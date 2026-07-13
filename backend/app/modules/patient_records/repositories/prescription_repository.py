from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.patient_records.exceptions import PrescriptionNotFound
from app.modules.patient_records.models import PatientRecordPrescription

# ---------------------------------------------------------------------------
# Default load options — eagerly load the items relationship to avoid N+1
# when iterating over prescription medicines.
# ---------------------------------------------------------------------------
_DEFAULT_LOAD_OPTIONS = [
    selectinload(PatientRecordPrescription.items),
]

# ---------------------------------------------------------------------------
# Whitelist of fields callers may modify via update().
# ---------------------------------------------------------------------------
_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "notes",
})


class PrescriptionRepository:
    """Data-access layer for ``PatientRecordPrescription``.

    A prescription is a clinical document issued during a patient visit.
    It contains one or more ``PrescriptionItem`` entries (medicines).
    Soft-delete is supported.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ==================================================================
    # Query helpers
    # ==================================================================

    @staticmethod
    def _apply_base_filter(stmt, *, include_deleted: bool = False):
        if not include_deleted:
            stmt = stmt.where(PatientRecordPrescription.is_deleted.is_(False))
        return stmt

    @staticmethod
    def _apply_eager_load(stmt):
        return stmt.options(*_DEFAULT_LOAD_OPTIONS)

    @staticmethod
    def _normalize_pagination(page: int, page_size: int) -> tuple[int, int]:
        if page < 1:
            page = 1
        if page_size < 1:
            page_size = 20
        elif page_size > 100:
            page_size = 100
        return page, page_size

    # ==================================================================
    # Create
    # ==================================================================

    def create(
        self,
        prescription: PatientRecordPrescription,
    ) -> PatientRecordPrescription:
        """Persist a new prescription and return the refreshed instance.

        Args:
            prescription: Unsaved ``PatientRecordPrescription`` ORM instance.

        Returns:
            The persisted prescription with an assigned ``id``.
        """
        self.db.add(prescription)
        self.db.flush()
        self.db.refresh(prescription)

        return prescription

    # ==================================================================
    # Read — single record
    # ==================================================================

    def get_by_id(
        self,
        prescription_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordPrescription]:
        """Retrieve a prescription by UUID with items eagerly loaded.

        Args:
            prescription_id: UUID of the target prescription.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching prescription, or ``None``.
        """
        stmt = self._apply_base_filter(
            select(PatientRecordPrescription).where(
                PatientRecordPrescription.id == prescription_id
            ),
            include_deleted=include_deleted,
        )
        stmt = self._apply_eager_load(stmt)

        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_or_raise(
        self,
        prescription_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> PatientRecordPrescription:
        """Like ``get_by_id`` but raises ``PrescriptionNotFound`` on a miss."""
        prescription = self.get_by_id(
            prescription_id, include_deleted=include_deleted
        )

        if prescription is None:
            raise PrescriptionNotFound(prescription_id=prescription_id)

        return prescription

    # ==================================================================
    # Read — collections
    # ==================================================================

    def get_by_record(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecordPrescription], int]:
        """Return a paginated list of prescriptions for a patient record.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(prescriptions, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        base_where = (
            PatientRecordPrescription.patient_record_id == patient_record_id
        )

        # --- Count ---
        count_stmt = (
            select(func.count())
            .select_from(PatientRecordPrescription)
            .where(base_where)
        )
        count_stmt = self._apply_base_filter(
            count_stmt, include_deleted=include_deleted
        )

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecordPrescription)
            .where(base_where)
            .order_by(PatientRecordPrescription.prescribed_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        stmt = self._apply_eager_load(stmt)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    # ==================================================================
    # Update
    # ==================================================================

    def update(
        self,
        prescription: PatientRecordPrescription,
        updates: dict,
    ) -> PatientRecordPrescription:
        """Apply field-level updates to a prescription.

        Only keys in ``_ALLOWED_UPDATE_FIELDS`` are applied.

        Args:
            prescription: The ``PatientRecordPrescription`` ORM instance.
            updates: Dictionary of field names to new values.

        Returns:
            The refreshed prescription.
        """
        for field, value in updates.items():
            if field not in _ALLOWED_UPDATE_FIELDS:
                continue
            setattr(prescription, field, value)

        self.db.flush()
        self.db.refresh(prescription)

        return prescription

    def finalize(
        self,
        prescription: PatientRecordPrescription,
    ) -> PatientRecordPrescription:
        """Finalize a prescription by setting ``prescribed_at`` to now.

        This marks the prescription as issued.  Once finalized, the
        prescription is considered immutable for clinical purposes.

        Args:
            prescription: The ``PatientRecordPrescription`` ORM instance.

        Returns:
            The refreshed prescription.
        """
        prescription.prescribed_at = datetime.now(timezone.utc)

        self.db.flush()
        self.db.refresh(prescription)

        return prescription

    # ==================================================================
    # Soft delete
    # ==================================================================

    def soft_delete(
        self,
        prescription: PatientRecordPrescription,
    ) -> None:
        """Idempotent soft-delete for a prescription."""
        if prescription.is_deleted:
            return

        prescription.is_deleted = True
        self.db.flush()

    # ==================================================================
    # Existence & counting
    # ==================================================================

    def exists(
        self,
        prescription_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> bool:
        """Check whether a prescription with the given ID exists."""
        stmt = (
            select(PatientRecordPrescription.id)
            .where(PatientRecordPrescription.id == prescription_id)
            .limit(1)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).first() is not None

    def count(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count prescriptions matching the given filters.

        Args:
            patient_record_id: Optional patient record UUID filter.
            include_deleted: If ``True``, includes soft-deleted records.

        Returns:
            The total number of matching prescriptions.
        """
        filters: list = []

        if patient_record_id is not None:
            filters.append(
                PatientRecordPrescription.patient_record_id
                == patient_record_id
            )

        stmt = select(func.count()).select_from(PatientRecordPrescription)

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).scalar() or 0
