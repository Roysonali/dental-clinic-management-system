"""TreatmentPlanMapper — stateless ORM-to-DTO conversion.

Converts ``TreatmentPlan`` aggregate ORM instances to Pydantic
response DTOs, including nested items, approval, and version
snapshots. All response schemas declare ``from_attributes=True``
so the base conversion is automatic; the mapper provides a single
entry point and handles nested transformations.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Sequence

from app.modules.treatment.schemas.pagination import PaginatedResponse
from app.modules.treatment.schemas.common import PlanStatusCounts
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
from app.modules.treatment.mappers.procedure_mapper import ProcedureMapper


class TreatmentPlanMapper:
    """Stateless converter between ORM instances and response DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Item conversion
    # ==================================================================

    @staticmethod
    def to_item_response(item: Any) -> TreatmentPlanItemResponse:
        """Convert a ``TreatmentPlanItem`` ORM instance to its response DTO.

        Attaches a ``ProcedureSummary`` from the item's ``procedure``
        relationship when available.

        Args:
            item: A ``TreatmentPlanItem`` ORM instance.

        Returns:
            A ``TreatmentPlanItemResponse``.
        """
        response = TreatmentPlanItemResponse.model_validate(item)
        if item.procedure is not None:
            response.procedure = ProcedureMapper.to_summary(item.procedure)
        return response

    @staticmethod
    def to_item_response_list(
        items: Sequence[Any],
    ) -> list[TreatmentPlanItemResponse]:
        """Convert a sequence of items to a list of response DTOs.

        Args:
            items: Iterable of ``TreatmentPlanItem`` ORM instances.

        Returns:
            A list of ``TreatmentPlanItemResponse`` objects.
        """
        return [TreatmentPlanMapper.to_item_response(i) for i in items]

    # ==================================================================
    # Approval conversion
    # ==================================================================

    @staticmethod
    def to_approval_response(approval: Any | None) -> ApprovalResponse | None:
        """Convert a ``TreatmentPlanApproval`` ORM instance to its DTO.

        Args:
            approval: A ``TreatmentPlanApproval`` ORM instance or ``None``.

        Returns:
            An ``ApprovalResponse`` or ``None``.
        """
        if approval is None:
            return None
        return ApprovalResponse.model_validate(approval)

    # ==================================================================
    # Version conversion
    # ==================================================================

    @staticmethod
    def to_version_list_item(version: Any) -> VersionListItem:
        """Convert a ``TreatmentPlanVersion`` ORM instance to list-item DTO.

        Args:
            version: A ``TreatmentPlanVersion`` ORM instance.

        Returns:
            A ``VersionListItem``.
        """
        return VersionListItem.model_validate(version)

    @staticmethod
    def to_version_detail(version: Any) -> VersionDetailResponse:
        """Convert a ``TreatmentPlanVersion`` ORM instance to detail DTO.

        Includes the full ``items_snapshot`` JSONB payload.

        Args:
            version: A ``TreatmentPlanVersion`` ORM instance.

        Returns:
            A ``VersionDetailResponse``.
        """
        return VersionDetailResponse.model_validate(version)

    @staticmethod
    def to_version_list(
        versions: Sequence[Any],
    ) -> VersionListResponse:
        """Convert a sequence of versions to a list response.

        Args:
            versions: Iterable of ``TreatmentPlanVersion`` ORM instances.

        Returns:
            A ``VersionListResponse``.
        """
        return VersionListResponse(
            items=[TreatmentPlanMapper.to_version_list_item(v) for v in versions],
        )

    # ==================================================================
    # Plan conversion
    # ==================================================================

    @staticmethod
    def to_list_item(plan: Any) -> TreatmentPlanListItem:
        """Convert a ``TreatmentPlan`` ORM instance to a list-item DTO.

        Computes ``item_count`` and ``total_estimated_cost`` from the
        plan's ``items`` collection (if loaded).

        Args:
            plan: A ``TreatmentPlan`` ORM instance (items may or may
                not be eager-loaded).

        Returns:
            A ``TreatmentPlanListItem``.
        """
        response = TreatmentPlanListItem.model_validate(plan)

        # Compute derived fields from lazily-loaded items if available.
        if hasattr(plan, "items") and plan.items is not None:
            items = list(plan.items)
            response.item_count = len(items)
            response.total_estimated_cost = sum(
                (i.estimated_cost for i in items),
                type(plan.items[0].estimated_cost)(0) if items else Decimal("0.00"),
            )
        return response

    @staticmethod
    def to_response(plan: Any) -> TreatmentPlanResponse:
        """Convert a full ``TreatmentPlan`` aggregate to its response DTO.

        Includes nested items (with procedure summaries), approval record,
        and version list items.

        The caller is responsible for ensuring relationships are loaded
        (via ``get_with_items``, ``get_complete_aggregate``, etc.) before
        calling this method.

        Args:
            plan: A ``TreatmentPlan`` ORM instance with its ``items``,
                ``approval``, and ``versions`` relationships loaded.

        Returns:
            A ``TreatmentPlanResponse``.
        """
        response = TreatmentPlanResponse.model_validate(plan)

        if hasattr(plan, "items") and plan.items is not None:
            response.items = TreatmentPlanMapper.to_item_response_list(plan.items)

        if hasattr(plan, "approval") and plan.approval is not None:
            response.approval = TreatmentPlanMapper.to_approval_response(plan.approval)

        if hasattr(plan, "versions") and plan.versions is not None:
            response.versions = [
                TreatmentPlanMapper.to_version_list_item(v) for v in plan.versions
            ]

        return response

    # ==================================================================
    # Collection conversions
    # ==================================================================

    @staticmethod
    def to_list_item_list(
        plans: Sequence[Any],
    ) -> list[TreatmentPlanListItem]:
        """Convert a sequence of plans to a list of list-item DTOs.

        Args:
            plans: Iterable of ``TreatmentPlan`` ORM instances.

        Returns:
            A list of ``TreatmentPlanListItem`` objects.
        """
        return [TreatmentPlanMapper.to_list_item(p) for p in plans]

    @staticmethod
    def to_paginated(
        plans: Sequence[Any],
        total: int,
        page: int,
        page_size: int,
    ) -> PaginatedResponse[TreatmentPlanListItem]:
        """Wrap a page of plans in the standard paginated response.

        Args:
            plans: Items for the current page.
            total: Total count across all pages.
            page: Current page number.
            page_size: Items per page.

        Returns:
            A ``PaginatedResponse`` containing ``TreatmentPlanListItem`` items.
        """
        return PaginatedResponse.create(
            items=TreatmentPlanMapper.to_list_item_list(plans),
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    def to_dashboard_summary(
        total_plans: int,
        by_status: dict[str, int],
        pending_review: int,
        pending_approval: int,
        pending_acknowledgment: int,
        active_plans: int,
    ) -> DashboardSummaryResponse:
        """Build a dashboard summary DTO from pre-computed values.

        Args:
            total_plans: Total plan count.
            by_status: Breakdown by status label.
            pending_review: Plans in UNDER_REVIEW status.
            pending_approval: Plans awaiting doctor approval.
            pending_acknowledgment: Plans awaiting patient acknowledgment.
            active_plans: Plans with is_active = True.

        Returns:
            A ``DashboardSummaryResponse``.
        """
        return DashboardSummaryResponse(
            total_plans=total_plans,
            by_status=PlanStatusCounts.from_raw_counts(by_status),
            pending_review=pending_review,
            pending_approval=pending_approval,
            pending_acknowledgment=pending_acknowledgment,
            active_plans=active_plans,
        )
