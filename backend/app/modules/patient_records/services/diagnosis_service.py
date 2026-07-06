from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.enums import DiagnosisType
from app.modules.patient_records.exceptions import (
    DiagnosisNotFound,
    PatientRecordBusinessRule,
    PatientRecordNotFound,
)
from app.modules.patient_records.models import (
    PatientRecordAuditLog,
    PatientRecordDiagnosis,
)
from app.modules.patient_records.repositories import (
    PatientRecordRepository,
    DiagnosisRepository,
    AuditLogRepository,
)
from app.modules.patient_records.schemas.diagnosis_schema import (
    DiagnosisCreate,
    DiagnosisUpdate,
)

from app.modules.patient_records.constants import (
    DIAGNOSIS_CREATED,
    DIAGNOSIS_BULK_CREATED,
    DIAGNOSIS_UPDATED,
    DIAGNOSIS_DELETED,
)
from app.modules.patient_records.validators import PatientRecordValidator

logger = logging.getLogger(__name__)


class DiagnosisService:
    """Service-layer orchestrator for ``PatientRecordDiagnosis`` workflows.

    Every diagnosis is created under a parent patient record.  The service
    validates that the parent record exists, is not finalized, and is not
    soft-deleted before allowing mutations.  Audit logs are written for
    every state change.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.diagnosis_repo = DiagnosisRepository(db)
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def create_diagnosis(
        self,
        patient_record_id: UUID,
        payload: DiagnosisCreate,
        actor_id: int,
    ) -> PatientRecordDiagnosis:
        """Create a diagnosis under a patient record.

        Business rules:
        1. The parent patient record must exist.
        2. The parent record must not be finalized.
        3. The parent record must not be soft-deleted.

        Args:
            patient_record_id: UUID of the parent patient record.
            payload: Validated ``DiagnosisCreate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The newly created ``PatientRecordDiagnosis``.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is finalized or deleted.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            diagnosis = PatientRecordDiagnosis(
                patient_record_id=patient_record_id,
                diagnosis_type=payload.diagnosis_type,
                # Schema uses ``diagnosis_name``, model uses ``diagnosis``.
                diagnosis_name=payload.diagnosis_name,
                notes=payload.notes,
            )

            diagnosis = self.diagnosis_repo.create(diagnosis)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=DIAGNOSIS_CREATED,
                new_value=f"diagnosis={diagnosis.diagnosis_name}, type={diagnosis.diagnosis_type}",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Diagnosis created: id=%s, record=%s",
                diagnosis.id,
                patient_record_id,
            )

            return diagnosis

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to create diagnosis: record=%s",
                patient_record_id,
            )
            raise

    def bulk_create(
        self,
        patient_record_id: UUID,
        payloads: list[DiagnosisCreate],
        actor_id: int,
    ) -> list[PatientRecordDiagnosis]:
        """Create multiple diagnoses in a single transaction.

        All diagnoses are created under the same patient record.  If any
        diagnosis fails, the entire batch is rolled back.

        Args:
            patient_record_id: UUID of the parent patient record.
            payloads: List of validated ``DiagnosisCreate`` schemas.
            actor_id: ID of the authenticated user.

        Returns:
            The list of newly created ``PatientRecordDiagnosis`` instances.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is finalized or deleted.
        """
        if not payloads:
            return []

        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            diagnoses = [
                PatientRecordDiagnosis(
                    patient_record_id=patient_record_id,
                    diagnosis_type=p.diagnosis_type,
                    diagnosis=p.diagnosis_name,
                    notes=p.notes,
                )
                for p in payloads
            ]

            diagnoses = self.diagnosis_repo.bulk_create(diagnoses)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=DIAGNOSIS_BULK_CREATED,
                new_value=f"{len(diagnoses)} diagnoses created",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Bulk created %d diagnoses: record=%s",
                len(diagnoses),
                patient_record_id,
            )

            return diagnoses

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to bulk create diagnoses: record=%s",
                patient_record_id,
            )
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_diagnosis(
        self,
        diagnosis_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordDiagnosis]:
        """Retrieve a single diagnosis by ID.

        Args:
            diagnosis_id: UUID of the target diagnosis.
            include_deleted: If ``True``, soft-deleted diagnoses are included.

        Returns:
            The matching diagnosis, or ``None``.
        """
        return self.diagnosis_repo.get_by_id(
            diagnosis_id,
            include_deleted=include_deleted,
        )

    def list_diagnoses(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        diagnosis_type: Optional[DiagnosisType] = None,
    ) -> tuple[list[PatientRecordDiagnosis], int]:
        """Return a paginated list of diagnoses for a patient record.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.
            diagnosis_type: Optional ``DiagnosisType`` filter.

        Returns:
            A tuple of ``(diagnoses, total_count)``.
        """
        return self.diagnosis_repo.get_by_record(
            patient_record_id,
            page=page,
            page_size=page_size,
            diagnosis_type=diagnosis_type,
        )

    # ==================================================================
    # Update
    # ==================================================================

    def update_diagnosis(
        self,
        diagnosis_id: UUID,
        payload: DiagnosisUpdate,
        actor_id: int,
    ) -> PatientRecordDiagnosis:
        """Update a diagnosis.

        Business rules:
        1. The diagnosis must exist.
        2. The parent patient record must not be finalized.
        3. The parent patient record must not be soft-deleted.

        Only fields explicitly provided in ``payload`` are updated
        (``exclude_unset=True``).  The schema uses ``diagnosis_name``
        while the model uses ``diagnosis`` — this mapping is handled
        here in the service layer.

        Args:
            diagnosis_id: UUID of the diagnosis to update.
            payload: Validated ``DiagnosisUpdate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecordDiagnosis``.

        Raises:
            DiagnosisNotFound: If the diagnosis does not exist.
            PatientRecordBusinessRule: If the parent record is finalized
                or deleted.
        """
        try:
            diagnosis = self.diagnosis_repo.get_by_id_or_raise(diagnosis_id)
            record = self.record_repo.get_by_id_or_raise(
                diagnosis.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            # Build updates dict, mapping schema field names to model field names.
            raw_updates = payload.model_dump(exclude_unset=True)
            updates: dict[str, object] = {}

            if "diagnosis_name" in raw_updates:
                updates["diagnosis"] = raw_updates.pop("diagnosis_name")
            updates.update(raw_updates)  # remaining: diagnosis_type, notes

            if not updates:
                return diagnosis

            diagnosis = self.diagnosis_repo.update(diagnosis, updates)

            self._create_audit_log(
                patient_record_id=record.id,
                action=DIAGNOSIS_UPDATED,
                new_value=str(updates),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Diagnosis updated: id=%s, fields=%s",
                diagnosis.id,
                list(updates.keys()),
            )

            return diagnosis

        except (DiagnosisNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update diagnosis: id=%s",
                diagnosis_id,
            )
            raise

    # ==================================================================
    # Soft delete
    # ==================================================================

    def delete_diagnosis(
        self,
        diagnosis_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete a diagnosis.

        Business rules:
        1. The diagnosis must exist.
        2. The parent patient record must not be finalized.
        3. The parent patient record must not be soft-deleted.

        Args:
            diagnosis_id: UUID of the diagnosis to soft-delete.
            actor_id: ID of the authenticated user.
        """
        try:
            diagnosis = self.diagnosis_repo.get_by_id_or_raise(diagnosis_id)
            record = self.record_repo.get_by_id_or_raise(
                diagnosis.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            if diagnosis.is_deleted:
                logger.info(
                    "Diagnosis already deleted (idempotent): id=%s",
                    diagnosis_id,
                )
                return

            self.diagnosis_repo.soft_delete(diagnosis)

            self._create_audit_log(
                patient_record_id=record.id,
                action=DIAGNOSIS_DELETED,
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Diagnosis soft-deleted: id=%s, record=%s",
                diagnosis_id,
                record.id,
            )

        except (DiagnosisNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to soft-delete diagnosis: id=%s",
                diagnosis_id,
            )
            raise

    # ==================================================================
    # Count
    # ==================================================================

    def count_diagnoses(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
        diagnosis_type: Optional[DiagnosisType] = None,
    ) -> int:
        """Count diagnoses matching the given filters.

        Read-only — no audit log or transaction needed.
        """
        return self.diagnosis_repo.count(
            patient_record_id=patient_record_id,
            diagnosis_type=diagnosis_type,
        )

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _create_audit_log(
        self,
        *,
        patient_record_id: UUID,
        action: str,
        performed_by: int,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
    ) -> PatientRecordAuditLog:
        """Create an audit log entry for a business action."""
        audit_log = PatientRecordAuditLog(
            patient_record_id=patient_record_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            performed_by=performed_by,
        )
        return self.audit_repo.create(audit_log)
