# Phase 17: Testing Strategy — Treatment Plan Module

> **Status:** PASS | **Target Quality Score:** 9.9/10
> **MVP Scope:** Only tests for Treatment Plan, Item, Version, Approval, and Procedure management.

---

## 1. Test Strategy

| Type | Scope | Tool | Location |
|---|---|---|---|
| Unit | Models, validators, enums, state machine | pytest | tests/test_*.py |
| Repository | DB queries, filters, pagination, version snapshots | pytest + test DB | tests/test_repository.py |
| Service | Business logic, transactions, exceptions, versioning | pytest + mocks | tests/test_service.py |
| API | Endpoints, auth, error responses, status transitions | pytest + TestClient | tests/test_routers.py |
| Integration | Cross-module workflows (patient, doctor references) | pytest + test DB | tests/test_integration.py |

---

## 2. Key Test Scenarios

### 2.1 Treatment Plan CRUD

| # | Scenario | Expected |
|---|---|---|
| TC-01 | Create plan with valid data | 201 + TreatmentPlanResponse |
| TC-02 | Create plan with non-existent patient | 404 |
| TC-03 | Create plan with non-existent doctor | 404 |
| TC-04 | Get plan by valid ID | 200 + full detail |
| TC-05 | Get plan by non-existent ID | 404 |
| TC-06 | Update plan fields (PATCH) | 200 + updated |
| TC-07 | Delete draft plan | 204 |
| TC-08 | Delete accepted plan (not allowed) | 409 |

### 2.2 Status Transitions

| # | Scenario | Expected |
|---|---|---|
| TC-09 | Draft → UnderReview with items | 200 |
| TC-10 | Draft → UnderReview without items | 409 |
| TC-11 | Draft → Proposed (skip UnderReview) | 409 |
| TC-12 | UnderReview → Proposed | 200 |
| TC-13 | Proposed → Accepted with patient acknowledgment | 200 |
| TC-14 | Proposed → Accepted without patient acknowledgment | 409 |
| TC-15 | Accepted → InProgress | 200 |
| TC-16 | InProgress → Completed (all items done) | 200 |
| TC-17 | InProgress → Completed (items pending) | 409 |
| TC-18 | Completed → InProgress (terminal state) | 409 |
| TC-19 | Draft → Cancelled | 200 |
| TC-20 | InProgress → Cancelled | 200 |

### 2.3 Treatment Plan Items

| # | Scenario | Expected |
|---|---|---|
| TC-21 | Add item to plan | 201 + ItemResponse |
| TC-22 | Add item with duplicate sequence | 409 |
| TC-23 | Add item with invalid tooth number | 422 |
| TC-24 | Add item to accepted plan (auto-versioning) | 201 + version created |
| TC-25 | Update item fields | 200 |
| TC-26 | Remove item | 204 |
| TC-27 | Update item status (Pending → InProgress) | 200 |
| TC-28 | Update item status (Pending → Completed, invalid) | 409 |
| TC-29 | Reorder items | 200 + reordered list |

### 2.4 Versioning

| # | Scenario | Expected |
|---|---|---|
| TC-30 | Version created when item added to accepted plan | New TreatmentPlanVersion row |
| TC-31 | Version snapshot matches pre-modification items | Snapshot = old items |
| TC-32 | Version has correct metadata (number, reason, user) | Correct fields |
| TC-33 | Multiple modifications create sequential versions | 1, 2, 3, ... |
| TC-34 | Cannot modify version snapshot | 409 |
| TC-35 | View version history | Ordered list |

### 2.5 Approval Workflow

| # | Scenario | Expected |
|---|---|---|
| TC-36 | Record doctor approval | 201 + ApprovalResponse |
| TC-37 | Record duplicate doctor approval | 409 |
| TC-38 | Record doctor approval on non-Proposed plan | 409 |
| TC-39 | Record patient acceptance | 201 + plan auto-transitions to Accepted |
| TC-40 | Record patient rejection | 201 + status stays Proposed |
| TC-41 | Record duplicate patient acknowledgment | 409 |
| TC-42 | View approval record | 200 |

### 2.6 Procedures

| # | Scenario | Expected |
|---|---|---|
| TC-43 | Create procedure with valid data | 201 |
| TC-44 | Create procedure with duplicate code | 409 |
| TC-45 | List active procedures | 200 + filtered |
| TC-46 | Update procedure | 200 |

### 2.7 Auth and RBAC

| # | Scenario | Expected |
|---|---|---|
| TC-47 | Unauthenticated request | 401 |
| TC-48 | Receptionist creates plan | 403 |
| TC-49 | Doctor creates plan | 201 |
| TC-50 | Doctor modifies another doctor's plan | 403 |
| TC-51 | Admin modifies any plan | 200 |
| TC-52 | Receptionist views plans | 200 |

### 2.8 Validators

| # | Scenario | Expected |
|---|---|---|
| TC-53 | Valid tooth number FDI range | Pass |
| TC-54 | Invalid tooth number (0, 10, 49, 50, 86, 99) | ValueError |
| TC-55 | Valid tooth surface | Pass |
| TC-56 | Invalid tooth surface | ValueError |
| TC-57 | Valid date range | Pass |
| TC-58 | Invalid date range (from > to) | ValueError |
| TC-59 | Valid status transition | Pass |
| TC-60 | Invalid status transition (terminal state) | ValueError |

### 2.9 Edge Cases

| # | Scenario | Expected |
|---|---|---|
| TC-61 | Plan with 0 items transitions from Draft | 409 |
| TC-62 | All items cancelled → plan auto-completes | Check if plan transitions |
| TC-63 | Concurrent item add to accepted plan | Version created for each |
| TC-64 | Empty plan code generation sequence | Starts at 1 |
| TC-65 | Very large tooth surface combination | Validated correctly |
| TC-66 | Discount > estimated cost (zero-cost item) | Allowed |

---

## 3. Coverage Targets

| Layer | Target |
|---|---|
| Models | 95% |
| Validators | 100% |
| State Machine | 100% |
| Repository | 90% |
| Service | 95% |
| Routers | 90% |
| **Overall** | **90%+** |

---

## 4. Test File Structure

```
backend/app/modules/treatment/tests/
├── __init__.py
├── conftest.py                    # Fixtures: test DB, sample data, auth headers
├── test_enums.py                  # Enum values and helper methods
├── test_validators.py             # All validator pure functions
├── test_state_machine.py          # All transition rules and conditions
├── test_models.py                 # ORM model relationships and constraints
├── test_repository.py             # Repository CRUD, search, pagination
├── test_service.py                # Service business logic, transactions, versioning
├── test_routers.py                # API endpoints, auth, error responses
└── test_integration.py            # Cross-module workflows
```

---

## 5. Testing Approach

### 5.1 Validator Testing (100% Coverage)

```python
# Example: validate_tooth_number
def test_valid_tooth_numbers():
    """All valid FDI tooth numbers should pass."""
    valid = [11, 18, 21, 28, 31, 38, 41, 48, 51, 55, 61, 65, 71, 75, 81, 85]
    for tooth in valid:
        assert validate_tooth_number(tooth) == tooth


def test_invalid_tooth_numbers():
    """Numbers outside FDI ranges should raise ValueError."""
    invalid = [0, 10, 49, 50, 86, 99]
    for tooth in invalid:
        with pytest.raises(ValueError):
            validate_tooth_number(tooth)


def test_none_tooth_number():
    """None should pass (tooth number is optional)."""
    assert validate_tooth_number(None) is None
```

### 5.2 State Machine Testing (100% Coverage)

```python
def test_all_valid_transitions():
    """Every valid transition must succeed."""
    for from_state, to_states in VALID_PLAN_TRANSITIONS.items():
        for to_state in to_states:
            validate_status_transition(from_state, to_state, has_items=True)


def test_all_invalid_transitions():
    """Every invalid transition must raise ValueError."""
    all_states = set(VALID_PLAN_TRANSITIONS.keys())
    for from_state, to_states in VALID_PLAN_TRANSITIONS.items():
        invalid_states = all_states - to_states - {from_state}
        for to_state in invalid_states:
            with pytest.raises(ValueError):
                validate_status_transition(from_state, to_state, has_items=True)
```

### 5.3 Service Testing (Mocked Repository)

```python
def test_create_plan_creates_version_when_accepted():
    """Adding item to accepted plan should auto-create version."""
    # Setup
    plan = create_mock_plan(status="accepted", current_version=1)

    # Mock
    service.plan_repo.get_by_id = MagicMock(return_value=plan)
    service.plan_repo.has_items = MagicMock(return_value=True)
    service.item_repo.get_by_plan = MagicMock(return_value=[])
    service.version_repo.create = MagicMock(return_value=version)

    # Execute
    item = service.add_item(plan.id, payload, current_user_id)

    # Assert
    service._create_version.assert_called_once()
    assert service.plan_repo.increment_version.called
```

### 5.4 API Testing (TestClient)

```python
def test_create_plan_unauthorized(client):
    """Unauthenticated request should return 401."""
    response = client.post("/api/treatment-plans", json={})
    assert response.status_code == 401


def test_create_plan_as_doctor(client, doctor_token):
    """Authenticated doctor should create plan successfully."""
    response = client.post(
        "/api/treatment-plans",
        json=valid_plan_payload,
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "draft"
    assert data["plan_code"].startswith("TXN-")
```

---

## 6. Excluded from MVP

| Feature | Reason | Future |
|---|---|---|
| Payment plan tests | Not in MVP | Phase 18 |
| Insurance claim tests | Not in MVP | Phase 18 |
| Treatment outcome tests | Not in MVP | Phase 18 |
| Performance/load tests | Infrastructure concern | Pre-production |
| Security penetration tests | Infrastructure concern | Pre-production |

---

## 7. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [16-router-design.md](16-router-design.md) (endpoints to test), [14-service-design.md](14-service-design.md) (service methods), [13-validator-design.md](13-validator-design.md) (validators) |
| **Related** | [07-validation-rules.md](07-validation-rules.md) (validation rules), [04-workflows-state-machines.md](04-workflows-state-machines.md) (state machines) |
| **Depends On** | All implementation documents (Phase 11–16) for test scenarios |
| **Used By** | QA Engineers, developers during implementation |
| **Next Reading** | [18-production-review.md](18-production-review.md) |
