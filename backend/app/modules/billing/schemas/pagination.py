"""Billing Module — Pagination DTOs.

Pagination parameters for query strings and the standard paginated response
wrapper. The response types are re-exported from :mod:`common` so that
consumers can import pagination concerns from a single location.
"""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import Field, field_validator

from app.modules.billing.schemas.base import BillingBaseModel
from app.modules.billing.schemas.common import SortOrder

T = TypeVar("T")


class PaginationRequest(BillingBaseModel):
    """Query parameters for paginated list endpoints.

    Fields map directly to FastAPI query parameters. FastAPI validates
    ``page`` and ``page_size`` bounds; ``sort_order`` is normalized to
    lowercase and validated against :class:`SortOrder`.
    """

    page: int = Field(
        default=1,
        ge=1,
        title="Page",
        description="1-based page number.",
        examples=[1],
    )
    page_size: int = Field(
        default=20,
        ge=1,
        le=100,
        title="Page Size",
        description="Number of items per page (max 100).",
        examples=[20],
    )
    sort_by: str | None = Field(
        default=None,
        title="Sort By",
        description="Field name to sort by.",
        examples=["created_at"],
    )
    sort_order: SortOrder = Field(
        default=SortOrder.ASC,
        title="Sort Order",
        description="Sort direction.",
        examples=["asc"],
    )


__all__ = [
    "PaginationRequest",
]
