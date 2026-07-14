"""Tests for the Treatment Plan module schemas (Pydantic DTOs).

No database dependency — all tests are pure Pydantic validation.
Covers: request validation, response serialisation, factory methods,
frozen immutability, and edge cases.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ProcedureCategory,
    ToothArch,
    ToothQuadrant,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.schemas.common import (
    PlanStatusCounts,
    StatusTransition,
)
from app.modules.treatment.schemas.errors import (
    ErrorDetail,
    ErrorResponse,
    ValidationErrorItem,
    ValidationErrorResponse,
)
from app.modules.treatment.schemas.pagination import PaginatedResponse
from app.modules.treatment.schemas.procedure import (
    ProcedureCreate,
    ProcedureResponse,
    ProcedureSummary,
    ProcedureUpdate,
)
from app.modules.treatment.schemas.treatment_plan import (
    AddItemRequest,
    ApprovalResponse,
    CancelPlanRequest,
    CreatePlanRequest,
    DashboardSummaryResponse,
    ItemUpdateRequest,
    ReorderItemsRequest,
    RestoreVersionRequest,
    TreatmentPlanItemResponse,
    TreatmentPlanListItem,
    TreatmentPlanResponse,
    TransitionPlanRequest,
    VersionDetailResponse,
    VersionListItem,
    VersionListResponse,
    VersionRequest,
)


# ======================================================================
# Procedure schemas
# ======================================================================


class TestProcedureCreate:
    def test_valid_minimal(self):
        """Minimal valid payload should succeed."""
        dto = ProcedureCreate(
            code="RCT001",
            name="Root Canal Treatment",
            default_cost=Decimal("15000.00"),
            category=ProcedureCategory.ENDODONTIC,
        )
        assert dto.code == "RCT001"
        assert dto.description is None

    def test_valid_with_description(self):
        dto = ProcedureCreate(
            code="RCT001",
            name="Root Canal Treatment",
            default_cost=Decimal("15000.00"),
            category=ProcedureCategory.ENDODONTIC,
            description="A detailed description",
        )
        assert dto.description == "A detailed description"

    def test_empty_code_raises(self):
        with pytest.raises(ValidationError):
            ProcedureCreate(
                code="",
                name="Test",
                default_cost=Decimal("10.00"),
                category=ProcedureCategory.DIAGNOSTIC,
            )

    def test_negative_cost_raises(self):
        with pytest.raises(ValidationError):
            ProcedureCreate(
                code="TEST",
                name="Test",
                default_cost=Decimal("-10.00"),
                category=ProcedureCategory.DIAGNOSTIC,
            )

    def test_cost_exceeds_max_raises(self):
        with pytest.raises(ValidationError):
            ProcedureCreate(
                code="TEST",
                name="Test",
                default_cost=Decimal("9999999.99"),
                category=ProcedureCategory.DIAGNOSTIC,
            )

    def test_extra_field_raises(self):
        with pytest.raises(ValidationError):
            ProcedureCreate(
                code="TEST",
                name="Test",
                default_cost=Decimal("10.00"),
                category=ProcedureCategory.DIAGNOSTIC,
                extra_field="not allowed",
            )

    def test_invalid_category_raises(self):
        with pytest.raises(ValidationError):
            ProcedureCreate(
                code="TEST",
                name="Test",
                default_cost=Decimal("10.00"),
                category="invalid_category",
            )


class TestProcedureUpdate:
    def test_empty_update(self):
        """Empty update should succeed (all fields optional)."""
        dto = ProcedureUpdate()
        assert dto.model_dump(exclude_unset=True) == {}

    def test_partial_update(self):
        dto = ProcedureUpdate(name="Updated Name")
        data = dto.model_dump(exclude_unset=True)
        assert "name" in data
        assert "default_cost" not in data

    def test_negative_cost_raises(self):
        with pytest.raises(ValidationError):
            ProcedureUpdate(default_cost=Decimal("-1.00"))

    def test_extra_field_raises(self):
        with pytest.raises(ValidationError):
            ProcedureUpdate(unknown="value")


class TestProcedureResponse:
    def test_from_attributes(self):
        """Response schema should support from_attributes=True."""
        dto = ProcedureResponse.model_validate(procedure_data())
        assert dto.id == 1
        assert dto.code == "RCT001"
        assert dto.category == ProcedureCategory.ENDODONTIC

    def test_frozen_immutable(self):
        dto = ProcedureResponse.model_validate(procedure_data())
        with pytest.raises(ValidationError):
            dto.code = "CHANGED"


class TestProcedureSummary:
    def test_from_attributes(self):
        dto = ProcedureSummary.model_validate(procedure_data())
        assert dto.id == 1
        assert dto.code == "RCT001"

    def test_frozen_immutable(self):
        dto = ProcedureSummary.model_validate(procedure_data())
        with pytest.raises(ValidationError):
            dto.name = "Changed"


# ======================================================================
# Treatment Plan request schemas
# ======================================================================


class TestCreatePlanRequest:
    def test_valid_minimal(self):
        dto = CreatePlanRequest(
            patient_id=uuid4(),
            doctor_id=uuid4(),
        )
        assert dto.plan_code is None
        assert dto.clinical_notes is None

    def test_valid_full(self):
        dto = CreatePlanRequest(
            patient_id=uuid4(),
            doctor_id=uuid4(),
            clinical_notes="Notes",
            observations="Obs",
            dentist_recommendations="Recs",
            valid_from=date(2025, 1, 1),
            valid_to=date(2025, 12, 31),
            plan_code="TXN-000001",
        )
        assert dto.plan_code == "TXN-000001"

    def test_empty_string_rejected(self):
        """Empty string should be rejected (min_length=1)."""
        with pytest.raises(ValidationError):
            CreatePlanRequest(
                patient_id=uuid4(),
                doctor_id=uuid4(),
                clinical_notes="",
            )

    def test_extra_field_raises(self):
        with pytest.raises(ValidationError):
            CreatePlanRequest(
                patient_id=uuid4(),
                doctor_id=uuid4(),
                extra="not allowed",
            )


class TestAddItemRequest:
    def test_valid_minimal(self):
        dto = AddItemRequest(
            procedure_id=1,
            sequence_number=1,
        )
        assert dto.discount == Decimal("0.00")
        assert dto.estimated_cost is None

    def test_valid_full(self):
        dto = AddItemRequest(
            procedure_id=1,
            sequence_number=1,
            estimated_cost=Decimal("500.00"),
            discount=Decimal("50.00"),
            tooth_number=11,
            tooth_surface="MOD",
            quadrant=ToothQuadrant.UPPER_RIGHT,
            arch=ToothArch.UPPER,
            notes="Some notes",
        )
        assert dto.tooth_number == 11
        assert dto.quadrant == ToothQuadrant.UPPER_RIGHT

    def test_negative_discount_raises(self):
        with pytest.raises(ValidationError):
            AddItemRequest(
                procedure_id=1,
                sequence_number=1,
                discount=Decimal("-10.00"),
            )

    def test_invalid_tooth_number_raises(self):
        with pytest.raises(ValidationError):
            AddItemRequest(
                procedure_id=1,
                sequence_number=1,
                tooth_number=5,  # Below FDI range
            )

    def test_empty_string_rejected(self):
        with pytest.raises(ValidationError):
            AddItemRequest(
                procedure_id=1,
                sequence_number=1,
                notes="",
            )


class TestItemUpdateRequest:
    def test_empty_update(self):
        dto = ItemUpdateRequest()
        assert dto.model_dump(exclude_unset=True) == {}

    def test_partial_update(self):
        dto = ItemUpdateRequest(sequence_number=5)
        assert dto.model_dump(exclude_unset=True) == {"sequence_number": 5}

    def test_clear_nullable_field(self):
        dto = ItemUpdateRequest(tooth_number=None)
        assert dto.tooth_number is None


class TestTransitionPlanRequest:
    def test_valid(self):
        dto = TransitionPlanRequest(updated_by=1)
        assert dto.updated_by == 1

    def test_zero_updated_by_raises(self):
        with pytest.raises(ValidationError):
            TransitionPlanRequest(updated_by=0)


class TestCancelPlanRequest:
    def test_valid(self):
        dto = CancelPlanRequest(updated_by=1)
        assert dto.updated_by == 1


class TestVersionRequest:
    def test_valid(self):
        dto = VersionRequest(
            change_reason="Cost adjustment",
            changed_by=1,
        )
        assert dto.change_reason == "Cost adjustment"

    def test_empty_reason_raises(self):
        with pytest.raises(ValidationError):
            VersionRequest(change_reason="", changed_by=1)


class TestRestoreVersionRequest:
    def test_valid(self):
        dto = RestoreVersionRequest(changed_by=1)
        assert dto.changed_by == 1


class TestReorderItemsRequest:
    def test_valid(self):
        item_id = uuid4()
        dto = ReorderItemsRequest(item_ids=[item_id])
        assert dto.item_ids == [item_id]

    def test_empty_list_raises(self):
        with pytest.raises(ValidationError):
            ReorderItemsRequest(item_ids=[])


# ======================================================================
# Treatment Plan response schemas
# ======================================================================


class TestTreatmentPlanItemResponse:
    def test_from_attributes(self):
        dto = TreatmentPlanItemResponse.model_validate(item_data())
        assert isinstance(dto.id, UUID)
        assert dto.sequence_number == 1

    def test_with_procedure_summary(self):
        data = item_data()
        data["procedure"] = ProcedureSummary.model_validate(
            procedure_data()
        ).model_dump()
        dto = TreatmentPlanItemResponse.model_validate(data)
        assert dto.procedure is not None
        assert dto.procedure.code == "RCT001"

    def test_item_status_is_enum(self):
        dto = TreatmentPlanItemResponse.model_validate(item_data())
        assert isinstance(dto.item_status, TreatmentPlanItemStatus)


class TestApprovalResponse:
    def test_from_attributes(self):
        dto = ApprovalResponse.model_validate(approval_data())
        assert isinstance(dto.patient_status, PatientAcknowledgmentStatus)

    def test_frozen_immutable(self):
        dto = ApprovalResponse.model_validate(approval_data())
        with pytest.raises(ValidationError):
            dto.patient_status = PatientAcknowledgmentStatus.ACCEPTED


class TestVersionListItem:
    def test_from_attributes(self):
        dto = VersionListItem.model_validate(version_data())
        assert dto.version_number == 1

    def test_frozen_immutable(self):
        dto = VersionListItem.model_validate(version_data())
        with pytest.raises(ValidationError):
            dto.change_reason = "Changed"


class TestVersionDetailResponse:
    def test_from_attributes(self):
        data = version_data()
        data["items_snapshot"] = {"version_number": 1, "items": []}
        dto = VersionDetailResponse.model_validate(data)
        assert isinstance(dto.items_snapshot, dict)
        assert dto.items_snapshot["version_number"] == 1


class TestTreatmentPlanListItem:
    def test_from_attributes(self):
        dto = TreatmentPlanListItem.model_validate(plan_list_data())
        assert dto.status == TreatmentPlanStatus.DRAFT

    def test_computed_defaults(self):
        dto = TreatmentPlanListItem.model_validate(plan_list_data())
        assert dto.item_count == 0
        assert dto.total_estimated_cost == Decimal("0.00")


class TestTreatmentPlanResponse:
    def test_from_attributes(self):
        dto = TreatmentPlanResponse.model_validate(plan_detail_data())
        assert dto.status == TreatmentPlanStatus.DRAFT
        assert isinstance(dto.items, list)
        assert isinstance(dto.versions, list)

    def test_nested_approval_default_none(self):
        dto = TreatmentPlanResponse.model_validate(plan_detail_data())
        assert dto.approval is None


class TestDashboardSummaryResponse:
    def test_valid(self):
        dto = DashboardSummaryResponse(
            total_plans=10,
            by_status=PlanStatusCounts(draft=5, proposed=3, accepted=2),
            pending_review=3,
            pending_approval=2,
            pending_acknowledgment=1,
            active_plans=8,
        )
        assert dto.total_plans == 10
        assert dto.by_status.draft == 5
        assert dto.by_status.proposed == 3

    def test_frozen_immutable(self):
        dto = DashboardSummaryResponse(
            total_plans=10,
            by_status=PlanStatusCounts(),
            pending_review=0,
            pending_approval=0,
            pending_acknowledgment=0,
            active_plans=0,
        )
        with pytest.raises(ValidationError):
            dto.total_plans = 20

    def test_by_status_uses_plan_status_counts(self):
        dto = DashboardSummaryResponse(
            total_plans=10,
            by_status=PlanStatusCounts.from_raw_counts({"draft": 5, "completed": 3}),
            pending_review=3,
            pending_approval=2,
            pending_acknowledgment=1,
            active_plans=8,
        )
        assert dto.by_status.draft == 5
        assert dto.by_status.completed == 3
        assert dto.by_status.accepted == 0  # default


# ======================================================================
# Common schemas
# ======================================================================


class TestStatusTransition:
    def test_valid(self):
        dto = StatusTransition(from_status="draft", to_status="under_review")
        assert dto.from_status == "draft"

    def test_frozen(self):
        dto = StatusTransition(from_status="a", to_status="b")
        with pytest.raises(ValidationError):
            dto.from_status = "changed"


class TestPlanStatusCounts:
    def test_defaults(self):
        dto = PlanStatusCounts()
        assert dto.draft == 0
        assert dto.completed == 0

    def test_from_raw_counts_partial(self):
        dto = PlanStatusCounts.from_raw_counts({"draft": 5, "completed": 3})
        assert dto.draft == 5
        assert dto.completed == 3
        assert dto.under_review == 0  # default

    def test_from_raw_counts_full(self):
        dto = PlanStatusCounts.from_raw_counts(
            {
                "draft": 1, "under_review": 2, "proposed": 3, "rejected": 4,
                "accepted": 5, "in_progress": 6, "on_hold": 7, "completed": 8,
                "cancelled": 9,
            }
        )
        assert dto.accepted == 5
        assert dto.cancelled == 9

    def test_frozen(self):
        dto = PlanStatusCounts()
        with pytest.raises(ValidationError):
            dto.draft = 10


# ======================================================================
# Pagination
# ======================================================================


class TestPaginatedResponse:
    def test_create(self):
        dto = PaginatedResponse.create(
            items=[1, 2, 3], total=50, page=2, page_size=10,
        )
        assert dto.items == [1, 2, 3]
        assert dto.total == 50
        assert dto.page == 2
        assert dto.page_size == 10
        assert dto.total_pages == 5

    def test_create_empty(self):
        dto = PaginatedResponse.create(
            items=[], total=0, page=1, page_size=20,
        )
        assert dto.total_pages == 0

    def test_create_last_page(self):
        dto = PaginatedResponse.create(
            items=[1], total=21, page=3, page_size=10,
        )
        assert dto.total_pages == 3

    def test_generic_type_inference(self):
        dto = PaginatedResponse[str].create(
            items=["a", "b"], total=2, page=1, page_size=10,
        )
        assert dto.items == ["a", "b"]


# ======================================================================
# Error schemas
# ======================================================================


class TestErrorDetail:
    def test_valid(self):
        dto = ErrorDetail(
            code="PLAN_NOT_FOUND",
            message="Plan not found",
            details={"plan_id": "123"},
        )
        assert dto.code == "PLAN_NOT_FOUND"

    def test_default_details_none(self):
        dto = ErrorDetail(code="ERROR", message="Error")
        assert dto.details is None


class TestErrorResponse:
    def test_valid(self):
        dto = ErrorResponse(
            error=ErrorDetail(code="ERROR", message="Error"),
        )
        assert dto.error.code == "ERROR"


class TestValidationErrorItem:
    def test_valid(self):
        dto = ValidationErrorItem(
            field="estimated_cost",
            message="Invalid value",
            rejected_value="-10",
        )
        assert dto.field == "estimated_cost"


class TestValidationErrorResponse:
    def test_valid(self):
        dto = ValidationErrorResponse(
            error=ErrorDetail(code="VALIDATION_ERROR", message="Failed"),
            validation_errors=[
                ValidationErrorItem(field="cost", message="Invalid"),
            ],
        )
        assert len(dto.validation_errors) == 1

    def test_empty_errors(self):
        dto = ValidationErrorResponse(
            error=ErrorDetail(code="VALIDATION_ERROR", message="Failed"),
        )
        assert dto.validation_errors == []


# ======================================================================
# Helper data builders (avoid fixture dependency for pure schema tests)
# ======================================================================


def procedure_data() -> dict:
    return {
        "id": 1,
        "code": "RCT001",
        "name": "Root Canal Treatment",
        "description": None,
        "default_cost": Decimal("15000.00"),
        "category": "endodontic",
        "is_active": True,
    }


def item_data() -> dict:
    return {
        "id": uuid4(),
        "plan_id": uuid4(),
        "procedure_id": 1,
        "procedure": None,
        "sequence_number": 1,
        "tooth_number": None,
        "tooth_surface": None,
        "quadrant": None,
        "arch": None,
        "estimated_cost": Decimal("100.00"),
        "discount": Decimal("0.00"),
        "item_status": "pending",
        "notes": None,
        "appointment_id": None,
        "diagnosis_id": None,
    }


def approval_data() -> dict:
    return {
        "id": uuid4(),
        "approved_by": None,
        "approved_at": None,
        "patient_status": "pending",
        "patient_acknowledged_at": None,
        "approval_notes": None,
    }


def version_data() -> dict:
    return {
        "id": uuid4(),
        "plan_id": uuid4(),
        "version_number": 1,
        "change_reason": "Initial version",
        "changed_by": 1,
        "created_at": datetime.now(timezone.utc),
    }


def plan_list_data() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "plan_code": "TXN-000001",
        "patient_id": uuid4(),
        "doctor_id": uuid4(),
        "status": "draft",
        "current_version": 1,
        "is_active": True,
        "item_count": 0,
        "total_estimated_cost": Decimal("0.00"),
        "created_by": None,
        "created_at": now,
        "updated_at": now,
    }


def plan_detail_data() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid4(),
        "plan_code": "TXN-000001",
        "patient_id": uuid4(),
        "doctor_id": uuid4(),
        "clinical_notes": None,
        "observations": None,
        "dentist_recommendations": None,
        "valid_from": None,
        "valid_to": None,
        "status": "draft",
        "current_version": 1,
        "is_active": True,
        "items": [],
        "approval": None,
        "versions": [],
        "created_by": None,
        "updated_by": None,
        "created_at": now,
        "updated_at": now,
    }
