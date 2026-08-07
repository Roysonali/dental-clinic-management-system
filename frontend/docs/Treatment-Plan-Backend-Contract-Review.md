# Treatment Plan Module — Backend Contract Review (Sprint 12A)

> **Document type:** Mandatory backend contract review (Blocking Task)
> **Scope:** Backend Treatment Plan module (`backend/app/modules/treatment/`) — **single source of truth** for all frontend Treatment Plan and Procedure catalog work.
> **Status:** ✅ VERIFIED against actual backend implementation (source code, not OpenAPI docs)
> **Date:** 2026-08-06
> **Method:** Every claim below was verified by reading the routers, Pydantic schemas, services, repositories, validators, state machine, SQLAlchemy models, constants, enums, exceptions, the global exception handler, the RBAC dependency, and `backend/main.py` registration. Cross-referenced against `backend/tests/modules/treatment/*`.

---

## 1. Executive Summary

### 1.1 Module purpose

The Treatment Plan module manages **structured dental treatment planning** for DensCare. It provides:

1. **Plans** — an aggregate root (`TreatmentPlan`) tied to a patient and a treating doctor, carrying clinical notes, observations, dentist recommendations, validity dates, a **status lifecycle** (draft → … → completed/cancelled), optimistic-concurrency locking, and a **versioning** system (immutable JSONB snapshots).
2. **Plan items** — procedure line items (`TreatmentPlanItem`) referencing the procedure master catalog, each with tooth-level detail (FDI tooth number, surface code, quadrant, arch), estimated cost, discount, and an item status.
3. **Versioning** — immutable snapshots (`TreatmentPlanVersion`) taken before substantial modifications, with a `current_version` counter and a `restore` operation.
4. **Doctor approval + patient acknowledgment** — a 1:1 record (`TreatmentPlanApproval`) tracking whether the doctor signed off and whether the patient accepted/declined/changes-requested.
5. **Procedure master catalog** (`Procedure`) — the shared, admin-managed list of dental procedures used by plan items (code, name, description, default cost, category, active flag).

### 1.2 High-level workflow

```
Create plan (DRAFT) → add items → submit-for-review (UNDER_REVIEW)
  → approve-review (PROPOSED) → doctor-approve + patient-acknowledge
  → accept (ACCEPTED) → start-treatment (IN_PROGRESS) → [hold / resume]
  → complete (COMPLETED) | cancel (CANCELLED) at any non-terminal step
```

- Items can only be added/updated/removed/reordered while the plan is in an **editable** status: `draft`, `under_review`, or `proposed`.
- Doctor approval and patient acknowledgment are **independent of the status transition**: `doctor-approve` / `patient-acknowledge` / `doctor-revoke` / `patient-decline` record state on the `approval` record; the plan status is moved by the separate `accept` / `decline` endpoints.
- Versions can be created in **any** status, but **restoring** a version requires an editable status.

### 1.3 Overall architecture

- Standard DensCare layered architecture: **router (thin) → service (transactions + orchestration) → repository (SQL) + validator (business rules) → SQLAlchemy models**. Mappers convert ORM → response DTOs.
- Two routers registered in `backend/main.py` (no version prefix):
  - `procedure_router` → prefix `/procedures`
  - `treatment_plan_router` → prefix `/treatment-plans`
- Service factories in `dependencies.py` wire repo → validator → service per request with the shared `get_db` session.
- State machine is a **pure, stateless module** (`validators/state_machine.py`) driven by transition maps in `constants.py` — the single source of truth for legal transitions.
- All 45 endpoints (34 treatment-plan + 11 procedure) are **JWT-protected**; all plan endpoints allow the same role set (`ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR`); procedure **writes** additionally require `ADMIN` (or `CHIEF_DOCTOR`, via `require_admin`).

### 1.4 Important implementation observations (read first)

| # | Observation | Severity |
|---|---|---|
| **O1** | **There is NO endpoint to edit the plan header** (`clinical_notes`, `observations`, `dentist_recommendations`, `valid_from`, `valid_to`). The repository has an update allowlist for these fields, but **no service method and no route** use it. These fields are immutable after creation. | 🔴 |
| **O2** | **There is NO endpoint to change an item's status.** Items are created with `item_status = "pending"` and can never transition via the API, even though `ITEM_TRANSITIONS` and `validate_item_transition` exist. `item_status` is **read-only** for the frontend. | 🔴 |
| **O3** | **There is NO plan delete / deactivate / reactivate endpoint.** The repository has `delete/activate/deactivate`, but no service method or route exposes them. A plan can never be removed or soft-archived via the API. | 🟠 |
| **O4** | **The real error envelope is `{success, message, details}`** — the `{error: {code, message, details}}` shape in `schemas/errors.py` is **dead code**. Error **codes are stripped** from HTTP responses; the frontend must branch on HTTP status and display `message`. | 🟠 |
| **O5** | **No endpoint returns allowed transitions.** `StatusTransition` DTO and `get_allowed_transitions` are not wired to any route. The frontend must hardcode the state machine (Section 11). | 🟡 |
| **O6** | **Invalid `date_from`/`date_to` formats cause a 500**, not a 422 — the router calls `date.fromisoformat()` outside any handler, and `ValueError` falls through to the unhandled 500 handler. Always send `YYYY-MM-DD`. | 🟡 |
| **O7** | **`pending_acknowledgment` dashboard count can list plans that can never be acknowledged.** The count query returns `ACCEPTED` plans with `patient_status = pending`, but the acknowledge endpoint requires `PROPOSED` status → those plans are stuck. | 🟡 |
| **O8** | **`tooth_surface` is not validated for format.** `is_valid_tooth_surface_combination()` exists in constants but is **never called**; the schema only enforces 1–10 chars. Any string (e.g. `"XYZ"`) is accepted. | 🔵 |
| **O9** | **Concurrent writes surface as 500.** The optimistic lock (`lock_version`) raises `StaleDataError` (a `SQLAlchemyError`) on conflict, which the service wraps as `PlanUpdateFailed` → **500**. No 409 retry contract. | 🟡 |
| **O10** | **Custom `plan_code` is stored verbatim** (no uppercasing, no `TXN-` format enforcement, no format validation) when provided. Only uniqueness is checked. | 🔵 |
| **O11** | **Versioning is effectively only usable in editable statuses.** `create_version` is allowed in any status, but items cannot be modified outside `draft`/`under_review`/`proposed` and `restore` also requires an editable status — so in active statuses versions are pure audit history. | 🟡 |
| **O12** | **A plan can never return to `draft` once it reaches `proposed` or `rejected`.** The state machine allows `proposed→draft` and `rejected→draft`, but **no endpoint** implements them (only `under_review→draft` via `reject-review`). | 🟡 |

---

## 2. Module Structure

### 2.1 Folder / file map (`backend/app/modules/treatment/`)

```
treatment/
├── __init__.py                     # Module docstring
├── constants.py                    # Non-business constants + transition maps (single source of truth)
├── enums.py                        # Domain string enums (status, category, quadrant, arch, acknowledgment)
├── exceptions.py                   # Domain exception hierarchy (code + message + details)
├── models.py                       # 5 SQLAlchemy models (Procedure, TreatmentPlan, Item, Version, Approval)
├── dependencies.py                 # FastAPI DI factories (get_procedure_service, get_treatment_plan_service)
├── mappers/
│   ├── __init__.py
│   ├── procedure_mapper.py         # Procedure ORM → ProcedureResponse / ProcedureSummary / paginated
│   └── treatment_plan_mapper.py    # Plan ORM → list item / full response / versions / dashboard
├── schemas/
│   ├── __init__.py
│   ├── common.py                   # StatusTransition (DEAD CODE), PlanStatusCounts (used)
│   ├── errors.py                   # ErrorResponse / ValidationErrorResponse (DEAD CODE — see O4)
│   ├── pagination.py               # PaginatedResponse[T] (used by every list endpoint)
│   ├── procedure.py                # ProcedureCreate/Update/Response/Summary
│   └── treatment_plan.py           # All plan request/response DTOs
├── repositories/
│   ├── __init__.py
│   ├── procedure_repository.py     # Procedure catalog data access
│   └── treatment_plan_repository.py# Aggregate-root data access (plans + child entities)
├── services/
│   ├── __init__.py
│   ├── procedure_service.py        # Procedure business orchestration + transactions
│   └── treatment_plan_service.py   # Plan/item/version/approval orchestration + transactions
├── validators/
│   ├── __init__.py
│   ├── procedure_validator.py      # Procedure field/format/uniqueness rules
│   ├── state_machine.py            # Pure transition legality (plan + item)
│   └── treatment_plan_validator.py # Plan/item/version/approval business rules
└── routers/
    ├── __init__.py
    ├── procedure_router.py         # /procedures (11 endpoints)
    └── treatment_plan_router.py    # /treatment-plans (34 endpoints)
```

Also relevant outside the module:

| File | Role |
|---|---|
| `backend/main.py` | Registers both routers; CORS for `localhost:5173` / `127.0.0.1:5173`; global exception handlers |
| `backend/app/dependencies/auth.py` | `oauth2_scheme`, `get_current_user` (JWT → User; rejects inactive → 401) |
| `backend/app/modules/rbac/permissions.py` | `require_roles([...])`, `require_admin` (ADMIN + CHIEF_DOCTOR) |
| `backend/app/core/security.py` | `create_access_token` / `decode_access_token` (HS256, `sub`=email, 30-min expiry) |
| `backend/app/core/exception_handlers.py` | Global `{success, message, details}` envelope + status maps (incl. `_TREATMENT_PLAN_EXCEPTION_MAP`) |
| `backend/app/core/constants.py` | Role identifiers (`ROLE_ADMIN`, `DOCTOR_ROLES`, `ROLE_RECEPTIONIST`, …) |
| `backend/app/database/session.py` | `get_db` session dependency |

### 2.2 Dependency graph

```
Router ──► Service ──► Repository ──► SQLAlchemy Session
   │            │            └─► (flush only; no commit)
   │            └─► Validator (repo read-only lookups + state machine)
   │
   └─► Mapper ──► Pydantic response DTOs
Service owns: commit / rollback / orchestration / logging / snapshot generation
Validator owns: business validation (uses state_machine for transition legality)
```

**Responsibility split:**

| Layer | Owns | Never does |
|---|---|---|
| Router | Parse request → call service → map response | Business logic, SQL, transactions |
| Service | Transaction commit/rollback, orchestration, logging, version-snapshot generation | SQL, transition legality |
| Validator | Business rules, existence/uniqueness, transition legality (via state machine) | Writes, commits |
| Repository | SQL queries, flush | Commit / rollback, business decisions |
| Mapper | ORM → DTO conversion only | DB access |

---

## 3. Router Review

### 3.1 `treatment_plan_router` — `prefix="/treatment-plans"`, `tags=["Treatment Plans"]`

| Property | Value |
|---|---|
| URL prefix | `/treatment-plans` (no API version prefix) |
| Authentication | JWT Bearer via `Depends(require_roles([...]))` → `get_current_user` |
| Allowed roles (ALL 34 endpoints) | `ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR` (i.e. `[ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES]`) |
| Excluded role | `DENTAL_ASSISTANT` is **not** allowed on any treatment-plan endpoint |
| Tags | `Treatment Plans` |
| Response models | Pydantic response models on every endpoint (FastAPI filters/validates output) |
| 403 behavior | `"Role not assigned"` (no role) or `"Insufficient permissions"` (wrong role) |

> ⚠️ **No ownership checks.** There is **no doctor-specific access restriction** in the code — any of the six allowed roles can create/view/edit/transition **any** plan, including plans owned by other doctors. Do not implement client-side ownership gating that the backend enforces (it does not); the UI may still filter by doctor for UX.

### 3.2 `procedure_router` — `prefix="/procedures"`, `tags=["Procedures"]`

| Property | Value |
|---|---|
| URL prefix | `/procedures` |
| Authentication | JWT Bearer |
| Read endpoints (list, search, active, count, get-by-id, get-by-code) | `ADMIN`, `RECEPTIONIST`, `CHIEF_DOCTOR`, `GENERAL_DOCTOR`, `SPECIALIST_DOCTOR`, `CONSULTING_DOCTOR` |
| **Write endpoints** (create, update, activate, deactivate, delete) | `Depends(require_admin)` → **`ADMIN` or `CHIEF_DOCTOR` only** |
| Tags | `Procedures` |

---

## 4. Endpoint Inventory

**Legend:** 🔐 = requires Bearer JWT; 🅰 = role set `{ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}`; ⭐ = `require_admin` (`{ADMIN, CHIEF_DOCTOR}`). No endpoint is public.

### 4.1 Treatment Plans — `/treatment-plans` (all 🔐 + 🅰)

| # | Method | Endpoint | Purpose | Success | Request body | Response body |
|---|---|---|---|---|---|---|
| 1 | `POST` | `/treatment-plans` | Create plan (DRAFT) + approval record (pending) + version 1 snapshot | **201** | `CreatePlanRequest` | `TreatmentPlanResponse` |
| 2 | `GET` | `/treatment-plans` | Paginated list with search/filters/sort | 200 | — (query params, §4.3) | `PaginatedResponse<TreatmentPlanListItem>` |
| 3 | `GET` | `/treatment-plans/search` | Type-ahead by plan code substring | 200 | — (`term`, `limit`) | `list[TreatmentPlanListItem]` (bare array) |
| 4 | `GET` | `/treatment-plans/pending-review` | Plans in `under_review` | 200 | — (`page`, `page_size`) | `PaginatedResponse<TreatmentPlanListItem>` |
| 5 | `GET` | `/treatment-plans/pending-approval` | `proposed` plans without a signed doctor approval | 200 | — (`page`, `page_size`) | `PaginatedResponse<TreatmentPlanListItem>` |
| 6 | `GET` | `/treatment-plans/dashboard` | Aggregated stats | 200 | — | `DashboardSummaryResponse` |
| 7 | `GET` | `/treatment-plans/by-patient/{patient_id}` | Paginated plans for one patient | 200 | — (path + query) | `PaginatedResponse<TreatmentPlanListItem>` |
| 8 | `GET` | `/treatment-plans/by-doctor/{doctor_id}` | Paginated plans for one doctor | 200 | — (path + query) | `PaginatedResponse<TreatmentPlanListItem>` |
| 9 | `GET` | `/treatment-plans/count-by-status` | `{status: count}` map | 200 | — | `dict[str, int]` |
| 10 | `GET` | `/treatment-plans/count-by-doctor` | `{doctor_uuid: count}` or single `int` | 200 | — (`doctor_id?`) | `dict[str, int] \| int` |
| 11 | `GET` | `/treatment-plans/count-by-patient` | `{patient_uuid: count}` or single `int` | 200 | — (`patient_id?`) | `dict[str, int] \| int` |
| 12 | `GET` | `/treatment-plans/{plan_id}` | Full aggregate (items + approval + versions) | 200 | — | `TreatmentPlanResponse` |
| 13 | `POST` | `/treatment-plans/{plan_id}/items` | Add item (editable statuses only) | **201** | `AddItemRequest` | `TreatmentPlanResponse` |
| 14 | `PATCH` | `/treatment-plans/{plan_id}/items/{item_id}` | Partial item update (editable statuses only) | 200 | `ItemUpdateRequest` | `TreatmentPlanResponse` |
| 15 | `DELETE` | `/treatment-plans/{plan_id}/items/{item_id}` | Remove item (editable statuses only) | 200 | — | `TreatmentPlanResponse` |
| 16 | `PUT` | `/treatment-plans/{plan_id}/items/reorder` | Reorder items (all items exactly once) | 200 | `ReorderItemsRequest` | `TreatmentPlanResponse` |
| 17 | `POST` | `/treatment-plans/{plan_id}/submit-for-review` | `draft → under_review` (needs ≥1 item) | 200 | — (no body) | `TreatmentPlanResponse` |
| 18 | `POST` | `/treatment-plans/{plan_id}/approve-review` | `under_review → proposed` | 200 | — (no body) | `TreatmentPlanResponse` |
| 19 | `POST` | `/treatment-plans/{plan_id}/reject-review` | `under_review → draft` | 200 | — (no body) | `TreatmentPlanResponse` |
| 20 | `POST` | `/treatment-plans/{plan_id}/accept` | `proposed → accepted` | 200 | — (no body) | `TreatmentPlanResponse` |
| 21 | `POST` | `/treatment-plans/{plan_id}/decline` | `proposed → rejected` | 200 | — (no body) | `TreatmentPlanResponse` |
| 22 | `POST` | `/treatment-plans/{plan_id}/cancel` | any non-terminal → `cancelled` | 200 | — (no body) | `TreatmentPlanResponse` |
| 23 | `POST` | `/treatment-plans/{plan_id}/start-treatment` | `accepted → in_progress` (needs ≥1 item) | 200 | — (no body) | `TreatmentPlanResponse` |
| 24 | `POST` | `/treatment-plans/{plan_id}/hold` | `in_progress → on_hold` | 200 | — (no body) | `TreatmentPlanResponse` |
| 25 | `POST` | `/treatment-plans/{plan_id}/resume` | `on_hold → in_progress` | 200 | — (no body) | `TreatmentPlanResponse` |
| 26 | `POST` | `/treatment-plans/{plan_id}/complete` | `in_progress`/`on_hold → completed` | 200 | — (no body) | `TreatmentPlanResponse` |
| 27 | `POST` | `/treatment-plans/{plan_id}/doctor-approve` | Record doctor signature on approval (PROPOSED only) | 200 | — (no body) | `TreatmentPlanResponse` |
| 28 | `POST` | `/treatment-plans/{plan_id}/doctor-revoke` | Clear doctor signature (PROPOSED only, must be signed) | 200 | — (no body) | `TreatmentPlanResponse` |
| 29 | `POST` | `/treatment-plans/{plan_id}/patient-acknowledge` | Patient accepts (PROPOSED + doctor-signed, not yet acted) | 200 | — (no body) | `TreatmentPlanResponse` |
| 30 | `POST` | `/treatment-plans/{plan_id}/patient-decline` | Patient declines (PROPOSED + doctor-signed, not yet acted) | 200 | — (no body) | `TreatmentPlanResponse` |
| 31 | `POST` | `/treatment-plans/{plan_id}/versions` | Create immutable snapshot | **201** | `VersionRequest` | `TreatmentPlanResponse` |
| 32 | `GET` | `/treatment-plans/{plan_id}/versions` | List snapshots (ascending) | 200 | — | `VersionListResponse` |
| 33 | `GET` | `/treatment-plans/{plan_id}/versions/{version_id}` | Snapshot detail incl. full JSONB | 200 | — | `VersionDetailResponse` |
| 34 | `POST` | `/treatment-plans/{plan_id}/versions/{version_id}/restore` | Restore items from snapshot (editable only) | 200 | — (no body) | `TreatmentPlanResponse` |

> All transition/approval/version endpoints take **no request body**. The `TransitionPlanRequest`, `CancelPlanRequest`, and `RestoreVersionRequest` schemas are **dead code** — do not model them.

### 4.2 Procedures — `/procedures`

| # | Method | Endpoint | Purpose | Auth | Success | Request body | Response body |
|---|---|---|---|---|---|---|---|
| 1 | `POST` | `/procedures` | Create procedure (code uppercased) | ⭐ | **201** | `ProcedureCreate` | `ProcedureResponse` |
| 2 | `GET` | `/procedures` | Paginated list + filters + sort | 🅰 | 200 | — (§4.3) | `PaginatedResponse<ProcedureResponse>` |
| 3 | `GET` | `/procedures/search` | Type-ahead by code or name | 🅰 | 200 | — (`term`, `limit`) | `list[ProcedureResponse]` |
| 4 | `GET` | `/procedures/active` | All active procedures, ordered by code (dropdowns) | 🅰 | 200 | — | `list[ProcedureResponse]` (bare array) |
| 5 | `GET` | `/procedures/count` | Total count (optionally filtered) | 🅰 | 200 | — (`is_active?`) | `{"count": int}` |
| 6 | `GET` | `/procedures/{procedure_id}` | Get by int PK | 🅰 | 200 | — | `ProcedureResponse` |
| 7 | `GET` | `/procedures/by-code/{code}` | Get by business code (case-insensitive) | 🅰 | 200 | — | `ProcedureResponse` |
| 8 | `PATCH` | `/procedures/{procedure_id}` | Partial update (name, cost, category, description) | ⭐ | 200 | `ProcedureUpdate` | `ProcedureResponse` |
| 9 | `PATCH` | `/procedures/{procedure_id}/activate` | Activate procedure | ⭐ | 200 | — | `ProcedureResponse` |
| 10 | `PATCH` | `/procedures/{procedure_id}/deactivate` | Deactivate (soft retire) | ⭐ | 200 | — | `ProcedureResponse` |
| 11 | `DELETE` | `/procedures/{procedure_id}` | **Hard delete** (must be inactive; 409 if referenced by items) | ⭐ | **204** (no body) | — | — |

### 4.3 Common query parameters

**`GET /treatment-plans`** (list):

| Param | Type | Default | Validation | Semantics |
|---|---|---|---|---|
| `search` | `string` | `null` | — | Case-insensitive substring (`ilike %term%`) on `plan_code` OR patient `first_name` OR patient `last_name` (joins `patients` only when provided) |
| `patient_id` | UUID | `null` | — | Exact `patient_id` |
| `doctor_id` | UUID | `null` | — | Exact `doctor_id` |
| `status` | enum string | `null` | Enum-parsed (`TreatmentPlanStatus`) | Exact status — **invalid value → 422** (unlike the users module) |
| `is_active` | `bool` | `null` | — | Exact active flag |
| `date_from` | `string` | `null` | parsed with `date.fromisoformat` — **invalid format → 500** (O6) | `created_at >= date` (inclusive) |
| `date_to` | `string` | `null` | same | `created_at <= date` (inclusive) |
| `page` | `int` | `1` | `ge=1` | 1-based |
| `page_size` | `int` | `20` | `ge=1`, `le=100` | Rows per page |
| `sort_by` | `string` | `null` | Not validated in router; repo allowlist `{created_at, updated_at, status, plan_code}` — **unknown value silently falls back to `created_at`** | Sort column |
| `sort_order` | `string` | `desc` | regex `^(asc\|desc)$` | Direction |

**`GET /treatment-plans/by-patient/{patient_id}` and `/by-doctor/{doctor_id}`**: `page`, `page_size`, `sort_by`, `sort_order` (same rules, default `desc`).

**`GET /treatment-plans/search`**: `term` (**required**, `min_length=1`) + `limit` (`1..50`, default `20`). **Missing `term` → 422**; a whitespace-only `term` (e.g. `" "`) passes the schema, is stripped by the service, and returns an empty `[]` (200).

**`GET /procedures`**: `page` (`ge=1`), `page_size` (`1..100`, default 20), `is_active` (bool), `category` (enum; invalid → 422), `sort_by` (allowlist `{code, name, category, default_cost}`; unknown → fallback `code`), `sort_order` (regex, **default `asc`** — note the difference from plans).

**`GET /procedures/search`**: `term` (required, `min_length=1`) + `limit` (`1..50`, default 20).

### 4.4 Errors per endpoint family

| Family | Notable statuses |
|---|---|
| Create plan (#1) | 201; **404** patient/doctor missing; **409** duplicate explicit `plan_code`; **422** invalid date range / schema; **500** persistence |
| List/search (#2–3) | 200; 422 bad params |
| Get plan (#12) | 200; **404** `PLAN_NOT_FOUND` |
| Item ops (#13–16) | 201 (add) / 200; **404** plan or item or procedure; **409** `PLAN_NOT_EDITABLE`, `DUPLICATE_ITEM_SEQUENCE`, inactive procedure; **422** `INVALID_TOOTH_NUMBER`, `PLAN_VALIDATION_FAILED` (cost/discount); **500** `PLAN_UPDATE_FAILED` |
| Plan transitions (#17–26) | 200; **404**; **409** `INVALID_PLAN_OPERATION` (illegal transition or empty items for submit/start) |
| Approval (#27–30) | 200; **404**; **409** `INVALID_PLAN_OPERATION` (wrong status / not signed), `PLAN_ALREADY_APPROVED`, `PATIENT_ACKNOWLEDGMENT_EXISTS` |
| Versions (#31–34) | 201/200; **404** plan/version; **422** `PLAN_VALIDATION_FAILED` (empty change_reason); **409** `PLAN_NOT_EDITABLE` (restore); **500** |
| Procedures writes | 201/200/204; **404**; **409** duplicate code / operation guards (`InvalidPlanOperation` — e.g. activate-already-active, delete-active-procedure — maps to **409** in this module, unlike the doctors module's 400); **422** validation |

> ⚠️ **Procedure write guard statuses differ by exception type.** `InvalidPlanOperation` (e.g. "already inactive" on activate, "active procedure cannot be deleted") maps to **409** in the treatment map (`_TREATMENT_PLAN_EXCEPTION_MAP`), unlike the doctors module where `InvalidDoctorOperation` → 400. See §14 for the exact table.

---

## 5. Request Schema Review

All request models use `model_config = ConfigDict(extra="forbid")` → **unknown body fields → 422**.

### 5.1 `CreatePlanRequest` (POST /treatment-plans)

| Field | Type | Required | Default | Validation / notes |
|---|---|---|---|---|
| `patient_id` | UUID (string) | ✅ | — | Must reference an existing patient row (existence only — **active status is NOT checked**, despite the router description) |
| `doctor_id` | UUID (string) | ✅ | — | Must reference an existing doctor row |
| `clinical_notes` | string \| null | ❌ | `null` | `min_length=1`, `max_length=5000` |
| `observations` | string \| null | ❌ | `null` | `min_length=1`, `max_length=5000` |
| `dentist_recommendations` | string \| null | ❌ | `null` | `min_length=1`, `max_length=5000` |
| `valid_from` | date (`YYYY-MM-DD`) | ❌ | `null` | Must be ≤ `valid_to` when both provided (validated in service → 422) |
| `valid_to` | date | ❌ | `null` | See above |
| `plan_code` | string | ❌ | `null` | `max_length=20`. **Stored verbatim** (no normalize/uppercase/format check — O10). If omitted, backend generates `TXN-XXXXXX` (padded to 6 digits) |

**Example (exact fields, snake_case):**
```json
{
  "patient_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "doctor_id": "6fa86f64-5717-4562-b3fc-2c963f66afa7",
  "clinical_notes": "Patient presents with moderate decay on 16.",
  "observations": null,
  "dentist_recommendations": "Consider RCT.",
  "valid_from": "2026-08-01",
  "valid_to": "2026-12-31",
  "plan_code": "TXN-000042"
}
```

### 5.2 `AddItemRequest` (POST /treatment-plans/{id}/items)

| Field | Type | Required | Default | Validation / notes |
|---|---|---|---|---|
| `procedure_id` | int | ✅ | — | `gt=0`; must reference an **active** procedure (inactive → 409) |
| `sequence_number` | int | ✅ | — | `ge=1`; must be **unique within the plan** (duplicate → 409) |
| `estimated_cost` | Decimal \| null | ❌ | procedure's `default_cost` | `ge=0`, `le=999999.99`, `max_digits=10`, `decimal_places=2` |
| `discount` | Decimal | ❌ | `0.00` | `ge=0`, `max_digits=10`, `decimal_places=2`; must be ≤ `estimated_cost` (validated in service AND DB CHECK `ck_tpi_discount_le_cost`) |
| `tooth_number` | int \| null | ❌ | `null` | Schema: `ge=11`. **Service**: FDI ranges `11–48` or `51–85` (e.g. `49` passes the schema but fails service → 422 `INVALID_TOOTH_NUMBER`) |
| `tooth_surface` | string \| null | ❌ | `null` | `min_length=1`, `max_length=10`. **No format validation** (O8) — surface code semantics (M/D/B/L/O/I, distinct letters) are NOT enforced |
| `quadrant` | enum | ❌ | `null` | `UR` \| `UL` \| `LL` \| `LR` |
| `arch` | enum | ❌ | `null` | `upper` \| `lower` |
| `notes` | string \| null | ❌ | `null` | `min_length=1`, `max_length=5000` |

> **No cross-field validation** between `tooth_number`/`quadrant`/`arch`/`tooth_surface` (e.g. arch `upper` with quadrant `LL` is accepted). The frontend may validate for UX but the backend will not reject it.

**Example:**
```json
{
  "procedure_id": 3,
  "sequence_number": 1,
  "estimated_cost": 15000.00,
  "discount": 0.00,
  "tooth_number": 16,
  "tooth_surface": "MOD",
  "quadrant": "UR",
  "arch": "upper",
  "notes": "Crown on 16."
}
```

### 5.3 `ItemUpdateRequest` (PATCH /treatment-plans/{plan_id}/items/{item_id})

All fields optional; **only provided fields are updated**. Pass `null` to **clear** a nullable field (`tooth_number`, `tooth_surface`, `quadrant`, `arch`). The service uses a `_UNSET` sentinel to distinguish "omitted" from "explicit null".

| Field | Type | Validation |
|---|---|---|
| `procedure_id` | int \| null | `gt=0`; must be active |
| `sequence_number` | int \| null | `ge=1`; unique within plan (excluding self) |
| `estimated_cost` | Decimal \| null | range `0..999999.99` |
| `discount` | Decimal \| null | `ge=0`; ≤ effective estimated cost |
| `tooth_number` | int \| null | **No schema bound** — service validates FDI ranges when provided; `null` clears |
| `tooth_surface` | string \| null | 1–10 chars; `null` clears |
| `quadrant` | enum \| null | `null` clears |
| `arch` | enum \| null | `null` clears |
| `notes` | string \| null | 1–5000; `null` **does NOT clear notes** (notes is set only when not None) |

> ⚠️ **Asymmetry:** `notes: null` is ignored (cannot clear notes via PATCH), while the tooth fields can be cleared with `null`. This is a backend quirk — mirror it or document it; do not "fix" it client-side in a way that changes behavior.

### 5.4 `ReorderItemsRequest` (PUT /treatment-plans/{plan_id}/items/reorder)

| Field | Type | Required | Validation |
|---|---|---|---|
| `item_ids` | array of UUID | ✅ | `min_length=1`; must contain **every** existing item exactly once (missing/extra/duplicate → 409 `PLAN_UPDATE_FAILED` with message "Item list mismatch …") |

Items are assigned `sequence_number = index + 1` in the order given.

### 5.5 `VersionRequest` (POST /treatment-plans/{plan_id}/versions)

| Field | Type | Required | Validation |
|---|---|---|---|
| `change_reason` | string | ✅ | `min_length=1`, `max_length=500`; stripped; stored trimmed |

### 5.6 Procedure requests

**`ProcedureCreate`:**

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| `code` | string | ✅ | 1–20 chars, `[A-Za-z0-9_-]+` (service `_validate_code_format`), **uppercased + stripped by service** |
| `name` | string | ✅ | 1–200 chars, non-empty after strip |
| `default_cost` | Decimal | ✅ | `0..999999.99`, `max_digits=10`, `decimal_places=2` |
| `category` | enum | ✅ | 11 values (§7) — invalid → 422 |
| `description` | string \| null | ❌ | 1–2000 chars |

**`ProcedureUpdate`:** `name?`, `default_cost?`, `category?`, `description?` — **`code` is NOT present (immutable)**; unknown fields → 422.

---

## 6. Response Schema Review

> **Decimal serialization:** `Decimal` fields (`estimated_cost`, `discount`, `default_cost`, `total_estimated_cost`) are serialized by FastAPI/Pydantic as **JSON numbers** (e.g. `15000.0`). Model them as `number` in TypeScript and format with existing currency helpers (`utils/formatting.ts`).

### 6.1 `PaginatedResponse<T>` (every list endpoint)

```json
{ "items": [ ... ], "total": 42, "page": 1, "page_size": 20, "total_pages": 3 }
```
- `total` = count **after filters, before pagination**.
- `total_pages` = `ceil(total / page_size)` (0 when total=0).
- Frontend computes page count from `total_pages` directly (unlike the users module which omits it).

### 6.2 `TreatmentPlanListItem` (list, search, pending-*, by-patient, by-doctor)

| Field | Type | Nullable | Display? | Notes |
|---|---|---|---|---|
| `id` | UUID string | ❌ | key | Route to detail |
| `plan_code` | string | ❌ | ✅ | `TXN-XXXXXX` or custom |
| `patient_id` | UUID | ❌ | indirect | **No patient name in the list item** — frontend must join with patient data client-side (or use `search`'s name matching) |
| `doctor_id` | UUID | ❌ | indirect | Same — no doctor name either |
| `status` | enum string | ❌ | ✅ | See §7 statuses |
| `current_version` | int | ❌ | ✅ | Business version |
| `is_active` | bool | ❌ | — | Always `true` for plans created via API (no deactivate endpoint) |
| `item_count` | int | ❌ | ✅ | Computed from items collection (lazy-loaded) |
| `total_estimated_cost` | number | ❌ | ✅ | Sum of item `estimated_cost` (not reduced by discounts) |
| `created_by` | int \| null | ✅ | audit | |
| `created_at` | datetime ISO 8601 UTC | ❌ | ✅ | |
| `updated_at` | datetime | ❌ | ✅ | |

> **Display gap:** the list payload contains **no patient/doctor names**. The plan detail response also contains only IDs (`patient_id`, `doctor_id`). Patient and doctor names must be resolved from the patient and doctor modules.

### 6.3 `TreatmentPlanResponse` (single plan + all mutation responses)

All `TreatmentPlanListItem` fields **plus**:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `clinical_notes` | string \| null | ✅ | |
| `observations` | string \| null | ✅ | |
| `dentist_recommendations` | string \| null | ✅ | |
| `valid_from` | date \| null | ✅ | |
| `valid_to` | date \| null | ✅ | |
| `items` | `TreatmentPlanItemResponse[]` | — | Ordered by `sequence_number` ascending |
| `approval` | `ApprovalResponse` \| null | ✅ | Always present for plans created via API (created with the plan) |
| `versions` | `VersionListItem[]` | — | Ordered by version number ascending |
| `updated_by` | int \| null | ✅ | Set on every mutation/transition |

### 6.4 `TreatmentPlanItemResponse` (nested in `items`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | ❌ | |
| `plan_id` | UUID | ❌ | |
| `procedure_id` | int | ❌ | |
| `procedure` | `ProcedureSummary` \| null | ✅ | **Nested object** with `id, code, name, category, default_cost, is_active` — display-friendly |
| `sequence_number` | int | ❌ | |
| `tooth_number` | int \| null | ✅ | FDI |
| `tooth_surface` | string \| null | ✅ | |
| `quadrant` | `ToothQuadrant` \| null | ✅ | `UR`/`UL`/`LL`/`LR` |
| `arch` | `ToothArch` \| null | ✅ | `upper`/`lower` |
| `estimated_cost` | number | ❌ | |
| `discount` | number | ❌ | |
| `item_status` | enum | ❌ | Always `"pending"` in practice (O2 — no transition endpoint) |
| `notes` | string \| null | ✅ | |
| `appointment_id` | UUID \| null | ✅ | **Never set via any endpoint** (no field in Add/UpdateItemRequest) — informational only |
| `diagnosis_id` | UUID \| null | ✅ | Same — informational only |

### 6.5 `ApprovalResponse` (nested `approval`)

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | ❌ | |
| `approved_by` | int \| null | ✅ | User id of the approving doctor |
| `approved_at` | datetime \| null | ✅ | |
| `patient_status` | enum | ❌ | `pending` \| `accepted` \| `rejected` \| `changes_requested` (only `pending/accepted/rejected` reachable via API) |
| `patient_acknowledged_at` | datetime \| null | ✅ | |
| `approval_notes` | string \| null | ✅ | **Never set via any endpoint** (no approval-notes input anywhere) |

### 6.6 Version schemas

**`VersionListItem`** (nested in plan `versions` + `VersionListResponse.items`): `id`, `version_number`, `change_reason`, `changed_by` (int), `created_at`.

**`VersionDetailResponse`** (GET version): adds `plan_id` and `items_snapshot` — a raw JSONB object with shape:

```json
{
  "version_number": 2,
  "captured_at": "2026-08-06T12:00:00+00:00",
  "items": [
    {
      "sequence_number": 1,
      "procedure_id": 3,
      "procedure_code": "RCT001",
      "tooth_number": 16,
      "tooth_surface": "MOD",
      "quadrant": "UR",
      "arch": "upper",
      "estimated_cost": "15000.00",   // <-- STRING (Decimal-as-string)
      "discount": "0.00",             // <-- STRING
      "item_status": "pending",
      "notes": null
    }
  ]
}
```
> ⚠️ Inside `items_snapshot`, monetary values are **strings**, unlike the top-level responses where they are numbers. Parse with `Number()` when rendering a restored version diff.

### 6.7 `DashboardSummaryResponse` (GET /treatment-plans/dashboard)

| Field | Type | Notes |
|---|---|---|
| `total_plans` | int | All plans (active + inactive) |
| `by_status` | object | **All 9 status keys always present** (missing → 0): `draft, under_review, proposed, rejected, accepted, in_progress, on_hold, completed, cancelled` |
| `pending_review` | int | = `by_status.under_review` |
| `pending_approval` | int | Proposed plans without signed approval |
| `pending_acknowledgment` | int | **ACCEPTED** plans with `patient_status = pending` (see O7) |
| `active_plans` | int | `is_active = true` |

### 6.8 `ProcedureResponse` / `ProcedureSummary`

| Field | `ProcedureResponse` | `ProcedureSummary` |
|---|---|---|
| `id` (int) | ✅ | ✅ |
| `code` | ✅ | ✅ |
| `name` | ✅ | ✅ |
| `description` | ✅ (null) | ❌ |
| `default_cost` | ✅ (number) | ✅ |
| `category` | ✅ (enum) | ✅ |
| `is_active` | ✅ | ✅ |

### 6.9 Count endpoints

- `GET /treatment-plans/count-by-status` → `{"draft": 12, "proposed": 5, ...}` — **only statuses with ≥1 plan appear** (sparse map, unlike the dashboard which is dense).
- `GET /treatment-plans/count-by-doctor` → no `doctor_id`: `{"<uuid>": 5, ...}` (keys are **string UUIDs**); with `doctor_id`: plain `int`.
- `GET /treatment-plans/count-by-patient` → same pattern with patient UUIDs.
- `GET /procedures/count` → `{"count": 42}`.

---

## 7. Database Model Review

All five models in `backend/app/modules/treatment/models.py`. Status/category columns are `String`-backed `SAEnum(native_enum=False)` guarded by DB `CHECK` constraints; the app enums + state machine are authoritative.

### 7.1 `Procedure` — table `procedures`

| Column | Type | Constraints |
|---|---|---|
| `id` | int | PK, autoincrement |
| `code` | string(20) | **unique**, not null |
| `name` | string(200) | not null |
| `description` | Text | nullable |
| `default_cost` | Numeric(10,2) | not null, default 0.00, CHECK `ck_proc_default_cost` (≥0) |
| `category` | string(30) | not null, CHECK `ck_proc_category` (11 values) |
| `is_active` | bool | not null, default true |

Indexes: `ix_procedures_active (is_active)`, `ix_procedures_category (category)`. **No timestamps, no audit columns.** Hard-delete supported (must be inactive; blocked by FK from items).

### 7.2 `TreatmentPlan` — table `treatment_plans` (aggregate root)

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID | PK, client-generated `uuid4` |
| `plan_code` | string(20) | **unique**, not null |
| `patient_id` | UUID | FK → `patients.id` **ON DELETE RESTRICT**, not null |
| `doctor_id` | UUID | FK → `doctors.id` **ON DELETE RESTRICT**, not null |
| `clinical_notes` / `observations` / `dentist_recommendations` | Text | nullable |
| `valid_from` / `valid_to` | Date | nullable; CHECK `ck_tp_valid_dates` (`valid_from <= valid_to` when both set) |
| `status` | string(20) | not null, default `draft`; CHECK `ck_tp_status` (9 values) |
| `current_version` | int | not null, default 1 |
| `lock_version` | int | not null, default 1; **`version_id_col`** → optimistic concurrency (O9) |
| `is_active` | bool | not null, default true |
| `created_by` | int | FK → `users.id` **ON DELETE SET NULL**, nullable |
| `updated_by` | int | FK → `users.id` SET NULL, nullable |
| `created_at` / `updated_at` | DateTime(timezone=True) | server default `now()`; `updated_at` onupdate `now()` |

Indexes: `ix_tp_patient`, `ix_tp_doctor`, `ix_tp_status`, `ix_tp_active_status (is_active, status)`, `ix_tp_created_at`.

Relationships (all `lazy="selectin"`): `items` (cascade **all, delete-orphan**, passive_deletes, order by sequence), `versions` (cascade all delete-orphan, order by version), `approval` (uselist=False, cascade all delete-orphan), `patient`, `doctor`, `creator` (→ created_by), `updater` (→ updated_by).

**Cascade behavior:** deleting a plan cascades to items/versions/approval; `patients`/`doctors` restrict deletion of a referenced patient/doctor. **No soft-delete endpoint exists** (O3).

### 7.3 `TreatmentPlanItem` — table `treatment_plan_items`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK → `treatment_plans.id` **ON DELETE CASCADE**, not null |
| `procedure_id` | int | FK → `procedures.id` **ON DELETE RESTRICT**, not null |
| `sequence_number` | int | not null; **UNIQUE (plan_id, sequence_number)** `uq_tp_item_sequence` |
| `tooth_number` | int | nullable; CHECK `ck_tpi_tooth_number` (FDI 11–48 or 51–85) |
| `tooth_surface` | string(10) | nullable |
| `quadrant` | string(5) | nullable |
| `arch` | string(10) | nullable |
| `estimated_cost` | Numeric(10,2) | not null, default 0.00; CHECK ≥0 |
| `discount` | Numeric(10,2) | not null, default 0.00; CHECK ≥0 AND `ck_tpi_discount_le_cost` (≤ estimated_cost) |
| `item_status` | string(20) | not null, default `pending`; CHECK `ck_tpi_item_status` (5 values) |
| `notes` | Text | nullable |
| `appointment_id` | UUID | FK → `appointments.id` **SET NULL**, nullable |
| `diagnosis_id` | UUID | FK → `patient_record_diagnoses.id` **SET NULL**, nullable |

Indexes: `ix_tpi_plan`, `ix_tpi_plan_sequence`, `ix_tpi_procedure`, `ix_tpi_status (plan_id, item_status)`, `ix_tpi_appointment`.

### 7.4 `TreatmentPlanVersion` — table `treatment_plan_versions`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK → plans **CASCADE** |
| `version_number` | int | not null; CHECK ≥1 (`ck_tpv_version_number`); **UNIQUE (plan_id, version_number)** |
| `items_snapshot` | JSONB | not null; **immutable after insert** |
| `change_reason` | string(500) | not null |
| `changed_by` | int | FK → `users.id` SET NULL, nullable |
| `created_at` | DateTime(tz) | server default |

### 7.5 `TreatmentPlanApproval` — table `treatment_plan_approvals`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK → plans **CASCADE**, not null, **unique** (1:1) |
| `approved_by` | int | FK → users SET NULL, nullable |
| `approved_at` | DateTime(tz) | nullable |
| `patient_status` | string(20) | not null, default `pending`; CHECK `ck_tpa_patient_status` (4 values) |
| `patient_acknowledged_at` | DateTime(tz) | nullable |
| `approval_notes` | string(500) | nullable |

---

## 8. Repository Layer Review

### 8.1 `TreatmentPlanRepository`

**Reads / queries:**

| Method | Notes |
|---|---|
| `get_by_id`, `get_by_plan_code`, `exists`, `exists_by_plan_code` | Single-row lookups |
| `list(search, patient_id, doctor_id, status, is_active, date_from, date_to, page, page_size, sort_by, sort_order)` | Paginated + filterable. **Patient join only when `search` is provided.** Child entities NOT eager-loaded |
| `search(term, limit)` | `plan_code ILIKE '%term%'` only, ordered `plan_code ASC`, capped |
| `find_by_patient`, `find_by_doctor`, `find_by_status` | Thin wrappers over `list` |
| `find_pending_approval(page, page_size)` | `status = proposed` AND (no approval record OR `approved_by IS NULL`); ordered **`created_at ASC`** (oldest first); `selectinload(approval)` |
| `find_pending_acknowledgment(page, page_size)` | `status = accepted` AND `approval.patient_status = pending`; ordered `created_at ASC`; `selectinload(approval)` |
| `count_by_status` | Group-by status → **sparse** dict, ordered by label |
| `count_by_doctor` / `count_by_patient` | Single count (filter) or grouped dict keyed by **string** UUID |
| `get_with_items`, `get_with_versions`, `get_with_approval`, `get_complete_aggregate` | `selectinload` variants — fixed query count, no N+1 |
| `get_item_plan_id(item_id)` | Owning plan lookup (exists check + metadata in one query) |

**Writes (flush only — never commit):**

| Method | Notes |
|---|---|
| `create(plan)` | add + flush |
| `update(plan, updates)` | Applies only `_ALLOWED_UPDATE_FIELDS = {clinical_notes, observations, dentist_recommendations, valid_from, valid_to, updated_by}` — **status, current_version, plan_code, patient_id, doctor_id are never writable here** (workflow-managed). **Not reachable via any route** (O1) |
| `delete(plan)` | Hard delete, cascades; raises `StaleDataError` on concurrent modification. **Not reachable via any route** (O3) |
| `activate` / `deactivate` | Flip `is_active`. **Not reachable via any route** (O3) |
| `add_item` / `remove_item` / `add_version` / `add_approval` | Child persistence under the plan transaction |
| `version_exists` / `approval_exists` | Existence checks |

**Performance notes:** `selectinload` throughout; no paginated query eager-loads items/versions/approval (the mapper's `item_count`/`total_estimated_cost` trigger lazy `selectin` loads — one extra batched query per page, acceptable). `count_by_doctor`/`count_by_patient` without filter group by a UUID column (fine at clinic scale).

### 8.2 `ProcedureRepository`

| Method | Notes |
|---|---|
| `create` | add + flush |
| `get_by_id`, `get_by_code` (case-insensitive), `get_active_by_id` | Single-row reads |
| `list_active` | All active, ordered `code ASC` (dropdown source) |
| `list(page, page_size, is_active, category, sort_by, sort_order)` | Sort allowlist `{code, name, category, default_cost}`, default `code ASC` |
| `search(term, limit)` | `code` OR `name` ILIKE substring, ordered `code ASC` |
| `exists`, `exists_by_code` | Existence checks |
| `update` | Applies `{name, description, default_cost, category, is_active}` — **`code` and `id` immutable** |
| `activate` / `deactivate` | Flip `is_active` (deactivate is idempotent) |
| `delete` | Hard delete; FK `ON DELETE RESTRICT` from `treatment_plan_items` blocks if referenced |
| `count(is_active?)` | Optional filter |

---

## 9. Service Layer Review

### 9.1 Transaction model

- **The service owns the transaction**: `commit()` on success; `rollback()` + re-raise on `IntegrityError`/`SQLAlchemyError`.
- Domain exceptions (e.g. `PlanNotFound`) raised mid-flow are re-raised after a defensive rollback.
- `StaleDataError` (optimistic-lock conflict) is a `SQLAlchemyError` → wrapped as `PlanUpdateFailed` → **500** (O9). The frontend cannot distinguish "someone else edited this" from a server error; keep edit forms single-user or surface a generic retry message.

### 9.2 Creation flow (`create_plan`)

1. Patient exists (`db.get(Patient)`) → else **404** (patients module).
2. Doctor exists (`db.get(Doctor)`) → else **404** (doctors module).
3. `validate_date_range` → **422** if `valid_from > valid_to`.
4. Resolve `plan_code`: explicit code (uniqueness-checked → **409**) or auto-generated `TXN-` + `max(existing)+1`, zero-padded to 6 (e.g. `TXN-000001`).
5. Build `TreatmentPlan` (status `draft`, `current_version=1`, `is_active=true`, `created_by=current_user.id`).
6. Attach `TreatmentPlanApproval(patient_status=pending)` and `TreatmentPlanVersion(version_number=1, items_snapshot={}, change_reason="Initial plan creation")`.
7. Persist + commit → **201** with full aggregate.

### 9.3 Item flows (`add_item`, `update_item`, `remove_item`, `reorder_items`)

All four: load plan **with items** → `validate_editable` (**draft / under_review / proposed** only, else 409 `PLAN_NOT_EDITABLE`) → validate → mutate → commit.

- **add**: procedure must be **active** (missing → 404, inactive → 409); cost defaults to procedure's `default_cost`; sequence unique → 409; FDI tooth → 422; cost/discount bounds → 422; discount ≤ cost → 422. New items always `item_status=pending`.
- **update**: partial; resolves "current + delta" for cross-field checks; sequence uniqueness excludes self; `_UNSET` sentinel handles null-clears (§5.3).
- **remove**: detaches + deletes; recalcs totals.
- **reorder**: list must match the plan's items exactly once; assigns 1..n.

> Totals are **computed on demand** (`_recalculate_totals` returns `total_estimated_cost`, `total_discount`, `net_total`); only the first is surfaced (list item `total_estimated_cost`). No totals are persisted on the plan row.

### 9.4 Status transition flow (shared `_transition_plan`)

Load plan (with items if `needs_items`) → `validate_transition(plan, target)`:
1. `state_machine.validate_plan_transition` — pure legality per `PLAN_TRANSITIONS`; illegal → 409 `INVALID_PLAN_OPERATION`.
2. Business condition: transitions to `under_review` or `in_progress` require **≥ 1 item** → else 409.

Then `plan.status = target`, `plan.updated_by = actor`, commit.

| Endpoint → transition | Business condition |
|---|---|
| submit-for-review | needs ≥1 item |
| start-treatment | needs ≥1 item |
| approve-review / reject-review / accept / decline / cancel / hold / resume / complete | none beyond legality |

### 9.5 Approval workflow

- **doctor_approve**: PROPOSED + not already signed → sets `approved_by`, `approved_at` (UTC now). **Does NOT change plan status.** Already signed → 409 `PLAN_ALREADY_APPROVED`; not PROPOSED → 409.
- **doctor_revoke**: PROPOSED + must be signed → clears `approved_by`/`approved_at`, sets `updated_by`. (Does **not** reset `patient_status` — if the patient had already acknowledged, a revoke leaves `patient_status=accepted` while the doctor signature is gone — edge case, see Risks.)
- **patient_acknowledge**: PROPOSED + doctor-signed + `patient_status == pending` → sets `patient_status=accepted`, `patient_acknowledged_at`. Already acted → 409 `PATIENT_ACKNOWLEDGMENT_EXISTS`. **Does NOT change plan status.**
- **patient_decline**: PROPOSED + doctor-signed + not already acted → `patient_status=rejected`, timestamp set.

**Ordering contract:** doctor-approve → patient-acknowledge → accept. Calling `accept` before patient acknowledgment is allowed and produces an `ACCEPTED` plan with `patient_status=pending` (see O7).

### 9.6 Version flows

- **create_version**: load complete aggregate → validate `change_reason` (non-empty, ≤500 → else 422) → snapshot current items → next version = `max(existing)+1` → new `TreatmentPlanVersion` + `plan.current_version` increment. **No status check — allowed in any status** (O11).
- **restore_version**: load aggregate → **must be editable** (else 409) → locate version (else 404) → **clear all items** → rebuild from snapshot (Decimals parsed from strings, statuses re-hydrated) → create a new "Restored from version N" snapshot → commit. The target snapshot is never modified.
- **get_version / list_versions**: read-only; scoped to `plan_id`.

### 9.7 Sequence diagram — full lifecycle

```
FE                    Router/Service                     DB
│  POST /treatment-plans {patient_id, doctor_id}          │
│ ───────────────────────▶ create (DRAFT + approval + v1) │
│ ◀─────────────────────── 201 TreatmentPlanResponse      │
│  POST /{id}/items {procedure_id, seq}                   │
│ ───────────────────────▶ validate editable → add item   │
│ ◀─────────────────────── 201 plan with item             │
│  POST /{id}/submit-for-review                           │
│ ───────────────────────▶ needs items → DRAFT→UNDER_REVIEW│
│  POST /{id}/approve-review ──▶ UNDER_REVIEW→PROPOSED    │
│  POST /{id}/doctor-approve ──▶ approval.approved_by set │
│  POST /{id}/patient-acknowledge ──▶ patient_status=accepted│
│  POST /{id}/accept ──▶ PROPOSED→ACCEPTED                │
│  POST /{id}/start-treatment ──▶ needs items → IN_PROGRESS│
│  POST /{id}/versions {change_reason} ──▶ snapshot v2    │
│  POST /{id}/complete ──▶ COMPLETED (terminal)           │
```

---

## 10. Validator Review

All rules enforced by `TreatmentPlanValidator` / `ProcedureValidator` / `state_machine.py`.

| Rule | Validator | Enforced where | Error → status |
|---|---|---|---|
| Plan exists | `validate_plan_exists` | service | `PLAN_NOT_FOUND` → 404 |
| Patient / doctor exist | service (direct `db.get`) | create | Patient/Doctor module 404 |
| Date range `valid_from ≤ valid_to` | `validate_date_range` | create | `INVALID_DATE_RANGE` → 422 |
| Plan code unique | `validate_plan_code_unique` | create (explicit code) | `DUPLICATE_PLAN` → 409 |
| Editable status guard (items) | `validate_editable` | add/update/remove/reorder/restore | `PLAN_NOT_EDITABLE` → 409 |
| Procedure exists **and active** | `validate_procedure_exists` | add/update item | missing → `PROCEDURE_NOT_FOUND` → 404; inactive → 409 |
| FDI tooth number (11–48, 51–85) | `validate_tooth_number` | add/update item | `INVALID_TOOTH_NUMBER` → 422 |
| Cost range 0–999999.99 | `validate_item_cost` | add/update item, procedure create/update | `PLAN_VALIDATION_FAILED` → 422 |
| Discount ≥ 0 and ≤ cost | `validate_discount` | add/update item | 422 |
| Sequence unique per plan | `validate_item_sequence` | add/update item | `DUPLICATE_ITEM_SEQUENCE` → 409 |
| Plan transition legality | `state_machine.validate_plan_transition` | all transitions | `INVALID_PLAN_OPERATION` → 409 |
| ≥1 item for submit/start | `validate_plan_has_items` | submit, start | 409 |
| Item transition legality | `state_machine.validate_item_transition` | **no endpoint** (O2) | — |
| Change reason non-empty ≤500 | `validate_change_reason` | create_version | 422 |
| Status == PROPOSED | `validate_status_is` | doctor-approve/revoke, patient ack/decline | 409 |
| Not already doctor-signed | `validate_not_already_approved` | doctor-approve | `PLAN_ALREADY_APPROVED` → 409 |
| Doctor must be signed | `validate_doctor_approved` | patient ack/decline, doctor-revoke | 409 |
| Patient not already acted | `validate_not_already_acknowledged` | patient ack/decline | `PATIENT_ACKNOWLEDGMENT_EXISTS` → 409 |
| Only draft plans deletable | `validate_deletable` | **no endpoint** (O3) | — |
| Procedure code format `[A-Za-z0-9_-]+` ≤20 | `_validate_code_format` | procedure create/update | 422 |
| Procedure name non-empty ≤200 | `_validate_name` | procedure create/update | 422 |
| Procedure category valid | `_validate_category` | procedure create/update | 422 |
| Procedure code unique (case-insensitive) | `validate_unique_code` | procedure create/update | `DUPLICATE_PROCEDURE` → 409 |
| Procedure must be inactive to delete | `validate_deletable` | delete procedure | 409 |
| Procedure must be active to activate | `validate_active` | activate | 409 |

**Not validated anywhere (backend gaps the frontend must be aware of):**
- `tooth_surface` format (O8) — accepted as any 1–10 char string.
- Quadrant/arch/tooth-number cross-consistency.
- Patient `is_active` on plan creation (existence only).
- Item `appointment_id`/`diagnosis_id` linkage — not settable via API.
- `plan_code` format for custom codes (O10).

---

## 11. Workflow / State Machine

### 11.1 Plan states (single source of truth: `PLAN_TRANSITIONS` in `constants.py`)

```
                          ┌────────────┐
        ┌───────────▲─────│   DRAFT    │
        │           │     └─────┬──────┘
        │ reject-review        │ submit-for-review (≥1 item)
        │ (under_review→draft) ▼
        │           │     ┌─────────────┐
        │           │     │ UNDER_REVIEW │
        │           │     └─────┬───────┘
        │           │           │ approve-review
        │           │           ▼
        │           │     ┌─────────────┐
        │           │     │  PROPOSED   │──accept──▶ ACCEPTED ──start(≥1 item)──▶ IN_PROGRESS ──complete──▶ COMPLETED
        │           │     └─────┬───────┘               │                            │  ▲
        │           │           │ decline               │                            │  │ resume
        │           │           ▼                       │                            ▼  │
        │           │     ┌──────────┐                  │                         ┌────────┐
        │           │     │ REJECTED │                  │                         │ ON_HOLD │
        │           │     └────┬─────┘                  │                         └────────┘
        │           │          │                        │
        │           └──────────┘                        └─────────── cancel (any non-terminal) ───▶ CANCELLED
        └───────────────────────────────────────────────┘
```

**Exact legal transitions (from `PLAN_TRANSITIONS`):**

| From | To (allowed) |
|---|---|
| `draft` | `under_review`, `cancelled` |
| `under_review` | `proposed`, `draft`, `cancelled` |
| `proposed` | `accepted`, `draft`, `cancelled`, `rejected` |
| `rejected` | `draft`, `cancelled` |
| `accepted` | `in_progress`, `cancelled` |
| `in_progress` | `on_hold`, `completed`, `cancelled` |
| `on_hold` | `in_progress`, `completed`, `cancelled` |
| `completed` | *(terminal — none)* |
| `cancelled` | *(terminal — none)* |

**Endpoint coverage of legal transitions:**

| Legal transition | Exposed endpoint? |
|---|---|
| draft → under_review | ✅ submit-for-review |
| under_review → proposed | ✅ approve-review |
| under_review → draft | ✅ reject-review |
| proposed → accepted | ✅ accept |
| proposed → rejected | ✅ decline |
| any non-terminal → cancelled | ✅ cancel |
| accepted → in_progress | ✅ start-treatment |
| in_progress → on_hold | ✅ hold |
| on_hold → in_progress | ✅ resume |
| in_progress/on_hold → completed | ✅ complete |
| **proposed → draft** | ❌ **No endpoint** |
| **rejected → draft** | ❌ **No endpoint** |

> ⚠️ **UI consequence (O12):** once a plan reaches `proposed` or `rejected` it can **never return to `draft`** via the API. Because items are still editable in `proposed`, the frontend should treat "edit in place" as the correction path rather than "back to draft". Do not render a "return to draft" action for these statuses.

### 11.2 Item states (`ITEM_TRANSITIONS`)

| From | To (allowed) | Exposed endpoint? |
|---|---|---|
| `pending` | `in_progress`, `cancelled`, `deferred` | ❌ none |
| `in_progress` | `completed`, `cancelled`, `deferred` | ❌ none |
| `deferred` | `pending`, `cancelled` | ❌ none |
| `completed` | *(terminal)* | ❌ |
| `cancelled` | *(terminal)* | ❌ |

**Items always read `pending`** in API responses (O2). Any UI suggesting item progress must be disabled or informational.

### 11.3 Service enforcement & rollback

- All transitions go through the single `_transition_plan` helper → impossible to bypass the state machine.
- Failures roll back the transaction (service-level `rollback()`).
- `lock_version` bumps on every UPDATE; concurrent writers get `StaleDataError` → 500 (O9).

---

## 12. Authentication & RBAC

### 12.1 Authentication (verified — `backend/app/dependencies/auth.py`)

- **Scheme:** `Authorization: Bearer <JWT>`; token URL declared as `/auth/login` (`OAuth2PasswordBearer`).
- Token: HS256, `sub` = **user email**, `exp` (default 30 min), `iat`, `jti`, `token_type="access"`. Non-`access` `token_type` rejected.
- `get_current_user`: decodes → looks up user by email (role eager-loaded) → **rejects missing or `is_active=false` users with 401** "Could not validate credentials" (deactivated users lose access instantly).
- Missing token → 401 "Not authenticated".

### 12.2 Authorization (verified — `rbac/permissions.py`)

| Dependency | Allows | 403 detail |
|---|---|---|
| `require_roles([ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR])` | All treatment-plan endpoints + all procedure reads | `"Role not assigned"` (no role) / `"Insufficient permissions"` (wrong role) |
| `require_admin` (= `{ADMIN, CHIEF_DOCTOR}`) | `POST/PATCH/DELETE /procedures*` (write ops) | same |

### 12.3 What the code does NOT enforce (do not implement client-side as if it did)

- ❌ **No ownership / doctor-scoping**: any allowed role acts on any plan.
- ❌ **No "creator only" edits**: e.g. a receptionist can submit a doctor's plan for review.
- ❌ **No role-specific workflow**: `doctor-approve` is callable by receptionists (the name is aspirational; no doctor-role check).
- ❌ **No patient-facing endpoints**: patients cannot acknowledge plans themselves; a staff user acts on their behalf.

**Frontend implications:** use `PermissionGate`/`RequireRole` only for **procedure write buttons** (admin-only) and **navigation**; gate plan actions by **plan status** (state machine), not by user role. `DENTAL_ASSISTANT` sees no treatment/procedure data.

---

## 13. Search / Filter / Pagination Review

| Concern | Treatment plans | Procedures |
|---|---|---|
| **Searchable fields (list `search`)** | `plan_code`, patient `first_name`, patient `last_name` (case-insensitive substring; patient join only when present) | — (no `search` param on list) |
| **Searchable fields (`/search`)** | `plan_code` only | `code`, `name` |
| **Filterable** | `patient_id`, `doctor_id`, `status` (enum → invalid = 422), `is_active`, `date_from`, `date_to` (on `created_at`) | `is_active`, `category` (enum → invalid = 422) |
| **Sortable** | `created_at`, `updated_at`, `status`, `plan_code` (unknown → silently `created_at`) | `code`, `name`, `category`, `default_cost` (unknown → silently `code`) |
| **Default ordering** | `created_at DESC` | `code ASC` |
| **Pagination** | `page` (≥1, default 1), `page_size` (1–100, default 20); response includes `total_pages` | same |
| **Special queues** | pending-review = status `under_review`; pending-approval = `proposed` + unsigned; ordered `created_at ASC` (oldest first) | — |
| **Limits** | search `limit` 1–50 (default 20); no filters on `/search` | search `limit` 1–50 (default 20); `/active` returns all active |
| **Date parsing** | router `date.fromisoformat` — invalid → **500** (O6) | — |

---

## 14. Error Handling Review

### 14.1 The real envelope (verified — `core/exception_handlers.py`)

**Every** error — domain exception, `HTTPException`, Pydantic 422, unhandled 500 — returns:

```json
{
  "success": false,
  "message": "<human-readable string>",
  "details": null | array | object
}
```

- 422 → `details` = Pydantic v2 error array `[{"loc": ["body","estimated_cost"], "msg": "...", "type": "..."}]` — compatible with the existing `parseApiError` (`apiError.ts`).
- **Error codes are NOT in the response** (O4). The `code` attributes and the `schemas/errors.py` `{error:{code,...}}` DTOs are dead code. **Branch on HTTP status, display `message` verbatim.**

### 14.2 Status-code reference for the treatment module (verified `_TREATMENT_PLAN_EXCEPTION_MAP`)

| Status | Raised by | `message` examples |
|---|---|---|
| **404** | `PlanNotFound`, `ItemNotFound`, `ProcedureNotFound`, `VersionNotFound`, `ApprovalNotFound` (+ patient/doctor not-found from other modules) | "Treatment plan not found: …", "Procedure not found: …", "Patient not found", "Doctor … not found" |
| **409** | `InvalidPlanOperation`, `PlanNotEditable`, `DuplicatePlanDetected`, `DuplicateItemSequence`, `DuplicateProcedureDetected`, `PlanAlreadyApproved`, `PatientAcknowledgmentExists` (plus `EmptyPlanTransition`, `PlanNotDeletable`, `InvalidItemStatusTransition`, `VersionImmutable` — **mapped to 409 but not raised by any current endpoint**; dead exceptions) | "Cannot transition treatment plan from 'draft' to 'accepted'. …", "Treatment plan is not editable in status 'accepted'", "An item with sequence 1 already exists…" |
| **422** | `PlanValidationFailed`, `InvalidToothNumber`, `InvalidDateRange` + all Pydantic schema/param validation | "Invalid tooth number: must be in FDI range (11-48, 51-85)", "valid_from must precede valid_to", "Request validation failed" |
| **500** | `PlanCreationFailed`, `PlanUpdateFailed`, stale-lock `StaleDataError` wrapper, unhandled `ValueError` from date parsing | "Failed to update item … in plan …", "An unexpected error occurred" |

**Global statuses:** 401 (auth), 403 (`"Role not assigned"` / `"Insufficient permissions"`), 500 (unhandled). Procedure writes reuse the same map (`InvalidPlanOperation` on already-inactive activate → 409; delete-active → 409).

### 14.3 Frontend handling rules

- Reuse `parseApiError` + one `Alert`/toast for all mutations; show `message` as-is (backend strings are user-ready).
- 401 → existing global interceptor handles session expiry (except `/auth/login`).
- 403 → existing `apiErrorMessage` path; treat as permission denial.
- 409 → keep dialogs open and surface inline (duplicate sequence, not-editable, already-approved, already-acknowledged).
- 422 → map `details` array to `fieldErrors` (existing behavior).
- 500 (including concurrency) → generic retry message; **do not attempt to distinguish**.

---

## 15. Frontend Contract

### 15.1 Types (`src/types/treatmentPlan.ts` + `src/types/procedure.ts`)

```ts
// ── Enums (string unions — mirror backend exactly) ──────────────────
export type TreatmentPlanStatus =
  | 'draft' | 'under_review' | 'proposed' | 'rejected' | 'accepted'
  | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export type TreatmentPlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';
export type PatientAcknowledgmentStatus = 'pending' | 'accepted' | 'rejected' | 'changes_requested';
export type ProcedureCategory =
  | 'diagnostic' | 'preventive' | 'restorative' | 'endodontic' | 'periodontic'
  | 'prosthodontic' | 'oral_surgery' | 'orthodontic' | 'cosmetic' | 'implant' | 'other';
export type ToothQuadrant = 'UR' | 'UL' | 'LL' | 'LR';
export type ToothArch = 'upper' | 'lower';

// ── Pagination (shared) ─────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]; total: number; page: number; page_size: number; total_pages: number;
}

// ── Procedure catalog ───────────────────────────────────────────────
export interface ProcedureSummary {
  id: number; code: string; name: string;
  category: ProcedureCategory; default_cost: number; is_active: boolean;
}
export interface ProcedureResponse extends ProcedureSummary { description: string | null; }
export interface ProcedureCreateRequest {
  code: string; name: string; default_cost: number; category: ProcedureCategory;
  description?: string | null;
}
export interface ProcedureUpdateRequest {
  name?: string; default_cost?: number; category?: ProcedureCategory; description?: string | null;
}

// ── Treatment plan ──────────────────────────────────────────────────
export interface TreatmentPlanListItem {
  id: string; plan_code: string; patient_id: string; doctor_id: string;
  status: TreatmentPlanStatus; current_version: number; is_active: boolean;
  item_count: number; total_estimated_cost: number;
  created_by: number | null; created_at: string; updated_at: string;
}
export interface TreatmentPlanItemResponse {
  id: string; plan_id: string; procedure_id: number; procedure: ProcedureSummary | null;
  sequence_number: number; tooth_number: number | null; tooth_surface: string | null;
  quadrant: ToothQuadrant | null; arch: ToothArch | null;
  estimated_cost: number; discount: number; item_status: TreatmentPlanItemStatus;
  notes: string | null; appointment_id: string | null; diagnosis_id: string | null;
}
export interface ApprovalResponse {
  id: string; approved_by: number | null; approved_at: string | null;
  patient_status: PatientAcknowledgmentStatus; patient_acknowledged_at: string | null;
  approval_notes: string | null;
}
export interface VersionListItem {
  id: string; version_number: number; change_reason: string; changed_by: number; created_at: string;
}
export interface TreatmentPlanResponse {
  id: string; plan_code: string; patient_id: string; doctor_id: string;
  clinical_notes: string | null; observations: string | null; dentist_recommendations: string | null;
  valid_from: string | null; valid_to: string | null;
  status: TreatmentPlanStatus; current_version: number; is_active: boolean;
  items: TreatmentPlanItemResponse[]; approval: ApprovalResponse | null; versions: VersionListItem[];
  created_by: number | null; updated_by: number | null; created_at: string; updated_at: string;
}
export interface VersionDetailResponse extends VersionListItem {
  plan_id: string;
  items_snapshot: {
    version_number: number; captured_at: string;
    items: Array<{
      sequence_number: number; procedure_id: number; procedure_code: string;
      tooth_number: number | null; tooth_surface: string | null;
      quadrant: ToothQuadrant | null; arch: ToothArch | null;
      estimated_cost: string; discount: string; item_status: TreatmentPlanItemStatus; notes: string | null;
    }>;
  };
}
export interface DashboardSummaryResponse {
  total_plans: number;
  by_status: Record<TreatmentPlanStatus, number>;   // all 9 keys always present
  pending_review: number; pending_approval: number;
  pending_acknowledgment: number; active_plans: number;
}

// ── Requests (mirror §5 exactly) ────────────────────────────────────
export interface CreatePlanRequest {
  patient_id: string; doctor_id: string;
  clinical_notes?: string | null; observations?: string | null; dentist_recommendations?: string | null;
  valid_from?: string | null; valid_to?: string | null; plan_code?: string | null;
}
export interface AddItemRequest {
  procedure_id: number; sequence_number: number;
  estimated_cost?: number | null; discount?: number;
  tooth_number?: number | null; tooth_surface?: string | null;
  quadrant?: ToothQuadrant | null; arch?: ToothArch | null; notes?: string | null;
}
export interface ItemUpdateRequest {
  procedure_id?: number; sequence_number?: number; estimated_cost?: number | null; discount?: number;
  tooth_number?: number | null; tooth_surface?: string | null;
  quadrant?: ToothQuadrant | null; arch?: ToothArch | null; notes?: string | null;
}
export interface ReorderItemsRequest { item_ids: string[]; }       // min 1
export interface VersionRequest { change_reason: string; }          // 1–500

// ── Query params ────────────────────────────────────────────────────
export interface PlanListParams {
  search?: string; patient_id?: string; doctor_id?: string;
  status?: TreatmentPlanStatus; is_active?: boolean;
  date_from?: string; date_to?: string;              // YYYY-MM-DD only!
  page?: number; page_size?: number; sort_by?: 'created_at' | 'updated_at' | 'status' | 'plan_code';
  sort_order?: 'asc' | 'desc';
}
export interface ProcedureListParams {
  page?: number; page_size?: number; is_active?: boolean; category?: ProcedureCategory;
  sort_by?: 'code' | 'name' | 'category' | 'default_cost'; sort_order?: 'asc' | 'desc';
}
```

> **UI-form types** (`PlanFormValues`, `ItemFormValues`, etc.) should follow the existing pattern (presentational, transformed in `*FormUtils.ts` before calling services).

### 15.2 Services (`src/services/treatmentPlanService.ts`, `procedureService.ts`)

`treatmentPlanService` (all return typed promises; attach Bearer via `api`):

| Method | Call |
|---|---|
| `createPlan(payload)` | `POST /treatment-plans` |
| `listPlans(params)` | `GET /treatment-plans` |
| `searchPlans(term, limit?)` | `GET /treatment-plans/search` |
| `listPendingReview(page?, pageSize?)` | `GET /treatment-plans/pending-review` |
| `listPendingApproval(page?, pageSize?)` | `GET /treatment-plans/pending-approval` |
| `getDashboard()` | `GET /treatment-plans/dashboard` |
| `listByPatient(patientId, params?)` | `GET /treatment-plans/by-patient/{id}` |
| `listByDoctor(doctorId, params?)` | `GET /treatment-plans/by-doctor/{id}` |
| `countByStatus()` / `countByDoctor(doctorId?)` / `countByPatient(patientId?)` | corresponding `count-by-*` |
| `getPlan(id)` | `GET /treatment-plans/{id}` |
| `addItem(id, payload)` / `updateItem(id, itemId, payload)` / `removeItem(id, itemId)` | item CRUD |
| `reorderItems(id, itemIds)` | `PUT /treatment-plans/{id}/items/reorder` |
| `submitForReview / approveReview / rejectReview / acceptPlan / declinePlan / cancelPlan / startTreatment / putOnHold / resume / complete(id)` | 10 transition posts (no body) |
| `doctorApprove / doctorRevoke / patientAcknowledge / patientDecline(id)` | 4 approval posts |
| `createVersion(id, changeReason)` / `listVersions(id)` / `getVersion(id, versionId)` / `restoreVersion(id, versionId)` | version endpoints |

`procedureService`:

| Method | Call |
|---|---|
| `listProcedures(params)` / `searchProcedures(term, limit?)` / `listActiveProcedures()` / `countProcedures(isActive?)` | reads |
| `getProcedure(id)` / `getProcedureByCode(code)` | single reads |
| `createProcedure(payload)` / `updateProcedure(id, payload)` / `activateProcedure(id)` / `deactivateProcedure(id)` / `deleteProcedure(id)` | admin writes (delete → 204) |

### 15.3 Hooks (React Query, `src/hooks/treatmentPlans/`, `src/hooks/procedures/`)

| Hook | Keys / notes |
|---|---|
| `useTreatmentPlans(params)` | list + filters (query key includes params) |
| `useTreatmentPlan(id)` | detail (disabled when no id) |
| `useTreatmentPlanSearch(term)` | debounced search (reuse `useDebounce`) |
| `useTreatmentPlanFilters()` | filter state (mirror `usePatientFilters` / `useAppointmentFilters`) |
| `useTreatmentPlanMutations()` | all 20+ mutations; invalidate `['treatment-plans']`, plan detail, dashboard |
| `useDashboardSummary()` | dashboard stats |
| `useProcedures(params)` / `useProcedureSearch(term)` / `useProcedure(id)` / `useProcedureMutations()` | procedure catalog (mutations invalidate `['procedures']`) |

### 15.4 Components / pages / dialogs / forms / tables (expected surface)

**Pages** — `TreatmentPlanListPage`, `TreatmentPlanDetailsPage`, `ProcedureListPage` (admin catalog). Route metadata added to `routes/routeMeta.ts` + `AppRouter`.

**List page:**
- `TreatmentPlanToolbar` (SearchBar + filters: status select, patient, doctor, date range, is_active) — reuse `DataTableToolbar`.
- `TreatmentPlanTable` columns: `plan_code` (link), patient name (resolved from patient module), doctor name, `status` (StatusBadge), `current_version`, `item_count`, `total_estimated_cost`, `created_at`, actions (view / transition menu).
- `Pagination` bound to `total_pages`.
- Filters state + query via `useTreatmentPlanFilters` / `useTreatmentPlans`.
- "Create Plan" button (disabled unless a patient+doctor can be chosen).

**Detail page:**
- Header: `PageHeader` (plan_code, StatusBadge, version chip, validity dates, is_active).
- `PatientInfoCard`-style sections (patient + doctor resolved by ID).
- `Section`s: Clinical Notes / Observations / Dentist Recommendations / Validity.
- `TreatmentPlanItemsTable` (sequence, procedure name+code, tooth/surface/quadrant/arch, estimated_cost, discount, notes, actions when editable).
- `ApprovalCard` (doctor signature + timestamp, patient status + timestamp).
- `VersionTimeline` (versions + "restore" action when editable).
- **Contextual action bar** driven by the state machine (§11.1) — show only legal actions for current status.

**Dialogs / drawers:**
- `CreatePlanDialog` (patient picker, doctor picker, notes, dates, optional code) — reuse `Modal` + `Form/*` + existing `PatientPicker`/`DoctorPicker`-style selects.
- `AddItemDialog` / `UpdateItemDialog` (procedure select from `/procedures/active` or search, sequence, cost, discount, tooth fields, notes).
- `ReorderItemsDialog` (drag-list or up/down controls → `ReorderItemsRequest`).
- `ConfirmTransitionDialog` (generic, one per transition action with the backend 409 surface).
- `CancelPlanDialog`, `CreateVersionDialog` (change_reason textarea), `RestoreVersionDialog` (warning: replaces all items).
- `DoctorApproveDialog` / `PatientAcknowledgeDialog` (confirmation + notes n/a).
- `ProcedureFormDialog` (admin create/edit; **code disabled when editing**), `DeleteProcedureDialog` (confirm + "must be inactive" hint), `ProcedureStatusDialog` (activate/deactivate).

**Forms:** `createPlanSchema`, `addItemSchema`, `updateItemSchema` (mirror §5 bounds; `tooth_number` Zod should enforce FDI ranges — backend will too), `versionSchema` (1–500), `procedureSchema` (code regex `[A-Za-z0-9_-]`, cost bounds, category enum).

**Dashboard cards** (backend-supported): total plans, status breakdown (9 badges), pending review, pending approval, pending acknowledgment, active plans — from `getDashboard()`. ⚠️ Only render "pending acknowledgment" as a **count card**; do not link to an actionable queue (O7 — those plans cannot be acted on).

### 15.5 State-machine helper

Create `utils/treatmentPlanStateMachine.ts` exporting `ALLOWED_PLAN_TRANSITIONS` (hardcoded from §11.1), `isEditableStatus(status)`, `terminalStatuses()`, `planActionsForStatus(status)` mapping each status → the endpoint method names the UI may offer. This is required because the backend exposes no transition-query endpoint (O5).

---

## 16. Reuse Opportunities

**Do not introduce new patterns.** The existing frontend library already covers everything:

| Need | Reuse |
|---|---|
| Tables | `components/common/DataTable/` (+ `DataTableToolbar`) — pattern from appointments/doctors/users |
| Pagination | `components/common/Pagination/` (bind to `total_pages`) |
| Search | `components/common/SearchBar/` + `hooks/useDebounce` |
| Drawers / modals | `components/common/Drawer/`, `components/common/Modal/` (focus trap, `role="alert"` errors) |
| Forms | `components/common/Form/*` (`Form`, `FormField`, `Label`, `HelperText`, `ErrorMessage`, `FormActions`, `ValidationSummary`), `Input/*` (`Input`, `Select`, `Textarea`, `DatePicker`, `MultiSelect`) |
| Badges | `components/common/StatusBadge/` (status → color map) |
| States | `EmptyState`, `LoadingOverlay`, `Skeleton`, `Spinner`, `ResultState` |
| Dashboard | `StatCard`, `Card`, `Section` |
| Detail layout | `PageHeader`, `PageContainer`, `DescriptionList`, `Tabs`, `Timeline`, `Stack`, `Grid` |
| Feedback | `Toast`, `Alert`, `InlineMessage` |
| RBAC | `PermissionGate`, `RequireRole`, `usePermission`, `useCurrentUserRole` (only for procedure writes + navigation) |
| API client | `services/api.ts` (axios, Bearer, 401 interceptor) |
| Errors | `services/apiError.ts` (`parseApiError`, `apiErrorMessage`) — matches the `{success,message,details}` envelope |
| Validation | shared Zod conventions (`utils/*FormSchema.ts`), `utils/validation.ts` |
| Formatting | `utils/formatting.ts` (currency for costs), `utils/date.ts` (ISO dates) |
| Patient/doctor pickers | existing `PatientPicker`, user-search selects, doctor lists |
| Filter state pattern | `usePatientFilters`, `useAppointmentFilters` as templates for `useTreatmentPlanFilters` |

---

## 17. Risks & Limitations

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low

| ID | Risk | Sev | Detail (verified) | Frontend action |
|---|---|---|---|---|
| **R1** | Plan header immutable after creation | 🔴 | No PATCH `/treatment-plans/{id}`; repo supports it but no service/route. `clinical_notes`, `observations`, `dentist_recommendations`, `valid_from`, `valid_to` cannot change post-create (O1) | Create form must be complete at creation. Do not render an "edit plan details" form. |
| **R2** | Item status not changeable | 🔴 | No item-transition endpoint; `item_status` always `pending` (O2) | Do not build item progress controls; display status read-only. |
| **R3** | No plan delete/archive | 🟠 | No `DELETE /treatment-plans/{id}` or activate/deactivate routes (O3) | Do not offer delete/deactivate actions on plans. |
| **R4** | Error codes stripped; dead `{error}` envelope | 🟠 | Real envelope is `{success,message,details}`; `schemas/errors.py` DTOs unused (O4) | Branch on status; reuse `parseApiError`. |
| **R5** | Invalid date params → 500 | 🟠 | `date.fromisoformat` ValueError → unhandled 500 (O6) | Frontend must send valid `YYYY-MM-DD`; constrain DatePickers; surface generic 500 otherwise. |
| **R6** | Pending-acknowledgment queue is stuck | 🟡 | Dashboard counts `ACCEPTED`+pending, but acknowledge requires `PROPOSED` (O7) | Render count only, no actionable list; or surface as informational. |
| **R7** | No way back to draft from proposed/rejected | 🟡 | Legal transitions exist but no endpoints (O12) | Render edit-in-place for proposed; hide "back to draft". |
| **R8** | Concurrency conflicts → 500 | 🟡 | `StaleDataError` wrapped as `PlanUpdateFailed` 500 (O9) | Single-user edit flows; generic retry message; consider refresh-on-conflict UX. |
| **R9** | No allowed-transitions endpoint | 🟡 | `StatusTransition`/`get_allowed_transitions` not wired (O5) | Hardcode state machine in `utils/` (single source in frontend). |
| **R10** | List/detail carry no patient/doctor names | 🟡 | Only IDs in responses | Resolve names via patient/doctor services (parallel fetches or joins). |
| **R11** | Versioning mostly unusable in active statuses | 🟡 | Items not editable outside draft/under_review/proposed, and restore requires editable status; `create_version` works in any status but can't be followed by edits (O11) | Gate "create version"/"restore" to editable statuses; treat versions as audit history in active statuses. |
| **R12** | `tooth_surface` unvalidated; quadrant/arch/tooth cross-checks absent | 🔵 | No runtime format validation (O8) | Frontend may validate surface combos (M/D/B/L/O/I, distinct) and consistency for UX; backend won't reject. |
| **R13** | Custom `plan_code` stored verbatim | 🔵 | No normalize/format validation (O10) | If exposing a code field, apply frontend formatting (e.g. uppercase `TXN-` guidance) — backend accepts anything ≤20 chars. |
| **R14** | `notes: null` cannot clear item notes | 🔵 | PATCH ignores `notes: null` | Omit `notes` when not changing; document the quirk. |
| **R15** | Doctor revoke doesn't reset patient status | 🔵 | Revoke clears signature only | If patient had accepted, record shows accepted without a doctor signature; display with care. |
| **R16** | DENTAL_ASSISTANT excluded everywhere | 🔵 | Role set omits it | Hide treatment/procedure navigation for that role. |
| **R17** | Approval/version fields that are never settable | 🔵 | `approval_notes`, `appointment_id`, `diagnosis_id` cannot be written via any endpoint | Render read-only/omitted; do not build editors. |
| **R18** | `count-by-status` is sparse | 🔵 | Only statuses with ≥1 plan appear | Use `dashboard.by_status` (dense) for charts; don't assume keys. |

---

## 18. Recommendations

### 18.1 Implementation order

1. **Foundation:** `types/treatmentPlan.ts` + `types/procedure.ts`, `utils/treatmentPlanStateMachine.ts`, `treatmentPlanService.ts`, `procedureService.ts`, constants (`TREATMENT_PLAN_STATUS_META`, category labels — follow `constants/user.ts` / `appointment.ts` patterns).
2. **Procedure catalog (admin):** list/search/active + create/edit/activate/deactivate/delete (smallest surface, unlocks item forms). ⭐ gate writes with `PermissionGate`.
3. **Plan list:** filters + pagination + search + status badges + dashboard cards.
4. **Plan create** (draft) → **items add/update/remove/reorder** (editable statuses only).
5. **Transitions** (contextual action bar) → **approval workflow** → **versions**.
6. **Detail page** assembly + patient/doctor name resolution.

### 18.2 Feature priorities

| Priority | Feature | Rationale |
|---|---|---|
| P0 | Plan CRUD-lite (create + list + detail) | Core workflow |
| P0 | Item management | Plans are unusable without items; gates submission |
| P0 | Status transitions (submit→approve→accept→start→complete/cancel) | Lifecycle; enforce via state machine helper |
| P1 | Dashboard summary | One endpoint, high visibility |
| P1 | Procedure catalog (admin) | Needed by item forms |
| P1 | Approval workflow (doctor/patient) | Required for `accept` path in clinics |
| P2 | Versions (snapshot/restore) | Audit value; low usage in editable-only flows |
| P3 | Count endpoints | Only if dashboards/analytics need them |

### 18.3 Reusable abstractions (new, but minimal)

- `utils/treatmentPlanStateMachine.ts` — **the one new abstraction** (backend provides no transition metadata).
- `components/treatmentPlans/PlanTransitionActions.tsx` — renders legal actions for a status (single place to keep in sync with the state machine).
- A `resolvePatientDoctorNames` helper (or use React Query `useAppointmentNames`-style parallel queries).

### 18.4 Testing priorities

- **Schema tests:** mirror every §5 bound in Zod; include FDI tooth edge cases (49 rejected), discount > cost, sequence duplicates, `extra` fields rejected.
- **Service tests:** each service method maps to the correct URL/verb/params (mirror `appointmentService.test.ts` style).
- **State machine tests:** `planActionsForStatus` matches §11.1 exactly (both directions).
- **Component tests:** transition button visibility per status; 409/422 error surfacing; empty states; pagination.
- **Container tests:** mutation invalidation keys (`['treatment-plans']`, plan detail, `['dashboard']`).

### 18.5 Accessibility

- Modal/drawer focus traps (existing `Modal`/`Drawer`).
- `role="alert"` on inline errors (existing `ValidationSummary`/`Alert`).
- Disable submit while pending (`Button loading`).
- Status badges with text (not color-only) — existing `StatusBadge` convention.

### 18.6 Production hardening considerations (frontend-side)

- Debounce search (existing `useDebounce`) to protect the `ilike '%…%'` search endpoints.
- Never send `date_from`/`date_to` unless valid `YYYY-MM-DD`.
- Treat 500s from mutation endpoints (incl. concurrency) with an explicit "please retry / refresh" toast; invalidate + refetch after any 409/500 to resync `lock_version`-sensitive views.
- Document R4/R5/R12/R14 with code comments next to the constants/services that encode them, so future devs don't "fix" them into contract mismatches.

---

## Appendix A — Source Map (verification evidence)

| Claim | Verified in |
|---|---|
| Router inventory, role sets, status codes | `backend/app/modules/treatment/routers/treatment_plan_router.py`, `procedure_router.py` |
| Router registration / no version prefix | `backend/main.py` |
| Request/response schemas + `extra="forbid"` | `backend/app/modules/treatment/schemas/*.py` |
| Pagination envelope + `total_pages` | `backend/app/modules/treatment/schemas/pagination.py` |
| Models, FKs, cascades, CHECKs, indexes, `lock_version` | `backend/app/modules/treatment/models.py` + alembic `3e904edeca5a_add_treatment_module.py` |
| Constants, FDI ranges, transition maps | `backend/app/modules/treatment/constants.py` |
| Enums (statuses, categories, quadrants, arch) | `backend/app/modules/treatment/enums.py` |
| Exception codes/messages + hierarchy | `backend/app/modules/treatment/exceptions.py` |
| Service workflows, transactions, snapshot JSON shape | `backend/app/modules/treatment/services/treatment_plan_service.py`, `procedure_service.py` |
| Repository queries, sort/filter allowlists, lazy/selectin | `backend/app/modules/treatment/repositories/treatment_plan_repository.py`, `procedure_repository.py` |
| Validators (editable, FDI, cost, approval, deletable) | `backend/app/modules/treatment/validators/treatment_plan_validator.py`, `procedure_validator.py` |
| State machine legality | `backend/app/modules/treatment/validators/state_machine.py` |
| Mapper field computation (`item_count`, totals, snapshot) | `backend/app/modules/treatment/mappers/*.py` |
| `is_valid_tooth_surface_combination` never called | codebase search (only `constants.py` definition) |
| No item-transition endpoint; `StatusTransition` unused by routes | codebase search (`validate_item_transition`, `get_allowed_transitions`, `StatusTransition` — tests/validators only) |
| No plan update/delete/deactivate service+route | codebase search (`def update_plan`, `delete_plan`, `deactivate_plan` → 0 matches in app) |
| Error envelope + status maps (codes stripped) | `backend/app/core/exception_handlers.py` (`_error_response`, `_TREATMENT_PLAN_EXCEPTION_MAP`, `validation_exception_handler`) |
| Auth dependency (JWT, inactive → 401) | `backend/app/dependencies/auth.py` |
| RBAC (`require_roles`, `require_admin`) | `backend/app/modules/rbac/permissions.py` |
| Role constants | `backend/app/core/constants.py` |
| Route-level behavior cross-check | `backend/tests/modules/treatment/test_treatment_plan_routes.py`, `test_procedure_routes.py` (201 create, 404 patient/doctor, 409 duplicate code, 422 date range) |

---

*End of review. This document is the authoritative frontend contract for the Treatment Plan and Procedure modules. Frontend implementation should require no further backend source consultation for the scoped work.*
