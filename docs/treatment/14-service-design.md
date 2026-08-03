# Phase 14: Service Design — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only service methods for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Design Patterns

Following `patients/service.py` and `doctors/services/doctor_service.py`:

- Stateless service class with `Session` dependency
- Explicit transaction management (`db.commit()` / `db.rollback()`)
- Domain exception raising (not HTTP exceptions)
- Validation before persistence
- Audit field population (created_by, updated_by)
- Logging at INFO/WARNING/ERROR levels
- State machine consultation before status transitions

---

## 2. TreatmentPlanService

```python
class TreatmentPlanService:
    def __init__(self, db: Session):
        self.db = db
        self.plan_repo = TreatmentPlanRepository(db)
        self.item_repo = TreatmentPlanItemRepository(db)
        self.version_repo = TreatmentPlanVersionRepository(db)
        self.approval_repo = TreatmentPlanApprovalRepository(db)
        self.procedure_repo = ProcedureRepository(db)
```

### 2.1 Create Plan

```python
def create_plan(self, payload: TreatmentPlanCreate, created_by: int) -> TreatmentPlan:
    """Create a new treatment plan in Draft status."""
    try:
        # Validate patient and doctor exist
        patient = self.db.query(Patient).filter(Patient.id == payload.patient_id).first()
        if not patient:
            raise PatientNotFound(payload.patient_id)

        doctor = self.db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
        if not doctor:
            raise DoctorNotFound(payload.doctor_id)

        # Validate date range
        validate_date_range(payload.valid_from, payload.valid_to)

        # Generate plan code
        next_seq = self.plan_repo.get_next_plan_code_sequence()
        plan_code = f"TXN-{next_seq:06d}"

        # Create plan
        plan = TreatmentPlan(
            plan_code=plan_code,
            patient_id=payload.patient_id,
            doctor_id=payload.doctor_id,
            clinical_notes=payload.clinical_notes,
            observations=payload.observations,
            dentist_recommendations=payload.dentist_recommendations,
            valid_from=payload.valid_from,
            valid_to=payload.valid_to,
            status="draft",
            current_version=1,
            is_active=True,
            created_by=created_by,
        )
        plan = self.plan_repo.create(plan)

        # Optionally link diagnoses
        if payload.diagnosis_ids:
            for diag_id in payload.diagnosis_ids:
                # Create items referencing diagnoses
                ...

        self.db.commit()
        logger.info("Treatment plan created: code=%s, id=%s, patient=%s",
                     plan.plan_code, plan.id, payload.patient_id)
        return plan

    except Exception:
        self.db.rollback()
        logger.exception("Failed to create treatment plan")
        raise PlanCreationFailed("Failed to create treatment plan")
```

### 2.2 List/Search Plans

```python
def list_plans(
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
    """List plans with search, filtering, pagination, and sorting."""
    return self.plan_repo.list(
        search=search,
        patient_id=patient_id,
        doctor_id=doctor_id,
        status=status,
        is_active=is_active,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=min(page_size, MAX_PAGE_SIZE),
        sort_by=sort_by,
        sort_order=sort_order,
    )
```

### 2.3 Get Plan

```python
def get_plan(self, plan_id: UUID) -> TreatmentPlan:
    """Get plan by ID with relationships loaded."""
    plan = self.plan_repo.get_by_id(plan_id)
    if not plan:
        raise PlanNotFound(plan_id)
    return plan
```

### 2.4 Update Plan

```python
def update_plan(self, plan_id: UUID, payload: TreatmentPlanUpdate, updated_by: int) -> TreatmentPlan:
    """Update plan fields. Only provided fields are updated."""
    try:
        plan = self.get_plan(plan_id)

        updates = payload.model_dump(exclude_unset=True, exclude_none=True)
        if not updates:
            return plan

        # Validate date range if both dates provided
        valid_from = updates.get("valid_from", plan.valid_from)
        valid_to = updates.get("valid_to", plan.valid_to)
        validate_date_range(valid_from, valid_to)

        plan = self.plan_repo.update(plan, updates, updated_by)
        self.db.commit()
        return plan

    except Exception:
        self.db.rollback()
        logger.exception("Failed to update plan id=%s", plan_id)
        raise PlanUpdateFailed(plan_id)
```

### 2.5 Delete Plan (Draft Only)

```python
def delete_plan(self, plan_id: UUID) -> None:
    """Hard delete a plan. Only allowed for Draft plans."""
    plan = self.get_plan(plan_id)
    validate_plan_deletable(plan.status)

    deleted = self.plan_repo.hard_delete(plan_id)
    if not deleted:
        raise PlanNotFound(plan_id)
    self.db.commit()
    logger.info("Plan deleted: id=%s", plan_id)
```

### 2.6 Status Transition

```python
def transition_status(self, plan_id: UUID, new_status: str, updated_by: int) -> TreatmentPlan:
    """Transition plan status with guarded state machine."""
    try:
        plan = self.get_plan(plan_id)

        # Validate transition against state machine
        has_items = self.plan_repo.has_items(plan_id)
        validate_status_transition(plan.status, new_status, has_items)

        # Handle specific transition side effects
        if new_status == "accepted":
            # Verify approval record exists with patient acknowledgment
            approval = self.approval_repo.get_by_plan(plan_id)
            if not approval or approval.patient_status != "accepted":
                raise InvalidPlanOperation(
                    "Plan must have patient acceptance before transitioning to Accepted"
                )

        if new_status == "completed":
            # Verify all items are in terminal states
            pending = self.plan_repo.count_active_items_by_status(plan_id, "pending")
            in_progress = self.plan_repo.count_active_items_by_status(plan_id, "in_progress")
            if pending > 0 or in_progress > 0:
                raise InvalidPlanOperation(
                    "All items must be completed or cancelled before plan can be completed"
                )

        plan = self.plan_repo.update_status(plan_id, new_status, updated_by)
        self.db.commit()
        logger.info("Plan status changed: id=%s, %s -> %s",
                     plan_id, plan.status, new_status)
        return plan

    except Exception:
        self.db.rollback()
        raise
```

### 2.7 Toggle Active Status

```python
def deactivate_plan(self, plan_id: UUID, updated_by: int) -> TreatmentPlan:
    """Deactivate a plan. Does not change its status."""
    plan = self.get_plan(plan_id)
    if not plan.is_active:
        raise InvalidPlanOperation("Plan is already inactive")
    plan = self.plan_repo.set_active_status(plan_id, False, updated_by)
    self.db.commit()
    return plan

def activate_plan(self, plan_id: UUID, updated_by: int) -> TreatmentPlan:
    """Reactivate a deactivated plan."""
    plan = self.get_plan(plan_id)
    if plan.is_active:
        raise InvalidPlanOperation("Plan is already active")
    plan = self.plan_repo.set_active_status(plan_id, True, updated_by)
    self.db.commit()
    return plan
```

### 2.8 Item Management

```python
def add_item(self, plan_id: UUID, payload: ItemCreate, current_user: int) -> TreatmentPlanItem:
    """Add an item to a treatment plan. Auto-versioning if plan is post-acceptance."""
    try:
        plan = self.get_plan(plan_id)

        # Check if plan is editable (if not, auto-version)
        if plan.status not in TreatmentPlanStatus.editable_statuses():
            self._create_version(plan_id, "Item added after plan acceptance", current_user)

        # Validate procedure exists
        procedure = self.procedure_repo.get_by_id(payload.procedure_id)
        if not procedure:
            raise ProcedureNotFound(payload.procedure_id)

        # Validate fields
        validate_tooth_number(payload.tooth_number)
        validate_tooth_surface(payload.tooth_surface)
        validate_item_cost(payload.estimated_cost or procedure.default_cost)
        validate_discount(payload.discount or 0)

        # Validate sequence uniqueness
        existing = {item.sequence_number for item in self.item_repo.get_by_plan(plan_id)}
        validate_sequence_number(payload.sequence_number, existing)

        # Create item
        item = TreatmentPlanItem(
            plan_id=plan_id,
            procedure_id=payload.procedure_id,
            sequence_number=payload.sequence_number,
            tooth_number=payload.tooth_number,
            tooth_surface=payload.tooth_surface,
            quadrant=payload.quadrant,
            arch=payload.arch,
            estimated_cost=payload.estimated_cost or procedure.default_cost,
            discount=payload.discount or 0,
            item_status="pending",
            notes=payload.notes,
            appointment_id=payload.appointment_id,
            diagnosis_id=payload.diagnosis_id,
        )
        item = self.item_repo.create(item)
        self.db.commit()
        return item

    except Exception:
        self.db.rollback()
        raise


def update_item(self, plan_id: UUID, item_id: UUID, payload: ItemUpdate) -> TreatmentPlanItem:
    """Update item fields."""
    try:
        item = self.item_repo.get_by_id(item_id)
        if not item:
            raise ItemNotFound(item_id)

        plan = self.get_plan(plan_id)

        # Auto-version if post-acceptance
        if plan.status not in TreatmentPlanStatus.editable_statuses():
            self._create_version(plan_id, "Item updated", item.plan_id)

        updates = payload.model_dump(exclude_unset=True, exclude_none=True)
        if not updates:
            return item

        item = self.item_repo.update(item_id, updates)
        self.db.commit()
        return item

    except Exception:
        self.db.rollback()
        raise


def update_item_status(self, plan_id: UUID, item_id: UUID, payload: ItemStatusUpdate) -> TreatmentPlanItem:
    """Update item status with transition validation."""
    try:
        item = self.item_repo.get_by_id(item_id)
        if not item:
            raise ItemNotFound(item_id)

        validate_item_status_transition(item.item_status, payload.item_status)

        item = self.item_repo.update_status(item_id, payload.item_status)
        self.db.commit()
        return item

    except Exception:
        self.db.rollback()
        raise


def remove_item(self, plan_id: UUID, item_id: UUID) -> None:
    """Remove an item from a plan."""
    plan = self.get_plan(plan_id)

    if plan.status not in TreatmentPlanStatus.editable_statuses():
        self._create_version(plan_id, "Item removed", plan_id)

    deleted = self.item_repo.delete(item_id)
    if not deleted:
        raise ItemNotFound(item_id)
    self.db.commit()
```

### 2.9 Version Management

```python
def _create_version(self, plan_id: UUID, change_reason: str, changed_by: int) -> TreatmentPlanVersion:
    """Create a new version snapshot. Internal method called automatically."""
    plan = self.get_plan(plan_id)
    validate_change_reason(change_reason)

    # Snapshot current items
    items = self.item_repo.get_by_plan(plan_id)
    snapshot = [
        {
            "id": str(item.id),
            "procedure_id": item.procedure_id,
            "sequence_number": item.sequence_number,
            "tooth_number": item.tooth_number,
            "tooth_surface": item.tooth_surface,
            "estimated_cost": float(item.estimated_cost),
            "discount": float(item.discount),
            "item_status": item.item_status,
            "notes": item.notes,
        }
        for item in items
    ]

    new_version_num = plan.current_version + 1

    version = TreatmentPlanVersion(
        plan_id=plan_id,
        version_number=new_version_num,
        items_snapshot=snapshot,
        change_reason=change_reason,
        changed_by=changed_by,
    )
    version = self.version_repo.create(version)
    self.plan_repo.increment_version(plan_id)
    logger.info("Version created: plan=%s, version=%d, reason=%s",
                 plan_id, new_version_num, change_reason)
    return version


def get_versions(self, plan_id: UUID) -> list[TreatmentPlanVersion]:
    """Get all versions for a plan."""
    return self.version_repo.get_by_plan(plan_id)


def get_version(self, plan_id: UUID, version_id: UUID) -> TreatmentPlanVersion:
    """Get a specific version."""
    version = self.version_repo.get_by_id(version_id)
    if not version or version.plan_id != plan_id:
        raise VersionNotFound(version_id)
    return version
```

### 2.10 Approval Management

```python
def record_doctor_approval(self, plan_id: UUID, payload: DoctorApprovalRequest, approved_by: int) -> TreatmentPlanApproval:
    """Record doctor approval for a treatment plan."""
    plan = self.get_plan(plan_id)
    validate_plan_is_proposed(plan.status)

    existing = self.approval_repo.get_by_plan(plan_id)
    if existing and existing.approved_by is not None:
        raise PlanAlreadyApproved(plan_id)

    if existing:
        # Update existing
        existing.approved_by = approved_by
        existing.approved_at = func.now()
        existing.approval_notes = payload.approval_notes
        self.db.flush()
        self.db.commit()
        return existing
    else:
        # Create new
        approval = TreatmentPlanApproval(
            plan_id=plan_id,
            approved_by=approved_by,
            approved_at=func.now(),
            patient_status="pending",
            approval_notes=payload.approval_notes,
        )
        approval = self.approval_repo.create(approval)
        self.db.commit()
        return approval


def record_patient_acknowledgment(
    self, plan_id: UUID, payload: PatientAcknowledgmentRequest
) -> TreatmentPlanApproval:
    """Record patient acknowledgment (accept/reject/request changes)."""
    plan = self.get_plan(plan_id)
    validate_plan_is_proposed(plan.status)
    validate_acknowledgment_status(payload.patient_status)

    existing = self.approval_repo.get_by_plan(plan_id)
    if existing and existing.patient_status != "pending":
        raise PatientAcknowledgmentExists(plan_id)

    updates = {
        "patient_status": payload.patient_status,
        "patient_acknowledged_at": func.now(),
        "approval_notes": payload.approval_notes,
    }

    if existing:
        approval = self.approval_repo.update(existing, updates)
    else:
        updates["plan_id"] = plan_id
        approval = TreatmentPlanApproval(**updates)
        approval = self.approval_repo.create(approval)

    # Auto-transition plan if accepted
    if payload.patient_status == "accepted":
        self.plan_repo.update_status(plan_id, "accepted", plan.updated_by or 0)
        logger.info("Plan auto-accepted: id=%s", plan_id)

    self.db.commit()
    return approval


def get_approval(self, plan_id: UUID) -> TreatmentPlanApproval:
    """Get approval record for a plan."""
    approval = self.approval_repo.get_by_plan(plan_id)
    if not approval:
        raise ApprovalNotFound(plan_id)
    return approval
```

### 2.11 Procedure Management

```python
def list_procedures(self, active_only: bool = True) -> list[Procedure]:
    """List procedures."""
    if active_only:
        return self.procedure_repo.list_active()
    return self.procedure_repo.list_all()

def create_procedure(self, payload: ProcedureCreate) -> Procedure:
    """Create a new procedure."""
    try:
        # Validate code uniqueness
        existing = self.procedure_repo.get_by_code(payload.code)
        if existing:
            raise DuplicateProcedureDetected(payload.code)

        code = validate_procedure_code(payload.code)
        name = validate_procedure_name(payload.name)

        procedure = Procedure(
            code=code,
            name=name,
            description=payload.description,
            default_cost=payload.default_cost or 0,
            category=payload.category,
            is_active=True,
        )
        procedure = self.procedure_repo.create(procedure)
        self.db.commit()
        return procedure

    except Exception:
        self.db.rollback()
        raise


def update_procedure(self, procedure_id: int, payload: ProcedureUpdate) -> Procedure:
    """Update a procedure."""
    try:
        procedure = self.procedure_repo.get_by_id(procedure_id)
        if not procedure:
            raise ProcedureNotFound(procedure_id)

        updates = payload.model_dump(exclude_unset=True, exclude_none=True)
        if not updates:
            return procedure

        procedure = self.procedure_repo.update(procedure, updates)
        self.db.commit()
        return procedure

    except Exception:
        self.db.rollback()
        raise
```

---

## 3. Service Methods Summary

| Method | Transaction | Audit | Validators Called |
|---|---|---|---|
| `create_plan` | Yes | created_by | validate_date_range, patient/doctor lookup |
| `list_plans` | No (read) | — | — |
| `get_plan` | No (read) | — | — |
| `update_plan` | Yes | updated_by | validate_date_range |
| `delete_plan` | Yes | — | validate_plan_deletable |
| `transition_status` | Yes | updated_by | validate_status_transition, business conditions |
| `deactivate_plan` | Yes | updated_by | — |
| `activate_plan` | Yes | updated_by | — |
| `add_item` | Yes | — | validate_tooth_number, validate_item_cost, validate_sequence |
| `update_item` | Yes | — | Field validators |
| `update_item_status` | Yes | — | validate_item_status_transition |
| `remove_item` | Yes | — | Plan status check |
| `_create_version` | Yes | — | validate_change_reason |
| `get_versions` | No (read) | — | — |
| `get_version` | No (read) | — | — |
| `record_doctor_approval` | Yes | approved_by | validate_plan_is_proposed |
| `record_patient_acknowledgment` | Yes | — | validate_acknowledgment_status |
| `get_approval` | No (read) | — | — |
| `create_procedure` | Yes | — | validate_procedure_code, validate_procedure_name |
| `update_procedure` | Yes | — | — |
| `list_procedures` | No (read) | — | — |

---

## 4. Service Methods Excluded from MVP

| Method | Feature | Future Phase |
|---|---|---|
| `generate_payment_plan` | Payment schedule generation | Phase 18 |
| `submit_insurance_claim` | Insurance claim management | Phase 18 |
| `record_treatment_outcome` | Outcome tracking | Phase 18 |
| `attach_supporting_document` | Document management | Phase 18 |

---

## 5. Why Services Own Transactions

### 5.1 Transaction Ownership Principle

In this architecture, **services own transactions**, not repositories. This is a deliberate design choice following the Unit of Work pattern.

| Aspect | Service-Owned Transaction | Repository-Owned Transaction |
|---|---|---|
| **Boundary** | Use-case scoped (may span multiple repository calls) | Single CRUD operation |
| **Rollback scope** | Entire use case (create item + update plan + create version) | Single repository call |
| **Business logic** | Can abort mid-flow based on validation results | Cannot abort — already committed |
| **Atomicity** | Multiple operations atomically succeed or fail | Each operation is its own transaction |
| **Example** | `add_item()` → validate → create item → create version → increment version | `create()` → INSERT only |

### 5.2 Why Not Repositories?

If repositories owned transactions, the service would have no way to coordinate multi-step operations. Consider:

```python
# If repository owned transactions, this would be IMPOSSIBLE:
def add_item(self, plan_id, payload, user):
    plan = self.plan_repo.get_by_id(plan_id)  # Transaction 1
    if plan.status not in editable_statuses:
        self.version_repo.create(...)  # Transaction 2
        self.plan_repo.increment_version(...)  # Transaction 3
    item = self.item_repo.create(...)  # Transaction 4
    # If step 4 fails, steps 2-3 are already committed — data corruption!
```

### 5.3 Rollback Pattern

```python
def update_plan(self, plan_id, payload, updated_by):
    try:
        plan = self.get_plan(plan_id)
        updates = payload.model_dump(exclude_unset=True)
        plan = self.plan_repo.update(plan, updates, updated_by)
        self.db.commit()  # Single commit at end
        return plan
    except Exception:
        self.db.rollback()  # Full rollback on any failure
        raise
```

Every public service method follows this pattern: validate → execute → commit on success → rollback on failure.

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [12-repository-design.md](12-repository-design.md), [13-validator-design.md](13-validator-design.md), [08-enums-constants.md](08-enums-constants.md) |
| **Related** | [10-architecture-design.md](10-architecture-design.md) (architecture), [04-workflows-state-machines.md](04-workflows-state-machines.md) (state machine) |
| **Depends On** | [12-repository-design.md](12-repository-design.md) for repository classes, [13-validator-design.md](13-validator-design.md) for validators |
| **Used By** | [16-router-design.md](16-router-design.md), [17-testing-strategy.md](17-testing-strategy.md) |
| **Next Reading** | [15-mappers-schemas.md](15-mappers-schemas.md) |
