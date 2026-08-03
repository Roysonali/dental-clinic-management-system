# Phase 13: Validator Design — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only validators required for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Design Patterns

- **Stateless** — No class state, no instance variables
- **Pure functions** — Same input always produces same output; no side effects
- **Dependency inversion** — Accept dependencies as parameters; do not import repositories directly
- **Single responsibility** — Each validator validates exactly one thing
- **No persistence** — Validators never read or write to the database directly
- **No transactions** — Validators never start or commit transactions
- **Composable** — Validators can be combined in any order

---

## 2. Validator Functions

### 2.1 Tooth Number Validators

```python
from typing import Optional

# FDI permanent teeth: 11-48
FDI_PERMANENT_RANGE = range(11, 49)
# FDI primary teeth: 51-85
FDI_PRIMARY_RANGE = range(51, 86)


def validate_tooth_number(tooth_number: Optional[int]) -> Optional[int]:
    """
    Validate that a tooth number follows FDI two-digit notation.

    Valid ranges:
    - Permanent: 11-48 (quadrants 1-4)
    - Primary: 51-85 (quadrants 5-8)

    Returns the validated tooth number or raises ValueError.
    Returns None if input is None (tooth number is optional).
    """
    if tooth_number is None:
        return None

    if not isinstance(tooth_number, int):
        raise ValueError("Tooth number must be an integer")

    if tooth_number in FDI_PERMANENT_RANGE or tooth_number in FDI_PRIMARY_RANGE:
        return tooth_number

    raise ValueError(
        f"Invalid tooth number: {tooth_number}. "
        f"Must be in FDI range (11-48 for permanent, 51-85 for primary)"
    )


def validate_tooth_surface(surface: Optional[str]) -> Optional[str]:
    """
    Validate tooth surface abbreviation.
    Valid single surfaces: M, D, B, L, O, I
    Valid combinations: MO, OD, MOD, OB, OL, MB, ML, DB, DL, BL, BOL, BOD, MOL
    """
    if surface is None:
        return None

    surface = surface.upper().strip()

    VALID_SINGLE = {"M", "D", "B", "L", "O", "I"}
    VALID_COMBINATIONS = {
        "MO", "OD", "MOD", "OB", "OL", "MB", "ML",
        "DB", "DL", "BL", "BOL", "BOD", "MOL",
    }

    if len(surface) == 1 and surface in VALID_SINGLE:
        return surface
    if surface in VALID_COMBINATIONS:
        return surface

    raise ValueError(f"Invalid tooth surface: {surface}")
```

### 2.2 Plan Validators

```python
from datetime import date
from typing import Optional


def validate_date_range(valid_from: Optional[date], valid_to: Optional[date]) -> None:
    """Validate that valid_from <= valid_to when both are provided."""
    if valid_from is not None and valid_to is not None:
        if valid_from > valid_to:
            raise ValueError("valid_from must be on or before valid_to")


def validate_status_transition(
    current_status: str, new_status: str, has_items: bool
) -> None:
    """
    Validate that a status transition is allowed by the state machine.

    Raises ValueError if the transition is invalid or if business
    conditions are not met (e.g., transitioning from Draft requires items).
    """
    from app.modules.treatment.constants import VALID_PLAN_TRANSITIONS

    allowed = VALID_PLAN_TRANSITIONS.get(current_status, set())

    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{current_status}' to '{new_status}'. "
            f"Allowed transitions from '{current_status}': "
            f"{', '.join(sorted(allowed)) or 'none (terminal state)'}"
        )

    # Business conditions for specific transitions
    if current_status == "draft" and new_status == "under_review":
        if not has_items:
            raise ValueError(
                "Cannot submit plan for review: plan has no items. "
                "Add at least one procedure item before submitting."
            )

    if current_status == "accepted" and new_status == "in_progress":
        if not has_items:
            raise ValueError(
                "Cannot start treatment: plan has no items."
            )


def validate_plan_cancellable(plan_status: str) -> None:
    """Validate that a plan can be cancelled from its current state."""
    cancellable_from = {"draft", "under_review", "proposed", "accepted", "in_progress", "on_hold"}
    if plan_status not in cancellable_from:
        raise ValueError(
            f"Cannot cancel plan in '{plan_status}' status. "
            f"Plan is already in a terminal state."
        )


def validate_plan_deletable(plan_status: str) -> None:
    """Validate that a plan can be hard-deleted (only Draft)."""
    if plan_status != "draft":
        raise ValueError(
            f"Cannot delete plan in '{plan_status}' status. "
            f"Only draft plans can be deleted. "
            f"Use deactivate instead."
        )
```

### 2.3 Item Validators

```python
def validate_item_status_transition(
    current_status: str, new_status: str
) -> None:
    """Validate item status transition against the state machine."""
    from app.modules.treatment.constants import VALID_ITEM_TRANSITIONS

    allowed = VALID_ITEM_TRANSITIONS.get(current_status, set())

    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition item from '{current_status}' to '{new_status}'. "
            f"Allowed transitions: {', '.join(sorted(allowed)) or 'none'}"
        )


def validate_sequence_number(
    sequence: int, existing_sequences: set[int]
) -> None:
    """Validate sequence number is unique within the plan."""
    if sequence in existing_sequences:
        raise ValueError(
            f"Sequence number {sequence} already exists in this plan. "
            f"Choose a different sequence number."
        )


def validate_item_cost(cost: float) -> None:
    """Validate item estimated cost is non-negative."""
    if cost < 0:
        raise ValueError("Item estimated cost must be non-negative")


def validate_discount(discount: float) -> None:
    """Validate item discount is non-negative."""
    if discount < 0:
        raise ValueError("Item discount must be non-negative")
```

### 2.4 Procedure Validators

```python
def validate_procedure_code(code: str) -> str:
    """Validate procedure code format."""
    code = code.strip().upper()
    if not code:
        raise ValueError("Procedure code is required")
    if len(code) > 20:
        raise ValueError("Procedure code must be 20 characters or fewer")
    if not all(c.isalnum() or c in "_-" for c in code):
        raise ValueError(
            "Procedure code must contain only alphanumeric characters, "
            "underscores, and hyphens"
        )
    return code


def validate_procedure_name(name: str) -> str:
    """Validate procedure name."""
    name = name.strip()
    if not name:
        raise ValueError("Procedure name is required")
    if len(name) > 200:
        raise ValueError("Procedure name must be 200 characters or fewer")
    return name


def validate_default_cost(cost: float) -> None:
    """Validate default procedure cost is non-negative."""
    if cost < 0:
        raise ValueError("Default cost must be non-negative")
```

### 2.5 Version Validators

```python
def validate_change_reason(reason: str) -> str:
    """Validate version change reason."""
    reason = reason.strip()
    if not reason:
        raise ValueError("Change reason is required for version creation")
    if len(reason) > 500:
        raise ValueError("Change reason must be 500 characters or fewer")
    return reason


def validate_version_immutable(version_number: int) -> None:
    """Validate that a version number exists (version immutable by design)."""
    if version_number < 1:
        raise ValueError(f"Invalid version number: {version_number}")
```

### 2.6 Approval Validators

```python
def validate_plan_is_proposed(plan_status: str) -> None:
    """Validate that a plan is in Proposed status for approval workflow."""
    if plan_status != "proposed":
        raise ValueError(
            f"Cannot process approval for plan in '{plan_status}' status. "
            f"Plan must be in 'proposed' status."
        )


def validate_acknowledgment_status(status: str) -> None:
    """Validate patient acknowledgment status value."""
    valid_statuses = {"accepted", "rejected", "changes_requested"}
    if status not in valid_statuses:
        raise ValueError(
            f"Invalid acknowledgment status: '{status}'. "
            f"Must be one of: {', '.join(sorted(valid_statuses))}"
        )
```

---

## 3. Validator Composition Pattern

Validators are composed in the service layer, not in the validators themselves:

```python
# Example: Service composing validators for item creation
def add_item(self, plan_id: UUID, payload: ItemCreate) -> TreatmentPlanItem:
    plan = self.get_plan(plan_id)

    # Compose validators
    validate_plan_editable(plan.status)
    validate_tooth_number(payload.tooth_number)
    validate_tooth_surface(payload.tooth_surface)
    validate_item_cost(payload.estimated_cost)
    validate_discount(payload.discount)

    # Repository query for sequence uniqueness
    existing_sequences = {
        item.sequence_number
        for item in self.item_repo.get_by_plan(plan_id)
    }
    validate_sequence_number(payload.sequence_number, existing_sequences)

    # Proceed with creation
    ...
```

---

## 4. Validator Test Matrix

| Validator | Input | Expected |
|---|---|---|
| `validate_tooth_number(None)` | None | None (pass) |
| `validate_tooth_number(11)` | 11 | 11 (pass) |
| `validate_tooth_number(48)` | 48 | 48 (pass) |
| `validate_tooth_number(55)` | 55 | 55 (pass, primary) |
| `validate_tooth_number(0)` | 0 | ValueError |
| `validate_tooth_number(10)` | 10 | ValueError (below permanent) |
| `validate_tooth_number(49)` | 49 | ValueError (between ranges) |
| `validate_tooth_number(99)` | 99 | ValueError |
| `validate_date_range(None, None)` | None, None | pass |
| `validate_date_range(d(1), d(5))` | 1, 5 | pass |
| `validate_date_range(d(5), d(1))` | 5, 1 | ValueError |
| `validate_status_transition("draft", "under_review", True)` | draft, under_review, has_items | pass |
| `validate_status_transition("draft", "under_review", False)` | draft, under_review, no_items | ValueError |
| `validate_status_transition("draft", "accepted", True)` | draft, accepted | ValueError (invalid transition) |
| `validate_status_transition("completed", "draft", True)` | completed, draft | ValueError (terminal) |
| `validate_sequence_number(1, {1, 2, 3})` | 1, {1,2,3} | ValueError (duplicate) |
| `validate_sequence_number(4, {1, 2, 3})` | 4, {1,2,3} | pass |
| `validate_procedure_code("  comp-fill  ")` | " comp-fill " | "COMP-FILL" |
| `validate_plan_is_proposed("draft")` | "draft" | ValueError |
| `validate_plan_is_proposed("proposed")` | "proposed" | pass |
| `validate_plan_deletable("draft")` | "draft" | pass |
| `validate_plan_deletable("accepted")` | "accepted" | ValueError |
| `validate_acknowledgment_status("accepted")` | "accepted" | pass |
| `validate_acknowledgment_status("invalid")` | "invalid" | ValueError |

---

## 5. Why Validators Are Stateless

### 5.1 Rationale

Validators are designed as **stateless pure functions** (not classes, not methods with side effects) for the following architectural reasons:

| Reason | Explanation |
|---|---|
| **Testability** | Pure functions require no mocking, no setup, no dependency injection. Every test is simply: `assert validate_tooth_number(11) == 11`. |
| **Determinism** | Same input always produces the same output. No hidden state, no database reads, no configuration lookups mid-validation. |
| **Composability** | Validators can be called in any order, skipped, or combined without side effects. The service layer decides the composition order. |
| **Separation of Concerns** | Validation is a pure business rule check. Persistence, orchestration, and transaction management belong in the service layer. |
| **Performance** | Pure functions are trivially parallelizable and have zero overhead from object instantiation or state management. |

### 5.2 When Would a Validator Need State?

If a validation requires database access (e.g., "check if this patient exists"), that is NOT validation — it's a service-layer check. The service queries the repository and raises a domain exception. Validators only check data that is already in memory (request payload + already-loaded entities).

### 5.3 Design Constraint

Validators MAY import constants from the constants module. They MUST NOT:
- Import or call repositories
- Access the database directly
- Maintain instance state
- Have side effects (logging, metrics, event emission)

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [08-enums-constants.md](08-enums-constants.md) (validation constants), [04-workflows-state-machines.md](04-workflows-state-machines.md) (state machine) |
| **Related** | [07-validation-rules.md](07-validation-rules.md) (validation rules), [03-database-design.md](03-database-design.md) (CHECK constraints) |
| **Depends On** | [08-enums-constants.md](08-enums-constants.md) for FDI ranges, surface codes, and transition maps |
| **Used By** | [14-service-design.md](14-service-design.md) (service composes validators), [17-testing-strategy.md](17-testing-strategy.md) |
| **Next Reading** | [14-service-design.md](14-service-design.md) |
