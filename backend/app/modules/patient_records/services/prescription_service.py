from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.exceptions import (
    PatientRecordBusinessRule,
    PatientRecordNotFound,
    PrescriptionNotFound,
)
from app.modules.patient_records.models import (
    PatientRecordAuditLog,
    PatientRecordPrescription,
    PatientRecordPrescriptionItem,
)
from app.modules.patient_records.repositories import (
    PatientRecordRepository,
    PrescriptionRepository,
    PrescriptionItemRepository,
    AuditLogRepository,
)
from app.modules.patient_records.schemas.prescription_schema import (
    PrescriptionCreate,
    PrescriptionUpdate,
)

from app.modules.patient_records.constants import (
    PRESCRIPTION_CREATED,
    PRESCRIPTION_UPDATED,
    PRESCRIPTION_FINALIZED,
    PRESCRIPTION_DELETED,
)
from app.modules.patient_records.validators import PatientRecordValidator

logger = logging.getLogger(__name__)


class PrescriptionService:
    """Service-layer orchestrator for ``PatientRecordPrescription`` workflows.

    A prescription is a clinical document containing one or more medicines
    (items).  The prescription and its items are created together in a
    single transaction.  The parent patient record must exist, must not
    be finalized, and must not be soft-deleted.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.prescription_repo = PrescriptionRepository(db)
        self.item_repo = PrescriptionItemRepository(db)
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def create_prescription(
        self,
        patient_record_id: UUID,
        prescribed_by: int,
        payload: PrescriptionCreate,
        actor_id: int,
    ) -> PatientRecordPrescription:
        """Create a prescription with its items under a patient record.

        Business rules:
        1. The parent patient record must exist.
        2. The parent record must not be finalized or soft-deleted.
        3. The prescription must contain at least one item (validated by
           Pydantic's ``min_length=1`` on ``PrescriptionCreate.items``,
           also checked here defensively).

        Args:
            patient_record_id: UUID of the parent patient record.
            prescribed_by: User ID of the prescribing clinician.
            payload: Validated ``PrescriptionCreate`` schema with items.
            actor_id: ID of the authenticated user (for audit log).

        Returns:
            The newly created ``PatientRecordPrescription`` with items
            eagerly loaded.

        Raises:
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is finalized or
                soft-deleted, or if no items are provided.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(patient_record_id)
            PatientRecordValidator.assert_modifiable(record)

            if not payload.items:
                raise PatientRecordBusinessRule(
                    message="Prescription must contain at least one item",
                    details={"patient_record_id": str(patient_record_id)},
                )

            # Build medicine items first so they can be attached to the
            # prescription ORM instance before persistence.
            items = [
                PatientRecordPrescriptionItem(
                    medicine_name=item.medicine_name,
                    dosage=item.dosage,
                    frequency=item.frequency,
                    duration=item.duration,
                    instructions=item.instructions,
                )
                for item in payload.items
            ]

            prescription = PatientRecordPrescription(
                patient_record_id=patient_record_id,
                prescribed_by=prescribed_by,
                notes=payload.notes,
                items=items,
            )

            prescription = self.prescription_repo.create(prescription)

            self._create_audit_log(
                patient_record_id=patient_record_id,
                action=PRESCRIPTION_CREATED,
                new_value=(
                    f"prescription={prescription.id}, "
                    f"items={len(items)} medicines"
                ),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription created: id=%s, record=%s, items=%d",
                prescription.id,
                patient_record_id,
                len(items),
            )

            return prescription

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to create prescription: record=%s",
                patient_record_id,
            )
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_prescription(
        self,
        prescription_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordPrescription]:
        """Retrieve a single prescription by ID with items eagerly loaded.

        Args:
            prescription_id: UUID of the target prescription.
            include_deleted: If ``True``, soft-deleted prescriptions are
                included.

        Returns:
            The matching prescription (with items), or ``None``.
        """
        return self.prescription_repo.get_by_id(
            prescription_id,
            include_deleted=include_deleted,
        )

    def list_prescriptions(
        self,
        patient_record_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordPrescription], int]:
        """Return a paginated list of prescriptions for a patient record.

        Args:
            patient_record_id: UUID of the parent patient record.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(prescriptions, total_count)``.
        """
        return self.prescription_repo.get_by_record(
            patient_record_id,
            page=page,
            page_size=page_size,
        )

    # ==================================================================
    # Update
    # ==================================================================

    def update_prescription(
        self,
        prescription_id: UUID,
        payload: PrescriptionUpdate,
        actor_id: int,
    ) -> PatientRecordPrescription:
        """Update a prescription's notes.

        Business rules:
        1. The prescription must exist.
        2. The parent patient record must not be finalized or deleted.

        Only ``notes`` can be modified after creation (prescribed_by and
        items are managed through separate operations).

        Args:
            prescription_id: UUID of the prescription to update.
            payload: Validated ``PrescriptionUpdate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecordPrescription``.

        Raises:
            PrescriptionNotFound: If the prescription does not exist.
            PatientRecordBusinessRule: If the parent record is immutable.
        """
        try:
            prescription = self.prescription_repo.get_by_id_or_raise(
                prescription_id,
            )
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            updates = payload.model_dump(exclude_unset=True)

            if not updates:
                return prescription

            prescription = self.prescription_repo.update(
                prescription, updates,
            )

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_UPDATED,
                new_value=str(updates),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription updated: id=%s, fields=%s",
                prescription.id,
                list(updates.keys()),
            )

            return prescription

        except (PrescriptionNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update prescription: id=%s",
                prescription_id,
            )
            raise

    # ==================================================================
    # Finalize
    # ==================================================================

    def finalize_prescription(
        self,
        prescription_id: UUID,
        actor_id: int,
    ) -> PatientRecordPrescription:
        """Finalize a prescription, marking it as issued.

        Business rules:
        1. The prescription must exist.
        2. The parent patient record must not be finalized or deleted.

        Once finalized, the ``prescribed_at`` timestamp is set to the
        current UTC time.  Further modifications are discouraged but
        not blocked at the service layer — the repository's field
        whitelist prevents changes to ``prescribed_at`` via update().

        Args:
            prescription_id: UUID of the prescription to finalize.
            actor_id: ID of the authenticated user.

        Returns:
            The finalized ``PatientRecordPrescription``.
        """
        try:
            prescription = self.prescription_repo.get_by_id_or_raise(
                prescription_id,
            )
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            prescription = self.prescription_repo.finalize(prescription)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_FINALIZED,
                new_value=f"prescribed_at={prescription.prescribed_at}",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription finalized: id=%s, record=%s",
                prescription.id,
                record.id,
            )

            return prescription

        except (PrescriptionNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to finalize prescription: id=%s",
                prescription_id,
            )
            raise

    # ==================================================================
    # Soft delete
    # ==================================================================

    def delete_prescription(
        self,
        prescription_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete a prescription.

        Business rules:
        1. The prescription must exist.
        2. The parent patient record must not be finalized or deleted.

        Args:
            prescription_id: UUID of the prescription to soft-delete.
            actor_id: ID of the authenticated user.
        """
        try:
            prescription = self.prescription_repo.get_by_id_or_raise(
                prescription_id,
            )
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            if prescription.is_deleted:
                logger.info(
                    "Prescription already deleted (idempotent): id=%s",
                    prescription_id,
                )
                return

            self.prescription_repo.soft_delete(prescription)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_DELETED,
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription soft-deleted: id=%s, record=%s",
                prescription_id,
                record.id,
            )

        except (PrescriptionNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to soft-delete prescription: id=%s",
                prescription_id,
            )
            raise

    # ==================================================================
    # Count
    # ==================================================================

    def count_prescriptions(
        self,
        *,
        patient_record_id: Optional[UUID] = None,
    ) -> int:
        """Count prescriptions matching the given filters.

        Read-only — no audit log or transaction needed.
        """
        return self.prescription_repo.count(
            patient_record_id=patient_record_id,
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
