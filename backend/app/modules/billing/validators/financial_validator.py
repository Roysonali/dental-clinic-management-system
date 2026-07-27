"""FinancialValidator — centralized financial business-rule validation.

This module groups reusable monetary and percentage validations so that
entity-specific validators (invoice, payment, etc.) do not duplicate
financial logic.

Responsibilities
----------------
* **Money**: positive amounts, non-negative values, precision guards.
* **Currency**: code format, consistency across collections.
* **Percentage**: bounds checking for discount and tax rates.
* **Balance**: remaining amount, outstanding balance, allocation limits.
* **Rounding**: quantize validation against the money handling policy.

Design
------
* **Stateless** — instance holds no mutable state.
* **No I/O** — never accesses the database or calls repositories.
* **Approved exceptions only** — raises billing financial and validation
  exceptions.
* **Composable** — entity validators call these helpers directly.

Integration example::

    from app.modules.billing.validators import FinancialValidator

    validator = FinancialValidator()
    validator.validate_positive_amount(amount, field="total_amount")
    validator.validate_currency_consistency([invoice.currency_code, payment.currency_code])
"""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from app.modules.billing.constants import (
    DEFAULT_CURRENCY,
    MAX_MONEY_AMOUNT,
    MIN_MONEY_AMOUNT,
    MONEY_QUANTIZE_EXPONENT,
)
from app.modules.billing.enums import CurrencyCode
from app.modules.billing.exceptions import (
    BillingValidationError,
    CurrencyMismatch,
    GrandTotalMismatch,
    NegativeAmountNotAllowed,
    PaymentExceedsInvoice,
    PrecisionExceeded,
    RefundExceedsPayment,
)
from app.modules.billing.utils.money import (
    quantize_discount_rate_validated,
    quantize_tax_rate_validated,
    to_decimal,
)


class FinancialValidator:
    """Centralized financial business-rule validator.

    Args:
        None — this class is stateless.
    """

    # ------------------------------------------------------------------
    # Money / amount validators
    # ------------------------------------------------------------------

    def validate_positive_amount(
        self,
        value: object,
        *,
        field: str = "amount",
    ) -> Decimal:
        """Validate that ``value`` is a positive monetary amount.

        Args:
            value: The amount to validate.
            field: Field name used in error reporting.

        Returns:
            The validated :class:`Decimal` amount, quantized to money scale.

        Raises:
            BillingValidationError: If ``value`` cannot be parsed as a decimal.
            NegativeAmountNotAllowed: If ``value`` is below zero.
            PrecisionExceeded: If ``value`` exceeds ``MAX_MONEY_AMOUNT``.
        """
        try:
            amount = to_decimal(value)
        except (ValueError, ArithmeticError) as exc:
            raise BillingValidationError(
                f"Field '{field}' is not a valid amount",
                details={"field": field, "value": str(value)},
            ) from exc

        if amount <= MIN_MONEY_AMOUNT:
            raise NegativeAmountNotAllowed(
                field=field,
                value=amount,
                details={"field": field, "value": str(amount)},
            )

        quantized = amount.quantize(MONEY_QUANTIZE_EXPONENT)
        if quantized > MAX_MONEY_AMOUNT:
            raise PrecisionExceeded(
                field=field,
                value=quantized,
                details={"field": field, "value": str(quantized)},
            )
        return quantized

    def validate_non_negative_amount(
        self,
        value: object,
        *,
        field: str = "amount",
    ) -> Decimal:
        """Validate that ``value`` is a non-negative monetary amount.

        Args:
            value: The amount to validate.
            field: Field name used in error reporting.

        Returns:
            The validated :class:`Decimal` amount, quantized to money scale.

        Raises:
            BillingValidationError: If ``value`` cannot be parsed as a decimal.
            NegativeAmountNotAllowed: If ``value`` is below zero.
            PrecisionExceeded: If ``value`` exceeds ``MAX_MONEY_AMOUNT``.
        """
        try:
            amount = to_decimal(value)
        except (ValueError, ArithmeticError) as exc:
            raise BillingValidationError(
                f"Field '{field}' is not a valid amount",
                details={"field": field, "value": str(value)},
            ) from exc

        if amount < MIN_MONEY_AMOUNT:
            raise NegativeAmountNotAllowed(
                field=field,
                value=amount,
                details={"field": field, "value": str(amount)},
            )

        quantized = amount.quantize(MONEY_QUANTIZE_EXPONENT)
        if quantized > MAX_MONEY_AMOUNT:
            raise PrecisionExceeded(
                field=field,
                value=quantized,
                details={"field": field, "value": str(quantized)},
            )
        return quantized

    # ------------------------------------------------------------------
    # Currency validators
    # ------------------------------------------------------------------

    def validate_currency_code(self, code: object) -> str:
        """Validate that ``code`` is a supported ISO 4217 currency code.

        Args:
            code: Candidate currency code.

        Returns:
            The validated, upper-cased currency code string.

        Raises:
            BillingValidationError: If the code is invalid.
        """
        if not isinstance(code, str):
            raise BillingValidationError(
                f"Currency code must be a string, got {type(code).__name__!r}",
                details={"code": str(code)},
            )

        normalized = code.strip().upper()
        if not normalized:
            raise BillingValidationError(
                "Currency code is required",
                details={"code": code},
            )

        if normalized not in CurrencyCode.all_values():
            raise BillingValidationError(
                f"Unsupported currency code: {code!r}. "
                f"Must be one of: {', '.join(sorted(CurrencyCode.all_values()))}",
                details={
                    "code": code,
                    "allowed": sorted(CurrencyCode.all_values()),
                },
            )
        return normalized

    def validate_currency_consistency(
        self,
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
                details={
                    "expected": expected or next(iter(distinct)),
                    "actual": sorted(distinct),
                },
            )
        resolved = next(iter(distinct))
        if expected is not None and resolved != expected:
            raise CurrencyMismatch(
                expected=expected,
                actual=resolved,
                details={"expected": expected, "actual": resolved},
            )
        return resolved

    # ------------------------------------------------------------------
    # Percentage / rate validators
    # ------------------------------------------------------------------

    def validate_discount_rate(self, value: object) -> Decimal:
        """Validate a discount percentage is within ``[0, 100]``.

        Args:
            value: The rate to validate.

        Returns:
            The validated, quantized :class:`Decimal` rate.

        Raises:
            BillingValidationError: If ``value`` cannot be parsed.
        """
        try:
            return quantize_discount_rate_validated(value)
        except Exception as exc:
            raise BillingValidationError(
                f"Invalid discount rate: {value!r}",
                details={"rate": str(value)},
            ) from exc

    def validate_tax_rate(self, value: object) -> Decimal:
        """Validate a tax rate percentage is within ``[0, 100]``.

        Phase-2 ready — tax rates are not yet persisted in Phase 1.

        Args:
            value: The rate to validate.

        Returns:
            The validated, quantized :class:`Decimal` rate.

        Raises:
            BillingValidationError: If ``value`` cannot be parsed.
        """
        try:
            return quantize_tax_rate_validated(value)
        except Exception as exc:
            raise BillingValidationError(
                f"Invalid tax rate: {value!r}",
                details={"rate": str(value)},
            ) from exc

    # ------------------------------------------------------------------
    # Balance / allocation validators
    # ------------------------------------------------------------------

    def validate_allocation_amount(
        self,
        allocated: object,
        available: object,
        *,
        field: str = "allocated_amount",
    ) -> Decimal:
        """Validate that an allocation does not exceed the available amount.

        Args:
            allocated: The amount being allocated.
            available: The total available amount.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` allocation.

        Raises:
            BillingValidationError: If ``allocated`` cannot be parsed.
            NegativeAmountNotAllowed: If ``allocated`` is negative.
            PaymentExceedsInvoice: If ``allocated`` exceeds ``available``.
        """
        alloc = self.validate_positive_amount(allocated, field=field)
        avail = self.validate_non_negative_amount(available, field="available_amount")

        if alloc > avail:
            raise PaymentExceedsInvoice(
                details={
                    "allocated": str(alloc),
                    "available": str(avail),
                }
            )
        return alloc

    def validate_refund_amount(
        self,
        refund: object,
        original: object,
        *,
        field: str = "refund_amount",
    ) -> Decimal:
        """Validate that a refund does not exceed the original payment amount.

        Args:
            refund: The refund amount.
            original: The original payment amount.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` refund.

        Raises:
            BillingValidationError: If ``refund`` cannot be parsed.
            NegativeAmountNotAllowed: If ``refund`` is negative.
            RefundExceedsPayment: If ``refund`` exceeds ``original``.
        """
        ref = self.validate_positive_amount(refund, field=field)
        orig = self.validate_non_negative_amount(original, field="original_amount")

        if ref > orig:
            raise RefundExceedsPayment(
                details={
                    "refund": str(ref),
                    "original": str(orig),
                }
            )
        return ref

    def validate_remaining_amount(
        self,
        remaining: object,
        original: object,
        *,
        field: str = "remaining_amount",
    ) -> Decimal:
        """Validate that ``remaining`` is within ``[0, original]``.

        Args:
            remaining: The remaining amount.
            original: The original amount.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` remaining amount.

        Raises:
            BillingValidationError: If values cannot be parsed.
            NegativeAmountNotAllowed: If ``remaining`` is negative.
        """
        rem = self.validate_non_negative_amount(remaining, field=field)
        orig = self.validate_non_negative_amount(original, field="original_amount")

        if rem > orig:
            raise BillingValidationError(
                f"Field '{field}' ({rem}) exceeds original amount ({orig})",
                details={
                    "field": field,
                    "remaining": str(rem),
                    "original": str(orig),
                },
            )
        return rem

    def validate_credit_application(
        self,
        credit_balance: object,
        application_amount: object,
        *,
        field: str = "credit_application_amount",
    ) -> Decimal:
        """Validate that a credit application does not exceed the credit balance.

        Args:
            credit_balance: Available credit balance.
            application_amount: Amount to apply.
            field: Field name used in error reporting.

        Returns:
            The validated, quantized :class:`Decimal` application amount.

        Raises:
            BillingValidationError: If values cannot be parsed.
            NegativeAmountNotAllowed: If ``application_amount`` is negative.
        """
        bal = self.validate_non_negative_amount(credit_balance, field="credit_balance")
        app = self.validate_positive_amount(application_amount, field=field)

        if app > bal:
            raise BillingValidationError(
                f"Credit application ({app}) exceeds available balance ({bal})",
                details={
                    "field": field,
                    "application": str(app),
                    "balance": str(bal),
                },
            )
        return app

    # ------------------------------------------------------------------
    # Total / rounding validators
    # ------------------------------------------------------------------

    def validate_grand_total_consistency(
        self,
        provided_total: object,
        computed_total: object,
    ) -> Decimal:
        """Validate that the provided total matches the computed total.

        Args:
            provided_total: Total supplied by the caller.
            computed_total: Total derived from line items.

        Returns:
            The validated, quantized :class:`Decimal` computed total.

        Raises:
            GrandTotalMismatch: If the totals differ after quantization.
        """
        prov = self.validate_non_negative_amount(
            provided_total, field="provided_total"
        )
        comp = self.validate_non_negative_amount(
            computed_total, field="computed_total"
        )

        prov_q = prov.quantize(MONEY_QUANTIZE_EXPONENT)
        comp_q = comp.quantize(MONEY_QUANTIZE_EXPONENT)

        if prov_q != comp_q:
            raise GrandTotalMismatch(
                provided=prov_q,
                computed=comp_q,
                details={
                    "provided": str(prov_q),
                    "computed": str(comp_q),
                },
            )
        return comp_q

    def validate_rounding(
        self,
        value: object,
        *,
        field: str = "amount",
    ) -> Decimal:
        """Validate that ``value`` can be quantized to the money scale.

        Args:
            value: The amount to validate.
            field: Field name used in error reporting.

        Returns:
            The quantized :class:`Decimal` value.

        Raises:
            BillingValidationError: If ``value`` cannot be parsed.
            NegativeAmountNotAllowed: If ``value`` is negative.
            PrecisionExceeded: If ``value`` exceeds ``MAX_MONEY_AMOUNT``.
        """
        return self.validate_non_negative_amount(value, field=field)


__all__ = ["FinancialValidator"]
