# Doctor Management Module — Final Production Implementation Roadmap

> **Target Quality:** 9.9+/10
> **Architecture:** Router → Service → Validator → Repository → Database
> **Based On:** Phase 1-18 Design Documents (post-audit, PASS state)
> **Last Updated:** 2026-07-07

---

## Deliverable 1 — Dependency Graph

Constants/Enums (Phase 8) → Exceptions (Phase 5) → Models (Phase 9) → Pydantic Schemas (Phase 10) → Validators (schematic in schemas, business in validators.py) → Repository (Phase 11) → Mapper (Phase 12) → Service (Phase 12) → Dependencies (Phase 14) → Router (Phase 14) → Tests (Phase 15)

**Why this order:**
1. Constants/Enums first — models and schemas reference them
2. Exceptions before schemas — service layer raises them
3. Models before migrations — Alembic generates from model metadata
4. Pydantic Schemas before validators — validators operate on schema fields
5. Validators before repository — business validators are independent of persistence
6. Repository before service — service composes repository methods
7. Mapper before service — service returns mapped responses
8. Service before dependencies — `doctor_owner_or_admin` calls `service.get_doctor()`
9. Dependencies before router — endpoint decorators reference them
10. Tests after each production layer — test-per-phase for unit tests

**Architecture Layer Rules (Enforced):**
- Validators do NOT depend on Repository
- Services do NOT depend on Router
- Repositories do NOT import Schemas
- Routers do NOT access Repositories directly
- Mapper depends on Schemas and Models only
- Tests follow production layer order

---

## Deliverable 2 — File Creation Order

```
backend/app/modules/doctors/
+-- 01  __init__.py
+-- 02  constants.py
+-- 03  enums.py             (minimal — only module-specific enums)
+-- 04  exceptions.py
+-- 05  models.py
+-- 06  schemas.py           (includes Pydantic field_validators)
+-- 07  validators.py        (business validators only)
+-- 08  repository.py
+-- 09  mapper.py
+-- 10  service.py
+-- 11  dependencies.py
+-- 12  router.py
+-- 13  __init__.py           (in tests/)
+-- 14  conftest.py           (in tests/)
+-- 15-18 test_models.py, test_validators.py, test_repository.py, test_service.py
+-- 19-20 test_routers.py, test_integration.py
+-- 21  alembic/env.py update  (add import for Doctor models)
+-- 22-25 alembic migrations 001-004
+-- 26  app/core/exception_handlers.py update  (register DoctorException)
+-- 27  app/main.py update    (register doctor and specialization routers)
```

**Why each file comes at that point:**
- 01-03: Zero-dependency foundation
- 04 exceptions.py: Imported by service, router, and tests
- 05 models.py: Only depends on Base from app.database.base
- 06 schemas.py: Independent of exceptions/repository/service. **Ordered within to respect dependency chain** (see Deliverable 5)
- 07 validators.py: Must exist before service.py
- 08 repository.py: No dependency on service or schemas
- 09 mapper.py: Imports both models and schemas
- 10 service.py: Orchestrates repository + validator + mapper
- 11 dependencies.py: Imports service and RBAC permissions
- 12 router.py: Imports schemas, dependencies, service, exceptions
- 13-20 tests: Follow same dependency order as production code
- 21 env.py: Must import Doctor models before migration generation
- 22-25 Alembic: Generated after models are stable
- 26 exception_handlers.py: Register DoctorException for global handling
- 27 main.py: Register routers for endpoint availability

---

## Deliverable 3 — Database & Migration Strategy

### Migration Strategy Decision: Four Separate Migrations (RETAINED)

**Rationale:**
- **Migration 001** (specializations) — Zero-dependency table. Rolls back independently.
- **Migration 002** (doctors) — Depends on existing `users` table only. Largest migration. Rolls back independently.
- **Migration 003** (doctor_specializations) — Depends on both doctors + specializations. Can roll back without affecting 004.
- **Migration 004** (doctor_schedules) — Depends on doctors only. Independent of 003.

Alembic best practices confirmed:
- Each migration is small and focused
- Rollback is easy: `alembic downgrade -1` works cleanly at any step
- Autogenerate detects each table independently
- Production deployment applies sequentially with verification at each step

### Model Implementation Order

Specialization → Doctor → DoctorSpecialization → DoctorSchedule

### Migration Order

| Step | Action | Dependencies | Verification |
|------|--------|-------------|--------------|
| 1 | Create Specialization model | None | Import works |
| 2 | Create Doctor model | Existing User model | FK verified |
| 3 | Create DoctorSpecialization model | Doctor + Specialization models | Composite FK verified |
| 4 | Create DoctorSchedule model | Doctor model | FK verified |
| 5 | Generate migration 001 (specializations) | Step 1 | `alembic upgrade head` |
| 6 | Review migration 001 | Step 5 | Manual review |
| 7 | Apply migration 001 | Step 6 | Verify table exists |
| 8 | **Seed specializations** | **Step 7** | **8 rows inserted** |
| 9 | Generate migration 002 (doctors) | Steps 2, 6 | `alembic upgrade head` |
| 10 | Review migration 002 | Step 9 | Manual review |
| 11 | Apply migration 002 | Step 10 | Verify table + indexes |
| 12 | Generate migration 003 (doctor_specializations + partial unique index) | Steps 3, 8 | `alembic upgrade head` |
| 13 | Review migration 003 | Step 12 | Manual review |
| 14 | Apply migration 003 | Step 13 | Verify composite PK + partial index |
| 15 | Generate migration 004 (doctor_schedules + CHECK constraints) | Steps 4, 11 | `alembic upgrade head` |
| 16 | Review migration 004 | Step 15 | Manual review |
| 17 | Apply migration 004 | Step 16 | Verify CHECK constraints |
| 18 | Verify all rollbacks | Steps 5-17 | downgrade -1 from each |

**Changed: Seed after migration 001** — Previously seeded after all migrations. Moving seed to immediately after 001 allows specializations to be available during development of later components.

### Rollback Checkpoints

After every migration: `alembic downgrade -1` → `alembic upgrade head`

### Foreign Key Addition Sequence
- specializations: no FKs
- doctors.user_id → users.id (FK to existing table)
- doctor_specializations.doctor_id → doctors.id
- doctor_specializations.specialization_id → specializations.id
- doctor_schedules.doctor_id → doctors.id
- doctors.created_by → users.id
- doctors.updated_by → users.id

---

## Deliverable 4 — Model Implementation Order

**No changes required.** Current order is optimal.

### 1. Specialization
- Dependencies: None (no FKs to new tables)
- Relationships: doctor_assignments → DoctorSpecialization
- Indexes: ix_specializations_active on is_active
- Constraints: name UNIQUE, code UNIQUE

### 2. Doctor
- Dependencies: User (FK reference to existing users table)
- Relationships: user → User, creator → User, updater → User, specializations → DoctorSpecialization, schedules → DoctorSchedule
- Validations: doctor_code UNIQUE, user_id UNIQUE + FK, registration_number UNIQUE
- Indexes: ix_doctors_active_available, ix_doctors_created_by, ix_doctors_updated_by
- Constraints: ck_doctors_years_experience (>= 0), ck_doctors_fee_positive (> 0), ck_doctors_duration_positive (> 0)

### 3. DoctorSpecialization
- Dependencies: Doctor (FK → doctors.id), Specialization (FK → specializations.id)
- Relationships: doctor ↔ Doctor, specialization ↔ Specialization
- Indexes: ix_ds_specialization, ix_ds_doctor_specialization
- Partial unique index: uq_doctor_primary_specialization

### 4. DoctorSchedule
- Dependencies: Doctor (FK → doctors.id)
- Relationships: doctor ↔ Doctor
- Indexes: ix_schedule_doctor_day, ix_schedule_active
- Constraints: ck_schedule_day_of_week (0-5), ck_schedule_end_after_start

---

## Deliverable 5 — Schema Implementation Order (REVISED)

**Changed: Fixed dependency violation.** `DoctorSpecializationResponse` is used by `DoctorResponse` but was listed after it. Also `ScheduleResponse` is used by `DoctorProfileResponse` but was listed after it.

**Correct dependency order:**

1. **DoctorBase** — Common base fields for DoctorCreate/DoctorUpdate
2. **DoctorCreate** — Request schema (extends DoctorBase concepts)
3. **DoctorUpdate** — All fields optional for PATCH
4. **SpecializationCreate** — Simple independent schema
5. **SpecializationResponse** — Simple independent response schema
6. **DoctorSpecializationAssign** — Request schema (references specialization_id only)
7. **DoctorSpecializationResponse** — Response schema (references SpecializationResponse fields) → **Must be before DoctorResponse**
8. **DoctorResponse** — Full response with `specializations: list[DoctorSpecializationResponse]`
9. **DoctorListResponse** — Wraps `items: list[DoctorResponse]`
10. **DoctorAvailabilityResponse** — Simple computed availability
11. **DoctorAvailabilityUpdate** — Toggle request schema
12. **DoctorLeaveToggle** — Toggle request schema
13. **ScheduleCreate** — Request schema (day_of_week, start_time, end_time)
14. **ScheduleUpdate** — Request schema (all optional)
15. **ScheduleResponse** — Response schema → **Must be before DoctorProfileResponse**
16. **DoctorProfileResponse** — Extends DoctorResponse with `schedules: list[ScheduleResponse]`

**What changed:**
- Moved `DoctorSpecializationResponse` (item 7) before `DoctorResponse` (item 8)
- Moved `ScheduleResponse` (item 15) before `DoctorProfileResponse` (item 16)
- Moved `SpecializationCreate/Response` (items 4-5) before assignment schemas
- Reordered all response schemas to respect import dependency chain

**Expected benefit:** No import errors, correct Pydantic model resolution, follows Python dependency order.

---

## Deliverable 6 — Repository Roadmap

**Changed: Added private helper methods before CRUD methods for query construction.**

### DoctorRepository Methods (in order)

**Internal helpers (implement first):**
1. `_build_base_query()` — Start with `db.query(Doctor).join(User)`
2. `_apply_search_filter(query, search)` — Apply ILIKE on User.full_name + Doctor.doctor_code
3. `_apply_specialization_filter(query, specialization_id)` — Join DoctorSpecialization
4. `_apply_status_filters(query, is_active, available)` — Apply boolean filters
5. `_apply_sorting(query, sort_by, sort_order)` — Resolve sort column through User join
6. `_paginate(query, page, page_size)` — Offset + limit

**CRUD methods:**
7. `create()` — Basic write
8. `get_by_id()` — With selectinload(Doctor.specializations, Doctor.schedules)
9. `get_by_user_id()` — Duplicate-user validation
10. `get_by_doctor_code()` — Code uniqueness check
11. `update()` — Field-level updates
12. `list()` — Build query via helpers, dedup, paginate, return (items, total)
13. `set_active_status()` — Simple is_active update
14. `toggle_availability()` / `toggle_leave()` — Boolean toggles
15. `get_next_doctor_code_sequence()` — Max sequence extraction

### SpecializationRepository
`create()` → `get_by_id()` → `get_by_name()` → `list_active()` → `list_all()`

### DoctorSpecializationRepository
`get_by_doctor()` → `add()` → `remove()` → `set_primary()` → `get_primary()`

### DoctorScheduleRepository
`get_by_doctor()` → `get_by_id()` → `create()` → `update()` → `delete()` → `has_overlap()`

**What changed:**
- Added 6 private helper methods before CRUD methods for the DoctorRepository `list()` method
- This follows a clean builder pattern and makes the `list()` method readable

**Expected benefit:** Improved maintainability, testable query building blocks, consistent pattern for future filter additions.

---

## Deliverable 7 — Service Roadmap (REVISED)

**Changed:**
1. **Read operations before write operations** — Implement all read/query methods first for faster debugging
2. **Added missing service methods** — `create_specialization`, `get_doctor_specializations`, `get_doctor_schedules` were missing
3. **Split into Phase G1 and G2** — 19 methods was too large for one phase

### Phase G1 — Read Service Methods

1. `get_doctor(doctor_id)` — Single doctor read (verifies repository.get_by_id works)
2. `list_doctors(search, filters, page, page_size, sort)` — List/search/paginate
3. `check_availability(doctor_id)` — Computed availability (INV-11, INV-12)
4. `list_active_specializations()` — All active specializations
5. `get_doctor_specializations(doctor_id)` — Doctor's specialization assignments
6. `get_doctor_schedules(doctor_id)` — Doctor's active schedules
7. `get_doctor_profile(doctor_id)` — Extended profile (includes schedules)

### Phase G2 — Write Service Methods

8. `create_doctor(payload, created_by)` — Create profile with validation
9. `update_doctor(doctor_id, payload, updated_by)` — Partial update
10. `change_status(doctor_id, is_active, updated_by)` — Activate/deactivate
11. `toggle_availability(doctor_id, available)` — Toggle availability flag
12. `toggle_leave(doctor_id, on_leave)` — Toggle leave flag
13. `create_specialization(payload)` — Create new specialization
14. `assign_specialization(doctor_id, payload)` — Assign to doctor
15. `remove_specialization(doctor_id, specialization_id)` — Remove assignment
16. `set_primary_specialization(doctor_id, specialization_id)` — Set as primary
17. `create_schedule(doctor_id, payload)` — Create with overlap detection
18. `update_schedule(schedule_id, payload, doctor_id)` — Update with overlap check
19. `delete_schedule(schedule_id)` — Delete with not-found check

**Transaction boundaries:** Every write method uses try/except with explicit commit/rollback. Read methods do not open transactions.

**What changed:**
- Reordered: reads (1-7) before writes (8-19)
- Added methods 5, 6, 7 (missing from original roadmap but referenced by router)
- Added method 13 (create_specialization — referenced by router Phase 14 §5.3)

**Expected benefit:** Reads can be verified independently before writes add mutation complexity. No missing methods that would break router compilation.

---

## Deliverable 8 — Router Roadmap (REVISED)

**Changed: Split into Phase I1 and I2 (20 endpoints was too large). Also reordered to start with simplest read-first endpoints.**

### Phase I1 — Doctor Profile & Status Endpoints

Endpoint implementation order:

1. **GET /specializations** (simplest — no path params, read-only, no DB dependency on doctors)
2. **GET /doctors/{id}** (single doctor read — verify get_by_id with selectinload)
3. **GET /doctors** (list with search/filter/pagination — most complex read)
4. **POST /doctors** (first write — creates data for all other endpoints)
5. **GET /doctors/{id}/availability** (computed availability — verifies service logic)
6. **PATCH /doctors/{id}** (update — requires existing doctor from step 4)
7. **PATCH /doctors/{id}/deactivate** (status change)
8. **PATCH /doctors/{id}/activate** (status change)
9. **PATCH /doctors/{id}/availability** (toggle availability)
10. **PATCH /doctors/{id}/leave-toggle** (toggle leave)
11. **GET /doctors/{id}/profile** (extended profile with schedules)

### Phase I2 — Specialization & Schedule Endpoints

12. **POST /specializations** (create specialization)
13. **GET /doctors/{id}/specializations** (list doctor's specializations)
14. **POST /doctors/{id}/specializations** (assign specialization)
15. **DELETE /doctors/{id}/specializations/{sid}** (remove specialization)
16. **PUT /doctors/{id}/specializations/primary/{sid}** (set primary)
17. **GET /doctors/{id}/schedules** (list schedules)
18. **POST /doctors/{id}/schedules** (create schedule with overlap detection)
19. **PATCH /doctors/{id}/schedules/{sid}** (update schedule)
20. **DELETE /doctors/{id}/schedules/{sid}** (delete schedule)

**What changed:**
- Reordered: GET /specializations first (simplest), then doctor reads, then doctor writes
- Moved schedule endpoints to I2 with specialization endpoints
- Split into two phases (I1: 11 endpoints, I2: 9 endpoints)
- Rearranged to test "healthiest CRUD" (doctor GET) before "complex CRUD" (specialization + schedule)

**Expected benefit:** Read endpoints are verified before writes create data. Schedule overlap logic gets its own phase for focused debugging.

---

## Deliverable 9 — Mapper Placement

**Decision: Implement mapper AFTER repository, BEFORE service.**

**Rationale:**
- Mapper depends on schemas (must exist) and models (must exist)
- Mapper does NOT depend on repository
- Service calls mapper to transform ORM → Pydantic
- Repository does NOT call mapper

**Optimal placement in file creation order:** File 09 (after repository at 08, before service at 10)

**What changed:** Clarified that mapper is placed after repository and before service — the original roadmap had this correct but the rationale is now explicitly stated.

**Expected benefit:** Clear dependency chain prevents circular imports and ensures mapper availability when service needs it.

---

## Deliverable 10 — Validator Architecture

**Decision: Split into Schema Validators (inline @field_validator in schemas.py) and Business Validators (separate validators.py).**

This matches the existing DensCare pattern:
- **Schema Validators** — Pydantic `@field_validator` decorators for field-level validation (phone format, gender validation, end_time > start_time, text normalization)
- **Business Validators** — Dedicated validation functions in `validators.py` for cross-field/cross-entity validation (user exists, user has DOCTOR role, no duplicate profile, no schedule overlap)

**Schema Validators (in schemas.py):**
- `validate_phone` — Regex pattern match
- `validate_gender` — Against allowed set
- `validate_end_after_start` — Schedule time validation (cross-field)
- `normalize_registration` — Strip + uppercase
- Field constraints (gt=0, ge=0, le=5, etc.)

**Business Validators (in validators.py):**
- `validate_user_exists(user_id)` — User in DB
- `validate_user_is_doctor(user)` — DOCTOR-family role
- `validate_no_duplicate_user(user_id)` — No existing profile
- `validate_specializations_exist(ids)` — All specialization IDs valid
- `validate_primary_exists(specializations)` — At least one primary

**What changed:** Explicitly separated the two validator concerns rather than lumping all validation into a single file.

**Expected benefit:** Schema validators catch bad input early (Pydantic layer). Business validators catch domain violations (service layer). Clear separation of concerns matching existing codebase.

---

## Deliverable 11 — Dependencies Order

**Decision: Implement `doctor_owner_or_admin` AFTER service, BEFORE router.**

**Rationale:**
- `doctor_owner_or_admin` calls `service.get_doctor(doctor_id)` — service must exist
- `doctor_owner_or_admin` uses `require_roles()` — RBAC already exists in cross-module
- Router endpoints reference `doctor_owner_or_admin` via `Depends()` — dependencies must exist before router

**Implementation order:**
1. RBAC permissions (already exists — `app/modules/rbac/permissions.py`)
2. Service (Phase G1/G2 — `get_doctor` method must exist)
3. `doctor_owner_or_admin` in dependencies.py
4. Router (references dependencies)

**What changed:** Clarified that `doctor_owner_or_admin` calls `service.get_doctor()`, which means the read service methods (Phase G1) must be complete before dependency implementation.

**Expected benefit:** No broken dependency chains. Dependencies compile on first implementation.

---

## Deliverable 12 — Testing Strategy (REVISED)

**Changed: Test-Per-Phase for unit tests, not all-at-end.**

### Phase T1 — Model Tests (after Phase A)
- `test_models.py` — Column defaults, relationships, constraints, __repr__
- Verify all 4 model imports work
- Run: `pytest tests/test_models.py -v`

### Phase T2 — Validator Tests (after Phase C/D)
- `test_validators.py` — Phone, gender, end_time > start_time
- Run: `pytest tests/test_validators.py -v`

### Phase T3 — Repository Tests (after Phase E)
- `test_repository.py` — CRUD, search, pagination, overlap, dedup
- Run: `pytest tests/test_repository.py -v`

### Phase T4 — Mapper Tests (after Phase F)
- `test_mapper.py` — ORM to Pydantic, user_full_name/email resolution
- Run: `pytest tests/test_mapper.py -v`

### Phase T5 — Service Tests (after Phase G)
- `test_service.py` — Business logic, INV-11, transactions, all BR rules
- Run: `pytest tests/test_service.py -v`

### Phase T6 — Router + Integration Tests (after Phase I)
- `test_routers.py` — All 20 endpoints, auth, RBAC, error mapping
- `test_integration.py` — Cross-module workflows (20 scenarios)
- Run: `pytest tests/ -v --cov`

### Regression Tests
- Appointment availability lookup (cross-module)
- User deactivation → doctor still exists
- Doctor deactivation → user still active

**What changed:** Unit tests (models, validators, repository, mapper, service) are now implemented immediately after their production code, not all at the end. Router + integration tests remain at the end.

**Expected benefit:** Bugs caught within minutes of being introduced. Debugging is local to the current layer. Test coverage builds incrementally. Reduced integration debugging time.

---

## Deliverable 13 — Git Strategy (REVISED)

**Changed: Refined commit boundaries to include foundation files and ensure each commit is independently working.**

```
git checkout -b feature/doctors-mvp
git commit -m "feat(doctors): add foundation (constants, enums, exceptions, models, __init__)"
git commit -m "feat(doctors): add alembic migrations for 4 tables + seed specializations"
git commit -m "feat(doctors): add pydantic schemas with field validators"
git commit -m "feat(doctors): implement business validators"
git commit -m "feat(doctors): implement repository layer with helper methods"
git commit -m "feat(doctors): implement mapper layer"
git commit -m "feat(doctors): implement read service methods (Phase G1)"
git commit -m "feat(doctors): implement write service methods with transactions (Phase G2)"
git commit -m "feat(doctors): implement dependencies (doctor_owner_or_admin)"
git commit -m "feat(doctors): implement doctor profile + status router endpoints (Phase I1)"
git commit -m "feat(doctors): implement specialization + schedule router endpoints (Phase I2)"
git commit -m "feat(doctors): register routers in main.py, exceptions in handlers, models in env.py"
git commit -m "test(doctors): add unit tests (models, validators, repository, mapper, service)"
git commit -m "test(doctors): add integration and API tests"
git commit -m "docs(doctors): update API documentation and OpenAPI tags"
git checkout develop
git merge feature/doctors-mvp
```

**What changed:**
- Foundation files (`__init__.py`, `constants.py`, `enums.py`, `exceptions.py`) included with models commit
- Migration moved to separate commit (models + migration validates DB)
- Read/write service methods split into two commits
- Router split into two commits (Phase I1 and I2)
- Added explicit commit for `main.py`/`env.py`/`exception_handlers.py` registration
- Tests split into unit tests commit + integration/API tests commit

**Discipline:** Each commit compiles and all existing tests pass. No push until test suite passes.

**Expected benefit:** Each commit is independently working. Smaller commits are easier to review and rollback. No commit has > 5 files changed (except possibly the foundation commit).

---

## Deliverable 14 — Review Checkpoints (REVISED)

**Changed: Each checkpoint now includes explicit git commit + manual verification steps.**

### CP1: After Models + Foundation
- **Files completed:** `__init__.py`, `constants.py`, `enums.py`, `exceptions.py`, `models.py`
- **Tests passing:** `test_models.py` — all column defaults, relationships, constraints
- **Manual verification:** Import all 4 models in Python shell without error
- **Git commit:** `feat(doctors): add foundation (constants, enums, exceptions, models, __init__)`
- **Ready criteria:** `from app.modules.doctors.models import *` runs without error

### CP2: After Migration + Seed
- **Files completed:** 4 migration files, alembic/env.py update, seed script
- **Tests passing:** `alembic upgrade head` succeeds, `alembic downgrade -1` succeeds at each step
- **Manual verification:** Verify specializations table has 8 rows
- **Git commit:** `feat(doctors): add alembic migrations for 4 tables + seed specializations`
- **Ready criteria:** DB has all 4 tables, 8 specializations seeded, all rollbacks verified

### CP3: After Schemas + Validators
- **Files completed:** `schemas.py`, `validators.py`
- **Tests passing:** `test_validators.py` — phone, gender, end_time > start_time
- **Manual verification:** Pydantic schema instantiation works, `extra="forbid"` rejects unknown fields
- **Git commit:** `feat(doctors): add pydantic schemas with field validators`
- **Ready criteria:** All 15+ schemas importable, validators reject bad input

### CP4: After Repository
- **Files completed:** `repository.py`
- **Tests passing:** `test_repository.py` — CRUD, search, pagination, overlap detection
- **Manual verification:** Repository methods execute against test DB
- **Git commit:** `feat(doctors): implement repository layer with helper methods`
- **Ready criteria:** All 4 repositories functional, list() returns correct paginated results

### CP5: After Mapper
- **Files completed:** `mapper.py`
- **Tests passing:** `test_mapper.py` — ORM to Pydantic with user_full_name/email resolution
- **Manual verification:** Mapper transforms ORM instance to correct Pydantic output
- **Git commit:** `feat(doctors): implement mapper layer`
- **Ready criteria:** `DoctorResponse` has `user_full_name` and `user_email` populated

### CP6: After Service (Read + Write)
- **Files completed:** `service.py`
- **Tests passing:** `test_service.py` — All business rules, transaction boundaries, INV-11
- **Manual verification:** Verify exception propagation, commit/rollback behavior
- **Git commit:** `feat(doctors): implement read/write service methods with transactions`
- **Ready criteria:** All 19 service methods functional, all BR rules enforced

### CP7: After Dependencies + Router
- **Files completed:** `dependencies.py`, `router.py`, `main.py` updated
- **Tests passing:** `test_routers.py`, `test_integration.py`
- **Manual verification:** Hit each endpoint with test client, verify auth/RBAC
- **Git commit:** `feat(doctors): implement router endpoints + register in app`
- **Ready criteria:** All 20 endpoints return correct responses, auth enforced

### CP8: Production Audit
- **Files completed:** All production code
- **Tests passing:** All tests pass, coverage >= 90%
- **Manual verification:** Phase 17 checklist complete
- **Git commit:** `chore(doctors): production hardening and audit`
- **Ready criteria:** Phase 17 checklist all checked

---

## Deliverable 15 — Coding Phases (REVISED)

**Changed: Phase G split into G1 + G2. Phase I split into I1 + I2. Seed data moved to Phase B. Testing split into T1 + T2.**

| Phase | Name | Components | Complexity |
|-------|------|-----------|------------|
| **A** | Foundation | `__init__.py`, `constants.py`, `enums.py`, `exceptions.py`, `models.py` (4 models) | Low |
| **B** | Migration | env.py update, 4 migration files, seed specializations | Medium |
| **C** | Schemas | `schemas.py` (15+ schemas with inline @field_validator) | Medium |
| **D** | Validators | `validators.py` (5 business validation functions) | Low |
| **E** | Repository | `repository.py` (4 repos, ~20 methods + 6 helpers) | High |
| **F** | Mapper | `mapper.py` (2 mapper functions) | Low |
| **G1** | Service — Reads | `service.py` methods 1-7 (get, list, check availability, specialization reads, profile) | Medium |
| **G2** | Service — Writes | `service.py` methods 8-19 (create, update, status, toggles, specialization assign, schedule CRUD) | High |
| **H** | Dependencies | `dependencies.py` (doctor_owner_or_admin + factory functions) | Low |
| **I1** | Router — Profile | `router.py` endpoints 1-11 (doctor CRUD, status toggles, profile) | High |
| **I2** | Router — Specialization & Schedule | `router.py` endpoints 12-20 (specialization + schedule endpoints) | Medium |
| **J** | Registration | `main.py` router registration, `exception_handlers.py` DoctorException registration | Low |
| **T1** | Tests — Unit | `test_models.py`, `test_validators.py`, `test_repository.py`, `test_mapper.py`, `test_service.py` | High |
| **T2** | Tests — Integration | `test_routers.py`, `test_integration.py`, regression tests | High |
| **M** | Performance Review | Performance checklist: query analysis, N+1 audit, index verification, pagination benchmarking | Low |
| **N** | Security Review | Security checklist: RBAC audit, ownership verification, input validation, mass assignment check | Low |
| **O** | API Documentation Review | API docs checklist: OpenAPI tags, response models, error schemas, endpoint descriptions | Low |
| **K** | Production Audit | Phase 17 checklist | Medium |
| **L** | Final Refactoring | Code review findings, cleanup | Medium |
| **P** | Definition of Done | DoD checklist: all criteria below verified and signed off | Low |

---

## Deliverable 16 — Cross-Module Integration Checklist

### Pre-Coding Assumptions (Verified Against Actual Codebase)

| # | Assumption | Verification |
|---|---|---|
| A1 | GenderEnum exists in `app/core/constants.py` | **VERIFIED** |
| A2 | DOCTOR_ROLES constant exists | **VERIFIED** |
| A3 | `require_roles()` exists in `app/modules/rbac/permissions.py` | **VERIFIED** |
| A4 | `get_current_user` exists in `app/dependencies/auth.py` | **VERIFIED** |
| A5 | `get_db` exists in `app/database/session.py` | **VERIFIED** |
| A6 | User model exists with id, full_name, email, is_active, role_id | **VERIFIED** |
| A7 | Role model exists with name column | **VERIFIED** |
| A8 | users.id is integer PK | **VERIFIED** |
| A9 | Base exists in `app/database/base.py` | **VERIFIED** |
| A10 | uuid-ossp extension on PostgreSQL | **ASSUMED** (verify before migration) |
| A11 | Alembic configured with --autogenerate | **VERIFIED** (env.py has target_metadata) |
| A12 | Test DB configured | **VERIFIED** (backend/tests/conftest.py exists) |
| A13 | Alembic/env.py must import Doctor models before migration generation | **Task added to Phase B** |

### Integration Points
- IP1: Doctor.user_id FK → User.id (ON DELETE RESTRICT)
- IP2: Doctor.created_by FK → User.id (ON DELETE SET NULL)
- IP3: Doctor.updated_by FK → User.id (ON DELETE SET NULL)
- IP4: `require_roles()` protects all endpoints
- IP5: `get_current_user` rejects inactive users (401)
- IP6: Appointments query availability via `GET /doctors/{id}/availability`
- IP7: Patient Records resolve doctor info through User → DoctorProfile
- IP8: User deactivation does NOT cascade to DoctorProfile
- IP9: Doctor deactivation does NOT cascade to User

### Module Registration Requirements
- **Backend:** `app/main.py` must import `doctors_router` and `specializations_router`
- **Alembic:** `alembic/env.py` must import Doctor models for autogenerate detection
- **Exceptions:** `app/core/exception_handlers.py` must import and register `DoctorException`

---

## Deliverable 17 — Risk Register

| # | Risk | Category | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Alembic wrong migration | Migration | High | Manual review of every migration before apply |
| R2 | N+1 queries without selectinload | Performance | High | selectinload() in get_by_id() |
| R3 | doctor_owner_or_admin ordering bug | RBAC | Critical | Test with all roles explicitly |
| R4 | Transaction partial commit | Transaction | Medium | try/except with commit/rollback on all writes |
| R5 | Doctor code race condition | Concurrency | Medium | DB UNIQUE constraint as fallback |
| R6 | Mapper lazy load | Performance | Medium | selectinload(Doctor.user) in get_by_id() |
| R7 | Overlap edge case | Logic | Medium | Test all time range combinations |
| R8 | Missing service methods (create_specialization, get_doctor_specializations, etc.) | Completeness | High | **Mitigated** — all 19 methods now explicitly listed |
| R9 | Schema dependency order (DoctorSpecializationResponse after DoctorResponse) | Build | High | **Mitigated** — dependency chain fixed in Deliverable 5 |
| R10 | DB/Pydantic constraint mismatch | Validation | Low | Defense-in-depth, documented |
| R11 | Seed idempotency | Migration | Low | INSERT ON CONFLICT DO NOTHING |
| R12 | Test DB schema drift | Testing | High | alembic upgrade head in conftest fixture |
| R13 | Missed exception handler registration in app/core/exception_handlers.py | Ops | Medium | **Mitigated** — explicit task in Phase J |

---

## Deliverable 18 — Final Implementation Timeline

---

## Deliverable 19 — Final Quality Checklists

| Day | Phase(s) | Deliverables |
|-----|----------|-------------|
| 1 | A + B | Foundation (4 models) + Migration (4 files) + Seed (8 specializations) |
| 2 | C + D | Schemas (15+ schemas with inline validators) + Business Validators (5 functions) |
| 3 | E | Repository (4 repos, ~20 methods, 6 query helpers) |
| 4 | F + G1 | Mapper (2 functions) + Read Service (7 methods) |
| 5-6 | G2 | Write Service (12 methods with transaction management) |
| 7 | H + I1 | Dependencies (doctor_owner_or_admin) + Profile Router (11 endpoints) |
| 8 | I2 + J | Schedule Router (9 endpoints) + App Registration (main.py, env.py, handlers) |
| 9-11 | T1 + T2 | All Tests (unit + integration + API + regression) |
| 12 | M + N + O | Performance Review + Security Review + API Documentation Review |
| 13 | K + L + P | Production Audit + Final Refactoring + Definition of Done sign-off + Merge |

**Total: 13 working days (~2.5 weeks) for a single developer.**

---

## Final Quality Checklists

Before the module is considered complete, each of the following checklists must be verified and signed off. These checklists are applied sequentially after all tests pass (Phase T1/T2) and before Production Audit (Phase K).

---

### Definition of Done (DoD)

All items below must be **verified and checked** before the module can be merged to `develop`.

| # | Criterion | Verification Method |
|---|---|---|
| DoD-1 | All 20 endpoints implemented and return correct responses | Integration tests pass |
| DoD-2 | All 19 service methods implemented with transaction boundaries | Service tests pass |
| DoD-3 | All 4 repositories with all CRUD + query methods working | Repository tests pass |
| DoD-4 | All 4 Alembic migrations apply and roll back cleanly | `alembic upgrade head` + `downgrade -1` at each step |
| DoD-5 | All 8 specializations seeded | DB query returns 8 rows |
| DoD-6 | All BR rules (BR-001 through BR-307) enforced | Service + integration tests cover all rules |
| DoD-7 | All INV rules (INV-1 through INV-13) enforced | Validation + service tests cover all invariants |
| DoD-8 | All endpoints protected by RBAC (`require_roles`) | Router tests with each role |
| DoD-9 | `doctor_owner_or_admin` correctly restricts self-service endpoints | Auth tests with owner + non-owner + admin |
| DoD-10 | `extra="forbid"` on all request schemas | Schema validation tests |
| DoD-11 | Audit fields (`created_by`, `updated_by`, `created_at`, `updated_at`) populated on all mutations | DB verification |
| DoD-12 | Test coverage >= 90% overall | `pytest --cov` |
| DoD-13 | All linting checks pass | linter run |
| DoD-14 | All type checks pass | mypy / pyright run |
| DoD-15 | No hardcoded secrets, credentials, or tokens | Code review |
| DoD-16 | Feature branch up to date with `develop` and no merge conflicts | `git merge develop` |

---

### Performance Review Checklist

| # | Check | Method |
|---|---|---|
| PR-1 | All queries use `selectinload()` for relationship loading — no N+1 | Code review of all `get_by_id()` and `list()` calls |
| PR-2 | Doctor search uses composite indexes (User.full_name + Doctor.doctor_code ILIKE) | Explain plan for typical search query |
| PR-3 | Doctor list pagination uses `LIMIT`/`OFFSET` with count subquery | Repository `list()` method review |
| PR-4 | Schedule overlap query uses `(doctor_id, day_of_week)` composite index | `has_overlap()` method + index `ix_schedule_doctor_day` |
| PR-5 | Specialization filter uses `DoctorSpecialization.specialization_id` index | Index `ix_ds_specialization` |
| PR-6 | Page size capped at 100 items | Router `Query(le=100)` |
| PR-7 | No loading of unused relationships in list queries | `get_by_id()` uses selectinload; `list()` does NOT |
| PR-8 | Doctor code generation avoids race condition (DB UNIQUE constraint as fallback) | `get_next_doctor_code_sequence()` + DB constraint |
| PR-9 | Profile photo URL stored, not fetched (no file handling in MVP) | Schema review — string field only |
| PR-10 | JSONB `languages_known` does not require index (display-only in MVP) | Query analysis — no filter on languages |

---

### Security Review Checklist

| # | Check | Method |
|---|---|---|
| SR-1 | Authentication required on ALL endpoints | Every endpoint has `Depends(get_current_user)` or `Depends(require_roles(...))` |
| SR-2 | RBAC enforced per operation — no endpoint accessible without role check | Test each endpoint with every role |
| SR-3 | `doctor_owner_or_admin` correctly gates self-service endpoints | Verify: admin bypasses; non-owner doctor gets 403 |
| SR-4 | `extra="forbid"` on all Pydantic request schemas — unknown fields rejected | Integration tests with extra fields → 422 |
| SR-5 | `ConfigDict(from_attributes=True)` on response schemas only (not request) | Code review of schema definitions |
| SR-6 | SQL injection prevention — no raw SQL, all queries via SQLAlchemy ORM | Code review of repository methods |
| SR-7 | UUID primary keys for DoctorProfile and DoctorSchedule (non-sequential) | Model review — `UUID(as_uuid=True)` |
| SR-8 | Error messages do not leak internal details (generic 401/403 messages) | Integration tests — verify error response bodies |
| SR-9 | Audit trail: `created_by`/`updated_by` set on every mutation | Service layer — every write sets audit fields |
| SR-10 | Mass assignment protection: only provided fields updated in PATCH | `model_dump(exclude_unset=True)` in service |
| SR-11 | Auth failures logged at WARNING with user ID, role, path | Logging configuration review |
| SR-12 | Inactive user accounts rejected even with valid JWT | `get_current_user` checks `user.is_active` |
| SR-13 | Doctor code format validation — server-generated, not client-provided | Service — `f"DOC-{seq:06d}"` generation |
| SR-14 | Schedule day_of_week CHECK constraint at DB level (0-5) | Migration review — `ck_schedule_day_of_week` |
| SR-15 | Consultation fee and duration CHECK constraints at DB level | Migration review — `ck_doctors_fee_positive`, `ck_doctors_duration_positive` |

---

### API Documentation Review Checklist

| # | Check | Method |
|---|---|---|
| AD-1 | All endpoints registered in FastAPI and visible in `/docs` (Swagger UI) | Start server → navigate to `/docs` |
| AD-2 | Correct OpenAPI tags on each router (`"Doctors"`, `"Specializations"`) | `tags=["Doctors"]` and `tags=["Specializations"]` |
| AD-3 | All endpoints have `summary` and `description` docstrings | Code review of router decorators |
| AD-4 | All endpoints have `response_description` | Code review of router decorators |
| AD-5 | Request schemas show required vs optional fields clearly | Check `/docs` — required fields marked with `*` |
| AD-6 | Response schemas include all response fields with examples | `examples=` in Pydantic Field definitions |
| AD-7 | Error response schema documented: `{success: bool, message: str, details: object}` | Consistent with existing DensCare pattern |
| AD-8 | All HTTP status codes documented per endpoint: 201, 200, 401, 403, 404, 409, 422, 500 | Code review of responses and error mapping |
| AD-9 | Specialization endpoints grouped under separate tag from Doctor endpoints | `specializations_router` with separate tag |
| AD-10 | Pagination query parameters documented (page, page_size, default, max) | `Query(ge=1, le=100)` with descriptions |
| AD-11 | Search/filter query parameters documented with examples | `Query(description=...)` on each filter param |
| AD-12 | Auth requirement documented: `Bearer <token>` header | OpenAPI security scheme configuration |
| AD-13 | Schemas reference Phase 6 API Design document for field-level documentation | Cross-reference with design docs |

---

## Ready to Start Coding

### Pre-Flight Checklist

| # | Prerequisite | Status |
|---|---|---|
| 1 | All 19 deliverables internally consistent | **PASS** |
| 2 | Schema dependency order fixed (DoctorSpecializationResponse before DoctorResponse) | **Fixed** |
| 3 | Service methods complete (19 methods, including 3 newly added) | **Fixed** |
| 4 | Read-before-write ordering in service layer | **Fixed** |
| 5 | Seed data moved to after migration 001 | **Fixed** |
| 6 | Test-per-phase strategy adopted for unit tests | **Fixed** |
| 7 | Git commits refined (15 commits, independently working) | **Fixed** |
| 8 | Phase G split into G1 + G2 | **Fixed** |
| 9 | Phase I split into I1 + I2 | **Fixed** |
| 10 | env.py import task, exception handler registration, main.py registration all added | **Fixed** |
| 11 | Duplicate Risk Register removed, numbering fixed | **Fixed** |
| 12 | Repository helper methods added (_build_base_query, _apply_filters, etc.) | **Fixed** |
| 13 | Cross-module integration assumptions verified against actual codebase | **Verified** |
| 14 | Checkpoints now include git commit + manual verification steps | **Fixed** |

### First Command
```bash
mkdir -p backend/app/modules/doctors/tests
```

---

*This roadmap serves as the single source of truth for the coding phase. Follow it sequentially — do not skip phases.*
