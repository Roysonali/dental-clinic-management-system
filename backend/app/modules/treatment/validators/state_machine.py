"""Treatment Plan State Machine — pure workflow transition validation.

This module is the **sole authority** on whether a status transition is legal.
It does **not** access the database, call repositories, or perform any
business-rule checks beyond transition legality — those belong in the
service layer and the data validators (Phase 3, Part 2).

Design
------
* **Stateless** — every function is a pure, idempotent transformation.
* **No I/O** — zero database, network, or filesystem access.
* **No ORM** — operates on enums and strings only.
* **No hardcoded transitions** — all rules come from ``PLAN_TRANSITIONS``
  and ``ITEM_TRANSITIONS`` in ``app.modules.treatment.constants``.
* **Approved exceptions only** — raises ``InvalidPlanOperation``,
  ``InvalidItemStatusTransition`` from the approved exception hierarchy.

Integration
-----------
Called by the **service layer** before any status mutation::

    from app.modules.treatment.validators import validate_plan_transition

    def transition_plan(self, plan, new_status):
        validate_plan_transition(plan.status, new_status, has_items=len(plan.items) > 0)
        plan.status = new_status
        self.repo.update(plan, {"status": new_status})
"""

from __future__ import annotations

from typing import overload

from app.modules.treatment.constants import (
    ITEM_TRANSITIONS,
    PLAN_TRANSITIONS,
)
from app.modules.treatment.enums import (
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.exceptions import (
    InvalidItemStatusTransition,
    InvalidPlanOperation,
)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_plan_transition(
    current_status: TreatmentPlanStatus | str,
    new_status: TreatmentPlanStatus | str,
) -> None:
    """Validate that a plan may transition from ``current_status`` to ``new_status``.

    This function validates **only workflow-transition legality** — whether
    the target status is a permitted successor per the ``PLAN_TRANSITIONS``
    map. Business-policy checks (item existence, approval state, etc.) are
    owned by the ``TreatmentPlanValidator``.

    Args:
        current_status: The plan's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidPlanOperation:
            * If ``current_status`` or ``new_status`` is not a recognised
              ``TreatmentPlanStatus`` value.
            * If the transition is not listed in ``PLAN_TRANSITIONS``.

    Examples::

        validate_plan_transition(TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.UNDER_REVIEW)  # OK
        validate_plan_transition(TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.ACCEPTED)      # InvalidPlanOperation
        validate_plan_transition(TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.DRAFT)      # InvalidPlanOperation
    """
    from_status = _resolve_plan_status(current_status)
    to_status = _resolve_plan_status(new_status)

    allowed = PLAN_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidPlanOperation(
            f"Cannot transition treatment plan from "
            f"'{from_status.value}' to '{to_status.value}'. "
            f"Allowed transitions from '{from_status.value}'"
            f"{': ' + ', '.join(sorted(s.value for s in allowed)) if allowed else ': none (terminal state)'}",
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def validate_item_transition(
    current_status: TreatmentPlanItemStatus | str,
    new_status: TreatmentPlanItemStatus | str,
) -> None:
    """Validate that an item may transition from ``current_status`` to ``new_status``.

    Args:
        current_status: The item's current status (enum member or string value).
        new_status: The requested target status.

    Raises:
        InvalidItemStatusTransition: If the transition is not listed in
            ``ITEM_TRANSITIONS``, or if either value is not a recognised
            ``TreatmentPlanItemStatus``.

    Examples::

        validate_item_transition(TreatmentPlanItemStatus.PENDING, TreatmentPlanItemStatus.IN_PROGRESS)  # OK
        validate_item_transition(TreatmentPlanItemStatus.PENDING, TreatmentPlanItemStatus.COMPLETED)    # InvalidItemStatusTransition
    """
    from_status = _resolve_item_status(current_status)
    to_status = _resolve_item_status(new_status)

    allowed = ITEM_TRANSITIONS.get(from_status, frozenset())

    if to_status not in allowed:
        raise InvalidItemStatusTransition(
            from_status=from_status.value,
            to_status=to_status.value,
            details={
                "current_status": from_status.value,
                "new_status": to_status.value,
                "allowed_transitions": sorted(s.value for s in allowed),
            },
        )


def is_terminal_state(
    status: TreatmentPlanStatus | TreatmentPlanItemStatus,
) -> bool:
    """Return ``True`` if ``status`` has **no** outgoing transitions.

    A terminal status is a dead-end state from which the entity cannot
    transition to any other status. Works for both plan and item statuses.

    Args:
        status: A ``TreatmentPlanStatus`` or ``TreatmentPlanItemStatus``
            enum member.

    Returns:
        ``True`` if the status is terminal (no outgoing transitions).

    Note:
        Delegates to the enum's own ``is_terminal()`` method, which derives
        its knowledge from the transition maps in ``constants.py`` — no
        duplication of terminal-status lists.
    """
    return status.is_terminal()


def is_editable_state(status: TreatmentPlanStatus | str) -> bool:
    """Return ``True`` if a plan in ``status`` may be edited **without versioning**.

    Editable statuses are ``DRAFT``, ``UNDER_REVIEW``, and ``PROPOSED``.
    Plans in ``ACCEPTED``, ``IN_PROGRESS``, or ``ON_HOLD`` require a version
    snapshot before modification.

    Args:
        status: A ``TreatmentPlanStatus`` enum member or its string value
            (e.g. ``"draft"``).

    Returns:
        ``True`` if direct edits are allowed (no versioning needed).

    Note:
        Delegates to the enum's ``is_editable()`` method. Only meaningful for
        plan statuses — items have no "editable vs versioned" concept (they
        are always edited in-place within the plan's current versioning
        context).
    """
    if isinstance(status, str):
        status = _resolve_plan_status(status)
    return status.is_editable()


# ---------------------------------------------------------------------------
# Overloaded helper for type-safe generic transition lookup
# ---------------------------------------------------------------------------


@overload
def get_allowed_transitions(
    status: TreatmentPlanStatus,
) -> frozenset[TreatmentPlanStatus]: ...


@overload
def get_allowed_transitions(
    status: TreatmentPlanItemStatus,
) -> frozenset[TreatmentPlanItemStatus]: ...


def get_allowed_transitions(
    status: TreatmentPlanStatus | TreatmentPlanItemStatus,
) -> frozenset[TreatmentPlanStatus] | frozenset[TreatmentPlanItemStatus]:
    """Return the set of statuses that ``status`` may transition to.

    Args:
        status: A ``TreatmentPlanStatus`` or ``TreatmentPlanItemStatus``
            enum member.

    Returns:
        A ``frozenset`` of allowed target statuses. The returned type matches
        the input type (``frozenset[TreatmentPlanStatus]`` or
        ``frozenset[TreatmentPlanItemStatus]``). An empty set means the
        status is terminal.

    Examples::

        >>> get_allowed_transitions(TreatmentPlanStatus.DRAFT)
        frozenset({TreatmentPlanStatus.UNDER_REVIEW, TreatmentPlanStatus.CANCELLED})

        >>> get_allowed_transitions(TreatmentPlanStatus.COMPLETED)
        frozenset()
    """
    if isinstance(status, TreatmentPlanStatus):
        return PLAN_TRANSITIONS.get(status, frozenset())
    if isinstance(status, TreatmentPlanItemStatus):
        return ITEM_TRANSITIONS.get(status, frozenset())

    # Exhaustiveness guard — not reachable unless a new enum is added.
    raise InvalidPlanOperation(
        f"Unknown status type: {type(status).__name__!r}. "
        f"Expected TreatmentPlanStatus or TreatmentPlanItemStatus.",
        details={"received_type": type(status).__name__},
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_plan_status(status: TreatmentPlanStatus | str) -> TreatmentPlanStatus:
    """Normalise ``status`` to a ``TreatmentPlanStatus`` enum member.

    Accepts either an enum member or a string value (e.g. ``"draft"``).
    """
    if isinstance(status, TreatmentPlanStatus):
        return status
    if isinstance(status, str):
        try:
            return TreatmentPlanStatus(status)
        except ValueError:
            raise InvalidPlanOperation(
                f"Unrecognised treatment plan status: {status!r}. "
                f"Must be one of: {', '.join(sorted(TreatmentPlanStatus.all_values()))}",
                details={
                    "received": status,
                    "expected_values": sorted(TreatmentPlanStatus.all_values()),
                },
            )
    raise InvalidPlanOperation(
        f"Unexpected status type: {type(status).__name__!r}. "
        f"Expected TreatmentPlanStatus or str.",
        details={"received_type": type(status).__name__},
    )


def _resolve_item_status(
    status: TreatmentPlanItemStatus | str,
) -> TreatmentPlanItemStatus:
    """Normalise ``status`` to a ``TreatmentPlanItemStatus`` enum member.

    Accepts either an enum member or a string value (e.g. ``"pending"``).
    Raises ``InvalidPlanOperation`` for unrecognised values (not
    ``InvalidItemStatusTransition``, because this is a value-recognition
    error, not a transition error).
    """
    if isinstance(status, TreatmentPlanItemStatus):
        return status
    if isinstance(status, str):
        try:
            return TreatmentPlanItemStatus(status)
        except ValueError:
            raise InvalidPlanOperation(
                f"Unrecognised treatment plan item status: {status!r}. "
                f"Must be one of: {', '.join(sorted(TreatmentPlanItemStatus.all_values()))}",
                details={
                    "received": status,
                    "expected_values": sorted(TreatmentPlanItemStatus.all_values()),
                },
            )
    raise InvalidPlanOperation(
        f"Unexpected status type: {type(status).__name__!r}. "
        f"Expected TreatmentPlanItemStatus or str.",
        details={"received_type": type(status).__name__},
    )
