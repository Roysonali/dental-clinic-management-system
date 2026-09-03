from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.patient_records.enums import RecordStatus
from app.modules.patient_records.exceptions import (
    PatientRecordBusinessRule,
    PatientRecordConflict,
    PatientRecordNotFound,
)
from app.modules.patient_records.models import (
    PatientRecord,
    PatientRecordAuditLog,
)
from app.modules.patient_records.repositories import (
    PatientRecordRepository,
)
from app.modules.patient_records.repositories.audit_repository import (
    AuditLogRepository,
)
from app.modules.patient_records.schemas.patient_record_schema import (
    PatientRecordCreate,
    PatientRecordUpdate,
)

from app.modules.appointments.repository import (
    AppointmentRepository,
)
from app.modules.patients.repository import (
    PatientRepository,
)

from app.modules.patient_records.constants import (
    PATIENT_RECORD_CREATED,
    PATIENT_RECORD_UPDATED,
    PATIENT_RECORD_STATUS_CHANGED,
    PATIENT_RECORD_FINALIZED,
    PATIENT_RECORD_DELETED,
)
from app.modules.patient_records.validators import PatientRecordValidator

logger = logging.getLogger(__name__)


class PatientRecordService:
    """Service-layer orchestrator for ``PatientRecord`` workflows.

    Responsibilities:
    * Business rule validation (patient/appointment existence, finalization
      guard, soft-delete guard).
    * Transaction ownership (commit on success, rollback on failure).
    * Audit logging for every state-changing operation.
    * Coordination between repositories (patient records, patients,
      appointments, audit logs).

    The service layer is the **only** layer that calls ``commit()``.
    Repositories only ``flush()``.
    """

    def __init__(self, db: Session) -> None:
        """Initialise the service with an active database session and
        all required repositories.

        Args:
            db: Active SQLAlchemy session (injected by FastAPI dependency).
        """
        self.db = db
        self.record_repo = PatientRecordRepository(db)
        self.audit_repo = AuditLogRepository(db)
        self.patient_repo = PatientRepository(db)
        self.appointment_repo = AppointmentRepository(db)

    # ==================================================================
    # Create
    # ==================================================================

    def create_patient_record(
        self,
        payload: PatientRecordCreate,
        actor_id: int,
    ) -> PatientRecord:
        """Create a new patient record for a given patient and appointment.

        Business rules:
        1. The patient must exist in the database.
        2. The appointment must exist in the database.
        3. The appointment must not already have a patient record
           (enforced by a unique constraint on ``appointment_id``,
           also checked here defensively).

        Args:
            payload: Validated ``PatientRecordCreate`` schema.
            actor_id: ID of the authenticated user performing the action.

        Returns:
            The newly created ``PatientRecord`` with all relationships loaded.

        Raises:
            PatientRecordBusinessRule: If the patient or appointment
                does not exist.
            PatientRecordConflict: If the appointment already has a record.
        """
        try:
            # ── Pre-conditions ──────────────────────────────────────
            self._assert_patient_exists(payload.patient_id)

            # Appointment is optional. When provided, validate its
            # existence and enforce the one-record-per-appointment rule.
            if payload.appointment_id is not None:
                self._assert_appointment_exists(payload.appointment_id)

                # Defensive check: see if a record already exists for this
                # appointment before hitting the DB constraint.
                existing = self.record_repo.get_by_appointment(
                    payload.appointment_id,
                )
                if existing is not None:
                    raise PatientRecordConflict(
                        message=(
                            f"A record already exists for appointment "
                            f"{payload.appointment_id}"
                        ),
                        details={"appointment_id": str(payload.appointment_id)},
                    )

            # ── Build the ORM instance ──────────────────────────────
            record = PatientRecord(
                patient_id=payload.patient_id,
                appointment_id=payload.appointment_id,
                chief_complaint=payload.chief_complaint,
                clinical_notes=payload.clinical_notes,
                doctor_remarks=payload.doctor_remarks,
                treatment_recommendation=payload.treatment_recommendation,
                systemic_diseases=payload.systemic_diseases,
                surgeries=payload.surgeries,
                medications=payload.medications,
                habits=payload.habits,
                medical_alerts=payload.medical_alerts,
                allergies=payload.allergies,
                dental_history=payload.dental_history,
            )

            # ── Persist ─────────────────────────────────────────────
            record = self.record_repo.create_patient_record(record)

            # ── Audit ───────────────────────────────────────────────
            self._create_audit_log(
                patient_record_id=record.id,
                action=PATIENT_RECORD_CREATED,
                new_value=f"appointment_id={record.appointment_id}, patient_id={record.patient_id}",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "PatientRecord created: id=%s, patient=%s, appointment=%s",
                record.id,
                record.patient_id,
                record.appointment_id or "(none)",
            )

            return record

        except (PatientRecordBusinessRule, PatientRecordConflict):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to create patient record: patient=%s, appointment=%s",
                payload.patient_id,
                payload.appointment_id or "(none)",
            )
            raise

    # ==================================================================
    # Read
    # ==================================================================

    def get_record(
        self,
        record_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecord]:
        """Retrieve a patient record by ID.

        Args:
            record_id: UUID of the target record.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching ``PatientRecord``, or ``None``.
        """
        return self.record_repo.get_by_id(
            record_id,
            include_deleted=include_deleted,
        )

    def get_record_or_raise(
        self,
        record_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> PatientRecord:
        """Retrieve a patient record or raise if not found.

        Args:
            record_id: UUID of the target record.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching ``PatientRecord``.

        Raises:
            PatientRecordNotFound: If the record does not exist.
        """
        return self.record_repo.get_by_id_or_raise(
            record_id,
            include_deleted=include_deleted,
        )

    def get_record_by_appointment(
        self,
        appointment_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Optional[PatientRecord]:
        """Retrieve the patient record for a given appointment.

        Args:
            appointment_id: UUID of the appointment.
            include_deleted: If ``True``, soft-deleted records are included.

        Returns:
            The matching ``PatientRecord``, or ``None``.
        """
        return self.record_repo.get_by_appointment(
            appointment_id,
            include_deleted=include_deleted,
        )

    def list_records(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        status: Optional[RecordStatus] = None,
        is_finalized: Optional[bool] = None,
        patient_id: Optional[UUID] = None,
        search: Optional[str] = None,
    ) -> tuple[list[PatientRecord], int]:
        """Return a paginated, filterable list of patient records.

        All filtering is delegated to the repository layer.
        """
        return self.record_repo.list_records(
            page=page,
            page_size=page_size,
            status=status,
            is_finalized=is_finalized,
            patient_id=patient_id,
            search=search,
        )

    # ==================================================================
    # Update
    # ==================================================================

    def update_record(
        self,
        record_id: UUID,
        payload: PatientRecordUpdate,
        actor_id: int,
    ) -> PatientRecord:
        """Update a patient record's clinical fields.

        Business rules:
        1. The record must exist and not be soft-deleted.
        2. A finalized record cannot be modified.
        3. Only fields explicitly provided in ``payload`` are updated
           (``exclude_unset=True``).

        Args:
            record_id: UUID of the record to update.
            payload: Validated ``PatientRecordUpdate`` schema.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecord``.

        Raises:
            PatientRecordNotFound: If the record does not exist.
            PatientRecordBusinessRule: If the record is finalized or
                soft-deleted.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(record_id)

            PatientRecordValidator.assert_not_finalized(record)
            PatientRecordValidator.assert_not_deleted(record)

            updates = payload.model_dump(exclude_unset=True)

            if not updates:
                # Nothing to change — return early without audit.
                return record

            record = self.record_repo.update_record(record, updates)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PATIENT_RECORD_UPDATED,
                new_value=str(updates),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "PatientRecord updated: id=%s, fields=%s",
                record.id,
                list(updates.keys()),
            )

            return record

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update patient record: id=%s",
                record_id,
            )
            raise

    def update_status(
        self,
        record_id: UUID,
        new_status: RecordStatus,
        actor_id: int,
    ) -> PatientRecord:
        """Transition a patient record to a new status.

        Business rules:
        1. The record must exist and not be soft-deleted.
        2. A finalized record cannot have its status changed.

        Args:
            record_id: UUID of the record.
            new_status: Target ``RecordStatus`` value.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecord``.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(record_id)

            PatientRecordValidator.assert_not_finalized(record)
            PatientRecordValidator.assert_not_deleted(record)

            old_status = record.status
            record = self.record_repo.update_status(record, new_status)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PATIENT_RECORD_STATUS_CHANGED,
                old_value=str(old_status),
                new_value=str(new_status),
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "PatientRecord status changed: id=%s, %s -> %s",
                record.id,
                old_status,
                new_status,
            )

            return record

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to update patient record status: id=%s",
                record_id,
            )
            raise

    # ==================================================================
    # Finalize
    # ==================================================================

    def finalize_record(
        self,
        record_id: UUID,
        actor_id: int,
    ) -> PatientRecord:
        """Finalize a patient record, making it immutable.

        Business rules:
        1. The record must exist and not be soft-deleted.
        2. The record must not already be finalized.

        Once finalized:
        * ``is_finalized`` is set to ``True``.
        * ``status`` is set to ``COMPLETED``.
        * The record becomes immutable (further updates are rejected).

        Args:
            record_id: UUID of the record to finalize.
            actor_id: ID of the authenticated user.

        Returns:
            The finalized ``PatientRecord``.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(record_id)

            PatientRecordValidator.assert_not_deleted(record)

            if record.is_finalized:
                raise PatientRecordBusinessRule(
                    message=f"Patient record {record_id} is already finalized",
                    details={"record_id": str(record_id)},
                )

            record = self.record_repo.finalize_record(record)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PATIENT_RECORD_FINALIZED,
                new_value=f"status=COMPLETED, is_finalized=True",
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "PatientRecord finalized: id=%s",
                record.id,
            )

            return record

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to finalize patient record: id=%s",
                record_id,
            )
            raise

    # ==================================================================
    # Soft delete
    # ==================================================================

    def delete_record(
        self,
        record_id: UUID,
        actor_id: int,
    ) -> None:
        """Soft-delete a patient record.

        Business rules:
        1. The record must exist.
        2. The record must not be finalized (finalized records are
           immutable).
        3. The record must not already be deleted (idempotent-safe).

        The row is not removed — ``is_deleted`` is set to ``True`` so
        that the record is hidden from default queries but preserved
        for audit and regulatory purposes.

        Args:
            record_id: UUID of the record to soft-delete.
            actor_id: ID of the authenticated user.

        Raises:
            PatientRecordNotFound: If the record does not exist.
            PatientRecordBusinessRule: If the record is finalized.
        """
        try:
            record = self.record_repo.get_by_id_or_raise(record_id)

            # Idempotent — if already deleted, no-op regardless of finalized
            # status.  This keeps repeated calls safe for concurrent callers
            # or legacy data where both flags may coexist.
            if record.is_deleted:
                logger.info(
                    "PatientRecord already deleted (idempotent): id=%s",
                    record_id,
                )
                return

            # Finalized records are immutable and cannot be deleted.
            PatientRecordValidator.assert_not_finalized(record)

            self.record_repo.soft_delete(record)

            self._create_audit_log(
                patient_record_id=record.id,
                action=PATIENT_RECORD_DELETED,
                performed_by=actor_id,
            )

            self.db.commit()

            logger.info(
                "PatientRecord soft-deleted: id=%s",
                record_id,
            )

        except (PatientRecordNotFound, PatientRecordBusinessRule):
            self.db.rollback()
            raise

        except Exception:
            self.db.rollback()
            logger.exception(
                "Failed to soft-delete patient record: id=%s",
                record_id,
            )
            raise

    # ==================================================================
    # Count
    # ==================================================================

    def count_records(
        self,
        *,
        status: Optional[RecordStatus] = None,
        is_finalized: Optional[bool] = None,
        patient_id: Optional[UUID] = None,
    ) -> int:
        """Count patient records matching the given optional filters.

        Read-only — no audit log or transaction needed.
        """
        return self.record_repo.count(
            status=status,
            is_finalized=is_finalized,
            patient_id=patient_id,
        )

    # ==================================================================
    # Internal helpers
    # ==================================================================

    def _assert_patient_exists(self, patient_id: UUID) -> None:
        """Raise ``PatientRecordBusinessRule`` if the patient does not exist.

        This is a service-layer concern because it coordinates across
        repositories (patient records ↔ patients).
        """
        patient = self.patient_repo.get_by_id(patient_id)

        if not patient:
            raise PatientRecordBusinessRule(
                message=f"Patient {patient_id} does not exist",
                details={"patient_id": str(patient_id)},
            )

    def _assert_appointment_exists(self, appointment_id: UUID) -> None:
        """Raise ``PatientRecordBusinessRule`` if the appointment does not exist.

        This is a service-layer concern because it coordinates across
        repositories (patient records ↔ appointments).
        """
        appointment = self.appointment_repo.get_by_id(appointment_id)

        if not appointment:
            raise PatientRecordBusinessRule(
                message=f"Appointment {appointment_id} does not exist",
                details={"appointment_id": str(appointment_id)},
            )

    def _create_audit_log(
        self,
        *,
        patient_record_id: UUID,
        action: str,
        performed_by: int,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
    ) -> PatientRecordAuditLog:
        """Create an audit log entry for a business action.

        Every state-changing operation (create, update, status change,
        finalize, delete) must call this method to maintain a complete
        and verifiable audit trail for regulatory compliance.

        Args:
            patient_record_id: UUID of the affected patient record.
            action: Machine-readable action name (e.g. ``"PATIENT_RECORD_UPDATED"``).
            performed_by: User ID who performed the action.
            old_value: Optional serialised previous state.
            new_value: Optional serialised new state.

        Returns:
            The persisted ``PatientRecordAuditLog`` instance.
        """
        audit_log = PatientRecordAuditLog(
            patient_record_id=patient_record_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            performed_by=performed_by,
        )

        return self.audit_repo.create(audit_log)
