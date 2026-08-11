"""
Patient Record Orchestrator
===========================

Production-grade transactional orchestrator for multi-step patient
record operations that span multiple services.

Atomicity model
---------------
All services share the same database session (injected via FastAPI
dependency injection).  Each service method commits independently
(``db.commit()``).  The orchestrator coordinates the **call order**
and, on failure, rolls back the session to a clean state so that
subsequent operations run against a consistent snapshot.

Responsibilities
----------------
1. **Coordinated transactions** — create, update, and delete across
   services in the correct order within a shared session.
2. **Rollback on failure** — any exception triggers a session
   rollback to prevent partial writes from corrupting subsequent
   operations.
3. **Audit propagation** — every service call already writes its own
   audit log via ``AuditLogRepository``.
4. **Ownership validation** — record immutability is verified before
   child-entity mutations.
5. **Service coordination** — orchestrates the right call order for
   composite workflows.

Architecture
------------
Orchestrator → Workflow → Service → Repository

The orchestrator is the **top-level entry-point** for:
* Routers that need multi-step operations.
* Background jobs that process clinical episodes.
* Integration points with external systems.

Usage
-----
    orchestrator = PatientRecordOrchestrator(
        record_service=PatientRecordService(db),
        diagnosis_service=DiagnosisService(db),
        prescription_service=PrescriptionService(db),
        followup_service=FollowupService(db),
        attachment_service=AttachmentService(db),
        workflow=PatientRecordWorkflow(record_service),
    )

    result = orchestrator.create_full_record(
        record_payload=PatientRecordCreate(...),
        diagnoses=[DiagnosisCreate(...)],
        prescription=PrescriptionCreate(items=[...]),
        actor_id=42,
        actor_roles=["ADMIN"],
    )
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.modules.patient_records.workflow import (
    PatientRecordWorkflow,
)
from app.modules.patient_records.workflow.workflow_rules import WorkflowRules
if TYPE_CHECKING:
    from uuid import UUID

    from app.modules.patient_records.models import PatientRecord
    from app.modules.patient_records.enums import RecordStatus
    from app.modules.patient_records.services import (
        PatientRecordService,
        DiagnosisService,
        PrescriptionService,
        FollowupService,
        AttachmentService,
    )
    from app.modules.patient_records.schemas.patient_record_schema import (
        PatientRecordCreate,
        PatientRecordUpdate,
    )
    from app.modules.patient_records.schemas.diagnosis_schema import (
        DiagnosisCreate,
    )
    from app.modules.patient_records.schemas.prescription_schema import (
        PrescriptionCreate,
    )
    from app.modules.patient_records.schemas.followup_schema import (
        FollowupCreate,
    )
    from app.modules.patient_records.schemas.attachment_schema import (
        AttachmentUpload,
    )

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


class PatientRecordOrchestrator:
    """Orchestrates multi-step, multi-service patient record operations.

    All services share the same DB session.  Each service method
    commits independently.  On failure the orchestrator rolls back
    the session to prevent state corruption in subsequent operations.

    Args:
        record_service: Service for patient record CRUD.
        diagnosis_service: Optional — service for diagnosis management.
        prescription_service: Optional — service for prescription management.
        followup_service: Optional — service for follow-up management.
        attachment_service: Optional — service for attachment management.
        workflow: Optional — auto-created from ``record_service`` if not
            provided.
    """

    def __init__(
        self,
        record_service: "PatientRecordService",
        diagnosis_service: "DiagnosisService | None" = None,
        prescription_service: "PrescriptionService | None" = None,
        followup_service: "FollowupService | None" = None,
        attachment_service: "AttachmentService | None" = None,
        workflow: "PatientRecordWorkflow | None" = None,
    ) -> None:
        self._record_service = record_service
        self._diagnosis_service = diagnosis_service
        self._prescription_service = prescription_service
        self._followup_service = followup_service
        self._attachment_service = attachment_service
        self._workflow = workflow or PatientRecordWorkflow(record_service)

    # ==================================================================
    # ATOMIC COMPOSITE OPERATIONS
    # ==================================================================

    def create_full_record(
        self,
        record_payload: "PatientRecordCreate",
        *,
        diagnoses: list["DiagnosisCreate"] | None = None,
        prescription_payload: "PrescriptionCreate | None" = None,
        actor_id: int,
    ) -> "PatientRecord":
        """Create a patient record with diagnoses and prescription.

        Steps (coordinated within a shared DB session):
        1. Create the patient record (DRAFT).
        2. If diagnoses provided, create them under the record.
        3. If prescription provided, create it under the record.
        4. On failure, roll back the session.

        Args:
            record_payload: ``PatientRecordCreate`` with patient and
                appointment IDs.
            diagnoses: Optional list of ``DiagnosisCreate`` schemas.
            prescription_payload: Optional ``PrescriptionCreate`` with
                medicine items.
            actor_id: ID of the authenticated user.

        Returns:
            The newly created ``PatientRecord`` with all child entities
            loaded.

        Raises:
            PatientRecordBusinessRule: On any validation failure.
            PatientRecordConflict: If the appointment already has a record.
        """
        logger.info(
            "Orchestrator create_full_record: patient=%s, appointment=%s, actor=%s",
            record_payload.patient_id,
            record_payload.appointment_id,
            actor_id,
        )

        try:
            # ── Step 1: Create record ─────────────────────────────
            record = self._record_service.create_patient_record(
                payload=record_payload,
                actor_id=actor_id,
            )

            # ── Step 2: Create diagnoses if provided ──────────────
            if diagnoses and self._diagnosis_service:
                for diag_payload in diagnoses:
                    self._diagnosis_service.create_diagnosis(
                        patient_record_id=record.id,
                        payload=diag_payload,
                        actor_id=actor_id,
                    )

            # ── Step 3: Create prescription if provided ───────────
            if prescription_payload and self._prescription_service:
                self._prescription_service.create_prescription(
                    patient_record_id=record.id,
                    prescribed_by=actor_id,
                    payload=prescription_payload,
                    actor_id=actor_id,
                )

            logger.info(
                "Orchestrator create_full_record complete: record=%s",
                record.id,
            )

            return record

        except Exception as exc:
            self._record_service.db.rollback()
            logger.exception(
                "Orchestrator create_full_record failed: reason=%s",
                str(exc),
            )
            raise

    def add_clinical_data(
        self,
        record_id: "UUID",
        *,
        diagnoses: list["DiagnosisCreate"] | None = None,
        prescription_payload: "PrescriptionCreate | None" = None,
        followup_payload: "FollowupCreate | None" = None,
        attachment_payload: "AttachmentUpload | None" = None,
        actor_id: int,
    ) -> "PatientRecord":
        """Add clinical data (diagnoses, prescription, followup, attachment)
        to an existing patient record.

        All operations share the same DB session.  On failure the
        session is rolled back.

        Args:
            record_id: UUID of the target patient record.
            diagnoses: Optional list of diagnoses to add.
            prescription_payload: Optional prescription to add.
            followup_payload: Optional follow-up to schedule.
            attachment_payload: Optional attachment to register.
            actor_id: ID of the authenticated user.

        Returns:
            The updated ``PatientRecord``.
        """
        logger.info(
            "Orchestrator add_clinical_data: record=%s, actor=%s",
            record_id,
            actor_id,
        )

        record = self._record_service.get_record_or_raise(record_id)

        try:
            # ── Validate record is modifiable ─────────────────────
            WorkflowRules.assert_record_modifiable(record)

            # ── Add diagnoses ─────────────────────────────────────
            if diagnoses and self._diagnosis_service:
                for diag_payload in diagnoses:
                    self._diagnosis_service.create_diagnosis(
                        patient_record_id=record.id,
                        payload=diag_payload,
                        actor_id=actor_id,
                    )

            # ── Add prescription ──────────────────────────────────
            if prescription_payload and self._prescription_service:
                self._prescription_service.create_prescription(
                    patient_record_id=record.id,
                    prescribed_by=actor_id,
                    payload=prescription_payload,
                    actor_id=actor_id,
                )

            # ── Schedule follow-up ────────────────────────────────
            if followup_payload and self._followup_service:
                self._followup_service.create_followup(
                    patient_record_id=record.id,
                    payload=followup_payload,
                    actor_id=actor_id,
                )

            # ── Register attachment ───────────────────────────────
            if attachment_payload and self._attachment_service:
                self._attachment_service.upload_attachment(
                    patient_record_id=record.id,
                    payload=attachment_payload,
                    actor_id=actor_id,
                )

            logger.info(
                "Orchestrator add_clinical_data complete: record=%s",
                record.id,
            )

            return record

        except Exception:
            self._record_service.db.rollback()
            logger.exception(
                "Orchestrator add_clinical_data failed: record=%s",
                record_id,
            )
            raise

    # ==================================================================
    # WORKFLOW TRANSITIONS
    # ==================================================================

    def transition_status(
        self,
        record_id: "UUID",
        target_status: "RecordStatus",
        *,
        actor_id: int,
        actor_roles: list[str],
    ) -> "PatientRecord":
        """Transition a record to a new status with full validation.

        Loads the record, validates the transition, applies it, and
        returns the updated record.

        Args:
            record_id: UUID of the patient record.
            target_status: Desired target ``RecordStatus``.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The updated ``PatientRecord``.
        """
        record = self._record_service.get_record_or_raise(record_id)

        return self._workflow.transition(
            record,
            target_status,
            actor_id=actor_id,
            actor_roles=actor_roles,
        )

    # ==================================================================
    # COMPOSITE CLINICAL WORKFLOWS
    # ==================================================================

    def complete_and_finalize(
        self,
        record_id: "UUID",
        *,
        clinical_notes: str | None = None,
        doctor_remarks: str | None = None,
        treatment_recommendation: str | None = None,
        actor_id: int,
        actor_roles: list[str],
    ) -> "PatientRecord":
        """Complete clinical work and finalize the record in one call.

        This convenience workflow updates clinical notes if provided,
        then walks through the transition chain to FINALIZED.

        Each transition is a separate service commit (since the service
        layer owns transaction management).  If any transition fails,
        the service layer rolls back that step.

        Args:
            record_id: UUID of the patient record.
            clinical_notes: Optional clinical notes update.
            doctor_remarks: Optional doctor remarks update.
            treatment_recommendation: Optional treatment recommendation.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The finalized ``PatientRecord``.
        """
        from app.modules.patient_records.schemas.patient_record_schema import (
            PatientRecordUpdate,
        )
        from app.modules.patient_records.enums import RecordStatus

        record = self._record_service.get_record_or_raise(record_id)

        # ── Step 1: Update clinical notes if provided ────────────
        if clinical_notes or doctor_remarks or treatment_recommendation:
            update_payload = PatientRecordUpdate(
                clinical_notes=clinical_notes,
                doctor_remarks=doctor_remarks,
                treatment_recommendation=treatment_recommendation,
            )
            record = self._record_service.update_record(
                record_id=record.id,
                payload=update_payload,
                actor_id=actor_id,
            )

        # ── Step 2: Walk through transitions ─────────────────────
        workflow = self._workflow

        if record.status in {RecordStatus.DRAFT, RecordStatus.IN_PROGRESS}:
            # Transitions: DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED
            if record.status == RecordStatus.DRAFT:
                record = workflow.start_record(record, actor_id=actor_id, actor_roles=actor_roles)
            record = workflow.submit_for_review(record, actor_id=actor_id, actor_roles=actor_roles)
            record = workflow.approve_review(record, actor_id=actor_id, actor_roles=actor_roles)
        elif record.status == RecordStatus.UNDER_REVIEW:
            record = workflow.approve_review(record, actor_id=actor_id, actor_roles=actor_roles)

        record = workflow.finalize_record(
            record.id,
            actor_id=actor_id,
            actor_roles=actor_roles,
        )

        logger.info(
            "Orchestrator complete_and_finalize: record=%s, actor=%s",
            record.id,
            actor_id,
        )

        return record

    def reopen_and_update(
        self,
        record_id: "UUID",
        *,
        clinical_notes: str | None = None,
        doctor_remarks: str | None = None,
        actor_id: int,
        actor_roles: list[str],
    ) -> "PatientRecord":
        """Reopen a completed record and apply clinical updates.

        Two-step operation:
        1. Transition COMPLETED → IN_PROGRESS (reopen, admin only).
        2. Apply the clinical updates.

        Args:
            record_id: UUID of the patient record.
            clinical_notes: Optional clinical notes update.
            doctor_remarks: Optional doctor remarks update.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The updated ``PatientRecord`` in IN_PROGRESS.
        """
        from app.modules.patient_records.schemas.patient_record_schema import (
            PatientRecordUpdate,
        )

        record = self._record_service.get_record_or_raise(record_id)

        # ── Step 1: Reopen ───────────────────────────────────────
        record = self._workflow.reopen_record(
            record,
            actor_id=actor_id,
            actor_roles=actor_roles,
        )

        # ── Step 2: Apply updates ────────────────────────────────
        update_payload = PatientRecordUpdate(
            clinical_notes=clinical_notes,
            doctor_remarks=doctor_remarks,
        )
        record = self._record_service.update_record(
            record_id=record.id,
            payload=update_payload,
            actor_id=actor_id,
        )

        logger.info(
            "Orchestrator reopen_and_update: record=%s, actor=%s",
            record.id,
            actor_id,
        )

        return record
