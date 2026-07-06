"""
Transition Validator
====================

Production-grade transition validation engine for patient record state
changes.

Validation pipeline (in order)
------------------------------
1. **Deleted check** — soft-deleted records cannot transition.
2. **Finalized check** — finalized records cannot transition.
3. **Same-state check** — no-op transitions are rejected.
4. **Terminal-state check** — terminal states (FINALIZED) have no
   outgoing transitions.
5. **State machine lookup** — is the (source → target) pair defined?
6. **RBAC check** — does the actor have the required role?
7. **Transition prerequisites** — domain-specific workflow rules.

All violations raise ``PatientRecordBusinessRule`` (maps to HTTP 400
via the global exception handler).  No HTTP exceptions are raised.

Usage
-----
    validator = TransitionValidator()
    validator.validate(
        record=patient_record,
        target_status=RecordStatus.UNDER_REVIEW,
        actor_roles=["ADMIN"],
    )
"""

from __future__ import annotations

from typing import Sequence, TYPE_CHECKING

from app.modules.patient_records.exceptions import PatientRecordBusinessRule
from app.modules.patient_records.workflow.state_machine import (
    PatientRecordStateMachine,
    TransitionDefinition,
)
from app.modules.patient_records.workflow.workflow_rules import WorkflowRules

if TYPE_CHECKING:
    from app.modules.patient_records.models import PatientRecord
    from app.modules.patient_records.enums import RecordStatus


# ---------------------------------------------------------------------------
# Error message templates
# ---------------------------------------------------------------------------

_ERR_SAME_STATE = (
    "Patient record {record_id} already has status {status!r} — "
    "no transition needed"
)

_ERR_TERMINAL_STATE = (
    "Patient record {record_id} is in terminal state {status!r} and "
    "cannot transition to any other state"
)

_ERR_RBAC = (
    "User roles {roles!r} are not authorized to perform "
    "transition {source!r} → {target!r}.  Requires one of: {required!r}"
)


class TransitionValidator:
    """Validates state transitions through a 7-step pipeline.

    The validator is stateless and thread-safe — a single instance can
    be shared across requests or created fresh each time.

    Steps:
        1. Deleted guard
        2. Finalized guard
        3. Same-state guard
        4. Terminal-state guard
        5. State machine lookup (allowed transitions)
        6. RBAC check (actor roles)
        7. Prerequisite check (workflow rules)
    """

    def __init__(self) -> None:
        self._machine = PatientRecordStateMachine()

    # ==================================================================
    # Public API
    # ==================================================================

    def validate(
        self,
        record: "PatientRecord",
        target_status: "RecordStatus",
        actor_roles: Sequence[str],
    ) -> TransitionDefinition:
        """Run the full validation pipeline for a proposed transition.

        Args:
            record: The current ``PatientRecord`` ORM instance.
            target_status: Desired target ``RecordStatus``.
            actor_roles: RBAC role strings for the authenticated user.

        Returns:
            The ``TransitionDefinition`` metadata for the transition.

        Raises:
            PatientRecordBusinessRule: On the **first** violation
                encountered.  Callers should check errors in the
                order they occur — earlier violations are more
                fundamental than later ones.
        """
        source_status = record.status

        # ── Step 1: Deleted guard ────────────────────────────────
        WorkflowRules.assert_record_not_deleted(record)

        # ── Step 2: Finalized guard ──────────────────────────────
        WorkflowRules.assert_record_not_finalized(record)

        # ── Step 3: Same-state guard ─────────────────────────────
        if source_status == target_status:
            raise PatientRecordBusinessRule(
                message=_ERR_SAME_STATE.format(
                    record_id=record.id,
                    status=source_status.value,
                ),
                details={
                    "record_id": str(record.id),
                    "source": source_status.value,
                    "target": target_status.value,
                },
            )

        # ── Step 4: Terminal-state guard ─────────────────────────
        if source_status.is_terminal():
            raise PatientRecordBusinessRule(
                message=_ERR_TERMINAL_STATE.format(
                    record_id=record.id,
                    status=source_status.value,
                ),
                details={
                    "record_id": str(record.id),
                    "source": source_status.value,
                },
            )

        # ── Step 5: State machine lookup ─────────────────────────
        try:
            transition = self._machine.validate_transition(
                source_status, target_status,
            )
        except ValueError as exc:
            raise PatientRecordBusinessRule(
                message=str(exc),
                details={
                    "record_id": str(record.id),
                    "source": source_status.value,
                    "target": target_status.value,
                },
            ) from exc

        # ── Step 6: RBAC check ───────────────────────────────────
        self._check_rbac(
            actor_roles=actor_roles,
            required_roles=transition.required_roles,
            source=source_status,
            target=target_status,
        )

        # ── Step 7: Transition prerequisites ─────────────────────
        WorkflowRules.assert_can_submit_for_review(record, target_status)
        WorkflowRules.assert_can_finalize(record, target_status)
        WorkflowRules.assert_can_reopen(record, target_status)

        return transition

    def is_transition_allowed(
        self,
        source: "RecordStatus",
        target: "RecordStatus",
    ) -> bool:
        """Quick check — is this transition defined in the state machine?

        Does **not** run the full pipeline (no RBAC, no deleted/finalized
        checks).  Use for UI hints or pre-filtering only.
        """
        return self._machine.is_transition_allowed(source, target)

    def get_available_transitions(
        self,
        status: "RecordStatus",
    ) -> set["RecordStatus"]:
        """Return all states reachable from ``status`` via defined transitions.

        Returns an empty set for terminal states.
        """
        return self._machine.get_allowed_transitions(status)

    def get_transition_metadata(
        self,
        source: "RecordStatus",
        target: "RecordStatus",
    ) -> "TransitionDefinition | None":
        """Return transition metadata without running validation.

        Returns ``None`` if the transition is not defined.
        """
        return self._machine.get_transition(source, target)

    # ==================================================================
    # Pipeline helpers
    # ==================================================================

    @staticmethod
    def _check_rbac(
        *,
        actor_roles: Sequence[str],
        required_roles: Sequence[str],
        source: "RecordStatus",
        target: "RecordStatus",
    ) -> None:
        """Raise if none of the actor's roles match the required roles.

        Raises:
            PatientRecordBusinessRule: If unauthorized.
        """
        if any(role in required_roles for role in actor_roles):
            return

        raise PatientRecordBusinessRule(
            message=_ERR_RBAC.format(
                roles=list(actor_roles),
                source=source.value,
                target=target.value,
                required=list(required_roles),
            ),
            details={
                "source": source.value,
                "target": target.value,
                "actor_roles": list(actor_roles),
                "required_roles": list(required_roles),
            },
        )
