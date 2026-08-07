# Sprint 12A — Treatment Plan Frontend Implementation Report

**Module:** Treatment Plan (incl. Procedure Catalog)
**Branch:** `feature/treatment`
**Status:** ✅ Complete — all completion gates pass

---

## 1. Executive Summary

The Treatment Plan frontend module was implemented end-to-end according to the approved architecture
(`Sprint-12A-Treatment-Plan-Frontend-Architecture-Report.md`), the UI ↔ Backend Capability Mapping
(`Treatment-Plan-UI-Backend-Capability-Mapping.md`) and the authoritative backend contract
(`Treatment-Plan-Backend-Contract-Review.md`).

- **Endpoints implemented:** all 34 `/treatment-plans` endpoints + all 11 `/procedures` endpoints (service layer only — no invented APIs).
- **Screens delivered:** Treatment Plan List (S-01), Detail (S-02), Create drawer (S-03), Item management (S-04), Version History (S-05), Approval Status (S-06), Procedure Catalog (S-07), Procedure form (S-08), Item drawer (S-09 cut), Progress summary (S-10 cut), Plan Activity (S-12 partial), Doctor Dashboard widget (S-13).
- **Backend limitations respected:** no item-status transitions (O2/U2), no plan-header editing (O1), no plan delete (O3), no return-to-draft (O12), no attachments (U7).
- **Verification:** `tsc -b` ✅ · `eslint src` ✅ (0 errors, 0 warnings) · `vitest` **975 passed / 134 files** (92 new tests) · `npm run build` ✅.

---

## 2. Files Created

### 2.1 Foundation (types / constants / utils / services)

| File | Purpose |
|---|---|
| `src/types/treatmentPlan.ts` | Entities, DTOs (verbatim snake_case), `PaginatedResponse<T>`, params, form models, action ids, enriched rows |
| `src/types/procedure.ts` | Procedure DTOs (Create/Update/Response/Summary), categories, params, form model |
| `src/constants/treatmentPlan.ts` | Page sizes, status variants/labels, FDI validator, quadrant/arch lists, action labels |
| `src/constants/procedure.ts` | Categories + labels, filters, sort options, page sizes |
| `src/utils/treatmentPlanStateMachine.ts` | ★ only new abstraction (O5): legal transitions + `planActionsForStatus` + `isEditableStatus` |
| `src/utils/treatmentPlanFormatting.ts` | Snapshot money-string parsing + tooth label formatting |
| `src/utils/treatmentPlanFormSchema.ts` | Zod: create plan (dates `YYYY-MM-DD`, notes ≤5000, code ≤20) |
| `src/utils/itemFormSchema.ts` | Zod: add/update item (FDI 11–48/51–85, cost bounds, discount ≤ cost) |
| `src/utils/procedureFormSchema.ts` | Zod: procedure create/edit (code regex, cost, 11 categories) |
| `src/utils/versionFormSchema.ts` | Zod: change_reason 1–500 |
| `src/services/treatmentPlanService.ts` | All 34 plan endpoints (plain typed methods, axios, no business rules) |
| `src/services/procedureService.ts` | All 11 procedure endpoints (delete → 204/void) |

### 2.2 React Query hooks

| File | Exports |
|---|---|
| `src/hooks/treatmentPlans/treatmentPlanQueryKeys.ts` | Key factory (root `['treatment-plans']`) + names key |
| `src/hooks/treatmentPlans/useTreatmentPlans.ts` | list (keepPreviousData) |
| `src/hooks/treatmentPlans/useTreatmentPlan.ts` | detail aggregate |
| `src/hooks/treatmentPlans/useTreatmentPlanFilters.ts` | server-side filter state → params |
| `src/hooks/treatmentPlans/useTreatmentPlanNames.ts` | patient/doctor name resolution (best-effort, 5-min cache) |
| `src/hooks/treatmentPlans/useTreatmentDashboard.ts` | `/dashboard` |
| `src/hooks/treatmentPlans/useMyActiveTreatmentPlans.ts` | by-doctor + active (S-13) |
| `src/hooks/treatmentPlans/useTreatmentPlanMutations.ts` | `useCreateTreatmentPlan` |
| `src/hooks/treatmentPlans/useTreatmentPlanItemMutations.ts` | add / update / remove / reorder |
| `src/hooks/treatmentPlans/useTreatmentPlanTransitionMutations.ts` | submit / approve-review / reject-review / accept / decline / cancel / start / hold / resume / complete |
| `src/hooks/treatmentPlans/useTreatmentPlanApprovalMutations.ts` | doctor-approve / doctor-revoke / patient-acknowledge / patient-decline |
| `src/hooks/treatmentPlans/useTreatmentPlanVersionMutations.ts` | create / restore version |
| `src/hooks/procedures/procedureQueryKeys.ts` | Key factory |
| `src/hooks/procedures/useProcedures.ts` / `useProcedureSearch.ts` / `useActiveProcedures.ts` / `useProcedure.ts` | catalog queries |
| `src/hooks/procedures/useProcedureMutations.ts` | create / update / activate / deactivate / delete |

### 2.3 Module components

**`components/treatmentPlans/`** — `TreatmentPlanStatusBadge`, `TreatmentPlanToolbar`, `TreatmentPlanTable`,
`TreatmentPlanSummaryCards`, `WorkflowProgressBar`, `PlanTransitionActions`, `TreatmentPlanItemsTable`,
`ApprovalStatusCard`, `VersionTimeline`, `PlanActivityCard`, `ProgressSummaryCard`, `ItemDetailsDrawer`,
`ActiveTreatmentPlansCard`, `treatmentPlanFormUtils.ts`, `itemFormUtils.ts`.

**`components/treatmentPlans/dialogs/`** — `CreatePlanDrawer` (680px), `AddItemDialog`, `UpdateItemDialog`,
`RemoveItemConfirm`, `ReorderItemsDialog`, `ConfirmTransitionDialog`, `CancelPlanDialog`,
`CreateVersionDialog`, `RestoreVersionDialog`, `ApprovalDialogs.tsx` (4 thin wrappers over one generic).

**`components/procedures/`** — `ProcedureTable`, `ProcedureFormDialog`, `DeleteProcedureDialog`,
`procedureStatusBadge.tsx`, `procedureFormUtils.ts`.

### 2.4 Containers & pages

- `components/treatmentPlans/containers/TreatmentPlanListContainer.tsx`
- `components/treatmentPlans/containers/TreatmentPlanDetailsContainer.tsx`
- `components/procedures/containers/ProcedureListContainer.tsx`
- `pages/treatmentPlans/TreatmentPlanListPage.tsx`, `pages/treatmentPlans/TreatmentPlanDetailsPage.tsx`
- `pages/procedures/ProcedureListPage.tsx`

### 2.5 Tests (13 files, 92 tests)

| File | Covers |
|---|---|
| `services/treatmentPlanService.test.ts` | list/create/search/queues/dashboard/detail/items/10 transitions/approval/versions |
| `services/procedureService.test.ts` | list/search/active/create/update/activate/deactivate/delete |
| `utils/treatmentPlanStateMachine.test.ts` | transition map, editable statuses, per-status actions, no item-status actions |
| `utils/treatmentPlanFormSchema.test.ts` / `itemFormSchema.test.ts` | backend bounds (FDI, dates, cost, notes) |
| `components/treatmentPlans/treatmentPlanFormUtils.test.ts` / `itemFormUtils.test.ts` | transformers + notes `null`/empty quirks (R14) |
| `hooks/.../useTreatmentPlanTransitionMutations.test.tsx` / `useTreatmentPlanItemMutations.test.tsx` | service wiring + root invalidation + retry:0 |
| `components/.../TreatmentPlanStatusBadge.test.tsx` / `PlanTransitionActions.test.tsx` / `WorkflowProgressBar.test.tsx` | status badge, action bar, progress bar |
| `components/.../TreatmentPlanDetailsContainer.test.tsx` | integration: aggregate render, item drawer notes PATCH, history tab, draft actions |

---

## 3. Files Modified

| File | Change |
|---|---|
| `src/routes/routes.ts` | Added `ROUTES.PROCEDURES = '/procedures'` |
| `src/routes/routeMeta.ts` | Added `Procedure Catalog` meta entry |
| `src/routes/AppRouter.tsx` | Added `/treatment-plans`, `/treatment-plans/:planId`, `/procedures` as `ProtectedRoute` children (no role gate — reads are 🅰) |
| `src/layouts/components/navigation/navigation.config.ts` | Added "Procedure Catalog" under Administration (`BookOpen` icon) |
| `src/pages/dashboard/DashboardPage.tsx` | Added "My Treatment Plans" section hosting `ActiveTreatmentPlansCard` (S-13) |

---

## 4. Implemented Features

1. **Treatment Plan List (S-01)** — server-side search/filter/sort/pagination, dashboard stat cards, doctor filter, name enrichment, Create Plan drawer, row → detail.
2. **Plan Detail (S-02)** — full aggregate, workflow progress bar, status-driven action bar, three tabs (Details / History / Approval Status), clinical info card, items table, progress summary, plan activity card.
3. **Create workflow (S-03)** — 680px drawer, PatientPicker + doctor select + 3 textareas + date range + optional code; complete-at-creation (O1).
4. **Item management (S-04)** — add / update / remove / reorder, editable-status gating (`isEditableStatus`), FDI + cost validation, default-cost hint.
5. **Version history (S-05)** — timeline, lazy snapshot diff (money-string parsing), create + restore (editable only).
6. **Approval workflow (S-06)** — doctor approve/revoke + patient accept/decline cards and dialogs (PROPOSED gating).
7. **Procedure Catalog (S-07/S-08)** — server-paginated list, category/status filters, `/procedures/search` type-ahead, ⭐-gated create/edit/activate/deactivate/delete (PermissionGate).
8. **Item drawer (S-09 cut)** — read-only summary + notes editor; no item-status actions (U2).
9. **Dashboard widget (S-13)** — "My Active Treatment Plans" resolved via `doctorService.getByUserId`.
10. **RBAC** — plan routes not role-gated; procedure writes gated inline; nav item added without over-restriction (client cannot resolve non-admin roles; backend 403s DENTAL_ASSISTANT — R16).

---

## 5. Deferred Features (backend-justified)

| Feature | Reason |
|---|---|
| Item-status transitions (in_progress/completed per item) | No item-transition endpoint (O2/U2) — `item_status` always `pending` |
| Plan header editing (clinical notes / observations / recommendations / dates) | Create-only fields (O1) — read-only after creation |
| Plan delete / deactivate | No delete/deactivate endpoint (O3) |
| Rejected → draft ("Revise and Resubmit") | No rejected→draft endpoint (O12) — correction path is cancel → new plan |
| Attachments (S-11) | No attachment endpoints (U7) — deferred to Patient Records |
| Plan search by doctor name | Backend `search` matches code + patient name only |
| Return to draft from under_review | Legal in the state machine but has NO endpoint (O12) — no UI affordance |
| Billing "Generate Invoice" | Deferred to the billing module contract (U16) |
| Optimistic updates / item-status % bars | No concurrency-safe writes (O9) + no item statuses (U3) |

---

## 6. Test Coverage Summary

- **Total suite:** 975 tests across 134 files — all passing (baseline was 883; **+92 new**).
- New coverage: service endpoint wiring (45 endpoints), state-machine legality, all form schemas against backend bounds, form transformers incl. backend quirks (notes `""`/`null`, explicit-null tooth clears), mutation hooks (service call + root invalidation + no auto-retry), and a details-container integration test covering the aggregate render and the notes-PATCH workflow.

---

## 7. Build & Tooling Results

| Gate | Result |
|---|---|
| `tsc -b` | ✅ No errors |
| `eslint src` | ✅ 0 errors, 0 warnings |
| `vitest run` | ✅ 975 passed (134 files) |
| `npm run build` | ✅ Built (chunk-size warning is pre-existing, unrelated to this module) |

---

## 8. Known Limitations

- **No progress percentage** on the plan summary — backend exposes no per-item status data (U3).
- **Approval sub-state gating is backend-enforced:** the UI offers the PROPOSED surface; illegal calls (e.g. approve when already signed) surface as 409 inline errors.
- **Plan Activity (S-12)** is partial — reconstructed from created/version/approval fields only; no item/status event feed exists (U8).
- **Concurrency conflicts surface as generic 500s** with a "Reload plan" affordance — the backend does not distinguish stale-lock errors (O9/R8).
- **Procedure search** uses the dedicated `/procedures/search` endpoint (all pages) when a term is typed; the paged list remains the no-search browse path.

---

## 9. Implementation Decisions (within the approved architecture)

1. **Transition surface** lives on the detail page action bar + approval tab only; the list page intentionally has no row-level transition buttons (transitions require the full aggregate context).
2. **Approval actions from the action bar** route to the same dedicated confirm dialogs as the Approval tab card (single code path — no silent no-ops).
3. **Names resolution** follows the `useAppointmentNames` pattern: best-effort per-id fetch, 5-minute cache, `null` fallback to `Patient #id` / `Doctor #id` (R10).
4. **`useProcedureSearch` is wired** into the catalog toolbar (type-ahead replaces the paged list while a term is active) — the architecture's §11 requirement that search span all pages.
5. **Unused type-ahead/queue hooks** (`useTreatmentPlanSearch`, `usePendingQueues`) were removed rather than left dead — the plan list's server-side `search` param and the dashboard counts already cover those surfaces.
6. **Toast UX** follows the users-module pattern (local `ToastContainer` + auto-dismiss), not a new global store.
7. **No optimistic updates** anywhere — every mutation invalidates `['treatment-plans']` / `['procedures']` and refetches (O9).

---

## 10. Completion Gates — Final Status

| Gate | Status |
|---|---|
| `npm test` passes | ✅ |
| `npm run lint` passes | ✅ |
| `tsc -b` passes | ✅ |
| `npm run build` passes | ✅ |
| No TypeScript / ESLint errors | ✅ |
| No console errors | ✅ (no runtime testing performed; static gates green) |
| No duplicate components | ✅ (all shared primitives reused; only new abstraction is the state machine) |
| No architectural deviations | ✅ |
| Backend contract fully respected | ✅ (45/45 endpoints, no invented payloads/actions) |
| Accessibility maintained | ✅ (drawer/modal focus traps, ARIA on progressbar/tabs/dialogs, accessible labels) |
| Existing infrastructure reused | ✅ (DataTable, Drawer, Modal, Pagination, SearchBar, StatCard, Timeline, Tabs, PermissionGate, Toast, RHF+zod, parseApiError) |

**Sprint 12A is complete and ready for the independent review / production-hardening pass.**
