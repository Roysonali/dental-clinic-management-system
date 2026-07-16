"""TreatmentPlanValidator — aggregate business validation for Treatment Plans.

Responsibilities
----------------
* **Plan lifecycle**: creation fields, status transitions, cancellation, deletion.
* **Item management**: edit-permission checks, procedure existence, sequence uniqueness.
* **Versioning**: snapshot-required detection, change-reason validation.
* **Doctor approval**: readiness checks (PROPOSED status, not already approved).
* **Patient acknowledgment**: readiness checks (PROPOSED + approved, not already acknowledged).
* **Edit permissions**: editable-state guard for direct modifications.
* **Deletion rules**: only Draft plans may be hard-deleted.

Design
------
* **Read-only repositories**: ``TreatmentPlanRepository`` + ``ProcedureRepository``
  injected as constructor dependencies, used exclusively for lookups.
* **State machine delegation**: all transition legality checks are forwarded to
  ``validate_plan_transition`` / ``validate_item_transition`` in
  ``state_machine.py`` — never duplicated here.
* **Approved exceptions only**: raises ``PlanNotFound``, ``PlanNotEditable``,
  ``PlanNotDeletable``, ``PlanAlreadyApproved``, ``PatientAcknowledgmentExists``,
  ``DuplicateItemSequence``, ``ProcedureNotFound``, ``InvalidPlanOperation``,
  ``InvalidDateRange``, ``PlanValidationFailed``.
* **Composable**: the service layer calls each validator in the order it needs.

Integration example::

    validator = TreatmentPlanValidator(plan_repo, procedure_repo)

    # Before adding an item to a plan
    plan = plan_repo.get_by_id(plan_id)
    validator.validate_editable(plan)
    validator.validate_procedure_exists(procedure_id)

    # Before transitioning status
    validator.validate_transition(plan, TreatmentPlanStatus.UNDER_REVIEW)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from app.modules.treatment.constants import (
    CHANGE_REASON_MAX_LENGTH,
    FDI_PERMANENT_MAX,
    FDI_PERMANENT_MIN,
    FDI_PRIMARY_MAX,
    FDI_PRIMARY_MIN,
    MAX_ESTIMATED_COST,
    MIN_ESTIMATED_COST,
    MIN_PLAN_ITEMS_FOR_SUBMISSION,
)
from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.exceptions import (
    DuplicateItemSequence,
    DuplicatePlanDetected,
    InvalidDateRange,
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
from app.modules.treatment.models import (
    TreatmentPlan,
)
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)
from app.modules.treatment.validators.state_machine import (
    is_editable_state,
    validate_item_transition,
    validate_plan_transition,
)


class TreatmentPlanValidator:
    """Aggregate business rule validator for the Treatment Plan module.

    Args:
        plan_repo: Read-only ``TreatmentPlanRepository`` for plan existence,
            approval, and version lookups.
        procedure_repo: Read-only ``ProcedureRepository`` for procedure
            existence checks.
    """

    def __init__(
        self,
        plan_repo: TreatmentPlanRepository,
        procedure_repo: ProcedureRepository,
    ) -> None:
        self._plan_repo = plan_repo
        self._procedure_repo = procedure_repo

    # ==================================================================
    # Plan lifecycle
    # ==================================================================

    def validate_plan_exists(self, plan_id: UUID) -> TreatmentPlan:
        """Fetch a plan by id and raise ``PlanNotFound`` if missing.

        Returns the loaded plan so the service can reuse it.
        """
        plan = self._plan_repo.get_by_id(plan_id)
        if plan is None:
            raise PlanNotFound(plan_id)
        return plan

    def validate_transition(
        self,
        plan: TreatmentPlan,
        new_status: TreatmentPlanStatus | str,
    ) -> None:
        """Validate that ``plan`` may transition to ``new_status``.

        Orchestrates:
        1. ``state_machine.validate_plan_transition`` — pure transition
           legality check (is the target status in the allowed set?).
        2. ``validate_plan_has_items`` — business-condition check for
           transitions that require items (Draft → UnderReview, Accept → InProgress).

        Future transition-specific business rules should be added here
        as additional validation steps.

        Raises:
            InvalidPlanOperation: If the transition is not allowed per the
                state machine, or if business conditions are not met.
        """
        validate_plan_transition(
            current_status=plan.status,
            new_status=new_status,
        )

        # Business-policy checks for transitions that need items.
        # Normalise to enum so comparison works regardless of input type.
        target = (
            new_status
            if isinstance(new_status, TreatmentPlanStatus)
            else TreatmentPlanStatus(new_status)
        )
        if target in (
            TreatmentPlanStatus.UNDER_REVIEW,
            TreatmentPlanStatus.IN_PROGRESS,
        ):
            self.validate_plan_has_items(plan)

    def validate_cancellable(self, plan: TreatmentPlan) -> None:
        """Validate that a plan can be cancelled from its current status.

        Cancellation is allowed from any non-terminal status. Terminal
        statuses (COMPLETED, CANCELLED) have no outgoing transitions.

        Raises:
            InvalidPlanOperation: If the plan is already in a terminal state.
        """
        if plan.status.is_terminal():
            raise InvalidPlanOperation(
                f"Cannot cancel plan in '{plan.status.value}' status. "
                f"Plan is already in a terminal state.",
                details={
                    "plan_id": str(plan.id),
                    "current_status": plan.status.value,
                },
            )

    # ==================================================================
    # Item management
    # ==================================================================

    def validate_editable(self, plan: TreatmentPlan) -> None:
        """Validate that ``plan`` may be edited **without versioning**.

        Only plans in ``DRAFT``, ``UNDER_REVIEW``, or ``PROPOSED`` support
        direct edits (add/remove/update items without a version snapshot).

        Raises:
            PlanNotEditable: If the plan is in a non-editable status.
        """
        if not is_editable_state(plan.status):
            raise PlanNotEditable(
                plan_id=plan.id,
                status=plan.status.value,
            )

    def validate_procedure_exists(self, procedure_id: int) -> None:
        """Validate that a procedure with ``procedure_id`` exists and is active.

        Raises:
            ProcedureNotFound: If the procedure is missing or inactive.
        """
        procedure = self._procedure_repo.get_active_by_id(procedure_id)
        if procedure is None:
            # Try to distinguish "not found" from "inactive".
            exists = self._procedure_repo.exists(procedure_id)
            if not exists:
                raise ProcedureNotFound(procedure_id)
            raise InvalidPlanOperation(
                f"Procedure {procedure_id} exists but is inactive. "
                f"Active procedures are required for plan items.",
                details={"procedure_id": procedure_id},
            )

    def validate_item_sequence(
        self,
        plan: TreatmentPlan,
        sequence_number: int,
        exclude_item_id: UUID | None = None,
    ) -> None:
        """Validate that ``sequence_number`` is unique within the plan's items.

        Accepts the already-loaded ``TreatmentPlan`` to avoid a redundant
        SELECT. Iterates the in-memory ``items`` collection (which is
        ``lazy="selectin"`` by default, so already loaded when the plan was
        fetched).

        Args:
            plan: The already-loaded treatment plan.
            sequence_number: The proposed sequence number.
            exclude_item_id: Optional item id to exclude (for updates).

        Raises:
            DuplicateItemSequence: If another item already has this sequence
                number and is not the excluded item.
        """
        for item in plan.items:
            if item.sequence_number == sequence_number:
                if exclude_item_id is not None and item.id == exclude_item_id:
                    continue
                raise DuplicateItemSequence(
                    plan_id=plan.id,
                    sequence=sequence_number,
                )

    def validate_plan_has_items(self, plan: TreatmentPlan) -> None:
        """Validate that ``plan`` has at least one item.

        Raises:
            InvalidPlanOperation: If the plan has no items.
        """
        if len(plan.items) < MIN_PLAN_ITEMS_FOR_SUBMISSION:
            raise InvalidPlanOperation(
                f"Plan has no items. "
                f"At least {MIN_PLAN_ITEMS_FOR_SUBMISSION} procedure item "
                f"is required.",
                details={
                    "plan_id": str(plan.id),
                    "item_count": len(plan.items),
                    "required": MIN_PLAN_ITEMS_FOR_SUBMISSION,
                },
            )

    def validate_item_transition(
        self,
        current_status: TreatmentPlanItemStatus | str,
        new_status: TreatmentPlanItemStatus | str,
    ) -> None:
        """Validate an item status transition.

        Delegates to ``state_machine.validate_item_transition``.
        """
        validate_item_transition(
            current_status=current_status,
            new_status=new_status,
        )

    # ==================================================================
    # Field-level validators (pure, no repository needed)
    # ==================================================================

    def validate_date_range(
        self,
        valid_from: date | None,
        valid_to: date | None,
    ) -> None:
        """Validate that ``valid_from`` precedes or equals ``valid_to``.

        Raises:
            InvalidDateRange: If both dates are provided and ``valid_from``
                is after ``valid_to``.
        """
        if valid_from is not None and valid_to is not None:
            if valid_from > valid_to:
                raise InvalidDateRange(
                    valid_from=valid_from,
                    valid_to=valid_to,
                )

    def validate_tooth_number(self, tooth_number: int | None) -> None:
        """Validate an FDI two-digit tooth number.

        Valid ranges:
            - Permanent: 11–48 (quadrants 1–4)
            - Primary: 51–85 (quadrants 5–8)

        Returns ``None`` if input is ``None`` (tooth number is optional).

        Raises:
            InvalidToothNumber: If the tooth number is outside valid ranges.
        """
        if tooth_number is None:
            return

        if not isinstance(tooth_number, int):
            raise InvalidToothNumber(
                tooth_number=tooth_number,
                details={"received_type": type(tooth_number).__name__},
            )

        if (
            FDI_PERMANENT_MIN <= tooth_number <= FDI_PERMANENT_MAX
        ) or (
            FDI_PRIMARY_MIN <= tooth_number <= FDI_PRIMARY_MAX
        ):
            return

        raise InvalidToothNumber(tooth_number=tooth_number)

    def validate_item_cost(self, cost: Decimal) -> None:
        """Validate item estimated cost is within ``[MIN_ESTIMATED_COST, MAX_ESTIMATED_COST]``.

        Raises:
            PlanValidationFailed: If cost is invalid or out of range.
        """
        try:
            cost = Decimal(str(cost))
        except (ValueError, TypeError, ArithmeticError):
            raise PlanValidationFailed(
                f"Invalid item cost: {cost!r}. Must be a decimal number.",
                details={"cost": str(cost)},
            )

        if cost < MIN_ESTIMATED_COST:
            raise PlanValidationFailed(
                f"Item cost must be >= {MIN_ESTIMATED_COST}. Got {cost}.",
                details={"cost": str(cost), "min": str(MIN_ESTIMATED_COST)},
            )

        if cost > MAX_ESTIMATED_COST:
            raise PlanValidationFailed(
                f"Item cost must be <= {MAX_ESTIMATED_COST}. Got {cost}.",
                details={"cost": str(cost), "max": str(MAX_ESTIMATED_COST)},
            )

    def validate_discount(
        self,
        discount: Decimal,
        estimated_cost: Decimal | None = None,
    ) -> None:
        """Validate item discount is non-negative and optionally <= estimated cost.

        Args:
            discount: The discount amount to validate.
            estimated_cost: Optional. When provided, validates that the
                discount does not exceed the estimated cost. This check is
                also enforced at the DB level via the ``ck_tpi_discount_le_cost``
                CHECK constraint.

        Raises:
            PlanValidationFailed: If discount is negative, or if
                ``estimated_cost`` is provided and discount exceeds it.
        """
        try:
            discount = Decimal(str(discount))
        except (ValueError, TypeError, ArithmeticError):
            raise PlanValidationFailed(
                f"Invalid discount: {discount!r}. Must be a decimal number.",
                details={"discount": str(discount)},
            )

        if discount < MIN_ESTIMATED_COST:
            raise PlanValidationFailed(
                f"Discount must be >= {MIN_ESTIMATED_COST}. Got {discount}.",
                details={"discount": str(discount), "min": str(MIN_ESTIMATED_COST)},
            )

        if estimated_cost is not None and discount > Decimal(str(estimated_cost)):
            raise PlanValidationFailed(
                f"Discount ({discount}) exceeds estimated cost ({estimated_cost}).",
                details={
                    "discount": str(discount),
                    "estimated_cost": str(estimated_cost),
                },
            )

    # ==================================================================
    # Versioning
    # ==================================================================

    def validate_change_reason(self, reason: str) -> None:
        """Validate version change reason is non-empty and within max length.

        Raises:
            PlanValidationFailed: If reason is empty or exceeds max length.
        """
        if not isinstance(reason, str) or not reason.strip():
            raise PlanValidationFailed(
                "Change reason is required for version creation.",
                details={"reason": reason},
            )

        reason = reason.strip()
        if len(reason) > CHANGE_REASON_MAX_LENGTH:
            raise PlanValidationFailed(
                f"Change reason must be at most {CHANGE_REASON_MAX_LENGTH} "
                f"characters. Got {len(reason)}.",
                details={
                    "reason": reason,
                    "length": len(reason),
                    "max_length": CHANGE_REASON_MAX_LENGTH,
                },
            )

    # ==================================================================
    # Doctor approval
    # ==================================================================

    # ==================================================================
    # Status guard helpers (reusable by approval / acknowledgment)
    # ==================================================================

    def validate_status_is(self, plan: TreatmentPlan, expected: TreatmentPlanStatus) -> None:
        """Raise ``InvalidPlanOperation`` if ``plan.status != expected``."""
        if plan.status != expected:
            raise InvalidPlanOperation(
                f"Expected plan to be in '{expected.value}' status, "
                f"but it is '{plan.status.value}'.",
                details={
                    "plan_id": str(plan.id),
                    "current_status": plan.status.value,
                    "expected_status": expected.value,
                },
            )

    def validate_not_already_approved(self, plan: TreatmentPlan) -> None:
        """Raise ``PlanAlreadyApproved`` if the plan already has a doctor signature."""
        if plan.approval is not None and plan.approval.approved_by is not None:
            raise PlanAlreadyApproved(plan_id=plan.id)

    def validate_doctor_approved(self, plan: TreatmentPlan) -> None:
        """Raise ``InvalidPlanOperation`` if the doctor has not approved yet."""
        if plan.approval is None or plan.approval.approved_by is None:
            raise InvalidPlanOperation(
                f"Doctor has not approved plan {plan.id} yet. "
                f"Doctor approval is required before patient acknowledgment.",
                details={
                    "plan_id": str(plan.id),
                    "has_approval_record": plan.approval is not None,
                },
            )

    def validate_not_already_acknowledged(self, plan: TreatmentPlan) -> None:
        """Raise ``PatientAcknowledgmentExists`` if the patient already acknowledged."""
        if plan.approval is not None and plan.approval.patient_status != PatientAcknowledgmentStatus.PENDING:
            raise PatientAcknowledgmentExists(plan_id=plan.id)

    # ==================================================================
    # Doctor approval
    # ==================================================================

    def validate_can_approve(self, plan: TreatmentPlan) -> None:
        """Validate that ``plan`` is ready for doctor approval.

        Checks:
        1. Plan is in ``PROPOSED`` status.
        2. Plan has not already been approved.

        The service layer is responsible for loading the plan before calling
        this method, avoiding a duplicate SELECT.

        Raises:
            InvalidPlanOperation: If the plan is not in PROPOSED status.
            PlanAlreadyApproved: If the plan already has a doctor's approval.
        """
        self.validate_status_is(plan, TreatmentPlanStatus.PROPOSED)
        self.validate_not_already_approved(plan)

    # ==================================================================
    # Patient acknowledgment
    # ==================================================================

    def validate_can_acknowledge(self, plan: TreatmentPlan) -> None:
        """Validate that ``plan`` is ready for patient acknowledgment.

        Checks:
        1. Plan is in ``PROPOSED`` status.
        2. Doctor approval has been recorded.
        3. Patient has not already acknowledged.

        The service layer is responsible for loading the plan before calling
        this method, avoiding a duplicate SELECT.

        Raises:
            InvalidPlanOperation: If the plan is not in PROPOSED status or
                the doctor has not approved yet.
            PatientAcknowledgmentExists: If the patient already acknowledged.
        """
        self.validate_status_is(plan, TreatmentPlanStatus.PROPOSED)
        self.validate_doctor_approved(plan)
        self.validate_not_already_acknowledged(plan)

    # ==================================================================
    # Deletion rules
    # ==================================================================

    def validate_deletable(self, plan: TreatmentPlan) -> None:
        """Validate that a plan may be hard-deleted.

        Only plans in ``DRAFT`` status can be deleted. For all other statuses,
        use ``deactivate`` (soft archive).

        Raises:
            PlanNotDeletable: If the plan is not in DRAFT status.
        """
        if plan.status != TreatmentPlanStatus.DRAFT:
            raise PlanNotDeletable(
                plan_id=plan.id,
                status=plan.status.value,
            )

    # ==================================================================
    # Plan code validation
    # ==================================================================

    def validate_plan_code_unique(
        self,
        plan_code: str,
        exclude_plan_id: UUID | None = None,
    ) -> None:
        """Validate that ``plan_code`` is unique across all plans.

        Args:
            plan_code: The plan code to check.
            exclude_plan_id: Optional plan id to exclude (for updates).

        Raises:
            DuplicatePlanDetected: If another plan already has this code.
        """
        existing = self._plan_repo.get_by_plan_code(plan_code)
        if existing is not None and existing.id != exclude_plan_id:
            raise DuplicatePlanDetected(
                details={
                    "plan_code": plan_code,
                    "existing_plan_id": str(existing.id),
                },
            )
