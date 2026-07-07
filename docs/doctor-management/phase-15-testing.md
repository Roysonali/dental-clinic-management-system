# Phase 15: Testing — Doctor Management Module

> **Status:** IN REVIEW | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only tests for Doctor Profile, Specialization, and Schedule management.

---

## 1. Test Strategy

| Type | Scope | Tool | Location |
|---|---|---|---|
| Unit | Models, validators, enums | pytest | tests/test_*.py |
| Repository | DB queries, filters, pagination | pytest + test DB | tests/test_repository.py |
| Service | Business logic, transactions, exceptions | pytest + mocks | tests/test_service.py |
| API | Endpoints, auth, error responses | pytest + TestClient | tests/test_routers.py |
| Integration | Cross-module workflows | pytest + test DB | tests/test_integration.py |

---

## 2. Key Test Scenarios

### 2.1 Doctor CRUD

| # | Scenario | Expected |
|---|---|---|
| TC-01 | Create doctor with valid data | 201 + DoctorResponse |
| TC-02 | Create with duplicate doctor code | 409 |
| TC-03 | Create with non-existent user_id | 404 |
| TC-04 | Create with non-doctor user role | 422 |
| TC-05 | Create with existing user_id profile | 409 |
| TC-06 | Get doctor by valid ID | 200 |
| TC-07 | Get doctor by non-existent ID | 404 |
| TC-08 | Update doctor fields (PATCH) | 200 + updated |
| TC-09 | Deactivate then reactivate | is_active toggles |
| TC-10 | Deactivate already inactive | 409 |

### 2.2 Search and Filtering

| # | Scenario | Expected |
|---|---|---|
| TC-11 | List doctors with pagination | Correct items + total |
| TC-12 | Search by name (partial match) | Filtered |
| TC-13 | Filter by specialization | Correct subset |
| TC-14 | Filter by availability | Available only |
| TC-15 | Filter by active status | Active/inactive only |
| TC-16 | Sort by name ASC | Correct order |

### 2.3 Specializations

| # | Scenario | Expected |
|---|---|---|
| TC-17 | Assign specialization | 201 |
| TC-18 | Remove specialization | 204 |
| TC-19 | Set primary specialization | Primary flag set |
| TC-20 | Assign duplicate specialization | 422 |

### 2.4 Schedules

| # | Scenario | Expected |
|---|---|---|
| TC-21 | Create schedule entry | 201 |
| TC-22 | Create overlapping schedule | 409 |
| TC-23 | Create with end < start | 422 |
| TC-24 | Delete schedule entry | 204 |
| TC-25 | Update schedule entry | 200 |

### 2.5 Auth and RBAC

| # | Scenario | Expected |
|---|---|---|
| TC-26 | Unauthenticated request | 401 |
| TC-27 | Receptionist creates doctor | 403 |
| TC-28 | Admin creates doctor | 201 |
| TC-29 | Doctor views own profile | 200 |
| TC-30 | Receptionist searches doctors | 200 |

### 2.6 Validation

| # | Scenario | Expected |
|---|---|---|
| TC-31 | Missing required primary_phone | 422 |
| TC-32 | Invalid phone format | 422 |
| TC-33 | Zero or negative consultation fee | 422 |
| TC-34 | Inactive doctor toggles available_for_appointment | 409 |
| TC-35 | Invalid registration_number duplicate | 409 |

---

## 3. Coverage Targets

| Layer | Target |
|---|---|
| Models | 95% |
| Validators | 100% |
| Repository | 90% |
| Service | 95% |
| Routers | 90% |
| **Overall** | **90%+** |

---

## 4. Excluded from MVP

| Feature | Reason | Future |
|---|---|---|
| Credential CRUD tests | Not in MVP | Phase 18 |
| Leave request/approval tests | Not in MVP | Phase 18 |
| Commission rate tests | Not in MVP | Phase 18 |
| Performance metric tests | Not in MVP | Phase 18 |
