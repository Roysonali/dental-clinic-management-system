"""
Patient Record Workflow
=======================

Production-grade workflow coordinator for patient record lifecycle
management.

Responsibilities
----------------
1. **Create workflow** — validate prerequisites, persist, and audit.
2. **Update workflow** — guard immutability, persist clinical updates.
3. **Complete workflow** — walk through transition chain to COMPLETED.
4. **Finalize workflow** — terminal state transition with confirmation.
5. **Rollback workflow** — explicit session rollback on failure.
6. **Audit workflow** — every operation writes to the audit trail.
7. **Validate transitions** — full pipeline via TransitionValidator.

Architecture
------------
This module sits **between** the service layer and the orchestrator:

* It receives a ``PatientRecordService`` instance (bound to a DB session).
* It uses ``TransitionValidator`` for all state-change validation.
* It delegates persistence, audit logging, and transaction management
  to the service layer.
* It provides high-level convenience methods that the orchestrator
  and routers call directly.

Usage
-----
    workflow = PatientRecordWorkflow(service)
    record = workflow.create_record(payload, actor_id=42, actor_roles=["ADMIN"])
    record = workflow.complete_record(record.id, treatment="...", actor_id=42, actor_roles=["ADMIN"])
"""

from __future__ import annotations

import logging
from typing import Sequence, TYPE_CHECKING
from uuid import UUID

from app.modules.patient_records.workflow.transition_validator import (
    TransitionValidator,
)
from app.modules.patient_records.workflow.state_machine import (
    PatientRecordStateMachine,
    TransitionDefinition,
)
from app.modules.patient_records.exceptions import (
    PatientRecordBusinessRule,
)

if TYPE_CHECKING:
    from app.modules.patient_records.models import PatientRecord
    from app.modules.patient_records.enums import RecordStatus
    from app.modules.patient_records.services import PatientRecordService
    from app.modules.patient_records.schemas.patient_record_schema import (
        PatientRecordCreate,
        PatientRecordUpdate,
    )

from app.modules.patient_records.constants import (
    WORKFLOW_RECORD_CREATED,
    WORKFLOW_RECORD_UPDATED,
    WORKFLOW_STATUS_TRANSITIONED,
    WORKFLOW_RECORD_COMPLETED,
    WORKFLOW_RECORD_FINALIZED,
    WORKFLOW_RECORD_ROLLED_BACK,
)

logger = logging.getLogger(__name__)


class PatientRecordWorkflow:
    """Coordinates patient record lifecycle workflows.

    Every public method is a complete workflow step that:
    1. Validates pre-conditions (existence, ownership, state).
    2. Executes the operation via the service layer.
    3. Audits the outcome.
    4. Logs the result.

    Args:
        service: ``PatientRecordService`` instance bound to an active
            database session.
        validator: Optional ``TransitionValidator``. Created fresh if
            not provided.
    """

    def __init__(
        self,
        service: "PatientRecordService",
        validator: TransitionValidator | None = None,
    ) -> None:
        self._service = service
        self._validator = validator or TransitionValidator()
        self._machine = PatientRecordStateMachine()

    # ==================================================================
    # 1. CREATE WORKFLOW
    # ==================================================================

    def create_record(
        self,
        payload: "PatientRecordCreate",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Create a new patient record and start the workflow.

        Validates:
        * Patient and appointment exist (via service layer).
        * Appointment does not already have a record.

        The record is created in DRAFT status.

        Args:
            payload: Validated ``PatientRecordCreate`` schema.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The newly created ``PatientRecord``.
        """
        logger.info(
            "Workflow create: patient=%s, appointment=%s, actor=%s",
            payload.patient_id,
            payload.appointment_id,
            actor_id,
        )

        record = self._service.create_patient_record(
            payload=payload,
            actor_id=actor_id,
        )

        logger.info(
            "Workflow create complete: record=%s, status=%s",
            record.id,
            record.status.value,
        )

        return record

    # ==================================================================
    # 2. UPDATE WORKFLOW
    # ==================================================================

    def update_record(
        self,
        record_id: UUID,
        payload: "PatientRecordUpdate",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Update clinical fields on a patient record.

        Validates (via service layer):
        * Record exists.
        * Record is not finalized.
        * Record is not soft-deleted.

        Only fields explicitly provided in ``payload`` are updated.

        Args:
            record_id: UUID of the record to update.
            payload: Validated ``PatientRecordUpdate`` schema.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The updated ``PatientRecord``.
        """
        # Pre-load to verify existence before delegating.
        record = self._service.get_record_or_raise(record_id)

        logger.info(
            "Workflow update: record=%s, actor=%s",
            record_id,
            actor_id,
        )

        updated = self._service.update_record(
            record_id=record_id,
            payload=payload,
            actor_id=actor_id,
        )

        logger.info(
            "Workflow update complete: record=%s",
            record_id,
        )

        return updated

    # ==================================================================
    # 3. COMPLETE WORKFLOW
    # ==================================================================

    def complete_record(
        self,
        record_id: UUID,
        *,
        clinical_notes: str | None = None,
        doctor_remarks: str | None = None,
        treatment_recommendation: str | None = None,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Walk the record through to COMPLETED status.

        This is a convenience workflow that:
        1. Updates clinical notes if provided.
        2. Transitions through the approval chain to COMPLETED.

        The exact transition path depends on the current state:
        * DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED
        * IN_PROGRESS → UNDER_REVIEW → COMPLETED
        * UNDER_REVIEW → COMPLETED
        * COMPLETED → no-op (already complete)

        Args:
            record_id: UUID of the record to complete.
            clinical_notes: Optional clinical notes update.
            doctor_remarks: Optional doctor remarks update.
            treatment_recommendation: Optional treatment recommendation update.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The ``PatientRecord`` in COMPLETED status.
        """
        from app.modules.patient_records.schemas.patient_record_schema import (
            PatientRecordUpdate,
        )
        from app.modules.patient_records.enums import RecordStatus

        record = self._service.get_record_or_raise(record_id)

        # ── Step 1: Update clinical notes if provided ────────────
        if clinical_notes is not None or doctor_remarks is not None or treatment_recommendation is not None:
            update_payload = PatientRecordUpdate(
                clinical_notes=clinical_notes,
                doctor_remarks=doctor_remarks,
                treatment_recommendation=treatment_recommendation,
            )
            record = self._service.update_record(
                record_id=record.id,
                payload=update_payload,
                actor_id=actor_id,
            )

        # ── Step 2: Walk through transitions ─────────────────────
        current = record.status

        if current == RecordStatus.DRAFT:
            record = self._transition(record, RecordStatus.IN_PROGRESS, actor_id, actor_roles)
            record = self._transition(record, RecordStatus.UNDER_REVIEW, actor_id, actor_roles)
            record = self._transition(record, RecordStatus.COMPLETED, actor_id, actor_roles)

        elif current == RecordStatus.IN_PROGRESS:
            record = self._transition(record, RecordStatus.UNDER_REVIEW, actor_id, actor_roles)
            record = self._transition(record, RecordStatus.COMPLETED, actor_id, actor_roles)

        elif current == RecordStatus.UNDER_REVIEW:
            record = self._transition(record, RecordStatus.COMPLETED, actor_id, actor_roles)

        elif current == RecordStatus.COMPLETED:
            logger.info("Workflow complete: record=%s already in COMPLETED", record_id)

        else:
            raise PatientRecordBusinessRule(
                message=(
                    f"Cannot complete record {record_id}: "
                    f"current status {current.value!r} cannot reach COMPLETED"
                ),
                details={"record_id": str(record_id), "current_status": current.value},
            )

        logger.info(
            "Workflow complete: record=%s, status=COMPLETED, actor=%s",
            record_id,
            actor_id,
        )

        return record

    # ==================================================================
    # 4. FINALIZE WORKFLOW
    # ==================================================================

    def finalize_record(
        self,
        record_id: UUID,
        *,
        actor_id: int,
        actor_roles: Sequence[str],
        confirmed: bool = True,
    ) -> "PatientRecord":
        """Finalize a patient record (terminal state).

        Validates:
        * Record exists and is not deleted.
        * Record status is COMPLETED.
        * Record is not already finalized.
        * ``confirmed`` must be ``True`` (confirmation guard).

        Once finalized, the record is **immutable** — no further
        updates, transitions, or deletions are allowed.

        Args:
            record_id: UUID of the record to finalize.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.
            confirmed: Must be ``True`` to proceed.  Acts as a
                confirmation gate.

        Returns:
            The finalized ``PatientRecord`` with ``is_finalized=True``
            and ``status=FINALIZED``.

        Raises:
            PatientRecordBusinessRule: If ``confirmed`` is not ``True``.
        """
        if not confirmed:
            raise PatientRecordBusinessRule(
                message="Finalization requires explicit confirmation (confirmed=True)",
                details={"record_id": str(record_id)},
            )

        from app.modules.patient_records.enums import RecordStatus

        record = self._service.get_record_or_raise(record_id)

        # Validate the transition first (will raise if not allowed).
        self._validator.validate(record, RecordStatus.FINALIZED, actor_roles)

        # Persist via service layer (also handles audit).
        finalized = self._service.update_status(
            record_id=record.id,
            new_status=RecordStatus.FINALIZED,
            actor_id=actor_id,
        )

        logger.info(
            "Workflow finalize: record=%s, actor=%s",
            record_id,
            actor_id,
        )

        return finalized

    # ==================================================================
    # 5. ROLLBACK WORKFLOW
    # ==================================================================

    def rollback(
        self,
        record: "PatientRecord",
        *,
        reason: str = "Workflow rollback requested",
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Roll back a record to DRAFT status (workflow-level undo).

        This is **not** a database rollback — it transitions the record
        back to DRAFT so that clinical data can be re-entered.

        Validates:
        * Record exists and is not deleted.
        * Record is not finalized.
        * The transition to DRAFT is allowed from the current state.

        Args:
            record: The ``PatientRecord`` to roll back.
            reason: Human-readable reason for the rollback.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The ``PatientRecord`` in DRAFT status.
        """
        from app.modules.patient_records.enums import RecordStatus

        logger.warning(
            "Workflow rollback: record=%s, reason=%s, actor=%s",
            record.id,
            reason,
            actor_id,
        )

        # The transition validator will check state machine rules.
        # Only records in IN_PROGRESS can go back to DRAFT.
        rolled_back = self._transition(
            record,
            RecordStatus.DRAFT,
            actor_id,
            actor_roles,
        )

        logger.info(
            "Workflow rollback complete: record=%s, status=DRAFT",
            record.id,
        )

        return rolled_back

    # ==================================================================
    # 6. VALIDATE TRANSITION
    # ==================================================================

    def validate_transition(
        self,
        record: "PatientRecord",
        target_status: "RecordStatus",
        actor_roles: Sequence[str],
    ) -> TransitionDefinition:
        """Run the full validation pipeline **without** persisting.

        This is a safe, read-only check that callers can use to
        pre-validate a transition before committing to it.  It runs
        the same 7-step pipeline as ``transition()`` but does not
        modify the database.

        Args:
            record: The current ``PatientRecord`` instance.
            target_status: Desired target ``RecordStatus``.
            actor_roles: RBAC role strings for the user.

        Returns:
            The ``TransitionDefinition`` if validation passes.

        Raises:
            PatientRecordBusinessRule: On any violation.
        """
        return self._validator.validate(record, target_status, actor_roles)

    # ==================================================================
    # Convenience wrappers (single-step transitions)
    # ==================================================================

    def transition(
        self,
        record: "PatientRecord",
        target_status: "RecordStatus",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Apply a single state transition to a patient record.

        This is the primary **state-changing** entry-point for all
        status transitions.  It validates, persists, and audits.

        Args:
            record: The current ``PatientRecord`` instance.
            target_status: Desired target ``RecordStatus``.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The updated ``PatientRecord``.
        """
        return self._transition(record, target_status, actor_id, actor_roles)

    def start_record(
        self,
        record: "PatientRecord",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Transition DRAFT → IN_PROGRESS."""
        from app.modules.patient_records.enums import RecordStatus

        return self._transition(record, RecordStatus.IN_PROGRESS, actor_id, actor_roles)

    def submit_for_review(
        self,
        record: "PatientRecord",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Transition IN_PROGRESS → UNDER_REVIEW."""
        from app.modules.patient_records.enums import RecordStatus

        return self._transition(record, RecordStatus.UNDER_REVIEW, actor_id, actor_roles)

    def approve_review(
        self,
        record: "PatientRecord",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Transition UNDER_REVIEW → COMPLETED."""
        from app.modules.patient_records.enums import RecordStatus

        return self._transition(record, RecordStatus.COMPLETED, actor_id, actor_roles)

    def revert_to_draft(
        self,
        record: "PatientRecord",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Transition IN_PROGRESS → DRAFT."""
        from app.modules.patient_records.enums import RecordStatus

        return self._transition(record, RecordStatus.DRAFT, actor_id, actor_roles)

    def request_revision(
        self,
        record: "PatientRecord",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Transition UNDER_REVIEW → IN_PROGRESS (send back for revision)."""
        from app.modules.patient_records.enums import RecordStatus

        return self._transition(record, RecordStatus.IN_PROGRESS, actor_id, actor_roles)

    def reopen_record(
        self,
        record: "PatientRecord",
        *,
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Transition COMPLETED → IN_PROGRESS (admin-only reopen)."""
        from app.modules.patient_records.enums import RecordStatus

        return self._transition(record, RecordStatus.IN_PROGRESS, actor_id, actor_roles)

    # ==================================================================
    # Query helpers
    # ==================================================================

    def get_available_transitions(
        self,
        record: "PatientRecord",
    ) -> set["RecordStatus"]:
        """Return all valid target states for the record's current status."""
        return self._validator.get_available_transitions(record.status)

    def get_transition_metadata(
        self,
        source: "RecordStatus",
        target: "RecordStatus",
    ) -> TransitionDefinition | None:
        """Return transition metadata without running validation."""
        return self._machine.get_transition(source, target)

    # ==================================================================
    # Internal implementation
    # ==================================================================

    def _transition(
        self,
        record: "PatientRecord",
        target_status: "RecordStatus",
        actor_id: int,
        actor_roles: Sequence[str],
    ) -> "PatientRecord":
        """Validate, persist, and audit a single state transition.

        This is the internal implementation shared by all convenience
        wrappers.  It follows the same pattern:

        1. Validate via ``TransitionValidator.validate()``.
        2. Persist via ``service.update_status()``.
        3. Return the updated record.

        Args:
            record: The current ``PatientRecord`` instance.
            target_status: Desired target ``RecordStatus``.
            actor_id: ID of the authenticated user.
            actor_roles: RBAC role strings for the user.

        Returns:
            The updated ``PatientRecord``.
        """
        source_status = record.status

        # ── Step 1: Validate ─────────────────────────────────────
        self._validator.validate(record, target_status, actor_roles)

        # ── Step 2: Persist (service layer handles audit + commit) ─
        updated_record = self._service.update_status(
            record_id=record.id,
            new_status=target_status,
            actor_id=actor_id,
        )

        # ── Step 3: Log ──────────────────────────────────────────
        transition_def = self._machine.validate_transition(source_status, target_status)

        logger.info(
            "Workflow transition: record=%s, %s -> %s, actor=%s, action=%s",
            record.id,
            source_status.value,
            target_status.value,
            actor_id,
            transition_def.action,
        )

        return updated_record
