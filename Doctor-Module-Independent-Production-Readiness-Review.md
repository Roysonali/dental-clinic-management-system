# DensCare — Doctor Module: Independent Production Readiness Review

> **Document:** `Doctor-Module-Independent-Production-Readiness-Review.md`
> **Verdict:** **C — Not Ready (bounded frontend integration gap)**
> **Date:** 2026-09-01
> **Method:** Independent, read-only, code-only audit. No fixes, refactors, or remediation performed. All claims verified against live code and fresh test runs — no findings sourced from prior reports without re-verification.
> **Audit basis:** `backend/app/modules/doctors/**` (module), integration surfaces in `backend/app/modules/appointments/**` and `backend/app/modules/treatment/**`, and `frontend/src/**` (doctor pages, components, hooks, services, types, constants, utils, routes).

---

# Verdict Summary

| Dimension | Grade | Rationale (verified) |
|---|---|---|
| **Backend (doctor module)** | **A — Production Ready** | Complete CRUD + atomic weekly replace + ownership/overlap validation + DB-level constraints + FK RESTRICT + indexes + centralized clinic-default constants. 244/245 module tests pass; the single failure is a **test/spec contradiction**, not a production defect. |
| **Frontend (doctor module)** | **C — Not Ready** | Code quality is high (198/198 doctor tests pass, lint clean, tsc clean, build succeeds) BUT the **core Schedule management UI is completely unreachable** — the editor/revert components and replace mutation exist and are tested yet are never mounted into the page. |
| **Cross-module integration** | **B — Ready w/ Minor Improvements** | Doctor↔Appointment (by `user_id`→`dentist_id`) and Doctor↔TreatmentPlan (by `doctor_id` UUID) wiring is correct; a genuine schema asymmetry is handled correctly on both sides but is a maintenance footgun. |
| **Overall** | **C — Not Ready** | The backend could ship today; the frontend cannot deliver a core advertised feature (schedule management) because of an unwired UI path. Scope is small and bounded — **not** architectural rework, but release is blocked until wiring is completed and the test/spec contradiction is reconciled. |

**Overall readiness score: 6.2 / 10** — a strong, well-architected backend carrying a frontend whose flagship editing flow was never connected.

**Overall optimization score: 7.1 / 10** — clean layering, no N+1 on hot paths, centralized constants; losses are a non-sargable search, a hardcoded schedule literal, a large main bundle, and dead-but-present schedule UI code.

> **Why not A or B?** Verdicts A/B require the module's advertised capabilities to be usable. An administrator *cannot* create, edit, delete, or revert a doctor's schedule from the UI — the entire scheduling feature is dead code in the product even though the backend fully supports it. Verdict **C** (Not Ready) reflects this. Verdict **D** (Architectural Rework) is explicitly rejected: the gap is a wiring defect of bounded scope (one container render call), not a defect in the architecture.

---

# Table of Contents

1. Scope, Method, and Evidence
2. Architecture and Layering
3. Backend Module Review
4. Frontend Module Review
5. Cross-Module Integration
6. Scheduling Semantics Verification
7. Data Model and Referential Integrity
8. RBAC and Authorization
9. API Contract and Type Parity
10. Quality Gates (executed)
11. Testing and Coverage
12. Performance and Scalability
13. Security Review
14. Concurrency and Transactions
15. Error Handling and Observability
16. Dead Code and Completeness
17. Findings Table
18. Severity Model
19. Fifteen Sub-Scores
20. Ten Manual Journeys
21. Conclusion and Recommendation

---

# Part A — Context and Method

## 1. Statement of Work and Independence

This is an independent, production-readiness evaluation of the DensCare **Doctor module** (backend `app/modules/doctors/**` and the frontend doctor surface). The audit:

- **Reviewed code only.** No application was started, no database was seeded, and no UI was exercised in a browser (no browser available in this environment — see §97 manual journeys, marked N/A rather than fabricated).
- **Verified every material claim in code and via fresh test execution.** Prior reports in `docs/` were consulted only to identify review targets and to confirm/contradict — findings were re-established from source, not inherited.
- **Applied a backend-contract-first lens.** The authoritative behavior is defined by the backend; the frontend is graded on fidelity to that contract.

## 2. Evidence Inventory (files read)

**Backend module:** `models.py`, `schemas.py`, `constants.py`, `enums.py`, `exceptions.py`, `dependencies.py`, `mapper.py`, `routes.py`, `services/doctor_service.py`, `services/schedule_service.py`, `services/specialization_service.py`, `repositories/doctor_repository.py`, `repositories/doctor_schedule_repository.py`, `repositories/doctor_specialization_repository.py`, `repositories/specialization_repository.py`, `validators/doctor_validator.py`, `validators/schedule_validator.py`, `validators/specialization_validator.py`, `validators/_protocols.py`, migration `backend/alembic/versions/14b364e7b2e5_create_doctor_management_tables.py`.

**Integration surfaces:** `backend/app/core/constants.py`, `backend/app/modules/appointments/{model,service,repository,validators,router,schema}.py`, `backend/app/modules/treatment/{models,repositories/treatment_plan_repository,routers/treatment_plan_router,schemas/treatment_plan,services/treatment_plan_service}.py`, `backend/app/modules/rbac/permissions.py`.

**Frontend:** `src/pages/doctors/**`, `src/components/doctors/**` (including `containers/`, `mobile/`, `DoctorSchedule*`, `DoctorForm*`, `DoctorAppointmentList`, `DoctorTreatmentPlanList`), `src/hooks/doctors/{useDoctor,useDoctorProfile,useDoctors,useDoctorMutations,useSpecializations}.ts`, `src/services/doctorService.ts`, `src/types/doctor.ts`, `src/constants/doctor.ts`, `src/utils/doctorFormSchema.ts`, `src/routes/AppRouter.tsx`, `src/routes/routeRequirements.ts`, `src/constants/roles.ts`.

**Tests read:** backend `tests/modules/doctors/{conftest,test_edge_cases,test_repositories,test_routers,test_services,test_validators}.py`; frontend `DoctorForm.test.tsx`, `DoctorScheduleEditor.test.tsx`, `DoctorScheduleRevertDialog.test.tsx`, `DoctorScheduleSection.test.tsx`, `useDoctorMutations.test.tsx`, `DoctorDetailsContainer.test.tsx`.

## 3. Test Runs Executed (fresh)

| Gate | Result | Notes |
|---|---|---|
| Backend `pytest tests/modules/doctors` | **244 passed, 1 failed** | Failure = `test_replace_duplicate_days` expects 400; implementation returns 200. Determined to be a **test/spec contradiction** against the documented multi-session design (see §14, Finding F-1). |
| Backend `pytest tests/modules/treatment` | Passing (not re-counted here; spot-verified by-doctor path) | See §56 treatment integration. |
| Backend `pytest tests/modules/appointments` | Passing (schedule-aware validation) | See §55. |
| Frontend `vitest run` (full suite) | **223 files passed, 8 files failed; 1782/1795 tests passed, 13 failed** | ALL 13 failures are in **billing / patientRecords** and share one root cause: PatientPicker placeholder mismatch (`"Search patient by name or code…"` expected vs `"Search patient by name or phone…"` rendered). **Zero doctor-module failures.** |
| Frontend doctor-only `vitest run src/components/doctors src/hooks/doctors` | **21 files / 198 tests passed** | Doctor module fully green, including the previously-flagged `DoctorForm.test.tsx` (passed again — no flake observed this run). |
| Frontend `npm run lint` | **FAILS — 4 errors, 1 warning** | All in non-doctor files: `patientRecords/PatientRecordListContainer.tsx`, `treatmentPlans/TreatmentPlanListContainer.tsx` (React `set-state-in-effect`), `hooks/appointments/useAppointments.test.tsx` (`no-explicit-any`), `services/api.ts` (unused `refreshError`). |
| Frontend doctor-only ESLint | **0 problems** | `src/components/doctors`, `src/hooks/doctors`, `src/services/doctorService.ts`, `src/types/doctor.ts`, `src/constants/doctor.ts`, `src/utils/doctorFormSchema.ts`. |
| Frontend `tsc -b` | **PASS** (exit 0) | |
| Frontend `vite build` | **PASS** (exit 0) | Non-fatal warning: main bundle `index` 638 kB (gzip 166 kB) > 500 kB threshold. |

---

# Part B — Architecture

## 4. Module Inventory (doctor module)

**Backend** (`backend/app/modules/doctors/`, 20 source files):

| Layer | Files | Responsibilities |
|---|---|---|
| Models | `models.py` | `Doctor`, `Specialization`, `DoctorSpecialization`, `DoctorSchedule` (see §40). |
| Schemas | `schemas.py` | Pydantic request/response models incl. `DoctorValidators` mixin; phone/registration normalization. |
| Constants | `constants.py` | `MAX_SCHEDULE_ENTRIES_PER_DOCTOR = 14`, `DEFAULT_CONSULTATION_DURATION = 30`, message constants, allowed sort fields. |
| Enums / Exceptions | `enums.py`, `exceptions.py` | Typed domain exceptions with `code/message/details`. |
| Dependencies | `dependencies.py` | `require_doctor_self_or_full_read`, `require_user_self_or_full_read`. |
| Mapper | `mapper.py` | ORM→response schema mapping (`DoctorMapper`). |
| Routes | `routes.py` | Thin routers: doctor CRUD/status/specialization/profile + schedule router + specialization router. |
| Services | `services/{doctor,schedule,specialization}_service.py` | Orchestration; **own commit/rollback**. |
| Repositories | `repositories/*` | Data access; flush/refresh only, never commit. Include `get_schedule_by_id_for_update`/`get_schedules_for_update` (`FOR UPDATE`), `get_doctor_schedule`, `_build_search_filter`. |
| Validators | `validators/*` | Pure/stateless business rules; repos passed in explicitly. |

**Frontend** (`frontend/src/**`):

| Area | Files | Notes |
|---|---|---|
| Pages | `pages/doctors/DoctorListPage.tsx`, `DoctorDetailsPage.tsx` | Thin wrappers → containers. |
| Containers | `components/doctors/containers/DoctorListContainer.tsx`, `DoctorDetailsContainer.tsx`, `DoctorFormContainer.tsx` | Own data fetch, dialogs, tabs. |
| Views | `DoctorTable`, `DoctorToolbar`, `MobileDoctorList`, `DoctorHeader`, `DoctorProfileCard`, `DoctorClinicalCard`, `DoctorEmergencyCard`, `DoctorSpecializationsSection`, `DoctorScheduleSection`, `DoctorAppointmentList`, `DoctorTreatmentPlanList`, `DoctorStatusDialog`, `DoctorToggleDialog` | see §15. |
| **Schedule editing** | `DoctorScheduleEditor.tsx`, `DoctorScheduleRevertDialog.tsx` | **Present + unit-tested but NOT mounted (F-0).** |
| Hooks | `hooks/doctors/{useDoctor,useDoctorProfile,useDoctors,useDoctorMutations,useSpecializations}.ts` | TanStack Query; `doctorQueryKeys` factory. |
| Services | `services/doctorService.ts`, `appointmentService.ts`, `treatmentPlanService.ts` | Fee `Decimal→number` normalization; list/`by-doctor` treatment path. |
| Types / Constants / Utils | `types/doctor.ts`, `constants/doctor.ts`, `utils/doctorFormSchema.ts` | Mirrors backend (see §58, §59). |
| Routing | `routes/AppRouter.tsx`, `routes/routeRequirements.ts` | Route-level lazy split; RBAC route requirements. |

## 5. Dependency / Layering Verification

Verified (read, not assumed):

- **Backend:** `router → dependency (authz) → service (business logic + commit) → validator (pure rules) / repository (flush/refresh) → mapper → response`. Services are the only layer that commits; repositories only flush/refresh — this invariant is documented inside `schedule_service.py` and `doctor_repository.py` and holds in the code. Validators are `@staticmethod` collections with no state and no side effects; data-accessing rules accept a repository as an explicit parameter (see `validators/_protocols.py`).
- **Frontend:** `page → container → hook → service → axios`. Mutation hooks invalidate the `['doctors']` query-key prefix on success (`useReplaceWeekSchedule` invalidates prefix — good for cache coherence).
- **No circular dependency** between doctor ↔ appointment ↔ treatment modules: appointment validates *against* doctor schedule data; treatment plans reference doctor UUID. Doctor does not import appointment/treatment types.

**Assessment:** layering is textbook-clean on both stacks. This is an A-grade architecture. The failure is not architectural (rejecting Verdict D) — see Finding F-0.

---

# Part C — Backend Module Review

## 6. Doctor CRUD (create / read / update / delete / status)

**Create** (`POST /doctors`, `require_admin`): service consumes `DoctorCreate`, delegates uniqueness + eligibility + normalization to validators, generates a sequential `doctor_code` (`DOC-####`), and requires an existing active user with a DOCTOR-family role. DB `UNIQUE` on `doctor_code`, `user_id`, `registration_number` back this up.

**List** (`GET /doctors`, roles `[ADMIN, RECEPTIONIST]`): paginated (`page`, `page_size` 1–100), filtered (`search` on doctor code or user full name only; `specialization_id`, `is_active`, `is_available`), sort (`full_name` | `years_of_experience`). Returned items are **full `DoctorResponse` records** (the frontend types confirm this — an intentional, if slightly heavy, contract).

**Get** (`GET /doctors/{id}`, `require_doctor_self_or_full_read`) and **Get by user** (`GET /doctors/user/{user_id}`, `require_user_self_or_full_read`): both full `DoctorResponse`.

**Update** (`PATCH /doctors/{id}`, `require_admin`): partial via `DoctorUpdate` (no `user_id`); re-validates uniqueness for changed `registration_number` (excluding self — `registration_number_exists(..., exclude_doctor_id)`).

**Delete** (`DELETE /doctors/{id}`, `require_admin`): **hard delete.** Referenced rows block it: `Doctor.user_id → users.id` is `RESTRICT`; `TreatmentPlan.doctor_id → doctors.id` is `RESTRICT`. Was it actually talent for appointments? **Caution/appointments** reference `dentist_id → users.id (RESTRICT)`, not doctors directly, so deleting a doctor whose linked *user* still has appointments is blocked at the `users` level; but the doctor row can be removed while historical appointments remain attributed to the now-unlinked user id. See §55 for the cross-module implication (Finding F-6).

**Enable/disable/leave/availability:** `PATCH /doctors/{id}/activate|deactivate|leave|availability` — all idempotent, `require_admin`, enforcement in service/validators (e.g., an *inactive* doctor cannot be marked available).

**Evidence of over-engineering?** No — each operation maps to a documented business rule; no redundant routes.

## 7. Specialization Master Data

Full CRUD on `GET/POST/PATCH/DELETE /specializations` (admin for writes, `[ADMIN, RECEPTIONIST, *DOCTOR_ROLES]` for reads). Deletion is blocked when a specialization is still assigned to a doctor. Doctor↔specialization assignment via `POST/DELETE /doctors/{id}/specializations[/{sid}]`; a partial unique index `uq_doctor_primary_specialization` enforces **at most one primary** per doctor at the DB level.

Verified: the `DoctorSpecialization` model defines exactly one FK-pair primary key, `is_primary` flag, `certification_date`, and the three indexes (specialization, composite, partial-unique primary). Robust.

## 8. Schedule Service Semantics (this is the heart of the module)

All verified against `schedule_service.py` + `schedule_validator.py` + `schedule_repository.py`:

- **List** `GET /doctors/{id}/schedules` — ordered by `day_of_week`; requires an *active* doctor.
- **Create** `POST /doctors/{id}/schedules` (admin) — asserts active doctor, time ordering (`end > start`), and **no overlapping sessions** on the same day. **Multiple non-overlapping sessions per day are explicitly allowed** (split shifts) — this is documented in the validator and confirmed by a passing unit test.
- **Update** `PATCH /doctors/{id}/schedules/{sid}` (admin) — partial; re-checks ordering + overlap excluding the row being edited; cross-doctor access rejected; uses `WITH FOR UPDATE` (`get_schedule_by_id_for_update`) for safe concurrent edits.
- **Delete** `DELETE /doctors/{id}/schedules/{sid}` (admin) — ownership-checked, lock, delete.
- **Replace week** `PUT /doctors/{id}/schedules` (admin) — **atomic**: validates entry count ≤ 14 and the whole list (time ordering + same-day overlap) *before* locking existing rows (`get_schedules_for_update`), deleting all, and re-creating. Any failure rolls back the whole transaction. **Empty list ⇒ valid → deletes all rows ⇒ doctor reverts to clinic default** (correct revert contract).
- **Max 14 entries; day_of_week 0–5** (Monday–Saturday) enforced both by validator and by DB `CheckConstraint("day_of_week >= 0 AND day_of_week <= 5")`. **Sunday is unsupported** by both layers — consistent with the frontend `DayOfWeek = 0|1|2|3|4|5`.

**Design note (Verified):** `validate_replace_list` deliberately does **not** reject two non-overlapping sessions on the same day — multi-session split shifts are a supported feature. The route docstring for `PUT /schedules` nonetheless says it validates "duplicate days," which is misleading; and the router test `test_replace_duplicate_days` asserts a 400 for exactly the documented-legal split-shift case. **This is the lone failing backend test and it tests the wrong expectation** (Finding F-1).

## 9. Transaction Ownership and Rollback

`ScheduleService._run_in_transaction` (and analogous service patterns) wraps each state change: `commit()` on success; explicit `rollback()` and re-raise for known domain exceptions; `rollback()` + typed wrap for `IntegrityError`; `rollback()` + log for unexpected exceptions. Verified the service owns commit and repositories never do. This is correct and consistent.

## 10. Concurrency

- Schedule edit/delete/replace use `SELECT ... FOR UPDATE` row locks (`get_schedule_by_id_for_update`, `get_schedules_for_update`) — protects against concurrent overwrites of the same doctor's schedule. Good.
- Doctor code generation is sequential-read-then-insert; without a dedicated sequence or `UNIQUE` retry this could race under heavy concurrent doctor creation — a low-severity note (Finding F-7), mitigated by the `UNIQUE` constraint which would surface an `IntegrityError` rather than silent duplication.

## 11. Validators (purity, correctness)

`DoctorValidator`, `ScheduleValidator`, `SpecializationValidator` are static-method collections; all raise typed `DoctorException` subclasses; none returns `False`/`None`. Data-accessing checks receive a repository as a parameter, keeping the layer framework-free and unit-testable without a DB. Verified overlap detection algorithm (`s1_start < s2_end and s2_start < s1_end`) is correct for open intervals. Registration-number/phone normalization is centralized in `schemas.py` and mirrored in `doctorFormSchema.ts` (Zod). Strong.

## 12. Mapper Consistency

`DoctorMapper` maps ORM → `DoctorResponse` / `DoctorProfileResponse` / `DoctorSpecializationResponse`. The frontend `DoctorResponse`/`DoctorProfileResponse` interfaces mirror these field-for-field (verified against `types/doctor.ts`). The profile payload (`DoctorProfileResponse = DoctorResponse + schedules`) is a strict superset of the list payload, so the frontend can reuse one type safely. The frontend `DoctorResponse` correctly omits a top-level `schedules` field (kept only in `DoctorProfileResponse`). Good.

---

# Part D — Frontend Module Review

## 13. Pages and Routing

`AppRouter.tsx` routes `DoctorListPage` and `DoctorDetailsPage` with route-level `React.lazy` splitting. `routeRequirements.ts` guards routes by role. Verified the doctor routes exist and are wired into the app shell. Route-level code splitting is correct, though the overall `index` bundle is large (Finding F-8).

## 14. CRITICAL — Schedule Editing UI is Unreachable (F-0)

This is the central finding.

- `DoctorScheduleEditor.tsx` and `DoctorScheduleRevertDialog.tsx` are fully implemented, self-contained, and unit-tested (`DoctorScheduleEditor.test.tsx` 15+ cases, `DoctorScheduleRevertDialog.test.tsx` 9 cases, plus `useDoctorMutations.test.tsx` covering `useReplaceWeekSchedule`).
- `DoctorScheduleSection` accepts `isAdmin?` and `onEditSchedule?` props and renders an **Edit / Create Custom Schedule** button **only when both are provided** (lines 65–69).
- `DoctorDetailsContainer.tsx:184` renders `<DoctorScheduleSection doctor={doctor} />` — **without** `isAdmin` or `onEditSchedule`.
- A codebase-wide grep confirms `DoctorScheduleEditor`, `DoctorScheduleRevertDialog`, and `useReplaceWeekSchedule` are referenced **only inside their own test files** — never imported by a page, container, or route.

**Consequence:** From the shipped UI an administrator cannot create, edit, delete, or revert a doctor’s weekly schedule. Every doctor silently falls back to the clinic default (Mon–Sat, 10–13 + 17–21). The backend is ready (full CRUD + atomic replace) and the frontend components are ready, but the **wiring is absent** — this is a dead feature path, not a missing feature. This is the single reason the module earns Verdict C. The fix is bounded (mount the editor/dialog in `DoctorDetailsContainer` and pass `isAdmin`/`onEditSchedule`), which is why D (architectural rework) is rejected.

> Corroboration: the prior `docs/Doctor-Schedule-Frontend-Backend-Contract-Review.md` identified the frontend as read-only; this audit confirms that status **persists** even though the editing components were since added — they were added but never connected. Independent verification: the grep evidence above.

## 15. Other Frontend Capability

- **Doctor list**: comprehensive — search (backend-filtered), status/availability/specialization filters, sort, pagination, stats, create/edit dialogs, status/toggle dialogs, mobile layout. Fully functional and tested.
- **Overview (details)**: `DoctorProfileCard`, `DoctorClinicalCard`, `DoctorEmergencyCard`, `DoctorSpecializationsSection` (read-only), `DoctorScheduleSection` (read-only display). All render from `GET /doctors/{id}/profile`.
- **Appointments tab** (`DoctorAppointmentList`): calls `GET /appointments?dentist_id={doctor.user_id}` with server-side status filter + pagination; read-only. Correct use of `user_id` (see §53).
- **Treatment Plans tab** (`DoctorTreatmentPlanList`): calls `GET /treatment-plans/by-doctor/{doctor.id}` (server-filtered, paginated); read-only. Correct use of `doctor.id` (see §53).
- **Billing tab**: **intentionally removed** (documented in `DoctorDetailsContainer` header comment: `Invoice.doctor_id` is nullable and inconsistently populated, so revenue attribution is unreliable). This is a deliberate architectural decision, not an omission — not a defect (corroborated as a design note).

## 16. Hooks and Cache Coherence

`useDoctor`, `useDoctorProfile`, `useDoctors`, `useDoctorMutations`, `useSpecializations` wrap TanStack Query. `doctorQueryKeys` provides list/detail/profile/schedules keys. `useReplaceWeekSchedule` invalidates the `['doctors']` prefix (and is otherwise unused — dead in production due to F-0). Cache invalidation strategy is sound; when wiring is completed, mutations will correctly refresh list + detail + profile.

## 17. Form Validation Mirror (Zod ↔ Backend)

`doctorFormSchema.ts` mirrors backend normalization and bounds: phone pattern `^\+?[1-9]\d{9,14}$` (note: deliberately different from the patient pattern), registration `^[A-Z0-9-]+$`, fee `> 0` / ≤ 10 digits / 2 decimals, duration 15–240, experience 0–50, length caps (address/qualification 500, biography 2000, emergency name 100, phone 20). Verified parity with `schemas.py` / `doctor_validator.py`. Two independent implementations of the same rules can drift, but currently they agree (Finding F-9 — low risk, mitigated by the shared constants file + comments).

---

# Part E — Cross-Module Integration (contract-first)

## 18. The Two-ID Asymmetry (Verified, F-6)

- **Appointment** `dentist_id INTEGER → users.id` (`ondelete=RESTRICT`). A doctor’s appointments are therefore keyed by **`User.id`** (the integer user PK), obtained via `doctor.user_id`.
- **TreatmentPlan** `doctor_id UUID → doctors.id` (`ondelete=RESTRICT`). A doctor’s plans are keyed by **`Doctor.id`** (the UUID PK).

The module itself does not store appointments (they live in the appointment table keyed by user), so listing a doctor’s appointments from the doctor details page must translate `doctor.user_id → dentist_id`, whereas treatment plans translate `doctor.id → doctor_id`. **Both the backend list filters and the two frontend list components handle this correctly** (`DoctorAppointmentList` uses `doctor.user_id`; `DoctorTreatmentPlanList` uses `doctor.id`; appointment repository filters `dentist_id`; treatment repository filters `doctor_id`).

**Assessment:** functionally correct and consistent today, but the asymmetry is a footgun: any future code that treats appointments as "belonging to doctors" (vs users) will produce wrong results or ORM ambiguity. This is inherent to the appointment schema (Reference finding F-6, low/medium — worth a documented invariant or a helper, not a redesign).

## 19. Appointment Availability / Working-Day Semantics (Verified)

The appointment module validates against the **same centralized clinic constants** (`CLINIC_WORKING_DAYS`, `CLINIC_MORNING_START/END`, `CLINIC_EVENING_START/END`) used by the schedule fallback. `validate_working_day` rejects weekends by `weekday() not in CLINIC_WORKING_DAYS` (Mon–Sat); `validate_working_hours` enforces the 10–13 / 17–21 default window; `validate_doctor_schedule` enforces the schedule-precedence hierarchy. This is the *backend-contract-first* behavior the audit was asked to verify, and it is correctly implemented and shared. The prior bug (appointment always showing "doctor not available") was fixed by the `1f35a11` commit and the shared-constant approach prevents drift.

## 20. Treatment by-doctor Contract (Verified)

`GET /treatment-plans/by-doctor/{doctor_id}` filters on `TreatmentPlan.doctor_id`, paginated/server-side; `count_by_doctor` supports per-doctor counts. Frontend `treatmentPlanService` has the `by-doctor` path and `DoctorTreatmentPlanList` calls it with `doctor.id`. Contract verified end-to-end.

---

# Part F — Data Model, RBAC, Types

## 21. Data Model and Referential Integrity (Verified)

`doctors` table (migration `14b364…`):
- `id UUID PK`, `doctor_code UNIQUE NOT NULL`, `user_id INTEGER FK→users.id UNIQUE NOT NULL (RESTRICT)`, `registration_number UNIQUE NULL`.
- Check constraints: `years_of_experience >= 0`, `consultation_fee > 0`, `consultation_duration 15–240`.
- Indexes: `ix_doctors_active_available(is_active, available_for_appointment)`, created_by/updated_by.
- `doctor_schedules`: FK→doctors.id `CASCADE`; `day_of_week 0..5` CheckConstraint; `end > start` CheckConstraint; indexes `ix_schedule_doctor_day(doctor_id, day_of_week)`, `ix_schedule_active(doctor_id, is_active)`.
- `doctor_specializations`: composite PK (doctor_id, specialization_id); `specialization_id→specializations.id RESTRICT`; `doctor_id→doctors.id CASCADE`; **partial unique** `uq_doctor_primary_specialization` (one primary/doctor); indexes `ix_ds_*`.
- `specializations`: `name UNIQUE`, `code UNIQUE`, `ix_specializations_active`.

Referential safety is strong: deleting a doctor that has treatment plans is blocked (RESTRICT); doctor deletion cascades its own schedule + specialization rows; deleting a user who owns a doctor profile is blocked (RESTRICT). See F-6 for the appointment angle (healthcare audit history preserved because appointments reference the user, which cannot be deleted while appointments exist).

## 22. RBAC Parity (Verified)

| Capability | Backend | Frontend gate | Match |
|---|---|---|---|
| Admin set | `_ADMIN_ROLES = {ADMIN, CHIEF_DOCTOR}` | `ADMIN_ROLES = [ADMIN, CHIEF_DOCTOR]` | ✅ |
| Doctor role set | `DOCTOR_ROLES = {CHIEF, GENERAL, SPECIALIST, CONSULTING}` | `DOCTOR_ROLES = [CHIEF, GENERAL, SPECIALIST, CONSULTING]` | ✅ |
| List doctors | `require_roles([ADMIN, RECEPTIONIST])` | route guard | ✅ |
| Edit/act/deact/leave/avail/schedule writes | `require_admin` | `ADMIN_ROLES` gate (details header); form/dialog wiring | ✅ |

Verified `frontend/src/constants/roles.ts` explicitly documents it mirrors `_ADMIN_ROLES` and forbids adding roles the backend doesn't treat as admin. `PermissionGate` + `routeRequirements` use these. Parity confirmed.

## 23. API Contract / Type Parity (Verified)

`types/doctor.ts`:

- `DayOfWeek = 0|1|2|3|4|5` ✅ (backend 0–5, no Sunday).
- `DoctorResponse` mirrors backend `DoctorResponse` (incl. `available_for_appointment`, `on_leave`, `is_active`, `specializations`, `user_full_name/email`).
- `DoctorProfileResponse = DoctorResponse + schedules` ✅ (matches `GET /doctors/{id}/profile`).
- `DoctorListResponse.items` is typed **`DoctorResponse[]`** (full records), matching the confirmed backend behavior — this is explicitly documented in the file, avoiding a classic summary-vs-full mismatch bug.
- `DoctorUserResponse` remains for the appointment name-resolution use of `GET /doctors/user/{user_id}`.
- Request shapes (`DoctorCreateRequest`, `DoctorUpdateRequest`, `ScheduleCreateRequest`, `ScheduleUpdateRequest`) mirror backend schemas.

`doctorService.ts` normalizes `consultation_fee` `Decimal→number` — expected because the backend serializes `Numeric(10,2)`; verified this is handled on read so the form/render gets a JS number. Good.

---

# Part G — Quality Gates, Testing, Performance, Security

## 24. Quality Gates — Result Summary (executed fresh, §3)

| Gate | Verdict | Doctor-scoped |
|---|---|---|
| Backend doctor pytest | 244/245 pass | 1 fail = test/spec contradiction (F-1) |
| Frontend doctor vitest | 198/198 pass | green |
| Frontend full vitest | 1782/1795 | 13 fails all non-doctor (billing/patientRecords) |
| ESLint (repo) | fails (4 err) | doctor dirs clean |
| TSC | pass | pass |
| Vite build | pass (bundle warn) | pass |

## 25. Backend Test Coverage (doctor module)

`tests/modules/doctors/` has `conftest`, `test_edge_cases`, `test_repositories`, `test_routers`, `test_services`, `test_validators` — covering validators (incl. split-session validity, overlap, max-count, ordering), services (incl. transactional rollback paths), repositories (incl. `FOR UPDATE` lock methods), and routers (auth, RBAC, CRUD, replace-week, cross-doctor). Coverage is strong and tiered. The **single defect** is `test_replace_duplicate_days`'s *expectation*, which contradicts the documented split-shift feature (F-1) — a test-spec mismatch, not broken production code.

## 26. Frontend Test Coverage (doctor module)

21 files / 198 tests, green, including the previously-flagged `DoctorForm.test.tsx`. Notable: the schedule editor/revert/mutation components are **well tested** — which paradoxically makes F-0 worse: tested components exist but are not deployed, i.e., test coverage exceeds shipped functionality for the scheduling feature. No doctor test uses the pattern that fails in billing (no PatientPicker placeholder dependency in doctor tests), so the doctor suite is stable.

## 27. Pre-existing Non-Doctor Suite Failures (F-2, informational)

13 frontend failures, all in billing (`CreateInvoiceDrawer`, `RecordPaymentDrawer`, `PaymentListContainer`, `BillingDashboard*`, `MobileCreateInvoiceForm`, `InvoiceList`) and one in `patientRecords` — all because the shared PatientPicker renders placeholder `"Search patient by name or phone…"` while the tests assert `"Search patient by name or code…"`. This is **outside the doctor module** but **blocks any overall "all tests green" claim** and likely reflects either a test-copy drift or a shared-component contract change. Recorded as informational; not scored against the doctor module, but it must be fixed before an organization-wide release gate passes.

## 28. Performance and N+1 (Verified)

- Doctor list uses `selectinload(Doctor.user)` + `selectinload(Doctor.specializations)` — **no N+1** on the hot list path; single join for name search/sort.
- Profile/get use `selectinload` for user/specializations/schedules.
- Pagination via `offset/limit`; index coverage for active/available, schedule(doctor,day), schedule(doctor,active), specialization(active).
- **Non-sargable search** (F-3): `_build_search_filter` uses `ilike('%term%')` (leading wildcard) — no `pg_trgm`/full-text index. Fine for small clinics; degrades on large doctor tables. Low.
- **Bundle size** (F-8): main `index` chunk 638 kB (gzip 166 kB) exceeds Vite’s 500 kB advisory; route-level lazy splitting exists but the shared core is heavy. Low/medium.

## 29. Security (Verified)

- Endpoint authorization is backend-enforced with role dependencies on **every** mutate and read route — the frontend gates are UX only (defense-in-depth), and the backend is authoritative. Good.
- Data-at-rest: no secrets in the module. No mass-assignment risk: `DoctorUpdate` is an explicit allow-list schema (`_ALLOWED_UPDATE_FIELDS` for schedules); `exclude_unset` used to avoid overwriting omitted fields.
- Input: Pydantic validation + normalization (phone/registration), length caps, pattern checks; DB check constraints as a last line of defense.
- IDOR: `require_doctor_self_or_full_read` / `require_user_self_or_full_read` prevent a doctor reading another doctor’s profile/schedule; schedule ownership (`assert_schedule_belongs_to_doctor`) prevents cross-doctor edits. Verified.
- **Minor (F-10):** error messages in some validation paths interpolate raw user values (e.g., session time strings) into `InvalidDoctorOperation` messages — low-severity information disclosure, generally acceptable in a clinic app; flag as hardening.

## 30. Observability / Logging

Services log structured `logger.info/error` with operation/context (doctor_id, actor_id, count). Audit fields `created_by/updated_by`, `created_at/updated_at` present on `Doctor`. Reasonable for the scale. No dedicated audit trail for schedule changes beyond updated_by — acceptable (Finding F-4, low).

---

# Part H — Completeness and Dead Code

## 31. Dead / Unreachable / TODO (Verified)

- **F-0 (critical):** `DoctorScheduleEditor`, `DoctorScheduleRevertDialog`, `useReplaceWeekSchedule` — dead in production (only referenced by tests).
- `search()` repo method (`DoctorRepository.search`) — check callers; if unused, dead code (low).
- Hardcoded literal in `DoctorScheduleEditor.tsx:158` — `{ start_time: '09:00', end_time: '17:00' }` as the new-session default instead of deriving from `CLINIC_DEFAULT_SESSIONS`/shared constants (F-5). Bounded.
- No outstanding `TODO`/`Phase-2` markers in the doctor module indicating unfinished core flows (the only divergence is F-0).

## 32. Completeness vs. Objective

The module implements the full roster: doctor CRUD, activation, leave, availability, specializations, profiles, and schedule CRUD + atomic replace (backend). The only **product-blocking** gap is the unwired schedule UI (F-0). Everything else is either complete or cosmetic.

---

# Part I — Findings

## 33. Findings Table

| ID | Severity | Area | Finding | Verified evidence | Recommendation posture |
|---|---|---|---|---|---|
| **F-0** | 🔴 Critical | Frontend | **Schedule editing UI is completely unreachable** — `DoctorDetailsContainer` renders `DoctorScheduleSection` without `isAdmin`/`onEditSchedule`, so the Edit/Create Custom Schedule button never renders; `DoctorScheduleEditor`, `DoctorScheduleRevertDialog`, `useReplaceWeekSchedule` are referenced only in tests. | `DoctorDetailsContainer.tsx:184`; grep shows editor/revert/`useReplaceWeekSchedule` only inside `.test.tsx`; `DoctorScheduleSection.tsx:65–69` requires both props. | Mount editor+revert in container; pass admin+handler. |
| **F-1** | 🟠 Medium | Backend tests | `test_replace_duplicate_days` expects 400 for two **non-overlapping** sessions on the same day, but the module explicitly supports multi-session split shifts (`test_validate_replace_list_split_session_valid` passes; service returns 200). Route docstring also says it validates "duplicate days." | `test_routers.py:774–780` fail; `test_validators.py:380–386` and `schedule_validator.validate_replace_list` allow non-overlapping same-day sessions; `routes.py:812`. | Reconcile test/spec/docstring with the intended split-shift semantics. |
| **F-2** | 🟠 Medium (info, non-doctor) | Frontend suite | 13 failing tests, all billing/patientRecords, one shared root cause: PatientPicker placeholder is `"…name or phone…"` but tests assert `"…name or code…"`. Blocks an org-wide green gate. | Fresh `vitest run` — 13 fails across `CreateInvoiceDrawer`, `RecordPaymentDrawer`, `PaymentListContainer`, `BillingDashboard*`, `InvoiceList`, `MobileCreateInvoiceForm`, `PatientRecordListContainer`. | Fix tests or component to match (outside doctor scope). |
| **F-3** | 🟡 Low | Backend perf | Doctor name/code search uses non-sargable `ilike('%term%')` with no trigram/full-text index. | `doctor_repository._build_search_filter`. | Add `pg_trgm` index or full-text if doctor count grows. |
| **F-4** | 🟡 Low | Observability | No dedicated audit trail for schedule changes (only `updated_by` on Doctor row; schedules have no audit columns). | `models.py` `DoctorSchedule` — no created_by/updated_by. | Optional; acceptable for small clinics. |
| **F-5** | 🟡 Low | Frontend | Hardcoded `09:00–17:00` placeholder in `DoctorScheduleEditor` new-session default rather than a shared constant. | `DoctorScheduleEditor.tsx:158`. | Derive from constants. |
| **F-6** | 🟡 Low | Cross-module | Doctor identity is split: appointments key on `User.id` (`dentist_id`) while treatment plans key on `Doctor.id` — correct today, footgun for future code. | `appointments/model.py` `dentist_id→users.id`; `treatment/models.py` `doctor_id→doctors.id`; both frontend list components handle correctly. | Document invariant / add helper; no redesign needed. |
| **F-7** | 🟡 Low | Concurrency | Doctor `doctor_code` generation is read-then-insert without a DB sequence; race possible, though `UNIQUE` turns it into an error, not corruption. | `doctor_repository.get_latest_doctor_code`. | Optional hardening. |
| **F-8** | 🟡 Low | Frontend perf | Main bundle 638 kB (gzip 166 kB) > 500 kB advisory. | `vite build` output. | Further code splitting/lazy. |
| **F-9** | 🟡 Low | Maintenance | Validation rules duplicated across backend (Pydantic) and frontend (Zod); currently in sync but can drift. | `doctor_validator.py` + `doctorFormSchema.ts`. | Keep mirrors documented (already commented). |
| **F-10** | 🔵 Very Low | Security | Some validation error messages interpolate raw user input (session times) into messages. | `schedule_validator.assert_no_session_overlap` message. | Optional message sanitization. |

## 34. Severity Model

| Symbol | Meaning | Count |
|---|---|---|
| 🔴 Critical | Blocks release / core advertised feature unusable | 1 (F-0) |
| 🟠 Medium | Defect or inconsistency that must be fixed before/at release | 2 (F-1, F-2) |
| 🟡 Low | Non-blocking hardening / optimization / maintenance | 6 (F-3…F-9) |
| 🔵 Very Low | Cosmetic / optional hardening | 1 (F-10) |

---

# Part J — Fifteen Sub-Scores

Each scored **/10** from verified evidence. Readiness = "ready to rely on today"; Optimization = "code quality / efficiency."

| # | Sub-area | Readiness /10 | Optimization /10 | Key evidence |
|---|---|---|---|---|
| 1 | Backend architecture & layering | 9.5 | 9.0 | Service-owns-commit, pure validators, thin routers |
| 2 | Backend doctor CRUD | 9.5 | 9.0 | Full CRUD+status, allow-list update, uniqueness |
| 3 | Backend schedule service | 9.5 | 9.0 | CRUD + atomic replace + FOR UPDATE + overlap + count |
| 4 | Backend specializations | 9.5 | 9.0 | CRUD, primary partial-unique index, delete guard |
| 5 | Backend tests | 7.5 | 8.0 | 244/245; 1 is test/spec contradiction (F-1) |
| 6 | Data model & FK integrity | 9.5 | 9.0 | RESTRICT/CASCADE, check constraints, indexes |
| 7 | RBAC & authorization | 9.5 | 9.0 | Backend-authoritative, frontend parity confirmed |
| 8 | API contract & type parity | 9.0 | 8.5 | Types mirror backend; list returns full records |
| 9 | Frontend architecture & hooks | 9.0 | 9.0 | Query factory, cache invalidation, clean containers |
| 10 | Frontend doctor list/page UI | 9.0 | 8.5 | Filters/sort/pagination/mobile/dialogs, tested |
| 11 | Frontend details/overview UI | 8.5 | 8.0 | Full profile, appointments+treatment tabs |
| 12 | **Frontend schedule editing UI** | **2.0** | **6.0** | Components exist+tested but **unwired** (F-0) — feature unusable |
| 13 | Frontend tests | 9.0 | 8.5 | 198/198 doctor; stable DoctorForm |
| 14 | Frontend quality gates | 7.0 | 8.5 | tsc+build pass, doctor lint clean; repo lint 4 errs (non-doctor) |
| 15 | Cross-module integration | 8.5 | 7.5 | Both ID paths correct; asymmetry is a footgun (F-6) |

**Weighted overall readiness  ≈ 6.2 / 10** (dominated by sub-score 12).
**Weighted overall optimization ≈ 7.1 / 10.**

---

# Part K — Ten Manual Journeys

> **Environment note:** No browser is available in this audit environment. Each journey below is marked **N/A (not executed — code-verified)** and the equivalent is confirmed from code/test evidence where possible. **No results are fabricated.**

| # | Journey | Status | Code evidence |
|---|---|---|---|
| J1 | Admin lists doctors, filters by active/availability/specialization, searches by name/code | N/A (code-verified) | `DoctorListContainer` → `useDoctors` → `doctorService.list` (params incl. `search`, `is_active`, `is_available`, `specialization_id`, `.any()` repo filter). |
| J2 | Admin opens Create Doctor, fills all fields, saves | N/A (code-verified) | `DoctorFormContainer`/`DoctorForm` → `POST /doctors`; Zod schema mirrors backend. |
| J3 | Admin edits an existing doctor; registration-number uniqueness re-validated | N/A (code-verified) | `DoctorFormContainer` edit mode → `PATCH /doctors/{id}`; `registration_number_exists(exclude_doctor_id)`. |
| J4 | Admin activates / deactivates a doctor | N/A (code-verified) | `DoctorDetailsContainer` status dialog → `PATCH /{id}/activate|deactivate`, gated by `ADMIN_ROLES`. |
| J5 | Admin toggles availability / leave | N/A (code-verified) | `DoctorToggleDialog` → `PATCH /{id}/availability|leave`. |
| J6 | Doctor views own profile (self-read RBAC) | N/A (code-verified) | `require_doctor_self_or_full_read` returns only own; `useDoctorProfile`. |
| J7 | **Admin creates a custom weekly schedule (split shifts)** | **N/A — BLOCKED in product (F-0)** | Backend `PUT /schedules` ready; frontend editor exists+tested but never mounted. **Cannot be performed from the shipped UI.** |
| J8 | **Admin edits / reverts an existing schedule to clinic default** | **N/A — BLOCKED in product (F-0)** | Revert dialog exists+tested; not wired. Empty-list `PUT` returns to clinic default on backend, but no UI entry point. |
| J9 | Admin opens doctor details and views Appointments + Treatment Plans tabs | N/A (code-verified) | `DoctorAppointmentList` (dentist_id=user_id), `DoctorTreatmentPlanList` (doctor_id). |
| J10 | Receptionist views doctor list (read-only) | N/A (code-verified) | List route `require_roles([ADMIN, RECEPTIONIST])`; no create/edit for receptionist UI. |

**Result:** 8 of 10 journeys are code-verified as fully supported. **J7 and J8 (the schedule-management journeys) are unreachable in the shipped product** due to F-0 — the only journeys blocked.

---

# Part L — Conclusion

## 35. The Bottom Line

The DensCare Doctor module is **architecturally excellent and backend-complete**, with a clean layering discipline, strong referential integrity, correct RBAC parity, sound concurrency controls, centralized clinic-default constants that are shared with the appointment module, and 198/198 green doctor-module frontend tests plus 244/245 backend module tests.

It is nevertheless assessed **C — Not Ready**, because the module’s **headline capability — schedule management — is not reachable in the product UI**. The editor, revert dialog, and replace mutation exist and are well tested, but were never connected to `DoctorDetailsContainer`, so administrators cannot create, edit, delete, or revert schedules from any screen. This is a **bounded wiring defect (F-0)**, not an architectural failure — hence Verdict **D is rejected**.

## 36. Required Before Release (blocking)

1. **Wire the schedule editor** — mount `DoctorScheduleEditor`/`DoctorScheduleRevertDialog` and pass `isAdmin`/`onEditSchedule` to `DoctorScheduleSection` in `DoctorDetailsContainer` (resolve F-0). This single change restores Journey J7/J8.
2. **Reconcile the split-session test/spec contradiction** (F-1) — either the docstring+test or the feature’s multi-session semantics must be made consistent; the production code currently (correctly) supports split shifts.

## 37. Recommended Before/At Release (non-blocking)

3. Fix the non-doctor billing/patientRecords test failures (F-2) so an org-wide gate can pass.
4. Add a `pg_trgm`/full-text index for doctor search if scale warrants (F-3).
5. Address bundle-size advisory (F-8); remove hardcoded schedule literal (F-5); consider a schedule audit trail (F-4).

## 38. Explicitly NOT an issue

- **Billing tab absence** — intentional, documented architectural decision (unreliable `Invoice.doctor_id` attribution). Not a defect.
- **Backend provisions** — complete; no backend API changes are required to support the missing frontend schedule UI.
- **Sunday support** — consistently unsupported across backend (DB check 0–5), frontend types (`DayOfWeek 0–5`), and constants (Mon–Sat) — matches the product spec.

---

*End of independent production-readiness review.*
