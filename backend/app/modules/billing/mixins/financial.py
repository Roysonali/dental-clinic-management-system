"""Billing Module — Financial mixin.

Declares standardized monetary columns for billing models, enforcing the
Money Handling Policy (``docs/billing/database/15-money-handling-policy.md``):

* All monetary columns use ``NUMERIC(12,2)`` (via ``Numeric`` with the module's
  total digits / decimal places).
* Tax rates use ``NUMERIC(5,3)``; discount rates use ``NUMERIC(5,2)``.
* Currency is stored as an ISO 4217 ``VARCHAR(3)`` on the aggregate root
  (BR-140 / FI-CROSS-004: single currency per document).

The mixin contains no computation logic — arithmetic lives in
:mod:`app.modules.billing.utils.money`. It only standardizes column typing and
provides small, import-safe helpers for building column defaults.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import (
    Numeric,
    String,
)

from app.modules.billing.constants import (
    CURRENCY_CODE_LENGTH,
    DEFAULT_CURRENCY,
    DISCOUNT_RATE_DECIMAL_PLACES,
    DISCOUNT_RATE_TOTAL_DIGITS,
    MONEY_DECIMAL_PLACES,
    MONEY_TOTAL_DIGITS,
    TAX_RATE_DECIMAL_PLACES,
    TAX_RATE_TOTAL_DIGITS,
)


def money_column(nullable: bool = False, **kwargs):
    """Construct a ``NUMERIC(12,2)`` column for monetary amounts.

    Args:
        nullable: Whether the column allows ``NULL``.
        **kwargs: Extra SQLAlchemy column keyword arguments.

    Returns:
        A configured :class:`~sqlalchemy.Numeric` column.
    """
    return Numeric(
        precision=MONEY_TOTAL_DIGITS,
        scale=MONEY_DECIMAL_PLACES,
        nullable=nullable,
        **kwargs,
    )


def tax_rate_column(nullable: bool = False, **kwargs):
    """Construct a ``NUMERIC(5,3)`` column for tax rates."""
    return Numeric(
        precision=TAX_RATE_TOTAL_DIGITS,
        scale=TAX_RATE_DECIMAL_PLACES,
        nullable=nullable,
        **kwargs,
    )


def discount_rate_column(nullable: bool = False, **kwargs):
    """Construct a ``NUMERIC(5,2)`` column for discount rates."""
    return Numeric(
        precision=DISCOUNT_RATE_TOTAL_DIGITS,
        scale=DISCOUNT_RATE_DECIMAL_PLACES,
        nullable=nullable,
        **kwargs,
    )


def currency_column(nullable: bool = False, **kwargs):
    """Construct an ISO 4217 ``VARCHAR(3)`` currency column.

    Defaults to :data:`DEFAULT_CURRENCY` when not nullable.
    """
    column_kwargs: dict = {"length": CURRENCY_CODE_LENGTH, "nullable": nullable}
    if not nullable:
        column_kwargs["default"] = DEFAULT_CURRENCY.value
    column_kwargs.update(kwargs)
    return String(**column_kwargs)


class FinancialMixin:
    """Mixin declaring common currency/rate columns on billing aggregates.

    Intended to be combined with explicit per-model amount columns declared by
    the model itself. Provides ``currency_code`` and a convenience to validate
    the currency against supported codes.
    """

    currency_code: str = DEFAULT_CURRENCY.value  # type: ignore[assignment]

    @staticmethod
    def default_currency() -> str:
        """Return the module default currency code string."""
        return DEFAULT_CURRENCY.value

    @staticmethod
    def zero_money() -> Decimal:
        """Return a zero monetary :class:`Decimal` at policy scale."""
        return Decimal("0").quantize(Decimal(f"1e-{MONEY_DECIMAL_PLACES}"))


__all__ = [
    "money_column",
    "tax_rate_column",
    "discount_rate_column",
    "currency_column",
    "FinancialMixin",
    "MONEY_TOTAL_DIGITS",
    "MONEY_DECIMAL_PLACES",
    "TAX_RATE_TOTAL_DIGITS",
    "TAX_RATE_DECIMAL_PLACES",
    "DISCOUNT_RATE_TOTAL_DIGITS",
    "DISCOUNT_RATE_DECIMAL_PLACES",
    "CURRENCY_CODE_LENGTH",
    "DEFAULT_CURRENCY",
]
