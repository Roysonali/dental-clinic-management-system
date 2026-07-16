"""Treatment Plan Module — Domain enums.

Application-level string enums that back ``VARCHAR`` columns. Validation of
allowed values happens in the application layer (validators / state machine);
database ``CHECK`` constraints provide a secondary integrity guarantee.

These enums are the single source of truth for the finite value sets used by
the Treatment Plan module.
"""

from __future__ import annotations

from enum import Enum


class TreatmentPlanStatus(str, Enum):
    """Lifecycle status of a treatment plan.

    The set of values is mirrored by the ``ck_tp_status`` database check
    constraint and by ``VALID_PLAN_TRANSITIONS`` in ``constants.py``.
    """

    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    PROPOSED = "proposed"
    REJECTED = "rejected"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    @classmethod
    def editable_statuses(cls) -> frozenset["TreatmentPlanStatus"]:
        """Statuses that allow plan/item modification without versioning."""
        return frozenset(
            {
                cls.DRAFT,
                cls.UNDER_REVIEW,
                cls.PROPOSED,
            }
        )

    @classmethod
    def terminal_statuses(cls) -> frozenset["TreatmentPlanStatus"]:
        """Statuses with no outgoing transitions.

        Derived from ``PLAN_TRANSITIONS`` (constants) so the transition map
        remains the single source of truth — no duplicated terminal set.
        """
        from app.modules.treatment.constants import PLAN_TRANSITIONS

        return frozenset(
            status for status, targets in PLAN_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this status has no outgoing transitions."""
        return self in self.terminal_statuses()

    def is_editable(self) -> bool:
        """Return ``True`` if a plan in this status may be edited without versioning."""
        return self in self.editable_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        """All persisted status string values (for CHECK constraints)."""
        return frozenset(member.value for member in cls)


class TreatmentPlanItemStatus(str, Enum):
    """Status of an individual procedure line item within a treatment plan."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DEFERRED = "deferred"

    @classmethod
    def terminal_statuses(cls) -> frozenset["TreatmentPlanItemStatus"]:
        """Item statuses with no outgoing transitions.

        Derived from ``ITEM_TRANSITIONS`` (constants) — single source of truth.
        """
        from app.modules.treatment.constants import ITEM_TRANSITIONS

        return frozenset(
            status for status, targets in ITEM_TRANSITIONS.items() if not targets
        )

    def is_terminal(self) -> bool:
        """Return ``True`` if this item status has no outgoing transitions."""
        return self in self.terminal_statuses()

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class ProcedureCategory(str, Enum):
    """Category of a dental procedure in the master catalog."""

    DIAGNOSTIC = "diagnostic"
    PREVENTIVE = "preventive"
    RESTORATIVE = "restorative"
    ENDODONTIC = "endodontic"
    PERIODONTIC = "periodontic"
    PROSTHODONTIC = "prosthodontic"
    ORAL_SURGERY = "oral_surgery"
    ORTHODONTIC = "orthodontic"
    COSMETIC = "cosmetic"
    IMPLANT = "implant"
    OTHER = "other"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class PatientAcknowledgmentStatus(str, Enum):
    """Patient's response to a proposed treatment plan."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class ToothQuadrant(str, Enum):
    """Dental quadrant identifiers (FDI notation)."""

    UPPER_RIGHT = "UR"  # Quadrant 1 (teeth 11-18)
    UPPER_LEFT = "UL"  # Quadrant 2 (teeth 21-28)
    LOWER_LEFT = "LL"  # Quadrant 3 (teeth 31-38)
    LOWER_RIGHT = "LR"  # Quadrant 4 (teeth 41-48)

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)


class ToothArch(str, Enum):
    """Dental arch identifiers."""

    UPPER = "upper"
    LOWER = "lower"

    @classmethod
    def all_values(cls) -> frozenset[str]:
        return frozenset(member.value for member in cls)
