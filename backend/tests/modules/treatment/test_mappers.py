"""Tests for the Treatment Plan module mappers (ORM → DTO conversion).

These tests use mocked ORM objects to verify that every mapper method
produces correctly-shaped DTOs. No database dependency.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.modules.treatment.enums import (
    PatientAcknowledgmentStatus,
    ProcedureCategory,
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)
from app.modules.treatment.mappers.procedure_mapper import ProcedureMapper
from app.modules.treatment.mappers.treatment_plan_mapper import (
    TreatmentPlanMapper,
)
from app.modules.treatment.schemas.common import PlanStatusCounts
from app.modules.treatment.schemas.pagination import PaginatedResponse
from app.modules.treatment.schemas.procedure import (
    ProcedureResponse,
    ProcedureSummary,
)
from app.modules.treatment.schemas.treatment_plan import (
    ApprovalResponse,
    DashboardSummaryResponse,
    TreatmentPlanItemResponse,
    TreatmentPlanListItem,
    TreatmentPlanResponse,
    VersionDetailResponse,
    VersionListItem,
    VersionListResponse,
)


# ======================================================================
# ProcedureMapper
# ======================================================================


class TestProcedureMapper:
    def test_to_summary(self):
        """to_summary should convert a mock ORM to ProcedureSummary."""
        mock = _mock_procedure()
        dto = ProcedureMapper.to_summary(mock)
        assert isinstance(dto, ProcedureSummary)
        assert dto.id == 1
        assert dto.code == "RCT001"
        assert dto.category == ProcedureCategory.ENDODONTIC
        assert dto.default_cost == Decimal("100.00")
        assert dto.is_active is True

    def test_to_response(self):
        """to_response should include description."""
        mock = _mock_procedure(description="A test procedure")
        dto = ProcedureMapper.to_response(mock)
        assert isinstance(dto, ProcedureResponse)
        assert dto.description == "A test procedure"

    def test_to_response_list(self):
        """to_response_list should produce a list of DTOs."""
        mocks = [_mock_procedure(code="A"), _mock_procedure(code="B")]
        dtos = ProcedureMapper.to_response_list(mocks)
        assert len(dtos) == 2
        assert all(isinstance(d, ProcedureResponse) for d in dtos)

    def test_to_summary_list(self):
        """to_summary_list should produce a list of summary DTOs."""
        mocks = [_mock_procedure(), _mock_procedure()]
        dtos = ProcedureMapper.to_summary_list(mocks)
        assert len(dtos) == 2
        assert all(isinstance(d, ProcedureSummary) for d in dtos)

    def test_to_paginated(self):
        """to_paginated should wrap DTOs in PaginatedResponse."""
        mocks = [_mock_procedure(code="A"), _mock_procedure(code="B")]
        result = ProcedureMapper.to_paginated(mocks, total=10, page=1, page_size=5)
        assert isinstance(result, PaginatedResponse)
        assert len(result.items) == 2
        assert result.total == 10
        assert result.page == 1
        assert result.page_size == 5
        assert result.total_pages == 2

    def test_to_paginated_empty(self):
        result = ProcedureMapper.to_paginated([], total=0, page=1, page_size=20)
        assert result.items == []
        assert result.total_pages == 0

    def test_to_summary_without_description(self):
        """Procedure without description should still work."""
        mock = _mock_procedure(description=None)
        dto = ProcedureMapper.to_summary(mock)
        assert dto.code == "RCT001"

    def test_to_response_inactive_procedure(self):
        """Inactive procedure should be mapped correctly."""
        mock = _mock_procedure(is_active=False)
        dto = ProcedureMapper.to_response(mock)
        assert dto.is_active is False


# ======================================================================
# TreatmentPlanMapper — items
# ======================================================================


class TestTreatmentPlanMapperItem:
    def test_to_item_response(self):
        """to_item_response should convert an item ORM to DTO."""
        item = _mock_item()
        dto = TreatmentPlanMapper.to_item_response(item)
        assert isinstance(dto, TreatmentPlanItemResponse)
        assert dto.sequence_number == 1
        assert dto.item_status == TreatmentPlanItemStatus.PENDING

    def test_to_item_response_with_procedure(self):
        """to_item_response should attach ProcedureSummary when procedure exists."""
        item = _mock_item(procedure=_mock_procedure())
        dto = TreatmentPlanMapper.to_item_response(item)
        assert dto.procedure is not None
        assert dto.procedure.code == "RCT001"

    def test_to_item_response_list(self):
        items = [_mock_item(), _mock_item()]
        dtos = TreatmentPlanMapper.to_item_response_list(items)
        assert len(dtos) == 2

    def test_to_item_response_with_none_procedure(self):
        item = _mock_item(procedure=None)
        dto = TreatmentPlanMapper.to_item_response(item)
        assert dto.procedure is None


# ======================================================================
# TreatmentPlanMapper — approval
# ======================================================================


class TestTreatmentPlanMapperApproval:
    def test_to_approval_response(self):
        approval = _mock_approval()
        dto = TreatmentPlanMapper.to_approval_response(approval)
        assert isinstance(dto, ApprovalResponse)
        assert dto.patient_status == PatientAcknowledgmentStatus.PENDING

    def test_to_approval_response_none(self):
        assert TreatmentPlanMapper.to_approval_response(None) is None

    def test_to_approval_response_signed(self):
        approval = _mock_approval(approved_by=1)
        dto = TreatmentPlanMapper.to_approval_response(approval)
        assert dto.approved_by == 1


# ======================================================================
# TreatmentPlanMapper — versions
# ======================================================================


class TestTreatmentPlanMapperVersion:
    def test_to_version_list_item(self):
        v = _mock_version()
        dto = TreatmentPlanMapper.to_version_list_item(v)
        assert isinstance(dto, VersionListItem)
        assert dto.version_number == 1

    def test_to_version_detail(self):
        v = _mock_version(items_snapshot={"version_number": 1, "items": []})
        dto = TreatmentPlanMapper.to_version_detail(v)
        assert isinstance(dto, VersionDetailResponse)
        assert "items" in dto.items_snapshot

    def test_to_version_list(self):
        versions = [_mock_version(version_number=1), _mock_version(version_number=2)]
        result = TreatmentPlanMapper.to_version_list(versions)
        assert isinstance(result, VersionListResponse)
        assert len(result.items) == 2


# ======================================================================
# TreatmentPlanMapper — plans
# ======================================================================


class TestTreatmentPlanMapperPlan:
    def test_to_list_item(self):
        plan = _mock_plan()
        dto = TreatmentPlanMapper.to_list_item(plan)
        assert isinstance(dto, TreatmentPlanListItem)
        assert dto.status == TreatmentPlanStatus.DRAFT
        assert dto.item_count == 0

    def test_to_list_item_with_items(self):
        """to_list_item should compute item_count and total from items."""
        plan = _mock_plan(
            items=[_mock_item(estimated_cost=Decimal("100.00")),
                   _mock_item(estimated_cost=Decimal("200.00"))]
        )
        dto = TreatmentPlanMapper.to_list_item(plan)
        assert dto.item_count == 2
        assert dto.total_estimated_cost == Decimal("300.00")

    def test_to_list_item_with_no_items(self):
        plan = _mock_plan(items=[])
        dto = TreatmentPlanMapper.to_list_item(plan)
        assert dto.item_count == 0
        assert dto.total_estimated_cost == Decimal("0.00")

    def test_to_response(self):
        plan = _mock_plan(
            items=[_mock_item(procedure=_mock_procedure())],
            approval=_mock_approval(),
            versions=[_mock_version(version_number=1)],
        )
        dto = TreatmentPlanMapper.to_response(plan)
        assert isinstance(dto, TreatmentPlanResponse)
        assert len(dto.items) == 1
        assert dto.approval is not None
        assert len(dto.versions) == 1

    def test_to_response_with_empty_children(self):
        plan = _mock_plan(items=[], approval=None, versions=[])
        dto = TreatmentPlanMapper.to_response(plan)
        assert dto.items == []
        assert dto.approval is None
        assert dto.versions == []

    def test_to_list_item_list(self):
        plans = [_mock_plan(), _mock_plan()]
        dtos = TreatmentPlanMapper.to_list_item_list(plans)
        assert len(dtos) == 2

    def test_to_paginated(self):
        plans = [_mock_plan(), _mock_plan()]
        result = TreatmentPlanMapper.to_paginated(plans, total=10, page=1, page_size=5)
        assert isinstance(result, PaginatedResponse)
        assert len(result.items) == 2
        assert result.total_pages == 2

    def test_to_paginated_empty(self):
        result = TreatmentPlanMapper.to_paginated([], total=0, page=1, page_size=20)
        assert result.total_pages == 0


# ======================================================================
# TreatmentPlanMapper — dashboard
# ======================================================================


class TestTreatmentPlanMapperDashboard:
    def test_to_dashboard_summary(self):
        dto = TreatmentPlanMapper.to_dashboard_summary(
            total_plans=100,
            by_status={"draft": 30, "proposed": 20, "completed": 50},
            pending_review=10,
            pending_approval=5,
            pending_acknowledgment=3,
            active_plans=80,
        )
        assert isinstance(dto, DashboardSummaryResponse)
        assert dto.total_plans == 100
        assert dto.by_status.draft == 30
        assert dto.pending_review == 10
        assert dto.active_plans == 80

    def test_to_dashboard_summary_uses_plan_status_counts(self):
        dto = TreatmentPlanMapper.to_dashboard_summary(
            total_plans=10,
            by_status={"draft": 5},
            pending_review=2,
            pending_approval=1,
            pending_acknowledgment=0,
            active_plans=8,
        )
        assert isinstance(dto.by_status, PlanStatusCounts)
        assert dto.by_status.draft == 5
        assert dto.by_status.accepted == 0  # not in input, defaults to 0


# ======================================================================
# Mock helpers (avoid DB dependency)
# ======================================================================


class _MockORM:
    """Simple attribute-backed mock for ORM instances.

    Usage::

        mock = _MockORM(id=1, code="TEST", items=[...])
        mapper.to_response(mock)  # model_validate reads attributes
    """

    def __init__(self, **kwargs: Any) -> None:
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self) -> str:
        return f"<_MockORM({self.__dict__})>"


def _mock_procedure(
    code: str = "RCT001",
    name: str = "Root Canal Treatment",
    category: ProcedureCategory = ProcedureCategory.ENDODONTIC,
    default_cost: Decimal = Decimal("100.00"),
    is_active: bool = True,
    description: str | None = "A procedure",
) -> _MockORM:
    return _MockORM(
        id=1,
        code=code,
        name=name,
        category=category,
        default_cost=default_cost,
        is_active=is_active,
        description=description,
    )


def _mock_item(
    sequence_number: int = 1,
    estimated_cost: Decimal = Decimal("100.00"),
    discount: Decimal = Decimal("0.00"),
    quantity: int = 1,
    item_status: TreatmentPlanItemStatus = TreatmentPlanItemStatus.PENDING,
    procedure: Any = None,
    **extra: Any,
) -> _MockORM:
    defaults = dict(
        id=uuid4(),
        plan_id=uuid4(),
        procedure_id=1,
        procedure=procedure,
        sequence_number=sequence_number,
        tooth_number=None,
        tooth_surface=None,
        quadrant=None,
        arch=None,
        quantity=quantity,
        estimated_cost=estimated_cost,
        discount=discount,
        item_status=item_status,
        notes=None,
        appointment_id=None,
        diagnosis_id=None,
    )
    defaults.update(extra)
    return _MockORM(**defaults)


def _mock_approval(
    approved_by: int | None = None,
    patient_status: PatientAcknowledgmentStatus = PatientAcknowledgmentStatus.PENDING,
    **extra: Any,
) -> _MockORM:
    defaults = dict(
        id=uuid4(),
        approved_by=approved_by,
        approved_at=datetime.now(timezone.utc) if approved_by else None,
        patient_status=patient_status,
        patient_acknowledged_at=None,
        approval_notes=None,
    )
    defaults.update(extra)
    return _MockORM(**defaults)


def _mock_version(
    version_number: int = 1,
    change_reason: str = "Initial version",
    changed_by: int = 1,
    items_snapshot: dict[str, Any] | None = None,
    **extra: Any,
) -> _MockORM:
    defaults = dict(
        id=uuid4(),
        plan_id=uuid4(),
        version_number=version_number,
        change_reason=change_reason,
        changed_by=changed_by,
        created_at=datetime.now(timezone.utc),
        items_snapshot=items_snapshot or {},
    )
    defaults.update(extra)
    return _MockORM(**defaults)


def _mock_plan(
    plan_code: str = "TXN-000001",
    status: TreatmentPlanStatus = TreatmentPlanStatus.DRAFT,
    items: list[Any] | None = None,
    approval: Any = None,
    versions: list[Any] | None = None,
    **extra: Any,
) -> _MockORM:
    now = datetime.now(timezone.utc)
    defaults = dict(
        id=uuid4(),
        plan_code=plan_code,
        patient_id=uuid4(),
        doctor_id=uuid4(),
        clinical_notes=None,
        observations=None,
        dentist_recommendations=None,
        valid_from=None,
        valid_to=None,
        status=status,
        current_version=1,
        lock_version=1,
        is_active=True,
        items=items or [],
        approval=approval,
        versions=versions or [],
        created_by=None,
        updated_by=None,
        created_at=now,
        updated_at=now,
    )
    defaults.update(extra)
    return _MockORM(**defaults)
