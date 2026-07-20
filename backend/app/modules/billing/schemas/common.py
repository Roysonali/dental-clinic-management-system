"""Billing Module — Shared DTOs.

Reusable Pydantic v2 request/response types and value objects shared across
multiple billing schema files. These are pure data containers with complete
type hints and docstrings; they contain no business logic.

Conventions mirror the Treatment Plan module schemas: ``ConfigDict(frozen=True)``
for immutable response envelopes and ``Field(...)`` metadata for OpenAPI docs.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class Money(BaseModel):
    """Immutable monetary value object with currency.

    Wraps a :class:`decimal.Decimal` amount and an ISO 4217 currency code so
    that amounts are never passed around as bare floats/strings.
    """

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    amount: Decimal = Field(
        ...,
        title="Amount",
        description="Exact monetary amount (Decimal, 2 decimal places).",
        examples=[Decimal("1250.00")],
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        description="ISO 4217 three-letter currency code.",
        examples=["USD"],
    )


class MoneyBreakdown(BaseModel):
    """Detailed monetary breakdown for an invoice or line item."""

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    subtotal: Decimal = Field(
        ...,
        title="Subtotal",
        description="Sum of line net amounts before tax.",
        examples=[Decimal("1000.00")],
    )
    discount_total: Decimal = Field(
        default=Decimal("0.00"),
        title="Discount Total",
        description="Total discount applied.",
    )
    tax_total: Decimal = Field(
        default=Decimal("0.00"),
        title="Tax Total",
        description="Total tax applied (sum of per-line tax).",
    )
    grand_total: Decimal = Field(
        ...,
        title="Grand Total",
        description="Derived total: subtotal - discount + tax.",
    )
    currency_code: str = Field(
        ...,
        min_length=3,
        max_length=3,
        title="Currency Code",
        examples=["USD"],
    )


class InvoiceStatusTransition(BaseModel):
    """Describes a single allowed invoice status transition for API consumers."""

    model_config = ConfigDict(frozen=True)

    from_status: str = Field(
        ...,
        title="From Status",
        description="Current invoice status.",
        examples=["draft"],
    )
    to_status: str = Field(
        ...,
        title="To Status",
        description="Target status the invoice can transition to.",
        examples=["issued"],
    )


class PaginationMeta(BaseModel):
    """Standard pagination metadata envelope."""

    model_config = ConfigDict(frozen=True)

    page: int = Field(..., ge=1, title="Page", description="1-based page number.")
    page_size: int = Field(..., ge=1, title="Page Size", description="Items per page.")
    total_items: int = Field(
        ..., ge=0, title="Total Items", description="Total matching items."
    )
    total_pages: int = Field(
        ..., ge=0, title="Total Pages", description="Total number of pages."
    )


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    model_config = ConfigDict(frozen=True, arbitrary_types_allowed=True)

    items: list[T] = Field(..., title="Items", description="Page items.")
    pagination: PaginationMeta = Field(
        ..., title="Pagination", description="Pagination metadata."
    )


class ErrorDetail(BaseModel):
    """Structured single error detail."""

    model_config = ConfigDict(frozen=True)

    code: str = Field(..., title="Code", description="Stable machine-readable code.")
    message: str = Field(..., title="Message", description="Human-readable message.")
    details: dict | None = Field(
        default=None, title="Details", description="Optional structured context."
    )


class ErrorResponse(BaseModel):
    """Standard error envelope returned by the billing handlers."""

    model_config = ConfigDict(frozen=True)

    success: bool = Field(
        default=False, title="Success", description="Always false for errors."
    )
    message: str = Field(..., title="Message", description="Top-level error message.")
    error: ErrorDetail = Field(..., title="Error", description="Structured error.")


__all__ = [
    "Money",
    "MoneyBreakdown",
    "InvoiceStatusTransition",
    "PaginationMeta",
    "PaginatedResponse",
    "ErrorDetail",
    "ErrorResponse",
]
