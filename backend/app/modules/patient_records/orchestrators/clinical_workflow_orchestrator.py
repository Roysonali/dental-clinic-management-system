"""
Clinical Workflow Orchestrator
==============================

Production-grade orchestrator for end-to-end clinical episodes that
span multiple patient record aggregates.

This orchestrator is designed for **complete clinical processes**:
* Creating a full clinical record with diagnoses, prescriptions,
  attachments, and follow-ups.
* Managing treatment plan lifecycles.
* Completing consultations from start to finalization.

Unlike ``PatientRecordOrchestrator`` which focuses on composable
multi-step operations, this orchestrator provides **convenience
workflows** for common clinical scenarios.

Workflows
---------
1. ``complete_consultation`` — update notes, schedule follow-up,
   transition to COMPLETED.
2. ``create_full_episode`` — create record + diagnoses + prescription
   + attachment + follow-up + finalize, all in one call.
3. ``create_treatment_plan`` — update recommendation + create
   prescription.
4. ``finalize_clinical_work`` — walk through to COMPLETED → FINALIZED.

Architecture
------------
ClinicalWorkflowOrchestrator → PatientRecordOrchestrator → Workflow
                                                          → Services
                                                          → Repositories

The clinical orchestrator delegates to ``PatientRecordOrchestrator``
for multi-step coordination and only adds workflow-level logic that
is specific to clinical episodes.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from uuid import UUID

    from app.modules.patient_records.models import PatientRecord, PatientRecordFollowup
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
    from app.modules.patient_records.services import (
        PatientRecordService,
        DiagnosisService,
        PrescriptionService,
        FollowupService,
        AttachmentService,
    )

logger = logging.getLogger(__name__)


class ClinicalWorkflowOrchestrator:
    """Orchestrates end-to-end clinical workflows.

    All services share the same DB session.  Each service method
    commits independently.  On failure the session is rolled back
    to prevent state corruption.

    Args:
        record_service: Service for patient record CRUD.
        diagnosis_service: Service for diagnosis management.
        prescription_service: Service for prescription management.
        followup_service: Service for follow-up management.
        attachment_service: Service for attachment management.
    """

    def __init__(
        self,
        record_service: "PatientRecordService",
        diagnosis_service: "DiagnosisService | None" = None,
        prescription_service: "PrescriptionService | None" = None,
        followup_service: "FollowupService | None" = None,
        attachment_service: "AttachmentService | None" = None,
    ) -> None:
        self._record_service = record_service
        self._diagnosis_service = diagnosis_service
        self._prescription_service = prescription_service
        self._followup_service = followup_service
        self._attachment_service = attachment_service

    # ==================================================================
    # WORKFLOW 1 — Complete consultation
    # ==================================================================

    def complete_consultation(
        self,
        record_id: "UUID",
        *,
        clinical_notes: str | None = None,
        followup_payload: "FollowupCreate | None" = None,
        actor_id: int,
        actor_roles: list[str],
    ) -> "PatientRecord":
        """Complete a full consultation for a patient.

        Steps:
        1. Update clinical notes if provided.
        2. Schedule a follow-up if requested.
        3. Walk through transitions to COMPLETED.

        Args:
            record_id: UUID of the patient record.
            clinical_notes: Optional clinical notes update.
            followup_payload: Optional ``FollowupCreate`` to schedule
                a follow-up appointment.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings.

        Returns:
            The ``PatientRecord`` in COMPLETED status.
        """
        logger.info(
            "Clinical workflow complete_consultation: record=%s, actor=%s",
            record_id,
            actor_id,
        )

        record = self._record_service.get_record_or_raise(record_id)

        try:
            # ── Step 1: Update clinical notes if provided ────────
            if clinical_notes:
                from app.modules.patient_records.schemas.patient_record_schema import (
                    PatientRecordUpdate,
                )

                update_payload = PatientRecordUpdate(clinical_notes=clinical_notes)
                record = self._record_service.update_record(
                    record_id=record.id,
                    payload=update_payload,
                    actor_id=actor_id,
                )

            # ── Step 2: Schedule follow-up if requested ──────────
            if followup_payload and self._followup_service:
                self._followup_service.create_followup(
                    patient_record_id=record.id,
                    payload=followup_payload,
                    actor_id=actor_id,
                )

            # ── Step 3: Walk through transitions to COMPLETED ────
            from app.modules.patient_records.enums import RecordStatus

            if record.status in {RecordStatus.DRAFT, RecordStatus.IN_PROGRESS}:
                from app.modules.patient_records.workflow import (
                    PatientRecordWorkflow,
                )

                workflow = PatientRecordWorkflow(self._record_service)

                if record.status == RecordStatus.DRAFT:
                    record = workflow.start_record(
                        record, actor_id=actor_id, actor_roles=actor_roles,
                    )
                record = workflow.submit_for_review(
                    record, actor_id=actor_id, actor_roles=actor_roles,
                )
                record = workflow.approve_review(
                    record, actor_id=actor_id, actor_roles=actor_roles,
                )
            elif record.status == RecordStatus.UNDER_REVIEW:
                from app.modules.patient_records.workflow import (
                    PatientRecordWorkflow,
                )

                workflow = PatientRecordWorkflow(self._record_service)
                record = workflow.approve_review(
                    record, actor_id=actor_id, actor_roles=actor_roles,
                )

            logger.info(
                "Clinical workflow complete_consultation done: record=%s, status=COMPLETED",
                record.id,
            )

            return record

        except Exception:
            self._record_service.db.rollback()
            logger.exception(
                "Clinical workflow complete_consultation failed: record=%s",
                record_id,
            )
            raise

    # ==================================================================
    # WORKFLOW 2 — Create full clinical episode
    # ==================================================================

    def create_full_episode(
        self,
        record_payload: "PatientRecordCreate",
        *,
        diagnoses: list["DiagnosisCreate"] | None = None,
        prescription_payload: "PrescriptionCreate | None" = None,
        attachment_payload: "AttachmentUpload | None" = None,
        followup_payload: "FollowupCreate | None" = None,
        actor_id: int,
    ) -> dict:
        """Create a complete clinical episode in one call.

        Steps (coordinated within a shared DB session):
        1. Create the patient record (DRAFT).
        2. Add diagnoses if provided.
        3. Add prescription if provided.
        4. Upload attachment if provided.
        5. Schedule follow-up if provided.
        6. On failure, roll back the session.

        Args:
            record_payload: ``PatientRecordCreate`` with patient and
                appointment IDs.
            diagnoses: Optional list of ``DiagnosisCreate`` schemas.
            prescription_payload: Optional ``PrescriptionCreate``.
            attachment_payload: Optional ``AttachmentCreate``.
            followup_payload: Optional ``FollowupCreate``.
            actor_id: ID of the authenticated user.

        Returns:
            Dictionary with ``record``, ``diagnoses``, ``prescription``,
            ``attachment``, and ``followup`` keys::

                {
                    "record": PatientRecord,
                    "diagnoses": list[PatientRecordDiagnosis] | None,
                    "prescription": PatientRecordPrescription | None,
                    "followup": PatientRecordFollowup | None,
                }
        """
        logger.info(
            "Clinical workflow create_full_episode: patient=%s, appointment=%s, actor=%s",
            record_payload.patient_id,
            record_payload.appointment_id,
            actor_id,
        )

        result: dict = {
            "record": None,
            "diagnoses": None,
            "prescription": None,
            "followup": None,
        }

        try:
            # ── Step 1: Create record ─────────────────────────────
            record = self._record_service.create_patient_record(
                payload=record_payload,
                actor_id=actor_id,
            )
            result["record"] = record

            # ── Step 2: Add diagnoses ─────────────────────────────
            if diagnoses and self._diagnosis_service:
                created = []
                for diag_payload in diagnoses:
                    diag = self._diagnosis_service.create_diagnosis(
                        patient_record_id=record.id,
                        payload=diag_payload,
                        actor_id=actor_id,
                    )
                    created.append(diag)
                result["diagnoses"] = created

            # ── Step 3: Add prescription ──────────────────────────
            if prescription_payload and self._prescription_service:
                rx = self._prescription_service.create_prescription(
                    patient_record_id=record.id,
                    prescribed_by=actor_id,
                    payload=prescription_payload,
                    actor_id=actor_id,
                )
                result["prescription"] = rx

            # ── Step 4: Upload attachment ─────────────────────────
            if attachment_payload and self._attachment_service:
                self._attachment_service.upload_attachment(
                    patient_record_id=record.id,
                    payload=attachment_payload,
                    actor_id=actor_id,
                )

            # ── Step 5: Schedule follow-up ────────────────────────
            if followup_payload and self._followup_service:
                fup = self._followup_service.create_followup(
                    patient_record_id=record.id,
                    payload=followup_payload,
                    actor_id=actor_id,
                )
                result["followup"] = fup

            logger.info(
                "Clinical workflow create_full_episode done: record=%s",
                record.id,
            )

            return result

        except Exception:
            self._record_service.db.rollback()
            logger.exception(
                "Clinical workflow create_full_episode failed: "
                "patient=%s, appointment=%s",
                record_payload.patient_id,
                record_payload.appointment_id,
            )
            raise

    # ==================================================================
    # WORKFLOW 3 — Create treatment plan
    # ==================================================================

    def create_treatment_plan(
        self,
        record_id: "UUID",
        *,
        treatment_recommendation: str,
        prescription_payload: "PrescriptionCreate | None" = None,
        actor_id: int,
    ) -> dict:
        """Create a treatment plan for a patient record.

        Steps:
        1. Update the record's ``treatment_recommendation`` field.
        2. Create a prescription with items if provided.

        Args:
            record_id: UUID of the patient record.
            treatment_recommendation: Clinical treatment plan text.
            prescription_payload: Optional ``PrescriptionCreate`` with
                medicine items.
            actor_id: ID of the authenticated user.

        Returns:
            Dictionary with ``record`` and ``prescription`` keys::

                {"record": PatientRecord, "prescription": ... | None}
        """
        logger.info(
            "Clinical workflow create_treatment_plan: record=%s, actor=%s",
            record_id,
            actor_id,
        )

        result: dict = {"record": None, "prescription": None}

        try:
            record = self._record_service.get_record_or_raise(record_id)

            # ── Step 1: Update treatment recommendation ──────────
            from app.modules.patient_records.schemas.patient_record_schema import (
                PatientRecordUpdate,
            )

            update_payload = PatientRecordUpdate(
                treatment_recommendation=treatment_recommendation,
            )
            record = self._record_service.update_record(
                record_id=record.id,
                payload=update_payload,
                actor_id=actor_id,
            )
            result["record"] = record

            # ── Step 2: Create prescription if provided ──────────
            if prescription_payload and self._prescription_service:
                rx = self._prescription_service.create_prescription(
                    patient_record_id=record.id,
                    prescribed_by=actor_id,
                    payload=prescription_payload,
                    actor_id=actor_id,
                )
                result["prescription"] = rx

            logger.info(
                "Clinical workflow create_treatment_plan done: record=%s",
                record.id,
            )

            return result

        except Exception:
            self._record_service.db.rollback()
            logger.exception(
                "Clinical workflow create_treatment_plan failed: record=%s",
                record_id,
            )
            raise

    # ==================================================================
    # WORKFLOW 4 — Finalize clinical work
    # ==================================================================

    def finalize_clinical_work(
        self,
        record_id: "UUID",
        *,
        clinical_notes: str | None = None,
        actor_id: int,
        actor_roles: list[str],
    ) -> "PatientRecord":
        """Finalize a patient record after clinical work is complete.

        This workflow walks the record through the full transition
        chain from its current state to FINALIZED.

        Steps:
        1. Update clinical notes if provided.
        2. Walk through transitions to COMPLETED (if not already).
        3. Finalize the record (COMPLETED → FINALIZED).

        Args:
            record_id: UUID of the patient record.
            clinical_notes: Optional clinical notes update.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings.

        Returns:
            The finalized ``PatientRecord``.
        """
        logger.info(
            "Clinical workflow finalize_clinical_work: record=%s, actor=%s",
            record_id,
            actor_id,
        )

        from app.modules.patient_records.schemas.patient_record_schema import (
            PatientRecordUpdate,
        )
        from app.modules.patient_records.enums import RecordStatus
        from app.modules.patient_records.workflow import PatientRecordWorkflow

        record = self._record_service.get_record_or_raise(record_id)

        try:
            # ── Step 1: Update clinical notes if provided ────────
            if clinical_notes:
                update_payload = PatientRecordUpdate(clinical_notes=clinical_notes)
                record = self._record_service.update_record(
                    record_id=record.id,
                    payload=update_payload,
                    actor_id=actor_id,
                )

            # ── Step 2: Walk through to COMPLETED ────────────────
            workflow = PatientRecordWorkflow(self._record_service)

            if record.status in {RecordStatus.DRAFT, RecordStatus.IN_PROGRESS}:
                if record.status == RecordStatus.DRAFT:
                    record = workflow.start_record(
                        record, actor_id=actor_id, actor_roles=actor_roles,
                    )
                record = workflow.submit_for_review(
                    record, actor_id=actor_id, actor_roles=actor_roles,
                )
                record = workflow.approve_review(
                    record, actor_id=actor_id, actor_roles=actor_roles,
                )
            elif record.status == RecordStatus.UNDER_REVIEW:
                record = workflow.approve_review(
                    record, actor_id=actor_id, actor_roles=actor_roles,
                )

            # ── Step 3: Finalize ─────────────────────────────────
            record = workflow.finalize_record(
                record_id=record.id,
                actor_id=actor_id,
                actor_roles=actor_roles,
            )

            logger.info(
                "Clinical workflow finalize_clinical_work done: record=%s, status=FINALIZED",
                record.id,
            )

            return record

        except Exception:
            self._record_service.db.rollback()
            logger.exception(
                "Clinical workflow finalize_clinical_work failed: record=%s",
                record_id,
            )
            raise
