"""Tests for the Treatment Plan state machine (pure workflow transition logic).

The state machine is completely stateless — no database, no mocks, no fixtures.
Every function is tested as a pure transformation.

Coverage target: 100% branches.
"""

from __future__ import annotations

import pytest

from app.modules.treatment.enums import (
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.exceptions import (
    InvalidItemStatusTransition,
    InvalidPlanOperation,
)
from app.modules.treatment.constants import (
    PLAN_TRANSITIONS,
    ITEM_TRANSITIONS,
)
from app.modules.treatment.validators.state_machine import (
    get_allowed_transitions,
    is_editable_state,
    is_terminal_state,
    validate_item_transition,
    validate_plan_transition,
)


# ======================================================================
# validate_plan_transition
# ======================================================================


class TestValidatePlanTransition:
    """All valid + invalid plan transitions."""

    @pytest.mark.parametrize(
        "from_status, to_status",
        [
            (TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.UNDER_REVIEW),
            (TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.CANCELLED),
            (TreatmentPlanStatus.UNDER_REVIEW, TreatmentPlanStatus.PROPOSED),
            (TreatmentPlanStatus.UNDER_REVIEW, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.UNDER_REVIEW, TreatmentPlanStatus.CANCELLED),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.ACCEPTED),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.CANCELLED),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.REJECTED),
            (TreatmentPlanStatus.REJECTED, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.REJECTED, TreatmentPlanStatus.CANCELLED),
            (TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.IN_PROGRESS),
            (TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.CANCELLED),
            (TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.ON_HOLD),
            (TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.COMPLETED),
            (TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.CANCELLED),
            (TreatmentPlanStatus.ON_HOLD, TreatmentPlanStatus.IN_PROGRESS),
            (TreatmentPlanStatus.ON_HOLD, TreatmentPlanStatus.COMPLETED),
            (TreatmentPlanStatus.ON_HOLD, TreatmentPlanStatus.CANCELLED),
        ],
    )
    def test_valid_transitions(self, from_status, to_status):
        """All valid transitions should pass without error."""
        validate_plan_transition(from_status, to_status)

    @pytest.mark.parametrize(
        "from_status, to_status",
        [
            # Terminal → anything
            (TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.COMPLETED, TreatmentPlanStatus.UNDER_REVIEW),
            (TreatmentPlanStatus.CANCELLED, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.CANCELLED, TreatmentPlanStatus.IN_PROGRESS),
            # Illegal non-terminal transitions
            (TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.ACCEPTED),
            (TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.PROPOSED),
            (TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.IN_PROGRESS),
            (TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.COMPLETED),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.UNDER_REVIEW),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.IN_PROGRESS),
            (TreatmentPlanStatus.PROPOSED, TreatmentPlanStatus.COMPLETED),
            (TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.ACCEPTED, TreatmentPlanStatus.PROPOSED),
            (TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.IN_PROGRESS, TreatmentPlanStatus.PROPOSED),
            (TreatmentPlanStatus.ON_HOLD, TreatmentPlanStatus.DRAFT),
            (TreatmentPlanStatus.ON_HOLD, TreatmentPlanStatus.ACCEPTED),
        ],
    )
    def test_invalid_transitions(self, from_status, to_status):
        """All invalid transitions should raise InvalidPlanOperation."""
        with pytest.raises(InvalidPlanOperation):
            validate_plan_transition(from_status, to_status)

    def test_with_string_values(self):
        """String status values should be accepted and normalised."""
        validate_plan_transition("draft", "under_review")
        with pytest.raises(InvalidPlanOperation):
            validate_plan_transition("completed", "draft")

    def test_with_unrecognised_status_string(self):
        """Unrecognised string values should raise InvalidPlanOperation."""
        with pytest.raises(InvalidPlanOperation):
            validate_plan_transition("draft", "invalid_status")

    @pytest.mark.parametrize("bad_value", ["", "unknown", "deleted", "archived"])
    def test_unrecognised_plan_status_raises(self, bad_value):
        """Any unrecognised status string should raise."""
        with pytest.raises(InvalidPlanOperation):
            validate_plan_transition(TreatmentPlanStatus.DRAFT, bad_value)
        with pytest.raises(InvalidPlanOperation):
            validate_plan_transition(bad_value, TreatmentPlanStatus.DRAFT)


# ======================================================================
# validate_item_transition
# ======================================================================


class TestValidateItemTransition:
    """All valid + invalid item transitions."""

    @pytest.mark.parametrize(
        "from_status, to_status",
        [
            (TreatmentPlanItemStatus.PENDING, TreatmentPlanItemStatus.IN_PROGRESS),
            (TreatmentPlanItemStatus.PENDING, TreatmentPlanItemStatus.CANCELLED),
            (TreatmentPlanItemStatus.PENDING, TreatmentPlanItemStatus.DEFERRED),
            (TreatmentPlanItemStatus.IN_PROGRESS, TreatmentPlanItemStatus.COMPLETED),
            (TreatmentPlanItemStatus.IN_PROGRESS, TreatmentPlanItemStatus.CANCELLED),
            (TreatmentPlanItemStatus.IN_PROGRESS, TreatmentPlanItemStatus.DEFERRED),
            (TreatmentPlanItemStatus.DEFERRED, TreatmentPlanItemStatus.PENDING),
            (TreatmentPlanItemStatus.DEFERRED, TreatmentPlanItemStatus.CANCELLED),
        ],
    )
    def test_valid_transitions(self, from_status, to_status):
        """All valid item transitions should pass."""
        validate_item_transition(from_status, to_status)

    @pytest.mark.parametrize(
        "from_status, to_status",
        [
            (TreatmentPlanItemStatus.PENDING, TreatmentPlanItemStatus.COMPLETED),
            (TreatmentPlanItemStatus.COMPLETED, TreatmentPlanItemStatus.PENDING),
            (TreatmentPlanItemStatus.COMPLETED, TreatmentPlanItemStatus.IN_PROGRESS),
            (TreatmentPlanItemStatus.CANCELLED, TreatmentPlanItemStatus.PENDING),
            (TreatmentPlanItemStatus.CANCELLED, TreatmentPlanItemStatus.DEFERRED),
            (TreatmentPlanItemStatus.IN_PROGRESS, TreatmentPlanItemStatus.PENDING),
        ],
    )
    def test_invalid_transitions(self, from_status, to_status):
        """All invalid item transitions should raise."""
        with pytest.raises(InvalidItemStatusTransition):
            validate_item_transition(from_status, to_status)

    def test_with_string_values(self):
        """String item status values should work."""
        validate_item_transition("pending", "in_progress")
        with pytest.raises(InvalidItemStatusTransition):
            validate_item_transition("completed", "pending")

    def test_with_unrecognised_item_status(self):
        """Unrecognised item status string should raise InvalidPlanOperation."""
        with pytest.raises(InvalidPlanOperation):
            validate_item_transition("pending", "unknown_status")


# ======================================================================
# is_terminal_state
# ======================================================================


class TestIsTerminalState:
    def test_terminal_plan_statuses(self):
        """COMPLETED and CANCELLED should be terminal."""
        assert is_terminal_state(TreatmentPlanStatus.COMPLETED) is True
        assert is_terminal_state(TreatmentPlanStatus.CANCELLED) is True

    def test_non_terminal_plan_statuses(self):
        """All non-terminal statuses should return False."""
        assert is_terminal_state(TreatmentPlanStatus.DRAFT) is False
        assert is_terminal_state(TreatmentPlanStatus.UNDER_REVIEW) is False
        assert is_terminal_state(TreatmentPlanStatus.PROPOSED) is False
        assert is_terminal_state(TreatmentPlanStatus.REJECTED) is False
        assert is_terminal_state(TreatmentPlanStatus.ACCEPTED) is False
        assert is_terminal_state(TreatmentPlanStatus.IN_PROGRESS) is False
        assert is_terminal_state(TreatmentPlanStatus.ON_HOLD) is False

    def test_terminal_item_statuses(self):
        """COMPLETED and CANCELLED item statuses should be terminal."""
        assert is_terminal_state(TreatmentPlanItemStatus.COMPLETED) is True
        assert is_terminal_state(TreatmentPlanItemStatus.CANCELLED) is True

    def test_non_terminal_item_statuses(self):
        """PENDING, IN_PROGRESS, DEFERRED should not be terminal."""
        assert is_terminal_state(TreatmentPlanItemStatus.PENDING) is False
        assert is_terminal_state(TreatmentPlanItemStatus.IN_PROGRESS) is False
        assert is_terminal_state(TreatmentPlanItemStatus.DEFERRED) is False


# ======================================================================
# is_editable_state
# ======================================================================


class TestIsEditableState:
    def test_editable_statuses(self):
        """DRAFT, UNDER_REVIEW, PROPOSED should be editable."""
        assert is_editable_state(TreatmentPlanStatus.DRAFT) is True
        assert is_editable_state(TreatmentPlanStatus.UNDER_REVIEW) is True
        assert is_editable_state(TreatmentPlanStatus.PROPOSED) is True

    def test_non_editable_statuses(self):
        """All other statuses should not be editable."""
        assert is_editable_state(TreatmentPlanStatus.REJECTED) is False
        assert is_editable_state(TreatmentPlanStatus.ACCEPTED) is False
        assert is_editable_state(TreatmentPlanStatus.IN_PROGRESS) is False
        assert is_editable_state(TreatmentPlanStatus.ON_HOLD) is False
        assert is_editable_state(TreatmentPlanStatus.COMPLETED) is False
        assert is_editable_state(TreatmentPlanStatus.CANCELLED) is False

    def test_with_string_input(self):
        """String status values should work."""
        assert is_editable_state("draft") is True
        assert is_editable_state("completed") is False

    def test_with_unrecognised_string_raises(self):
        """Unrecognised string should raise InvalidPlanOperation."""
        with pytest.raises(InvalidPlanOperation):
            is_editable_state("invalid_status")


# ======================================================================
# get_allowed_transitions
# ======================================================================


class TestGetAllowedTransitions:
    def test_plan_transitions_match_constants(self):
        """get_allowed_transitions should return the same sets as PLAN_TRANSITIONS."""
        for status in TreatmentPlanStatus:
            expected = PLAN_TRANSITIONS.get(status, frozenset())
            assert get_allowed_transitions(status) == expected

    def test_item_transitions_match_constants(self):
        """get_allowed_transitions should return the same sets as ITEM_TRANSITIONS."""
        for status in TreatmentPlanItemStatus:
            expected = ITEM_TRANSITIONS.get(status, frozenset())
            assert get_allowed_transitions(status) == expected

    def test_terminal_statuses_have_empty_transitions(self):
        """Terminal statuses should have no outgoing transitions."""
        assert get_allowed_transitions(TreatmentPlanStatus.COMPLETED) == frozenset()
        assert get_allowed_transitions(TreatmentPlanStatus.CANCELLED) == frozenset()
        assert get_allowed_transitions(TreatmentPlanItemStatus.COMPLETED) == frozenset()
        assert get_allowed_transitions(TreatmentPlanItemStatus.CANCELLED) == frozenset()

    def test_unknown_type_raises(self):
        """Passing an unsupported type should raise InvalidPlanOperation."""

        class FakeStatus:
            pass

        with pytest.raises(InvalidPlanOperation):
            get_allowed_transitions(FakeStatus())


# ======================================================================
# Edge cases
# ======================================================================


class TestEdgeCases:
    def test_transition_to_same_status(self):
        """Self-transitions should generally raise (not in transition maps)."""
        with pytest.raises(InvalidPlanOperation):
            validate_plan_transition(
                TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.DRAFT,
            )

    def test_all_plan_statuses_have_entries_in_map(self):
        """Every TreatmentPlanStatus value should be a key in PLAN_TRANSITIONS."""
        for status in TreatmentPlanStatus:
            assert status in PLAN_TRANSITIONS, (
                f"Missing transition entry for {status}"
            )

    def test_all_item_statuses_have_entries_in_map(self):
        """Every TreatmentPlanItemStatus value should be a key in ITEM_TRANSITIONS."""
        for status in TreatmentPlanItemStatus:
            assert status in ITEM_TRANSITIONS, (
                f"Missing transition entry for {status}"
            )

    def test_terminal_statuses_have_no_targets(self):
        """Terminal statuses in transition maps must be empty frozensets."""
        for status, targets in PLAN_TRANSITIONS.items():
            if not targets:
                assert is_terminal_state(status) is True
        for status, targets in ITEM_TRANSITIONS.items():
            if not targets:
                assert is_terminal_state(status) is True
