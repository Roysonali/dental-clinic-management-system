from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.patient_records.enums import DiagnosisType
from app.modules.patient_records.exceptions import DiagnosisNotFound
from app.modules.patient_records.models import PatientRecordDiagnosis
from app.modules.patient_records.models.patient_record import PatientRecord

# ---------------------------------------------------------------------------
# Whitelist of fields callers may modify via update().
# ---------------------------------------------------------------------------
_ALLOWED_UPDATE_FIELDS: frozenset[str] = frozenset({
    "diagnosis_type",
    "diagnosis",
    "notes",
})


class DiagnosisRepository:
    """Data-access layer for ``PatientRecordDiagnosis``.

    Each diagnosis belongs to exactly one patient record (child entity).
    Soft-delete is supported — deleted diagnoses are hidden by default.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ==================================================================
    # Query helpers
    # ==================================================================

    @staticmethod
    def _apply_base_filter(stmt, *, include_deleted: bool = False):
        if not include_deleted:
            stmt = stmt.where(PatientRecordDiagnosis.is_deleted.is_(False))
        return stmt

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
        diagnosis: PatientRecordDiagnosis,
    ) -> PatientRecordDiagnosis:
        """Persist a new diagnosis and return the refreshed instance.

        Args:
            diagnosis: Unsaved ``PatientRecordDiagnosis`` ORM instance.

        Returns:
            The persisted diagnosis with an assigned ``id``.
        """
        self.db.add(diagnosis)
        self.db.flush()
        self.db.refresh(diagnosis)

        return diagnosis

    def bulk_create(
        self,
        diagnoses: list[PatientRecordDiagnosis],
    ) -> list[PatientRecordDiagnosis]:
        """Persist multiple diagnoses in a single flush.

        All diagnoses must belong to the same patient record.  The
        caller is responsible for ensuring foreign key consistency.

        Args:
            diagnoses: List of unsaved ``PatientRecordDiagnosis`` instances.

        Returns:
            The persisted diagnoses with assigned IDs.
        """
        if not diagnoses:
            return []

        for diagnosis in diagnoses:
            self.db.add(diagnosis)

        self.db.flush()

        for diagnosis in diagnoses:
            self.db.refresh(diagnosis)

        return diagnoses

    # ==================================================================
    # Read — single record
    # ==================================================================

    def get_by_id(
        self,
        diagnosis_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordDiagnosis]:
        """Retrieve a diagnosis by UUID.

        Args:
            diagnosis_id: UUID of the target diagnosis.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching diagnosis, or ``None``.
        """
        stmt = self._apply_base_filter(
            select(PatientRecordDiagnosis).where(
                PatientRecordDiagnosis.id == diagnosis_id
            ),
            include_deleted=include_deleted,
        )

        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_or_raise(
        self,
        diagnosis_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> PatientRecordDiagnosis:
        """Like ``get_by_id`` but raises ``DiagnosisNotFound`` on a miss."""
        diagnosis = self.get_by_id(diagnosis_id, include_deleted=include_deleted)

        if diagnosis is None:
            raise DiagnosisNotFound(diagnosis_id=diagnosis_id)

        return diagnosis

    # ==================================================================
    # Read — collections
    # ==================================================================

    def get_by_record(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        diagnosis_type: Optional[DiagnosisType] = None,
        include_deleted: bool = False,
    ) -> tuple[list[PatientRecordDiagnosis], int]:
        """Return a paginated list of diagnoses for a patient record.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.
            diagnosis_type: Optional ``DiagnosisType`` filter.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            A tuple of ``(diagnoses, total_count)``.
        """
        page, page_size = self._normalize_pagination(page, page_size)

        base_where = (
            PatientRecordDiagnosis.patient_record_id == patient_record_id
        )

        filters = [base_where]

        if diagnosis_type is not None:
            filters.append(
                PatientRecordDiagnosis.diagnosis_type == diagnosis_type
            )

        # --- Count ---
        count_stmt = (
            select(func.count())
            .select_from(PatientRecordDiagnosis)
            .where(*filters)
        )
        count_stmt = self._apply_base_filter(
            count_stmt, include_deleted=include_deleted
        )

        total: int = self.db.execute(count_stmt).scalar() or 0

        # --- Data ---
        stmt = (
            select(PatientRecordDiagnosis)
            .where(*filters)
            .order_by(PatientRecordDiagnosis.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        items = list(self.db.execute(stmt).scalars().all())

        return items, total

    # ==================================================================
    # Update
    # ==================================================================

    def update(
        self,
        diagnosis: PatientRecordDiagnosis,
        updates: dict,
    ) -> PatientRecordDiagnosis:
        """Apply field-level updates to a diagnosis.

        Only keys in ``_ALLOWED_UPDATE_FIELDS`` are applied; all others
        are silently ignored.

        Args:
            diagnosis: The ``PatientRecordDiagnosis`` ORM instance.
            updates: Dictionary of field names to new values.

        Returns:
            The refreshed diagnosis.
        """
        for field, value in updates.items():
            if field not in _ALLOWED_UPDATE_FIELDS:
                continue
            setattr(diagnosis, field, value)

        self.db.flush()
        self.db.refresh(diagnosis)

        return diagnosis

    # ==================================================================
    # Soft delete
    # ==================================================================

    def soft_delete(
        self,
        diagnosis: PatientRecordDiagnosis,
    ) -> None:
        """Idempotent soft-delete for a diagnosis.

        Args:
            diagnosis: The ORM instance to soft-delete.
        """
        if diagnosis.is_deleted:
            return

        diagnosis.is_deleted = True
        self.db.flush()

    # ==================================================================
    # Existence & counting
    # ==================================================================

    def exists(
        self,
        diagnosis_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> bool:
        """Check whether a diagnosis with the given ID exists."""
        stmt = (
            select(PatientRecordDiagnosis.id)
            .where(PatientRecordDiagnosis.id == diagnosis_id)
            .limit(1)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).first() is not None

    def get_patient_id(
        self,
        diagnosis_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[UUID]:
        """Return the ``patient_id`` associated with a diagnosis.

        Joins through ``PatientRecord`` to resolve the owning patient.
        Returns ``None`` if the diagnosis does not exist.
        """
        stmt = (
            select(PatientRecord.patient_id)
            .select_from(PatientRecordDiagnosis)
            .join(
                PatientRecord,
                PatientRecordDiagnosis.patient_record_id == PatientRecord.id,
            )
            .where(PatientRecordDiagnosis.id == diagnosis_id)
            .limit(1)
        )
        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)
        return self.db.execute(stmt).scalar_one_or_none()

    def count(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        diagnosis_type: Optional[DiagnosisType] = None,
        include_deleted: bool = False,
    ) -> int:
        """Count diagnoses matching the given filters.

        Args:
            patient_record_id: Optional patient record UUID filter.
            diagnosis_type: Optional ``DiagnosisType`` filter.
            include_deleted: If ``True``, includes soft-deleted records.

        Returns:
            The total number of matching diagnoses.
        """
        filters: list = []

        if patient_record_id is not None:
            filters.append(
                PatientRecordDiagnosis.patient_record_id == patient_record_id
            )

        if diagnosis_type is not None:
            filters.append(
                PatientRecordDiagnosis.diagnosis_type == diagnosis_type
            )

        stmt = select(func.count()).select_from(PatientRecordDiagnosis)

        if filters:
            stmt = stmt.where(*filters)

        stmt = self._apply_base_filter(stmt, include_deleted=include_deleted)

        return self.db.execute(stmt).scalar() or 0
