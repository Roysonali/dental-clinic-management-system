"""Billing Module.

Structured dental clinic billing: invoice-centric aggregate, line items,
payments, receipts, credit notes, and financial reporting.

This package contains the full billing module implementation including:
domain enums, constants, exceptions, dependency providers, SQLAlchemy models,
repositories, money/numbering/validation utilities, shared mixins, shared
DTOs, service layer, and validators. Routers and tests are implemented in
subsequent sprints.
"""

from __future__ import annotations

from app.modules.billing import (
    constants,
    enums,
    exceptions,
)
from app.modules.billing.schemas import common as schemas_common
from app.modules.billing.utils import (
    money,
    numbering,
    validation,
)

__all__ = [
    "constants",
    "enums",
    "exceptions",
    "schemas_common",
    "money",
    "numbering",
    "validation",
]
