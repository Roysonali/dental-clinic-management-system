# Patient Records Module — Backend Contract Review (Sprint 13A)

> **Document type:** Mandatory backend contract review (Blocking Task)
> **Scope:** Backend Patient Records module (`backend/app/modules/patient_records/`) — **single source of truth** for all frontend Patient Records work.
> **Status:** ✅ VERIFIED against actual backend implementation (source code, not OpenAPI docs)
> **Date:** 2026-08-07
> **Method:** Every claim below was verified by reading all 7 routers, all 6 schema modules, all 7 models, all 7 services, all 7 repositories, all validators, the state machine + transition validator + workflow rules + workflow coordinator, both orchestrators, enums, constants, exceptions, dependencies, the global exception handler, the RBAC dependency, and `backend/main.py` registration. Cross-referenced against `backend/app/modules/patient_records/tests/*`.

---

## 1. Executive Summary

### 1.1 Module purpose

The Patient Records module manages the **clinical chart** attached to a patient appointment. It is a per-appointment aggregate root (`PatientRecord`) with five child entity families:

1. **Patient Record** — the clinical note itself: chief complaint, clinical notes, doctor remarks, treatment recommendation, plus a **free-text medical history block** (systemic diseases, surgeries, medications, habits, medical alerts, allergies, dental history). Lifecycle flags: `status`, `is_finalized` (immutability), `is_deleted` (soft delete).
2. **Diagnoses** — a list per record, typed `PROVISIONAL | CONFIRMED`, free-text name + notes (no ICD coding).
3. **Prescriptions** — a clinical document per record containing 1–20 **medicine items** (medicine name, dosage, frequency, duration, instructions) + notes. `prescribed_by` is captured at creation.
4. **Attachments** — file **metadata** records (type, file name, path, MIME, size) per record. There is **no actual file upload/download** — the client supplies a `file_path` string.
5. **Follow-ups** — scheduled future visit dates (today or later) with notes; includes an `upcoming` date-range query.
6. **Audit log** — append-only, per-record action history (action, old/new value, actor, timestamp), readable only by ADMIN/CHIEF_DOCTOR through standalone endpoints (but embedded in the record detail response — see O5).

### 1.2 Readiness verdict

| Dimension | Verdict |
|---|---|
| Core record CRUD + finalize + soft-delete | ✅ Complete and well-structured (39 live endpoints) |
| RBAC | ✅ Solid (ADMIN/RECEPTIONIST/doctor reads+writes; status changes doctor+admin; delete admin-only; audit admin-only) |
| Error envelope + status mapping | ✅ Consistent `{success, message, details}` (O13) |
| Pagination | ✅ Uniform `{items, total, page, page_size, pages}`; page_size ≤ 100 |
| **Status state machine** | 🔴 **NOT enforced over HTTP** — `PATCH /status` bypasses it (O1) |
| **Workflow / orchestrator layer** | 🔴 **Dead code w.r.t. the API** — no router calls it (O2) |
| **File upload / download** | 🔴 **Not implemented** — metadata-only JSON (O6) |
| Prescription lifecycle (approval/print/refill/status) | 🟠 Partial — create/edit-notes/delete + items CRUD; no status/print (O8) |
| Clinical capabilities (vitals, odontogram, ICD, SOAP) | 🔴 **Not implemented** (Section 15) |
| Versioning of clinical content | 🟠 Audit-only; no content snapshots/restore (O9) |

**Overall frontend readiness: ✅ READY for a Records + Diagnoses + Prescriptions + Follow-ups + Attachments-metadata + Audit-viewer module.** The backend is production-shaped (transactions, soft-delete, immutability guards, audit, eager loading, pagination) and all 39 endpoints are live in `main.py`. The frontend must **not** build: file upload/download, odontogram, vitals, ICD coding, structured SOAP, prescription printing, or content versioning — none are supported.

### 1.3 High-level workflow (as actually enforced by the API)

```
Create record (DRAFT) → edit clinical fields (PATCH) → add diagnoses / prescriptions / follow-ups / attachments
  → [status transition PATCH /status — ANY target allowed for doctor+admin, see O1]
  → finalize (POST /finalize) → status=FINALIZED, is_finalized=true → immutable
  → delete (DELETE, ADMIN) → is_deleted=true (hidden) [finalized records cannot be deleted]
```

### 1.4 Important implementation observations (read first)

| # | Observation | Severity |
|---|---|---|
| **O1** | **The status state machine is NOT enforced over HTTP.** `PATCH /patient-records/{id}/status` calls `PatientRecordService.update_status()`, which only guards *finalized* and *deleted*. Any status-change-role user (ADMIN + doctor roles) can jump **DRAFT → FINALIZED directly**, skip review, etc. The full state machine (`workflow/state_machine.py` + `TransitionValidator`) and its prerequisites (e.g. chief complaint required before `UNDER_REVIEW`) are **never invoked by any route**. | 🔴 |
| **O2** | **The entire workflow/orchestrator layer is dead code w.r.t. the API.** `PatientRecordWorkflow`, `TransitionValidator`, `WorkflowRules`, `PatientRecordOrchestrator`, and `ClinicalWorkflowOrchestrator` are not referenced by any router. There is no endpoint for `complete_consultation`, `create_full_episode`, `complete_and_finalize`, etc. Service-only methods (`bulk_create` diagnoses, `bulk_upload` + `search_attachments` attachments, `finalize_prescription`, every `count_*`) also have **no route**. | 🔴 |
| **O3** | **Finalize actually sets `status=FINALIZED`** (repository `finalize_record` sets `is_finalized=True` + `status=RecordStatus.FINALIZED`), but the router description and the audit-log message hardcode `status=COMPLETED, is_finalized=True`. The enum's terminal state is `FINALIZED`; `LOCKED` is retained for legacy rows only. | 🟠 |
| **O4** | **Audit logs are embedded in the record-detail response.** `GET /patient-records/{id}` returns `audit_logs[]` (action, performed_by, performed_at) to **any read-role user** (incl. RECEPTIONIST), while the standalone audit endpoints require ADMIN/CHIEF_DOCTOR. Do not treat audit as admin-only in the detail page UI. | 🟠 |
| **O5** | **No real file upload.** `AttachmentCreate` is JSON metadata (`file_name`, `file_path`, `mime_type`, `file_size`); there is no `multipart/form-data`, no file storage layer, no download/serve endpoint, no content-length streaming. The frontend can only register/display file metadata. | 🔴 |
| **O6** | **AttachmentType enum vs MIME validator mismatch.** Enum = `IMAGE, PDF, REPORT, SCAN, DOCUMENT` (no `VIDEO`, no `OTHER`), but the service's `_is_mime_type_allowed()` branches on `AttachmentType.VIDEO` and a fallback comment for `OTHER`. `VIDEO` can never be selected; `PDF`/`REPORT` fall through to the permissive "any known MIME" branch (image+document+video sets). MIME validation is effectively loose for PDF/REPORT. | 🟡 |
| **O7** | **No prescription lifecycle.** Prescriptions have **no status field, no approval step, no refill, no print endpoint**. `PrescriptionUpdate` allows only `notes`. `finalize_prescription` (sets `prescribed_at=now`) exists in the service but has **no route** — `prescribed_at` is just `server_default=now()` on create. | 🟠 |
| **O8** | **Medical history is free text.** Allergies/medications/systemic diseases/etc. are single `Text` columns on the record (≤ 5000 chars each) — not structured entities. `AllergySeverity` enum exists but is **unused** anywhere. | 🟡 |
| **O9** | **No content versioning.** The only history is the audit log (`old_value`/`new_value` as opaque strings). No snapshots, no restore. | 🟡 |
| **O10** | **`PATCH .../status` takes the target via query param** (`?new_status=IN_PROGRESS`), not a body — unusual; mirror it. | 🟡 |
| **O11** | **No ownership scoping.** Dependencies are purely role-based; any read-role user can read **any** record, any write-role user can edit **any** record. `WorkflowRules.assert_*_ownership()` helpers exist but are unused by routes. No doctor-level data isolation. | 🟠 |
| **O12** | **Search is narrow.** `search` only matches `chief_complaint` and `clinical_notes` (ILIKE substring). No search over diagnoses, prescriptions, or medical-history fields; no full-text index (plain `ilike`). | 🟡 |
| **O13** | **The real error envelope is `{success, message, details}`.** `PatientRecordException.to_dict()` (the `{error:{code,...}}` shape) is **dead code** — error codes are stripped from HTTP responses; the frontend must branch on HTTP status and render `message`. | 🟠 |
| **O14** | **Mismatched ordering claims.** Follow-up list + upcoming order by `followup_date ASC` (soonest first) though the router docstring says "most-recent first"; prescription items list by `created_at ASC`. Prescriptions list by `prescribed_at DESC`; diagnoses/attachments/audit by `created_at/performed_at DESC`. | 🟡 |
| **O15** | **Minor dead/stub code:** `validators/prescription_validator.py`, `diagnosis_validator.py`, `attachment_validator.py`, `workflow_validator.py` are **empty files** (not exported); `PatientRecordMapper` and `SummaryResponse`/`NestedResponse`/`Summary` schemas are unused by routes (FastAPI `response_model` handles serialization directly); `PrescriptionItemListResponse` is defined inline in the router file, not the schema module; missing audit entry raises `PatientRecordNotFound` (code `PATIENT_RECORD_NOT_FOUND`) with `details.audit_id`. | 🔵 |

---

## 2. Module Structure

### 2.1 Folder / file map (`backend/app/modules/patient_records/`)

```
patient_records/
├── __init__.py                     # empty
├── constants/
│   ├── __init__.py                 # re-exports all audit event constants
│   ├── audit_events.py             # 30 audit action names (PATIENT_RECORD_CREATED, DIAGNOSIS_BULK_CREATED, …)
│   └── patient_record_constants.py # EMPTY (stub)
├── dependencies/
│   ├── __init__.py
│   ├── patient_record_dependencies.py  # FastAPI DI factories: get_patient_record_service, get_diagnosis_service,
│   │                                   #   get_prescription_service, get_prescription_item_service,
│   │                                   #   get_attachment_service, get_followup_service, get_audit_log_service
│   └── permissions.py              # RBAC helpers: require_patient_record_read/write/status_change/delete, require_audit_read
├── enums/
│   ├── __init__.py                 # exports RecordStatus, DiagnosisType, AttachmentType, AllergySeverity
│   ├── record_status.py            # DRAFT, IN_PROGRESS, UNDER_REVIEW, COMPLETED, FINALIZED, LOCKED (+ helpers)
│   ├── diagnosis_type.py           # PROVISIONAL, CONFIRMED
│   ├── attachment_type.py          # IMAGE, PDF, REPORT, SCAN, DOCUMENT
│   └── allergy_severity.py         # LOW, MEDIUM, HIGH, CRITICAL — UNUSED
├── exceptions/
│   ├── __init__.py
│   └── patient_record_exceptions.py  # PatientRecordException base (+ to_dict — dead) + 7 subclasses
├── mappers/
│   ├── __init__.py
│   └── patient_record_mapper.py    # ORM → PatientRecordResponse/Summary/Nested/ListItem — NOT used by routes
├── models/
│   ├── __init__.py                 # imports User first (relationship resolution), then all 6 models
│   ├── patient_record.py           # PatientRecord (aggregate root)
│   ├── diagnosis.py                # PatientRecordDiagnosis
│   ├── prescription.py             # PatientRecordPrescription (+ prescriber FK → users)
│   ├── prescription_item.py        # PatientRecordPrescriptionItem
│   ├── attachment.py               # PatientRecordAttachment
│   ├── followup.py                 # PatientRecordFollowup
│   └── audit_log.py                # PatientRecordAuditLog (append-only)
├── orchestrators/
│   ├── __init__.py
│   ├── patient_record_orchestrator.py    # create_full_record, add_clinical_data, transition_status,
│   │                                     #   complete_and_finalize, reopen_and_update — DEAD w.r.t. API (O2)
│   └── clinical_workflow_orchestrator.py # complete_consultation, create_full_episode, create_treatment_plan,
│                                         #   finalize_clinical_work — DEAD w.r.t. API (O2)
├── repositories/
│   ├── __init__.py
│   ├── patient_record_repository.py  # aggregate reads (eager selectinload), filters, update allowlist, soft-delete
│   ├── diagnosis_repository.py       # CRUD + get_by_record + get_patient_id join
│   ├── prescription_repository.py    # CRUD + items eager load + finalize (sets prescribed_at)
│   ├── prescription_item_repository.py
│   ├── attachment_repository.py      # CRUD + search(file_name_query, type)
│   ├── followup_repository.py        # CRUD + get_upcoming(date range)
│   └── audit_repository.py           # append-only create/bulk + list filters (record/user/action)
├── routers/
│   ├── __init__.py                   # empty (routers registered individually in main.py)
│   ├── patient_record_router.py      # prefix /patient-records (9 endpoints)
│   ├── diagnosis_router.py           # /patient-records/{id}/diagnoses + /diagnoses (5)
│   ├── prescription_router.py        # /patient-records/{id}/prescriptions + /prescriptions (5)
│   ├── prescription_item_router.py   # /prescriptions/{id}/items + /prescription-items (6)
│   ├── attachment_router.py          # /patient-records/{id}/attachments + /attachments (5)
│   ├── followup_router.py            # /patient-records/{id}/followups + /followups (6)
│   └── audit_router.py               # /patient-records/{id}/audit + /audit (3)
├── schemas/
│   ├── __init__.py
│   ├── patient_record_schema.py      # Base/Create/Update/FinalizeRequest + Summary/Nested/Response/ListItem/ListResponse
│   ├── diagnosis_schema.py           # Base/Create/Update + Summary/Nested/Response/ListItem/ListResponse
│   ├── prescription_schema.py        # Prescription + PrescriptionItem families
│   ├── attachment_schema.py          # Attachment family
│   ├── followup_schema.py            # Followup family
│   └── audit_schema.py               # Audit family
├── services/
│   ├── __init__.py
│   ├── patient_record_service.py     # record CRUD + finalize + status + audit (transaction owner)
│   ├── diagnosis_service.py          # CRUD + bulk_create (no route)
│   ├── prescription_service.py       # CRUD + finalize_prescription (no route)
│   ├── prescription_item_service.py  # CRUD + bulk_create
│   ├── attachment_service.py         # CRUD + bulk_upload (no route) + search_attachments (no route) + MIME/size validation
│   ├── followup_service.py           # CRUD + get_upcoming
│   └── audit_service.py              # append-only writes + reads
├── validators/
│   ├── __init__.py                   # exports PatientRecordValidator, FollowupValidator only
│   ├── patient_record_validator.py   # assert_exists/not_deleted/not_finalized/modifiable
│   ├── followup_validator.py         # validate_followup_date (today-or-future)
│   ├── prescription_validator.py     # EMPTY stub
│   ├── diagnosis_validator.py        # EMPTY stub
│   ├── attachment_validator.py       # EMPTY stub
│   └── workflow_validator.py         # EMPTY stub
├── workflow/
│   ├── __init__.py
│   ├── state_machine.py              # PatientRecordStateMachine + TransitionDefinition (7 transitions)
│   ├── transition_validator.py       # 7-step pipeline (deleted→finalized→same-state→terminal→machine→RBAC→prereqs)
│   ├── workflow_rules.py             # existence/state/ownership/transition-prerequisite rules
│   └── patient_record_workflow.py    # high-level workflow coordinator — DEAD w.r.t. API (O2)
└── tests/                            # 12 test files (service, router, validator, workflow, orchestrator, integration)
```

### 2.2 Relevant shared infrastructure (outside the module)

| File | Role |
|---|---|
| `backend/main.py` | Registers **all 13 patient-record routers** (both `router` and `item_router` of each family); CORS for `localhost:5173` / `127.0.0.1:5173`; `register_exception_handlers(app)` |
| `backend/app/dependencies/auth.py` | `oauth2_scheme` (Bearer, `tokenUrl="/auth/login"`), `get_current_user` (JWT `sub` = email → User; **inactive user → 401**) |
| `backend/app/modules/rbac/permissions.py` | `require_roles([...])` (403 "Role not assigned" / "Insufficient permissions"), `require_admin` = `{ADMIN, CHIEF_DOCTOR}` |
| `backend/app/core/exception_handlers.py` | `_PATIENT_RECORD_EXCEPTION_MAP` + global `{success, message, details}` envelope; 422 sanitizer; unhandled → 500 |
| `backend/app/core/constants.py` | Roles: `ROLE_ADMIN`, `DOCTOR_ROLES` (4), `ROLE_RECEPTIONIST`, `ROLE_DENTAL_ASSISTANT`, … |
| `backend/app/database/session.py` | `get_db` session dependency |

### 2.3 Dependency graph

```
Router ──► Service ──► Repository ──► SQLAlchemy Session
   │            │            └─► (flush only; never commit)
   │            └─► Validator (pure static methods — no DB access)
   │
   └─► response_model (Pydantic, from_attributes) — mapper NOT used
Service owns: commit / rollback / audit writes / cross-repo checks (patient + appointment existence)
Repository owns: SQL, eager-load, field update allowlists, soft-delete, pagination clamp
```

---

## 3. Router Review

All routers: JWT Bearer via `Depends(require_patient_record_* )` → `get_current_user`; no API version prefix; every endpoint declares a `response_model`, `summary`, and `description`.

### 3.1 Per-router summary

| Router | Prefix | Tags | Auth deps used | Endpoints |
|---|---|---|---|---|
| `patient_record_router` | `/patient-records` | `Patient Records` | read / write / status_change / delete | 9 |
| `diagnosis_router` (`router`) | `/patient-records/{record_id}/diagnoses` | `Diagnoses` | write (POST), read (GET) | 2 |
| `diagnosis_router` (`item_router`) | `/diagnoses` | `Diagnoses` | read (GET), write (PATCH/DELETE) | 3 |
| `prescription_router` (`router`) | `/patient-records/{record_id}/prescriptions` | `Prescriptions` | write (POST), read (GET) | 2 |
| `prescription_router` (`item_router`) | `/prescriptions` | `Prescriptions` | read (GET), write (PATCH/DELETE) | 3 |
| `prescription_item_router` (`router`) | `/prescriptions/{prescription_id}/items` | `Prescription Items` | write (POST ×2), read (GET) | 3 |
| `prescription_item_router` (`item_router`) | `/prescription-items` | `Prescription Items` | read (GET), write (PATCH/DELETE) | 3 |
| `attachment_router` (`router`) | `/patient-records/{record_id}/attachments` | `Attachments` | write (POST), read (GET) | 2 |
| `attachment_router` (`item_router`) | `/attachments` | `Attachments` | read (GET), write (PATCH/DELETE) | 3 |
| `followup_router` (`router`) | `/patient-records/{record_id}/followups` | `Follow-ups` | write (POST), read (GET) | 2 |
| `followup_router` (`item_router`) | `/followups` | `Follow-ups` | read (GET ×2), write (PATCH/DELETE) | 4 |
| `audit_router` (`router`) | `/patient-records/{record_id}/audit` | `Audit Logs` | **require_audit_read** (ADMIN/CHIEF_DOCTOR) | 1 |
| `audit_router` (`item_router`) | `/audit` | `Audit Logs` | **require_audit_read** | 2 |

**Routing precedence note:** `GET /patient-records/appointment/{id}` and `GET /patient-records/patient/{id}` are registered **before** `GET /patient-records/{record_id}` — no conflict because `record_id` is UUID-typed (the literals `appointment` / `patient` fail UUID parsing and fall through).

---

## 4. Endpoint Inventory (39 endpoints — all live in `main.py`)

**Legend:** 🔐 = requires Bearer JWT. 🅰 = role set `{ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` (DENTAL_ASSISTANT excluded everywhere). ⭐ = status/transition role `{ADMIN, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` (no receptionist). 👑 = `require_admin` `{ADMIN, CHIEF_DOCTOR}`. 🗑 = `{ADMIN}` only.

### 4.1 Patient Records — `/patient-records`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 1 | `POST` | `/patient-records` | Create record (DRAFT). Validates patient+appointment exist; **one record per appointment** (unique). | 🅰 | **201** | `PatientRecordCreate` | `PatientRecordResponse` |
| 2 | `GET` | `/patient-records` | Paginated list. Filters: `status`, `is_finalized`, `patient_id`, `search` (chief complaint + clinical notes). Ordered `created_at DESC`. | 🅰 | 200 | query | `PatientRecordListResponse` |
| 3 | `GET` | `/patient-records/{record_id}` | Full record with **all nested** diagnoses, prescriptions, follow-ups, attachments, **audit_logs**, and counts. 404 if missing/soft-deleted. | 🅰 | 200 | — | `PatientRecordResponse` |
| 4 | `GET` | `/patient-records/appointment/{appointment_id}` | Record for an appointment (1:1). 404 if none. | 🅰 | 200 | — | `PatientRecordResponse` |
| 5 | `GET` | `/patient-records/patient/{patient_id}` | Paginated records for one patient (created_at DESC). | 🅰 | 200 | query | `PatientRecordListResponse` |
| 6 | `PATCH` | `/patient-records/{record_id}` | Partial update of the 11 clinical/medical fields (`exclude_unset`). Finalized/deleted → 400. | 🅰 | 200 | `PatientRecordUpdate` | `PatientRecordResponse` |
| 7 | `PATCH` | `/patient-records/{record_id}/status` | Set status **directly** (`?new_status=...`). Only guards: not finalized, not deleted. **No state-machine check (O1).** | ⭐ | 200 | query `new_status` | `PatientRecordResponse` |
| 8 | `POST` | `/patient-records/{record_id}/finalize` | Finalize → `is_finalized=true`, `status=FINALIZED` (O3). Body must be `{"confirm": true}` (else 422). | ⭐ | 200 | `PatientRecordFinalizeRequest` | `PatientRecordResponse` |
| 9 | `DELETE` | `/patient-records/{record_id}` | Soft-delete (`is_deleted=true`). Idempotent. Finalized → 400. | 🗑 | **204** | — | — |

**Errors:** create → 404 patient/appointment missing, **409** appointment already has a record (defensive check + DB unique); get → 404; patch/status/finalize/delete → 400 on finalized/deleted, 404 missing; validation → 422.

### 4.2 Diagnoses

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 10 | `POST` | `/patient-records/{record_id}/diagnoses` | Create diagnosis under record (not finalized/deleted). | 🅰 | **201** | `DiagnosisCreate` | `DiagnosisResponse` |
| 11 | `GET` | `/patient-records/{record_id}/diagnoses` | Paginated list, optional `diagnosis_type` filter, `created_at DESC`. | 🅰 | 200 | query | `DiagnosisListResponse` |
| 12 | `GET` | `/diagnoses/{diagnosis_id}` | Single diagnosis. 404 if missing/soft-deleted. | 🅰 | 200 | — | `DiagnosisResponse` |
| 13 | `PATCH` | `/diagnoses/{diagnosis_id}` | Partial update (name/type/notes). Parent must be modifiable. | 🅰 | 200 | `DiagnosisUpdate` | `DiagnosisResponse` |
| 14 | `DELETE` | `/diagnoses/{diagnosis_id}` | Soft-delete. Idempotent. | 🅰 | **204** | — | — |

> `DiagnosisService.bulk_create` exists (audit `DIAGNOSIS_BULK_CREATED`) but **no route** (O2).

### 4.3 Prescriptions

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 15 | `POST` | `/patient-records/{record_id}/prescriptions` | Create prescription **with 1–20 items** in one transaction. `prescribed_by = current_user.id`. | 🅰 | **201** | `PrescriptionCreate` | `PrescriptionResponse` |
| 16 | `GET` | `/patient-records/{record_id}/prescriptions` | Paginated list (with items), `prescribed_at DESC`. | 🅰 | 200 | query | `PrescriptionListResponse` |
| 17 | `GET` | `/prescriptions/{prescription_id}` | Single prescription incl. items. 404 if missing/soft-deleted. | 🅰 | 200 | — | `PrescriptionResponse` |
| 18 | `PATCH` | `/prescriptions/{prescription_id}` | Update **notes only** (allowlist). Parent must be modifiable. | 🅰 | 200 | `PrescriptionUpdate` | `PrescriptionResponse` |
| 19 | `DELETE` | `/prescriptions/{prescription_id}` | Soft-delete. Idempotent. | 🅰 | **204** | — | — |

### 4.4 Prescription Items

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 20 | `POST` | `/prescriptions/{prescription_id}/items` | Create one medicine item. | 🅰 | **201** | `PrescriptionItemCreate` | `PrescriptionItemResponse` |
| 21 | `POST` | `/prescriptions/{prescription_id}/items/bulk` | Create many items in one transaction (all-or-nothing). | 🅰 | **201** | `list[PrescriptionItemCreate]` | `list[PrescriptionItemResponse]` |
| 22 | `GET` | `/prescriptions/{prescription_id}/items` | Paginated items, `created_at ASC` (O14). | 🅰 | 200 | query | `PrescriptionItemListResponse` |
| 23 | `GET` | `/prescription-items/{item_id}` | Single item. 404 if missing/soft-deleted. | 🅰 | 200 | — | `PrescriptionItemResponse` |
| 24 | `PATCH` | `/prescription-items/{item_id}` | Partial update (all 5 medicine fields). Parent record must be modifiable. | 🅰 | 200 | `PrescriptionItemUpdate` | `PrescriptionItemResponse` |
| 25 | `DELETE` | `/prescription-items/{item_id}` | Soft-delete. Idempotent. | 🅰 | **204** | — | — |

### 4.5 Attachments

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 26 | `POST` | `/patient-records/{record_id}/attachments` | Register attachment **metadata** (JSON). Validates MIME vs type + 50 MB size cap. | 🅰 | **201** | `AttachmentCreate` | `AttachmentResponse` |
| 27 | `GET` | `/patient-records/{record_id}/attachments` | Paginated list, `created_at DESC`. | 🅰 | 200 | query | `AttachmentListResponse` |
| 28 | `GET` | `/attachments/{attachment_id}` | Single attachment. 404 if missing/soft-deleted. | 🅰 | 200 | — | `AttachmentResponse` |
| 29 | `PATCH` | `/attachments/{attachment_id}` | Update metadata (type/name/mime/size). **`file_path` immutable** (not in allowlist). | 🅰 | 200 | `AttachmentUpdate` | `AttachmentResponse` |
| 30 | `DELETE` | `/attachments/{attachment_id}` | Soft-delete. Idempotent. | 🅰 | **204** | — | — |

> `AttachmentService.bulk_upload` and `search_attachments` (type + file-name filter) exist but **no route** (O2).

### 4.6 Follow-ups

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 31 | `POST` | `/patient-records/{record_id}/followups` | Schedule follow-up. **Date must be today or future** (else 400). | 🅰 | **201** | `FollowupCreate` | `FollowupResponse` |
| 32 | `GET` | `/patient-records/{record_id}/followups` | Paginated list, `followup_date ASC`. | 🅰 | 200 | query | `FollowupListResponse` |
| 33 | `GET` | `/followups/upcoming` | Date-range query: `from_date` (default today), `to_date` (default = from), `patient_record_id?`. `followup_date ASC`. Ideal for a dashboard "upcoming follow-ups" widget. | 🅰 | 200 | query | `FollowupListResponse` |
| 34 | `GET` | `/followups/{followup_id}` | Single follow-up. 404 if missing/soft-deleted. | 🅰 | 200 | — | `FollowupResponse` |
| 35 | `PATCH` | `/followups/{followup_id}` | Update date (still today-or-future) + notes. | 🅰 | 200 | `FollowupUpdate` | `FollowupResponse` |
| 36 | `DELETE` | `/followups/{followup_id}` | Soft-delete. Idempotent. | 🅰 | **204** | — | — |

### 4.7 Audit Logs (read-only, admin)

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 37 | `GET` | `/patient-records/{record_id}/audit` | Audit entries for one record, `performed_at DESC`. | 👑 | 200 | query | `AuditListResponse` |
| 38 | `GET` | `/audit/{audit_id}` | Single audit entry. Missing → **404 with code `PATIENT_RECORD_NOT_FOUND`** (O15). | 👑 | 200 | — | `AuditResponse` |
| 39 | `GET` | `/audit/user/{user_id}` | Audit entries performed by a user (`user_id` = int PK of users), `performed_at DESC`. | 👑 | 200 | query | `AuditListResponse` |

**Pagination everywhere:** `page` (`ge=1`, default 1), `page_size` (`ge=1, le=100`, default 20) → response `{items, total, page, page_size, pages}` where `pages = ceil(total/page_size)` (0 when total=0). List endpoints include **only the 5 list-response routers above**; there is no list audit router with filters (service supports `action` filter but no route).

---

## 5. Request Schema Review

All schemas use `ConfigDict(extra="forbid", str_strip_whitespace=True)` → **unknown fields → 422; whitespace-only strings are stripped/normalized to `null` for optional text**.

### 5.1 `PatientRecordCreate` (POST /patient-records)

| Field | Type | Required | Validation |
|---|---|---|---|
| `patient_id` | UUID | ✅ | Must reference existing patient (else 400 `PATIENT_RECORD_BUSINESS_RULE`) |
| `appointment_id` | UUID | ✅ | Must reference existing appointment; **unique across records** (else 409) |
| `chief_complaint` | string \| null | ❌ | ≤ 5000; stripped; empty → null |
| `clinical_notes` | string \| null | ❌ | ≤ 10000 |
| `doctor_remarks` | string \| null | ❌ | ≤ 5000 |
| `treatment_recommendation` | string \| null | ❌ | ≤ 5000 |
| `systemic_diseases` | string \| null | ❌ | ≤ 5000 |
| `surgeries` | string \| null | ❌ | ≤ 5000 |
| `medications` | string \| null | ❌ | ≤ 5000 |
| `habits` | string \| null | ❌ | ≤ 5000 |
| `medical_alerts` | string \| null | ❌ | ≤ 5000 |
| `allergies` | string \| null | ❌ | ≤ 5000 |
| `dental_history` | string \| null | ❌ | ≤ 5000 |

> `status`, `is_finalized`, timestamps, IDs are **server-managed** — cannot be set on create (forbidden fields).

### 5.2 `PatientRecordUpdate` (PATCH /patient-records/{id})

Same 11 fields, all **optional** (`Optional[str] = None`). `exclude_unset=True` → only explicitly provided keys are written; passing `null` **clears** the field (nullable columns). An empty body `{}` → 200 no-op (no audit entry written).

### 5.3 `PatientRecordFinalizeRequest` (POST .../finalize)

| Field | Type | Required | Validation |
|---|---|---|---|
| `confirm` | `Literal[True]` | ✅ | **Must be `true`**; `false` or missing → 422 |

### 5.4 `DiagnosisCreate` / `DiagnosisUpdate`

| Field | Type | Create | Update | Validation |
|---|---|---|---|---|
| `diagnosis_name` | string | ✅ | optional | `min_length=2`, `max_length=255`, non-empty after strip |
| `diagnosis_type` | enum | ✅ | optional | `PROVISIONAL \| CONFIRMED` (invalid → 422) |
| `notes` | string \| null | ❌ | optional | ≤ 2000; null clears |

### 5.5 `PrescriptionCreate` / `PrescriptionUpdate`

| Field | Type | Create | Update | Validation |
|---|---|---|---|---|
| `notes` | string \| null | ❌ | optional | ≤ 3000 |
| `items` | `list[PrescriptionItemCreate]` | ✅ | **not updatable here** | `min_length=1`, `max_length=20` (empty list → 422) |

`PrescriptionUpdate` allows **only `notes`** — items are managed via `/prescriptions/{id}/items` (O7).

### 5.6 `PrescriptionItemCreate` / `PrescriptionItemUpdate`

| Field | Type | Create | Update | Validation |
|---|---|---|---|---|
| `medicine_name` | string | ✅ | optional | `min_length=2`, `max_length=255` |
| `dosage` | string | ✅ | optional | `min_length=1`, `max_length=100` (update: no min) |
| `frequency` | string | ✅ | optional | `min_length=1`, `max_length=100` |
| `duration` | string | ✅ | optional | `min_length=1`, `max_length=100` |
| `instructions` | string \| null | ❌ | optional | ≤ 2000 |

### 5.7 `AttachmentCreate` / `AttachmentUpdate`

| Field | Type | Create | Update | Validation |
|---|---|---|---|---|
| `attachment_type` | enum | ✅ | optional | `IMAGE \| PDF \| REPORT \| SCAN \| DOCUMENT` |
| `file_name` | string | ✅ | optional | 1–255, non-empty |
| `file_path` | string | ✅ | **immutable** | 1–1000, **client-supplied** (O5) — not in update allowlist |
| `mime_type` | string \| null | ❌ | optional | ≤ 100; service validates against allowed sets per type |
| `file_size` | int \| null | ❌ | optional | `ge=0`; service rejects > 50 MB (400) |

### 5.8 `FollowupCreate` / `FollowupUpdate`

| Field | Type | Create | Update | Validation |
|---|---|---|---|---|
| `followup_date` | date `YYYY-MM-DD` | ✅ | optional | Service: **must be ≥ server-local `date.today()`** (400 if past) |
| `notes` | string \| null | ❌ | optional | ≤ 2000 |

### 5.9 Validation-error contract

Pydantic violations → **422** with envelope `{success: false, message: "Request validation failed", details: [ {type, loc, msg, input, ctx?} ]}` (ctx sanitized). Example `details`:
```json
{"type":"literal_error","loc":["body","confirm"],"msg":"Input should be true","input":false}
```

---

## 6. Response Schema Review

**Serialization:** UUIDs → strings; datetimes → ISO 8601 with timezone (columns are `DateTime(timezone=True)`; Pydantic emits `+00:00` or offset); no Decimal fields in this module; `file_size` is int \| null. All responses `extra="forbid"` so no surprise fields.

### 6.1 `PatientRecordResponse` (record detail + all mutation responses)

Fields: all 11 clinical/medical text fields (null when empty) **plus**:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | ❌ | |
| `patient_id` | UUID | ❌ | **No patient name** — resolve client-side |
| `appointment_id` | UUID | ❌ | |
| `status` | enum | ❌ | one of 6 (§7.1) |
| `is_finalized` | bool | ❌ | |
| `created_at` / `updated_at` | datetime | ❌ | |
| `diagnoses` | `DiagnosisNestedResponse[]` | — | `{id, diagnosis_name, diagnosis_type}` |
| `prescriptions` | `PrescriptionNestedResponse[]` | — | `{id, prescribed_at, items:[{id, medicine_name, dosage, frequency, duration}]}` |
| `followups` | `FollowupNestedResponse[]` | — | `{id, followup_date, notes}` |
| `attachments` | `AttachmentNestedResponse[]` | — | `{id, attachment_type, file_name, mime_type}` |
| `audit_logs` | `AuditNestedResponse[]` | — | `{id, action, performed_by, performed_at}` — **visible to all read roles (O4)** |
| `diagnosis_count` / `prescription_count` / `attachment_count` / `followup_count` | int | ❌ | Computed from loaded relationships (≥ 0) |

> ⚠️ Nested `audit_logs` is **not paginated** and is returned inside every record detail. The full record fetch eagerly loads all 5 relationship sets (`selectinload`) — payload size scales with the chart's full history.

### 6.2 `PatientRecordListItem` (list endpoints #2, #5)

`id`, `patient_id`, `appointment_id`, `status`, `is_finalized`, `chief_complaint`, `created_at` — **no patient/appointment names** (display gap, same as treatment plans).

### 6.3 `PatientRecordListResponse` (paginated)

`{items: PatientRecordListItem[], total, page, page_size, pages}`. **No records in the list carry nested children** — fetch detail for the full chart.

### 6.4 Child responses

| Response | Fields (beyond base) |
|---|---|
| `DiagnosisResponse` | `id`, `patient_record_id`, `created_at`, `updated_at` (+ name/type/notes) |
| `DiagnosisListItem` | `id`, `diagnosis_name`, `diagnosis_type`, `created_at` |
| `PrescriptionResponse` | `id`, `patient_record_id`, `prescribed_by` (**int** user id), `prescribed_at`, `created_at`, `updated_at`, `items[]` (full item responses) |
| `PrescriptionListItem` | `id`, `prescribed_at`, `prescribed_by`, `medicine_count` (computed) |
| `PrescriptionItemResponse` | `id`, `prescription_id`, `created_at`, `updated_at` (+ 5 medicine fields) |
| `AttachmentResponse` | `id`, `patient_record_id`, `created_at`, `updated_at` (+ type/name/path/mime/size) |
| `AttachmentListItem` | `id`, `attachment_type`, `file_name`, `mime_type`, `file_size`, `created_at` |
| `FollowupResponse` | `id`, `patient_record_id`, `created_at`, `updated_at` (+ date/notes) |
| `FollowupListItem` | `id`, `followup_date`, `notes`, `created_at` |
| `AuditResponse` | `id`, `patient_record_id`, `action`, `old_value`, `new_value`, `performed_by` (int), `performed_at` |
| `AuditListItem` | `id`, `action`, `performed_by`, `performed_at` (no old/new values) |

**Audit actions** (constants in `constants/audit_events.py`) — e.g. `PATIENT_RECORD_CREATED`, `PATIENT_RECORD_UPDATED`, `PATIENT_RECORD_STATUS_CHANGED`, `PATIENT_RECORD_FINALIZED`, `PATIENT_RECORD_DELETED`, `DIAGNOSIS_CREATED/BULK_CREATED/UPDATED/DELETED`, `PRESCRIPTION_CREATED/UPDATED/FINALIZED/DELETED`, `PRESCRIPTION_ITEM_*`, `ATTACHMENT_UPLOADED/BULK_UPLOADED/UPDATED/DELETED`, `FOLLOWUP_*`, `WORKFLOW_*` (unused). `old_value`/`new_value` are **free-text strings** (often `str(dict)` or `"status=A, is_finalized=True"`) — not structured diffs; do not attempt to parse them rigorously.

---

## 7. Database Model Review

All models extend `Base`; UUID PKs (`uuid4`, app-generated); `DateTime(timezone=True)` timestamps with `server_default=func.now()` and `onupdate=func.now()`; every clinical child has `is_deleted` (soft delete). PostgreSQL dialect UUID columns.

### 7.1 `PatientRecord` — table `patient_records`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID | PK |
| `patient_id` | UUID | FK → `patients.id`, not null, **index** |
| `appointment_id` | UUID | FK → `appointments.id`, not null, **unique** (1 record/appointment) + index |
| `status` | `Enum(RecordStatus)` | not null, default `DRAFT` |
| 11 clinical/medical text fields | Text | nullable |
| `is_finalized` | bool | not null, default false |
| `is_deleted` | bool | not null, default false |
| `created_at` / `updated_at` | DateTime(tz) | server defaults |
| Indexes | | `ix_patient_records_status`, `ix_patient_records_is_deleted` |

Relationships (all `lazy="selectin"`, `cascade="all, delete-orphan"`): `diagnoses`, `prescriptions`, `attachments`, `followups`, `audit_logs`. **No DB CHECK on status enum values** (Python `Enum` only). Computed `diagnosis_count/prescription_count/attachment_count/followup_count` are Python `@property` (`len()`).

### 7.2 `PatientRecordDiagnosis` — table `patient_record_diagnoses`

`id` (UUID PK), `patient_record_id` (FK → patient_records, index), `diagnosis_type` (`Enum(DiagnosisType)`), `diagnosis_name` (Text, not null), `notes` (Text), `is_deleted`, timestamps. Index `ix_patient_record_diagnoses_is_deleted`.

### 7.3 `PatientRecordPrescription` — table `patient_record_prescriptions`

`id` (UUID PK), `patient_record_id` (FK **ON DELETE CASCADE**, index), `prescribed_by` (**int**, FK → `users.id` **ON DELETE RESTRICT**, index), `prescribed_at` (DateTime(tz), server default now), `notes` (Text), `is_deleted`, timestamps. Relationships: `patient_record`, `prescriber` (→ User), `items` (cascade, selectin). Computed `medicine_count` property. Index `ix_..._is_deleted`.

### 7.4 `PatientRecordPrescriptionItem` — table `patient_record_prescription_items`

`id` (UUID PK), `prescription_id` (FK **CASCADE**, index), `medicine_name` (String 255), `dosage`/`frequency`/`duration` (String 100), `instructions` (Text), `is_deleted`, timestamps.

### 7.5 `PatientRecordAttachment` — table `patient_record_attachments`

`id` (UUID PK), `patient_record_id` (FK, index), `attachment_type` (`Enum(AttachmentType)`), `file_name` (String 255), `file_path` (String 1000), `mime_type` (String 100), `file_size` (**BigInteger**), `is_deleted`, timestamps. Indexes: `ix_..._is_deleted`, `ix_patient_record_attachments_type`.

### 7.6 `PatientRecordFollowup` — table `patient_record_followups`

`id` (UUID PK), `patient_record_id` (FK, index), `followup_date` (**Date**), `notes` (Text), `is_deleted`, timestamps. Indexes: `ix_..._is_deleted`, `ix_patient_record_followups_followup_date`.

### 7.7 `PatientRecordAuditLog` — table `patient_record_audit_logs` (append-only)

`id` (UUID PK), `patient_record_id` (FK, index), `action` (String 100), `old_value` / `new_value` (Text, nullable), `performed_by` (**int**, FK → users **RESTRICT**), `performed_at` (DateTime tz). Indexes: `ix_..._performed_by`, `ix_..._action`. **No `is_deleted`, no update/delete methods** — immutable by design.

**Cross-module FKs:** `patient_id` → patients, `appointment_id` → appointments, `prescribed_by`/`performed_by` → `users.id` (int PK). This is the integration surface for the frontend's patient/appointment/user name lookups.

---

## 8. Repository Review

| Repository | Key responsibilities |
|---|---|
| `PatientRecordRepository` | `_apply_base_filter` (`is_deleted=False` unless `include_deleted`), `_apply_eager_load` (5× `selectinload` — no N+1, no cartesian blowup), `_normalize_pagination` (clamp 1..100), `_build_filters` (status / is_finalized / patient_id / search `ilike` OR on chief_complaint+clinical_notes). `list_records`, `get_by_patient`, `get_by_id`, `get_by_appointment`, `exists`, `count`. **Update allowlist** `_ALLOWED_UPDATE_FIELDS` = the 11 text fields (id/patient/appointment/status/is_deleted/is_finalized/timestamps immutable here). `update_status` and `finalize_record` (sets `FINALIZED`) are separate methods. `soft_delete` idempotent. `create_patient_record` catches `IntegrityError` → `PatientRecordConflict`. **flush only, never commit** |
| `DiagnosisRepository` | CRUD + `get_by_record` (optional type filter, `created_at DESC`) + `get_patient_id` (join through record) + `count`; allowlist `{diagnosis_type, diagnosis, notes}` |
| `PrescriptionRepository` | CRUD + `get_by_record` (`prescribed_at DESC`, items eager-loaded) + `finalize` (sets `prescribed_at = now(UTC)`) + `count`; allowlist `{notes}` |
| `PrescriptionItemRepository` | CRUD + `get_by_prescription` (`created_at ASC`) + `bulk_create` + `count`; allowlist = all 5 medicine fields |
| `AttachmentRepository` | CRUD + `get_by_record` (`created_at DESC`) + `search` (patient_record_id, attachment_type, `file_name ilike`) + `count`; allowlist excludes `file_path` (immutable) |
| `FollowupRepository` | CRUD + `get_by_record` (`followup_date ASC`) + `get_upcoming` (from/to default today, optional record filter, `followup_date ASC`) + `count`; allowlist `{followup_date, notes}` |
| `AuditLogRepository` | **Append-only**: `create`, `bulk_create`, `get_by_id`, `get_by_record`, `get_by_user`, `list` (record/user/action filters), `count`. No update/delete/soft-delete |

**Search implementation:** substring `ILIKE %term%` (no trigram/full-text). **Sorting:** fixed `created_at DESC` / `prescribed_at DESC` / `followup_date ASC` per repo — **no sort parameters on any endpoint**. **Filtering:** additive AND; only the record list has filters; diagnoses add `diagnosis_type`; attachments have type + file-name in the (unexposed) `search`; audit has record/user/action in the (unexposed) `list`.

---

## 9. Service Layer Review

**Transaction model:** services own `commit()`; repositories only `flush()`. Every state-changing service method: try → validate (validator static methods) → repo write → **audit log write** → `commit()`; on any exception → `rollback()` + re-raise. Read/count methods never touch transactions.

### 9.1 Record lifecycle (`PatientRecordService`)

- **create**: `_assert_patient_exists` + `_assert_appointment_exists` (cross-repo checks via Patient/Appointment repositories) → defensive one-record-per-appointment check (`get_by_appointment`) → build ORM (DRAFT) → audit `PATIENT_RECORD_CREATED` → commit. Conflict → 409.
- **update**: `get_by_id_or_raise` → `assert_not_finalized` + `assert_not_deleted` → `model_dump(exclude_unset=True)` → empty = no-op (no audit) → repo update (allowlist) → audit `PATIENT_RECORD_UPDATED` (`new_value = str(updates)`) → commit.
- **update_status**: guards finalized/deleted only → repo `update_status` → audit `PATIENT_RECORD_STATUS_CHANGED` (old/new) → commit. **No transition legality (O1).**
- **finalize**: guards deleted + not-already-finalized → repo `finalize_record` (is_finalized=True, status=FINALIZED) → audit `PATIENT_RECORD_FINALIZED` (**message hardcodes `status=COMPLETED` — O3**) → commit.
- **delete**: idempotent (already-deleted → early return) → finalized guard → repo `soft_delete` → audit `PATIENT_RECORD_DELETED` → commit.

### 9.2 Child-entity workflows (shared pattern)

Every child create/update/delete: load child → load **parent record** → `PatientRecordValidator.assert_modifiable(parent)` (not deleted, not finalized) → validate payload → persist → audit → commit. This is the **only** immutability enforcement — a finalized record rejects all child mutations with 400.

- **Diagnosis**: create/bulk/update/delete. Update maps schema `diagnosis_name` → model column `diagnosis` (naming mismatch handled in service).
- **Prescription**: create builds `PatientRecordPrescription` with `items=[]` child list attached (atomic). Update = notes only. `finalize_prescription` sets `prescribed_at` (no route). Delete idempotent.
- **Prescription item**: create/bulk/update/delete — resolves child → prescription → record chain.
- **Attachment**: `_validate_file_metadata` — size ≤ 50 MB (else 400 with `max_size` detail) and MIME-per-type (O6 quirk). No storage I/O.
- **Follow-up**: `FollowupValidator.validate_followup_date` on create and on update-if-date-changed (server-local `date.today()`, timezone-naive — O17).
- **Audit**: append-only writes + paginated reads (record/user/action).

### 9.3 Composite orchestrators (NOT exposed — O2)

`PatientRecordOrchestrator`: `create_full_record` (record + diagnoses + prescription), `add_clinical_data` (record + diagnoses + prescription + followup + attachment), `transition_status` (workflow-validated), `complete_and_finalize`, `reopen_and_update`. `ClinicalWorkflowOrchestrator`: `complete_consultation`, `create_full_episode`, `create_treatment_plan`, `finalize_clinical_work`. **All dead code w.r.t. the API** — the frontend must compose these multi-step flows itself from the 39 individual endpoints.

---

## 10. Validator Review

| Validator | Rules | Used by |
|---|---|---|
| `PatientRecordValidator.assert_exists` | record not None → else 400 business rule | exported; effectively unused by services (repos raise `*NotFound`) |
| `PatientRecordValidator.assert_not_deleted` | `is_deleted=False` | record update/status/finalize/delete + all children (via assert_modifiable) |
| `PatientRecordValidator.assert_not_finalized` | `is_finalized=False` | record update/status/finalize/delete |
| `PatientRecordValidator.assert_modifiable` | not deleted **and** not finalized | every child mutation |
| `FollowupValidator.validate_followup_date` | date ≥ `date.today()` | follow-up create + update |
| Schema-level validators | strip → non-empty → else 422 (medicine/diagnosis/attachment required text) | Pydantic layer |

**Dead stubs:** `prescription_validator.py`, `diagnosis_validator.py`, `attachment_validator.py`, `workflow_validator.py` are empty files and not exported. `WorkflowRules` (existence/ownership/transition-prereqs) is **not called by any route** (O2).

---

## 11. Workflow Analysis

### 11.1 The state machine (as designed — `workflow/state_machine.py`)

```
DRAFT ──────► IN_PROGRESS ──────► UNDER_REVIEW ──────► COMPLETED ──────► FINALIZED (terminal)
  ▲                │  ▲                 │   ▲                 │
  │                │  │                 │   │                 │
  └────────────────┘  └─────────────────┘   └─────────────────┘
   IN_PROGRESS→DRAFT      UNDER_REVIEW→IN_PROGRESS   COMPLETED→IN_PROGRESS
   (write roles)          (ADMIN: revision request)  (ADMIN: reopen)
```

| Transition | Roles (as designed) | Prerequisites |
|---|---|---|
| DRAFT → IN_PROGRESS | ADMIN + RECEPTIONIST + doctors | — |
| IN_PROGRESS → UNDER_REVIEW | doctors only | `chief_complaint` required |
| UNDER_REVIEW → COMPLETED | ADMIN | — |
| COMPLETED → FINALIZED | ADMIN | must be COMPLETED, `needs_confirmation=True` |
| IN_PROGRESS → DRAFT | ADMIN + RECEPTIONIST + doctors | — |
| UNDER_REVIEW → IN_PROGRESS | ADMIN | — |
| COMPLETED → IN_PROGRESS | ADMIN | not finalized |

**⚠️ What is actually enforced over HTTP:** `PATCH /patient-records/{id}/status` performs **none** of the above. Only `is_finalized`/`is_deleted` guards apply. The API accepts any enum value for any record owned by a ⭐-role user. `FINALIZED` and `LOCKED` are accepted as direct targets.

### 11.2 The record lifecycle (as actually enforceable)

```
[POST /patient-records] → DRAFT
   ↓ PATCH (edit fields) — repeatable while not finalized
   ↓ add children: diagnoses / prescriptions(+items) / follow-ups / attachments
   ↓ PATCH /status?new_status=<any of 6>  (⭐ roles)
   ↓ POST /finalize {confirm:true}        → is_finalized=true, status=FINALIZED  (⭐ roles)
   ↓ DELETE (ADMIN)                       → is_deleted=true (soft delete, hidden)
```

- **Immutability:** after finalize, ALL mutations (record + children) return 400. Finalized records also cannot be deleted (400).
- **Soft-delete:** `is_deleted=true` hides from every default read (list, get, by-appointment, by-patient, child lists). No restore endpoint exists.
- **Versioning:** none beyond the append-only audit log (O9). No timestamps per-field, no snapshot/restore.

---

## 12. Authentication & RBAC

### 12.1 Authentication

- **Bearer JWT** via `OAuth2PasswordBearer(tokenUrl="/auth/login")`; `get_current_user` decodes `sub` (email), loads the User with `selectinload(User.role)`, rejects missing/inactive users with **401** (`WWW-Authenticate: Bearer`). Expired/malformed → 401.
- Every one of the 39 endpoints is protected — **no public endpoints** in this module.

### 12.2 Role matrix (exact)

| Operation | Allowed roles | Dependency |
|---|---|---|
| Read records + all children + upcoming follow-ups | 🅰 = `{ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` | `require_patient_record_read` |
| Create/update/delete **children** + create/update record | 🅰 (same set) | `require_patient_record_write` |
| Change status + finalize | ⭐ = 🅰 minus RECEPTIONIST (`{ADMIN, 4×doctor}`) | `require_patient_record_status_change` |
| Soft-delete record | 🗑 = `{ADMIN}` | `require_patient_record_delete` |
| Audit endpoints | 👑 = `{ADMIN, CHIEF_DOCTOR}` | `require_audit_read` → `require_admin` |

- **DENTAL_ASSISTANT is excluded from every endpoint.**
- 403 messages: `"Role not assigned"` (user has no role) / `"Insufficient permissions"` (wrong role) — both via `HTTPException`, wrapped by the global handler as `{success:false, message, details:null}`.
- **No ownership checks** anywhere (O11): no doctor/patient scoping, no "creator only" rules. The frontend may filter/display by actor for UX, but the backend enforces nothing.

### 12.3 What the frontend can and cannot infer

- The client knows the authenticated user's role (existing RBAC context). It **cannot** infer allowed transitions from the API (no such endpoint) — it must hardcode the matrix if it wants to show/hide status controls (and must decide whether to enforce the designed state machine client-side, since the backend will accept anything).
- The client can safely gate: record delete → ADMIN; audit tabs → ADMIN/CHIEF_DOCTOR; status change UI → ADMIN + doctor roles (receptionist sees read-only). Backend remains authoritative.

---

## 13. Search / Filtering / Pagination

| Endpoint | Search | Filters | Sort (fixed) | Pagination |
|---|---|---|---|---|
| `GET /patient-records` | `search` → `chief_complaint` OR `clinical_notes` ILIKE substring | `status` (enum, invalid → 422), `is_finalized` (bool), `patient_id` (UUID) | `created_at DESC` | `page`(≥1), `page_size`(1–100, default 20) → `pages` |
| `GET /patient-records/patient/{id}` | — | patient only | `created_at DESC` | same |
| `GET .../diagnoses` | — | `diagnosis_type` | `created_at DESC` | same |
| `GET .../prescriptions` | — | — | `prescribed_at DESC` | same |
| `GET .../items` | — | — | `created_at ASC` | same |
| `GET .../attachments` | — | — | `created_at DESC` | same |
| `GET .../followups` | — | — | `followup_date ASC` | same |
| `GET /followups/upcoming` | — | `from_date` (default today), `to_date` (default = from), `patient_record_id` | `followup_date ASC` | same |
| `GET .../audit` | — | — | `performed_at DESC` | same |
| `GET /audit/user/{id}` | — | — | `performed_at DESC` | same |

- **No sort parameters anywhere**; no count endpoints (all `count_*` service methods unexposed); no type-ahead endpoint; attachments `search` (file-name) unexposed.
- Empty results return `{items: [], total: 0, page, page_size, pages: 0}` (200).

---

## 14. Error Handling

### 14.1 Envelope (what the frontend actually receives)

Every error response body is `{"success": false, "message": "<string>", "details": <object|null>}`. **Error codes are NOT transmitted** (O13) — the `code` attribute exists only server-side.

### 14.2 Status-code map (from `_PATIENT_RECORD_EXCEPTION_MAP` in `core/exception_handlers.py`)

| HTTP | Trigger |
|---|---|
| **400** | `PatientRecordBusinessRule`: finalized/deleted mutation, past follow-up date, bad MIME/size, record/appointment/patient missing (business-rule variants), invalid workflow preconditions (unreachable via API) |
| **401** | Missing/expired/invalid/inactive-user JWT — `"Could not validate credentials"` (WWW-Authenticate: Bearer) |
| **403** | Role denied — `"Role not assigned"` / `"Insufficient permissions"` |
| **404** | `PatientRecordNotFound`, `DiagnosisNotFound`, `PrescriptionNotFound`, `PrescriptionItemNotFound`, `AttachmentNotFound`, `FollowupNotFound` (each message embeds the id); also missing audit entry → 404 with `PATIENT_RECORD_NOT_FOUND` code (O15) |
| **409** | `PatientRecordConflict` — appointment already has a record |
| **422** | Pydantic request-validation failures (sanitized `details` array); also `Literal[True]` confirm violations |
| **500** | Unhandled exceptions → `"An unexpected error occurred"` (no stack trace) |

### 14.3 Known status quirks

- Past follow-up date → **400** (not 422) — it is a business rule, not a schema error.
- `PATCH /status` with an invalid enum string → **422** (FastAPI query-enum parse).
- Attachment file > 50 MB → **400** with `details = {file_name, file_size, max_size}`.
- Duplicate appointment record on create → **409** (defensive check raises `PatientRecordConflict` before the DB unique constraint).

---

## 15. Clinical Capability Assessment (Critical)

### 15.1 Prescription Management — ✅ **IMPLEMENTED (partial)**

**Yes, prescriptions exist** with full item CRUD, but **no** approval, printing, refill, or status lifecycle:

| Capability | Status | Notes |
|---|---|---|
| Prescription CRUD | ✅ | Create (with 1–20 items, atomic), get, list, **update = notes only**, soft-delete |
| Medicine items | ✅ | medicine_name / dosage / frequency / duration / instructions; single + bulk create, update, delete |
| `prescribed_by` capture | ✅ | Set to `current_user.id` at creation (int user id) |
| `prescribed_at` | ✅ | DB `server_default=now()`; `finalize_prescription` (sets UTC now) exists but **has no route** |
| Approval workflow | ❌ | Not implemented (no status field, no approval endpoints) |
| Print / PDF | ❌ | Not implemented |
| Refill | ❌ | Not implemented |
| Structured medication model | ❌ | Free-text strings only (no medication catalog, dosage form, units) |

### 15.2 Clinical Notes — ✅ **IMPLEMENTED (free-form)**

- `clinical_notes` (≤ 10,000), `doctor_remarks` (≤ 5,000), `treatment_recommendation` (≤ 5,000) on the record.
- **No SOAP structure**, no progress/treatment note entities, no templated observations, no per-note audit separation (any record edit audits as `PATIENT_RECORD_UPDATED` with a stringified diff).

### 15.3 Diagnosis — ✅ **IMPLEMENTED (uncoded)**

- `DiagnosisCreate/Update` with `diagnosis_type` (`PROVISIONAL | CONFIRMED`), free-text name (2–255) + notes (≤ 2,000).
- **No ICD codes**, no dental code system (e.g. FDI classification), no structured chief-complaint taxonomy (chief complaint is free text).

### 15.4 Medical History — ✅ **IMPLEMENTED (free-text only)**

- `systemic_diseases`, `surgeries`, `medications`, `habits`, `medical_alerts`, `allergies`, `dental_history` — each a single ≤ 5,000-char text field on the record.
- **No structured allergies/medications/alerts entities**; `AllergySeverity` enum is dead code; no medication interaction/alerts engine.

### 15.5 Vital Signs — ❌ **NOT IMPLEMENTED.** No vitals model, schema, or endpoint exists.

### 15.6 Odontogram — ❌ **NOT IMPLEMENTED.** No odontogram/tooth-chart model or endpoint exists. (Tooth-level detail lives only in the separate treatment-plan module.)

### 15.7 Images / Files / Attachments — ⚠️ **METADATA ONLY**

- Attachment **metadata** CRUD exists (type/file name/path/MIME/size), MIME + 50 MB validation.
- **No multipart upload, no file storage, no download/serve endpoint.** X-rays/intraoral photos/attachments cannot be uploaded or retrieved as content via this API (O5).

### 15.8 Clinical Timeline — ✅ **PARTIAL**

- Append-only **audit log** per record (`performed_at DESC`) gives an action timeline (created/updated/status/finalize/delete + child events).
- No per-child dedicated timeline endpoints (the audit log covers it); no separate "episodes" model.

### 15.9 Record Versioning — ❌ **NOT IMPLEMENTED**

- No snapshots/restore. Audit `old_value`/`new_value` strings are the only change history (O9).

---

## 16. Frontend Contract — Implementable Screens (backend-grounded only)

> ✅ = directly supported by live endpoints. ⚠️ = supported with caveats. ❌ = **do not build** (no backend support).

| Screen | Verdict | Backend evidence |
|---|---|---|
| **Patient Records list page** (search + status/finalized/patient filters + pagination) | ✅ | `GET /patient-records` (#2) |
| **Patient Records by patient** (on patient detail page) | ✅ | `GET /patient-records/patient/{id}` (#5) |
| **Record detail page** (clinical fields + medical history + counts + tabs) | ✅ | `GET /patient-records/{id}` (#3) |
| **Create record** (from appointment/patient context) | ✅ | `POST /patient-records` (#1) — needs appointment_id + patient_id |
| **Record-by-appointment lookup** (on appointment detail page) | ✅ | `GET /patient-records/appointment/{id}` (#4) → 404 if none → CTA to create |
| **Edit record** (clinical/medical fields) | ✅ | `PATCH /patient-records/{id}` (#6); null clears |
| **Status change control** | ⚠️ | `PATCH /status?new_status=` (#7) — backend accepts anything; UI must hardcode the intended state machine + roles (O1) |
| **Finalize record** (confirm dialog) | ✅ | `POST /{id}/finalize` with `{"confirm": true}` (#8) |
| **Delete record** (admin-only, confirm) | ✅ | `DELETE /{id}` (#9) → 204 |
| **Diagnoses section** (list/create/edit/delete + type filter) | ✅ | #10–14 |
| **Prescriptions section** (create w/ item editor, list, notes edit, delete) | ✅ | #15–19 |
| **Prescription items management** (add/bulk-add/edit/delete) | ✅ | #20–25 |
| **Follow-ups section** (schedule/list/edit/delete; today-or-future picker) | ✅ | #31–36 |
| **Upcoming follow-ups dashboard widget** | ✅ | `GET /followups/upcoming` (#33) — date-range |
| **Attachments section** (file metadata cards: type/name/size; register/edit/delete) | ⚠️ | #26–30 — metadata only; **no file picker upload, no preview/download** |
| **Audit trail view** (admin-only tab; by record / by user / single) | ✅ | #37–39 + nested `audit_logs` in #3 |
| Patient Records Dashboard (stat cards) | ⚠️ | No dashboard endpoint — compose from list counts client-side |
| **Odontogram / tooth chart** | ❌ | Not implemented |
| **Vitals entry/view** | ❌ | Not implemented |
| **Prescription print view** | ❌ | Not implemented |
| **Attachment upload / X-ray viewer** | ❌ | Metadata only — no file endpoints |
| **Structured SOAP / ICD diagnosis editor** | ❌ | Free text only |
| **Medical-history structured editor** (allergy severity, med list) | ❌ | Free text only |
| **Record version history / restore** | ❌ | Audit only |

---

## 17. Reuse Opportunities (no duplicate implementations)

| Need | Reuse from existing frontend |
|---|---|
| Record list | `components/common/DataTable` + `DataTableToolbar` + `Pagination` (pattern: `PatientTable`, `DoctorTable`) |
| Filters bar | `SearchBar`, `Select`, `DatePicker` (pattern: `PatientFilters`, `AppointmentFilters`) |
| Create/edit forms | `Drawer` + `Form` system (`FormField`, `FormActions`, `ValidationSummary`) + zod schemas (pattern: `PatientForm`/`DoctorForm`, `utils/patientFormSchema.ts`) |
| Confirmations | `Modal` + existing dialog pattern (`DeleteProcedureDialog`, `CancelAppointmentDialog`); finalize → `ConfirmTransitionDialog` pattern |
| Status/finalized badges | `StatusBadge`, `Badge` (pattern: `PatientStatusBadge`, `TreatmentPlanStatusBadge`) |
| Detail layout | `PageHeader`, `DescriptionList`, `Tabs`, `Card`, `Section` (pattern: `PatientDetailsPage` + `DoctorDetailsPage`) |
| Audit/timeline | `Timeline` component + `PlanActivityCard` pattern |
| Dashboard widget | `StatCard` (pattern: `ActiveTreatmentPlansCard` for the upcoming follow-ups widget) |
| RBAC gating | `PermissionGate` / `RequireRole` (record delete → ADMIN; audit → admin roles) |
| Data fetching | react-query hooks pattern (`hooks/*/use*QueryKeys`, `use*`, `use*Mutations`) + `services/api.ts` + `apiError.ts` |
| Routing | `routes.ts`/`routeMeta.ts`/`AppRouter` lazy-loading pattern (mirror `ROUTES.TREATMENT_PLANS`) |
| Dates & formatting | `utils/date.ts`, `utils/formatting.ts` |
| Empty/loading/error | `EmptyState`, `Skeleton`, `ResultState`, `Spinner`, `Toast` |
| Type/API contracts | One `types/patientRecord.ts` + `services/patientRecordService.ts` (mirror `treatmentPlanService.ts`); one `constants/patientRecord.ts` for status/enum maps |

---

## 18. Risks & Gaps

### 🔴 Critical

| # | Risk | Impact on frontend |
|---|---|---|
| R1 | **Status state machine unenforced (O1)** | Any ⭐ user can set any status. A finalized record still cannot be edited (guard holds), but DRAFT→FINALIZED skips review. Frontend must (a) hardcode the designed transition map, (b) decide policy: expose only legal transitions, and/or (c) flag to backend to wire the workflow layer. |
| R2 | **No file upload/download (O5)** | Attachments UI is metadata-only. If X-ray/photo capture is a sprint goal, a **new backend capability** (multipart upload + storage + download) is required — out of scope for this contract. |
| R3 | **Workflow/orchestrator APIs unexposed (O2)** | Multi-step clinical flows (record+diagnoses+prescription in one call; complete+finalize) must be built client-side from 39 endpoints; no single-call composite exists. |

### 🟠 Medium

| # | Risk | Impact |
|---|---|---|
| R4 | Audit embedded in record detail for all read roles (O4) | Do not hide the audit tab behind admin in the *detail* page; keep standalone audit endpoints admin-gated. |
| R5 | Finalize status semantics (O3) | UI must display `FINALIZED` (not "Completed") after finalize despite docs/audit text. |
| R6 | Prescription lifecycle absent (O7) | No print/approve/refill/status. `prescribed_at` is set at creation; "finalize" is invisible. |
| R7 | No ownership scoping (O11) | Any doctor sees/edits all records; no "my patients" isolation. Don't build trust on it. |
| R8 | No search over diagnoses/prescriptions/medical history (O12) | List search only covers chief complaint + clinical notes. |
| R9 | Error codes stripped (O13) | Branch on HTTP status + message; treat `details` as opaque-ish context. |
| R10 | MIME validation loopholes (O6) | PDF/REPORT accept any known MIME; VIDEO unreachable. Validate client-side if it matters. |
| R11 | `exclude_unset` + `null` semantics | For text fields, explicit `null` clears; omitted keys are untouched. Attachments `file_path` cannot be changed after create. |

### 🟡 Minor

| # | Risk | Impact |
|---|---|---|
| R12 | `PATCH /status` uses a query param (O10) | Construct `?new_status=` URLs correctly in the API client. |
| R13 | Missing audit entry → 404 with record-not-found code (O15) | Surface as "audit entry not found"; don't map to record logic. |
| R14 | Ordering inconsistencies (O14) | Follow-ups sorted soonest-first; prescription items oldest-first. |
| R15 | Follow-up date validated against server-local today (timezone-naive) | A date that is "today" in the client's timezone may be "yesterday" server-side (400). Send dates in server-local context; consider a date-picker with a min of tomorrow to be safe. |
| R16 | No `total_pages`-style naming variance — all lists use `pages` | Consistent; reuse one TypeScript `PaginatedResponse<T>` interface. |
| R17 | Audit `old_value`/`new_value` are opaque strings | Display as text; never parse for diff rendering. |

---

## 19. Recommendations (backend-grounded)

1. **Wire the workflow layer or constrain the status endpoint (backend).** Either route `PATCH /status` through `TransitionValidator`/`PatientRecordWorkflow` (enforcing DRAFT→IN_PROGRESS→UNDER_REVIEW→COMPLETED→FINALIZED + the `chief_complaint` prerequisite + role gates) or accept the current free-form status and document it. Until then, frontend should hardcode the transition matrix and disable illegal moves in UI (the backend will not reject them).
2. **Expose the already-built composite endpoints** (`DiagnosisService.bulk_create`, `AttachmentService.bulk_upload`/`search_attachments`, `PrescriptionService.finalize_prescription`, `count_*`, and the orchestrator workflows) — they are fully implemented, tested-adjacent, and would collapse multi-call frontend flows into one.
3. **Fix the finalize audit message + router description** to say `FINALIZED` (O3).
4. **Fix `AttachmentType`/MIME alignment** (O6) — add explicit PDF/REPORT/SCAN mappings and drop the unreachable VIDEO/OTHER branches.
5. **If attachments must hold real files**, add `multipart/form-data` upload + storage + `GET` download endpoints (new backend scope, not in this contract).
6. **Frontend build order (dependency-safe):**
   1. Service layer + types + query keys + hooks (list/get/mutations per family).
   2. Records list + filters + pagination; record detail with tabs (clinical / diagnoses / prescriptions / follow-ups / attachments / audit).
   3. Create + edit + finalize + delete flows (with `PermissionGate` for delete; confirm dialogs everywhere).
   4. Diagnoses, prescriptions (+ items, incl. bulk), follow-ups (+ upcoming widget), attachments metadata sections.
   5. Audit view (admin) + by-appointment / by-patient integrations.
7. **Do not build** (per Section 16 ❌): odontogram, vitals, structured SOAP/ICD, prescription print, file upload/download, record version restore.

---

## 20. Frontend Readiness Assessment

### 20.1 Scope estimate

| Area | Effort (relative) | Notes |
|---|---|---|
| Types + service + query hooks (6 families) | Medium | Mirrors `treatmentPlanService.ts` patterns; ~40 endpoints to map |
| Records list + filters + pagination | Medium | DataTable reuse; search (chief complaint/notes), status + finalized + patient filters |
| Record detail (tabs + counts + audit trail) | Medium–High | Full nested payload; per-section child lists |
| Create/edit/finalize/delete workflows | Medium | Drawer forms + zod; confirm dialogs; PermissionGate (delete=ADMIN) |
| Diagnoses + Prescriptions (+items, bulk) | Medium | Item editor with dynamic rows; bulk add; notes-only update |
| Follow-ups + upcoming widget | Low–Medium | Date validation (today-or-future); dashboard card |
| Attachments metadata UI | Low | Cards/table; no upload/download |
| Routing + nav + routeMeta | Low | Mirror procedures/treatmentPlans wiring; lazy-load |

**Estimated total: a 1–2 week focused sprint** at the same cadence as Sprint 12A treatment plans.

### 20.2 Dependencies

- Backend: none required for the core module — all 39 endpoints are live. **Optional** backend follow-ups: workflow wiring (R1), composite endpoints (recommendation 2), file upload (R2 — would expand scope).
- Frontend: existing `DataTable`, `Drawer`, `Form`, `Modal`, `PermissionGate`, react-query infra, `api.ts`. No new libraries.

### 20.3 Key risks recap

1. State-machine enforcement gap (R1) — the #1 product-behavior risk.
2. Attachments are metadata-only (R2) — set expectations with stakeholders.
3. Free-text-only clinical content (medical history, notes, diagnosis names) — no structured ICD/allergy/vitals.

### 20.4 Definition of done (suggested)

- [ ] `patientRecordService.ts` + `types/patientRecord.ts` + `constants/patientRecord.ts` (status/enum/audit-action maps) with unit tests
- [ ] Records list page (search/filters/pagination) + detail page (tabs) + by-appointment + by-patient integrations
- [ ] Create / edit / finalize / delete flows with RBAC gating
- [ ] Diagnoses, prescriptions (+ items, bulk), follow-ups (+ upcoming dashboard widget), attachments metadata sections
- [ ] Audit view for admin roles
- [ ] Routing/nav/routeMeta wiring; lazy-loaded chunks
- [ ] Tests: service layer, schema zod, hooks, list/detail pages, routing — mirroring existing module test suites
