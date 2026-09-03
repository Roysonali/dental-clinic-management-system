"""TreatmentPlanService — service-layer orchestrator for the Treatment Plan aggregate.

Responsibilities
----------------
* **Transaction ownership**: commits on success, rolls back on failure.
* **Orchestration**: coordinates ``TreatmentPlanRepository``, ``ProcedureRepository``,
  ``TreatmentPlanValidator``, ``ProcedureValidator``, and the state machine.
* **Logging**: infrastructure-level and business-event logging.

Ownership boundaries
--------------------
+---------------------------+-----------------------------------+
| Owned by service          | Owned by validator / repo         |
+===========================+===================================+
| Transaction (commit /     | Business validation               |
| rollback)                 | (TreatmentPlanValidator /         |
|                           |  ProcedureValidator)              |
+---------------------------+-----------------------------------+
| Orchestration             | Transition legality               |
|                           | (state_machine.py)                |
+---------------------------+-----------------------------------+
| Logging                   | Persistence                       |
|                           | (TreatmentPlanRepository /        |
|                           |  ProcedureRepository)             |
+---------------------------+-----------------------------------+
| Version snapshot          | SQL                               |
| generation                |                                   |
+---------------------------+-----------------------------------+
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.doctors.models import Doctor
from app.modules.doctors.exceptions import DoctorNotFound
from app.modules.patients.models import Patient
from app.modules.patients.exceptions import PatientNotFound
from app.modules.treatment.constants import (
    DEFAULT_PAGE_SIZE,
    INITIAL_VERSION_NUMBER,
    TREATMENT_PLAN_CODE_PREFIX,
    TREATMENT_PLAN_CODE_SEQUENCE_WIDTH,
    TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT,
)
from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.exceptions import (
    ItemNotFound,
    PlanCreationFailed,
    PlanNotFound,
    PlanUpdateFailed,
    VersionNotFound,
)
from app.modules.treatment.models import (
    TreatmentPlan,
    TreatmentPlanApproval,
    TreatmentPlanItem,
    TreatmentPlanVersion,
)
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)
from app.modules.treatment.validators import (
    ProcedureValidator,
    TreatmentPlanValidator,
)

logger = logging.getLogger(__name__)

# Sentinel used to distinguish "not provided" from "explicitly set to None"
# in ``update_item()`` for nullable fields (tooth_number, tooth_surface,
# quadrant, arch).
_UNSET = object()


class TreatmentPlanService:
    """Service-layer orchestrator for the Treatment Plan aggregate.

    Args:
        plan_repo: The ``TreatmentPlanRepository`` instance for plan
            aggregate persistence.
        procedure_repo: The ``ProcedureRepository`` instance for procedure
            catalog lookups.
        plan_validator: The ``TreatmentPlanValidator`` instance for plan
            business validation.
        procedure_validator: The ``ProcedureValidator`` instance for
            procedure business validation.
        db: The active SQLAlchemy ``Session`` (injected by the router / DI
            layer). The service owns commit and rollback on this session.
    """

    def __init__(
        self,
        plan_repo: TreatmentPlanRepository,
        procedure_repo: ProcedureRepository,
        plan_validator: TreatmentPlanValidator,
        procedure_validator: ProcedureValidator,
        db: Session,
    ) -> None:
        self._plan_repo = plan_repo
        self._procedure_repo = procedure_repo
        self._plan_validator = plan_validator
        self._procedure_validator = procedure_validator
        self._db = db

    # ==================================================================
    # Transaction helpers
    # ==================================================================

    def _commit(self) -> None:
        """Commit the current transaction.

        Rolls back on any ``IntegrityError`` or ``SQLAlchemyError`` and
        re-raises the original exception so the caller never sees stale
        transaction state.

        Raises:
            The original exception after rollback; the wrapping business
            method should catch and translate it to a domain exception.
        """
        try:
            self._db.commit()
        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception("Database error during commit — transaction rolled back")
            raise

    # ==================================================================
    # Plan code generation
    # ==================================================================

    def _generate_plan_code(self) -> str:
        """Generate a unique treatment plan code in ``TXN-XXXXXX`` format.

        Queries the database for the highest existing plan code matching
        the ``TXN-`` prefix and increments the sequence. Falls back to 1
        if no plans exist yet. Concurrency safety is provided by the
        unique constraint on ``plan_code`` in the database — any
        duplicate-key violation triggers an ``IntegrityError`` that
        propagates to the caller.

        Returns:
            A string like ``"TXN-000001"``.
        """
        prefix_pattern = f"{TREATMENT_PLAN_CODE_PREFIX}-%"
        stmt = (
            select(TreatmentPlan.plan_code)
            .where(TreatmentPlan.plan_code.like(prefix_pattern))
            .order_by(TreatmentPlan.plan_code.desc())
            .limit(1)
        )
        latest: str | None = self._db.execute(stmt).scalar_one_or_none()
        if latest:
            try:
                seq = int(latest.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        seqstr = str(seq).zfill(TREATMENT_PLAN_CODE_SEQUENCE_WIDTH)
        return f"{TREATMENT_PLAN_CODE_PREFIX}-{seqstr}"

    # ==================================================================
    # Create Plan
    # ==================================================================

    def create_plan(
        self,
        patient_id: UUID,
        doctor_id: UUID,
        created_by: int,
        *,
        clinical_notes: str | None = None,
        observations: str | None = None,
        dentist_recommendations: str | None = None,
        valid_from: date | None = None,
        valid_to: date | None = None,
        plan_code: str | None = None,
        change_reason: str = "Initial plan creation",
    ) -> TreatmentPlan:
        """Create a new treatment plan in Draft status.

        Full workflow:
        1. Validate patient and doctor exist (existing module lookups).
        2. Validate date range (if both provided).
        3. Validate plan code uniqueness (if provided) or generate one.
        4. Construct the ``TreatmentPlan`` aggregate root.
        5. Attach a ``TreatmentPlanApproval`` record (pending, unsigned).
        6. Attach ``TreatmentPlanVersion`` snapshot (version 1, empty items).
        7. Persist the aggregate via ``repository.create()``.
        8. Commit the transaction.

        Args:
            patient_id: UUID of the patient (must exist and be active
                per the ``Patient`` module).
            doctor_id: UUID of the doctor (must exist per the
                ``Doctor`` module).
            created_by: User ID of the plan creator.
            clinical_notes: Optional clinical notes.
            observations: Optional observations.
            dentist_recommendations: Optional dentist recommendations.
            valid_from: Optional plan validity start date.
            valid_to: Optional plan validity end date.
            plan_code: Optional explicit plan code. If omitted, one is
                auto-generated in ``"TXN-XXXXXX"`` format.
            change_reason: Reason for version 1 snapshot. Defaults to
                ``"Initial plan creation"``.

        Returns:
            The newly created ``TreatmentPlan`` aggregate (with items,
            versions, and approval relationship populated).

        Raises:
            PatientNotFound: If no patient matches ``patient_id``.
            DoctorNotFound: If no doctor matches ``doctor_id``.
            InvalidDateRange: If ``valid_from > valid_to``.
            DuplicatePlanDetected: If the provided ``plan_code`` collides.
            PlanCreationFailed: If any persistence error occurs.
        """
        try:
            # ── 1. Validate patient and doctor exist ──────────────
            patient = self._db.get(Patient, patient_id)
            if patient is None:
                raise PatientNotFound()

            doctor = self._db.get(Doctor, doctor_id)
            if doctor is None:
                raise DoctorNotFound(
                    f"Doctor {doctor_id} not found",
                )

            # ── 2. Validate date range ────────────────────────────
            self._plan_validator.validate_date_range(valid_from, valid_to)

            # ── 3. Resolve plan code ──────────────────────────────
            resolved_code = plan_code
            if resolved_code is None:
                resolved_code = self._generate_plan_code()
            else:
                self._plan_validator.validate_plan_code_unique(resolved_code)

            # ── 4. Build the aggregate root ───────────────────────
            plan = TreatmentPlan(
                plan_code=resolved_code,
                patient_id=patient_id,
                doctor_id=doctor_id,
                clinical_notes=clinical_notes,
                observations=observations,
                dentist_recommendations=dentist_recommendations,
                valid_from=valid_from,
                valid_to=valid_to,
                status=TreatmentPlanStatus.DRAFT,
                current_version=INITIAL_VERSION_NUMBER,
                is_active=True,
                created_by=created_by,
            )

            # ── 5. Attach approval record (pending, unsigned) ─────
            approval = TreatmentPlanApproval(
                patient_status=PatientAcknowledgmentStatus.PENDING,
            )
            plan.approval = approval

            # ── 6. Attach version 1 snapshot (empty items) ────────
            version = TreatmentPlanVersion(
                version_number=INITIAL_VERSION_NUMBER,
                items_snapshot={},
                change_reason=change_reason,
                changed_by=created_by,
            )
            plan.versions.append(version)

            # ── 7. Persist aggregate ──────────────────────────────
            plan = self._plan_repo.create(plan)
            self._commit()

            logger.info(
                "Treatment plan created: id=%s, code=%s, patient=%s, doctor=%s",
                plan.id,
                plan.plan_code,
                str(patient_id),
                str(doctor_id),
            )

            return plan

        except (
            PatientNotFound,
            DoctorNotFound,
        ):
            # Domain exceptions — no DB work done yet, rollback is
            # defensive but harmless.
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error during plan creation — rolled back",
            )
            raise PlanCreationFailed(
                f"Failed to create treatment plan for patient {patient_id}",
            )

    # ==================================================================
    # Item management
    # ==================================================================

    def _recalculate_totals(self, plan: TreatmentPlan) -> dict[str, Decimal]:
        """Recalculate financial totals from the plan's items.

        Computes the sum of ``estimated_cost`` and ``discount`` across all
        items. Logs the result at DEBUG level. This method is called by
        every item-mutation method so that totals are always up-to-date.

        The ``TreatmentPlan`` model does not currently have persisted total
        fields; the computed values are returned as a dict for the caller
        to use (e.g., response enrichment or future model persistence).

        Args:
            plan: The ``TreatmentPlan`` whose items should be totalled.

        Returns:
            A dict with ``total_estimated_cost``, ``total_discount``,
            and ``net_total`` keys.
        """
        total_estimated = sum(
            (item.estimated_cost * item.quantity for item in plan.items),
            Decimal("0.00"),
        )
        total_discount = sum(
            (item.discount for item in plan.items),
            Decimal("0.00"),
        )
        net_total = total_estimated - total_discount

        logger.debug(
            "Plan totals recalculated: plan_id=%s, total_cost=%s, "
            "total_discount=%s, net_total=%s",
            plan.id,
            total_estimated,
            total_discount,
            net_total,
        )

        return {
            "total_estimated_cost": total_estimated,
            "total_discount": total_discount,
            "net_total": net_total,
        }

    def add_item(
        self,
        plan_id: UUID,
        procedure_id: int,
        sequence_number: int,
        *,
        quantity: int = 1,
        estimated_cost: Decimal | None = None,
        discount: Decimal = Decimal("0.00"),
        tooth_number: int | None = None,
        tooth_surface: str | None = None,
        quadrant: str | None = None,
        arch: str | None = None,
        notes: str | None = None,
    ) -> TreatmentPlan:
        """Add a procedure item to a treatment plan.

        Workflow:
        1. Load plan with items eager-loaded.
        2. Validate plan is in an editable state.
        3. Validate procedure exists and is active.
        4. Validate tooth number (FDI notation).
        5. Validate estimated cost range.
        6. Validate discount (non-negative, ≤ cost if both provided).
        7. Validate sequence number uniqueness within the plan.
        8. Create the ``TreatmentPlanItem``.
        9. Persist via ``repo.add_item()``.
        10. Recalculate plan totals.
        11. Commit transaction.

        Args:
            plan_id: UUID of the target plan.
            procedure_id: ID of the procedure from the master catalog.
            sequence_number: Ordering position (unique per plan).
            estimated_cost: Override cost. If omitted, the procedure's
                ``default_cost`` is used.
            discount: Optional discount amount. Defaults to 0.
            tooth_number: Optional FDI tooth number.
            tooth_surface: Optional tooth surface code.
            quadrant: Optional dental quadrant.
            arch: Optional dental arch.
            notes: Optional clinical notes for this item.

        Returns:
            The updated ``TreatmentPlan`` with the new item in its
            ``items`` collection.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            PlanNotEditable: If the plan is in a non-editable status.
            ProcedureNotFound: If the procedure is missing or inactive.
            InvalidToothNumber: If the tooth number is invalid.
            PlanValidationFailed: If cost or discount is out of range.
            DuplicateItemSequence: If the sequence number is taken.
        """
        try:
            plan = self._plan_repo.get_with_items(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate editable ──────────────────────────────
            self._plan_validator.validate_editable(plan)

            # ── 3. Validate procedure exists ──────────────────────
            self._plan_validator.validate_procedure_exists(procedure_id)

            # ── 4. Resolve cost ───────────────────────────────────
            if estimated_cost is None:
                procedure = self._procedure_repo.get_active_by_id(procedure_id)
                # validate_procedure_exists guarantees procedure is active.
                estimated_cost = procedure.default_cost if procedure else Decimal("0.00")

            # ── 5–7. Validate fields ──────────────────────────────
            self._plan_validator.validate_item_quantity(quantity)
            if tooth_number is not None:
                self._plan_validator.validate_tooth_number(tooth_number)
            self._plan_validator.validate_item_cost(estimated_cost)
            self._plan_validator.validate_discount(discount, estimated_cost, quantity)
            self._plan_validator.validate_item_sequence(
                plan, sequence_number,
            )

            # ── 8. Create item ────────────────────────────────────
            item = TreatmentPlanItem(
                plan_id=plan_id,
                procedure_id=procedure_id,
                sequence_number=sequence_number,
                quantity=quantity,
                tooth_number=tooth_number,
                tooth_surface=tooth_surface,
                quadrant=quadrant,
                arch=arch,
                estimated_cost=estimated_cost,
                discount=discount,
                item_status=TreatmentPlanItemStatus.PENDING,
                notes=notes,
            )

            # ── 9–11. Persist, recalculate, commit ────────────────
            self._plan_repo.add_item(item)
            plan.items.append(item)
            self._recalculate_totals(plan)
            self._commit()

            logger.info(
                "Item added: plan_id=%s, procedure_id=%s, seq=%s, cost=%s",
                str(plan_id),
                procedure_id,
                sequence_number,
                estimated_cost,
            )

            return plan

        except (
            PlanNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error adding item to plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to add item to plan {plan_id}",
            )

    def update_item(
        self,
        plan_id: UUID,
        item_id: UUID,
        *,
        procedure_id: int | None = None,
        sequence_number: int | None = None,
        quantity: int | None = None,
        estimated_cost: Decimal | None = None,
        discount: Decimal | None = None,
        tooth_number: int | None | object = _UNSET,
        tooth_surface: str | None | object = _UNSET,
        quadrant: str | None | object = _UNSET,
        arch: str | None | object = _UNSET,
        notes: str | None = None,
    ) -> TreatmentPlan:
        """Update an existing item's mutable fields.

        Only the fields explicitly provided are updated. All other fields
        remain unchanged. Use ``None`` to explicitly clear a nullable
        field (tooth_number, tooth_surface, quadrant, arch).

        Workflow:
        1. Load plan with items.
        2. Validate plan is editable.
        3. Find the target item in the plan's collection.
        4. Validate changed fields (procedure, tooth, cost, discount, sequence).
        5. Apply field changes on the ORM instance.
        6. Recalculate plan totals.
        7. Commit transaction.

        Args:
            plan_id: UUID of the plan owning the item.
            item_id: UUID of the item to update.
            procedure_id: New procedure (if changed).
            sequence_number: New sequence number (must be unique).
            estimated_cost: New estimated cost.
            discount: New discount amount.
            tooth_number: New tooth number. Pass ``None`` to clear.
            tooth_surface: New tooth surface code. Pass ``None`` to clear.
            quadrant: New quadrant. Pass ``None`` to clear.
            arch: New arch. Pass ``None`` to clear.
            notes: New notes.

        Returns:
            The updated ``TreatmentPlan`` with the item changes reflected.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            ItemNotFound: If ``item_id`` is not found in the plan.
            PlanNotEditable: If the plan is in a non-editable status.
            ProcedureNotFound: If the new procedure is missing or inactive.
            InvalidToothNumber: If the tooth number is invalid.
            PlanValidationFailed: If cost or discount is out of range.
            DuplicateItemSequence: If the new sequence number is taken.
        """
        try:
            plan = self._plan_repo.get_with_items(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            self._plan_validator.validate_editable(plan)

            # ── 3. Find target item ───────────────────────────────
            item = next(
                (i for i in plan.items if i.id == item_id),
                None,
            )
            if item is None:
                raise ItemNotFound(item_id)

            # ── 4. Resolve current values for cross-field validation ──
            new_procedure_id = procedure_id if procedure_id is not None else item.procedure_id
            new_quantity = quantity if quantity is not None else item.quantity
            new_cost = estimated_cost if estimated_cost is not None else item.estimated_cost
            new_discount = discount if discount is not None else item.discount
            new_sequence = sequence_number if sequence_number is not None else item.sequence_number

            # ── 5. Validate changed fields ────────────────────────
            if procedure_id is not None:
                self._plan_validator.validate_procedure_exists(procedure_id)

            if quantity is not None:
                self._plan_validator.validate_item_quantity(quantity)

            if tooth_number is not _UNSET and tooth_number is not None:
                self._plan_validator.validate_tooth_number(tooth_number)

            if estimated_cost is not None:
                self._plan_validator.validate_item_cost(estimated_cost)

            # Validate discount whenever any field affecting the line
            # total changes (quantity, estimated_cost, or discount).
            # This catches cases like: existing discount=1000 was valid
            # at qty=5 (line=1000), but qty-only update to 2 makes
            # the discount exceed the new line total (400).
            if discount is not None or quantity is not None or estimated_cost is not None:
                self._plan_validator.validate_discount(new_discount, new_cost, new_quantity)

            if sequence_number is not None:
                self._plan_validator.validate_item_sequence(
                    plan, sequence_number, exclude_item_id=item_id,
                )

            # ── 6. Apply field changes ────────────────────────────
            if procedure_id is not None:
                item.procedure_id = procedure_id
            if sequence_number is not None:
                item.sequence_number = sequence_number
            if quantity is not None:
                item.quantity = quantity
            if estimated_cost is not None:
                item.estimated_cost = estimated_cost
            if discount is not None:
                item.discount = discount
            if tooth_number is not _UNSET:
                item.tooth_number = tooth_number
            if tooth_surface is not _UNSET:
                item.tooth_surface = tooth_surface
            if quadrant is not _UNSET:
                item.quadrant = quadrant
            if arch is not _UNSET:
                item.arch = arch
            if notes is not None:
                item.notes = notes

            # ── 7–8. Recalculate and commit ───────────────────────
            self._recalculate_totals(plan)
            self._commit()

            logger.info(
                "Item updated: plan_id=%s, item_id=%s, procedure=%s, seq=%s",
                str(plan_id),
                str(item_id),
                new_procedure_id,
                new_sequence,
            )

            return plan

        except (
            PlanNotFound,
            ItemNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error updating item %s in plan %s — rolled back",
                str(item_id),
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to update item {item_id} in plan {plan_id}",
            )

    def remove_item(
        self,
        plan_id: UUID,
        item_id: UUID,
    ) -> TreatmentPlan:
        """Remove an item from a treatment plan.

        Workflow:
        1. Load plan with items.
        2. Validate plan is editable.
        3. Find the target item.
        4. Remove via ``repo.remove_item()``.
        5. Recalculate plan totals.
        6. Commit transaction.

        Args:
            plan_id: UUID of the plan owning the item.
            item_id: UUID of the item to remove.

        Returns:
            The updated ``TreatmentPlan`` with the item removed from its
            ``items`` collection.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            ItemNotFound: If ``item_id`` is not found in the plan.
            PlanNotEditable: If the plan is in a non-editable status.
        """
        try:
            plan = self._plan_repo.get_with_items(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            self._plan_validator.validate_editable(plan)

            item = next(
                (i for i in plan.items if i.id == item_id),
                None,
            )
            if item is None:
                raise ItemNotFound(item_id)

            self._plan_repo.remove_item(item)
            self._recalculate_totals(plan)
            self._commit()

            logger.info(
                "Item removed: plan_id=%s, item_id=%s, procedure=%s",
                str(plan_id),
                str(item_id),
                item.procedure_id,
            )

            return plan

        except (
            PlanNotFound,
            ItemNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error removing item %s from plan %s — rolled back",
                str(item_id),
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to remove item {item_id} from plan {plan_id}",
            )

    def reorder_items(
        self,
        plan_id: UUID,
        item_ids: list[UUID],
    ) -> TreatmentPlan:
        """Reorder items in a treatment plan.

        Accepts a list of item UUIDs in the desired order and assigns
        ascending sequence numbers (1, 2, 3, …) accordingly. All items
        in the plan must be included exactly once.

        Workflow:
        1. Load plan with items.
        2. Validate plan is editable.
        3. Validate all items are accounted for exactly once.
        4. Reassign ``sequence_number`` on each item.
        5. Commit transaction.

        Args:
            plan_id: UUID of the target plan.
            item_ids: Ordered list of item UUIDs reflecting the desired
                sequence (first = sequence 1).

        Returns:
            The updated ``TreatmentPlan`` with items in the new order.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            PlanNotEditable: If the plan is in a non-editable status.
            PlanValidationFailed: If the item list is invalid (wrong
                count, missing items, or extra items).
        """
        try:
            plan = self._plan_repo.get_with_items(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            self._plan_validator.validate_editable(plan)

            # ── 3. Validate item list ─────────────────────────────
            existing_ids = {i.id for i in plan.items}
            provided_ids = set(item_ids)

            if len(item_ids) != len(provided_ids):
                raise PlanUpdateFailed(
                    f"Duplicate item IDs in reorder request for plan {plan_id}",
                )

            if provided_ids != existing_ids:
                missing = existing_ids - provided_ids
                extra = provided_ids - existing_ids
                raise PlanUpdateFailed(
                    f"Item list mismatch for plan {plan_id}: "
                    f"missing={len(missing)}, extra={len(extra)}",
                )

            # ── 4. Reassign sequence numbers ──────────────────────
            id_to_item = {i.id: i for i in plan.items}
            for idx, item_id in enumerate(item_ids, start=1):
                item = id_to_item[item_id]
                item.sequence_number = idx

            self._commit()

            logger.info(
                "Items reordered: plan_id=%s, count=%d",
                str(plan_id),
                len(item_ids),
            )

            return plan

        except (
            PlanNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error reordering items for plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to reorder items for plan {plan_id}",
            )

    # ==================================================================
    # Status transitions (workflow)
    # ==================================================================

    def _transition_plan(
        self,
        plan_id: UUID,
        target_status: TreatmentPlanStatus,
        updated_by: int,
        *,
        needs_items: bool = False,
    ) -> TreatmentPlan:
        """Execute a status transition on a plan.

        Shared helper for all 10 public transition methods. Reduces
        boilerplate by centralising the load-validate-mutate-commit
        pattern.

        Args:
            plan_id: UUID of the plan to transition.
            target_status: The target ``TreatmentPlanStatus`` enum member.
            updated_by: User ID of the actor performing the transition.
            needs_items: If ``True``, load the plan with its items
                eager-loaded (required when the validator checks item
                existence). Otherwise, a simple ``get_by_id`` suffices.

        Returns:
            The updated ``TreatmentPlan`` with the new status.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            InvalidPlanOperation: If the transition is not legal per the
                state machine or business conditions.
        """
        if needs_items:
            plan = self._plan_repo.get_with_items(plan_id)
        else:
            plan = self._plan_repo.get_by_id(plan_id)
        if plan is None:
            raise PlanNotFound(plan_id)

        self._plan_validator.validate_transition(plan, target_status)

        plan.status = target_status
        plan.updated_by = updated_by
        self._commit()

        return plan

    def submit_for_review(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Submit a draft plan for clinical review.

        Transition: ``DRAFT → UNDER_REVIEW``.
        Business condition: plan must have at least one item.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``UNDER_REVIEW`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.UNDER_REVIEW,
            updated_by,
            needs_items=True,
        )
        logger.info(
            "Plan submitted for review: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def approve_review(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Approve a plan during clinical review.

        Transition: ``UNDER_REVIEW → PROPOSED``.
        The plan is now proposed to the patient and awaits their
        acknowledgment or doctor approval.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``PROPOSED`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.PROPOSED,
            updated_by,
        )
        logger.info(
            "Plan review approved: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def reject_review(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Reject a plan during clinical review, sending it back to draft.

        Transition: ``UNDER_REVIEW → DRAFT``.
        The plan is returned to draft for revision before resubmission.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``DRAFT`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.DRAFT,
            updated_by,
        )
        logger.info(
            "Plan review rejected, returned to draft: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def accept_plan(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Accept a proposed plan (patient/doctor acceptance).

        Transition: ``PROPOSED → ACCEPTED``.
        The plan is accepted and ready for treatment to begin.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``ACCEPTED`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.ACCEPTED,
            updated_by,
        )
        logger.info(
            "Plan accepted: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def decline_plan(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Decline a proposed plan.

        Transition: ``PROPOSED → REJECTED``.
        The plan is rejected by the patient or doctor.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``REJECTED`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.REJECTED,
            updated_by,
        )
        logger.info(
            "Plan declined: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def cancel_plan(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Cancel a plan from any non-terminal status.

        Transition: ``any_non_terminal → CANCELLED``.
        Once cancelled, the plan cannot be transitioned further.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``CANCELLED`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.CANCELLED,
            updated_by,
        )
        logger.info(
            "Plan cancelled: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def start_treatment(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Begin treatment on an accepted plan.

        Transition: ``ACCEPTED → IN_PROGRESS``.
        Business condition: plan must have at least one item.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``IN_PROGRESS`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.IN_PROGRESS,
            updated_by,
            needs_items=True,
        )
        logger.info(
            "Treatment started: plan_id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def put_on_hold(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Put an active treatment on hold.

        Transition: ``IN_PROGRESS → ON_HOLD``.
        Treatment is paused but can be resumed later.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``ON_HOLD`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.ON_HOLD,
            updated_by,
        )
        logger.info(
            "Plan put on hold: id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def resume_treatment(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Resume a treatment that was on hold.

        Transition: ``ON_HOLD → IN_PROGRESS``.
        Treatment continues from where it was paused.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``IN_PROGRESS`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.IN_PROGRESS,
            updated_by,
        )
        logger.info(
            "Treatment resumed: plan_id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    def complete_treatment(
        self,
        plan_id: UUID,
        updated_by: int,
    ) -> TreatmentPlan:
        """Mark a treatment as completed.

        Transition: ``IN_PROGRESS or ON_HOLD → COMPLETED``.
        Once completed, the plan reaches a terminal state and cannot
        transition further.

        Args:
            plan_id: UUID of the plan.
            updated_by: User ID of the actor.

        Returns:
            The updated plan in ``COMPLETED`` status.
        """
        plan = self._transition_plan(
            plan_id,
            TreatmentPlanStatus.COMPLETED,
            updated_by,
        )
        logger.info(
            "Treatment completed: plan_id=%s, code=%s",
            str(plan_id),
            plan.plan_code,
        )
        return plan

    # ==================================================================
    # Version management
    # ==================================================================

    def snapshot_current(self, plan: TreatmentPlan) -> dict[str, Any]:
        """Generate an immutable JSONB snapshot of the plan's current items.

        The snapshot shape matches the ``TreatmentPlanVersion.items_snapshot``
        documentation. Decimals are serialised as strings to avoid JSONB
        precision loss. The ``procedure_code`` is resolved from the
        item's ``procedure`` relationship (``lazy="selectin"``, so
        accessing it triggers a batched select query).

        Args:
            plan: The ``TreatmentPlan`` with its ``items`` collection
                eager-loaded (as returned by ``get_with_items()`` or
                ``get_complete_aggregate()``).

        Returns:
            A dict suitable for storing as ``items_snapshot`` on a
            ``TreatmentPlanVersion`` instance.
        """
        items_data: list[dict[str, Any]] = []
        for item in plan.items:
            items_data.append(
                {
                    "sequence_number": item.sequence_number,
                    "procedure_id": item.procedure_id,
                    "procedure_code": (
                        item.procedure.code
                        if item.procedure is not None
                        else str(item.procedure_id)
                    ),
                    "quantity": item.quantity,
                    "tooth_number": item.tooth_number,
                    "tooth_surface": item.tooth_surface,
                    "quadrant": item.quadrant,
                    "arch": item.arch,
                    "estimated_cost": str(item.estimated_cost),
                    "discount": str(item.discount),
                    "item_status": (
                        item.item_status.value
                        if hasattr(item.item_status, "value")
                        else str(item.item_status)
                    ),
                    "notes": item.notes,
                }
            )

        return {
            "version_number": plan.current_version,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "items": items_data,
        }

    def create_version(
        self,
        plan_id: UUID,
        change_reason: str,
        changed_by: int,
    ) -> TreatmentPlan:
        """Create an immutable version snapshot of a plan's current items.

        Used when a plan needs to preserve its current item state before
        modifications (typically in ACCEPTED, IN_PROGRESS, or ON_HOLD
        statuses). The snapshot captures the exact item configuration at
        this point in time for future reference or restoration.

        Workflow:
        1. Load the complete aggregate (plan + items + versions + approval).
        2. Validate change reason is non-empty and within max length.
        3. Generate a JSONB snapshot of current items via
           ``snapshot_current()``.
        4. Determine the next version number (max of existing versions + 1).
        5. Create a ``TreatmentPlanVersion`` with the snapshot.
        6. Update ``plan.current_version`` to the new version number.
        7. Commit the transaction.

        Args:
            plan_id: UUID of the target plan.
            change_reason: Human-readable reason for the version (must be
                non-empty and within ``CHANGE_REASON_MAX_LENGTH``).
            changed_by: User ID of the person creating the version.

        Returns:
            The updated ``TreatmentPlan`` with the new version in its
            ``versions`` collection and ``current_version`` incremented.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            PlanValidationFailed: If ``change_reason`` is empty or exceeds
                the maximum length.
            PlanUpdateFailed: If any persistence error occurs.
        """
        try:
            # ── 1. Load complete aggregate ────────────────────────
            plan = self._plan_repo.get_complete_aggregate(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate change reason ─────────────────────────
            self._plan_validator.validate_change_reason(change_reason)

            # ── 3–4. Snapshot and determine next version ──────────
            snapshot = self.snapshot_current(plan)
            next_version = (
                max(
                    (v.version_number for v in plan.versions),
                    default=plan.current_version,
                )
                + 1
            )

            # ── 5–6. Create version and update plan ───────────────
            version = TreatmentPlanVersion(
                plan_id=plan_id,
                version_number=next_version,
                items_snapshot=snapshot,
                change_reason=change_reason.strip(),
                changed_by=changed_by,
            )
            plan.versions.append(version)
            plan.current_version = next_version

            # ── 7. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Version created: plan_id=%s, version=%d, reason=%s",
                str(plan_id),
                next_version,
                change_reason,
            )

            return plan

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error creating version for plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to create version for plan {plan_id}",
            )

    def list_versions(
        self,
        plan_id: UUID,
    ) -> list[TreatmentPlanVersion]:
        """List all version snapshots for a plan, ordered by version number.

        Read-only operation — no commit. Versions are returned in ascending
        order via the model's ``order_by="TreatmentPlanVersion.version_number"``
        on the ``versions`` relationship.

        Args:
            plan_id: UUID of the target plan.

        Returns:
            A list of ``TreatmentPlanVersion`` instances (or empty list
            if the plan has no versions).

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
        """
        plan = self._plan_repo.get_with_versions(plan_id)
        if plan is None:
            raise PlanNotFound(plan_id)
        return list(plan.versions)

    def get_version(
        self,
        plan_id: UUID,
        version_id: UUID,
    ) -> TreatmentPlanVersion:
        """Retrieve a specific version snapshot by its UUID.

        Read-only operation — no commit. Queries ``TreatmentPlanVersion``
        directly via the session for an efficient single-row lookup without
        loading the full plan aggregate.

        Args:
            plan_id: UUID of the owning plan (used for scoping the lookup).
            version_id: UUID of the version to retrieve.

        Returns:
            The matching ``TreatmentPlanVersion``.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            VersionNotFound: If ``version_id`` is not found for this plan.
        """
        plan = self._plan_repo.get_by_id(plan_id)
        if plan is None:
            raise PlanNotFound(plan_id)

        stmt = select(TreatmentPlanVersion).where(
            TreatmentPlanVersion.id == version_id,
            TreatmentPlanVersion.plan_id == plan_id,
        )
        version = self._db.execute(stmt).scalar_one_or_none()
        if version is None:
            raise VersionNotFound(version_id)
        return version

    def restore_version(
        self,
        plan_id: UUID,
        version_id: UUID,
        changed_by: int,
    ) -> TreatmentPlan:
        """Restore a plan's items from an earlier version snapshot.

        Workflow:
        1. Load the plan with its items and versions.
        2. Validate the plan is in an editable state (DRAFT, UNDER_REVIEW,
           or PROPOSED) — items can only be modified in editable statuses.
        3. Find the target version by UUID in the plan's versions collection.
        4. Clear all existing items (orphan cascade deletes them at flush).
        5. Rebuild ``TreatmentPlanItem`` instances from the snapshot data.
        6. Create a new ``TreatmentPlanVersion`` recording the restore event.
        7. Update ``plan.current_version``.
        8. Commit the transaction.

        The version snapshot is left untouched — history is never overwritten.

        Args:
            plan_id: UUID of the target plan.
            version_id: UUID of the version to restore from.
            changed_by: User ID of the person performing the restore.

        Returns:
            The updated ``TreatmentPlan`` with items rebuilt from the
            snapshot and a new version entry.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            VersionNotFound: If ``version_id`` is not found for this plan.
            PlanNotEditable: If the plan is in a non-editable status
                (restoring items requires an editable plan).
            PlanUpdateFailed: If any persistence error occurs.
        """
        try:
            # ── 1. Load complete aggregate ────────────────────────
            plan = self._plan_repo.get_complete_aggregate(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate editable ──────────────────────────────
            self._plan_validator.validate_editable(plan)

            # ── 3. Find target version ────────────────────────────
            target_version = next(
                (v for v in plan.versions if v.id == version_id),
                None,
            )
            if target_version is None:
                raise VersionNotFound(version_id)

            items_snapshot = target_version.items_snapshot
            snapshot_items: list[dict[str, Any]] = items_snapshot.get("items", [])

            # ── 4. Clear existing items ───────────────────────────
            plan.items.clear()

            # ── 5. Rebuild items from snapshot ────────────────────
            for item_data in snapshot_items:
                new_item = TreatmentPlanItem(
                    plan_id=plan_id,
                    procedure_id=item_data["procedure_id"],
                    sequence_number=item_data["sequence_number"],
                    quantity=item_data.get("quantity", 1),
                    tooth_number=item_data.get("tooth_number"),
                    tooth_surface=item_data.get("tooth_surface"),
                    quadrant=item_data.get("quadrant"),
                    arch=item_data.get("arch"),
                    estimated_cost=Decimal(item_data["estimated_cost"]),
                    discount=Decimal(item_data["discount"]),
                    item_status=TreatmentPlanItemStatus(
                        item_data["item_status"]
                    ),
                    notes=item_data.get("notes"),
                )
                plan.items.append(new_item)

            # ── 6. Create a version recording the restore ─────────
            next_version = (
                max(
                    (v.version_number for v in plan.versions),
                    default=plan.current_version,
                )
                + 1
            )
            restore_snapshot = self.snapshot_current(plan)
            version = TreatmentPlanVersion(
                plan_id=plan_id,
                version_number=next_version,
                items_snapshot=restore_snapshot,
                change_reason=(
                    f"Restored from version "
                    f"{target_version.version_number}"
                ),
                changed_by=changed_by,
            )
            plan.versions.append(version)
            plan.current_version = next_version

            # ── 8. Commit ─────────────────────────────────────────
            self._commit()

            logger.info(
                "Plan restored to version %d: plan_id=%s, new_version=%d",
                target_version.version_number,
                str(plan_id),
                next_version,
            )

            return plan

        except (
            PlanNotFound,
            VersionNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error restoring version for plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to restore version for plan {plan_id}",
            )

    # ==================================================================
    # Approval workflow (doctor approval + patient acknowledgment)
    # ==================================================================

    def doctor_approve(
        self,
        plan_id: UUID,
        approved_by: int,
    ) -> TreatmentPlan:
        """Record doctor approval on a plan's approval record.

        Workflow:
        1. Load plan with its approval record.
        2. Validate the plan is in ``PROPOSED`` status and not already
           approved (``validate_can_approve``).
        3. Set ``approved_by`` and ``approved_at`` on the approval record.
        4. Commit the transaction.

        This does **not** change the plan's status — the status transition
        to ``ACCEPTED`` is a separate step (``accept_plan``).

        Args:
            plan_id: UUID of the target plan.
            approved_by: User ID of the approving doctor.

        Returns:
            The updated ``TreatmentPlan`` with the signed approval record.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            InvalidPlanOperation: If the plan is not in ``PROPOSED`` status.
            PlanAlreadyApproved: If the plan already has a doctor's approval.
        """
        try:
            plan = self._plan_repo.get_with_approval(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate can approve ───────────────────────────
            self._plan_validator.validate_can_approve(plan)

            # ── 3. Ensure approval record exists ──────────────────
            if plan.approval is None:
                plan.approval = TreatmentPlanApproval(
                    patient_status=PatientAcknowledgmentStatus.PENDING,
                )

            # ── 4. Set doctor signature ───────────────────────────
            plan.approval.approved_by = approved_by
            plan.approval.approved_at = datetime.now(timezone.utc)

            self._commit()

            logger.info(
                "Doctor approved plan: plan_id=%s, approved_by=%d",
                str(plan_id),
                approved_by,
            )

            return plan

        except (
            PlanNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error during doctor approval for plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to record doctor approval for plan {plan_id}",
            )

    def doctor_revoke(
        self,
        plan_id: UUID,
        actor_id: int,
    ) -> TreatmentPlan:
        """Revoke a doctor's approval from a plan.

        Workflow:
        1. Load plan with its approval record.
        2. Validate the plan is in ``PROPOSED`` status and the doctor
           has previously approved (``validate_doctor_approved``).
        3. Clear ``approved_by`` and ``approved_at`` on the approval record.
        4. Set ``updated_by`` to the actor.
        5. Commit the transaction.

        Args:
            plan_id: UUID of the target plan.
            actor_id: User ID of the authenticated actor performing the revoke.

        Returns:
            The updated ``TreatmentPlan`` with the doctor's signature cleared.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            InvalidPlanOperation: If the plan is not in ``PROPOSED`` status
                or the doctor has not yet approved.
        """
        try:
            plan = self._plan_repo.get_with_approval(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate plan is proposed and has approval ─────
            self._plan_validator.validate_status_is(
                plan, TreatmentPlanStatus.PROPOSED,
            )
            self._plan_validator.validate_doctor_approved(plan)

            # ── 3. Clear doctor signature ─────────────────────────
            plan.approval.approved_by = None
            plan.approval.approved_at = None
            plan.updated_by = actor_id

            self._commit()

            logger.info(
                "Doctor approval revoked: plan_id=%s",
                str(plan_id),
            )

            return plan

        except (
            PlanNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error revoking doctor approval for plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to revoke doctor approval for plan {plan_id}",
            )

    def patient_acknowledge(
        self,
        plan_id: UUID,
        actor_id: int,
    ) -> TreatmentPlan:
        """Record patient acknowledgment (acceptance) of a proposed plan.

        Workflow:
        1. Load plan with its approval record.
        2. Validate the plan is ready for acknowledgment
           (``validate_can_acknowledge`` — PROPOSED, doctor approved,
           not already acknowledged).
        3. Set ``patient_status`` to ``ACCEPTED`` and
           ``patient_acknowledged_at`` to now.
        4. Set ``updated_by`` to the actor.
        5. Commit the transaction.

        This does **not** change the plan's status — the status transition
        to ``ACCEPTED`` is a separate step (``accept_plan``).

        Args:
            plan_id: UUID of the target plan.

        Returns:
            The updated ``TreatmentPlan`` with the patient's acceptance
            recorded on the approval record.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            InvalidPlanOperation: If the plan is not in ``PROPOSED`` status
                or the doctor has not yet approved.
            PatientAcknowledgmentExists: If the patient has already
                acknowledged the plan.
        """
        try:
            plan = self._plan_repo.get_with_approval(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate can acknowledge ───────────────────────
            self._plan_validator.validate_can_acknowledge(plan)

            # ── 3. Set patient acknowledgment ─────────────────────
            plan.approval.patient_status = (
                PatientAcknowledgmentStatus.ACCEPTED
            )
            plan.approval.patient_acknowledged_at = (
                datetime.now(timezone.utc)
            )
            plan.updated_by = actor_id

            self._commit()

            logger.info(
                "Patient acknowledged plan: plan_id=%s",
                str(plan_id),
            )

            return plan

        except (
            PlanNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error during patient acknowledgment for "
                "plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to record patient acknowledgment for plan {plan_id}",
            )

    def patient_decline(
        self,
        plan_id: UUID,
        actor_id: int,
    ) -> TreatmentPlan:
        """Record patient declining a proposed plan.

        Workflow:
        1. Load plan with its approval record.
        2. Validate the plan is in ``PROPOSED`` status, the doctor has
           approved, and the patient has not already taken action.
        3. Set ``patient_status`` to ``REJECTED`` and
           ``patient_acknowledged_at`` to now.
        4. Set ``updated_by`` to the actor.
        5. Commit the transaction.

        This does **not** change the plan's status — the status transition
        to ``REJECTED`` is a separate step (``decline_plan``).

        Args:
            plan_id: UUID of the target plan.

        Returns:
            The updated ``TreatmentPlan`` with the patient's decline
            recorded on the approval record.

        Raises:
            PlanNotFound: If ``plan_id`` does not resolve.
            InvalidPlanOperation: If the plan is not in ``PROPOSED`` status
                or the doctor has not yet approved.
            PatientAcknowledgmentExists: If the patient has already
                taken action on the plan.
        """
        try:
            plan = self._plan_repo.get_with_approval(plan_id)
            if plan is None:
                raise PlanNotFound(plan_id)

            # ── 2. Validate preconditions for patient action ──────
            self._plan_validator.validate_status_is(
                plan, TreatmentPlanStatus.PROPOSED,
            )
            self._plan_validator.validate_doctor_approved(plan)
            self._plan_validator.validate_not_already_acknowledged(plan)

            # ── 3. Set patient decline ────────────────────────────
            plan.approval.patient_status = (
                PatientAcknowledgmentStatus.REJECTED
            )
            plan.approval.patient_acknowledged_at = (
                datetime.now(timezone.utc)
            )
            plan.updated_by = actor_id

            self._commit()

            logger.info(
                "Patient declined plan: plan_id=%s",
                str(plan_id),
            )

            return plan

        except (
            PlanNotFound,
            PlanUpdateFailed,
        ):
            self._db.rollback()
            raise

        except (IntegrityError, SQLAlchemyError):
            self._db.rollback()
            logger.exception(
                "Database error during patient decline for "
                "plan %s — rolled back",
                str(plan_id),
            )
            raise PlanUpdateFailed(
                f"Failed to record patient decline for plan {plan_id}",
            )

    # ==================================================================
    # Read / query operations
    # ==================================================================

    def get_plan(self, plan_id: UUID) -> TreatmentPlan:
        """Retrieve a single treatment plan by its UUID.

        Loads the plan with its items, approval, and versions eager-loaded
        (uses ``get_complete_aggregate``). Read-only — no commit.

        Args:
            plan_id: UUID of the plan.

        Returns:
            The ``TreatmentPlan`` aggregate with items, approval, and
            versions loaded.

        Raises:
            PlanNotFound: If no plan with the given UUID exists.
        """
        plan = self._plan_repo.get_complete_aggregate(plan_id)
        if plan is None:
            raise PlanNotFound(plan_id)
        return plan

    def search_plans(
        self,
        term: str,
        limit: int = TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT,
    ) -> list[TreatmentPlan]:
        """Search treatment plans by plan code (type-ahead / quick-find).

        Delegates to ``TreatmentPlanRepository.search()`` which performs
        a case-insensitive substring match on ``plan_code``.

        Read-only — no commit, no validation.

        Args:
            term: Search string. Empty or whitespace-only returns ``[]``.
            limit: Maximum results (defaults to
                ``TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT``).

        Returns:
            A list of matching ``TreatmentPlan`` instances (no child
            entities loaded).
        """
        term = term.strip() if term else ""
        if not term:
            return []
        return self._plan_repo.search(term=term, limit=limit)

    def list_plans(
        self,
        *,
        search: str | None = None,
        patient_id: UUID | None = None,
        doctor_id: UUID | None = None,
        status: TreatmentPlanStatus | str | None = None,
        is_active: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[TreatmentPlan], int]:
        """Return a paginated, filterable list of treatment plans.

        Pure delegation to ``TreatmentPlanRepository.list()`` — the repo
        handles all query construction (filters, joins, pagination,
        sorting). No commit, no validation.

        Args:
            search: Case-insensitive search across plan_code, patient first
                name, and patient last name.
            patient_id: Filter by patient UUID.
            doctor_id: Filter by doctor UUID.
            status: Filter by plan status enum value or raw string.
            is_active: Filter by active/inactive state.
            date_from: Only plans created on or after this date.
            date_to: Only plans created on or before this date.
            page: 1-based page number (default 1).
            page_size: Page size (default ``DEFAULT_PAGE_SIZE``,
                max ``MAX_PAGE_SIZE``).
            sort_by: Sort field (created_at, updated_at, status, plan_code).
            sort_order: "asc" or "desc" (default "desc").

        Returns:
            A tuple of ``(items, total_count)``.
        """
        return self._plan_repo.list(
            search=search,
            patient_id=patient_id,
            doctor_id=doctor_id,
            status=status,
            is_active=is_active,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_pending_review(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> tuple[list[TreatmentPlan], int]:
        """List plans awaiting clinical review (``UNDER_REVIEW`` status).

        Delegates to ``TreatmentPlanRepository.find_by_status()`` with
        ``TreatmentPlanStatus.UNDER_REVIEW``.

        Args:
            page: 1-based page number (default 1).
            page_size: Page size (default ``DEFAULT_PAGE_SIZE``).

        Returns:
            A tuple of ``(items, total_count)``.
        """
        return self._plan_repo.find_by_status(
            status=TreatmentPlanStatus.UNDER_REVIEW,
            page=page,
            page_size=page_size,
        )

    def list_pending_approval(
        self,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> tuple[list[TreatmentPlan], int]:
        """List plans awaiting doctor approval.

        Delegates to ``TreatmentPlanRepository.find_pending_approval()``
        which returns PROPOSED plans without a signed approval record.

        Args:
            page: 1-based page number (default 1).
            page_size: Page size (default ``DEFAULT_PAGE_SIZE``).

        Returns:
            A tuple of ``(items, total_count)`` with the approval
            relationship eager-loaded.
        """
        return self._plan_repo.find_pending_approval(
            page=page,
            page_size=page_size,
        )

    def list_by_patient(
        self,
        patient_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        *,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[TreatmentPlan], int]:
        """List all plans for a given patient.

        Delegates to ``TreatmentPlanRepository.find_by_patient()``.

        Args:
            patient_id: UUID of the patient.
            page: 1-based page number (default 1).
            page_size: Page size (default ``DEFAULT_PAGE_SIZE``).
            sort_by: Sort field (created_at, updated_at, status, plan_code).
            sort_order: "asc" or "desc" (default "desc").

        Returns:
            A tuple of ``(items, total_count)``.
        """
        return self._plan_repo.find_by_patient(
            patient_id=patient_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def list_by_doctor(
        self,
        doctor_id: UUID,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        *,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> tuple[list[TreatmentPlan], int]:
        """List all plans for a given doctor.

        Delegates to ``TreatmentPlanRepository.find_by_doctor()``.

        Args:
            doctor_id: UUID of the doctor.
            page: 1-based page number (default 1).
            page_size: Page size (default ``DEFAULT_PAGE_SIZE``).
            sort_by: Sort field (created_at, updated_at, status, plan_code).
            sort_order: "asc" or "desc" (default "desc").

        Returns:
            A tuple of ``(items, total_count)``.
        """
        return self._plan_repo.find_by_doctor(
            doctor_id=doctor_id,
            page=page,
            page_size=page_size,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def dashboard_summary(self) -> dict[str, Any]:
        """Return a composite summary of plan statistics.

        Aggregates data from multiple repository queries into a single
        dict suitable for a dashboard view. Read-only — no commit.

        Returns:
            A dict with:

            - ``total_plans`` (int): Total plan count.
            - ``by_status`` (dict): Breakdown ``{status_label: count}``.
            - ``pending_review`` (int): Plans in UNDER_REVIEW status.
            - ``pending_approval`` (int): Plans awaiting doctor approval.
            - ``pending_acknowledgment`` (int): Plans awaiting patient
              acknowledgment.
            - ``active_plans`` (int): Plans with ``is_active = True``.
        """
        total = self._plan_repo.count()
        by_status = self._plan_repo.count_by_status()

        # Compute pending-review total from the count-by-status breakdown.
        pending_review = by_status.get(
            TreatmentPlanStatus.UNDER_REVIEW.value, 0
        )

        # Pending-approval count uses the repository's dedicated query.
        _, pending_approval_total = self._plan_repo.find_pending_approval(
            page=1, page_size=1,
        )

        # Pending-acknowledgment count uses the repository's dedicated query.
        _, pending_ack_total = self._plan_repo.find_pending_acknowledgment(
            page=1, page_size=1,
        )

        # Active-plans count through ``list()`` with the ``is_active`` filter.
        _, active_total = self._plan_repo.list(
            is_active=True, page=1, page_size=1,
        )

        return {
            "total_plans": total,
            "by_status": by_status,
            "pending_review": pending_review,
            "pending_approval": pending_approval_total,
            "pending_acknowledgment": pending_ack_total,
            "active_plans": active_total,
        }

    def count_by_status(self) -> dict[str, int]:
        """Return a mapping of ``{status_label: count}`` for all plans.

        Delegates to ``TreatmentPlanRepository.count_by_status()``.
        Read-only — no commit.

        Returns:
            ``{"draft": 12, "proposed": 5, "accepted": 3, ...}``
        """
        return self._plan_repo.count_by_status()

    def count_by_doctor(
        self,
        doctor_id: UUID | None = None,
    ) -> int | dict[str, int]:
        """Count plans, optionally for a specific doctor.

        Delegates to ``TreatmentPlanRepository.count_by_doctor()``.
        Read-only — no commit.

        Args:
            doctor_id: If provided, returns a plain count for that doctor.
                If ``None``, returns a mapping of ``{doctor_id: count}``.

        Returns:
            ``int`` when ``doctor_id`` is given, otherwise a ``dict``.
        """
        return self._plan_repo.count_by_doctor(doctor_id=doctor_id)

    def count_by_patient(
        self,
        patient_id: UUID | None = None,
    ) -> int | dict[str, int]:
        """Count plans, optionally for a specific patient.

        Delegates to ``TreatmentPlanRepository.count_by_patient()``.
        Read-only — no commit.

        Args:
            patient_id: If provided, returns a plain count for that patient.
                If ``None``, returns a mapping of ``{patient_id: count}``.

        Returns:
            ``int`` when ``patient_id`` is given, otherwise a ``dict``.
        """
        return self._plan_repo.count_by_patient(patient_id=patient_id)
