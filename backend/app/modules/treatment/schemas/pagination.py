"""Treatment Plan module — pagination DTO.

Standardised paginated response wrapper used by every
list endpoint in the treatment module.
"""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standardised paginated response envelope.

    Every list endpoint returns this shape so that API consumers
    (mobile, React, third-party) always receive a consistent
    pagination contract.

    Fields:
        items: The list of items for the current page.
        total: Total number of items matching the query.
        page: 1-based current page number.
        page_size: Number of items per page.
        total_pages: Total number of pages (computed as ``ceil(total / page_size)``).
    """

    items: list[T] = Field(
        ...,
        title="Items",
        description="List of items on the current page.",
    )
    total: int = Field(
        ...,
        ge=0,
        title="Total",
        description="Total number of items matching the query.",
        examples=[42],
    )
    page: int = Field(
        ...,
        ge=1,
        title="Page",
        description="Current page number (1-based).",
        examples=[1],
    )
    page_size: int = Field(
        ...,
        ge=1,
        title="Page Size",
        description="Number of items per page.",
        examples=[20],
    )
    total_pages: int = Field(
        ...,
        ge=0,
        title="Total Pages",
        description="Total number of pages.",
        examples=[3],
    )

    @classmethod
    def create(
        cls,
        items: list[T],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        """Build a response from raw pagination values.

        Computes ``total_pages`` automatically.

        Args:
            items: Items for the current page.
            total: Total item count.
            page: Current page number.
            page_size: Page size.

        Returns:
            A ready-to-serialise ``PaginatedResponse``.
        """
        total_pages = max(0, (total + page_size - 1) // page_size) if page_size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
