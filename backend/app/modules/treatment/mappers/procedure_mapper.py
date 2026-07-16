"""ProcedureMapper — stateless ORM-to-DTO conversion.

Converts ``Procedure`` ORM instances to Pydantic response DTOs.
All response schemas declare ``from_attributes=True`` so Pydantic
can perform the base conversion automatically. The mapper provides
a single entry point and collection utilities.
"""

from __future__ import annotations

from typing import Any, Sequence

from app.modules.treatment.schemas.pagination import PaginatedResponse
from app.modules.treatment.schemas.procedure import (
    ProcedureResponse,
    ProcedureSummary,
)


class ProcedureMapper:
    """Stateless converter between ``Procedure`` ORM instances and DTOs.

    Every method is a ``@staticmethod`` — no state, no side effects.
    """

    # ==================================================================
    # Single-record conversions
    # ==================================================================

    @staticmethod
    def to_summary(procedure: Any) -> ProcedureSummary:
        """Convert a ``Procedure`` ORM instance to the summary schema.

        The summary schema includes id, code, name, category,
        default_cost, and is_active.

        Args:
            procedure: A ``Procedure`` ORM instance.

        Returns:
            A ``ProcedureSummary``.
        """
        return ProcedureSummary.model_validate(procedure)

    @staticmethod
    def to_response(procedure: Any) -> ProcedureResponse:
        """Convert a ``Procedure`` ORM instance to the full response schema.

        Args:
            procedure: A ``Procedure`` ORM instance.

        Returns:
            A ``ProcedureResponse``.
        """
        return ProcedureResponse.model_validate(procedure)

    # ==================================================================
    # Collection conversions
    # ==================================================================

    @staticmethod
    def to_response_list(
        procedures: Sequence[Any],
    ) -> list[ProcedureResponse]:
        """Convert a sequence of Procedures to a list of response DTOs.

        Args:
            procedures: Iterable of ``Procedure`` ORM instances.

        Returns:
            A list of ``ProcedureResponse`` objects.
        """
        return [ProcedureMapper.to_response(p) for p in procedures]

    @staticmethod
    def to_summary_list(
        procedures: Sequence[Any],
    ) -> list[ProcedureSummary]:
        """Convert a sequence of Procedures to a list of summary DTOs.

        Args:
            procedures: Iterable of ``Procedure`` ORM instances.

        Returns:
            A list of ``ProcedureSummary`` objects.
        """
        return [ProcedureMapper.to_summary(p) for p in procedures]

    @staticmethod
    def to_paginated(
        procedures: Sequence[Any],
        total: int,
        page: int,
        page_size: int,
    ) -> PaginatedResponse[ProcedureResponse]:
        """Wrap a page of procedures in the standard paginated response.

        Args:
            procedures: Items for the current page.
            total: Total count across all pages.
            page: Current page number.
            page_size: Items per page.

        Returns:
            A ``PaginatedResponse`` containing ``ProcedureResponse`` items.
        """
        return PaginatedResponse.create(
            items=ProcedureMapper.to_response_list(procedures),
            total=total,
            page=page,
            page_size=page_size,
        )
