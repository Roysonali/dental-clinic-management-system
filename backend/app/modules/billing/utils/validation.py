"""Billing Module — Shared validation helpers.

Reusable, side-effect-free validators used by the billing validators and
service layers. These helpers raise billing exceptions (not HTTP errors) so
they compose cleanly inside the application layers; HTTP mapping happens at the
edge in :mod:`app.core.exception_handlers`.

No database access is performed here — every check is purely structural or
financial (precision, sign, currency consistency, enum membership).
"""

from __future__ import annotations

import logging
import re
from decimal import Decimal
from typing import Iterable

from app.modules.billing.constants import (
    ALLOWED_SORT_FIELDS,
    DEFAULT_CURRENCY,
    DEFAULT_PAGE_SIZE,
    MAX_MONEY_AMOUNT,
    MAX_PAGE_SIZE,
)
from app.modules.billing.enums import CurrencyCode
from app.modules.billing.exceptions import (
    BillingValidationError,
    CurrencyMismatch,
    InvoiceValidationFailed,
)
from app.modules.billing.utils.money import (
    MONEY_QUANTIZE_EXPONENT,
    to_decimal,
)

logger = logging.getLogger(__name__)

_CURRENCY_PATTERN = re.compile(r"^[A-Z]{3}$")
_SORT_FIELD_PATTERN = re.compile(r"^[a-z_]+$")


def assert_not_none(value: object, *, field: str) -> None:
    """Raise :class:`BillingValidationError` if ``value`` is ``None``.

    Args:
        value: The value to check.
        field: Field name used in the error message and details.
    """
    if value is None:
        raise BillingValidationError(
            f"Field '{field}' is required",
            details={"field": field},
        )


def assert_positive_int(value: int, *, field: str, minimum: int = 1) -> None:
    """Raise if ``value`` is not an integer ``>= minimum``.

    Args:
        value: The candidate integer.
        field: Field name used for error reporting.
        minimum: Inclusive lower bound (default 1).
    """
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise BillingValidationError(
            f"Field '{field}' must be an integer >= {minimum}",
            details={"field": field, "value": value, "minimum": minimum},
        )


def assert_non_empty_str(value: str, *, field: str) -> None:
    """Raise if ``value`` is not a non-empty, stripped string."""
    if not isinstance(value, str) or not value.strip():
        raise BillingValidationError(
            f"Field '{field}' must be a non-empty string",
            details={"field": field},
        )


def assert_max_length(value: str, max_length: int, *, field: str) -> None:
    """Raise if ``value`` exceeds ``max_length`` characters."""
    if not isinstance(value, str) or len(value) > max_length:
        raise BillingValidationError(
            f"Field '{field}' must be at most {max_length} characters",
            details={"field": field, "max_length": max_length},
        )


def assert_valid_currency_code(code: str) -> CurrencyCode:
    """Validate an ISO 4217 currency code and return the enum member.

    Args:
        code: Candidate code, e.g. ``"USD"``.

    Returns:
        The matched :class:`CurrencyCode` member.

    Raises:
        BillingValidationError: If the code is invalid.
    """
    if not isinstance(code, str) or not _CURRENCY_PATTERN.match(code):
        raise BillingValidationError(
            f"Invalid currency code: {code!r}",
            details={"code": code},
        )
    try:
        return CurrencyCode(code)
    except ValueError as exc:
        raise BillingValidationError(
            f"Unsupported currency code: {code!r}",
            details={"code": code},
        ) from exc


def assert_currency_consistency(
    currencies: Iterable[str],
    *,
    expected: str | None = None,
) -> str:
    """Ensure all supplied currency codes are identical.

    Args:
        currencies: Iterable of currency codes (may be empty).
        expected: Optional expected currency; if omitted, the first code wins.

    Returns:
        The agreed currency code.

    Raises:
        CurrencyMismatch: If more than one distinct currency is present.
    """
    distinct: set[str] = {c for c in currencies if c}
    if not distinct:
        return expected or DEFAULT_CURRENCY.value
    if len(distinct) > 1:
        raise CurrencyMismatch(
            expected=expected or next(iter(distinct)),
            actual=", ".join(sorted(distinct)),
        )
    resolved = next(iter(distinct))
    if expected is not None and resolved != expected:
        raise CurrencyMismatch(expected=expected, actual=resolved)
    return resolved


def assert_money_precision(value: Decimal | str | int | float, *, field: str) -> Decimal:
    """Validate that a monetary value is non-negative and within precision.

    Args:
        value: The candidate amount.
        field: Field name used for error reporting.

    Returns:
        The value quantized to the money scale.

    Raises:
        BillingValidationError: On negative value, parse error, or overflow.
    """
    try:
        amount = to_decimal(value)
    except (ValueError, ArithmeticError) as exc:
        raise BillingValidationError(
            f"Field '{field}' is not a valid amount",
            details={"field": field, "value": str(value)},
        ) from exc

    if amount < Decimal("0"):
        from app.modules.billing.exceptions import NegativeAmountNotAllowed

        raise NegativeAmountNotAllowed(field=field, value=amount)

    quantized = amount.quantize(MONEY_QUANTIZE_EXPONENT)
    if quantized > MAX_MONEY_AMOUNT:
        from app.modules.billing.exceptions import PrecisionExceeded

        raise PrecisionExceeded(field=field, value=quantized)
    return quantized


def assert_enum_member(
    value: str,
    enum_cls: type,
    *,
    field: str,
) -> object:
    """Validate that ``value`` is a member of ``enum_cls`` and return it.

    Args:
        value: The candidate enum value (string or enum member).
        enum_cls: The target ``str, Enum`` subclass.
        field: Field name used for error reporting.

    Returns:
        The resolved enum member.

    Raises:
        BillingValidationError: If the value is not a valid member.
    """
    try:
        return enum_cls(value)
    except ValueError as exc:
        raise BillingValidationError(
            f"Field '{field}' must be one of "
            f"{sorted(m.value for m in enum_cls)}",
            details={
                "field": field,
                "value": value,
                "allowed": sorted(m.value for m in enum_cls),
            },
        ) from exc


def normalize_pagination(
    page: int | None,
    page_size: int | None,
) -> tuple[int, int]:
    """Coerce raw pagination inputs into safe, bounded values.

    Args:
        page: 1-based page number (defaults to 1 when invalid).
        page_size: Items per page (bounded by :data:`MAX_PAGE_SIZE`).

    Returns:
        A tuple of ``(page, page_size)``.
    """
    safe_page = page if isinstance(page, int) and page >= 1 else 1
    if not isinstance(page_size, int) or page_size < 1:
        safe_size = DEFAULT_PAGE_SIZE
    else:
        safe_size = min(page_size, MAX_PAGE_SIZE)
    return safe_page, safe_size


def normalize_sort_field(sort_field: str | None) -> str:
    """Return a safe sort field, falling back to the default.

    Args:
        sort_field: Candidate sort field from client input.

    Returns:
        A field present in :data:`ALLOWED_SORT_FIELDS`, else the default.
    """
    if (
        isinstance(sort_field, str)
        and _SORT_FIELD_PATTERN.match(sort_field)
        and sort_field in ALLOWED_SORT_FIELDS
    ):
        return sort_field
    from app.modules.billing.constants import DEFAULT_SORT_FIELD

    return DEFAULT_SORT_FIELD


def assert_min_line_items(count: int, *, minimum: int) -> None:
    """Raise if an invoice has fewer than the required number of line items.

    Args:
        count: Number of line items.
        minimum: Minimum required (typically 1, per FI-INV-002).

    Raises:
        InvoiceValidationFailed: If ``count < minimum``.
    """
    if count < minimum:
        raise InvoiceValidationFailed(
            f"Invoice must contain at least {minimum} line item(s)",
            details={"count": count, "minimum": minimum},
        )


__all__ = [
    "assert_not_none",
    "assert_positive_int",
    "assert_non_empty_str",
    "assert_max_length",
    "assert_valid_currency_code",
    "assert_currency_consistency",
    "assert_money_precision",
    "assert_enum_member",
    "normalize_pagination",
    "normalize_sort_field",
    "assert_min_line_items",
]
