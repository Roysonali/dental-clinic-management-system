"""Billing Module.

Structured dental clinic billing: invoice-centric aggregate, line items,
payments, receipts, credit notes, and financial reporting.

This package currently contains **foundation** code only: enums, constants,
exceptions, dependency providers, money/numbering/validation utilities, shared
mixins, and shared DTOs. No models, repositories, services, routers, or
business workflows are implemented at this stage of the sprint.
"""

from __future__ import annotations

from app.modules.billing import (
    constants,
    dependencies,
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
    "dependencies",
    "enums",
    "exceptions",
    "money",
    "numbering",
    "schemas_common",
    "validation",
]
