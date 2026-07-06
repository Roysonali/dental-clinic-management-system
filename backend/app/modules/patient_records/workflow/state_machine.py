"""
Patient Record State Machine
============================

Production-grade finite state machine for managing the lifecycle of
patient clinical records in a dental care environment.

States
------
    DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED → FINALIZED

    Allowed backwards transitions:
        IN_PROGRESS ↔ DRAFT           (save as draft / resume)
        UNDER_REVIEW → IN_PROGRESS    (revision requested by reviewer)
        COMPLETED → IN_PROGRESS       (reopen, admin-level only)

    FINALIZED is the **terminal** state — no outgoing transitions.

Guard rules
-----------
Each transition carries:
* ``required_roles`` — which RBAC roles may perform this transition.
* ``assert_modifiable`` — whether the record must not be deleted.
* ``assert_not_terminal`` — whether the source state must not be terminal.
* ``action`` — audit log action name for the transition.

Usage
-----
    machine = PatientRecordStateMachine()
    machine.validate_transition(RecordStatus.DRAFT, RecordStatus.IN_PROGRESS)
    # → TransitionDefinition(...)

    machine.get_allowed_transitions(RecordStatus.IN_PROGRESS)
    # → {RecordStatus.DRAFT, RecordStatus.UNDER_REVIEW}
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from app.modules.patient_records.enums import RecordStatus


# ---------------------------------------------------------------------------
# Transition metadata
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TransitionDefinition:
    """Immutable descriptor for a single state transition.

    Attributes:
        source: The originating ``RecordStatus``.
        target: The destination ``RecordStatus``.
        required_roles: RBAC role names allowed to perform this transition.
        action: Audit log action name (e.g. ``STATUS_STARTED``).
        description: Human-readable explanation of the transition.
        needs_confirmation: Whether the transition requires explicit
            confirmation from the caller (e.g. finalize -> confirm=True).
    """

    source: RecordStatus
    target: RecordStatus
    required_roles: Sequence[str]
    action: str
    description: str = ""
    needs_confirmation: bool = False


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class PatientRecordStateMachine:
    """Deterministic finite state machine for patient record lifecycles.

    Thread-safe (immutable after construction).  All transition rules
    are defined as a flat set of ``TransitionDefinition`` records and
    indexed internally for O(1) lookups.
    """

    def __init__(self) -> None:
        #: All permitted transitions indexed as (source, target) for O(1)
        #: lookups and traversal queries.
        self._transitions: dict[RecordStatus, dict[RecordStatus, TransitionDefinition]] = {}
        self._build_transitions()

    # ==================================================================
    # Public API
    # ==================================================================

    def validate_transition(
        self,
        source: RecordStatus,
        target: RecordStatus,
    ) -> TransitionDefinition:
        """Return the transition definition if the transition is allowed.

        Args:
            source: Current state of the record.
            target: Desired next state.

        Returns:
            The matching ``TransitionDefinition``.

        Raises:
            ValueError: If the transition is not defined.
        """
        by_target = self._transitions.get(source)

        if by_target is None:
            valid = ", ".join(s.value for s in self.get_allowed_transitions(source))
            raise ValueError(
                f"No transitions defined from state {source.value!r}. "
                f"Allowed targets: [{valid}]"
            )

        transition = by_target.get(target)

        if transition is None:
            valid = ", ".join(s.value for s in by_target)
            raise ValueError(
                f"Transition {source.value!r} → {target.value!r} is not allowed. "
                f"Allowed targets from {source.value!r}: [{valid}]"
            )

        return transition

    def is_transition_allowed(
        self,
        source: RecordStatus,
        target: RecordStatus,
    ) -> bool:
        """Return ``True`` if the transition is defined (regardless of roles)."""
        try:
            self.validate_transition(source, target)
            return True
        except ValueError:
            return False

    def get_allowed_transitions(
        self,
        source: RecordStatus,
    ) -> set[RecordStatus]:
        """Return the set of target states reachable from ``source``."""
        by_target = self._transitions.get(source)
        return set(by_target.keys()) if by_target else set()

    def get_transition(
        self,
        source: RecordStatus,
        target: RecordStatus,
    ) -> TransitionDefinition | None:
        """Return the transition definition, or ``None`` if not allowed."""
        by_target = self._transitions.get(source)
        if by_target is None:
            return None
        return by_target.get(target)

    @property
    def all_transitions(self) -> list[TransitionDefinition]:
        """Return every defined transition as a flat list."""
        result: list[TransitionDefinition] = []
        for by_target in self._transitions.values():
            result.extend(by_target.values())
        return result

    @property
    def terminal_states(self) -> set[RecordStatus]:
        """Return the set of states that have no outgoing transitions."""
        return RecordStatus.terminal_states()

    # ==================================================================
    # Transition table builder
    # ==================================================================

    def _register(
        self,
        source: RecordStatus,
        target: RecordStatus,
        *,
        required_roles: Sequence[str],
        action: str,
        description: str = "",
        needs_confirmation: bool = False,
    ) -> None:
        """Register a single transition in the lookup table."""
        transition = TransitionDefinition(
            source=source,
            target=target,
            required_roles=required_roles,
            action=action,
            description=description,
            needs_confirmation=needs_confirmation,
        )
        self._transitions.setdefault(source, {})[target] = transition

    def _build_transitions(self) -> None:
        """Define the complete transition table.

        Import role constants locally to avoid circular imports at
        module level.  The constants module has no dependencies on
        the patient_records package.
        """
        from app.core.constants import (
            DOCTOR_ROLES,
            ROLE_ADMIN,
            ROLE_RECEPTIONIST,
        )

        _WRITE_ROLES: Sequence[str] = [ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES]
        _ADMIN_ROLES: Sequence[str] = [ROLE_ADMIN]
        _DOCTOR_ROLES: Sequence[str] = [*DOCTOR_ROLES]

        # ── Forward transitions ──────────────────────────────────

        # DRAFT → IN_PROGRESS: doctor / admin / receptionist begins work
        self._register(
            RecordStatus.DRAFT,
            RecordStatus.IN_PROGRESS,
            required_roles=_WRITE_ROLES,
            action="STATUS_STARTED",
            description="Begin clinical work on a draft record.",
        )

        # IN_PROGRESS → UNDER_REVIEW: submit for peer/lead review
        self._register(
            RecordStatus.IN_PROGRESS,
            RecordStatus.UNDER_REVIEW,
            required_roles=_DOCTOR_ROLES,
            action="STATUS_SUBMITTED_FOR_REVIEW",
            description="Submit the record for clinical review.",
        )

        # UNDER_REVIEW → COMPLETED: review approved
        self._register(
            RecordStatus.UNDER_REVIEW,
            RecordStatus.COMPLETED,
            required_roles=_ADMIN_ROLES,
            action="STATUS_REVIEW_APPROVED",
            description="Approve the record after review.",
        )

        # COMPLETED → FINALIZED: make record immutable
        self._register(
            RecordStatus.COMPLETED,
            RecordStatus.FINALIZED,
            required_roles=_ADMIN_ROLES,
            action="STATUS_FINALIZED",
            description="Finalize the record — it becomes immutable.",
            needs_confirmation=True,
        )

        # ── Backwards / revert transitions ───────────────────────

        # IN_PROGRESS → DRAFT: save as draft
        self._register(
            RecordStatus.IN_PROGRESS,
            RecordStatus.DRAFT,
            required_roles=_WRITE_ROLES,
            action="STATUS_REVERTED_TO_DRAFT",
            description="Revert an in-progress record back to draft.",
        )

        # UNDER_REVIEW → IN_PROGRESS: revision requested
        self._register(
            RecordStatus.UNDER_REVIEW,
            RecordStatus.IN_PROGRESS,
            required_roles=_ADMIN_ROLES,
            action="STATUS_REVISION_REQUESTED",
            description="Request revisions to a record under review.",
        )

        # COMPLETED → IN_PROGRESS: reopen for corrections (admin only)
        self._register(
            RecordStatus.COMPLETED,
            RecordStatus.IN_PROGRESS,
            required_roles=_ADMIN_ROLES,
            action="STATUS_REOPENED",
            description="Reopen a completed record for corrections / additions.",
        )
