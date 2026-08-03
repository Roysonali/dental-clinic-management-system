# Phase 12: Repository Design — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only repository methods for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Design Patterns

Following `patients/repository.py` and `doctors/repositories/`:

- Stateless repository class with `Session` dependency
- Explicit method signatures (no generic `**kwargs`)
- Methods return ORM model instances
- Query construction uses SQLAlchemy ORM
- Pagination using `.offset()` / `.limit()` with total count
- Search using `ILIKE` for case-insensitive matching
- No business logic — pure data access

---

## 1a. Repository Naming Conventions & Standards

### 1a.1 Standard Method Naming

| Prefix | Convention | Example | Returns |
|---|---|---|---|
| `create` | `create(entity)` | `create(plan: TreatmentPlan)` | Created ORM instance |
| `get_by_id` | `get_by_id(id)` | `get_by_id(plan_id: UUID)` | `Optional[ORM]` |
| `get_by_*` | `get_by_field(value)` | `get_by_plan_code(code: str)` | `Optional[ORM]` |
| `list_*` | `list_criteria()` | `list_active()` | `list[ORM]` |
| `update` | `update(entity, updates)` | `update(plan, updates, updated_by)` | Updated ORM instance |
| `delete` | `delete(entity_id)` | `delete(item_id: UUID)` | `bool` |
| `hard_delete` | `hard_delete(entity_id)` | `hard_delete(plan_id: UUID)` | `bool` |
| `exists` | `exists(criteria)` | `has_items(plan_id: UUID)` | `bool` |
| `count` | `count(criteria)` | `count(plan_id: UUID)` | `int` |
| `paginate` | `paginate(query, page, size)` | Used internally in `list()` | `tuple[list, int]` |
| `lock_for_update` | `lock_for_update(id)` | For pessimistic locking (future use) | ORM instance |

### 1a.2 Repository Responsibilities

| Responsibility | Included | Excluded |
|---|---|---|
| Query construction | ✅ SQLAlchemy ORM queries with filters, joins, ordering | ❌ Raw SQL (except for JSONB operations) |
| CRUD operations | ✅ Create, read, update, delete | ❌ Business logic, validation, state management |
| Pagination | ✅ Offset/limit with total count | ❌ Business-level filtering (done in service) |
| Search | ✅ ILIKE with sanitized input | ❌ Full-text search (deferred to future phase) |
| Eager loading | ✅ `selectinload()` for relationships | ❌ Lazy loading decisions (left to caller) |
| Duplicate detection | ✅ Via `first() is not None` or count | ❌ Business-level dedup (done in service) |
| Transaction management | ❌ Never commits or rolls back | ✅ Service owns transactions |
| Audit fields | ✅ Updates `updated_at`, `updated_by` when instructed | ❌ Decides what audit fields to populate |

### 1a.3 Query Design Guidelines

1. **Always use `selectinload()`** for relationship loading to avoid N+1 queries
2. **Never use `lazy='subquery'`** — leads to unpredictable query patterns
3. **Join only when filtering** on a related table; use `selectinload()` for display data
4. **Use `func.count()` for totals** rather than loading all rows and counting in Python
5. **Sanitize ILIKE patterns** — escape `%` and `_` characters in user input
6. **Prefer composite indexes** for multi-field filters (e.g., `(is_active, status)`)
7. **Use `with_for_update()`** for pessimistic locking of critical resources (future)
8. **Never return `Query` objects** — always materialize with `.all()`, `.first()`, or `.one()`
9. **Name indexes explicitly** with `ix_tablename_field` convention
10. **Use `text()` for JSONB operations** — JSONB queries need PostgreSQL-specific syntax

---

## 2. TreatmentPlanRepository

```python
class TreatmentPlanRepository:
    def __init__(self, db: Session):
        self.db = db
```

### 2.1 CRUD Methods

| Method | Signature | Description |
|---|---|---|
| `create` | `(plan: TreatmentPlan) -> TreatmentPlan` | Persist new plan, flush, refresh |
| `get_by_id` | `(plan_id: UUID) -> Optional[TreatmentPlan]` | Single plan by ID with eager-loaded items and approval via `selectinload()` |
| `get_by_plan_code` | `(code: str) -> Optional[TreatmentPlan]` | Find by unique plan code |
| `update` | `(plan: TreatmentPlan, updates: dict, updated_by: int) -> TreatmentPlan` | Apply field-level updates |
| `hard_delete` | `(plan_id: UUID) -> bool` | Hard delete (Draft only) |

### 2.2 List/Search Method

```python
def list(
    self,
    search: str | None = None,
    patient_id: UUID | None = None,
    doctor_id: UUID | None = None,
    status: str | None = None,
    is_active: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[list[TreatmentPlan], int]:
```

**Query construction:**

```python
def list(self, search=None, patient_id=None, doctor_id=None,
         status=None, is_active=None, date_from=None, date_to=None,
         page=1, page_size=20, sort_by="created_at", sort_order="desc"):

    query = self.db.query(TreatmentPlan).join(Patient, TreatmentPlan.patient_id == Patient.id)

    # Search filter (plan code or patient name)
    if search:
        search_filter = (
            TreatmentPlan.plan_code.ilike(f"%{search}%") |
            Patient.first_name.ilike(f"%{search}%") |
            Patient.last_name.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    # Filters
    if patient_id:
        query = query.filter(TreatmentPlan.patient_id == patient_id)
    if doctor_id:
        query = query.filter(TreatmentPlan.doctor_id == doctor_id)
    if status:
        query = query.filter(TreatmentPlan.status == status)
    if is_active is not None:
        query = query.filter(TreatmentPlan.is_active == is_active)
    if date_from:
        query = query.filter(TreatmentPlan.created_at >= date_from)
    if date_to:
        query = query.filter(TreatmentPlan.created_at <= date_to)

    # Total count
    total = query.count()

    # Sorting
    sort_column = getattr(TreatmentPlan, sort_by, TreatmentPlan.created_at)
    sort_fn = sort_column.asc if sort_order == "asc" else sort_column.desc
    query = query.order_by(sort_fn())

    # Pagination
    plans = query.offset((page - 1) * page_size).limit(page_size).all()

    return plans, total
```

### 2.3 Status Methods

```python
def update_status(self, plan_id: UUID, status: str, updated_by: int) -> TreatmentPlan:
    plan = self.get_by_id(plan_id)
    if plan:
        plan.status = status
        plan.updated_by = updated_by
        plan.updated_at = func.now()
        self.db.flush()
        self.db.refresh(plan)
    return plan

def set_active_status(self, plan_id: UUID, is_active: bool, updated_by: int) -> TreatmentPlan:
    plan = self.get_by_id(plan_id)
    if plan:
        plan.is_active = is_active
        plan.updated_by = updated_by
        plan.updated_at = func.now()
        self.db.flush()
        self.db.refresh(plan)
    return plan

def increment_version(self, plan_id: UUID) -> TreatmentPlan:
    plan = self.get_by_id(plan_id)
    if plan:
        plan.current_version += 1
        plan.updated_at = func.now()
        self.db.flush()
        self.db.refresh(plan)
    return plan
```

### 2.4 Business Check Methods

```python
def get_next_plan_code_sequence(self) -> int:
    """Get next sequence number for plan code generation."""
    result = self.db.query(func.max(TreatmentPlan.plan_code)).scalar()
    if result is None:
        return 1
    match = re.search(r"(\d+)$", result)
    return int(match.group(1)) + 1 if match else 1

def has_items(self, plan_id: UUID) -> bool:
    """Check if a plan has at least one item."""
    return self.db.query(TreatmentPlanItem).filter(
        TreatmentPlanItem.plan_id == plan_id
    ).first() is not None

def count_active_items_by_status(self, plan_id: UUID, status: str) -> int:
    """Count items in a specific status for a plan."""
    return self.db.query(TreatmentPlanItem).filter(
        TreatmentPlanItem.plan_id == plan_id,
        TreatmentPlanItem.item_status == status,
    ).count()

def has_concurrent_draft(self, patient_id: UUID, exclude_plan_id: UUID | None = None) -> bool:
    """Check if patient already has a Draft plan."""
    query = self.db.query(TreatmentPlan).filter(
        TreatmentPlan.patient_id == patient_id,
        TreatmentPlan.status == "draft",
        TreatmentPlan.is_active == True,
    )
    if exclude_plan_id:
        query = query.filter(TreatmentPlan.id != exclude_plan_id)
    return query.first() is not None
```

---

## 3. TreatmentPlanItemRepository

```python
class TreatmentPlanItemRepository:
    def __init__(self, db: Session):
        self.db = db
```

| Method | Signature | Description |
|---|---|---|
| `get_by_id` | `(item_id: UUID) -> Optional[TreatmentPlanItem]` | Single item by ID |
| `get_by_plan` | `(plan_id: UUID) -> list[TreatmentPlanItem]` | All items for a plan, ordered by sequence |
| `create` | `(item: TreatmentPlanItem) -> TreatmentPlanItem` | Persist new item |
| `update` | `(item_id: UUID, updates: dict) -> Optional[TreatmentPlanItem]` | Update item fields |
| `delete` | `(item_id: UUID) -> bool` | Hard delete item |
| `update_status` | `(item_id: UUID, status: str) -> Optional[TreatmentPlanItem]` | Update item status |
| `get_by_sequence` | `(plan_id: UUID, sequence: int) -> Optional[TreatmentPlanItem]` | Find item by sequence number |
| `max_sequence` | `(plan_id: UUID) -> int` | Get max sequence number in plan |
| `reorder` | `(plan_id: UUID, item_ids: list[UUID]) -> list[TreatmentPlanItem]` | Reorder items by provided list |

---

## 4. TreatmentPlanVersionRepository

```python
class TreatmentPlanVersionRepository:
    def __init__(self, db: Session):
        self.db = db
```

| Method | Signature | Description |
|---|---|---|
| `create` | `(version: TreatmentPlanVersion) -> TreatmentPlanVersion` | Persist new version |
| `get_by_id` | `(version_id: UUID) -> Optional[TreatmentPlanVersion]` | Single version by ID |
| `get_by_plan` | `(plan_id: UUID) -> list[TreatmentPlanVersion]` | All versions for a plan, ordered by version DESC |
| `get_latest` | `(plan_id: UUID) -> Optional[TreatmentPlanVersion]` | Latest version for a plan |
| `count` | `(plan_id: UUID) -> int` | Count versions for a plan |

---

## 5. TreatmentPlanApprovalRepository

```python
class TreatmentPlanApprovalRepository:
    def __init__(self, db: Session):
        self.db = db
```

| Method | Signature | Description |
|---|---|---|
| `get_by_plan` | `(plan_id: UUID) -> Optional[TreatmentPlanApproval]` | Get approval for a plan (1:1) |
| `create` | `(approval: TreatmentPlanApproval) -> TreatmentPlanApproval` | Create approval record |
| `update` | `(approval: TreatmentPlanApproval, updates: dict) -> TreatmentPlanApproval` | Update approval |
| `upsert` | `(plan_id: UUID, updates: dict) -> TreatmentPlanApproval` | Create or update |

---

## 6. ProcedureRepository

```python
class ProcedureRepository:
    def __init__(self, db: Session):
        self.db = db
```

| Method | Signature | Description |
|---|---|---|
| `get_by_id` | `(proc_id: int) -> Optional[Procedure]` | Single procedure by ID |
| `get_by_code` | `(code: str) -> Optional[Procedure]` | Find by unique code |
| `list_active` | `() -> list[Procedure]` | All active procedures, ordered by name |
| `list_all` | `() -> list[Procedure]` | All procedures (including inactive) |
| `list_by_category` | `(category: str) -> list[Procedure]` | Procedures in a category |
| `create` | `(procedure: Procedure) -> Procedure` | Create new procedure |
| `update` | `(procedure: Procedure, updates: dict) -> Procedure` | Update procedure |

---

## 7. Repository Method Signatures Summary

| Repository | Method | Returns |
|---|---|---|
| `TreatmentPlanRepository` | create, get_by_id, get_by_plan_code, update, hard_delete, list, update_status, set_active_status, increment_version, get_next_plan_code_sequence, has_items, count_active_items_by_status, has_concurrent_draft | TreatmentPlan / tuple / int / bool |
| `TreatmentPlanItemRepository` | get_by_id, get_by_plan, create, update, delete, update_status, get_by_sequence, max_sequence, reorder | TreatmentPlanItem / list / int / bool |
| `TreatmentPlanVersionRepository` | create, get_by_id, get_by_plan, get_latest, count | TreatmentPlanVersion / list / int |
| `TreatmentPlanApprovalRepository` | get_by_plan, create, update, upsert | TreatmentPlanApproval |
| `ProcedureRepository` | get_by_id, get_by_code, list_active, list_all, list_by_category, create, update | Procedure / list |

---

## 8. Repository Methods Excluded from MVP

| Method | Feature | Future Phase |
|---|---|---|
| `PaymentPlanRepository.*` | Payment plan/schedule | Phase 18 |
| `InsuranceClaimRepository.*` | Insurance claim tracking | Phase 18 |
| `OutcomeMetricsRepository.*` | Treatment outcomes | Phase 18 |
| `AttachmentRepository.*` | Procedure attachments | Phase 18 |

---

## 9. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [11-orm-model-design.md](11-orm-model-design.md) (models), [03-database-design.md](03-database-design.md) (query patterns) |
| **Related** | [10-architecture-design.md](10-architecture-design.md) (repository layer responsibilities), [14-service-design.md](14-service-design.md) (service uses repository) |
| **Depends On** | [11-orm-model-design.md](11-orm-model-design.md) for ORM model classes, SQLAlchemy Session |
| **Used By** | [14-service-design.md](14-service-design.md), [17-testing-strategy.md](17-testing-strategy.md) |
| **Next Reading** | [13-validator-design.md](13-validator-design.md) |
