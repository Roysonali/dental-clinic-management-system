"""Billing Module — Money utilities.

Stateless helpers for exact decimal money arithmetic that conform to the
Billing Money Handling Policy (``docs/billing/database/15-money-handling-policy.md``).

Guarantees
----------
* **No ``float``** — every value is a :class:`decimal.Decimal`.
* **Half-up rounding** to 2 decimal places for monetary values, configured by
  :data:`app.modules.billing.constants.MONEY_DECIMAL_PLACES`.
* **No intermediate rounding** — computations carry full precision and quantize
  only at the final step (per the rounding philosophy in the policy).
* **Sign and precision guards** — helpers raise billing financial exceptions
  when an amount would be negative or exceed column precision.

These helpers are pure functions: they never touch the database, never commit,
and never manage sessions.
"""

from __future__ import annotations

import logging
from decimal import (
    ROUND_HALF_UP,
    Decimal,
    InvalidOperation,
)
from typing import Iterable

from app.modules.billing.constants import (
    MAX_MONEY_AMOUNT,
    MIN_MONEY_AMOUNT,
    MONEY_DECIMAL_PLACES,
    MONEY_QUANTIZE_EXPONENT,
    TAX_RATE_DECIMAL_PLACES,
    TAX_RATE_QUANTIZE_EXPONENT,
    DISCOUNT_RATE_DECIMAL_PLACES,
    DISCOUNT_RATE_QUANTIZE_EXPONENT,
)
from app.modules.billing.exceptions import (
    BillingFinancialError,
    NegativeAmountNotAllowed,
    PrecisionExceeded,
)

logger = logging.getLogger(__name__)

# Accepted numeric inputs for coercion.
DecimalInput = str | int | float | Decimal


def to_decimal(value: DecimalInput | None) -> Decimal:
    """Coerce a value to :class:`Decimal`, rejecting ``float`` via explicit intent.

    ``float`` inputs are rounded through ``str(float)`` to avoid silent binary
    error; callers should prefer passing ``str`` or ``Decimal`` directly.

    Args:
        value: A string, int, float, or Decimal to convert.

    Returns:
        The equivalent :class:`Decimal`.

    Raises:
        ValueError: If the value cannot be parsed as a decimal.
    """
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:  # pragma: no cover - defensive
        raise ValueError(f"Cannot convert {value!r} to Decimal") from exc


def quantize_money(value: DecimalInput) -> Decimal:
    """Round a monetary value to the policy scale using half-up rounding.

    Args:
        value: The amount to quantize (string/int/float/Decimal).

    Returns:
        A :class:`Decimal` rounded to :data:`MONEY_DECIMAL_PLACES`.
    """
    amount = to_decimal(value)
    return amount.quantize(MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP)


def quantize_tax_rate(value: DecimalInput) -> Decimal:
    """Round a tax rate to ``NUMERIC(5,3)`` scale using half-up rounding."""
    rate = to_decimal(value)
    return rate.quantize(TAX_RATE_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP)


def quantize_discount_rate(value: DecimalInput) -> Decimal:
    """Round a discount rate to ``NUMERIC(5,2)`` scale using half-up rounding."""
    rate = to_decimal(value)
    return rate.quantize(DISCOUNT_RATE_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP)


def require_non_negative(value: DecimalInput, *, field: str) -> Decimal:
    """Validate and return a non-negative monetary amount.

    Args:
        value: The amount to validate.
        field: Field name used in the raised exception / logs.

    Returns:
        The validated :class:`Decimal` amount.

    Raises:
        NegativeAmountNotAllowed: If the amount is below zero.
    """
    amount = to_decimal(value)
    if amount < MIN_MONEY_AMOUNT:
        logger.warning("Negative amount rejected: field=%s value=%s", field, amount)
        raise NegativeAmountNotAllowed(field=field, value=amount)
    return amount


def require_within_precision(value: DecimalInput, *, field: str) -> Decimal:
    """Validate a monetary amount against the column precision bound.

    Args:
        value: The amount to validate.
        field: Field name used in the raised exception / logs.

    Returns:
        The validated, quantized :class:`Decimal` amount.

    Raises:
        NegativeAmountNotAllowed: If the amount is below zero.
        PrecisionExceeded: If the amount exceeds :data:`MAX_MONEY_AMOUNT`.
    """
    amount = require_non_negative(value, field=field)
    quantized = quantize_money(amount)
    if quantized > MAX_MONEY_AMOUNT:
        logger.warning(
            "Precision exceeded: field=%s value=%s max=%s",
            field,
            quantized,
            MAX_MONEY_AMOUNT,
        )
        raise PrecisionExceeded(field=field, value=quantized)
    return quantized


def calculate_line_subtotal(unit_price: DecimalInput, quantity: int) -> Decimal:
    """Compute ``unit_price × quantity`` without intermediate rounding.

    Args:
        unit_price: Per-unit charge (non-negative).
        quantity: Positive integer quantity.

    Returns:
        The exact (unquantized) line subtotal as a :class:`Decimal`.
    """
    price = require_non_negative(unit_price, field="unit_price")
    if quantity < 1:
        raise BillingFinancialError(
            "Line item quantity must be >= 1",
            details={"field": "quantity", "value": quantity},
        )
    return (price * Decimal(quantity)).quantize(
        MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP
    )


def calculate_discount_amount(
    subtotal: DecimalInput,
    discount_rate: DecimalInput,
) -> Decimal:
    """Compute the discount amount for a subtotal at a given percentage rate.

    ``discount_amount = subtotal × (rate / 100)``, rounded to the policy scale.

    Args:
        subtotal: The line subtotal (non-negative).
        discount_rate: Percentage rate in ``[0, 100]``.

    Returns:
        The rounded discount amount as a :class:`Decimal`.
    """
    base = require_non_negative(subtotal, field="subtotal")
    rate = quantize_discount_rate_validated(discount_rate)
    return (base * (rate / Decimal(100))).quantize(
        MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP
    )


def calculate_net_amount(
    subtotal: DecimalInput,
    discount_amount: DecimalInput,
) -> Decimal:
    """Compute ``net = subtotal − discount`` without intermediate rounding.

    Args:
        subtotal: The line subtotal (non-negative).
        discount_amount: The discount applied (non-negative, <= subtotal).

    Returns:
        The rounded net amount as a :class:`Decimal`.
    """
    sub = require_non_negative(subtotal, field="subtotal")
    disc = require_non_negative(discount_amount, field="discount_amount")
    if disc > sub:
        raise BillingFinancialError(
            "Discount cannot exceed the line subtotal",
            details={"subtotal": str(sub), "discount": str(disc)},
        )
    return (sub - disc).quantize(MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP)


def calculate_tax_amount(
    net_amount: DecimalInput,
    tax_rate: DecimalInput,
) -> Decimal:
    """Compute the tax amount for a net amount at a given percentage rate.

    ``tax_amount = net × (rate / 100)``, rounded per line item (the legally
    required approach). Summing these per-line results yields the invoice tax.

    Args:
        net_amount: The net (post-discount) amount (non-negative).
        tax_rate: Percentage rate in ``[0, 100]``.

    Returns:
        The rounded tax amount as a :class:`Decimal`.
    """
    net = require_non_negative(net_amount, field="net_amount")
    rate = quantize_tax_rate_validated(tax_rate)
    return (net * (rate / Decimal(100))).quantize(
        MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP
    )


def sum_money(amounts: Iterable[DecimalInput]) -> Decimal:
    """Sum monetary values exactly and quantize once at the end.

    Args:
        amounts: An iterable of monetary values.

    Returns:
        The exact sum as a quantized :class:`Decimal`.
    """
    total = Decimal("0")
    for amount in amounts:
        total += to_decimal(amount)
    return total.quantize(MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP)


def calculate_invoice_total(
    net_amounts: Iterable[DecimalInput],
    tax_amounts: Iterable[DecimalInput],
) -> Decimal:
    """Derive the invoice grand total: ``Σ net + Σ tax`` (FI-INV-004).

    Both sums are exact before the single final quantization, honoring the
    "no stored totals / no intermediate rounding" policy.

    Args:
        net_amounts: Iterable of per-line net amounts.
        tax_amounts: Iterable of per-line tax amounts.

    Returns:
        The invoice grand total as a quantized :class:`Decimal`.
    """
    total_net = sum_money(net_amounts)
    total_tax = sum_money(tax_amounts)
    return (total_net + total_tax).quantize(
        MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP
    )


def calculate_outstanding_balance(
    grand_total: DecimalInput,
    paid_amount: DecimalInput,
    refunded_amount: DecimalInput,
    applied_credit: DecimalInput,
) -> Decimal:
    """Derive the outstanding balance (FI-CROSS-001).

    ``balance = grand_total − paid + refunded − applied_credit``. Values are
    clamped to be non-negative on input; the result is never negative here
    (a negative result means overpaid, expressed as zero owed).

    Args:
        grand_total: Invoice grand total.
        paid_amount: Sum of payments allocated to the invoice.
        refunded_amount: Sum of refunds.
        applied_credit: Sum of credit notes applied.

    Returns:
        The outstanding balance as a quantized :class:`Decimal`.
    """
    total = require_non_negative(grand_total, field="grand_total")
    paid = require_non_negative(paid_amount, field="paid_amount")
    refunded = require_non_negative(refunded_amount, field="refunded_amount")
    credit = require_non_negative(applied_credit, field="applied_credit")
    balance = (total - paid + refunded - credit).quantize(
        MONEY_QUANTIZE_EXPONENT, rounding=ROUND_HALF_UP
    )
    return balance if balance >= MIN_MONEY_AMOUNT else MIN_MONEY_AMOUNT


def quantize_discount_rate_validated(value: DecimalInput) -> Decimal:
    """Quantize and bound a discount rate to ``[0, MAX_DISCOUNT_RATE]``."""
    from app.modules.billing.constants import (
        MAX_DISCOUNT_RATE,
        MIN_DISCOUNT_RATE,
    )

    rate = quantize_discount_rate(value)
    if rate < MIN_DISCOUNT_RATE or rate > MAX_DISCOUNT_RATE:
        raise BillingFinancialError(
            "Discount rate out of bounds",
            details={"rate": str(rate)},
        )
    return rate


def quantize_tax_rate_validated(value: DecimalInput) -> Decimal:
    """Quantize and bound a tax rate to ``[0, MAX_TAX_RATE]``."""
    from app.modules.billing.constants import (
        MAX_TAX_RATE,
        MIN_TAX_RATE,
    )

    rate = quantize_tax_rate(value)
    if rate < MIN_TAX_RATE or rate > MAX_TAX_RATE:
        raise BillingFinancialError(
            "Tax rate out of bounds",
            details={"rate": str(rate)},
        )
    return rate


def format_money(value: DecimalInput, *, currency_code: str | None = None) -> str:
    """Format a monetary value for display (2 dp, thousands separators).

    Display rounding never alters the stored value — this is purely
    presentational (see Money Handling Policy §5).

    Args:
        value: The amount to format.
        currency_code: Optional ISO 4217 code prefixed to the output.

    Returns:
        A human-readable currency string, e.g. ``"$1,234.56"`` or
        ``"USD 1,234.56"``.
    """
    amount = quantize_money(value)
    formatted = f"{amount:,.{MONEY_DECIMAL_PLACES}f}"
    if currency_code:
        return f"{currency_code} {formatted}"
    return formatted


__all__ = [
    "DecimalInput",
    "to_decimal",
    "quantize_money",
    "quantize_tax_rate",
    "quantize_discount_rate",
    "require_non_negative",
    "require_within_precision",
    "calculate_line_subtotal",
    "calculate_discount_amount",
    "calculate_net_amount",
    "calculate_tax_amount",
    "sum_money",
    "calculate_invoice_total",
    "calculate_outstanding_balance",
    "quantize_discount_rate_validated",
    "quantize_tax_rate_validated",
    "format_money",
]
