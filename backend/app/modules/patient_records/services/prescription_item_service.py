from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.exceptions import (
    PatientRecordBusinessRule,
    PatientRecordNotFound,
    PrescriptionItemNotFound,
    PrescriptionNotFound,
)
from app.modules.patient_records.models import (
    PatientRecordAuditLog,
    PatientRecordPrescriptionItem,
)
from app.modules.patient_records.repositories import (
    PatientRecordRepository,
    PrescriptionRepository,
    PrescriptionItemRepository,
    AuditLogRepository,
)
from app.modules.patient_records.schemas.prescription_schema import (
    PrescriptionItemCreate,
    PrescriptionItemUpdate,
)

from app.modules.patient_records.constants import (
    PRESCRIPTION_ITEM_CREATED,
    PRESCRIPTION_ITEM_BULK_CREATED,
    PRESCRIPTION_ITEM_UPDATED,
    PRESCRIPTION_ITEM_DELETED,
)
from app.modules.patient_records.validators import PatientRecordValidator

logger = logging.getLogger(__name__)


class PrescriptionItemService:
    """Service-layer orchestrator for ``PatientRecordPrescriptionItem`` workflows.

    Items belong to a prescription which in turn belongs to a patient record.
    Mutations are gated on the parent record — if the record is finalised
    or soft-deleted no item-level change is permitted.
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.item_repo = PrescriptionItemRepository(db)
        self.prescription_repo = PrescriptionRepository(db)
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def create_item(
        self,
        prescription_id: UUID,
        payload: PrescriptionItemCreate,
        actor_id: int,
    ) -> PatientRecordPrescriptionItem:
        """Create a single medicine item under a prescription.

        Business rules:
        1. The prescription must exist.
        2. The parent patient record must exist.
        3. The parent record must not be finalised or soft-deleted.

        Args:
            prescription_id: UUID of the parent prescription.
            payload: Validated ``PrescriptionItemCreate`` schema.
            actor_id: ID of the authenticated user (for audit log).

        Returns:
            The newly created ``PatientRecordPrescriptionItem``.

        Raises:
            PrescriptionNotFound: If the prescription does not exist.
            PatientRecordNotFound: If the parent record does not exist.
            PatientRecordBusinessRule: If the record is immutable.
        """
        try:
            prescription = self.prescription_repo.get_by_id_or_raise(prescription_id)
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            item = PatientRecordPrescriptionItem(
                prescription_id=prescription_id,
                medicine_name=payload.medicine_name,
                dosage=payload.dosage,
                frequency=payload.frequency,
                duration=payload.duration,
                instructions=payload.instructions,
            )

            item = self.item_repo.create(item)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_ITEM_CREATED,
                new_value=f"medicine={item.medicine_name}, dosage={item.dosage}",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription item created: id=%s, prescription=%s, medicine=%s",
                item.id,
                prescription_id,
                item.medicine_name,
            )

            return item

        except (PrescriptionNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to create prescription item: prescription=%s",
                prescription_id,
            )
            raise

    def bulk_create(
        self,
        prescription_id: UUID,
        payloads: list[PrescriptionItemCreate],
        actor_id: int,
    ) -> list[PatientRecordPrescriptionItem]:
        """Create multiple medicine items under a prescription in one transaction.

        Business rules:
        1. The prescription must exist.
        2. The parent patient record must exist.
        3. The parent record must not be finalised or soft-deleted.

        Args:
            prescription_id: UUID of the parent prescription.
            payloads: List of validated ``PrescriptionItemCreate`` schemas.
            actor_id: ID of the authenticated user.

        Returns:
            The list of newly created ``PatientRecordPrescriptionItem`` instances.

        Raises:
            PrescriptionNotFound: If the prescription does not exist.
            PatientRecordBusinessRule: If the record is immutable.
        """
        if not payloads:
            return []

        try:
            prescription = self.prescription_repo.get_by_id_or_raise(prescription_id)
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            items = [
                PatientRecordPrescriptionItem(
                    prescription_id=prescription_id,
                    medicine_name=p.medicine_name,
                    dosage=p.dosage,
                    frequency=p.frequency,
                    duration=p.duration,
                    instructions=p.instructions,
                )
                for p in payloads
            ]

            items = self.item_repo.bulk_create(items)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_ITEM_BULK_CREATED,
                new_value=f"{len(items)} items created",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Bulk created %d prescription items: prescription=%s",
                len(items),
                prescription_id,
            )

            return items

        except (PrescriptionNotFound, PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to bulk create prescription items: prescription=%s",
                prescription_id,
            )
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_item(
        self,
        item_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecordPrescriptionItem]:
        """Retrieve a single prescription item by ID.

        Read-only — no audit log or transaction needed.

        Args:
            item_id: UUID of the target item.
            include_deleted: If ``True``, soft-deleted items are included.

        Returns:
            The matching item, or ``None``.
        """
        return self.item_repo.get_by_id(
            item_id,
            include_deleted=include_deleted,
        )

    def list_items(
        self,
        prescription_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PatientRecordPrescriptionItem], int]:
        """Return a paginated list of items for a prescription.

        Read-only — no audit log or transaction needed.

        Args:
            prescription_id: UUID of the parent prescription.
            page: 1-indexed page number.
            page_size: Max records per page.

        Returns:
            A tuple of ``(items, total_count)``.
        """
        return self.item_repo.get_by_prescription(
            prescription_id,
            page=page,
            page_size=page_size,
        )

    # ==================================================================
    # Update
    # ==================================================================

    def update_item(
        self,
        item_id: UUID,
        payload: PrescriptionItemUpdate,
        actor_id: int,
    ) -> PatientRecordPrescriptionItem:
        """Update a prescription item.

        Business rules:
        1. The item must exist.
        2. The parent prescription must exist.
        3. The parent patient record must not be finalised or deleted.

        Only fields explicitly provided in ``payload`` are applied
        (``exclude_unset=True``).  The repository's field whitelist
        further restricts which columns can be touched.

        Args:
            item_id: UUID of the item to update.
            payload: Validated ``PrescriptionItemUpdate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecordPrescriptionItem``.

        Raises:
            PrescriptionItemNotFound: If the item does not exist.
            PatientRecordBusinessRule: If the parent record is immutable.
        """
        try:
            item = self.item_repo.get_by_id_or_raise(item_id)
            prescription = self.prescription_repo.get_by_id_or_raise(
                item.prescription_id,
            )
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            updates = payload.model_dump(exclude_unset=True)

            if not updates:
                return item

            item = self.item_repo.update(item, updates)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_ITEM_UPDATED,
                new_value=str(updates),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription item updated: id=%s, fields=%s",
                item.id,
                list(updates.keys()),
            )

            return item

        except (
            PrescriptionItemNotFound,
            PrescriptionNotFound,
            PatientRecordNotFound,
            PatientRecordBusinessRule,
        ):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update prescription item: id=%s",
                item_id,
            )
            raise

    # ==================================================================
    # Soft delete
    # ==================================================================

    def delete_item(
        self,
        item_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete a prescription item.

        Business rules:
        1. The item must exist.
        2. The parent prescription must exist.
        3. The parent patient record must not be finalised or deleted.

        Args:
            item_id: UUID of the item to soft-delete.
            actor_id: ID of the authenticated user.
        """
        try:
            item = self.item_repo.get_by_id_or_raise(item_id)
            prescription = self.prescription_repo.get_by_id_or_raise(
                item.prescription_id,
            )
            record = self.record_repo.get_by_id_or_raise(
                prescription.patient_record_id,
            )
            PatientRecordValidator.assert_modifiable(record)

            if item.is_deleted:
                logger.info(
                    "Prescription item already deleted (idempotent): id=%s",
                    item_id,
                )
                return

            self.item_repo.soft_delete(item)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PRESCRIPTION_ITEM_DELETED,
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "Prescription item soft-deleted: id=%s, prescription=%s",
                item_id,
                prescription.id,
            )

        except (
            PrescriptionItemNotFound,
            PrescriptionNotFound,
            PatientRecordNotFound,
            PatientRecordBusinessRule,
        ):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to soft-delete prescription item: id=%s",
                item_id,
            )
            raise

    # ==================================================================
    # Count
    # ==================================================================

    def count_items(
        self,
        *,
        prescription_id: Optional[UUID] = None,
    ) -> int:
        """Count prescription items matching the given filters.

        Read-only — no audit log or transaction needed.
        """
        return self.item_repo.count(
            prescription_id=prescription_id,
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
