"""Billing Module — Common field types.

Centralizes type aliases and re-exports Pydantic v2 constrained types so that
billing schemas do not scatter import-from-pydantic statements across many
files. These aliases serve as documentation and a single place to adjust type
contracts if billing requirements evolve.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from pydantic import (
    EmailStr,
    Field,
    StringConstraints,
)

# Core monetary type alias
MoneyType = Decimal

# Currency code (ISO 4217, 3 chars)
CurrencyCodeType = str

# UUID as string
UUIDStr = str

# Email type (validated by pydantic-extra-types)
Email = EmailStr

# Phone number with basic E.164-ish pattern
PhoneStr = Annotated[
    str,
    StringConstraints(
        pattern=r"^\+?[1-9]\d{6,14}$",
        min_length=7,
        max_length=15,
    ),
]

# Constrained decimal aliases (actual constraints applied via Field(...))
PositiveDecimal = Annotated[Decimal, Field(gt=0)]
NonNegativeDecimal = Annotated[Decimal, Field(ge=0)]
TaxRateType = Decimal
DiscountRateType = Decimal

__all__ = [
    "CurrencyCodeType",
    "DiscountRateType",
    "Email",
    "MoneyType",
    "NonNegativeDecimal",
    "PhoneStr",
    "PositiveDecimal",
    "TaxRateType",
    "UUIDStr",
]
