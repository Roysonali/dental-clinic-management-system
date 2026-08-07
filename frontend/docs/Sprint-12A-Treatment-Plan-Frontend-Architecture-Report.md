# Sprint 12A — Treatment Plan Frontend Architecture Report

> **Document type:** Sprint 12A Phase 3 deliverable — Frontend Architecture Report (single implementation specification)
> **Status:** ✅ COMPLETE
> **Date:** 2026-08-06
> **Authoring role:** Principal Frontend Architect / React Query Architect
> **Inputs (authoritative, in priority order):**
> 1. Backend contract — `frontend/docs/Treatment-Plan-Backend-Contract-Review.md` → **[BCR]**
> 2. UI ↔ Backend capability mapping — `frontend/docs/Treatment-Plan-UI-Backend-Capability-Mapping.md` → **[MAP]**
> 3. Approved UI — `frontend/docs/DensCare-Treatment-Modules-Part-2.5.md` → **[P2.5]**; `docs/frontend/UI_MASTER_SPECIFICATION.md` §9 → **[MS]**
> 4. Existing frontend codebase — `frontend/src/` (verified 2026-08-06) → **[SRC]**

**Scope rule:** this report defines **only** what the verified backend supports ([BCR]) and the approved blueprint ([MAP]) permits. Every screen retains its [MAP] screen ID (S-01…S-13). Anything unsupported in [MAP §11] (U1–U16) is **absent** from the architecture below — no client-side workarounds. Every architectural decision reuses an existing [SRC] pattern; the only new abstraction is the treatment-plan state machine helper ([MAP §12], O5).

**Reference conventions:** O1–O12 = [BCR §1.4] observations; R1–R18 = [BCR §17] risks; F1–F10 = [MAP §1.3] findings; U1–U16 = [MAP §11] unsupported elements; A1–A39 = [MAP §4] actions.

---

## 1. Executive Summary

### 1.1 Module objective
Implement the DensCare **Treatment Plan** module (plans, items, lifecycle transitions, doctor approval + patient acknowledgment, versioning) and the **Procedure Catalog** (admin-managed master data) in the existing production React frontend, using the approved 13-screen UX and the verified 45-endpoint backend contract — **without introducing new architectural patterns** ([SRC] is mature).

### 1.2 Scope
- **Included:** S-01 (plan list), S-02 (plan detail), S-03 (create plan), S-04 (item management), S-05 (versions), S-06 (approval status), S-07 (procedure catalog), S-08 (procedure form), S-13 (doctor-dashboard widget), plus the S-12 "Plan Activity" card (reconstructed from supported fields, [MAP §3.12]) and the S-09 item-details + notes surface ([MAP §3.9] scope cut) and S-10 informational progress summary ([MAP §3.10] scope cut).
- **Deferred (backend limitation, [MAP §11]):** item-status transitions (U2/U3), plan-header editing (U1), plan delete/archive (U4), return-to-draft (U5), attachments (U7), full timeline event stream (U8), print/download (U9), stale-data conflict dialog (U11), approval-notes input (U12), billing handoff (U13/U16).
- **Out of scope (future sprints):** odontogram, patient consent, prescription, procedure-level attachments, notification triggers, billing integration ([P2.5 §8–§10, §12.5]).

### 1.3 Dependencies
| Dependency | Module / source | Used by |
|---|---|---|
| Patients | `patientService.get(id)` for names, `PatientPicker` | S-01, S-02, S-03 |
| Doctors | `doctorService.get(id)` / `getByUserId(id)` for names + S-13 doctor mapping | S-01, S-02, S-03, S-13 |
| Users | `userService` for `created_by`/`changed_by` audit names (optional enrichment) | S-02, S-05 |
| RBAC | `RequireRole`, `PermissionGate`, `usePermission`, `useCurrentUserRole`, `ADMIN_ROLES` | procedure writes, navigation |
| Shared infra | DataTable, Pagination, SearchBar, Drawer, Modal, Form, Inputs, StatusBadge, StatCard, Timeline, EmptyState, Skeleton, ResultState, Toast, Alert | all screens |
| API | `api` (axios), `parseApiError`/`apiErrorMessage`/`shouldRetryQuery` | all |

### 1.4 Backend readiness
✅ Verified and complete for the included scope ([BCR §4]). 34 plan + 11 procedure endpoints, all JWT-protected; error envelope `{success,message,details}` compatible with existing `parseApiError` (F7).

### 1.5 UI readiness
✅ Approved and frozen ([P2.5], [MS §9]). No redesign required; the [MAP §11] scope cuts (U2/U3 for S-09/S-10) are the only UX deviations and are mandated by verified backend limitations.

### 1.6 Implementation readiness
**READY.** No blockers. Three kickoff confirmations recorded in [MAP §14] (REJECTED flow product intent, billing button timing, owner-tooltip policy) do not block Phase 1–4.

### 1.7 Overall architectural approach
Layered, matching [SRC] exactly: **route → thin page → container (orchestration) → presentational components**; **service (typed, axios) → React Query hooks (query-key factories + granular mutations) → UI**. Server state lives in React Query only; URL state carries the plan id; filter state lives in a per-module filters hook; form state in React Hook Form + shared Zod schemas; derived state via `useMemo`. No global store, no new UI framework, no new patterns beyond the single state-machine utility.

---

## 2. Module Scope

### 2.1 Included (implemented in Sprint 12A)
| # | Feature | Screens | Backend source |
|---|---|---|---|
| 1 | Plan list with server-side search/filter/sort/pagination | S-01 | `GET /treatment-plans` (+ `/search`, `/dashboard`, `/count-by-status`) |
| 2 | Pending-review / pending-approval queues (optional list views) | S-01 | `GET /treatment-plans/pending-review`, `/pending-approval` |
| 3 | Plan detail: header, workflow bar, items table, totals, tabs | S-02 | `GET /treatment-plans/{id}` |
| 4 | Create plan (DRAFT) — complete-at-creation rule (O1/R1) | S-03 | `POST /treatment-plans` |
| 5 | Item add / update / remove / reorder (editable statuses only) | S-04 | items endpoints (A3–A6) |
| 6 | Plan lifecycle transitions (submit, approve-review, reject-review, accept, decline, cancel, start, hold, resume, complete) | S-02 | transitions (A7–A20) |
| 7 | Doctor approval + patient acknowledgment | S-06 | A10–A13 |
| 8 | Version history, snapshot detail, create/restore | S-05 | A21–A22 |
| 9 | Procedure catalog browse/search/filter | S-07 | procedure reads |
| 10 | Procedure create/edit/activate/deactivate/delete (⭐ admin) | S-08 | procedure writes |
| 11 | Item details drawer with read-only status + notes editing | S-09 (cut) | `PATCH item {notes}` |
| 12 | Informational progress summary (item count + cost; no % bar) | S-10 (cut) | list/detail fields |
| 13 | "Plan Activity" card (created + versions + approval timestamps) | S-12 (partial) | detail aggregate |
| 14 | Doctor dashboard "My Active Treatment Plans" widget | S-13 | `GET /treatment-plans/by-doctor/{id}` + `/dashboard` |

### 2.2 Deferred (backend limitation — do not build)
Header editing (U1), item-status transitions + progress % (U2/U3), plan delete/archive (U4), revise-and-resubmit (U5), acknowledgment queue actions (U6), attachments (U7), full timeline events (U8), print/download (U9), modification-requires-version dialog (U10), stale-data 409 dialog (U11), approval notes (U12), billing generate-invoice + row badges/filters (U13/U16). Full rationale in [MAP §11].

### 2.3 Out of scope
Odontogram, consent, prescription modules ([P2.5 §8–§10]); billing module integration (Part 2.7 sprint); notification triggers; patient-profile cross-module timeline (Part 2.4 sprint).

---

## 3. Folder Structure, Ownership & File Responsibility

Mirrors the existing module layout in [SRC]: `pages/<module>`, `components/<module>` (+ `containers/`), `hooks/<module>`, `services/`, `types/`, `constants/`, `utils/` (schemas live in `utils/`, per the users-module convention `userCreateSchema.ts`; form transformers live inside the module's `components/` folder, per `patientFormUtils.ts` / `appointmentFormUtils.ts`).

```
src/
├── pages/
│   └── treatmentPlans/
│       ├── TreatmentPlanListPage.tsx        # S-01 thin page (PageWrapper + PageHeader + container)
│       ├── TreatmentPlanDetailsPage.tsx     # S-02 thin page
│       └── ProcedureListPage.tsx            # S-07 thin page
├── components/
│   ├── treatmentPlans/
│   │   ├── containers/
│   │   │   ├── TreatmentPlanListContainer.tsx      # S-01 orchestration (filters, queries, names, drawer, transitions)
│   │   │   ├── TreatmentPlanDetailsContainer.tsx   # S-02 orchestration (aggregate, tabs, action bar, dialogs)
│   │   │   └── ProcedureListContainer.tsx          # S-07 orchestration (+ procedure form drawer)
│   │   ├── TreatmentPlanToolbar.tsx         # search + filters UI (reuses DataTableToolbar/SearchBar)
│   │   ├── TreatmentPlanStatusBadge.tsx     # 9-status badge (StatusBadge + TREATMENT_PLAN_STATUS_VARIANTS)
│   │   ├── TreatmentPlanTable.tsx           # S-01 table (server-paginated)
│   │   ├── TreatmentPlanSummaryCards.tsx    # dashboard cards row (StatCard wrappers)
│   │   ├── WorkflowProgressBar.tsx          # S-02 workflow bar (role="progressbar")
│   │   ├── PlanTransitionActions.tsx        # status-driven action bar (single surface, [MAP §12])
│   │   ├── TreatmentPlanItemsTable.tsx      # S-02/S-04 items table (editable when isEditableStatus)
│   │   ├── ApprovalStatusCard.tsx           # S-06 doctor + patient cards
│   │   ├── VersionTimeline.tsx              # S-05 version list + expandable diff (Timeline component)
│   │   ├── PlanActivityCard.tsx             # S-12 partial — reconstructed events
│   │   ├── ItemDetailsDrawer.tsx            # S-09 cut — read-only item + notes editor
│   │   ├── ProgressSummaryCard.tsx          # S-10 cut — item_count + totals
│   │   ├── dialogs/
│   │   │   ├── CreatePlanDrawer.tsx         # S-03 680px drawer
│   │   │   ├── AddItemDialog.tsx / UpdateItemDialog.tsx / RemoveItemConfirm.tsx / ReorderItemsDialog.tsx
│   │   │   ├── ConfirmTransitionDialog.tsx  # generic A7–A20
│   │   │   ├── CancelPlanDialog.tsx
│   │   │   ├── CreateVersionDialog.tsx / RestoreVersionDialog.tsx
│   │   │   └── DoctorApproveDialog.tsx / DoctorRevokeDialog.tsx / PatientAcknowledgeDialog.tsx / PatientDeclineDialog.tsx
│   │   ├── treatmentPlanFormUtils.ts        # PlanFormValues ↔ CreatePlanRequest
│   │   └── itemFormUtils.ts                 # ItemFormValues ↔ AddItemRequest/ItemUpdateRequest
│   └── procedures/
│       ├── containers/ProcedureListContainer.tsx   # S-07 orchestration
│       ├── ProcedureTable.tsx
│       ├── ProcedureFormDialog.tsx          # S-08 480px drawer (create/edit; code disabled on edit)
│       ├── DeleteProcedureDialog.tsx        # + activate/deactivate confirm
│       ├── procedureStatusBadge.tsx         # active/inactive
│       └── procedureFormUtils.ts            # ProcedureFormValues ↔ ProcedureCreate/Update
├── hooks/
│   ├── treatmentPlans/
│   │   ├── treatmentPlanQueryKeys.ts        # key factory (single source of truth)
│   │   ├── useTreatmentPlans.ts             # S-01 list
│   │   ├── useTreatmentPlan.ts              # S-02 detail
│   │   ├── useTreatmentPlanSearch.ts        # /search type-ahead
│   │   ├── useTreatmentPlanFilters.ts       # filter state (server-side params)
│   │   ├── useTreatmentPlanNames.ts         # patient/doctor name resolution (mirrors useAppointmentNames)
│   │   ├── useTreatmentDashboard.ts         # /dashboard + count-by-status
│   │   ├── usePendingQueues.ts              # pending-review / pending-approval
│   │   ├── useMyActiveTreatmentPlans.ts     # S-13 by-doctor
│   │   ├── useTreatmentPlanMutations.ts     # create plan
│   │   ├── useTreatmentPlanItemMutations.ts # add/update/remove/reorder
│   │   ├── useTreatmentPlanTransitionMutations.ts  # A7–A20
│   │   ├── useTreatmentPlanApprovalMutations.ts    # A10–A13
│   │   └── useTreatmentPlanVersionMutations.ts     # A21–A22
│   └── procedures/
│       ├── procedureQueryKeys.ts
│       ├── useProcedures.ts / useProcedureSearch.ts / useActiveProcedures.ts / useProcedure.ts
│       └── useProcedureMutations.ts
├── services/
│   ├── treatmentPlanService.ts              # 34 plan endpoints
│   └── procedureService.ts                  # 11 procedure endpoints
├── types/
│   ├── treatmentPlan.ts                     # entities, DTOs, params, pagination, form models
│   └── procedure.ts
├── constants/
│   ├── treatmentPlan.ts                     # page sizes, badge variants, labels, filters, FDI ranges, state machine inputs
│   └── procedure.ts                         # categories, page sizes
└── utils/
    ├── treatmentPlanFormSchema.ts           # Zod: create plan
    ├── itemFormSchema.ts                    # Zod: add/update item (incl. FDI ranges)
    ├── procedureFormSchema.ts               # Zod: procedure create/update
    ├── versionFormSchema.ts                 # Zod: change_reason 1–500
    ├── treatmentPlanStateMachine.ts         # ★ ONLY new abstraction (O5/R9)
    └── treatmentPlanFormatting.ts           # snapshot money-string parsing + currency reuse
```

**Reusable vs module-specific:** every file above marked with an existing [SRC] equivalent in §12 of [MAP] is *module-specific glue over shared infrastructure*; nothing new is invented (e.g., tables reuse `DataTable`, drawers reuse `Drawer`/`Modal`). The **only new architectural file** is `utils/treatmentPlanStateMachine.ts`.

---

## 4. Routing Architecture

Route constants are added to `src/constants/`… `src/routes/routes.ts` (extend the existing `ROUTES` object — `ROUTES.TREATMENT_PLANS` already exists) and metadata to `routeMeta.ts` (entry `TREATMENT_PLANS` already present; add `PROCEDURES`). All treatment routes are children of `ProtectedRoute` + `DashboardLayout` in `AppRouter.tsx`, following the appointments/patients pattern ([SRC] `AppRouter.tsx`).

| Screen | Frontend route | Navigation source | Breadcrumb hierarchy | Protection |
|---|---|---|---|---|
| S-01 Plan List | `/treatment-plans` | Sidebar → Treatment Plans; Patient Profile tab; Doctor Dashboard card | Treatment Plans | `ProtectedRoute` (auth) — no role gate (backend allows 🅰; backend-first, [BCR §12.3]) |
| S-02 Plan Detail | `/treatment-plans/:planId` | S-01 row click; S-13 row click; patient-profile plan click | Treatment Plans › `{plan_code}` (alt: Patients › `{patient}` › Treatment Plans › `{plan_code}`) | `ProtectedRoute` |
| S-03 Create Plan | **No dedicated route** — 680px `CreatePlanDrawer` inside `TreatmentPlanListContainer` (established drawer pattern, [SRC] appointments/patients) | S-01 "Create Plan" button; Patient Profile "Create Plan" (drawer pre-fills `patient_id`) | — (overlay) | `ProtectedRoute` (drawer); optional future deep-link `/treatment-plans/new` renders list + auto-open drawer |
| S-04 Item management | Embedded in S-02 (items table editing) — no route | S-02 actions | — | `ProtectedRoute` + `isEditableStatus(plan.status)` |
| S-05 Versions | Tab inside S-02 (`/treatment-plans/:planId` → History tab); no separate route | S-02 "Versions" button / tab | — | `ProtectedRoute` |
| S-06 Approval Status | Tab inside S-02 (Approval Status tab) | S-02 tab | — | `ProtectedRoute` |
| S-07 Procedure Catalog | `/procedures` | Sidebar → Administration › Procedure Catalog | Administration › Procedure Catalog | `ProtectedRoute` — **no role gate on the route** (reads are 🅰; write actions gated inline via `PermissionGate`, [MAP §9]) |
| S-08 Create/Edit Procedure | 480px `ProcedureFormDialog` inside `ProcedureListContainer` | S-07 buttons | — (overlay) | `ProtectedRoute` + `PermissionGate` ⭐ on trigger |
| S-09 Item details | `ItemDetailsDrawer` inside S-02 (click item row) — no route | S-02 items table | — (overlay) | `ProtectedRoute` + editable-status notes gate |
| S-10 Progress summary | Card inside S-02 | — | — | `ProtectedRoute` |
| S-11 Attachments | — | — | — | **Not routed** (U7) |
| S-12 Timeline / Plan Activity | `PlanActivityCard` embedded in S-02 (and later Patient Profile) | S-02 tab or patient timeline | — | `ProtectedRoute` |
| S-13 Doctor Dashboard widget | `/dashboard` (existing `DashboardPage` grid + `ActiveTreatmentPlansCard`) | Dashboard | Dashboard | `ProtectedRoute` |

**Navigation (sidebar) gating:** add "Treatment Plans" and "Procedure Catalog" nav items; hide both from `DENTAL_ASSISTANT` (excluded by the backend on every endpoint, [BCR §3.1]/R16) using the existing nav role-filtering mechanism (`useCurrentUserRole`), consistent with how clinical items are treated. **Do not** gate the `/procedures` route itself for non-admin readers (reads are 🅰 — backend-first).

**Route params:** `:planId` = plan UUID (validated; 404 → `ResultState`).

---

## 5. Screen Architecture

Pages are thin ([SRC] `AppointmentListPage` pattern). Containers own orchestration ([SRC] `AppointmentListContainer`). Diagrams below are the component trees; every leaf is a presentational component reusing [SRC] primitives.

### 5.1 S-01 — Treatment Plan List
- **Purpose:** search/filter/browse plans. **Route:** `/treatment-plans`. **Layout:** PageHeader → Toolbar (SearchBar + filters) → SummaryCards → Table → Pagination. **Backend deps:** list + dashboard + names.
```
TreatmentPlanListPage
└── TreatmentPlanListContainer            (queries, filters, names, drawer, navigation)
    ├── TreatmentPlanToolbar              (SearchBar + Status/Doctor/Date/Active filters + Clear)
    ├── TreatmentPlanSummaryCards         (StatCard: total, pending review, pending approval, pending ack(count-only))
    ├── TreatmentPlanTable                (DataTable; columns per [MAP §7.1]; row click → detail)
    │   └── TreatmentPlanStatusBadge      (StatusBadge + variant map)
    ├── Pagination                        (bound to total_pages; page-size selector)
    ├── CreatePlanDrawer                  (S-03)
    └── (optional) ConfirmTransitionDialog + PendingQueueBanner
```

### 5.2 S-02 — Treatment Plan Detail
- **Purpose:** full plan + workflow actions. **Route:** `/treatment-plans/:planId`. **Layout:** PageHeader → WorkflowProgressBar → PlanTransitionActions → Tabs [Plan Details | History | Approval Status] → Clinical Info → Items → Progress Summary. **Backend deps:** aggregate + all mutations.
```
TreatmentPlanDetailsPage
└── TreatmentPlanDetailsContainer        (useTreatmentPlan, action bar, dialogs, tab state)
    ├── PageHeader                        (back link, plan_code, badge, version chip, dates)
    ├── WorkflowProgressBar               (role="progressbar"; status-driven)
    ├── PlanTransitionActions             (single surface per planActionsForStatus)
    ├── Tabs (reuse Tabs)
    │   ├── Plan Details
    │   │   ├── ClinicalInfoCard           (read-only notes/observations/recommendations — O1)
    │   │   ├── TreatmentPlanItemsTable    (sequence, procedure, tooth, cost, discount, notes, actions)
    │   │   ├── ProgressSummaryCard        (S-10 cut: item_count + totals)
    │   │   ├── ItemDetailsDrawer          (S-09 cut: read-only item + notes editor)
    │   │   └── AddItemDialog / UpdateItemDialog / RemoveItemConfirm / ReorderItemsDialog (S-04)
    │   ├── History                        → VersionTimeline + CreateVersionDialog + RestoreVersionDialog (S-05)
    │   └── Approval Status                → ApprovalStatusCard + doctor/patient dialogs (S-06)
    └── PlanActivityCard                   (S-12 partial)
```

### 5.3 S-03 — Create Plan (drawer)
- **Purpose:** DRAFT creation, complete-at-creation (O1/R1). **Layout:** 680px drawer: Patient picker → Doctor picker → 3 textareas → dates → optional code. **Backend dep:** `POST /treatment-plans`.
```
CreatePlanDrawer (Modal/Drawer + Form)
├── PatientPicker (existing) + DoctorSelect
├── FormFields: clinical_notes, observations, dentist_recommendations (Textarea)
├── DatePicker × 2 (valid_from/valid_to)   (YYYY-MM-DD only, O6)
├── Optional plan_code Input (hidden by default; auto TXN-XXXXXX)
├── FormActions (Cancel / Create)
└── validation: createPlanSchema (Zod) + parseApiError field errors
```

### 5.4 S-04 — Item Management (embedded in S-02)
- **Purpose:** compose items in editable statuses. **Backend deps:** items CRUD + reorder.
```
TreatmentPlanItemsTable
├── AddItemDialog (ProcedureSearch → AddItemForm fields per [MAP §6.2])
├── UpdateItemDialog (same schema, partial; notes null quirk per [MAP §6.3])
├── RemoveItemConfirm
└── ReorderItemsDialog (up/down + drag; item_ids payload)
```

### 5.5 S-05 — Version History
- **Purpose:** snapshots + diff + restore. **Layout:** History tab: VersionTimeline (Timeline component) → expandable snapshot detail (lazy `GET /versions/{id}`; money strings → Number()) → Restore confirm (editable only).
```
VersionTimeline
├── CreateVersionDialog (change_reason 1–500)
├── VersionDetailPanel (lazy fetch; diff vs current items; string→number formatting)
└── RestoreVersionDialog (destructive warning confirm)
```

### 5.6 S-06 — Approval Status
- **Purpose:** doctor + patient consent cards. **Layout:** two cards.
```
ApprovalStatusCard
├── DoctorApprovalSection (approved_by/at; Approve/Revoke buttons per state)
├── PatientAcknowledgmentSection (patient_status/at; Accept/Decline buttons per state)
└── DoctorApproveDialog / DoctorRevokeDialog / PatientAcknowledgeDialog / PatientDeclineDialog
```

### 5.7 S-07 — Procedure Catalog
- **Purpose:** browse/manage master catalog. **Route:** `/procedures`. **Layout:** PageHeader → Toolbar (search + category + status filters) → Table → Pagination.
```
ProcedureListPage
└── ProcedureListContainer
    ├── ProcedureToolbar (SearchBar → /procedures/search debounced; category/status selects)
    ├── ProcedureTable (DataTable; columns per [MAP §7.2])
    │   └── procedureStatusBadge
    ├── Pagination (total_pages)
    ├── ProcedureFormDialog (S-08, ⭐ gated trigger)
    ├── DeleteProcedureDialog (⭐; "deactivate first" hint on 409)
    └── Activate/DeactivateConfirm (⭐)
```

### 5.8 S-08 — Create/Edit Procedure (drawer)
- **Purpose:** procedure form. **Layout:** 480px drawer. **Backend deps:** create/update + activate/deactivate (active toggle = separate calls, [MAP §6.6/§6.7]).
```
ProcedureFormDialog
├── FormFields: code (disabled on edit — immutable), name, description, default_cost, category, is_active toggle
├── is_active handled as activate/deactivate PATCH (not part of form payload)
├── FormActions
└── procedureFormSchema (Zod: code regex, cost bounds, category enum)
```

### 5.9 S-09 — Procedure Execution (scope cut)
- **Purpose:** read-only item details + notes editing ([MAP §3.9]). **Layout:** drawer from items table.
```
ItemDetailsDrawer
├── ItemSummary (procedure, tooth/surface/quadrant/arch, cost/discount, status PENDING read-only)
├── NotesEditor (single notes field; PATCH {notes}; editable statuses only)
└── (no item-status action buttons — U2)
```

### 5.10 S-10 — Treatment Progress (scope cut)
- **Purpose:** informational summary. **Layout:** card in S-02.
```
ProgressSummaryCard
├── item_count / total_estimated_cost (StatCard or DescriptionList)
└── (no % bar, no status counts — U3)
```

### 5.11 S-11 — Attachments
**Not built** (U7). No route, no component. [P2.5 §7.2] deferred to Patient Records.

### 5.12 S-12 — Treatment Timeline (partial)
- **Purpose:** "Plan Activity" reconstruction from supported fields ([MAP §3.12]).
```
PlanActivityCard (Timeline component)
├── Plan created event (created_at/created_by)
├── Version created events (versions[].created_at/change_reason)
├── Approval events (approved_at / patient_acknowledged_at)
└── (no status-change/item events — no endpoint)
```

### 5.13 S-13 — Doctor Dashboard widget
- **Purpose:** active plans for current doctor. **Layout:** card in `DashboardPage` grid.
```
ActiveTreatmentPlansCard (Card + StatCard pattern)
├── useMyActiveTreatmentPlans()  (by-doctor + status filter)
├── MiniTable: Plan Code · Patient · Status · Items · Total · Updated  (no progress % — U3)
└── row click → /treatment-plans/:planId
```

---

## 6. Type Architecture

Conventions from [SRC] `types/appointment.ts`: **no TS enums** (tsconfig `erasableSyntaxOnly` — use string-literal unions); DTO interfaces mirror backend schemas verbatim (snake_case); presentational form models separate; enriched row types for display. Pagination note: treatment plans use `page/page_size/total_pages` (NOT the appointments `skip/limit` shape).

### 6.1 Enums (string-literal unions, [BCR §15.1])
```ts
export type TreatmentPlanStatus = 'draft' | 'under_review' | 'proposed' | 'rejected'
  | 'accepted' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type TreatmentPlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'deferred';
export type PatientAcknowledgmentStatus = 'pending' | 'accepted' | 'rejected' | 'changes_requested';
export type ProcedureCategory = 'diagnostic' | 'preventive' | 'restorative' | 'endodontic' | 'periodontic'
  | 'prosthodontic' | 'oral_surgery' | 'orthodontic' | 'cosmetic' | 'implant' | 'other';
export type ToothQuadrant = 'UR' | 'UL' | 'LL' | 'LR';
export type ToothArch = 'upper' | 'lower';
```

### 6.2 Entities / DTOs (`types/treatmentPlan.ts`)
`PaginatedResponse<T>` (shared shape: `{items, total, page, page_size, total_pages}`), `TreatmentPlanListItem`, `TreatmentPlanResponse` (aggregate), `TreatmentPlanItemResponse` (nested `procedure: ProcedureSummary | null`), `ApprovalResponse`, `VersionListItem`, `VersionDetailResponse` (snapshot `estimated_cost`/`discount` as **string** — parse via `treatmentPlanFormatting.ts`), `DashboardSummaryResponse` (dense `by_status` with all 9 keys).

### 6.3 DTOs — requests (exact [BCR §5])
`CreatePlanRequest`, `AddItemRequest`, `ItemUpdateRequest` (partial; `_UNSET` semantics: explicit `null` clears tooth fields, ignored for notes), `ReorderItemsRequest`, `VersionRequest`, `ProcedureCreateRequest`, `ProcedureUpdateRequest` (no `code`).

### 6.4 Filters & pagination params
`PlanListParams` (`search, patient_id, doctor_id, status, is_active, date_from, date_to, page, page_size, sort_by, sort_order` — `sort_by` narrowed to `'created_at'|'updated_at'|'status'|'plan_code'`), `ProcedureListParams` (`page, page_size, is_active, category, sort_by('code'|'name'|'category'|'default_cost'), sort_order`).

### 6.5 Form models (never sent as-is, [SRC] `AppointmentFormValues` pattern)
`PlanFormValues` (strings for selects; date strings `YYYY-MM-DD`), `ItemFormValues`, `ProcedureFormValues` (cost as string for currency input), transformed by `*FormUtils.ts`.

### 6.6 Enriched display types
`EnrichedTreatmentPlan extends TreatmentPlanListItem { patient_name: string|null; doctor_name: string|null }`; `EnrichedPlanItem` adds resolved `procedure` display fields (already nested — enrichment only for name/cost formatting helpers).

**Ownership & relationships:** types are owned by `types/treatmentPlan.ts` / `types/procedure.ts`; `types/appointment.ts` etc. untouched. `PaginatedResponse<T>` is generic in the module file (or promoted to a shared `types/pagination.ts` only if needed by a second module — do not refactor existing modules).

---

## 7. Service Layer & Service Ownership Matrix

Pattern: plain object of typed async methods, `api` client, destructure `data`, errors bubble as Axios errors for `parseApiError` ([SRC] `appointmentService.ts`). One service per backend router.

### 7.1 `treatmentPlanService.ts` — owns all 34 `/treatment-plans` endpoints
| Method | Endpoint | Success |
|---|---|---|
| `createPlan(payload)` | `POST /treatment-plans` | 201 |
| `listPlans(params)` | `GET /treatment-plans` | 200 |
| `searchPlans(term, limit?)` | `GET /treatment-plans/search` | 200 |
| `listPendingReview(page?, pageSize?)` | `GET /treatment-plans/pending-review` | 200 |
| `listPendingApproval(page?, pageSize?)` | `GET /treatment-plans/pending-approval` | 200 |
| `getDashboard()` | `GET /treatment-plans/dashboard` | 200 |
| `listByPatient(patientId, params?)` | `GET /treatment-plans/by-patient/{id}` | 200 |
| `listByDoctor(doctorId, params?)` | `GET /treatment-plans/by-doctor/{id}` | 200 |
| `countByStatus()` / `countByDoctor(id?)` / `countByPatient(id?)` | `count-by-*` | 200 |
| `getPlan(id)` | `GET /treatment-plans/{id}` | 200 |
| `addItem(id, payload)` | `POST …/items` | 201 |
| `updateItem(id, itemId, payload)` | `PATCH …/items/{itemId}` | 200 |
| `removeItem(id, itemId)` | `DELETE …/items/{itemId}` | 200 |
| `reorderItems(id, itemIds)` | `PUT …/items/reorder` | 200 |
| `submitForReview` … `complete(id)` (10 transitions) | `POST …/<transition>` (no body) | 200 |
| `doctorApprove(id)` / `doctorRevoke(id)` / `patientAcknowledge(id)` / `patientDecline(id)` | approval posts | 200 |
| `createVersion(id, changeReason)` / `listVersions(id)` / `getVersion(id, versionId)` / `restoreVersion(id, versionId)` | version endpoints | 201/200 |

**Responsibilities:** URL/verb/payload mapping only; shared utilities (`api`, `parseApiError`) reused; **no** business rules, no state-machine knowledge (that lives in `utils/treatmentPlanStateMachine.ts`).

### 7.2 `procedureService.ts` — owns all 11 `/procedures` endpoints
| Method | Endpoint | Auth |
|---|---|---|
| `listProcedures(params)` / `searchProcedures(term, limit?)` / `listActiveProcedures()` / `countProcedures(isActive?)` | reads | 🅰 |
| `getProcedure(id)` / `getProcedureByCode(code)` | reads | 🅰 |
| `createProcedure(payload)` / `updateProcedure(id, payload)` / `activateProcedure(id)` / `deactivateProcedure(id)` / `deleteProcedure(id)` | writes (delete → 204 no body) | ⭐ |

### 7.3 Error handling strategy (shared)
All methods rely on the global axios instance + `parseApiError`/`apiErrorMessage`/`shouldRetryQuery` ([SRC] `apiError.ts`). No per-service try/catch except best-effort name lookups in `useTreatmentPlanNames` (swallow → `null`, mirroring `useAppointmentNames`). Delete-procedure 204 returns `undefined` — the service returns `void` (callers show their own toast).

---

## 8. React Query Architecture

Client defaults (existing, [SRC] `main.tsx`): `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`. Every module hook follows the [SRC] pattern: **query-key factory** (single source of truth for invalidation) + `useQuery` (with `placeholderData: keepPreviousData` for lists) + granular `useMutation`s (invalidate on success).

### 8.1 Query key factories
```ts
// hooks/treatmentPlans/treatmentPlanQueryKeys.ts
export const treatmentPlanQueryKeys = {
  all: ['treatment-plans'] as const,
  list: (params: PlanListParams) => ['treatment-plans', 'list', params] as const,
  search: (term: string) => ['treatment-plans', 'search', term] as const,
  detail: (id: string) => ['treatment-plans', 'detail', id] as const,
  pendingReview: ['treatment-plans', 'pending-review'] as const,
  pendingApproval: ['treatment-plans', 'pending-approval'] as const,
  dashboard: ['treatment-plans', 'dashboard'] as const,
  byPatient: (patientId: string, params: PlanListParams) => ['treatment-plans', 'by-patient', patientId, params] as const,
  byDoctor: (doctorId: string, params: PlanListParams) => ['treatment-plans', 'by-doctor', doctorId, params] as const,
};
// hooks/procedures/procedureQueryKeys.ts
export const procedureQueryKeys = {
  all: ['procedures'] as const,
  list: (params: ProcedureListParams) => ['procedures', 'list', params] as const,
  search: (term: string) => ['procedures', 'search', term] as const,
  active: ['procedures', 'active'] as const,
  detail: (id: number) => ['procedures', 'detail', id] as const,
};
// names (mirror useAppointmentNames)
['treatment-plan-names', { patients: sortedIds, doctors: sortedIds }]
```
All plan keys share the `'treatment-plans'` root so `invalidateQueries({ queryKey: ['treatment-plans'] })` invalidates list + detail + queues + dashboard together.

### 8.2 Hook inventory (per screen)

| Hook | Screen | Query key | Deps | Cache strategy / staleTime | Retry | Loading state |
|---|---|---|---|---|---|---|
| `useTreatmentPlans(params)` | S-01 | `list(params)` | filter params | `keepPreviousData`; 30s | default (1) | `isPending` skeleton; `isFetching && !isPlaceholderData` toolbar spinner |
| `useTreatmentPlanSearch(term)` | S-01/S-04 | `search(term)` | debounced term | enabled when term ≥1 char; 30s | default | dropdown loading |
| `useTreatmentPlan(id)` | S-02 | `detail(id)` | plan id | enabled when id set; 30s | default | `isPending` skeleton page; 404 → ResultState |
| `useTreatmentDashboard()` | S-01/S-13 | `dashboard` | — | 30s | default | summary-card skeletons |
| `useTreatmentPlanFilters()` | S-01 | — (local state → params) | — | — | — | — |
| `useTreatmentPlanNames(patientIds, doctorIds)` | S-01/S-02/S-13 | names key | deduped sorted id sets | **5 min** (catalog-ish); best-effort null on failure | `shouldRetryQuery` (never 401/403) | `namesLoading` pattern per [SRC] |
| `usePendingReview(page?)` / `usePendingApproval(page?)` | S-01 (queues) | `pendingReview` / `pendingApproval` | page | 30s | default | table skeleton |
| `useMyActiveTreatmentPlans(doctorId, params)` | S-13 | `byDoctor(doctorId, params)` | doctor UUID (via `doctorService.getByUserId`) | 30s | default | card skeleton |
| `useProcedures(params)` | S-07 | `list(params)` | params | `keepPreviousData`; 30s | default | skeleton |
| `useProcedureSearch(term)` | S-07/S-04 | `search(term)` | debounced | 30s | default | dropdown loading |
| `useActiveProcedures()` | S-04 (item form) | `active` | — | **5 min** (static catalog; invalidate on admin writes) | default | select disabled until loaded |
| `useProcedure(id)` | S-08 edit | `detail(id)` | id | 30s | default | drawer skeleton |

### 8.3 Mutation hooks (granular, [SRC] pattern)
| Hook file | Mutations |
|---|---|
| `useTreatmentPlanMutations.ts` | `useCreateTreatmentPlan` |
| `useTreatmentPlanItemMutations.ts` | `useAddItem`, `useUpdateItem`, `useRemoveItem`, `useReorderItems` |
| `useTreatmentPlanTransitionMutations.ts` | `useSubmitForReview`, `useApproveReview`, `useRejectReview`, `useAcceptPlan`, `useDeclinePlan`, `useCancelPlan`, `useStartTreatment`, `usePutOnHold`, `useResume`, `useComplete` |
| `useTreatmentPlanApprovalMutations.ts` | `useDoctorApprove`, `useDoctorRevoke`, `usePatientAcknowledge`, `usePatientDecline` |
| `useTreatmentPlanVersionMutations.ts` | `useCreateVersion`, `useRestoreVersion` |
| `useProcedureMutations.ts` | `useCreateProcedure`, `useUpdateProcedure`, `useActivateProcedure`, `useDeactivateProcedure`, `useDeleteProcedure` |

**Mutation defaults:** `retry: 0` (never auto-retry writes), no optimistic updates (O9 — concurrency conflicts surface as 500; refetch-after-success is the sync mechanism, [MAP §13]).

---

## 9. Query Invalidation Matrix (React Query contract)

All plan mutations invalidate `['treatment-plans']` (root → list, detail, queues, dashboard, by-patient/by-doctor) plus the names cache where ids could shift. Dashboard re-fetches because `by_status`/`pending_*`/`total_plans` change on every transition/create.

| Mutation | Queries invalidated | Why |
|---|---|---|
| `createPlan` | `['treatment-plans']` root + `['treatment-plan-names']` | new row in lists; dashboard totals |
| `addItem` / `updateItem` / `removeItem` / `reorderItems` | `['treatment-plans']` root | `item_count`, `total_estimated_cost`, item rows, current items for diff |
| `submitForReview` / `rejectReview` | `['treatment-plans']` root | status badge in all lists; `pendingReview` queue membership; dashboard `by_status` |
| `approveReview` | `['treatment-plans']` root | status change → list + `pendingApproval` queue + dashboard |
| `doctorApprove` / `doctorRevoke` | `['treatment-plans']` root | approval card; `pendingApproval` queue membership; dashboard `pending_approval` |
| `patientAcknowledge` / `patientDecline` | `['treatment-plans']` root | approval card; dashboard `pending_acknowledgment` count |
| `acceptPlan` / `declinePlan` / `cancelPlan` / `startTreatment` / `putOnHold` / `resume` / `complete` | `['treatment-plans']` root | status in list/detail/queues; dashboard `by_status` + counts |
| `createVersion` / `restoreVersion` | `['treatment-plans']` root (versions embedded in aggregate) + `detail(id)` | version list, `current_version`, items after restore |
| `createProcedure` / `updateProcedure` / `activateProcedure` / `deactivateProcedure` | `['procedures']` root (list, search, active, detail) | catalog rows + dropdowns in item forms |
| `deleteProcedure` | `['procedures']` root | row removal |

**Implementation rule:** every mutation hook receives `planId` (or emits it via `onSettled` with variables) so a targeted `detail(planId)` invalidation is possible, but the standard `['treatment-plans']` root invalidation is the contract — simplest, safe, and cheap at clinic scale. Confirm with a container test that each mutation invalidates the root key ([MAP §15.4]).

---

## 10. Form Architecture

Shared approach: **React Hook Form + Zod schema in `utils/`** (users-module convention) + **form transformers in `components/<module>/*FormUtils.ts`** (appointments/patients convention). Presentational values are never sent raw. `extra="forbid"` on the backend means payloads must contain exactly the mapped fields (no extras → 422). Field-level defaults/validation/immutability are **taken verbatim from [MAP §6]**.

| Form | Schema (utils/) | Fields | Backend constraints | Immutable / read-only | Defaults |
|---|---|---|---|---|---|
| Create Plan | `createPlanSchema` | patient (required), doctor (required), clinical_notes, observations, dentist_recommendations, valid_from, valid_to, plan_code (optional) | notes ≤5000; dates `YYYY-MM-DD` + `from ≤ to`; code ≤20 unique; **all header fields create-only (O1)** | plan_code immutable after create; header fields read-only after create | code auto `TXN-XXXXXX` |
| Add Item | `addItemSchema` | procedure (required), sequence_number, tooth_number, tooth_surface, quadrant, arch, estimated_cost, discount, notes | FDI 11–48/51–85 (Zod mirrors 422); cost 0–999999.99; discount ≤ cost; sequence unique; procedure must be active; surface soft-validation only (O8) | item_status always `pending` (read-only, U2) | cost = procedure `default_cost` (hint text) |
| Update Item | partial of `addItemSchema` | any subset + explicit-null clears (tooth fields) | `notes: null` ignored (R14); `""` invalid — **no "clear notes" affordance** | — | — |
| Reorder | array schema | `item_ids: string[]` | must be all items exactly once | — | — |
| Create Version | `versionSchema` | change_reason (required) | 1–500; trimmed | — | — |
| Procedure Create | `procedureFormSchema` | code, name, default_cost, category, description | code regex `[A-Za-z0-9_-]` ≤20 (uppercased by backend); cost ≥0; 11 categories | — | active=true |
| Procedure Edit | same schema | name, default_cost, category, description | no `code` field — **input disabled (immutable)**; is_active toggle → separate activate/deactivate calls | code | — |

**Validation UX:** inline field errors from `parseApiError(...).fieldErrors` (snake_case keys from `details` array, [SRC] `apiError.ts`); Zod mirrors backend bounds so 422s are rare; `ValidationSummary` for cross-field messages. All forms submit via `FormActions` (Cancel/Submit with pending state).

---

## 11. Table Architecture

All tables reuse `DataTable`/`Pagination`. Column definitions, filters, sorting, pagination, row/bulk actions, empty/loading states are defined in [MAP §7]; this section fixes the shared behaviors.

| Table | Columns | Filters | Sorting | Pagination | Row actions | Bulk | Empty / Loading |
|---|---|---|---|---|---|---|---|
| `TreatmentPlanTable` (S-01) | plan_code (link), patient (name), doctor (name), status (badge), version, items, total cost, created, actions | server-side: status, doctor, date range, active; **search matches code + patient name only** (doctor not searchable, [BCR §13]) | server-side (`sort_by`/`sort_order`, default `created_at desc`) | server-side `total_pages`; page-size options [10,20,50,100] | View → detail; per-status transition via row menu (optional) | ❌ none | EmptyState + Create CTA; 5-row skeleton |
| `TreatmentPlanItemsTable` (S-02/S-04) | #, procedure (name+code), tooth/surface, quadrant/arch, est. cost, discount, status (PENDING), notes, actions | none (plan-scoped) | fixed by `sequence_number` | none (all items) | ✏️ Edit / 🗑️ Remove / drag-handle Reorder — **only when `isEditableStatus`** | ❌ | "No items yet" + Add Item CTA (editable) |
| `VersionTable` (S-05) | version, date, reason, by, actions | none | fixed ascending | none | expand diff (lazy), Restore (editable only) | ❌ | "No versions" |
| `ProcedureTable` (S-07) | code, name, cost, category, status, actions | category, is_active; search via `/procedures/search` (no list `search` param) | server-side (`code` default asc) | server-side `total_pages` | Edit (⭐), Activate/Deactivate (⭐), Delete (⭐, inactive only) | ❌ | EmptyState + New Procedure (⭐); skeleton |
| `ActiveTreatmentPlansMiniTable` (S-13) | plan code, patient, status, items, total, updated | status preset (active) | default desc | 5 rows, no pager | View → detail | ❌ | "No active treatment plans" |

**Loading conventions:** initial = `Skeleton` rows (shimmer, [P2.5 §3.4]); page change = `keepPreviousData` (no layout jump, [SRC]); name enrichment = `namesLoading` overlay pattern ([SRC] `AppointmentTable`).

---

## 12. Dialog & Drawer Architecture

Lifecycle pattern from [SRC]: container holds `useState` for `{mode, entity} | null`; open/close callbacks; `key` reset on entity change; error kept inside the dialog; cancellation closes without side effects. Backend calls, payloads, success/error flows are exactly [MAP §8].

| Component | Type | Trigger | Endpoint | Validation | Success flow | Cancellation flow |
|---|---|---|---|---|---|---|
| `CreatePlanDrawer` | 680px drawer | S-01 toolbar / patient profile | `POST /treatment-plans` | `createPlanSchema` | toast "TXN-… created" → navigate S-02 | close, discard |
| `AddItemDialog` | modal | Items table "+ Add Item" | `POST …/items` | `addItemSchema` | row + totals update (refetch) | close |
| `UpdateItemDialog` | modal | ✏️ row | `PATCH …/items/{itemId}` | partial schema | row update | close |
| `RemoveItemConfirm` | confirm | 🗑️ row | `DELETE …/items/{itemId}` | — | row removed | abort |
| `ReorderItemsDialog` | modal | drag handle | `PUT …/items/reorder` | all-items array | order applied | revert order |
| `ConfirmTransitionDialog` (generic) | confirm | action bar (A7–A20) | `POST …/<transition>` | — | toast + badge + bar update | abort |
| `CancelPlanDialog` | confirm | action bar | `POST …/cancel` | — | terminal badge | abort |
| `CreateVersionDialog` | modal | History tab | `POST …/versions` | `versionSchema` | toast "Version N created" | close |
| `RestoreVersionDialog` | confirm | version row | `POST …/versions/{id}/restore` | editable-status gate | toast; items replaced | abort |
| `DoctorApproveDialog` / `DoctorRevokeDialog` / `PatientAcknowledgeDialog` / `PatientDeclineDialog` | confirms | approval card | respective POST | status/sign/acted gates | card update | close |
| `ItemDetailsDrawer` (S-09) | drawer | item row click | `PATCH …/items/{itemId}` (notes) | notes bounds | saved | close |
| `ProcedureFormDialog` | 480px drawer | S-07 New/Edit (⭐) | `POST /procedures` / `PATCH …/{id}` | `procedureFormSchema` | toast + row | close |
| `ProcedureStatusConfirm` | confirm | active toggle | `PATCH …/activate` / `…/deactivate` | — | toggle flips | revert |
| `DeleteProcedureDialog` | confirm | row delete (⭐) | `DELETE /procedures/{id}` | inactive-only hint | 204 → row removed | abort |

**Error-in-dialog rule:** on 409/422 the dialog stays open with inline `Alert`/field errors; on 500 show generic retry message (concurrency is indistinguishable, O9/R8); on success close and refetch ([MAP §8 cancellation/error columns]).

---

## 13. State Management

| Layer | Owner | Notes |
|---|---|---|
| **Server state** | React Query only | lists, detail, dashboard, queues, names, procedures — no duplication, no manual caching |
| **Local state** | `useState` in containers | dialog open/close + entity, tab index, inline error strings |
| **Filter state** | `useTreatmentPlanFilters()` (module hook) | searchInput/debounced/status/doctor/dateRange/active/page/pageSize → `params` memo; **server-side** (unlike appointments' client-side) |
| **Derived state** | `useMemo` | enriched rows (names join), totals (Σdiscount/net for display — backend returns only `total_estimated_cost`, [MAP §3.2]), `planActionsForStatus(status)`, workflow-bar steps |
| **URL state** | React Router | `:planId` param only; filters intentionally **not** URL-synced (matches existing modules — no new pattern) |
| **Form state** | React Hook Form | per-form, controlled by schema + `FormActions` |

**Explicitly avoided:** global store (no Redux/Zustand), context for plan data, optimistic caches (O9), duplicating query results into local arrays.

---

## 14. Loading Strategy (screen-by-screen)

| Screen | Initial load | Data fetch (page change / refetch) | Sub-resources | Lazy loading | Parallel / sequential |
|---|---|---|---|---|---|
| S-01 List | 5-row `Skeleton` + summary-card skeletons | `keepPreviousData` + toolbar `Spinner` | names overlay (`namesLoading`) | — | **Parallel:** list + dashboard + names (independent) |
| S-02 Detail | full-page skeleton (header + items + tabs) | refetch on invalidation (silent, `isFetching`) | — | **Lazy:** version-diff `GET /versions/{id}` on expand; tabs render instantly (data embedded in aggregate) | **Sequential:** aggregate first → tabs derive; names parallel to detail |
| S-03 Create | `Skeleton` inside drawer (patient/doctor lists) | — | — | — | parallel patient + doctor lists |
| S-04 Items | rows part of detail aggregate | refetch after item mutations | procedure dropdown: `useActiveProcedures` (5-min cache) | — | procedure search debounced (300ms) |
| S-05 Versions | timeline from aggregate | — | diff lazy-loaded | ✅ diff fetch on expand | sequential (detail → diff) |
| S-06 Approval | embedded card | — | — | — | — |
| S-07 Catalog | table skeleton | `keepPreviousData` | search dropdown | — | parallel list + counts |
| S-08 Procedure form | drawer skeleton (edit: `useProcedure(id)`) | — | — | — | sequential (fetch → fill) |
| S-09 Item drawer | row from aggregate (no fetch) | — | — | — | — |
| S-10/S-12/S-13 cards | card skeletons | refetch on invalidation | S-13: doctor lookup (`getByUserId`) then by-doctor query | — | S-13 sequential (doctor id → list); dashboard parallel |

**Rules:** never leave a fetch without a visual state (skeleton/spinner/placeholder); keep the previous page visible while paging (keepPreviousData); background refetches must not flicker (silent); every mutation ends with invalidate → refetch (never optimistic).

---

## 15. Error Handling Strategy

Reuse `parseApiError` / `apiErrorMessage` / `shouldRetryQuery` ([SRC] `apiError.ts`); the envelope `{success, message, details}` is already compatible (F7). Error codes are stripped (O4) — **branch on HTTP status**, display backend `message`.

### 15.1 Error Handling Matrix

| Backend response | `parseApiError` kind | UI response | Where |
|---|---|---|---|
| 400 (client) | `client` | Toast / inline Alert with backend message | mutations |
| 401 | `auth` | Existing global session-expiry flow (`AUTH_SESSION_EXPIRED_MESSAGE`); redirect to login | interceptor |
| 403 ("Role not assigned"/"Insufficient permissions") | `forbidden` | Permission message; `PermissionGate` hides/disables the offending control | queries + actions |
| 404 (plan/item/procedure/version/patient/doctor) | `not-found` | `ResultState` with back navigation (detail); inline Alert (dialogs); **never** empty-state for 404s | S-02, dialogs |
| 409 (not-editable, dup sequence, dup code, already-approved, ack exists, item-list mismatch, inactive procedure, delete-active-procedure) | `client` | Keep dialog open; inline `Alert` with backend message (messages are user-ready, [BCR §14.1]); specific hints: "deactivate first" (procedure delete), "not editable in this status" (items) | all dialogs |
| 422 (schema / FDI / cost / discount / date range / empty reason) | `validation` | Map `details` array → `fieldErrors` inline; `ValidationSummary` for cross-field | all forms |
| 500 (persistence, `PlanUpdateFailed`, **stale-lock concurrency**) | `server` | Generic retry toast + "Reload plan" affordance; refetch to resync; **do not distinguish concurrency** (O9/R8) | mutations |
| Timeout (`ECONNABORTED`) | `timeout` | `fallbackMessage` toast + retry | queries/mutations |
| Offline / backend unreachable | `offline` / `backend` | Offline screen / retry toast (existing patterns) | global |
| Non-HTTP / unknown | `unknown` | `apiErrorMessage` fallback | global |

### 15.2 Query retry policy
- Queries: default `retry: 1`; name-resolution queries use `shouldRetryQuery` (never retry 401/403 — expected for some roles, [SRC]).
- Mutations: `retry: 0`; success closes dialogs + invalidates; failure keeps dialogs open with inline error.

---

## 16. RBAC Architecture

Backend facts (verified, [BCR §12]): plan endpoints = 🅰 (6 roles); procedure writes = ⭐ (`require_admin` = ADMIN + CHIEF_DOCTOR); DENTAL_ASSISTANT excluded everywhere; **no ownership checks** (F6). Backend-first: the frontend never assumes a permission the backend does not expose ([MAP §9]).

| Surface | Mechanism | Mode | Notes |
|---|---|---|---|
| `/treatment-plans*` routes | `ProtectedRoute` only | — | no role gate (all 🅰 allowed) |
| `/procedures` route | `ProtectedRoute` only | — | reads are 🅰; do not gate the route |
| Sidebar nav (Treatment Plans, Procedure Catalog) | role check (`useCurrentUserRole`) | hide | hide from DENTAL_ASSISTANT (R16) |
| Procedure **write** triggers (New/Edit/Activate/Deactivate/Delete) | `PermissionGate requiredRoles={ADMIN_ROLES}` | `disable` for toolbar CTA (stable layout); `hide` for destructive row actions (screen-reader-safe) | mirrors [SRC] usage in DoctorDetailsContainer |
| Plan action bar (transitions, approval, versions) | `planActionsForStatus(plan.status)` | disable/omit by **status**, not role | status machine is the gate ([BCR §12.3]) |
| Owner-check tooltips ([P2.5 §15.4]) | **optional** UX hint only | tooltip | backend has no ownership — never a hard gate (F6/G11); confirm with product |
| Failed-open behavior | existing `usePermission` conservative default | deny-while-probing | no flash of admin actions |

---

## 17. Performance Strategy

| Concern | Strategy |
|---|---|
| Query batching | name resolution deduped per sorted id-set in one query (`useTreatmentPlanNames`, [SRC] pattern); `Promise.all` inside |
| Memoization | `useMemo` for enriched rows, totals, action sets, filter params; `React.memo` where prop churn observed (tables) |
| Lazy loading | version diff fetched only on expand; item/procedure search results fetched on demand; tabs render from aggregate (no extra fetch) |
| Virtualization | **Not required** — max 100 rows/page (backend `page_size ≤ 100`); skip |
| Code splitting | consistent with existing modules (static page imports in `AppRouter`); revisit route-level `React.lazy` only if bundle audit demands |
| Cache reuse | `useActiveProcedures` 5-min staleTime (catalog); names 5-min; `keepPreviousData` avoids refetch-on-paging |
| Render optimization | single `PlanTransitionActions` renders all status actions; avoid inline anonymous callbacks in tables; `key` on dialogs resets per entity |
| Network hygiene | debounced search (300–350ms, `useDebounce`); never send `date_from/date_to` unless `YYYY-MM-DD` (O6) |
| No optimistic updates | O9 — concurrency conflicts → 500; invalidate+refetch is the contract ([MAP §13]) |

---

## 18. Accessibility (WCAG AA)

From [P2.5 §14], applied through existing [SRC] primitives (Modal/Drawer focus traps, `role="alert"` errors, Button/StatusBadge conventions).

| Concern | Requirement |
|---|---|
| Status badges | text + icon + color (never color alone); `aria-label="Status: {label}"` (e.g. "Status: Under Review") |
| Workflow bar | `role="progressbar"` + `aria-valuenow/min/max` (current step index) |
| Action buttons | descriptive `aria-label` beyond icon ("Submit plan for review") |
| Reorder | drag-and-drop plus keyboard Up/Down alternative ([P2.5 §14.2]); `aria-grabbed`/`aria-dropeffect` where implemented |
| Dialogs/drawers | existing focus trap + `Escape` close + `aria-modal`; `role="alert"` inline errors |
| Forms | labels bound to inputs (existing `FormField`/`Label`); `Ctrl+Enter` submit; disabled submit while pending |
| Version timeline | `aria-label="Version {n}: {reason}"` |
| Announcements | success toasts announce state changes (plan status, version created, approval recorded — [P2.5 §14.4]) |
| Color contrast | design tokens already compliant; new status colors verified against token palette |
| Screen reader | read-only statuses announced (e.g. "Item status: Pending — not changeable") so removed buttons do not confuse |

---

## 19. Testing Strategy

Follows the existing test layout ([SRC] has co-located `*.test.ts`/`*.test.tsx` for every module). Coverage targets: **≥ 90%** for pure logic (schemas, state machine, form utils, formatting), **≥ 80%** for hooks/services, **≥ 70%** for components/containers.

| Level | Scope | Examples |
|---|---|---|
| Unit | Zod schemas mirror [BCR §5] bounds (FDI edges 49 rejected, discount > cost, dup sequence, `extra` fields rejected); date-range rule; `planActionsForStatus` matches [BCR §11.1] both directions; `isEditableStatus`/`terminalStatuses`; snapshot string-money parsing; form transformers (create/edit payloads, notes-null quirk) | `treatmentPlanFormSchema.test.ts`, `treatmentPlanStateMachine.test.ts`, `itemFormUtils.test.ts` |
| Service | URL/verb/params per §7 (mirror `appointmentService.test.ts` style); 204 delete returns void | `treatmentPlanService.test.ts`, `procedureService.test.ts` |
| Hook | query-key factories; invalidation calls on success (spy `invalidateQueries`); `keepPreviousData` behavior; names retry policy (`shouldRetryQuery`) | `useTreatmentPlans.test.tsx`, `useTreatmentPlanMutations.test.tsx`, `useTreatmentPlanNames.test.tsx` |
| Component | table columns/empty/loading; status badges; dialog open/error/success flows (409 keeps open, 422 field errors); PermissionGate hides/disables procedure writes for non-admin; `PlanTransitionActions` visibility per status | `TreatmentPlanTable.test.tsx`, `ConfirmTransitionDialog.test.tsx`, `ProcedureFormDialog.test.tsx` |
| Integration | container flows: load list → open create → submit → navigate to detail; add item → totals update; transition → badge + dashboard refetch | `TreatmentPlanListContainer.test.tsx`, `TreatmentPlanDetailsContainer.test.tsx` |
| Regression | run full suite + lint + typecheck + production build (gate below) | CI |

---

## 20. Implementation Phases

Each phase ends with a green gate: `npx tsc --noEmit`, `npm run lint`, `npm test -- <module>`, `npm run build` (see §21). Ordering matches [MAP §15.3].

### Phase 1 — Foundation
`types/treatmentPlan.ts` + `types/procedure.ts` (contract from [BCR §15.1]) · `constants/treatmentPlan.ts` + `constants/procedure.ts` (page sizes, `TREATMENT_PLAN_STATUS_VARIANTS`, `PROCEDURE_CATEGORY_LABELS`, FDI ranges, filter option descriptors) · `utils/treatmentPlanStateMachine.ts` (★ new — `ALLOWED_PLAN_TRANSITIONS`, `isEditableStatus`, `terminalStatuses`, `planActionsForStatus`) · `utils/*FormSchema.ts` · `services/treatmentPlanService.ts` + `services/procedureService.ts` · `utils/treatmentPlanFormatting.ts` · unit tests.

### Phase 2 — Hooks
`treatmentPlanQueryKeys.ts` + `procedureQueryKeys.ts` · all query hooks (§8.2) · all mutation hooks (§8.3) with invalidation matrix (§9) · `useTreatmentPlanFilters` · `useTreatmentPlanNames` · `useMyActiveTreatmentPlans` · hook tests.

### Phase 3 — Procedure Catalog (S-07, S-08)
`ProcedureListPage` + container · `ProcedureTable` · `ProcedureFormDialog` (⭐ `PermissionGate`) · status/delete dialogs · routes + nav · component/integration tests. *Unblocks item forms.*

### Phase 4 — Plan List + Dashboard (S-01, S-13)
`TreatmentPlanListPage` + container · `TreatmentPlanToolbar` (server-side filters) · `TreatmentPlanTable` · `TreatmentPlanSummaryCards` (ack count-only) · `Pagination` · `ActiveTreatmentPlansCard` on DashboardPage · tests.

### Phase 5 — Create Plan + Items (S-03, S-04)
`CreatePlanDrawer` (complete-at-creation) · item dialogs + `ReorderItemsDialog` · `TreatmentPlanItemsTable` editable modes · tests.

### Phase 6 — Detail + Transitions + Approval (S-02, S-06)
`TreatmentPlanDetailsPage` + container · `WorkflowProgressBar` · `PlanTransitionActions` · `ConfirmTransitionDialog` family · `ApprovalStatusCard` + approval dialogs · `ItemDetailsDrawer` (S-09 cut) · `ProgressSummaryCard` (S-10 cut) · `PlanActivityCard` (S-12 partial) · tests.

### Phase 7 — Versions + Hardening (S-05)
`VersionTimeline` + lazy diff + create/restore dialogs · a11y pass (§18) · error-state sweep (§15) · accessibility review · full regression + production build.

### Phase 8 — (Conditional) Billing handoff
Only after the billing contract lands (U13/U16) — outside core Sprint 12A.

---

## 21. Acceptance Criteria (objective completion gates)

| Gate | Criterion |
|---|---|
| Backend contract compliance | Every shipped screen/element maps to a verified [BCR] endpoint; zero UI for U1–U16; requests/response types match [BCR §5/§6] exactly; no optimistic writes |
| UI parity | S-01…S-13 match [P2.5]/[MS] layouts with only the documented [MAP §11] scope cuts; status badges, workflow bar, dialogs match spec |
| Type safety | `npx tsc --noEmit` clean (whole project, not just module) |
| Lint | `npm run lint` clean (existing eslint config) |
| Tests | New module suites pass: schema, state-machine, service, hook, component, integration (§19); coverage targets met |
| Accessibility | Existing axe/a11y checks clean; keyboard flows (reorder alt, Escape close, Ctrl+Enter submit) verified |
| Production build | `npm run build` (vite) succeeds |
| No new patterns | Review confirms only `utils/treatmentPlanStateMachine.ts` is new; everything else reuses [SRC] infra |
| Invalidation contract | Container tests prove the §9 matrix (each mutation invalidates `['treatment-plans']`/`['procedures']` root) |

---

## Appendix A — Verification Evidence ([SRC] patterns this report reuses)

| Pattern reused | Verified in [SRC] |
|---|---|
| QueryClient defaults (`staleTime 30s, retry 1, refetchOnWindowFocus false`) | `src/main.tsx` |
| Service object pattern | `src/services/appointmentService.ts`, `patientService.ts` |
| Query-key factory + keepPreviousData | `src/hooks/appointments/useAppointments.ts`, `src/hooks/patients/usePatients.ts` |
| Granular mutations + root invalidation | `useAppointmentMutations.ts`, `usePatientMutations.ts` |
| Filters hook | `useAppointmentFilters.ts`, `usePatientFilters.ts` |
| Name resolution (dedup, shouldRetryQuery, 5-min stale) | `useAppointmentNames.ts` (uses `doctorService.getByUserId`) |
| Error infra (`parseApiError`, `apiErrorMessage`, `shouldRetryQuery`, kinds) | `src/services/apiError.ts` |
| Page/container split | `pages/appointments/AppointmentListPage.tsx` + `components/appointments/containers/AppointmentListContainer.tsx` |
| Form transformers | `appointmentFormUtils.ts`, `patientFormUtils.ts`; Zod schemas in `utils/` (`userCreateSchema.ts`) |
| Types convention (string unions, `erasableSyntaxOnly`) | `src/types/appointment.ts`, `tsconfig` |
| RBAC (`RequireRole`, `PermissionGate` hide/disable, `ADMIN_ROLES`) | `src/routes/AppRouter.tsx`, `src/components/rbac/PermissionGate.tsx`, `src/constants/roles.ts` |
| Routes + metadata | `src/routes/routes.ts` (`ROUTES.TREATMENT_PLANS` exists), `routeMeta.ts`, `routeRequirements.ts` |
| Dashboard cards | `pages/dashboard/DashboardPage.tsx` + `DashboardStatCard.tsx` |
| Patient profile cards (ActivityTimeline, TreatmentSummaryCard) | `src/components/patients/` |

*End of report. This document, together with [BCR] and [MAP], is the complete Sprint 12A implementation specification. Implementation may begin at Phase 1 with no further architectural decisions required.*
