"""Treatment Plan Module — Shared constants.

Holds non-business static configuration: code-generation prefixes, validation
ranges, pagination defaults, and the state-machine transition tables consumed
by ``state_machine.py`` and the service layer.

Only stable, deployment-wide values belong here. Display strings and
user-facing messages are kept in the exception/router layers.

Design notes
------------
* Monetary constants use :class:`decimal.Decimal` to avoid binary float error
  when compared against ``Numeric``/``Decimal`` database columns.
* The transition maps (``PLAN_TRANSITIONS`` / ``ITEM_TRANSITIONS``) are the
  **single source of truth** for allowed status transitions and are expressed
  with enum members. The serialized ``VALID_*_TRANSITIONS`` dicts (string
  keys/values) are derived from them purely for persistence/serialization.
* ``terminal_statuses()`` on the enums is derived from these maps, so the
  business rule is defined exactly once.
"""

from __future__ import annotations

from decimal import Decimal

from app.modules.treatment.enums import (
    TreatmentPlanItemStatus,
    TreatmentPlanStatus,
)

# ==========================================================
# Plan code generation
# ==========================================================
TREATMENT_PLAN_CODE_PREFIX = "TXN"
TREATMENT_PLAN_CODE_SEQUENCE_WIDTH = 6

# ==========================================================
# Validation constants
# ==========================================================
# Tooth number ranges (FDI two-digit notation)
FDI_PERMANENT_MIN = 11
FDI_PERMANENT_MAX = 48
FDI_PRIMARY_MIN = 51
FDI_PRIMARY_MAX = 85
FDI_VALID_RANGES: tuple[tuple[int, int], ...] = ((11, 48), (51, 85))

# Valid single-letter tooth surface codes. Combinations are validated
# dynamically (see ``is_valid_tooth_surface_combination``), so no hardcoded
# enumeration of every legal pairing is maintained.
VALID_TOOTH_SURFACES: frozenset[str] = frozenset({"M", "D", "B", "L", "O", "I"})

# Maximum field lengths
PLAN_CODE_MAX_LENGTH = 20
PROCEDURE_CODE_MAX_LENGTH = 20
PROCEDURE_NAME_MAX_LENGTH = 200
CLINICAL_NOTES_MAX_LENGTH = 5000
CHANGE_REASON_MAX_LENGTH = 500
APPROVAL_NOTES_MAX_LENGTH = 500
TOOTH_SURFACE_MAX_LENGTH = 10
QUADRANT_MAX_LENGTH = 5
ARCH_MAX_LENGTH = 10

# ==========================================================
# Financial constants (Decimal to match Numeric columns)
# ==========================================================
MAX_ESTIMATED_COST = Decimal("999999.99")
MIN_ESTIMATED_COST = Decimal("0.00")
DEFAULT_PROCEDURE_COST = Decimal("0.00")

# ==========================================================
# Pagination constants
# ==========================================================
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_SORT_FIELD = "created_at"
# Default result cap for the procedure catalog type-ahead search.
PROCEDURE_SEARCH_DEFAULT_LIMIT = 20
# Default result cap for the treatment plan search/type-ahead.
TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT = 20
ALLOWED_SORT_FIELDS: frozenset[str] = frozenset(
    {
        "created_at",
        "status",
        "plan_code",
    }
)

# ==========================================================
# Business constants
# ==========================================================
# Minimum items required to leave Draft status
MIN_PLAN_ITEMS_FOR_SUBMISSION = 1
# Default version number for new plans
INITIAL_VERSION_NUMBER = 1
# Maximum sequence number per plan (documented upper bound for item ordering)
MAX_SEQUENCE_NUMBER = 999
# Item quantity bounds
MIN_ITEM_QUANTITY = 1
MAX_ITEM_QUANTITY = 999

# ==========================================================
# State machine configuration (single source of truth)
# ==========================================================
# Enum-member transition maps. ``terminal`` statuses are those with an empty
# target set (consumed by ``TreatmentPlanStatus.terminal_statuses``).
PLAN_TRANSITIONS: dict[TreatmentPlanStatus, frozenset[TreatmentPlanStatus]] = {
    TreatmentPlanStatus.DRAFT: frozenset(
        {
            TreatmentPlanStatus.UNDER_REVIEW,
            TreatmentPlanStatus.CANCELLED,
        }
    ),
    TreatmentPlanStatus.UNDER_REVIEW: frozenset(
        {
            TreatmentPlanStatus.PROPOSED,
            TreatmentPlanStatus.DRAFT,
            TreatmentPlanStatus.CANCELLED,
        }
    ),
    TreatmentPlanStatus.PROPOSED: frozenset(
        {
            TreatmentPlanStatus.ACCEPTED,
            TreatmentPlanStatus.DRAFT,
            TreatmentPlanStatus.CANCELLED,
            TreatmentPlanStatus.REJECTED,
        }
    ),
    TreatmentPlanStatus.REJECTED: frozenset(
        {
            TreatmentPlanStatus.DRAFT,
            TreatmentPlanStatus.CANCELLED,
        }
    ),
    TreatmentPlanStatus.ACCEPTED: frozenset(
        {
            TreatmentPlanStatus.IN_PROGRESS,
            TreatmentPlanStatus.CANCELLED,
        }
    ),
    TreatmentPlanStatus.IN_PROGRESS: frozenset(
        {
            TreatmentPlanStatus.ON_HOLD,
            TreatmentPlanStatus.COMPLETED,
            TreatmentPlanStatus.CANCELLED,
        }
    ),
    TreatmentPlanStatus.ON_HOLD: frozenset(
        {
            TreatmentPlanStatus.IN_PROGRESS,
            TreatmentPlanStatus.COMPLETED,
            TreatmentPlanStatus.CANCELLED,
        }
    ),
    TreatmentPlanStatus.COMPLETED: frozenset(),  # Terminal
    TreatmentPlanStatus.CANCELLED: frozenset(),  # Terminal
}

ITEM_TRANSITIONS: dict[TreatmentPlanItemStatus, frozenset[TreatmentPlanItemStatus]] = {
    TreatmentPlanItemStatus.PENDING: frozenset(
        {
            TreatmentPlanItemStatus.IN_PROGRESS,
            TreatmentPlanItemStatus.CANCELLED,
            TreatmentPlanItemStatus.DEFERRED,
        }
    ),
    TreatmentPlanItemStatus.IN_PROGRESS: frozenset(
        {
            TreatmentPlanItemStatus.COMPLETED,
            TreatmentPlanItemStatus.CANCELLED,
            TreatmentPlanItemStatus.DEFERRED,
        }
    ),
    TreatmentPlanItemStatus.DEFERRED: frozenset(
        {
            TreatmentPlanItemStatus.PENDING,
            TreatmentPlanItemStatus.CANCELLED,
        }
    ),
    TreatmentPlanItemStatus.COMPLETED: frozenset(),  # Terminal
    TreatmentPlanItemStatus.CANCELLED: frozenset(),  # Terminal
}

# String-serialized transition maps for persistence / API serialization.
# Derived from the enum maps above — do not edit by hand.
VALID_PLAN_TRANSITIONS: dict[str, frozenset[str]] = {
    source.value: frozenset(target.value for target in targets)
    for source, targets in PLAN_TRANSITIONS.items()
}

VALID_ITEM_TRANSITIONS: dict[str, frozenset[str]] = {
    source.value: frozenset(target.value for target in targets)
    for source, targets in ITEM_TRANSITIONS.items()
}


def is_valid_tooth_surface_combination(surface: str) -> bool:
    """Validate a tooth-surface code dynamically.

    A surface code is valid when it is a non-empty sequence of **distinct**
    letters drawn from :data:`VALID_TOOTH_SURFACES`. This removes the need to
    maintain an explicit enumeration of every legal combination (e.g. ``MOD``,
    ``BOL``) while still rejecting repeats (``MM``) and unknown letters.

    Args:
        surface: The surface code, e.g. ``"MOD"``, ``"O"``.

    Returns:
        ``True`` if the code is well-formed, else ``False``.
    """
    if not surface:
        return False
    characters = set(surface)
    return characters <= VALID_TOOTH_SURFACES and len(characters) == len(surface)


__all__ = [
    "TREATMENT_PLAN_CODE_PREFIX",
    "TREATMENT_PLAN_CODE_SEQUENCE_WIDTH",
    "FDI_PERMANENT_MIN",
    "FDI_PERMANENT_MAX",
    "FDI_PRIMARY_MIN",
    "FDI_PRIMARY_MAX",
    "FDI_VALID_RANGES",
    "VALID_TOOTH_SURFACES",
    "PLAN_CODE_MAX_LENGTH",
    "PROCEDURE_CODE_MAX_LENGTH",
    "PROCEDURE_NAME_MAX_LENGTH",
    "CLINICAL_NOTES_MAX_LENGTH",
    "CHANGE_REASON_MAX_LENGTH",
    "APPROVAL_NOTES_MAX_LENGTH",
    "TOOTH_SURFACE_MAX_LENGTH",
    "QUADRANT_MAX_LENGTH",
    "ARCH_MAX_LENGTH",
    "MAX_ESTIMATED_COST",
    "MIN_ESTIMATED_COST",
    "DEFAULT_PROCEDURE_COST",
    "DEFAULT_PAGE_SIZE",
    "MAX_PAGE_SIZE",
    "DEFAULT_SORT_FIELD",
    "PROCEDURE_SEARCH_DEFAULT_LIMIT",
    "TREATMENT_PLAN_SEARCH_DEFAULT_LIMIT",
    "ALLOWED_SORT_FIELDS",
    "MIN_PLAN_ITEMS_FOR_SUBMISSION",
    "INITIAL_VERSION_NUMBER",
    "MAX_SEQUENCE_NUMBER",
    "MIN_ITEM_QUANTITY",
    "MAX_ITEM_QUANTITY",
    "PLAN_TRANSITIONS",
    "ITEM_TRANSITIONS",
    "VALID_PLAN_TRANSITIONS",
    "VALID_ITEM_TRANSITIONS",
    "is_valid_tooth_surface_combination",
]
