"""Validator tests for ProcedureValidator and TreatmentPlanValidator.

Tests are organised by validator class and method. Pure field-level
validators (no repo dependency) use plain instantiation with a mock
repo. Composite validators that read from the database use the ``db``
fixture and real repositories.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ProcedureCategory,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.exceptions import (
    DuplicateItemSequence,
    DuplicatePlanDetected,
    DuplicateProcedureDetected,
    InvalidDateRange,
    InvalidItemStatusTransition,
    InvalidPlanOperation,
    InvalidToothNumber,
    PatientAcknowledgmentExists,
    PlanAlreadyApproved,
    PlanNotDeletable,
    PlanNotEditable,
    PlanNotFound,
    PlanValidationFailed,
    ProcedureNotFound,
)
from app.modules.treatment.models import TreatmentPlan, TreatmentPlanApproval
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)
from app.modules.treatment.validators import (
    ProcedureValidator,
    TreatmentPlanValidator,
)

from tests.modules.treatment.conftest import (
    ProcedureFactory,
    TreatmentPlanApprovalFactory,
    TreatmentPlanFactory,
    TreatmentPlanItemFactory,
)

# ======================================================================
# ProcedureValidator — pure field validators (no repo)
# ======================================================================


class _MockProcedureRepo:
    """Minimal mock for ProcedureRepository used by pure validators.

    Real repo methods are added per test class when needed.
    """
    pass


@pytest.fixture
def procedure_validator() -> ProcedureValidator:
    """Return a ProcedureValidator backed by a no-op mock repo.

    Use this fixture when testing field-level validators that do
    not call the repository (validate_default_cost, etc.).
    """
    mock_repo = MagicMock(spec=ProcedureRepository)
    return ProcedureValidator(repo=mock_repo)


class TestProcedureValidatorValidateDefaultCost:
    def test_zero_cost_ok(self, procedure_validator: ProcedureValidator):
        """MIN_ESTIMATED_COST is 0.00 — zero should be accepted."""
        procedure_validator.validate_default_cost(Decimal("0.00"))  # no raise

    def test_max_cost_ok(self, procedure_validator: ProcedureValidator):
        procedure_validator.validate_default_cost(Decimal("999999.99"))  # no raise

    def test_mid_range_ok(self, procedure_validator: ProcedureValidator):
        procedure_validator.validate_default_cost(Decimal("150.00"))  # no raise

    def test_negative_raises(self, procedure_validator: ProcedureValidator):
        with pytest.raises(PlanValidationFailed):
            procedure_validator.validate_default_cost(Decimal("-1.00"))

    def test_exceeds_max_raises(self, procedure_validator: ProcedureValidator):
        with pytest.raises(PlanValidationFailed):
            procedure_validator.validate_default_cost(Decimal("1000000.00"))

    def test_none_raises(self, procedure_validator: ProcedureValidator):
        with pytest.raises(PlanValidationFailed):
            procedure_validator.validate_default_cost(None)


class TestProcedureValidatorValidateUniqueCode:
    def test_unique_code_ok(self, db):
        """Code that does not exist should pass."""
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        validator.validate_unique_code("UNIQUE")  # no raise

    def test_duplicate_raises(self, db):
        repo = ProcedureRepository(db)
        ProcedureFactory.create(db, code="EXISTING")
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(DuplicateProcedureDetected):
            validator.validate_unique_code("EXISTING")

    def test_duplicate_excluded_ok(self, db):
        """Same code but with exclude_id pointing to the existing procedure."""
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db, code="EXISTING")
        validator = ProcedureValidator(repo=repo)
        validator.validate_unique_code("EXISTING", exclude_id=proc.id)  # no raise

    def test_case_insensitive_duplicate(self, db):
        repo = ProcedureRepository(db)
        ProcedureFactory.create(db, code="UNIQUE")
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(DuplicateProcedureDetected):
            validator.validate_unique_code("unique")


class TestProcedureValidatorValidateActive:
    def test_active_procedure_ok(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db, is_active=True)
        validator = ProcedureValidator(repo=repo)
        validator.validate_active(proc.id)  # no raise

    def test_inactive_raises(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db, is_active=False)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(InvalidPlanOperation):
            validator.validate_active(proc.id)

    def test_nonexistent_raises_procedure_not_found(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(ProcedureNotFound):
            validator.validate_active(99999)


class TestProcedureValidatorValidateCreate:
    def test_valid_minimal(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        validator.validate_create(
            code="RCT001",
            name="Root Canal",
            default_cost=Decimal("150.00"),
            category=ProcedureCategory.ENDODONTIC,
        )  # no raise

    def test_code_normalized_to_uppercase(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        validator.validate_create(
            code=" rct001 ",
            name="Root Canal",
            default_cost=Decimal("150.00"),
            category=ProcedureCategory.ENDODONTIC,
        )  # no raise — code gets normalized to "RCT001"

    def test_empty_code_raises(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(PlanValidationFailed, match="is required"):
            validator.validate_create(
                code="",
                name="Test",
                default_cost=Decimal("100.00"),
                category=ProcedureCategory.DIAGNOSTIC,
            )

    def test_invalid_code_characters_raises(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(PlanValidationFailed):
            validator.validate_create(
                code="INVALID!CODE",
                name="Test",
                default_cost=Decimal("100.00"),
                category=ProcedureCategory.DIAGNOSTIC,
            )

    def test_empty_name_raises(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(PlanValidationFailed, match="required"):
            validator.validate_create(
                code="TEST", name="",
                default_cost=Decimal("100.00"),
                category=ProcedureCategory.DIAGNOSTIC,
            )

    def test_invalid_category_raises(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(PlanValidationFailed, match="category"):
            validator.validate_create(
                code="TEST", name="Test",
                default_cost=Decimal("100.00"),
                category="invalid_category",
            )

    def test_duplicate_code_raises(self, db):
        repo = ProcedureRepository(db)
        ProcedureFactory.create(db, code="DUP001")
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(DuplicateProcedureDetected):
            validator.validate_create(
                code="DUP001", name="Duplicate",
                default_cost=Decimal("100.00"),
                category=ProcedureCategory.OTHER,
            )


class TestProcedureValidatorValidateUpdate:
    def test_valid_partial_update(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db)
        validator = ProcedureValidator(repo=repo)
        validator.validate_update(
            procedure_id=proc.id,
            updates={"name": "Updated Name"},
        )  # no raise

    def test_nonexistent_procedure_raises(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(ProcedureNotFound):
            validator.validate_update(
                procedure_id=99999,
                updates={"name": "Test"},
            )

    def test_unrecognised_field_raises(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(PlanValidationFailed, match="Unrecognised"):
            validator.validate_update(
                procedure_id=proc.id,
                updates={"unknown_field": "value"},
            )

    def test_code_update_duplicate_raises(self, db):
        repo = ProcedureRepository(db)
        ProcedureFactory.create(db, code="TAKEN")
        target = ProcedureFactory.create(db, code="ORIGINAL")
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(DuplicateProcedureDetected):
            validator.validate_update(
                procedure_id=target.id,
                updates={"code": "TAKEN"},
            )

    def test_code_update_same_code_ok(self, db):
        """Updating a procedure to its own code should work."""
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db, code="MYCODE")
        validator = ProcedureValidator(repo=repo)
        validator.validate_update(
            procedure_id=proc.id,
            updates={"code": "MYCODE"},
        )  # no raise — exclude_id matches


class TestProcedureValidatorValidateDeletable:
    def test_inactive_procedure_ok(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db, is_active=False)
        validator = ProcedureValidator(repo=repo)
        validator.validate_deletable(proc.id)  # no raise

    def test_active_procedure_raises(self, db):
        repo = ProcedureRepository(db)
        proc = ProcedureFactory.create(db, is_active=True)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(InvalidPlanOperation, match="active"):
            validator.validate_deletable(proc.id)

    def test_nonexistent_raises(self, db):
        repo = ProcedureRepository(db)
        validator = ProcedureValidator(repo=repo)
        with pytest.raises(ProcedureNotFound):
            validator.validate_deletable(99999)


# ======================================================================
# TreatmentPlanValidator — plan lifecycle
# ======================================================================


@pytest.fixture
def plan_validator(db) -> TreatmentPlanValidator:
    """Return a TreatmentPlanValidator backed by real repositories."""
    plan_repo = TreatmentPlanRepository(db)
    procedure_repo = ProcedureRepository(db)
    return TreatmentPlanValidator(
        plan_repo=plan_repo,
        procedure_repo=procedure_repo,
    )


class TestPlanValidatorValidatePlanExists:
    def test_exists_returns_plan(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db)
        loaded = plan_validator.validate_plan_exists(plan.id)
        assert loaded is not None
        assert loaded.id == plan.id

    def test_not_found_raises(self, plan_validator):
        with pytest.raises(PlanNotFound):
            plan_validator.validate_plan_exists(uuid.uuid4())


class TestPlanValidatorValidateTransition:
    def test_valid_transition_ok(self, db, plan_validator):
        """DRAFT → UNDER_REVIEW is a valid transition with items."""
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanItemFactory.create(db, plan_id=plan.id)
        db.refresh(plan)
        plan_validator.validate_transition(
            plan, TreatmentPlanStatus.UNDER_REVIEW
        )  # no raise

    def test_invalid_transition_raises(self, db, plan_validator):
        """DRAFT → COMPLETED is not valid (even with items)."""
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanItemFactory.create(db, plan_id=plan.id)
        db.refresh(plan)
        with pytest.raises(InvalidPlanOperation):
            plan_validator.validate_transition(
                plan, TreatmentPlanStatus.COMPLETED
            )

    def test_transition_to_same_status_raises(self, db, plan_validator):
        """DRAFT → DRAFT should not be allowed."""
        plan = TreatmentPlanFactory.create(db)
        with pytest.raises(InvalidPlanOperation):
            plan_validator.validate_transition(
                plan, TreatmentPlanStatus.DRAFT
            )

    def test_transition_requiring_items_empty_raises(self, db, plan_validator):
        """DRAFT → UNDER_REVIEW requires at least 1 item."""
        plan = TreatmentPlanFactory.create(db, items=[])
        with pytest.raises(InvalidPlanOperation, match="no items"):
            plan_validator.validate_transition(
                plan, TreatmentPlanStatus.UNDER_REVIEW
            )

    def test_transition_to_in_progress_requires_items(self, db, plan_validator):
        """ACCEPTED → IN_PROGRESS requires at least 1 item."""
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.ACCEPTED)
        with pytest.raises(InvalidPlanOperation, match="no items"):
            plan_validator.validate_transition(
                plan, TreatmentPlanStatus.IN_PROGRESS
            )


class TestPlanValidatorValidateCancellable:
    def test_draft_cancellable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        plan_validator.validate_cancellable(plan)  # no raise

    def test_completed_not_cancellable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.COMPLETED)
        with pytest.raises(InvalidPlanOperation, match="terminal"):
            plan_validator.validate_cancellable(plan)

    def test_cancelled_not_cancellable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.CANCELLED)
        with pytest.raises(InvalidPlanOperation, match="terminal"):
            plan_validator.validate_cancellable(plan)


class TestPlanValidatorValidateEditable:
    def test_draft_editable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        plan_validator.validate_editable(plan)  # no raise

    def test_proposed_editable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        plan_validator.validate_editable(plan)  # no raise

    def test_accepted_not_editable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.ACCEPTED)
        with pytest.raises(PlanNotEditable):
            plan_validator.validate_editable(plan)

    def test_in_progress_not_editable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.IN_PROGRESS)
        with pytest.raises(PlanNotEditable):
            plan_validator.validate_editable(plan)

    def test_completed_not_editable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.COMPLETED)
        with pytest.raises(PlanNotEditable):
            plan_validator.validate_editable(plan)

    def test_cancelled_not_editable(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.CANCELLED)
        with pytest.raises(PlanNotEditable):
            plan_validator.validate_editable(plan)


class TestPlanValidatorValidateProcedureExists:
    def test_active_procedure_ok(self, db, plan_validator):
        proc = ProcedureFactory.create(db, is_active=True)
        plan_validator.validate_procedure_exists(proc.id)  # no raise

    def test_inactive_procedure_raises(self, db, plan_validator):
        proc = ProcedureFactory.create(db, is_active=False)
        with pytest.raises(InvalidPlanOperation, match="inactive"):
            plan_validator.validate_procedure_exists(proc.id)

    def test_nonexistent_procedure_raises(self, db, plan_validator):
        with pytest.raises(ProcedureNotFound):
            plan_validator.validate_procedure_exists(99999)


class TestPlanValidatorValidateItemSequence:
    def test_unique_sequence_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        item = MagicMock()
        item.sequence_number = 1
        plan.items = [item]
        plan_validator.validate_item_sequence(plan, 2)  # no raise

    def test_duplicate_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        item = MagicMock()
        item.sequence_number = 1
        plan.items = [item]
        with pytest.raises(DuplicateItemSequence):
            plan_validator.validate_item_sequence(plan, 1)

    def test_duplicate_excluded_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        existing = MagicMock()
        existing.id = uuid.uuid4()
        existing.sequence_number = 1
        plan.items = [existing]
        plan_validator.validate_item_sequence(
            plan, 1, exclude_item_id=existing.id
        )  # no raise


class TestPlanValidatorValidatePlanHasItems:
    def test_has_items_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.items = [MagicMock()]
        plan_validator.validate_plan_has_items(plan)  # no raise

    def test_no_items_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.items = []
        with pytest.raises(InvalidPlanOperation, match="no items"):
            plan_validator.validate_plan_has_items(plan)


class TestPlanValidatorValidateItemTransition:
    def test_valid_item_transition_ok(self, plan_validator):
        plan_validator.validate_item_transition(
            TreatmentPlanItemStatus.PENDING,
            TreatmentPlanItemStatus.IN_PROGRESS,
        )  # no raise

    def test_invalid_item_transition_raises(self, plan_validator):
        with pytest.raises(InvalidItemStatusTransition):
            plan_validator.validate_item_transition(
                TreatmentPlanItemStatus.PENDING,
                TreatmentPlanItemStatus.COMPLETED,
            )


# ======================================================================
# TreatmentPlanValidator — field-level validators (pure)
# ======================================================================


class TestPlanValidatorValidateDateRange:
    def test_valid_range_ok(self, plan_validator):
        plan_validator.validate_date_range(date(2025, 1, 1), date(2025, 12, 31))

    def test_same_date_ok(self, plan_validator):
        plan_validator.validate_date_range(date(2025, 6, 1), date(2025, 6, 1))

    def test_invalid_range_raises(self, plan_validator):
        with pytest.raises(InvalidDateRange):
            plan_validator.validate_date_range(date(2025, 12, 31), date(2025, 1, 1))

    def test_no_dates_ok(self, plan_validator):
        plan_validator.validate_date_range(None, None)

    def test_only_from_ok(self, plan_validator):
        plan_validator.validate_date_range(date(2025, 1, 1), None)

    def test_only_to_ok(self, plan_validator):
        plan_validator.validate_date_range(None, date(2025, 12, 31))


class TestPlanValidatorValidateToothNumber:
    def test_none_ok(self, plan_validator):
        plan_validator.validate_tooth_number(None)

    def test_valid_permanent_min(self, plan_validator):
        plan_validator.validate_tooth_number(11)

    def test_valid_permanent_max(self, plan_validator):
        plan_validator.validate_tooth_number(48)

    def test_valid_primary_min(self, plan_validator):
        plan_validator.validate_tooth_number(51)

    def test_valid_primary_max(self, plan_validator):
        plan_validator.validate_tooth_number(85)

    def test_below_range_raises(self, plan_validator):
        with pytest.raises(InvalidToothNumber):
            plan_validator.validate_tooth_number(10)

    def test_gap_range_raises(self, plan_validator):
        with pytest.raises(InvalidToothNumber):
            plan_validator.validate_tooth_number(49)

    def test_above_range_raises(self, plan_validator):
        with pytest.raises(InvalidToothNumber):
            plan_validator.validate_tooth_number(86)

    def test_zero_raises(self, plan_validator):
        with pytest.raises(InvalidToothNumber):
            plan_validator.validate_tooth_number(0)

    def test_non_int_raises(self, plan_validator):
        with pytest.raises(InvalidToothNumber):
            plan_validator.validate_tooth_number("abc")  # type: ignore[arg-type]


class TestPlanValidatorValidateItemCost:
    def test_valid_cost_ok(self, plan_validator):
        plan_validator.validate_item_cost(Decimal("100.00"))

    def test_zero_cost_ok(self, plan_validator):
        plan_validator.validate_item_cost(Decimal("0.00"))

    def test_negative_raises(self, plan_validator):
        with pytest.raises(PlanValidationFailed, match="must be >= 0"):
            plan_validator.validate_item_cost(Decimal("-1.00"))

    def test_exceeds_max_raises(self, plan_validator):
        with pytest.raises(PlanValidationFailed, match="must be <= 999999.99"):
            plan_validator.validate_item_cost(Decimal("1000000.00"))


class TestPlanValidatorValidateDiscount:
    def test_zero_discount_ok(self, plan_validator):
        plan_validator.validate_discount(Decimal("0.00"))

    def test_valid_discount_ok(self, plan_validator):
        plan_validator.validate_discount(Decimal("50.00"), estimated_cost=Decimal("100.00"))

    def test_discount_exceeds_cost_raises(self, plan_validator):
        with pytest.raises(PlanValidationFailed, match="exceeds"):
            plan_validator.validate_discount(Decimal("150.00"), estimated_cost=Decimal("100.00"))

    def test_discount_equal_to_cost_ok(self, plan_validator):
        plan_validator.validate_discount(Decimal("100.00"), estimated_cost=Decimal("100.00"))

    def test_negative_discount_raises(self, plan_validator):
        with pytest.raises(PlanValidationFailed, match="must be >= 0"):
            plan_validator.validate_discount(Decimal("-10.00"))

    def test_discount_without_estimated_cost_ok(self, plan_validator):
        plan_validator.validate_discount(Decimal("100.00"))  # no cost comparison, passes


class TestPlanValidatorValidateChangeReason:
    def test_valid_reason_ok(self, plan_validator):
        plan_validator.validate_change_reason("Cost adjustment after consultation")

    def test_empty_reason_raises(self, plan_validator):
        with pytest.raises(PlanValidationFailed, match="required"):
            plan_validator.validate_change_reason("")

    def test_whitespace_only_raises(self, plan_validator):
        with pytest.raises(PlanValidationFailed, match="required"):
            plan_validator.validate_change_reason("   ")

    def test_reason_too_long_raises(self, plan_validator):
        long_reason = "a" * 501
        with pytest.raises(PlanValidationFailed, match="at most"):
            plan_validator.validate_change_reason(long_reason)

    def test_reason_at_max_length_ok(self, plan_validator):
        reason = "a" * 500
        plan_validator.validate_change_reason(reason)  # no raise


# ======================================================================
# TreatmentPlanValidator — approval & acknowledgment
# ======================================================================


class TestPlanValidatorValidateCanApprove:
    def test_proposed_not_approved_ok(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        plan_validator.validate_can_approve(plan)  # no raise

    def test_non_proposed_raises(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        with pytest.raises(InvalidPlanOperation, match="proposed"):
            plan_validator.validate_can_approve(plan)

    def test_already_approved_raises(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(db, plan_id=plan.id, approved_by=1)
        # Refresh to load the approval relationship
        db.refresh(plan)
        with pytest.raises(PlanAlreadyApproved):
            plan_validator.validate_can_approve(plan)


class TestPlanValidatorValidateCanAcknowledge:
    def test_proposed_approved_not_acknowledged_ok(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(
            db, plan_id=plan.id, approved_by=1,
            patient_status=PatientAcknowledgmentStatus.PENDING,
        )
        db.refresh(plan)
        plan_validator.validate_can_acknowledge(plan)  # no raise

    def test_non_proposed_raises(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.DRAFT)
        with pytest.raises(InvalidPlanOperation, match="proposed"):
            plan_validator.validate_can_acknowledge(plan)

    def test_doctor_not_approved_raises(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(db, plan_id=plan.id, approved_by=None)
        db.refresh(plan)
        with pytest.raises(InvalidPlanOperation, match="not approved"):
            plan_validator.validate_can_acknowledge(plan)

    def test_already_acknowledged_raises(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(
            db, plan_id=plan.id, approved_by=1,
            patient_status=PatientAcknowledgmentStatus.ACCEPTED,
        )
        db.refresh(plan)
        with pytest.raises(PatientAcknowledgmentExists):
            plan_validator.validate_can_acknowledge(plan)

    def test_already_rejected_raises(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, status=TreatmentPlanStatus.PROPOSED)
        TreatmentPlanApprovalFactory.create(
            db, plan_id=plan.id, approved_by=1,
            patient_status=PatientAcknowledgmentStatus.REJECTED,
        )
        db.refresh(plan)
        with pytest.raises(PatientAcknowledgmentExists):
            plan_validator.validate_can_acknowledge(plan)


# ======================================================================
# TreatmentPlanValidator — deletion & code uniqueness
# ======================================================================


class TestPlanValidatorValidateDeletable:
    def test_draft_deletable(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.status = TreatmentPlanStatus.DRAFT
        plan.id = uuid.uuid4()
        plan_validator.validate_deletable(plan)  # no raise

    def test_proposed_not_deletable(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.status = TreatmentPlanStatus.PROPOSED
        plan.id = uuid.uuid4()
        with pytest.raises(PlanNotDeletable):
            plan_validator.validate_deletable(plan)

    def test_accepted_not_deletable(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.status = TreatmentPlanStatus.ACCEPTED
        plan.id = uuid.uuid4()
        with pytest.raises(PlanNotDeletable):
            plan_validator.validate_deletable(plan)

    def test_completed_not_deletable(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.status = TreatmentPlanStatus.COMPLETED
        plan.id = uuid.uuid4()
        with pytest.raises(PlanNotDeletable):
            plan_validator.validate_deletable(plan)


class TestPlanValidatorValidatePlanCodeUnique:
    def test_unique_code_ok(self, db, plan_validator):
        plan_validator.validate_plan_code_unique("TXN-UNIQUE")  # no raise

    def test_duplicate_raises(self, db, plan_validator):
        TreatmentPlanFactory.create(db, plan_code="TXN-DUP")
        with pytest.raises(DuplicatePlanDetected):
            plan_validator.validate_plan_code_unique("TXN-DUP")

    def test_exclude_own_code_ok(self, db, plan_validator):
        plan = TreatmentPlanFactory.create(db, plan_code="TXN-MYCODE")
        plan_validator.validate_plan_code_unique(
            "TXN-MYCODE", exclude_plan_id=plan.id
        )  # no raise


# ======================================================================
# TreatmentPlanValidator — status guard helpers
# ======================================================================


class TestPlanValidatorStatusGuards:
    def test_validate_status_is_match_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.status = TreatmentPlanStatus.DRAFT
        plan_validator.validate_status_is(plan, TreatmentPlanStatus.DRAFT)  # no raise

    def test_validate_status_is_mismatch_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.status = TreatmentPlanStatus.DRAFT
        with pytest.raises(InvalidPlanOperation):
            plan_validator.validate_status_is(plan, TreatmentPlanStatus.PROPOSED)

    def test_not_already_approved_none_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.approval = None
        plan_validator.validate_not_already_approved(plan)  # no raise

    def test_not_already_approved_pending_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        approval = MagicMock()
        approval.approved_by = None
        plan.approval = approval
        plan_validator.validate_not_already_approved(plan)  # no raise

    def test_not_already_approved_signed_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        approval = MagicMock()
        approval.approved_by = 1
        plan.approval = approval
        with pytest.raises(PlanAlreadyApproved):
            plan_validator.validate_not_already_approved(plan)

    def test_doctor_approved_none_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        plan.approval = None
        with pytest.raises(InvalidPlanOperation, match="not approved"):
            plan_validator.validate_doctor_approved(plan)

    def test_doctor_approved_unsigned_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        approval = MagicMock()
        approval.approved_by = None
        plan.approval = approval
        with pytest.raises(InvalidPlanOperation, match="not approved"):
            plan_validator.validate_doctor_approved(plan)

    def test_doctor_approved_signed_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        approval = MagicMock()
        approval.approved_by = 1
        plan.approval = approval
        plan_validator.validate_doctor_approved(plan)  # no raise

    def test_not_already_acknowledged_pending_ok(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        approval = MagicMock()
        approval.patient_status = PatientAcknowledgmentStatus.PENDING
        plan.approval = approval
        plan_validator.validate_not_already_acknowledged(plan)  # no raise

    def test_not_already_acknowledged_accepted_raises(self, plan_validator):
        plan = MagicMock(spec=TreatmentPlan)
        approval = MagicMock()
        approval.patient_status = PatientAcknowledgmentStatus.ACCEPTED
        plan.approval = approval
        with pytest.raises(PatientAcknowledgmentExists):
            plan_validator.validate_not_already_acknowledged(plan)

    def test_not_already_acknowledged_none_ok(self, plan_validator):
        """When plan.approval is None, PENDING is the default — acknowledgment is ok."""
        plan = MagicMock(spec=TreatmentPlan)
        plan.approval = None
        plan_validator.validate_not_already_acknowledged(plan)  # no raise — short-circuits on None
