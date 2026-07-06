from enum import StrEnum


class RecordStatus(StrEnum):
    """Represents the lifecycle states of a patient record.

    State machine (linear forward):
        DRAFT → IN_PROGRESS → UNDER_REVIEW → COMPLETED → FINALIZED

    Allowed backwards transitions:
        IN_PROGRESS ↔ DRAFT
        UNDER_REVIEW → IN_PROGRESS  (revision requested)
        COMPLETED → IN_PROGRESS      (reopen, admin only)

    ``FINALIZED`` is the terminal state.  Once a record reaches
    FINALIZED it is immutable — no further transitions are allowed.

    ``LOCKED`` is retained for backward compatibility with existing
    database records that may have been assigned this value before
    the state machine was introduced.
    """

    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    UNDER_REVIEW = "UNDER_REVIEW"
    COMPLETED = "COMPLETED"
    FINALIZED = "FINALIZED"
    LOCKED = "LOCKED"

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    @classmethod
    def terminal_states(cls) -> set["RecordStatus"]:
        """Return all states that are terminal (no outgoing transitions)."""
        return {cls.FINALIZED}

    @classmethod
    def editable_states(cls) -> set["RecordStatus"]:
        """Return states in which clinical data may be modified."""
        return {cls.DRAFT, cls.IN_PROGRESS}

    @classmethod
    def reviewable_states(cls) -> set["RecordStatus"]:
        """Return states in which the record can be sent for review."""
        return {cls.IN_PROGRESS}

    def is_terminal(self) -> bool:
        """``True`` if this state has no outgoing transitions."""
        return self in self.terminal_states()

    def is_editable(self) -> bool:
        """``True`` if clinical data may be modified in this state."""
        return self in self.editable_states()