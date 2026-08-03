# Phase 8: Enums & Constants — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only enums and constants required for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Enums

### 1.1 TreatmentPlanStatus

```python
from enum import Enum


class TreatmentPlanStatus(str, Enum):
    """Lifecycle status of a treatment plan."""
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    @classmethod
    def editable_statuses(cls) -> set["TreatmentPlanStatus"]:
        """Statuses that allow plan/item modification without versioning."""
        return {cls.DRAFT, cls.UNDER_REVIEW, cls.PROPOSED}

    @classmethod
    def terminal_statuses(cls) -> set["TreatmentPlanStatus"]:
        """Statuses that are final — no further transitions allowed."""
        return {cls.COMPLETED, cls.CANCELLED}
```

### 1.2 TreatmentPlanItemStatus

```python
class TreatmentPlanItemStatus(str, Enum):
    """Status of an individual procedure item within a treatment plan."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DEFERRED = "deferred"

    @classmethod
    def terminal_statuses(cls) -> set["TreatmentPlanItemStatus"]:
        return {cls.COMPLETED, cls.CANCELLED}
```

### 1.3 ProcedureCategory

```python
class ProcedureCategory(str, Enum):
    """Category of dental procedure."""
    DIAGNOSTIC = "diagnostic"
    PREVENTIVE = "preventive"
    RESTORATIVE = "restorative"
    ENDODONTIC = "endodontic"
    PERIODONTIC = "periodontic"
    PROSTHODONTIC = "prosthodontic"
    ORAL_SURGERY = "oral_surgery"
    ORTHODONTIC = "orthodontic"
    COSMETIC = "cosmetic"
    IMPLANT = "implant"
    OTHER = "other"
```

### 1.4 PatientAcknowledgmentStatus

```python
class PatientAcknowledgmentStatus(str, Enum):
    """Patient's response to a proposed treatment plan."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"
```

### 1.5 ToothQuadrant

```python
class ToothQuadrant(str, Enum):
    """Dental quadrant identifiers."""
    UPPER_RIGHT = "UR"     # Quadrant 1 (teeth 11–18)
    UPPER_LEFT = "UL"      # Quadrant 2 (teeth 21–28)
    LOWER_LEFT = "LL"      # Quadrant 3 (teeth 31–38)
    LOWER_RIGHT = "LR"     # Quadrant 4 (teeth 41–48)
```

### 1.6 ToothArch

```python
class ToothArch(str, Enum):
    """Dental arch identifiers."""
    UPPER = "upper"
    LOWER = "lower"
```

---

## 2. Constants

### 2.1 Plan Code Configuration

```python
# Prefix for auto-generated treatment plan IDs
TREATMENT_PLAN_CODE_PREFIX = "TXN"
# Sequence padding width (e.g., TXN-00001)
TREATMENT_PLAN_CODE_SEQUENCE_WIDTH = 6
```

### 2.2 Validation Constants

```python
# Tooth number ranges (FDI two-digit notation)
FDI_PERMANENT_MIN = 11
FDI_PERMANENT_MAX = 48
FDI_PRIMARY_MIN = 51
FDI_PRIMARY_MAX = 85
FDI_VALID_RANGES = [(11, 48), (51, 85)]  # Inclusive ranges

# Valid tooth surface codes (single-letter abbreviations)
VALID_TOOTH_SURFACES = {"M", "D", "B", "L", "O", "I"}
# Valid tooth surface combinations for class II/III cavities
VALID_SURFACE_COMBINATIONS = {"MO", "OD", "MOD", "OB", "OL", "MB", "ML", "DB", "DL", "BL", "BOL", "BOD", "MOL", "MOD"}

# Maximum lengths
PLAN_CODE_MAX_LENGTH = 20
PROCEDURE_CODE_MAX_LENGTH = 20
PROCEDURE_NAME_MAX_LENGTH = 200
CLINICAL_NOTES_MAX_LENGTH = 5000
CHANGE_REASON_MAX_LENGTH = 500
APPROVAL_NOTES_MAX_LENGTH = 500
```

### 2.3 Financial Constants

```python
# Maximum estimated cost
MAX_ESTIMATED_COST = 999999.99
# Minimum estimated cost (zero allowed — complimentary/composite write-off)
MIN_ESTIMATED_COST = 0.00
# Default procedure cost for newly added procedures
DEFAULT_PROCEDURE_COST = 0.00
```

### 2.4 Pagination Constants

```python
# Default page size for list endpoints
DEFAULT_PAGE_SIZE = 20
# Maximum allowed page size
MAX_PAGE_SIZE = 100
# Default sort field
DEFAULT_SORT_FIELD = "created_at"
# Allowed sort fields
ALLOWED_SORT_FIELDS = {"created_at", "status", "plan_code"}
```

### 2.5 Business Constants

```python
# Minimum items required to leave Draft status
MIN_PLAN_ITEMS_FOR_SUBMISSION = 1
# Default version number for new plans
INITIAL_VERSION_NUMBER = 1
# Maximum sequence number per plan
MAX_SEQUENCE_NUMBER = 999
```

### 2.6 Valid Status Transitions (State Machine Configuration)

```python
VALID_PLAN_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"under_review", "cancelled"},
    "under_review": {"proposed", "draft", "cancelled"},
    "proposed": {"accepted", "draft", "cancelled", "rejected"},
    "rejected": {"draft", "cancelled"},
    "accepted": {"in_progress", "cancelled"},
    "in_progress": {"on_hold", "completed", "cancelled"},
    "on_hold": {"in_progress", "completed", "cancelled"},
    "completed": set(),     # Terminal
    "cancelled": set(),     # Terminal
}

VALID_ITEM_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"in_progress", "cancelled", "deferred"},
    "in_progress": {"completed", "cancelled", "deferred"},
    "deferred": {"pending", "cancelled"},
    "completed": set(),     # Terminal
    "cancelled": set(),     # Terminal
}
```

---

## 3. Error Code Constants

```python
# Error codes
ERROR_PLAN_NOT_FOUND = "PLAN_NOT_FOUND"
ERROR_DUPLICATE_PLAN = "DUPLICATE_PLAN"
ERROR_PLAN_CREATION_FAILED = "PLAN_CREATION_FAILED"
ERROR_PLAN_UPDATE_FAILED = "PLAN_UPDATE_FAILED"
ERROR_PLAN_VALIDATION_FAILED = "PLAN_VALIDATION_FAILED"
ERROR_INVALID_PLAN_OPERATION = "INVALID_PLAN_OPERATION"
ERROR_PLAN_NOT_EDITABLE = "PLAN_NOT_EDITABLE"
ERROR_EMPTY_PLAN_TRANSITION = "EMPTY_PLAN_TRANSITION"
ERROR_ITEM_NOT_FOUND = "ITEM_NOT_FOUND"
ERROR_DUPLICATE_ITEM_SEQUENCE = "DUPLICATE_ITEM_SEQUENCE"
ERROR_INVALID_ITEM_STATUS_TRANSITION = "INVALID_ITEM_STATUS_TRANSITION"
ERROR_PROCEDURE_NOT_FOUND = "PROCEDURE_NOT_FOUND"
ERROR_DUPLICATE_PROCEDURE = "DUPLICATE_PROCEDURE"
ERROR_INVALID_TOOTH_NUMBER = "INVALID_TOOTH_NUMBER"
ERROR_INVALID_DATE_RANGE = "INVALID_DATE_RANGE"
ERROR_VERSION_NOT_FOUND = "VERSION_NOT_FOUND"
ERROR_VERSION_IMMUTABLE = "VERSION_IMMUTABLE"
ERROR_APPROVAL_NOT_FOUND = "APPROVAL_NOT_FOUND"
ERROR_PLAN_ALREADY_APPROVED = "PLAN_ALREADY_APPROVED"
ERROR_PATIENT_ACKNOWLEDGMENT_EXISTS = "PATIENT_ACKNOWLEDGMENT_EXISTS"
ERROR_PLAN_NOT_DELETABLE = "PLAN_NOT_DELETABLE"
ERROR_SELF_SERVICE_NOT_ALLOWED = "SELF_SERVICE_NOT_ALLOWED"
ERROR_FORBIDDEN = "FORBIDDEN"
```

---

## 4. File Location Summary

| Symbol | File |
|---|---|
| `TreatmentPlanStatus` | `app/modules/treatment/enums.py` |
| `TreatmentPlanItemStatus` | `app/modules/treatment/enums.py` |
| `ProcedureCategory` | `app/modules/treatment/enums.py` |
| `PatientAcknowledgmentStatus` | `app/modules/treatment/enums.py` |
| `ToothQuadrant` | `app/modules/treatment/enums.py` |
| `ToothArch` | `app/modules/treatment/enums.py` |
| Plan code constants | `app/modules/treatment/constants.py` |
| Validation constants | `app/modules/treatment/constants.py` |
| Financial constants | `app/modules/treatment/constants.py` |
| State machine config | `app/modules/treatment/constants.py` |
| Error code constants | `app/modules/treatment/exceptions.py` (embedded in exception constructors) |

---

## 5. Enums Explicitly Excluded from MVP

| Enum | Purpose | Future Phase |
|---|---|---|
| `InsuranceClaimStatus` | Insurance claim tracking | Phase 18 |
| `PaymentPlanType` | Payment schedule generation | Phase 18 |
| `TreatmentOutcome` | Outcome metrics | Phase 18 |

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [07-validation-rules.md](07-validation-rules.md) (error codes), [04-workflows-state-machines.md](04-workflows-state-machines.md) (state machine config) |
| **Related** | [13-validator-design.md](13-validator-design.md) (validation constants), [09-exception-design.md](09-exception-design.md) (error code constants) |
| **Depends On** | [01-business-analysis.md](01-business-analysis.md) (business rules) for state machine transition definitions |
| **Used By** | [11-orm-model-design.md](11-orm-model-design.md) (CHECK constraint values), [15-mappers-schemas.md](15-mappers-schemas.md) (schema validation) |
| **Next Reading** | [09-exception-design.md](09-exception-design.md) |
