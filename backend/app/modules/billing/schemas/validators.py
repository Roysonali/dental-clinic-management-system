"""Billing Module — Shared schema validators.

Reusable :class:`~pydantic.field_validator` methods that can be mixed into any
billing schema. Validators are organized as a mixin class (no Pydantic base)
so they compose with :class:`~app.modules.billing.schemas.base.BillingBaseModel`
or any other Pydantic v2 schema class.

Usage
-----
.. code-block:: python

    class InvoiceItemCreate(BillingCreateSchema, BillingValidators):
        unit_price: Decimal = Field(..., ge=0)

        @field_validator("unit_price", mode="before")
        @classmethod
        def _validate_price(cls, value):
            return cls.validate_money_amount(value)
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import field_validator

from app.modules.billing.constants import (
    CURRENCY_CODE_LENGTH,
    DISCOUNT_RATE_DECIMAL_PLACES,
    MAX_MONEY_AMOUNT,
    MIN_MONEY_AMOUNT,
    MONEY_DECIMAL_PLACES,
    TAX_RATE_DECIMAL_PLACES,
)


class BillingValidators:
    """Shared Pydantic field validators for billing schemas.

    Mix this class into any schema that needs standard billing validation.
    Each validator is a classmethod decorated with ``@field_validator`` so
    it can be reused directly or referenced from the consuming schema's own
    validator methods.

    Why ``check_fields=False`` is required
    ---------------------------------------
    The validators in this mixin are designed for reuse across schemas with
    different field names. Setting ``check_fields=False`` allows a single
    validator method (e.g. ``validate_money_amount``) to be attached to
    multiple target fields (``amount``, ``subtotal``, ``tax_total``, etc.)
    without Pydantic enforcing that the decorated method's parameter name
    matches every target field. This intentional trade-off means that a
    misspelled field name is silently ignored, so future developers should
    add targeted ``@field_validator`` decorators on the consuming schema if
    they need field-name validation guarantees.
    """

    @field_validator(
        "amount",
        "subtotal",
        "tax_total",
        "discount_total",
        "grand_total",
        mode="before",
        check_fields=False,
    )
    @classmethod
    def validate_money_amount(cls, value: Any) -> Decimal | None:
        """Normalize and bound a monetary amount.

        * Accepts ``Decimal``, ``str``, ``int``, ``float``.
        * Quantizes to the module's money precision (2 decimal places).
        * Enforces ``[MIN_MONEY_AMOUNT, MAX_MONEY_AMOUNT]``.
        """
        if value is None:
            return value

        if not isinstance(value, Decimal):
            try:
                value = Decimal(str(value))
            except (InvalidOperation, ValueError) as exc:
                raise TypeError(
                    "Money amount must be a valid Decimal value."
                ) from exc

        quantized = value.quantize(Decimal(f"1e-{MONEY_DECIMAL_PLACES}"))

        if quantized < MIN_MONEY_AMOUNT or quantized > MAX_MONEY_AMOUNT:
            raise ValueError(
                f"Money amount must be between {MIN_MONEY_AMOUNT} "
                f"and {MAX_MONEY_AMOUNT}."
            )

        return quantized

    @field_validator("currency_code", mode="before", check_fields=False)
    @classmethod
    def normalize_currency_code(cls, value: Any) -> str | None:
        """Normalize a currency code to uppercase and validate length."""
        if value is None:
            return value

        if not isinstance(value, str):
            raise TypeError("Currency code must be a string.")

        value = value.strip().upper()

        if len(value) != CURRENCY_CODE_LENGTH:
            raise ValueError(
                f"Currency code must be exactly {CURRENCY_CODE_LENGTH} characters."
            )

        return value

    @field_validator("tax_rate", mode="before", check_fields=False)
    @classmethod
    def validate_tax_rate(cls, value: Any) -> Decimal | None:
        """Validate and quantize a tax rate to ``[0, 100]``."""
        if value is None:
            return value

        if not isinstance(value, Decimal):
            try:
                value = Decimal(str(value))
            except (InvalidOperation, ValueError) as exc:
                raise TypeError("Tax rate must be a valid Decimal value.") from exc

        quantized = value.quantize(Decimal(f"1e-{TAX_RATE_DECIMAL_PLACES}"))

        if quantized < 0 or quantized > 100:
            raise ValueError("Tax rate must be between 0 and 100.")

        return quantized

    @field_validator("discount_rate", mode="before", check_fields=False)
    @classmethod
    def validate_discount_rate(cls, value: Any) -> Decimal | None:
        """Validate and quantize a discount rate to ``[0, 100]``."""
        if value is None:
            return value

        if not isinstance(value, Decimal):
            try:
                value = Decimal(str(value))
            except (InvalidOperation, ValueError) as exc:
                raise TypeError("Discount rate must be a valid Decimal value.") from exc

        quantized = value.quantize(Decimal(f"1e-{DISCOUNT_RATE_DECIMAL_PLACES}"))

        if quantized < 0 or quantized > 100:
            raise ValueError("Discount rate must be between 0 and 100.")

        return quantized

    @field_validator("phone", mode="before", check_fields=False)
    @classmethod
    def normalize_phone(cls, value: Any) -> str | None:
        """Strip spaces and hyphens from a phone number string."""
        if value is None:
            return value

        if not isinstance(value, str):
            raise TypeError("Phone number must be a string.")

        return str(value).replace(" ", "").replace("-", "").strip()


__all__ = ["BillingValidators"]
