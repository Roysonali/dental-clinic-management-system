"""Backend Quantity Tests — Treatment Plan Item quantity feature.

Real, committed tests covering all 20 specified test cases (Q1–Q20).
These tests exercise the service layer, validator, mapper, and snapshot/restore
logic for the quantity field on TreatmentPlanItem.

Uses the shared ``db`` fixture from conftest.py (SQLite in-memory, billing
tables excluded).
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest

from app.modules.treatment.constants import MAX_ITEM_QUANTITY, MIN_ITEM_QUANTITY
from app.modules.treatment.exceptions import PlanValidationFailed
from app.modules.treatment.mappers.treatment_plan_mapper import TreatmentPlanMapper
from app.modules.treatment.repositories import (
    ProcedureRepository,
    TreatmentPlanRepository,
)
from app.modules.treatment.schemas.treatment_plan import TreatmentPlanItemResponse
from app.modules.treatment.services.treatment_plan_service import TreatmentPlanService
from app.modules.treatment.validators import ProcedureValidator, TreatmentPlanValidator

from tests.modules.treatment.conftest import (
    ProcedureFactory,
    TreatmentPlanFactory,
    TreatmentPlanItemFactory,
    TreatmentPlanVersionFactory,
    _STUB_DOCTOR_ID,
    _STUB_PATIENT_ID,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(db) -> TreatmentPlanService:
    """Build a TreatmentPlanService wired to real repos and validators."""
    plan_repo = TreatmentPlanRepository(db)
    procedure_repo = ProcedureRepository(db)
    plan_validator = TreatmentPlanValidator(plan_repo, procedure_repo)
    procedure_validator = ProcedureValidator(procedure_repo)
    return TreatmentPlanService(
        plan_repo=plan_repo,
        procedure_repo=procedure_repo,
        plan_validator=plan_validator,
        procedure_validator=procedure_validator,
        db=db,
    )


# ======================================================================
# Q1 — quantity omitted → default 1, gross = estimated_cost × 1
# ======================================================================


class TestQ1QuantityOmittedDefaultOne:
    def test_add_item_omitted_quantity_defaults_to_one(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            # quantity omitted → defaults to 1
        )

        item = plan.items[0]
        assert item.quantity == 1
        assert item.estimated_cost == Decimal("200.00")
        # gross = 200 × 1 = 200
        assert item.estimated_cost * item.quantity == Decimal("200.00")


# ======================================================================
# Q2 — quantity = 5, unit cost = 200 → gross = 1000
# ======================================================================


class TestQ2QuantityFiveCostTwoHundred:
    def test_gross_is_cost_times_quantity(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id,
            procedure_id=proc.id,
            sequence_number=1,
            quantity=5,
            estimated_cost=Decimal("200.00"),
        )

        item = plan.items[0]
        assert item.quantity == 5
        gross = item.estimated_cost * item.quantity
        assert gross == Decimal("1000.00")


# ======================================================================
# Q3 — multiple items: 2×500 + 3×200 → plan gross total = 1600
# ======================================================================


class TestQ3MultipleItemsPlanTotal:
    def test_plan_total_sums_cost_times_quantity(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("100.00"))
        plan = TreatmentPlanFactory.create(db)

        # Item 1: qty=2, cost=500
        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=2, estimated_cost=Decimal("500.00"),
        )
        # Item 2: qty=3, cost=200
        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=2,
            quantity=3, estimated_cost=Decimal("200.00"),
        )

        totals = svc._recalculate_totals(plan)
        # 2×500 + 3×200 = 1000 + 600 = 1600
        assert totals["total_estimated_cost"] == Decimal("1600.00")


# ======================================================================
# Q4 — quantity update: 1→5, cost=200, plan total: 200→1000
# ======================================================================


class TestQ4QuantityUpdateIncrease:
    def test_increasing_quantity_recalculates_total(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=1, estimated_cost=Decimal("200.00"),
        )
        item = plan.items[0]
        totals_before = svc._recalculate_totals(plan)
        assert totals_before["total_estimated_cost"] == Decimal("200.00")

        plan = svc.update_item(plan.id, item.id, quantity=5)
        totals_after = svc._recalculate_totals(plan)
        assert totals_after["total_estimated_cost"] == Decimal("1000.00")


# ======================================================================
# Q5 — quantity update: 5→3, cost=200, plan total: 1000→600
# ======================================================================


class TestQ5QuantityUpdateDecrease:
    def test_decreasing_quantity_recalculates_total(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
        )
        item = plan.items[0]
        totals_before = svc._recalculate_totals(plan)
        assert totals_before["total_estimated_cost"] == Decimal("1000.00")

        plan = svc.update_item(plan.id, item.id, quantity=3)
        totals_after = svc._recalculate_totals(plan)
        assert totals_after["total_estimated_cost"] == Decimal("600.00")


# ======================================================================
# Q6 — estimated_cost update while quantity > 1: qty=5, cost 200→300, total 1000→1500
# ======================================================================


class TestQ6CostUpdateWithQuantity:
    def test_cost_change_with_quantity_recalculates(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
        )
        item = plan.items[0]
        totals_before = svc._recalculate_totals(plan)
        assert totals_before["total_estimated_cost"] == Decimal("1000.00")

        plan = svc.update_item(plan.id, item.id, estimated_cost=Decimal("300.00"))
        totals_after = svc._recalculate_totals(plan)
        assert totals_after["total_estimated_cost"] == Decimal("1500.00")


# ======================================================================
# Q7 — remove item with quantity > 1, plan total recalculates correctly
# ======================================================================


class TestQ7RemoveItemWithQuantity:
    def test_removing_item_with_quantity_recalculates_total(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("100.00"))
        plan = TreatmentPlanFactory.create(db)

        # Item 1: qty=5, cost=200 → gross=1000
        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
        )
        # Item 2: qty=3, cost=100 → gross=300
        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=2,
            quantity=3, estimated_cost=Decimal("100.00"),
        )

        totals_before = svc._recalculate_totals(plan)
        assert totals_before["total_estimated_cost"] == Decimal("1300.00")

        # Remove item 2
        item2 = plan.items[1]
        plan = svc.remove_item(plan.id, item2.id)

        totals_after = svc._recalculate_totals(plan)
        assert totals_after["total_estimated_cost"] == Decimal("1000.00")


# ======================================================================
# Q8 — quantity = 0 rejected
# ======================================================================


class TestQ8QuantityZeroRejected:
    def test_quantity_zero_raises_validation_error(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        with pytest.raises(PlanValidationFailed, match="[Qq]uantity"):
            svc.add_item(
                plan.id, procedure_id=proc.id, sequence_number=1,
                quantity=0,
            )


# ======================================================================
# Q9 — quantity < 0 rejected
# ======================================================================


class TestQ9QuantityNegativeRejected:
    def test_quantity_negative_raises_validation_error(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        with pytest.raises(PlanValidationFailed, match="[Qq]uantity"):
            svc.add_item(
                plan.id, procedure_id=proc.id, sequence_number=1,
                quantity=-1,
            )


# ======================================================================
# Q10 — quantity = 1000 rejected (exceeds MAX_ITEM_QUANTITY)
# ======================================================================


class TestQ10QuantityOverMaxRejected:
    def test_quantity_above_max_raises_validation_error(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        with pytest.raises(PlanValidationFailed, match="[Qq]uantity"):
            svc.add_item(
                plan.id, procedure_id=proc.id, sequence_number=1,
                quantity=1000,
            )


# ======================================================================
# Q11 — decimal quantity rejected
# ======================================================================


class TestQ11QuantityDecimalRejected:
    def test_quantity_decimal_raises_validation_error(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        with pytest.raises(PlanValidationFailed, match="quantity"):
            svc.add_item(
                plan.id, procedure_id=proc.id, sequence_number=1,
                quantity=Decimal("2.5"),  # type: ignore[arg-type]
            )


# ======================================================================
# Q12 — bool quantity rejected (bool is subclass of int in Python)
# ======================================================================


class TestQ12QuantityBoolRejected:
    def test_quantity_bool_raises_validation_error(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        with pytest.raises(PlanValidationFailed, match="quantity"):
            svc.add_item(
                plan.id, procedure_id=proc.id, sequence_number=1,
                quantity=True,  # type: ignore[arg-type]
            )


# ======================================================================
# Q13 — discount boundary: qty=5, cost=200, discount=1000 → valid
# ======================================================================


class TestQ13DiscountAtLineTotalBoundary:
    def test_discount_equal_to_line_total_is_valid(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
            discount=Decimal("1000.00"),
        )

        item = plan.items[0]
        assert item.discount == Decimal("1000.00")
        assert item.estimated_cost * item.quantity == Decimal("1000.00")


# ======================================================================
# Q14 — discount exceeds line total: qty=5, cost=200, discount=1001 → rejected
# ======================================================================


class TestQ14DiscountExceedsLineTotal:
    def test_discount_exceeding_line_total_raises_validation_error(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        with pytest.raises(PlanValidationFailed, match="[Dd]iscount"):
            svc.add_item(
                plan.id, procedure_id=proc.id, sequence_number=1,
                quantity=5, estimated_cost=Decimal("200.00"),
                discount=Decimal("1001.00"),
            )


# ======================================================================
# Q15 — snapshot_current stores quantity
# ======================================================================


class TestQ15SnapshotStoresQuantity:
    def test_snapshot_contains_quantity(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
        )

        snapshot = svc.snapshot_current(plan)
        assert "items" in snapshot
        assert len(snapshot["items"]) == 1
        assert snapshot["items"][0]["quantity"] == 5


# ======================================================================
# Q16 — restore snapshot with quantity preserves it
# ======================================================================


class TestQ16RestoreSnapshotPreservesQuantity:
    def test_restore_preserves_quantity_from_snapshot(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        # Add item with quantity=7
        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=7, estimated_cost=Decimal("200.00"),
        )

        # Create a version snapshot
        plan = svc.create_version(plan.id, "Before change", changed_by=1)
        version = plan.versions[-1]

        # Modify the item
        item = plan.items[0]
        plan = svc.update_item(plan.id, item.id, quantity=3)
        assert plan.items[0].quantity == 3

        # --- Work around SQLite passive_deletes limitation ---
        # On SQLite with FK enforcement disabled, cascade deletes
        # don't fire.  Manually delete items so restore_version
        # can re-insert with the same sequence_number.
        for existing_item in plan.items:
            db.delete(existing_item)
        db.flush()
        plan.items.clear()

        # Restore the snapshot
        plan = svc.restore_version(plan.id, version.id, changed_by=1)
        assert plan.items[0].quantity == 7


# ======================================================================
# Q17 — restore OLD snapshot without quantity → defaults to 1
# ======================================================================


class TestQ17RestoreOldSnapshotDefaultsQuantity:
    def test_restore_old_snapshot_without_quantity_defaults_to_one(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        # Add item with quantity=5
        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
        )

        # Manually create an old-style version snapshot WITHOUT quantity key
        old_snapshot = {
            "version_number": 1,
            "captured_at": "2026-01-01T00:00:00Z",
            "items": [
                {
                    "sequence_number": 1,
                    "procedure_id": proc.id,
                    "procedure_code": proc.code,
                    # NO "quantity" key — simulates pre-quantity snapshot
                    "tooth_number": None,
                    "tooth_surface": None,
                    "quadrant": None,
                    "arch": None,
                    "estimated_cost": "200.00",
                    "discount": "0.00",
                    "item_status": "pending",
                    "notes": None,
                },
            ],
        }

        version = TreatmentPlanVersionFactory.create(
            db, plan_id=plan.id,
            version_number=2,
            items_snapshot=old_snapshot,
        )
        db.refresh(plan)

        # --- Work around SQLite passive_deletes limitation ---
        for existing_item in plan.items:
            db.delete(existing_item)
        db.flush()
        plan.items.clear()

        # Restore the old snapshot
        plan = svc.restore_version(plan.id, version.id, changed_by=1)

        # quantity should default to 1
        assert plan.items[0].quantity == 1


# ======================================================================
# Q18 — response DTO contains quantity
# ======================================================================


class TestQ18ResponseDtoContainsQuantity:
    def test_item_response_dto_includes_quantity(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
        )

        item = plan.items[0]
        dto = TreatmentPlanMapper.to_item_response(item)
        assert isinstance(dto, TreatmentPlanItemResponse)
        assert dto.quantity == 5


# ======================================================================
# Q19 — list total_estimated_cost uses quantity
# ======================================================================


class TestQ19ListTotalUsesQuantity:
    def test_list_item_total_multiplies_cost_by_quantity(self, db):
        proc = ProcedureFactory.create(db, default_cost=Decimal("100.00"))
        plan = TreatmentPlanFactory.create(db)
        TreatmentPlanItemFactory.create(
            db, plan_id=plan.id, procedure_id=proc.id,
            quantity=5, estimated_cost=Decimal("200.00"),
            sequence_number=1,
        )
        db.refresh(plan)

        dto = TreatmentPlanMapper.to_list_item(plan)
        # total_estimated_cost = 200 × 5 = 1000
        assert dto.total_estimated_cost == Decimal("1000.00")


# ======================================================================
# F1 — quantity-only update revalidates existing discount
# ======================================================================


class TestF1QuantityOnlyUpdateRevalidatesDiscount:
    def test_quantity_only_update_rejects_invalid_existing_discount(self, db):
        """qty=5, cost=200, discount=1000 (valid: 5×200=1000).

        PATCH qty only: 5→2.  New line total = 400, but discount
        remains 1000 → should raise PlanValidationFailed, NOT
        a generic IntegrityError / PlanUpdateFailed.
        """
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=5, estimated_cost=Decimal("200.00"),
            discount=Decimal("1000.00"),
        )
        item = plan.items[0]
        assert item.quantity == 5
        assert item.discount == Decimal("1000.00")

        # Quantity-only update: 5→2 → line total=400, discount=1000 > 400
        with pytest.raises(PlanValidationFailed, match="[Dd]iscount"):
            svc.update_item(plan.id, item.id, quantity=2)

        # Verify the item was NOT mutated (transaction rolled back)
        db.refresh(item)
        assert item.quantity == 5


# ======================================================================
# Q20 — quantity=1 preserves historical calculation behavior
# ======================================================================


class TestQ20QuantityOnePreservesHistoricalBehavior:
    def test_quantity_one_gross_equals_unit_cost(self, db):
        svc = _make_service(db)
        proc = ProcedureFactory.create(db, default_cost=Decimal("200.00"))
        plan = TreatmentPlanFactory.create(db)

        plan = svc.add_item(
            plan.id, procedure_id=proc.id, sequence_number=1,
            quantity=1, estimated_cost=Decimal("200.00"),
        )

        item = plan.items[0]
        gross = item.estimated_cost * item.quantity
        assert gross == Decimal("200.00")

        # Plan total should match the old behavior (no multiplier)
        totals = svc._recalculate_totals(plan)
        assert totals["total_estimated_cost"] == Decimal("200.00")
