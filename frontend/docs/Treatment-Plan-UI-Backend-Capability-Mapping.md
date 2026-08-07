# Treatment Plan UI ↔ Backend Capability Mapping (Sprint 12A)

> **Document type:** Sprint 12A Phase 2 deliverable — UI ↔ Backend Capability Mapping (implementation blueprint)
> **Scope:** Treatment Plan + Procedure Catalog frontend, built on the **approved UI design** and the **verified backend implementation**.
> **Inputs:**
> - Backend (single source of truth): `frontend/docs/Treatment-Plan-Backend-Contract-Review.md` (verified against `backend/app/modules/treatment/`, 2026-08-06) — cross-referenced as **[BCR]** throughout.
> - UI design (approved UX): `frontend/docs/DensCare-Treatment-Modules-Part-2.5.md` — cross-referenced as **[P2.5]**; `docs/frontend/UI_MASTER_SPECIFICATION.md` §9 — cross-referenced as **[MS]**.
> **Status:** ✅ COMPLETE — no frontend implementation begins until this blueprint is accepted.
> **Date:** 2026-08-06

**Reading convention:** `O1`–`O12` = backend implementation observations in [BCR §1.4]; `R1`–`R18` = risks in [BCR §17]. "✅ Supported" means the backend endpoint exists, is verified, and the UI element maps 1:1. "⚠️ Partial" means the element maps to a backend capability but with a documented limitation or quirk. "❌ Unsupported" means **no backend capability exists** — the UI element must be hidden, disabled, rendered read-only, or deferred. No client-side workarounds are invented for unsupported items.

---

## 1. Executive Summary

### 1.1 Overall assessment

The approved Treatment Plan UI (13 screens) and the verified backend implementation are **strongly aligned on the core clinical workflow**: create plan → compose items → review → propose → doctor-approve/patient-acknowledge → accept → start → hold/resume → complete/cancel, plus the admin-managed procedure catalog and an immutable versioning trail. Of the 13 approved screens, **9 are fully implementable against the verified backend**, **2 are partially implementable with explicit scope cuts** (Procedure Execution, Treatment Progress), and **2 are placeholder/integration surfaces that must be deferred** (Clinical Attachments, Treatment Timeline event stream).

The dominant pattern behind the gaps is consistent: **the backend implements a plan-level state machine but no item-level state machine, no plan-header mutation, and no plan deletion**. Every UI feature that assumed item-status transitions, post-creation header editing, plan delete/archive, or "return to draft" is **unsupported** and must be rendered read-only/disabled/hidden rather than worked around client-side.

### 1.2 Compatibility score

| Dimension | Score | Notes |
|---|---|---|
| Screen coverage (13 screens) | **4.6 / 5** | 9 fully supported; 2 partial (S-09, S-10); 2 deferred (S-11, S-12) |
| Element coverage (visible elements → backend source) | **4.3 / 5** | Every element has a source or an explicit "unsupported" disposition; no unmapped elements remain |
| Action coverage | **4.0 / 5** | All plan-level transitions supported; item-status actions, header edit, delete, print/download, attachments unsupported |
| Contract fidelity (schema/status/error alignment) | **4.5 / 5** | Verified schemas match UI fields; error envelope `{success,message,details}` matches existing `apiError.ts` |
| Overall | **4.3 / 5 (≈ 86%)** | Implementation-ready with documented scope exclusions |

### 1.3 Major findings

| # | Finding | Severity | Reference |
|---|---|---|---|
| F1 | **Plan header is immutable after creation** — no `PATCH /treatment-plans/{id}` exists. `clinical_notes`, `observations`, `dentist_recommendations`, `valid_from`, `valid_to` are create-only. The approved "Edit Plan" affordance must be re-scoped to **item editing only**; there is no plan-header edit form. | 🔴 | O1 / R1 |
| F2 | **Item status is permanently `pending`** — no item-transition endpoint exists. The entire Procedure Execution screen (S-09: Start / Complete / Cancel / Defer item) and the dynamic Treatment Progress card (S-10) cannot work as designed. | 🔴 | O2 / R2 |
| F3 | **No plan delete / deactivate / archive** — no delete action anywhere on plans. | 🟠 | O3 / R3 |
| F4 | **Approved UI revision flows conflict with the state machine** — UI's "REVISE AND RESUBMIT" from REJECTED and [P2.5 §12.3]'s decline→revise→resubmit flow are **not implementable**: `rejected` is not item-editable and there is no `rejected→draft` endpoint (O12). The correction path is **edit-in-place while PROPOSED** (items remain editable) or **cancel → create new plan**. | 🟠 | O12 / R7 |
| F5 | **No patient/doctor names in plan payloads** — list items and detail carry only UUIDs. All 13 screens that render patient/doctor names must resolve them via the patient/doctor services. | 🟠 | R10 |
| F6 | **No ownership enforcement on the backend** — any of the six allowed roles can act on any plan. The approved UI's owner-check pattern ([P2.5 §15.4]) is a **recommendation only**; do not implement a hard client-side owner gate that the backend does not enforce. UX-level hints (tooltips) are permitted. | 🟡 | BCR §3.1 |
| F7 | **Error codes are stripped** — real envelope is `{success, message, details}`; branch on HTTP status, display `message`. Existing `parseApiError` is compatible. | 🟠 | O4 / R4 |
| F8 | **`pending_acknowledgment` dashboard count is not actionable** — counts ACCEPTED plans with pending patient status, but the acknowledge endpoint requires PROPOSED. Render as count-only card, never a clickable queue. | 🟡 | O7 / R6 |
| F9 | **Billing "💰 Generate Invoice" is a cross-module integration** — not part of the treatment backend contract. Requires the billing module contract (Part 2.7) before implementation. | 🟡 | P2.5 §3.5/§3.9, §12.5 |
| F10 | **Tooth surface/quadrant/arch cross-validation absent** — backend accepts any 1–10 char surface string and any combination. Frontend may validate for UX but must not reject what the backend accepts. | 🔵 | O8 / R12 |

### 1.4 High-risk areas

| Risk | Why it is high-risk | Mitigation in this blueprint |
|---|---|---|
| HR1: Item-status UI (S-09, S-10) | Would require backend work not in contract; shipping disabled buttons that "look" functional creates false affordance | Ship read-only status rendering + "deferred" note; escalate item-transition endpoint as backend backlog (§11, §15) |
| HR2: Create form completeness | Header fields can never be corrected later; typo = new plan | Create flow validation must mirror all backend bounds; "review before create" summary step recommended (§6) |
| HR3: Name resolution (F5) | Parallel lookups across modules add latency and failure modes | Central `resolvePatientDoctorNames` helper + React Query caching (§13) |
| HR4: Concurrency | Optimistic-lock conflict surfaces as **500**, not 409 — cannot be distinguished from server error | Single-user edit flows; generic retry toast; refetch-after-mutation resync (§9.1, §13) |
| HR5: State machine duplication | No transition endpoint; frontend must hardcode the map; drift = dead buttons or 409s | Single `utils/treatmentPlanStateMachine.ts` + `PlanTransitionActions` component + table-driven tests (§12, §15) |

### 1.5 Implementation readiness

**READY — Sprint 12A implementation can begin**, provided the scope exclusions in §11 (Unsupported UI Elements) are accepted as part of the definition of done. The core workflow (list → create → items → transitions → approval → versions) is fully backend-supported. See §15 for the recommended build order.

---

## 2. Screen Inventory

The 13 approved screens are the union of [P2.5] (12 named screens) and [MS §9] (5 screens, 4 of which overlap); the 13th is the **Doctor Dashboard "My Active Treatment Plans"** widget ([P2.5 §6.2 "Progress by Doctor View"], [MS §8 `ActiveTreatmentPlansCard`]), which is part of the approved treatment UX and consumes treatment endpoints. Reconciliation is noted under each screen.

| ID | Screen | Purpose | Primary user | Entry points | Exit paths | Backend dependencies |
|---|---|---|---|---|---|---|
| S-01 | **Treatment Plan List** ([P2.5 §3.4], [MS §9.1]) | Search, filter, browse all plans | Doctors, Admin, Receptionist | Sidebar → Treatment Plans; Patient Profile → Treatment Plans tab; Doctor Dashboard summary card | Row click → S-02; "Create Plan" → S-03 | `GET /treatment-plans`, `/search`, `/dashboard`, `/count-by-status`; patient/doctor name resolution |
| S-02 | **Treatment Plan Detail** ([P2.5 §3.5], [MS §9.3]) | Full plan: header, items, totals, workflow bar, actions, tabs (Details / History / Approval) | Doctors | S-01 row click; Patient Profile tab; Doctor Dashboard card | Back → S-01; transition actions; "Generate Invoice" → billing module | `GET /treatment-plans/{id}` + all transition/approval/version endpoints |
| S-03 | **Create Treatment Plan** ([P2.5 §3.6], [MS §9.2]) | Create DRAFT plan with clinical header | Doctors | S-01 "Create Plan"; Patient Profile → Create Plan | Submit → redirect to S-02; Cancel → back | `POST /treatment-plans`; patient list + doctor list |
| S-04 | **Edit Treatment Plan / Add Items** ([P2.5 §3.7]) | Add/update/remove/reorder items (editable statuses only) | Doctors | S-02 "Edit Plan" / "Add Item"; contextual | Save → refresh S-02; Cancel | `POST/PATCH/DELETE items`, `PUT items/reorder`; `GET /procedures/active` + `/search` |
| S-05 | **Version History / Version Diff** ([P2.5 §3.8], [MS §9.5]) | List snapshots, view diff, restore | Doctors, Admin | S-02 → "Versions" / History tab | Restore → confirm → S-02; Back | `GET/POST /versions`, `GET /versions/{id}`, `POST /versions/{id}/restore` |
| S-06 | **Approval Status** ([P2.5 §3.9]) | Doctor approval + patient acknowledgment management | Doctors, Admin (read: all 6 roles) | S-02 → "Approval Status" tab | Approve/Acknowledge/Decline → refresh S-02 | `doctor-approve/revoke`, `patient-acknowledge/decline` |
| S-07 | **Procedure Catalog** ([P2.5 §4.4], [MS §9.4]) | Browse/search/manage procedure master catalog | Admin, Chief Doctor (write); all (read) | Sidebar → Administration → Procedure Catalog | Row → S-08; "New Procedure" → S-08 | `GET /procedures` (+filters), `/search`, `/count` |
| S-08 | **Create/Edit Procedure** ([P2.5 §4.5]) | Create/update procedure (code immutable on edit) | Admin, Chief Doctor | S-07 | Save → S-07; Cancel | `POST /procedures`, `PATCH /procedures/{id}`, `activate/deactivate` |
| S-09 | **Procedure Execution View** ([P2.5 §5.2]) | Start/complete/cancel/defer individual items, save notes | Doctors | S-02 → click item; Doctor Dashboard active item | Back → S-02 | ⚠️ Item transitions **unsupported** (O2); only `PATCH item {notes}` supported |
| S-10 | **Treatment Progress** ([P2.5 §6.2]) | Per-plan progress summary card + doctor dashboard progress list | Doctors | Embedded in S-02; Doctor Dashboard | — | ⚠️ Progress derived from `item_status` which is always `pending` (O2); totals from list item fields |
| S-11 | **Clinical Attachments** ([P2.5 §7.2]) | X-rays/scans linked to plan items | Doctors | Embedded in S-09 | — | ❌ **Unsupported** — no attachment entity/endpoint in treatment module (metadata-only, [P2.5 §7.1]); use Patient Records attachments |
| S-12 | **Treatment Timeline** ([P2.5 §11.2], [MS §8 Patient Profile]) | Chronological treatment activity on patient profile | Doctors, Admin | Patient Profile → Timeline tab | — | ⚠️ Partial — plan **created** + **version** events reconstructable; status-transition/approval/item event stream **not exposed** |
| S-13 | **Doctor Dashboard — My Active Treatment Plans** ([P2.5 §6.2 "Progress by Doctor View"], [MS §8]) | Active plans for current doctor with progress | Doctors | Dashboard → Active Treatment Plans card | Row → S-02 | `GET /treatment-plans/by-doctor/{doctor_id}`; `GET /treatment-plans/dashboard` |

**Roles key** (verified, [BCR §3]): plan roles 🅰 = `ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR`; procedure-write ⭐ = `ADMIN, CHIEF_DOCTOR`. `DENTAL_ASSISTANT` is excluded from every treatment endpoint (R16).

---

## 3. Screen-by-Screen Capability Mapping

Common conventions used below:

- **Error envelope** everywhere: `{success: false, message, details}`; branch on HTTP status ([BCR §14]).
- **Money** in responses = JSON numbers; inside version snapshots = **strings** ([BCR §6.4/§6.6]).
- **Patient/doctor names** are never in payloads; assume name resolution via `resolvePatientDoctorNames` (R10) unless stated otherwise.
- **Loading:** `Skeleton`/`LoadingOverlay`; **empty:** `EmptyState`; **error:** `ResultState` + toast via `parseApiError` (all existing components, §12).

### 3.1 S-01 — Treatment Plan List

**Layout ([P2.5 §3.4], [MS §9.1]):** PageHeader ("Treatment Plans" + ➕ Create Plan) → toolbar (SearchBar + filters: Status / Doctor / Date Range / Active Only + Clear) → DataTable (Plan Code · Patient · Doctor · Status · Items · Cost · Created) → Pagination.

| Element | Backend mapping |
|---|---|
| Search box (debounced 300ms) | `GET /treatment-plans?search=` — matches `plan_code` OR patient `first_name`/`last_name` (case-insensitive). ⚠️ Does **not** match doctor name — the UI placeholder "search by … or doctor" is **unsupported for doctor** ([BCR §13]). |
| Status filter | `GET /treatment-plans?status=<enum>` — exact match; invalid value → **422** ([BCR §4.3]) |
| Doctor filter | `GET /treatment-plans?doctor_id=<uuid>` — exact match ✅ |
| Patient filter (from patient context) | `GET /treatment-plans?patient_id=<uuid>` or dedicated `GET /treatment-plans/by-patient/{id}` ✅ |
| Date range filter (created_at) | `date_from` / `date_to` — **must always send `YYYY-MM-DD`**; any other format → **500** (O6) |
| Active Only toggle | `is_active` (bool) — supported; note all API-created plans are `is_active: true` (no deactivate endpoint, O3) |
| Sort | `sort_by ∈ {created_at, updated_at, status, plan_code}` + `sort_order ∈ {asc, desc}`; default `created_at desc`; unknown `sort_by` silently falls back to `created_at` ([BCR §4.3]) |
| Pagination | `page` (≥1), `page_size` (1–100, default 20); response `total_pages` drives the pager directly ([BCR §6.1]) |
| Patient / Doctor name columns | Resolved via patient/doctor services (F5/R10) |
| Status column | `status` → `StatusBadge` color map (§5.1) |
| Items / Total Estimated Cost columns | `item_count`, `total_estimated_cost` from list item ✅ |
| Version chip | `current_version` ✅ |
| Create Plan button | → S-03 (requires ≥1 active patient and ≥1 active doctor to be meaningful) |
| Row actions (View / transition menu) | View → S-02. Inline transitions not available from list (no endpoint conflict — legal, but plan detail is the canonical action surface); pending-review/approval queues give list-level actions |
| **Permissions** | 🅰 read (`GET /treatment-plans`) |
| **Loading / Empty / Error** | Skeleton rows → `EmptyState` ("No treatment plans found" + Create CTA) / no-results message → `ResultState` 403 or toast |

**Pending queues (optional UI):** `GET /treatment-plans/pending-review` and `GET /treatment-plans/pending-approval` (both paginated, `created_at ASC`).
- **Pending-review** rows (`under_review`) unlock `approve-review` (→ PROPOSED) and `reject-review` (→ DRAFT).
- **Pending-approval** rows (`proposed`, unsigned doctor) unlock `doctor-approve` / `accept` / `decline` / `cancel` — **not** `approve-review`/`reject-review`, which are illegal from `proposed` (state machine → 409).
- **Do not build a "pending-acknowledgment" queue** — count only (F8/R6).

### 3.2 S-02 — Treatment Plan Detail

**Layout ([P2.5 §3.5], [MS §9.3]):** PageHeader (Back, plan code, StatusBadge, version chip, validity dates) → Workflow progress bar → contextual action bar → Tabs [Plan Details | History | Approval Status] → Clinical Information card → Treatment Items table (with totals row) → Validity/Total cost summary. (Appointment/Diagnosis linkage cards appear in the UI spec but are not settable via API — see R17.)

| Element | Backend mapping |
|---|---|
| Header (plan code, status, version, dates, created/updated) | `GET /treatment-plans/{plan_id}` → `TreatmentPlanResponse` ✅ |
| Patient / Doctor identity | `patient_id`, `doctor_id` → resolved names (R10) |
| Workflow progress bar | Derived from `status` + hardcoded transition map (O5/R9). Steps: Draft → Under Review → Proposed → Accepted → In Progress → Completed; REJECTED/CANCELLED edge renderings per [P2.5 §3.5] |
| Action bar | Driven by `planActionsForStatus(status)` (§5.2) — only legal actions rendered |
| Clinical Information (notes/observations/recommendations) | `clinical_notes`, `observations`, `dentist_recommendations` — **read-only** (O1/R1) |
| Treatment Items table | `items[]` ordered by `sequence_number`; per-row: `procedure.name`+`code` (nested `ProcedureSummary`), `tooth_number`, `tooth_surface`, `quadrant`, `arch`, `estimated_cost`, `discount`, `item_status` (**always "pending"**, read-only), `notes` |
| Totals row | ⚠️ Backend surfaces only `total_estimated_cost` (sum of `estimated_cost`, **not** reduced by discounts). The UI's total-discount and net columns have **no payload field** → compute `Σdiscount` and `Σ(estimated_cost − discount)` client-side for display only ([BCR §9.3]) |
| Validity period | `valid_from` / `valid_to` — read-only (O1) |
| Approval Status tab | `approval` object: `approved_by`/`approved_at`, `patient_status`, `patient_acknowledged_at` (S-06) |
| History tab / Versions | `versions[]` (S-05) |
| "💰 Generate Invoice" | **Cross-module** — not a treatment endpoint; requires billing contract (F9). Show only when billing integration is scheduled; otherwise defer |
| **Permissions** | 🅰 |
| **Empty states** | Items empty → "No items yet — add procedures to build this plan" + Add Item CTA (only when editable) |
| **Errors** | 404 `PLAN_NOT_FOUND` → ResultState with back navigation |

### 3.3 S-03 — Create Treatment Plan

**Layout ([P2.5 §3.6], [MS §9.2]):** full-page form or 680px drawer: Patient picker → Doctor picker → Clinical Notes / Observations / Dentist Recommendations → Valid From / Valid To → (optional explicit Plan Code) → Submit.

| Field | Backend mapping |
|---|---|
| Patient (required) | `POST /treatment-plans` body `patient_id` (UUID). Backend checks **existence only** (active status NOT checked, [BCR §5.1]). 404 if missing |
| Doctor (required) | `doctor_id` (UUID), existence check. 404 if missing |
| Clinical Notes / Observations / Dentist Recommendations | Optional `null`-able strings, 1–5000 chars. **Create-only** (O1) |
| Valid From / Valid To | Optional dates `YYYY-MM-DD`; `valid_from ≤ valid_to` enforced → 422 `INVALID_DATE_RANGE`. **Create-only** (O1) |
| Plan Code | Optional, ≤20 chars, **stored verbatim** (no format/uppercase enforcement, O10); duplicate → 409. Recommend hiding the field by default (auto-generated `TXN-XXXXXX`); if exposed, apply `TXN-`/uppercase UX guidance only |
| **Submit** | `POST /treatment-plans` → **201** `TreatmentPlanResponse` (DRAFT + approval(pending) + version 1) |
| **Success flow** | Toast "Treatment plan TXN-XXXXXX created." → navigate to S-02 |
| **Error flow** | 422 (schema/date range) → inline field errors from `details` array; 409 duplicate code → inline; 404 patient/doctor → explicit message; 500 → generic toast |
| **Permissions** | 🅰 |

### 3.4 S-04 — Edit Treatment Plan / Add Items

**Layout ([P2.5 §3.7]):** Items table with inline ✏️/🗑️ per row + drag-drop reorder + "Add Item" → Add Procedure Item form (procedure search, sequence, tooth FDI, surface, quadrant, arch, cost, discount, notes).

| Element | Backend mapping |
|---|---|
| Editable only when status ∈ {draft, under_review, proposed} | Backend `validate_editable` → 409 `PLAN_NOT_EDITABLE` otherwise. **Frontend must also disable editing outside these statuses** (§5) |
| Procedure search dropdown | `GET /procedures/active` (all active, code ASC — dropdown seed) + `GET /procedures/search?term=` (code/name, limit 1–50). Inactive procedures → 409 if referenced |
| Add item | `POST /treatment-plans/{id}/items` `AddItemRequest` → **201** plan. `estimated_cost` defaults to procedure `default_cost` when omitted (UI should show "Default: ₱X" hint per [P2.5 §15.7]) |
| Inline edit item | `PATCH /treatment-plans/{id}/items/{item_id}` `ItemUpdateRequest` — partial; **`notes: null` does not clear notes** (quirk R14); tooth fields cleared via explicit `null` |
| Remove item | `DELETE /treatment-plans/{id}/items/{item_id}` → 200 plan |
| Reorder (drag-drop; keyboard up/down per [P2.5 §14]) | `PUT /treatment-plans/{id}/items/reorder` `{item_ids: [...]}` — must contain **every** item exactly once else 409 ([BCR §5.4]) |
| **Permissions** | 🅰 |
| **Empty state** | "No items yet" + Add Item CTA |
| **Error handling** | 409 duplicate sequence / not-editable / inactive procedure → inline alert, keep dialog open; 422 FDI/cost/discount → field errors; 500 (incl. concurrency) → generic retry + refetch |

> ⚠️ **Scope note:** "Edit Treatment Plan" in the approved UI means **items only**. There is no header-edit surface (F1). Do not render header fields as editable anywhere on this screen.

### 3.5 S-05 — Version History / Version Diff

**Layout ([P2.5 §3.8], [MS §9.5]):** "Current Version: N" + "Create Snapshot" → version table (Version · Date · Reason · By) → expandable snapshot detail (items at version) → "Restore to this version".

| Element | Backend mapping |
|---|---|
| Version list | `GET /treatment-plans/{id}/versions` → `VersionListResponse.items[]` (`version_number`, `change_reason`, `changed_by` (user id), `created_at`) ascending. Also embedded `versions[]` on the aggregate |
| Snapshot detail | `GET /treatment-plans/{id}/versions/{version_id}` → `items_snapshot` JSONB; **monetary values are strings** — parse with `Number()` for diff rendering ([BCR §6.6]) |
| Create snapshot | `POST /treatment-plans/{id}/versions` `{change_reason}` (1–500, required) → **201** plan. ⚠️ Allowed in **any** status, but only meaningful in editable statuses (O11) → gate the button to editable statuses ([P2.5 §15.3]) |
| Restore | `POST /treatment-plans/{id}/versions/{version_id}/restore` — **editable statuses only** → else 409. Replaces all items with snapshot; creates a new "Restored from version N" snapshot. Target snapshot is never modified |
| Diff rendering | Current `items[]` vs snapshot items (procedure_code, tooth, cost, discount, notes). No backend diff — compute client-side |
| "Changed by" display | `changed_by` is a **user id (int)** → resolve to name via user service |
| **Confirmation** | Restore: "Restore plan {code} to version {n}? Current items will be replaced. A new version will be created." → confirm → POST restore → toast |
| **Permissions** | 🅰 |
| **Errors** | 404 version/plan; 422 empty change_reason; 409 restore on non-editable plan |

### 3.6 S-06 — Approval Status

**Layout ([P2.5 §3.9]):** two cards — Doctor Approval (Status PENDING/APPROVED + timestamp + Approve/Revoke) and Patient Acknowledgment (Status PENDING/ACCEPTED/DECLINED + timestamp + Accept/Decline).

| Element | Backend mapping |
|---|---|
| Doctor card | `approval.approved_by` / `approval.approved_at` from `TreatmentPlanResponse` |
| Patient card | `approval.patient_status` (`pending/accepted/rejected`) + `patient_acknowledged_at` |
| Doctor Approve | `POST …/doctor-approve` — PROPOSED only, not already signed; else 409 `PLAN_ALREADY_APPROVED`. Does **not** change plan status |
| Doctor Revoke | `POST …/doctor-revoke` — PROPOSED + must be signed. ⚠️ Does not reset patient status (R15 — if patient already accepted, record shows accepted without signature; display with care) |
| Patient Accept | `POST …/patient-acknowledge` — PROPOSED + doctor-signed + `patient_status == pending`; else 409 |
| Patient Decline | `POST …/patient-decline` — PROPOSED + doctor-signed + not acted; sets `patient_status = rejected` |
| **Ordering contract** | doctor-approve → patient-acknowledge → accept (recommended flow). `accept` before acknowledgment is legal → ACCEPTED with `patient_status=pending` (O7). Disable Accept until both cards green **as UX guidance only** (backend permits otherwise) |
| Approval notes | `approval_notes` — **never settable via any endpoint**; omit editors (R17) |
| **Permissions** | Read 🅰; write 🅰 (same set — note [P2.5 §3.9] claims "Write: ADMIN, DOCTOR_ROLES" but the backend allows all six roles; **follow the backend**) |
| **States** | Six PROPOSED combinations per [P2.5 §3.9] table — all renderable from `approved_by` + `patient_status` |

### 3.7 S-07 — Procedure Catalog

**Layout ([P2.5 §4.4], [MS §9.4]):** PageHeader + ➕ New Procedure → toolbar (Search + Category filter + Status filter + Clear) → DataTable (Code · Name · Cost · Category · Status) → Pagination.

| Element | Backend mapping |
|---|---|
| Search | ⚠️ **No `search` param on `GET /procedures`** — use `GET /procedures/search?term=` (code OR name, limit 1–50) or client-side filter; recommend `/search` with debounce |
| Category filter | `GET /procedures?category=` — enum (11 values); invalid → 422 |
| Status filter (Active) | `is_active` (bool) |
| Sort | `sort_by ∈ {code, name, category, default_cost}`, `sort_order`; **default `code asc`** (differs from plans' `created_at desc`, [BCR §4.3]) |
| Pagination | `page`/`page_size` (1–100, default 20); `total_pages` present |
| Row actions (edit/activate/deactivate/delete) | `PATCH /procedures/{id}` (name/cost/category/description — **code immutable**), `PATCH …/activate`, `PATCH …/deactivate` (idempotent), `DELETE /procedures/{id}` (**204 no body**; must be inactive; 409 if referenced by plan items) |
| New Procedure button | ⭐ gated (`PermissionGate`) |
| **Permissions** | Read 🅰; write ⭐ (ADMIN, CHIEF_DOCTOR) |
| **Empty state** | "No procedures found" + New Procedure CTA (⭐) |

### 3.8 S-08 — Create/Edit Procedure

**Layout ([P2.5 §4.5]):** 480px drawer. Fields: Code · Name · Description · Default Cost · Category · Active toggle.

| Field | Backend mapping |
|---|---|
| Code | `ProcedureCreate.code` — required, 1–20 chars `[A-Za-z0-9_-]+`, service uppercases/strips; duplicate → 409. **Edit mode: disabled** — `ProcedureUpdate` has no `code` field; unknown body fields → 422 (extra="forbid") |
| Name | Required, 1–200 |
| Description | Optional, ≤2000 |
| Default Cost | Required, 0–999999.99, 2 dp |
| Category | Required, 11-value enum |
| Active toggle | ⚠️ **Not part of create/update payload.** On create, backend defaults `is_active = true`. On edit, the toggle maps to `PATCH …/activate` / `PATCH …/deactivate` as **separate calls** (not part of the PATCH form payload). Deactivate of an already-inactive procedure → 409 (guard) |
| **Submit** | Create → `POST /procedures` → 201; Edit → `PATCH /procedures/{id}` → 200 |
| **Permissions** | ⭐ |

### 3.9 S-09 — Procedure Execution View

**Layout ([P2.5 §5.2]):** procedure header (name, tooth, cost, plan, item status) → item action buttons (▶ Start · ✕ Cancel · ⏸ Defer · ✅ Mark Complete) → Clinical Notes (Procedure Notes + Clinical Findings + Save) → Attachments section.

| Element | Backend mapping |
|---|---|
| Header (procedure, tooth, cost, plan) | From `GET /treatment-plans/{id}` → item row ✅ |
| **Item action buttons (Start/Cancel/Defer/Complete)** | ❌ **Unsupported** — no item-transition endpoint (O2/R2). **Recommended treatment: remove the buttons; render `item_status` as read-only `PENDING` badge.** Defer the entire execution interaction to a future backend item-status endpoint |
| Clinical Notes / Clinical Findings | ⚠️ Maps to a single `notes` field on the item (`PATCH …/items/{item_id}` with `{notes}`). The UI's two separate textareas (Procedure Notes vs Clinical Findings) must be **merged into one `notes` field** or rendered as one editor — the backend has no second field |
| Save Notes | `PATCH …/items/{item_id}` `{notes}` — editable statuses only (409 otherwise) |
| Attachments section | ❌ **Unsupported** in treatment module (S-11) — remove or show informational placeholder pointing to Patient Records attachments |
| **Permissions** | Read 🅰; item notes write 🅰 (any allowed role — no doctor-only check) |

> **Screen disposition:** ship as **read-only item details + notes editor** in editable statuses; all item-status affordances removed. This is a deliberate scope cut (HR1), not a client workaround.

### 3.10 S-10 — Treatment Progress

**Layout ([P2.5 §6.2]):** Progress Summary Card (overall % bar; PENDING/IN_PROGRESS/COMPLETED/CANCELLED/DEFERRED counts; total completed/remaining) embedded in S-02; and the S-13 doctor-dashboard progress list.

| Element | Backend mapping |
|---|---|
| Progress bar & status counts | ❌ **Not computable as designed** — all items are `pending` forever (O2). Counts would always show 100% PENDING; percent always 0%. **Recommended treatment: hide the progress bar; show `item_count` and `total_estimated_cost` instead** (both in payload). Re-introduce progress UI when item-status endpoints exist |
| "Next Procedure" column | ❌ No item ordering-by-execution concept — omit |
| Estimated completion date | ❌ No backend field — omit |
| **Permissions** | 🅰 |

### 3.11 S-11 — Clinical Attachments

**Layout ([P2.5 §7.2]):** attachment list + ➕ Add Attachment + view/delete.

| Element | Backend mapping |
|---|---|
| All | ❌ **Unsupported** — no `ProcedureAttachment` entity/endpoint (metadata-only, [P2.5 §7.1]); `appointment_id`/`diagnosis_id` are never settable via API (R17). **Recommended treatment: hide the section entirely** (or show a read-only note linking to Patient Records attachments). No file upload endpoints exist in the treatment module |
| **Permissions** | — (no surface) |

### 3.12 S-12 — Treatment Timeline

**Layout ([P2.5 §11.2], [MS §8 Patient Profile]):** chronological patient timeline with filter chips and date range; treatment events include Plan Created, Plan Status Change, Item Added, Item Status Change, Version Created, Version Restored, Doctor Approved, Patient Acknowledged.

| Event type | Backend mapping |
|---|---|
| Plan Created | ✅ From `TreatmentPlanResponse.created_at` (+ `created_by` → name) |
| Version Created | ✅ From `versions[]` (`created_at`, `change_reason`, `changed_by`) |
| Version Restored | ⚠️ Inferable from a version whose `change_reason` starts "Restored from version N" — fragile; treat as optional |
| Doctor Approved / Patient Acknowledged | ⚠️ Inferable from `approval.approved_at` / `patient_acknowledged_at` — **one event each**, no history of revokes/re-acks |
| Plan Status Change (DRAFT→UNDER_REVIEW etc.) | ❌ **No audit/event stream endpoint** — status transition history is not exposed. Only current `status` + `updated_at` available |
| Item Added / Item Status Change | ❌ Item history not exposed (and item status never changes, O2) |
| **Permissions** | 🅰 (data sources); timeline page is Patient-Profile scope (Part 2.4) |

> **Screen disposition:** the full treatment timeline cannot be built from the treatment API. Sprint 12A should contribute a **"Plan Activity" card** (created + versions + approval timestamps, reconstructed client-side) and defer the cross-module timeline to when an audit/event endpoint exists (backend backlog, §14). Do not fabricate status-change events.

### 3.13 S-13 — Doctor Dashboard — My Active Treatment Plans

**Layout ([P2.5 §6.2], [MS §8]):** card listing active plans (Patient · Plan · Progress · Next Procedure) for the current doctor; row click → S-02.

| Element | Backend mapping |
|---|---|
| Plan rows for current doctor | `GET /treatment-plans/by-doctor/{doctor_id}` — requires the **current user's doctor UUID**: map `useCurrentUserRole`/current user → doctor via the doctors module (user_id linkage) — cross-module lookup |
| "Active" scoping | ✅ Filter `status` (e.g., `in_progress`, `accepted`, `proposed`) or `is_active=true` — both supported |
| Progress / Next Procedure columns | ❌ Not computable (see S-10) — **recommend columns: Plan Code · Patient · Status · Item Count · Total Cost · Updated** |
| Dashboard summary widget | `GET /treatment-plans/dashboard` (`total_plans`, `by_status` dense 9 keys, `pending_review`, `pending_approval`, `pending_acknowledgment` (count-only, F8), `active_plans`) |
| **Permissions** | 🅰 |
| **Empty state** | "No active treatment plans" |

---

## 4. Action Mapping

Every user action and its backend contract. "Supported" = verified endpoint exists.

| # | Action | Where (screen) | Supporting endpoint | Supported? | Required RBAC | Business rules | Expected UI feedback | Error handling |
|---|---|---|---|---|---|---|---|---|
| A1 | Create plan | S-03 | `POST /treatment-plans` | ✅ | 🅰 | DRAFT created + approval(pending) + v1; `valid_from ≤ valid_to`; code unique | Toast + navigate to S-02 | 404 patient/doctor; 409 dup code; 422 dates/schema → field errors; 500 toast |
| A2 | View plan | S-01→S-02 | `GET /treatment-plans/{id}` | ✅ | 🅰 | — | Detail page | 404 ResultState |
| A3 | Add procedure item | S-04 | `POST /treatment-plans/{id}/items` | ✅ | 🅰 | Editable status only; procedure active; sequence unique; FDI tooth; discount ≤ cost | Row inserted; totals update; toast optional | 409 not-editable / dup-seq / inactive proc; 422 FDI/cost/discount; 500 retry |
| A4 | Edit item | S-04/S-09(notes) | `PATCH /treatment-plans/{id}/items/{item_id}` | ✅ | 🅰 | Partial update; editable status; `notes:null` ignored (R14) | Inline row update; toast | same as A3 |
| A5 | Remove item | S-04 | `DELETE /treatment-plans/{id}/items/{item_id}` | ✅ | 🅰 | Editable status only | Row removed + confirm dialog recommended | 409 not-editable; 404 |
| A6 | Reorder items | S-04 | `PUT /treatment-plans/{id}/items/reorder` | ✅ | 🅰 | `item_ids` = all items exactly once | Order updated after drop | 409 "Item list mismatch" |
| A7 | Submit for review | S-02 | `POST …/submit-for-review` | ✅ | 🅰 | draft→under_review; **≥1 item** required | Confirm dialog → toast "submitted" → badge update | 409 (empty plan or illegal) |
| A8 | Approve review | S-02/S-01 queues | `POST …/approve-review` | ✅ | 🅰 | under_review→proposed | Confirm → toast | 409 illegal |
| A9 | Reject review | S-02/S-01 queues | `POST …/reject-review` | ✅ | 🅰 | under_review→draft | Confirm (+ optional reason is **not collected by backend** — no body; keep a local note or omit) | 409 illegal |
| A10 | Doctor approve | S-06 | `POST …/doctor-approve` | ✅ | 🅰 | PROPOSED + unsigned | Card flips to APPROVED | 409 already-approved / wrong status |
| A11 | Doctor revoke | S-06 | `POST …/doctor-revoke` | ✅ | 🅰 | PROPOSED + signed | Card flips back; ⚠️ patient status not reset (R15) | 409 not signed / wrong status |
| A12 | Patient accept | S-06 | `POST …/patient-acknowledge` | ✅ | 🅰 | PROPOSED + doctor-signed + pending | Card flips to ACCEPTED | 409 ack-exists / not signed |
| A13 | Patient decline | S-06 | `POST …/patient-decline` | ✅ | 🅰 | PROPOSED + doctor-signed + pending | Card flips to DECLINED | 409 |
| A14 | Accept plan | S-02 | `POST …/accept` | ✅ | 🅰 | proposed→accepted | Confirm → toast → badge | 409 illegal |
| A15 | Decline plan | S-02 | `POST …/decline` | ✅ | 🅰 | proposed→rejected | Confirm | 409 illegal |
| A16 | Cancel plan | S-02 | `POST …/cancel` | ✅ | 🅰 | any non-terminal → cancelled | Confirm (destructive) | 409 illegal |
| A17 | Start treatment | S-02 | `POST …/start-treatment` | ✅ | 🅰 | accepted→in_progress; **≥1 item** | Confirm → toast | 409 empty/illegal |
| A18 | Put on hold | S-02 | `POST …/hold` | ✅ | 🅰 | in_progress→on_hold | Confirm | 409 |
| A19 | Resume | S-02 | `POST …/resume` | ✅ | 🅰 | on_hold→in_progress | Confirm | 409 |
| A20 | Complete treatment | S-02 | `POST …/complete` | ✅ | 🅰 | in_progress/on_hold→completed | Confirm (terminal) | 409 |
| A21 | Create version snapshot | S-05 | `POST …/versions` | ✅ | 🅰 | `change_reason` 1–500 required; allowed any status (gate to editable for UX, O11) | Toast "Version N created" | 422 empty reason |
| A22 | Restore version | S-05 | `POST …/versions/{id}/restore` | ✅ | 🅰 | **editable status only**; replaces items | Warning confirm → toast | 409 not-editable |
| A23 | Search plans | S-01 | `GET /treatment-plans/search` | ✅ | 🅰 | `term` required (min 1); whitespace-only → empty 200 | Debounced suggestions | 422 missing term |
| A24 | Search procedures | S-07/S-04 | `GET /procedures/search` | ✅ | 🅰 | `term` required; limit 1–50 | Debounced suggestions | 422 |
| A25 | Filter / sort / paginate (plans) | S-01 | `GET /treatment-plans` params | ✅ | 🅰 | §3.1 rules; dates must be `YYYY-MM-DD` | URL-query-synced table | 422 invalid status; 500 invalid date (avoid) |
| A26 | Filter / sort / paginate (procedures) | S-07 | `GET /procedures` params | ✅ | 🅰 | §3.7 rules | Table refresh | 422 invalid category |
| A27 | Create procedure | S-08 | `POST /procedures` | ✅ | ⭐ | code uppercase unique; cost ≥ 0 | Toast + row added | 409 dup code; 422 |
| A28 | Edit procedure | S-08 | `PATCH /procedures/{id}` | ✅ | ⭐ | **code immutable**; unknown fields → 422 | Toast + row update | 404; 422 |
| A29 | Activate procedure | S-08/S-07 | `PATCH /procedures/{id}/activate` | ✅ | ⭐ | idempotent-ish guard (already active → 409) | Toggle flips | 409 |
| A30 | Deactivate procedure | S-08/S-07 | `PATCH /procedures/{id}/deactivate` | ✅ | ⭐ | idempotent (already inactive ok) | Toggle flips | — |
| A31 | Delete procedure | S-07 | `DELETE /procedures/{id}` | ✅ | ⭐ | **must be inactive**; 409 if referenced by items; **204 no body** | Confirm → row removed | 409 active/referenced |
| A32 | Start / complete / cancel / defer **item** | S-09 | — | ❌ **Unsupported** | — | no endpoint (O2) | Button removed; status read-only | — |
| A33 | Edit plan header | S-03 only | — | ❌ **Unsupported after create** (O1) | — | create-only | No edit UI | — |
| A34 | Delete / deactivate plan | — | — | ❌ **Unsupported** (O3) | — | no endpoint | No action rendered | — |
| A35 | Print / Download (plan or invoice) | S-02/S-05 | — | ❌ **Unsupported** | — | no endpoint; no print payload | Not rendered in Sprint 12A | — |
| A36 | Upload attachment | S-11 | — | ❌ **Unsupported** | — | no endpoint | Section hidden | — |
| A37 | Generate Invoice | S-02 | billing module (Part 2.7) | ⚠️ Cross-module | per billing contract | one active invoice per plan (BR-121) | Navigate to billing flow | defer to billing sprint |
| A38 | Revise & resubmit (REJECTED → draft) | S-02 | — | ❌ **Unsupported** (O12/R7) | — | no `rejected→draft` endpoint; rejected not editable | Do not render; correction path = edit-in-place (PROPOSED) or cancel→new plan | — |
| A39 | Navigation (S-01↔S-02, tabs, breadcrumbs) | all | client-side routes | ✅ | route meta | — | router transitions | 404 route guard |

---

## 5. State Mapping

### 5.1 Plan status → UI badge (verified enum + [P2.5 §3.4] styling)

| Status (backend string) | Badge | Color | Icon | Terminal? | Items editable? |
|---|---|---|---|---|---|
| `draft` | DRAFT | gray | 📝 | ❌ | ✅ |
| `under_review` | UNDER REVIEW | amber | 🔍 | ❌ | ✅ |
| `proposed` | PROPOSED | blue | 📋 | ❌ | ✅ |
| `rejected` | REJECTED | red | ✕ | ❌ (only cancel) | ❌ |
| `accepted` | ACCEPTED | green | ✅ | ❌ | ❌ |
| `in_progress` | IN PROGRESS | purple | ⚕️ | ❌ | ❌ |
| `on_hold` | ON HOLD | orange | ⏸ | ❌ | ❌ |
| `completed` | COMPLETED | teal | ✅ | ✅ | ❌ |
| `cancelled` | CANCELLED | gray strikethrough | ✕ | ✅ | ❌ |

### 5.2 Per-state UI surface (source of truth: [BCR §11.1]; no transition-query endpoint exists — hardcode in `utils/treatmentPlanStateMachine.ts`, O5/R9)

| State | Editable fields | Read-only fields | Available actions (endpoint) | Disabled/hidden actions | Required confirmation |
|---|---|---|---|---|---|
| `draft` | items (add/edit/remove/reorder/notes) | header (all), item_status, plan_code, patient, doctor | Submit for review (≥1 item); Cancel plan; Restore version (editable — reverts items to a snapshot, e.g. v1's empty items clears them) | Approve/Reject/Accept/Decline/Start/Hold/Resume/Complete | Cancel plan confirm; Restore confirm (destructive warning) |
| `under_review` | items (same) | same | Approve review; Reject review (→draft); Cancel | Start/Complete/Hold/Accept/Decline | Approve/Reject/Cancel confirms |
| `proposed` | items (same) — **edit-in-place correction path** | same | Doctor approve; Doctor revoke (if signed); Patient accept (if signed); Patient decline; Accept plan; Decline plan; Cancel | Submit/Approve review/Reject review; **no "back to draft" (O12)** | Every approval/ack action + Accept/Decline/Cancel confirm |
| `rejected` | — (not editable) | everything | Cancel only | Revise/Resubmit (❌ no endpoint); items editing (❌); all others | Cancel confirm; informational note "plan rejected — create a new plan to revise" |
| `accepted` | — | everything | Start treatment (≥1 item); Cancel; Create version (audit only) | Items editing; approval actions (status not PROPOSED); Accept/Decline | Start/Cancel confirms |
| `in_progress` | — | everything | Put on hold; Complete; Cancel; Create version (audit) | Items editing; Start; Resume; approval actions | Hold/Complete/Cancel confirms (Complete is terminal) |
| `on_hold` | — | everything | Resume; Complete; Cancel; Create version (audit) | Items editing; Hold; approval actions | Resume/Complete/Cancel confirms |
| `completed` | — | everything | none (terminal) | all | — |
| `cancelled` | — | everything | none (terminal) | all | — |

**Transition endpoint map (the only legal transitions with endpoints):**

| Transition | Endpoint |
|---|---|
| draft → under_review | `submit-for-review` |
| under_review → proposed | `approve-review` |
| under_review → draft | `reject-review` |
| proposed → accepted | `accept` |
| proposed → rejected | `decline` |
| any non-terminal → cancelled | `cancel` |
| accepted → in_progress | `start-treatment` |
| in_progress → on_hold | `hold` |
| on_hold → in_progress | `resume` |
| in_progress/on_hold → completed | `complete` |
| proposed → draft, rejected → draft | ❌ **no endpoint** (O12) |

**Approval sub-state (independent of plan status, [BCR §9.5]):** `approved_by` set/cleared by `doctor-approve`/`doctor-revoke` (PROPOSED only); `patient_status` `pending→accepted|rejected` via `patient-acknowledge`/`patient-decline` (PROPOSED + doctor-signed). UI badge: APPROVED/PENDING on doctor card; ACCEPTED/DECLINED/PENDING on patient card. No `changes_requested` is reachable via API (R17).

**Item status mapping (O2):** always `pending` → render a read-only PENDING badge; do not render transition affordances (§4 A32).

---

## 6. Form Mapping

All request bodies use `extra="forbid"` — unknown fields → 422 ([BCR §5]). All forms should use React Hook Form + shared Zod schemas (§12). Fields marked **immutable after creation** are enforced by the backend (no endpoint) — never render editable.

### 6.1 Create Plan (`POST /treatment-plans`, [BCR §5.1])

| UI field | Backend field | Required | Validation (backend) | Default | Read-only? | Immutable after create? |
|---|---|---|---|---|---|---|
| Patient | `patient_id` | ✅ | existing row (active NOT checked) | — | ❌ | ✅ (no reassignment endpoint) |
| Doctor | `doctor_id` | ✅ | existing row | — | ❌ | ✅ |
| Clinical Notes | `clinical_notes` | ❌ | 1–5000, nullable | null | ❌ | ✅ (O1) |
| Observations | `observations` | ❌ | 1–5000, nullable | null | ❌ | ✅ (O1) |
| Dentist Recommendations | `dentist_recommendations` | ❌ | 1–5000, nullable | null | ❌ | ✅ (O1) |
| Valid From | `valid_from` | ❌ | `YYYY-MM-DD`; ≤ valid_to | null | ❌ | ✅ (O1) |
| Valid To | `valid_to` | ❌ | `YYYY-MM-DD`; ≥ valid_from | null | ❌ | ✅ (O1) |
| Plan Code (optional, hidden by default) | `plan_code` | ❌ | ≤20; unique → 409; **verbatim** (O10) | auto `TXN-XXXXXX` | ❌ | ✅ |

### 6.2 Add Item (`POST …/items`, [BCR §5.2])

| UI field | Backend field | Required | Validation | Default |
|---|---|---|---|---|
| Procedure | `procedure_id` | ✅ | active procedure only (409) | — |
| Sequence # | `sequence_number` | ✅ | ≥1; unique per plan (409) | next free |
| Tooth # (FDI) | `tooth_number` | ❌ | 11–48 or 51–85 (422) | null |
| Tooth Surface | `tooth_surface` | ❌ | 1–10 chars; **no format check** (O8) | null |
| Quadrant | `quadrant` | ❌ | enum UR/UL/LL/LR | null |
| Arch | `arch` | ❌ | enum upper/lower | null |
| Estimated Cost | `estimated_cost` | ❌ | 0–999999.99, 2dp | procedure `default_cost` (show hint [P2.5 §15.7]) |
| Discount | `discount` | ❌ | ≥0; ≤ estimated_cost (422 + DB CHECK) | 0.00 |
| Notes | `notes` | ❌ | 1–5000 | null |

### 6.3 Update Item (`PATCH …/items/{item_id}`, [BCR §5.3])

All fields optional; **only provided fields update**. `tooth_number/tooth_surface/quadrant/arch: null` clears them; **`notes: null` is ignored** (R14). **Item notes can never be cleared via the API**: explicit `null` is ignored and `""` fails `min_length=1` → 422. Send `notes` only when changing the value; do **not** offer a "clear notes" action on items (document the quirk in code). `procedure_id` may change (must be active). Same bounds as Add.

### 6.4 Reorder (`PUT …/items/reorder`)

`item_ids: string[]` — must contain every item exactly once (409 otherwise). UI: drag-drop list or up/down buttons; build the array from current order; keyboard alternative per [P2.5 §14.2].

### 6.5 Create Version (`POST …/versions`)

`change_reason: string` — required, 1–500, stripped/trimmed (422 if empty). UI: textarea with counter.

### 6.6 Procedure Create (`POST /procedures`, [BCR §5.6])

| UI field | Backend field | Required | Validation |
|---|---|---|---|
| Code | `code` | ✅ | 1–20, `[A-Za-z0-9_-]+`, uppercased by service; unique → 409 |
| Name | `name` | ✅ | 1–200, non-empty after strip |
| Description | `description` | ❌ | ≤2000 |
| Default Cost | `default_cost` | ✅ | 0–999999.99, 2dp |
| Category | `category` | ✅ | 11-value enum (invalid → 422) |
| Active | — | ❌ | **not a create field** — default true; toggle = separate activate/deactivate PATCH |

### 6.7 Procedure Update (`PATCH /procedures/{id}`)

`name`, `default_cost`, `category`, `description` only. **Code absent → immutable; disable the Code input in edit mode.** Active toggle handled via `activate`/`deactivate` endpoints.

**Cross-cutting:** tooth number Zod schema should enforce FDI ranges (mirroring the backend 422); `tooth_surface` may validate surface-letter combos **for UX only** (backend accepts anything, R12); never send `date_from`/`date_to` without `YYYY-MM-DD` (O6).

---

## 7. Table Mapping

### 7.1 Treatment Plan Table (S-01)

| Column | Source | Sort | Search | Filter | Notes |
|---|---|---|---|---|---|
| Plan Code (link) | `plan_code` | ✅ `sort_by=plan_code` | ✅ (list `search` + `/search`) | — | → S-02 |
| Patient | resolved from `patient_id` | ❌ | ✅ (list `search` matches first/last name) | ✅ `patient_id` | R10 |
| Doctor | resolved from `doctor_id` | ❌ | ❌ (doctor not searchable — [BCR §13]) | ✅ `doctor_id` | R10 |
| Status | `status` | ✅ | — | ✅ `status` (enum) | StatusBadge |
| Version | `current_version` | ❌ | — | — | chip |
| Items | `item_count` | ❌ | — | — | |
| Total Est. Cost | `total_estimated_cost` | ❌ | — | — | currency format |
| Created | `created_at` | ✅ (default) | — | ✅ `date_from`/`date_to` | |
| Actions | — | — | — | — | View → S-02; transition menu per status (§5.2) |

Pagination: `total_pages` drives pager. Empty: `EmptyState` + Create CTA. Bulk actions: ❌ none supported (no bulk endpoint).

### 7.2 Procedure Catalog Table (S-07)

| Column | Source | Sort | Search | Filter |
|---|---|---|---|---|
| Code | `code` | ✅ (default `asc`) | ✅ `/search` (code/name) | — |
| Name | `name` | ✅ | ✅ | — |
| Cost | `default_cost` | ✅ | — | — |
| Category | `category` | ✅ | — | ✅ `category` (enum) |
| Status | `is_active` | ❌ | — | ✅ `is_active` |
| Actions | edit / activate / deactivate / delete | — | — | — ⭐ writes |

Pagination: standard. Bulk actions: ❌ none.

### 7.3 Version History Table (S-05)

| Column | Source | Sort | Search | Filter | Notes |
|---|---|---|---|---|---|
| Version | `version_number` | (ascending fixed) | ❌ | ❌ | ordered by backend |
| Date | `created_at` | ❌ | ❌ | ❌ | |
| Reason | `change_reason` | ❌ | ❌ | ❌ | expandable detail |
| By | `changed_by` (user id → name) | ❌ | ❌ | ❌ | R10 analog |
| Actions | expand (→ `GET /versions/{id}` lazy) + Restore (editable statuses only) | — | — | — | |

### 7.4 My Active Treatment Plans (S-13)

Columns: Plan Code · Patient · Status · Item Count · Total Cost · Updated (progress/next-procedure columns removed — S-10). Source: `GET /treatment-plans/by-doctor/{doctor_id}` + optional `status` filter. No server sort (only `created_at desc` default via by-doctor params — actually supports `sort_by/sort_order` same rules as list; keep simple default). Empty: "No active treatment plans".

---

## 8. Dialog & Drawer Mapping

| Dialog/Drawer | Trigger | Backend call | Request payload | Success flow | Error flow | Cancellation |
|---|---|---|---|---|---|---|
| CreatePlanDialog (680px drawer) | S-01/S-03 | `POST /treatment-plans` | CreatePlanRequest | Toast → navigate S-02 | field errors / toast | close, discard |
| AddItemDialog | S-04 "Add Item" | `POST …/items` | AddItemRequest | row + totals update | inline (409/422) | close |
| UpdateItemDialog (inline) | S-04 ✏️ | `PATCH …/items/{item_id}` | ItemUpdateRequest | row update | inline | close |
| RemoveItemConfirm | S-04 🗑️ | `DELETE …/items/{item_id}` | — | row removed | toast | abort |
| ReorderItemsDialog | S-04 drag handle | `PUT …/items/reorder` | `{item_ids}` | order applied | 409 mismatch alert | revert order |
| ConfirmTransitionDialog (generic) | any transition action | matching `POST …/<transition>` | (no body) | toast + badge + workflow bar update | 409 `INVALID_PLAN_OPERATION` inline, keep open | abort |
| CancelPlanDialog | S-02 Cancel | `POST …/cancel` | (no body) | toast + terminal badge | 409 | abort |
| CreateVersionDialog | S-05 "Create Snapshot" | `POST …/versions` | `{change_reason}` | toast "Version N created" | 422 empty reason | close |
| RestoreVersionDialog | S-05 "Restore" | `POST …/versions/{id}/restore` | (no body) | toast; items replaced; new version appended | 409 not-editable | abort |
| DoctorApproveDialog | S-06 Approve | `POST …/doctor-approve` | (no body) | card → APPROVED | 409 already/wrong-status | close |
| DoctorRevokeDialog | S-06 Revoke | `POST …/doctor-revoke` | (no body) | card → PENDING (⚠️ patient status preserved, R15) | 409 | close |
| PatientAcknowledgeDialog | S-06 Accept | `POST …/patient-acknowledge` | (no body) | card → ACCEPTED | 409 | close |
| PatientDeclineDialog | S-06 Decline | `POST …/patient-decline` | (no body) | card → DECLINED | 409 | close |
| ProcedureFormDialog (480px drawer) | S-07/S-08 | `POST /procedures` or `PATCH /procedures/{id}` | ProcedureCreate/Update | toast + row | 409 dup code; 422 | close |
| ProcedureStatusConfirm | S-07/S-08 toggle | `PATCH …/activate` / `…/deactivate` | (no body) | toggle flips | 409 guard | revert toggle |
| DeleteProcedureDialog | S-07 | `DELETE /procedures/{id}` | — | 204 → row removed (toast from client) | 409 active/referenced → explain "deactivate first" | abort |
| **GenerateInvoiceFlow** | S-02 💰 | billing module (F9) | per billing contract | navigate billing | — | defer to billing sprint |
| **Modification-requires-version dialog** ([P2.5 §15.5]) | post-acceptance item edit | — | — | ❌ **Not needed/unsupported** — items are not editable outside draft/under_review/proposed; do not build this flow | — | — |
| **Conflict dialog** ([P2.5 §15.2]) | any mutation 500 | — | — | ❌ **Not buildable as specified** — backend returns **500**, not 409 with a stale-data code (O9). Replace with generic retry toast + "reload plan" affordance | — | — |

---

## 9. RBAC Mapping

Backend facts (verified, [BCR §12]): 🅰 = `{ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` for **all 34 plan endpoints**; ⭐ = `{ADMIN, CHIEF_DOCTOR}` for all procedure writes; reads on procedures are 🅰. `DENTAL_ASSISTANT` is excluded from everything (R16). **No ownership checks exist** (F6).

| Screen / surface | Visible to | Hidden from | Disabled for | Backend authorization | Frontend gate |
|---|---|---|---|---|---|
| S-01 List + Create | 🅰 | DENTAL_ASSISTANT, patients | — | 🅰 | route guard (`RequireRole`) + hide nav for excluded roles |
| S-02 Detail + all plan transitions | 🅰 | same | actions per status (§5.2), **not** per role | 🅰 | status-driven action bar; no role-gating on transitions |
| S-03 Create | 🅰 | same | — | 🅰 | `RequireRole` |
| S-04 Items edit | 🅰 | same | status non-editable (409 mirror) | 🅰 | `isEditableStatus(plan.status)` |
| S-05 Versions | 🅰 | same | Create/Restore when status non-editable | 🅰 | status gate |
| S-06 Approval | 🅰 read **and** write (backend allows all 🅰 to call doctor/patient endpoints — [P2.5 §3.9]'s narrower "Write: ADMIN, DOCTOR_ROLES" is **not** enforced; follow backend) | DENTAL_ASSISTANT | status ≠ PROPOSED; doctor card when signed; patient card when unsigned/acted | 🅰 | status + approval-state gates |
| S-07 Catalog read | 🅰 | DENTAL_ASSISTANT | — | 🅰 | route guard |
| S-07/S-08 writes (New/Edit/Activate/Deactivate/Delete) | ⭐ only | everyone else | — | ⭐ (`require_admin`) | **`PermissionGate`** (only place role-gating is required) |
| S-09 Execution | 🅰 | DENTAL_ASSISTANT | item actions removed (unsupported) | 🅰 | n/a |
| S-10 Progress | 🅰 | DENTAL_ASSISTANT | — | 🅰 | n/a |
| S-11 Attachments | — | all (section hidden) | — | — | n/a |
| S-12 Timeline data | 🅰 | DENTAL_ASSISTANT | — | 🅰 | route guard on Patient Profile |
| S-13 Dashboard card | 🅰 (doctor-scoped by `doctor_id` filter for UX) | DENTAL_ASSISTANT | — | 🅰 | `useCurrentUserRole`; doctor UUID lookup |

**Rules of engagement (from [BCR §12.3]):**
1. Gate **navigation** and **procedure-write buttons** by role; gate **plan actions** by **status**, not by role.
2. Do **not** implement ownership-based disabling as a hard gate (backend has none). Optional UX-only tooltip "Only the plan's doctor or an administrator can modify this plan" ([P2.5 §15.4]) is permitted **if** product confirms the UX intent — flag in review, since the backend allows all 🅰 roles to modify any plan.
3. Keep gates conservative: never assume a permission the backend does not expose.

---

## 10. Read-Only vs Editable Matrix

| Field | Always editable | Editable only in specific states | Never editable | Backend-enforced immutability |
|---|---|---|---|---|
| `plan_code` | — | — | ✅ (after create) | ✅ no update endpoint (repo allowlist excludes it) |
| `patient_id` / `doctor_id` | — | — | ✅ | ✅ no update endpoint |
| `clinical_notes`, `observations`, `dentist_recommendations` | — | — | ✅ (create-only) | ✅ **O1** — repo allows but no route |
| `valid_from`, `valid_to` | — | — | ✅ (create-only) | ✅ **O1** |
| `status` | — | — | ✅ (workflow-managed only) | ✅ never writable via repo update |
| `current_version` | — | — | ✅ (system-managed) | ✅ |
| `is_active` (plan) | — | — | ✅ | ✅ **O3** — no activate/deactivate route |
| Item `procedure_id`, `sequence_number`, `estimated_cost`, `discount`, `tooth_number`, `tooth_surface`, `quadrant`, `arch`, `notes` | — | ✅ **only in {draft, under_review, proposed}** | — | — |
| Item `item_status` | — | — | ✅ (always `pending`) | ✅ **O2** — no item-transition endpoint |
| Item `appointment_id`, `diagnosis_id` | — | — | ✅ | ✅ never settable via API (R17) |
| Item `id`, `plan_id` | — | — | ✅ | ✅ |
| Approval `approved_by`, `approved_at` | — | ✅ doctor-approve/revoke (PROPOSED) | — | — |
| Approval `patient_status`, `patient_acknowledged_at` | — | ✅ patient-acknowledge/decline (PROPOSED + signed) | — | — |
| Approval `approval_notes` | — | — | ✅ | ✅ no input anywhere (R17) |
| Version `items_snapshot`, `version_number`, `change_reason`, `created_at` | — | — | ✅ | ✅ immutable JSONB; restore creates new version |
| Procedure `code` | — | — | ✅ | ✅ absent from `ProcedureUpdate` (422 if sent) |
| Procedure `name`, `description`, `default_cost`, `category` | ✅ | — | — | — |
| Procedure `is_active` | ✅ (via activate/deactivate endpoints) | — | — | — (create defaults true) |

**Explicit call-outs:**
- **Plan headers are immutable after creation** (O1/R1) — the single biggest constraint; the Create form is the only chance to set them.
- Item **editing is status-gated**, and once `accepted`, no field on the plan is mutable except through workflow transitions.

---

## 11. Unsupported UI Elements (no backend capability)

Each entry gives reason, backend limitation, and recommended UI treatment. **No client-side workarounds are invented.**

| # | UI element (from approved design) | Reason / backend limitation | Recommended UI treatment |
|---|---|---|---|
| U1 | **Edit plan header** (notes/observations/recommendations/validity) after creation ([P2.5 §3.5 "Edit Plan"]) | No `PATCH /treatment-plans/{id}` (O1/R1) | Hide header editors; render read-only. "Edit Plan" action = **items only**. Optionally show "headers are fixed at creation" helper text |
| U2 | **Item status transitions** — Start / Cancel / Defer / Mark Item Complete ([P2.5 §5.2, §5.2 Item Status Transitions]) | No item-transition endpoint (O2/R2); `item_status` always `pending` | Remove action buttons; render `item_status` as read-only badge. Deferred to backend item-status release |
| U3 | **Treatment Progress bar / counts / next-procedure / estimated completion** ([P2.5 §6.2]) | Progress derives from `item_status`, which never changes (O2) | Show `item_count` + `total_estimated_cost`; hide progress visual. Re-introduce when item statuses exist |
| U4 | **Delete / deactivate / archive plan** | No delete/activate/deactivate routes (O3/R3) | No delete affordance anywhere on plans |
| U5 | **Return to draft from PROPOSED or REJECTED** ("Revise and Resubmit", [P2.5 §3.5 edge case, §12.3]) | Legal in state machine but **no endpoint** (O12/R7); `rejected` is not item-editable | Do not render. Correction paths: edit-in-place while PROPOSED (items editable); or Cancel → Create new plan. Document this in UX copy |
| U6 | **Pending-acknowledgment actionable queue** | Count returns ACCEPTED+pending plans that can never be acknowledged (O7/R6) | Render **count-only** card; never link to a queue or an acknowledge action |
| U7 | **Clinical attachments upload/view** ([P2.5 §7]) | No attachment entity/endpoint in treatment module (metadata-only); no file upload | Hide the section (or informational redirect to Patient Records attachments) |
| U8 | **Full treatment timeline events** (status changes, item added/completed) ([P2.5 §11.2]) | No audit/event-stream endpoint; only created + versions + approval timestamps available | Ship a "Plan Activity" card from available fields; defer full timeline to an audit endpoint (backend backlog) |
| U9 | **Print / Download plan or invoice** | No print/download endpoint or payload | **Deferred / out of scope for Sprint 12A** — do not render. If product requires printing, it is a pure client capability (browser print of the detail view) and needs a separate product decision; it is not part of this backend contract |
| U10 | **Confidence dialog "Modification Requires Version"** ([P2.5 §15.5]) | Items are not editable post-acceptance; the flow can never trigger | Do not build. Versions are created explicitly via the Versions tab |
| U11 | **Stale-data conflict dialog** ([P2.5 §15.2]) | Optimistic-lock conflict returns **500**, not a distinguishable 409 (O9/R8) | Generic retry toast + "Reload plan" affordance on 500 |
| U12 | **Approval notes input** | `approval_notes` never writable (R17) | Omit editor; render read-only if ever populated |
| U13 | **Billing "Generate Invoice" from plan** ([P2.5 §3.5, §3.9, §12.5]) | Cross-module — treatment backend has no invoice endpoint; requires billing contract (BR-120/121) | Defer to billing sprint; hide until then (or stub navigation behind the billing integration) |
| U16 | **Invoice-status badge per list row** (🔖 INV-00042, clickable) **and "Billed / Unbilled" filter** ([P2.5 §12.5 UI Integration Points]) | No plan↔invoice linkage field in the treatment API; no billed/unbilled filter param on `GET /treatment-plans`; requires the billing module | Defer with the billing integration (same sprint as U13); do not render until the billing contract exposes plan-invoice linkage |
| U14 | **Item ↔ Appointment / Diagnosis linkage** | `appointment_id`/`diagnosis_id` not settable via API (R17) | Render informational/omitted; no editors |
| U15 | **Tooth-surface semantics** (valid M/D/B/L/O/I combos) | Backend accepts any 1–10 char string (O8/R12) | UI **may** validate for UX (with soft warnings), but must allow submission of anything the backend accepts; do not hard-block |

---

## 12. Reuse Mapping

Verified against `frontend/src` (2026-08-06). **No new patterns** are introduced except the single state-machine helper (§12 final row).

| Need | Reuse (verified present) |
|---|---|
| Data tables | `components/common/DataTable/` + `DataTableToolbar` (appointments/doctors/users pattern) |
| Pagination | `components/common/Pagination/` (bind to `total_pages`) |
| Search | `components/common/SearchBar/` + `hooks/useDebounce.ts` |
| Drawers / modals | `components/common/Drawer/`, `components/common/Modal/` (focus trap, alert roles) |
| Forms | `components/common/Form/` (`Form`, `FormField`, `Label`, `HelperText`, `ErrorMessage`, `FormActions`, `ValidationSummary`) + `components/common/Input/` (`Input`, `Select`, `Textarea`, `DatePicker`, `MultiSelect`, `Switch`, `Checkbox`, `Radio`) |
| Badges / status | `components/common/StatusBadge/` (status → color map — extend for the 9 plan statuses + procedure active) |
| States | `EmptyState`, `LoadingOverlay`, `Skeleton`, `Spinner`, `ResultState` |
| Dashboard / layout | `StatCard`, `Card`, `Section`, `PageHeader`, `PageContainer`, `DescriptionList`, `Tabs`, `Timeline`, `Stack`, `Grid`, `Accordion`, `Progress` |
| Feedback | `Toast`, `Alert`, `InlineMessage`, `Tooltip` |
| RBAC | `components/rbac/PermissionGate.tsx`, `RequireRole.tsx`, `hooks/rbac/usePermission.ts`, `useCurrentUserRole.ts` (procedure writes + navigation only, §9) |
| API client | `services/api.ts` (axios, Bearer, 401 interceptor) |
| Errors | `services/apiError.ts` (`parseApiError`, `apiErrorMessage`) — compatible with `{success,message,details}` envelope (F7) |
| Validation | shared Zod conventions (`utils/*FormSchema.ts`), `utils/validation.ts`; React Hook Form established pattern |
| Formatting | `utils/formatting.ts` (currency for costs), `utils/date.ts` (ISO/display dates) |
| Pickers | `components/appointments/PatientPicker.tsx`; doctor select via doctor service lists |
| Filter-state pattern | `usePatientFilters` / `useAppointmentFilters` as templates → `useTreatmentPlanFilters` |
| Constants | `constants/` per-module pattern (`appointment.ts`, `doctor.ts`, `patient.ts`) → `constants/treatmentPlan.ts`, `constants/procedure.ts` |
| Query hooks | React Query hooks per module (`hooks/appointments/`, `hooks/patients/`…) → `hooks/treatmentPlans/`, `hooks/procedures/` |
| Types | `types/` per-module pattern → `types/treatmentPlan.ts`, `types/procedure.ts` (full TS contracts in [BCR §15.1]) |
| **New (required)** | `utils/treatmentPlanStateMachine.ts` — the **only** new abstraction: `ALLOWED_PLAN_TRANSITIONS`, `isEditableStatus`, `terminalStatuses`, `planActionsForStatus` (backend exposes no transition metadata, O5/R9) + `components/treatmentPlans/PlanTransitionActions.tsx` (single rendering surface for status-driven actions) |

---

## 13. Performance Considerations

| Concern | Strategy |
|---|---|
| Parallel calls | S-01 load: `GET /treatment-plans` + `GET /treatment-plans/dashboard` + patient/doctor name-resolution queries in parallel (name resolution can be one batched lookup per module or per-page `Promise.all`) |
| Sequential dependencies | S-02 detail requires `GET /treatment-plans/{id}` first; tabs (versions list, approval) come embedded in the aggregate — **no extra tab fetches needed** except lazy `GET /versions/{id}` on diff expand |
| Name resolution | Cache resolved patient/doctor names in React Query (`['patients']`, `['doctors']` keys already exist) — avoids N+1 across list pages (R10) |
| Query invalidation | All mutations invalidate `['treatment-plans']` + plan detail key + `['dashboard']`; procedure mutations invalidate `['procedures']` + any open item-form procedure caches ([BCR §15.3]) |
| Caching | Procedure catalog is small (50–200 rows) — `staleTime` long for `/procedures/active`; invalidate on admin writes |
| Lazy-loaded tabs | S-02 tabs are client-side; version diff (`GET /versions/{id}`) lazy on expand; no heavy tab chunks needed |
| Optimistic updates | ❌ **Not recommended** — optimistic lock conflicts return 500 (O9); optimistic UI then misleads. Use **refetch-after-mutation** (invalidate → refetch) as the sync mechanism; refresh the whole plan aggregate after every mutation (aggregate-root pattern, [P2.5 §15.1]) |
| Search | Debounce both `/search` endpoints (300ms, existing `useDebounce`) to protect `ILIKE %term%` |
| Pagination | Server-side via `page`/`page_size`/`total_pages`; keep page size ≤ 100 |
| List payload note | `item_count`/`total_estimated_cost` trigger one extra batched `selectin` query per page server-side — acceptable; do not re-fetch items per row ([BCR §8.1]) |

---

## 14. Risks & Gaps

**Confirmed backend behavior** (verified) vs **recommendations** (proposals needing product/backend sign-off) are distinguished below.

| ID | Risk / gap | Type | Detail | Impact | Frontend disposition |
|---|---|---|---|---|---|
| G1 | Plan header immutability | Confirmed (O1/R1) | No header PATCH | Create-only headers; UX surprise if unplanned | Enforce complete create form; read-only headers; add helper copy |
| G2 | No item-status lifecycle | Confirmed (O2/R2) | S-09/S-10 not implementable as designed | 2 of 13 screens degraded | Scope cut (read-only) — **recommendation:** add item-transition endpoints to backend backlog before any execution/progress feature |
| G3 | No plan delete/archive | Confirmed (O3/R3) | Plans accumulate forever | List bloat over time | No delete UI; consider later `is_active` management backend work |
| G4 | Revision flows conflict | Confirmed (O12/R7) | REJECTED cannot be revised/resubmitted; `proposed→draft`/`rejected→draft` have no endpoints | UI promises an action that always 409s | Remove "Revise and Resubmit"; document correction paths; **recommendation:** decide product intent for REJECTED |
| G5 | Error codes stripped | Confirmed (O4) | Branch on status + `message` | Fine with existing `parseApiError`; avoid status-code-only logic on 500s | Follow [BCR §14.3] rules |
| G6 | Date parsing 500 | Confirmed (O6) | Non-`YYYY-MM-DD` → 500 | Data-entry fragility | Constrain DatePickers; never send invalid dates |
| G7 | Pending-acknowledgment dead count | Confirmed (O7/R6) | Count includes unacknowledgeable plans | Misleading KPI | Count-only card; **recommendation:** align the acknowledge endpoint or count query (backend) |
| G8 | Concurrency → 500 | Confirmed (O9/R8) | No 409/retry contract | Edit collisions invisible | Refetch-after-mutation; generic retry; **recommendation:** backend maps `StaleDataError` to 409 |
| G9 | No transition metadata | Confirmed (O5/R9) | Frontend hardcodes state machine | Drift risk | Single helper + table-driven tests (§15.4); **recommendation:** wire `get_allowed_transitions` later |
| G10 | Names not in payloads | Confirmed (R10) | Patient/doctor name joins required | Latency/complexity | Central resolver + cache (§13) |
| G11 | No ownership enforcement | Confirmed ([BCR §3.1]) | Any 🅰 role acts on any plan | UI owner-gating would lie | No hard owner gate; optional UX tooltip pending product confirmation (F6) |
| G12 | `tooth_surface`/cross-field validation absent | Confirmed (O8/R12) | Backend accepts invalid surfaces | Data quality | UX soft-validation only; document |
| G13 | Approval quirk: revoke keeps patient status | Confirmed (R15) | Doctor signature removed but patient shows accepted | Confusing approval card | Display both with clear labels; **recommendation:** backend resets `patient_status` on revoke |
| G14 | `notes: null` cannot clear | Confirmed (R14) | PATCH ignores null notes | Editing UX asymmetry | Mirror behavior; document in code comment |
| G15 | Version snapshots money = strings | Confirmed ([BCR §6.6]) | `Number()` coercion needed in diff views | Render bug risk | Central snapshot-parse helper + tests |
| G16 | Billing handoff dependency | Recommendation | Invoice-from-plan + plan↔invoice linkage (row badge, Billed/Unbilled filter) require the billing contract (BR-120/121/122/124/125) | 💰 button and billing badges unbuildable in this sprint | Defer (U13, U16); align with Part 2.7 sprint |
| G17 | Timeline/audit endpoint missing | Recommendation | No event stream for status changes | S-12 degraded | Ship "Plan Activity" card; audit endpoint on backend roadmap |
| G18 | 13th screen identity | Clarification | 13-screen count = 12 named in [P2.5] + Doctor Dashboard widget; master spec §9 lists 5 (all overlapping) | Inventory drift | §2 reconciles; confirm enumeration at kickoff |
| G19 | "Progress by doctor" needs user→doctor mapping | Confirmed (S-13) | Current user's doctor UUID requires doctors-module lookup by `user_id` | Extra lookup | Do once, cache; verify doctors API shape during implementation |

**Areas requiring clarification (raised, not blocking):**
1. Product intent for REJECTED plans (G4) — is "create new plan" acceptable UX?
2. Whether the "Generate Invoice" button ships in this sprint (G16) — depends on billing contract.
3. Whether owner-check tooltips ([P2.5 §15.4]) are desired given backend has no ownership (G11).
4. Whether item-status backend work is prioritized before or after Sprint 12A frontend (G2).

---

## 15. Final Implementation Readiness

### 15.1 Overall readiness

**✅ READY TO IMPLEMENT — Sprint 12A can begin.** The core workflow is fully backend-supported; the two degraded screens (S-09, S-10) have clear, documented scope cuts; the two deferred surfaces (S-11, S-12) are isolated. No blocker prevents starting; G2/G4/G16 should be confirmed at kickoff but do not block phase 1 (foundation + list + create + items).

### 15.2 Blocking issues

None. **Near-blocking (must be resolved before their respective build steps):**
- G4 (REJECTED flow) before the transition-action bar is finalized.
- G16 (billing button) before S-02 is considered complete.
- G2 (item status) before S-09/S-10 build starts.

### 15.3 Recommended implementation order & dependencies

```
Phase 1 — Foundation (no deps)
  types/treatmentPlan.ts, types/procedure.ts          (contract from [BCR §15.1])
  utils/treatmentPlanStateMachine.ts                  (O5 — must exist before any action bar)
  treatmentPlanService.ts, procedureService.ts        ([BCR §15.2])
  constants/treatmentPlan.ts, constants/procedure.ts  (status meta, category labels)
  name-resolution helper (resolvePatientDoctorNames)  (R10)
Phase 2 — Procedure catalog (S-07, S-08)              ← unblocks item forms
  list/search/active + admin CRUD + activate/deactivate/delete (⭐ PermissionGate)
Phase 3 — Plan list + dashboard (S-01, S-13 data)     ← deps: Phase 1
  filters, pagination, search, StatusBadge map, dashboard cards (count-only ack card)
Phase 4 — Create plan + items (S-03, S-04)            ← deps: Phases 1–2 (procedure picker)
  CreatePlanDialog (complete-form rule, O1), AddItem/UpdateItem/Remove/Reorder
Phase 5 — Transitions + approval (S-02, S-06)         ← deps: Phases 3–4
  PlanTransitionActions, ConfirmTransitionDialog, approval cards, accept/decline
Phase 6 — Versions (S-05)                             ← deps: Phase 5
  VersionTimeline, diff (string-money parsing), create/restore dialogs
Phase 7 — Detail assembly + scope-cut surfaces        ← deps: Phases 4–6
  S-02 tabs, "Plan Activity" card (S-12 partial), read-only item status (S-09/S-10 cuts)
Phase 8 — (conditional) Billing handoff button        ← deps: billing contract (G16)
```

### 15.4 Suggested validation gates (per phase)

- **Schema tests:** Zod mirrors every [BCR §5] bound; FDI edges (49 rejected), discount > cost, sequence duplicates, `extra` fields rejected.
- **Service tests:** URL/verb/params per [BCR §15.2] (mirror `appointmentService.test.ts` style).
- **State-machine tests:** `planActionsForStatus` matches [BCR §11.1] in both directions.
- **Component tests:** transition visibility per status; 409/422 surfacing; empty states; pagination.
- **Container tests:** invalidation keys (`['treatment-plans']`, detail, `['dashboard']`, `['procedures']`).
- **QA:** manual walkthrough of the 9 supported screens per the [P2.5 §16] sign-off criteria, plus explicit verification that unsupported affordances (U1–U15) are absent/hidden.

### 15.5 Conclusion

The approved 13-screen Treatment Plan UI and the verified backend are **compatible enough to begin implementation**. The blueprint above gives every visible element a backend source (or an explicit unsupported disposition), encodes the verified state machine and RBAC, and de-risks the known gaps. **Sprint 12A may proceed** once Phase-1 foundation and the three near-blocking clarifications (G2, G4, G16) are acknowledged by product/backend stakeholders.

---

## Appendix A — Traceability Map

| UI source ([P2.5]/[MS]) | Screen | Backend source ([BCR]) | Status |
|---|---|---|---|
| §3.4 / §9.1 | S-01 Treatment Plan List | §4.1 (#2–6,9), §4.3, §6.1–6.2 | ✅ Supported |
| §3.5 / §9.3 | S-02 Treatment Plan Detail | §4.1 (#12–30), §6.3–6.5 | ✅ Supported (invoice deferred) |
| §3.6 / §9.2 | S-03 Create Treatment Plan | §4.1 (#1), §5.1, §9.2 | ✅ Supported |
| §3.7 | S-04 Edit / Add Items | §4.1 (#13–16), §5.2–5.4, §9.3 | ✅ Supported |
| §3.8 / §9.5 | S-05 Version History/Diff | §4.1 (#31–34), §6.6, §9.6 | ✅ Supported |
| §3.9 | S-06 Approval Status | §4.1 (#27–30), §6.5, §9.5 | ✅ Supported |
| §4.4 / §9.4 | S-07 Procedure Catalog | §4.2, §4.3, §6.8 | ✅ Supported |
| §4.5 | S-08 Create/Edit Procedure | §4.2 (#1,8–10), §5.6 | ✅ Supported |
| §5.2 | S-09 Procedure Execution | §4.1 (#14 notes only) | ⚠️ Partial (item status unsupported) |
| §6.2 | S-10 Treatment Progress | §6.2, §6.7 | ⚠️ Partial (progress not computable) |
| §7.2 | S-11 Clinical Attachments | — | ❌ Deferred |
| §11.2 | S-12 Treatment Timeline | §6.3, §6.6 | ⚠️ Partial (event stream missing) |
| §6.2 / §8 | S-13 Doctor Dashboard widget | §4.1 (#8,10), §6.2 | ✅ Supported (progress column removed) |

*End of mapping. This document is the implementation blueprint for Sprint 12A; any future backend change (item transitions, plan-header PATCH, plan delete, audit endpoint) must re-run this mapping before the corresponding UI is built.*
