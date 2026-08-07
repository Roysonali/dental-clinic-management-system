# DensCare — Sprint 12A Treatment Plan Module Independent Production Review

**Date:** August 7, 2026
**Reviewer:** Independent review (performed without reliance on the developer's implementation report; all claims verified against source)
**Scope:** Complete independent verification of the Treatment Plan + Procedure Catalog frontend (`frontend/src/{types/treatmentPlan.ts, constants/treatmentPlan.ts, utils/treatmentPlanStateMachine.ts, services/treatmentPlanService.ts, services/procedureService.ts, hooks/treatmentPlans/**, hooks/procedures/**, components/treatmentPlans/**, components/procedures/**, pages/treatmentPlans/**, pages/procedures/**, routes, navigation, dashboard integration}`) plus backend contract verification (`backend/app/modules/treatment/**`).
**Standard of comparison:** [BCR] `Treatment-Plan-Backend-Contract-Review.md` (contract authority), [MAP] `Treatment-Plan-UI-Backend-Capability-Mapping.md` (UI blueprint, incl. O1–O16/R1–R17 conventions and U1–U16 scope cuts), [ARCH] `Sprint-12A-Treatment-Plan-Frontend-Architecture-Report.md` (architecture spec).
**Result:** **Option C — Changes Required Before Release.** One blocking (🔴) finding: the plan detail page's "Plan Summary" card renders blank/empty totals because the detail endpoint does not return `item_count` / `total_estimated_cost` while the frontend type asserts (and the page consumes) them. The fix is small and well-scoped. Everything else verified clean; remaining findings are 🟠/🟡 non-blocking.

---

## 1. Review Method & Scope

- **Read** every treatment-plan and procedure source file (frontend): types, constants, state machine util, form schemas/utils, services, all hooks, all components (containers, dialogs, tables, cards, drawers), pages, routes, navigation config, and the dashboard integration. Every file listed in the Relevant-Files map at the end was opened and read in full or in a large window.
- **Read** the backend contract surface and validated the frontend against it directly: `treatment_plan_router.py` (1021 lines, read in full), `procedure_router.py` (read in full), `schemas/treatment_plan.py`, `schemas/procedure.py`, `constants.py`, `enums.py`, `validators/state_machine.py`, `mappers/treatment_plan_mapper.py`, `services/treatment_plan_service.py` (update-item path + totals), `permissions.py` (`require_admin`).
- **Executed independently** in `frontend/`: `npm run lint`, `npm run test`, `npm run build` (tsc -b && vite). Results in §3.
- **Delegated** a focused test-suite audit to a sub-reviewer and reconciled its gap findings against the source.
- **Rules of engagement:** read-only review; findings vs. recommendations are distinguished; the backend and its schemas are the final authority on contract (the [BCR] is treated as a contract *claim* and was itself spot-verified against backend source).

## 2. Executive Summary

| Check | Developer's claim (implementation report) | Independent result |
|---|---|---|
| Frontend test suite | Passes | ✅ **Confirmed** — 134 files / 975 tests pass |
| Lint | Clean | ✅ **Confirmed** — 0 errors |
| Production build | Succeeds | ✅ **Confirmed** — `tsc -b` + vite succeed; single 788.49 kB chunk warning present |
| Endpoint mapping (14 transitions/approvals + 5 item/version + 11 procedures) | Exact | ✅ **Confirmed** — every suffix matches the router verbatim (§4) |
| State machine mirrors backend | Exact (minus O12 edges) | ✅ **Confirmed** — matches `PLAN_TRANSITIONS` (§5) |
| RBAC gating | ⭐ = {ADMIN, CHIEF_DOCTOR} | ✅ **Confirmed** — `require_admin` is exactly that set (§6) |
| No optimistic updates (O9) | Yes | ✅ **Confirmed** — all mutations invalidate `['treatment-plans']` root, no `setQueryData` anywhere (§9) |
| Dates sent as `YYYY-MM-DD` only (O6) | Yes | ✅ **Confirmed** — DatePicker values pass through untouched (§4) |
| `notes: ""` never sent; `notes: null` never sent (R14) | Yes | ✅ **Confirmed** — notes only sent when non-empty and changed (§7) |
| Plan Summary card data on detail page | (not claimed) | 🔴 **Fails** — F-01: detail payload lacks the two fields the card reads |

**Overall:** the module is well-built, faithful to the backend, and ships with a real passing test suite. The state machine, RBAC, error handling, and React Query discipline all match the blueprint. One genuine contract defect (F-01) must be fixed before release; it is masked today because the type and the test fixtures encode the same wrong assumption.

## 3. Verification Runs (independent tooling)

| Run | Result | Notes |
|---|---|---|
| `npm run lint` | ✅ 0 errors / 0 warnings | — |
| `npm run test` | ✅ 134 files / 975 tests passed (~194 s) | jsdom-heavy suite |
| `npm run build` | ✅ success | `tsc -b` clean; vite emits the standard `chunk >500 kB` warning (788.49 kB JS / 218.92 kB gzip) — see F-05 |

No changes were made to any file during this review.

## 4. Endpoint & Payload Conformance

### 4.1 Transition & approval endpoints (all 14 verified against `treatment_plan_router.py`)
Frontend `TRANSITION_ENDPOINT` (`utils/treatmentPlanStateMachine.ts:59-74`) and the four approval-mutation hooks map 1:1 to router routes — verified suffix-by-suffix:

| Action | Frontend | Router (verified) | Semantics |
|---|---|---|---|
| submit-for-review | `useSubmitForReview` | `POST /{id}/submit-for-review` | DRAFT → UNDER_REVIEW |
| approve-review | `useApproveReview` | `POST /{id}/approve-review` | UNDER_REVIEW → PROPOSED |
| reject-review | `useRejectReview` | `POST /{id}/reject-review` | UNDER_REVIEW → DRAFT |
| accept | `useAcceptPlan` | `POST /{id}/accept` | PROPOSED → ACCEPTED |
| decline | `useDeclinePlan` | `POST /{id}/decline` | PROPOSED → REJECTED |
| cancel | `useCancelPlan` | `POST /{id}/cancel` | any non-terminal → CANCELLED |
| start-treatment | `useStartTreatment` | `POST /{id}/start-treatment` | ACCEPTED → IN_PROGRESS |
| hold | `usePutOnHold` | `POST /{id}/hold` | IN_PROGRESS → ON_HOLD |
| resume | `useResumeTreatment` | `POST /{id}/resume` | ON_HOLD → IN_PROGRESS |
| complete | `useCompletePlan` | `POST /{id}/complete` | → COMPLETED |
| doctor-approve | `useDoctorApprove` | `POST /{id}/doctor-approve` | approval record |
| doctor-revoke | `useDoctorRevoke` | `POST /{id}/doctor-revoke` | approval record (patient status preserved, R15) |
| patient-acknowledge | `usePatientAcknowledge` | `POST /{id}/patient-acknowledge` | approval record |
| patient-decline | `usePatientDecline` | `POST /{id}/patient-decline` | approval record |

All transition bodies are empty — the router takes no body model for these (only `current_user`); the frontend sends none. ✅

### 4.2 Item & version endpoints (all 5 verified)
- `POST /{plan_id}/items` — `AddItemRequest` — **201** ✅ (`treatment_plan_router.py:488-517`)
- `PATCH /{plan_id}/items/{item_id}` — `ItemUpdateRequest` (partial, `null` clears) ✅ (`:525-559`)
- `DELETE /{plan_id}/items/{item_id}` — **no body** ✅ (`:567-584`)
- `PUT /{plan_id}/items/reorder` — `{ item_ids }` all-exactly-once ✅ (`:592-612`)
- `POST /{plan_id}/versions` / `GET .../versions` / `GET .../versions/{id}` / `POST .../versions/{id}/restore` — `VersionRequest` `change_reason` 1–500 ✅ (`:924-1021`)

### 4.3 List/read endpoints consumed by the UI
`GET /treatment-plans` (search/status/doctor/date/is_active/sort/pagination), `GET /treatment-plans/dashboard`, `GET /treatment-plans/by-doctor/{id}` (dashboard card), `GET /procedures`, `GET /procedures/active`, `GET /procedures/search`, `GET /procedures/{id}` — all verified present with matching query-param names (`page`, `page_size` ≤ 100, `sort_order` pattern, `is_active`, `category`). ✅

### 4.4 Date handling (O6)
`useTreatmentPlanFilters.ts:126-142` passes `date_from`/`date_to` through verbatim; the toolbar (`TreatmentPlanToolbar.tsx:125-138`) sources them from `DatePicker`, which yields `YYYY-MM-DD`. No free-text date entry exists. ✅

### 4.5 Payload bounds (frontend vs backend schemas)
- `sequence_number`: backend `ge=1`, **no upper bound in the schema** (`MAX_SEQUENCE_NUMBER=999` is a documented constant only). Frontend enforces no upper bound — ✅ consistent with the backend's actual validation.
- `estimated_cost`: backend `0 ≤ x ≤ 999999.99`, 10 digits / 2dp; frontend zod mirrors it. ✅
- `discount`: backend `ge=0` (no `le=estimated_cost` in the schema — enforced in the service/validator); frontend zod additionally enforces `discount ≤ cost` client-side (stricter than the schema, harmless). ✅
- `tooth_number`: backend `ge=11` (FDI ranges validated by the validator); frontend `isValidFdiToothNumber` (11–48 / 51–85) mirrors it. ✅
- `tooth_surface`: backend `min_length=1, max_length=10`, **any** string (O8); frontend soft-validates surface-letter combinations only (MAP U15) and never hard-blocks. ✅
- `plan_code`: backend optional, `max_length=20`, **no pattern**; frontend mirrors (no pattern). ✅
- notes/clinical fields: backend `min_length=1, max_length=5000`; frontend mirrors. ✅
- `extra="forbid"` on every request schema; the frontend never sends unknown keys (verified against `itemFormValuesToAddRequest`, `itemFormValuesToUpdateRequest`, `planFormValuesToRequest`). ✅

## 5. State Machine & Status-Gated Action Bar Conformance

Frontend `ALLOWED_PLAN_TRANSITIONS` (`utils/treatmentPlanStateMachine.ts:21-34`) vs backend `PLAN_TRANSITIONS` (`constants.py:103-153`) — compared edge-by-edge:

| Status | Backend targets | Frontend endpoint-backed set | Match |
|---|---|---|---|
| draft | {under_review, cancelled} | [submit-for-review, cancel] | ✅ |
| under_review | {proposed, draft, cancelled} | [approve-review, reject-review, cancel] | ✅ |
| proposed | {accepted, draft, cancelled, rejected} | [accept, decline, cancel] + 4 approval actions | ✅ (draft edge = no endpoint, O12) |
| rejected | {draft, cancelled} | [cancel] | ✅ (draft edge = no endpoint, O12) |
| accepted | {in_progress, cancelled} | [start-treatment, cancel] | ✅ |
| in_progress | {on_hold, completed, cancelled} | [hold, complete, cancel] | ✅ |
| on_hold | {in_progress, completed, cancelled} | [resume, complete, cancel] | ✅ |
| completed / cancelled | {} | [] (terminal) | ✅ |

- `isEditableStatus` = {draft, under_review, proposed} matches backend `editable_statuses` (`enums.py`) and the item-edit gating (`TreatmentPlanItemsTable` edit controls, dialog opens in the container, `canRestore`, `Create Version`). ✅
- `terminalStatuses()` = {completed, cancelled} matches the backend's derived terminals. ✅
- Every action rendered flows through `planActionsForStatus`; no role-gating on plan transitions anywhere (MAP §9 rules of engagement #1). ✅
- **F-02** below concerns the *approval sub-state* gating of the four approval actions in the header bar.

## 6. RBAC & Permission Gating Conformance

- `require_admin` (`backend/app/modules/rbac/permissions.py:17,31-32`) = `{ROLE_ADMIN, ROLE_CHIEF_DOCTOR}` — **exactly** the frontend `ADMIN_ROLES` (`constants/roles.ts:51-54`). The procedure write gating (`PermissionGate` with `ADMIN_ROLES` around `ProcedureTable` row actions) therefore matches the backend's 403 boundary. ✅
- Plan read/create/transition endpoints allow `{ADMIN, RECEPTIONIST, *DOCTOR_ROLES}` (verified in every router dependency); the client cannot resolve non-admin roles, so plan routes are `ProtectedRoute`-only (no role gate) and the backend enforces — exactly the documented strategy (MAP §9). ✅
- `DENTAL_ASSISTANT` is excluded everywhere on the backend; the frontend makes no treatment-plan affordance depend on the assistant role. ✅
- Navigation: Treatment Plans under Clinical, Procedure Catalog under Administration, admin-only items carry `ADMIN_ROLES` (`navigation.config.ts:120-168`) and are filtered by `getNavGroups`. ✅

## 7. Type-System Alignment & Serialization

- Request DTO types mirror backend schemas exactly (snake_case, `extra` behavior, null semantics). ✅
- Response types are accurate **except** the aggregate-derived fields (F-01) and the Decimal serialization ambiguity (F-03).
- R14 (`notes` cannot be cleared): backend `ItemUpdateRequest.notes` is `Optional[str]` with `min_length=1`; empty string → 422, `null` → ignored by the service (`update_item` only assigns when `notes is not None`). The frontend mirrors this precisely — `itemFormValuesToUpdateRequest` only sends `notes` when non-empty and changed, and there is deliberately no "clear notes" affordance. ✅
- Item `estimated_cost: null` from the edit form: the backend `update_item` treats `None` as "unchanged" (`services/treatment_plan_service.py:565,592-593`) — the clear is a silent no-op, consistent with the field being non-nullable in the response (`TreatmentPlanItemResponse.estimated_cost` required). Harmless, documented behavior. ✅
- Version snapshot money: backend persists `str(Decimal)` in `items_snapshot` (`services/treatment_plan_service.py:1183-1184`); frontend types them as strings and parses via `formatTreatmentCost` in the diff panel (`VersionTimeline.tsx:30,103`). ✅

## 8. Data Correctness & Display Integrity

### 🔴 F-01 — Plan Summary card renders blank/`—` on every detail page (blocking)

**Severity:** HIGH — **production-blocking**.
**Affected files:**
- `frontend/src/types/treatmentPlan.ts:120-130` — `TreatmentPlanResponse extends TreatmentPlanListItem` asserts `item_count: number` and `total_estimated_cost: number` exist on the aggregate.
- `frontend/src/components/treatmentPlans/containers/TreatmentPlanDetailsContainer.tsx:500-503` — passes `plan.item_count` / `plan.total_estimated_cost` into `ProgressSummaryCard`.
- `frontend/src/components/treatmentPlans/ProgressSummaryCard.tsx:34-44` — renders them directly.

**Backend evidence (verified, authoritative):**
- `schemas/treatment_plan.py:591-696` — `TreatmentPlanResponse` (the aggregate returned by `GET /treatment-plans/{id}`, create, and every item/transition mutation) has **no** `item_count` and **no** `total_estimated_cost`. Those two fields exist only on `TreatmentPlanListItem` (`:517-588`, fields at `:563-573`).
- `mappers/treatment_plan_mapper.py:140-164` — `to_list_item` computes both; `to_response` (`:167-197`) does **not** compute either.
- The [BCR] itself documents the limitation: §9.3, "only the first is surfaced (**list item** `total_estimated_cost`)."

**Root cause:** the frontend type models the aggregate by *extending* the list-item type, carrying the derived fields into a payload that never contains them. The same wrong assumption appears in the [ARCH] report and [MAP] §3.10/7.3, and — critically — in the test fixture `TreatmentPlanDetailsContainer.test.tsx:63,83` (`total_estimated_cost: 1500` on the mocked aggregate), which is why the test suite passes while production is broken. A silent runtime defect: `plan.item_count` → `undefined` (blank cell) and `plan.total_estimated_cost` → `undefined` → `formatFee(undefined)` → `"—"`.

**Impact:** the S-10 scope-cut "Plan Summary" card shows **Items: (blank)** and **Estimated Total: ₱—** on the primary screen for every plan. No crash; visible wrong data.

**Recommended fix (frontend, sufficient):** derive client-side in the details container — the aggregate already embeds the full `items[]`:
- `itemCount = plan.items.length`
- `totalEstimatedCost = plan.items.reduce((sum, i) => sum + Number(i.estimated_cost), 0)`
- Split the type: define an explicit `TreatmentPlanDetailResponse` that does **not** extend `TreatmentPlanListItem` (keep the two list fields off the aggregate), or mark them `item_count?`/`total_estimated_cost?` and update the test fixture accordingly.

**Recommended fix (optional backend enhancement):** add the derived fields to `TreatmentPlanResponse` in `to_response` (reuse the `to_list_item` sum logic) so the aggregate is self-describing. Not required for the frontend fix.

## 9. Mutation, Caching & Concurrency Patterns (React Query)

- **No optimistic updates anywhere** (MAP/ARCH mandate, O9). All mutations invalidate the `['treatment-plans']` root on success (`useTreatmentPlanItemMutations.ts:22-24`, `useTreatmentPlanTransitionMutations.ts:19-21`, approval/version mutations likewise); the detail refetches the whole aggregate. ✅
- `useTreatmentPlans` / `useProcedures` use `keepPreviousData` (stable tables while filtering). ✅
- Search debounce 350 ms (`useDebounce`), server-side filters only — no client-side list filtering. ✅
- Name resolution (R10) is batched + cached via `useTreatmentPlanNames` (deduped, sorted, `Promise.all`, per-id failure → null → `Patient #id` / `Doctor #id` fallback). ✅
- Dialog/drawer state re-initialization uses the `key`-remount pattern (`UpdateItemDialog key={editingItem?.id ?? 'none'}`, `ReorderItemsDialog key={open ? 'open' : 'closed'}`, `ItemDetailsDrawer key={detailItem?.id ?? 'none'}`) — no effect-sync drift. ✅
- Version-diff fetch is lazy per-expand (`treatmentPlanQueryKeys.version(planId, expandedId)`), per ARCH. ✅
- `useActiveProcedures` `staleTime` 5 min; `useMyActiveTreatmentPlans` scoped to 5 rows with `is_active=true`. ✅

## 10. Error Handling & User Feedback

- `parseApiError` is used consistently for 404 (`ResultState` + Back button), 409 (`INVALID_PLAN_OPERATION` inline in the confirm dialog, dialog stays open), and 422 (`details` array → field-level errors via `serverErrors` on each dialog). Verified in the container's six handlers (`TreatmentPlanDetailsContainer.tsx:213-406`). ✅
- No optimistic rollback needed (no optimistic writes). ✅
- Destructive actions carry explicit confirms (`CancelPlanDialog`, `RemoveItemConfirm`, `RestoreVersionDialog`, `DeleteProcedureDialog`), with destructive styling on cancel/reject/decline. ✅
- Toasts auto-dismiss at 5 s (`TOAST_DURATION_MS`). ✅
- Concurrency 500s (O9) are surfaced as a generic error message — matches the MAP's "generic retry + reload" disposition for the unbuildable Conflict dialog (U11). ✅

## 11. Performance & Bundle

- Server-side everything (filters/pagination/sort) — no large client-side data sets. ✅
- Single-fetch aggregate on the detail page (items/approval/versions embedded) — no N+1. ✅
- **F-05 (🟡 Low):** `npm run build` emits the Vite `chunk >500 kB` warning — one 788.49 kB JS bundle (218.92 kB gzip). Non-blocking; recommend route-level `React.lazy` for the treatment-plans/procedures pages and/or a `manualChunks` split for react/vendor.

## 12. Accessibility & UX Conformance (incl. scope-cut surfaces)

- Scope cuts implemented as specified and visibly **absent**: U1 (headers read-only with info alert), U2 (item status read-only), U3 (Plan Summary card, no progress %), U4 (no delete), U5 (no revise/resubmit), U6 (pending-ack card count-only), U7/U9/U13/U16 (attachments/print/invoice hidden or deferred), U8 (Plan Activity card reconstructed from available fields, no fabricated events), U10/U11 (no modification-requires-version / no stale-data dialog), U12 (no approval-notes editor), U14 (appointment/diagnosis informational), U15 (tooth-surface soft validation). ✅
- Status badge color map (`TREATMENT_PLAN_STATUS_VARIANTS`), workflow bar (`role="progressbar"`), tabs with counts, skeletons/ResultState/EmptyState coverage, focus-trap dialogs (shared primitives). ✅
- **F-02 (🟠 Medium, non-blocking):** header action-bar approval gating. `planActionsForStatus('proposed')` returns all four approval actions and `PlanTransitionActions` receives only `status` (`PlanTransitionActions.tsx:38-44,56-94`; container passes `status={plan.status}` at `TreatmentPlanDetailsContainer.tsx:434-435`). MAP §5.2 specifies *sub-state* gating for these ("Doctor revoke **if signed**; Patient accept **if signed**"). The Approval tab card gates correctly (`ApprovalStatusCard.tsx:63-84,112-132`); the header bar does not — so a doctor-signed proposed plan still offers "Doctor Approve", and an unsigned one offers "Patient Accepts/Declines". Clicking yields a guaranteed 409 (handled inline, no data harm) — UX noise. Fix: pass the approval record into the header bar and gate the four actions, or drop them from the header and leave them on the Approval tab.

## 13. Test & Validation Coverage

Suite: 134 files / 975 tests pass. The treatment-plan tests are meaningful (state machine table assertions, form-schema bounds, service URL/verb/payload, component render + gating). Gaps vs the MAP §15.4 gates:

- **F-04 (🟡 Low):** `procedureFormSchema.test.ts` is **absent** (the only form schema without a dedicated test file); state-machine tests assert actions for draft/under_review/proposed/rejected/terminal but **not** accepted/in_progress/on_hold, and check only 4 of 14 endpoint suffixes; there is **no `useTreatmentPlanFilters` test** (params memo, O6 date pass-through, is_active mapping); item-schema tests miss FDI boundary values (48/50/85/86) and negative/non-numeric cost; service tests don't cover list query params (`search`, `is_active`, `date_from`/`date_to`, `sort_by`).
- The F-01 defect is currently **masked** by a test fixture that embeds the same wrong assumption (`TreatmentPlanDetailsContainer.test.tsx:63,83`) — the fixture should be corrected as part of the F-01 fix.

## 14. Findings Register & Production-Readiness Verdict

### Findings (severity-ranked)

| ID | Severity | Blocking | Summary | Affected files | Recommended fix |
|---|---|---|---|---|---|
| F-01 | 🔴 High | **YES** | Detail aggregate lacks `item_count`/`total_estimated_cost`; Plan Summary card shows blank + `—` | `types/treatmentPlan.ts:120`; `containers/TreatmentPlanDetailsContainer.tsx:500-503`; `ProgressSummaryCard.tsx`; (backend: `schemas/treatment_plan.py:591`, `mappers/treatment_plan_mapper.py:167`) | Derive from `plan.items` in the container; fix the type (don't extend `TreatmentPlanListItem`) and the test fixture; optionally add the fields to the backend aggregate |
| F-02 | 🟠 Medium | NO | Header action bar renders approval actions without sub-state gating (guaranteed 409s) | `PlanTransitionActions.tsx:38-44,56-94`; `utils/treatmentPlanStateMachine.ts:91-99`; `containers/TreatmentPlanDetailsContainer.tsx:434-435` | Pass approval into the header bar and gate, or remove the four approval actions from the header (keep on Approval tab) |
| F-03 | 🟡 Low | NO | Decimal-as-string vs `number` type ambiguity (BCR §9.3 claims numbers; snapshot payloads are strings) — frontend is defensive, but update diffing always re-sends money fields (noise) | `types/treatmentPlan.ts`; `components/treatmentPlans/itemFormUtils.ts:73-79`; `services/treatment_plan_service.py:1183-1184` | Add a contract test asserting the wire type of at least one Decimal field; audit response types |
| F-04 | 🟡 Low | NO | Test gaps vs MAP §15.4: no `procedureFormSchema` test; state-machine coverage misses accepted/in_progress/on_hold and 10/14 endpoints; no filters-hook test; FDI/schema boundary gaps | `frontend/src/utils/` + `**/*.test.*` | Add the missing test files/cases |
| F-05 | 🟡 Low | NO | Single 788.49 kB JS chunk (Vite warning) | `frontend/vite.config.*`, routes | Route-level `React.lazy` / `manualChunks` |
| F-06 | 🟡 Low | NO | `ALLOWED_PLAN_TRANSITIONS` name vs content (omits legal-but-endpointless proposed→draft / rejected→draft, O12) — correct behavior, misleading name invites drift | `utils/treatmentPlanStateMachine.ts:21-34` | Rename to `ENDPOINT_BACKED_TRANSITIONS` |
| F-07 | 🟡 Low | NO | Stale doc comment: `DashboardPage.tsx:28` "All data is placeholder — no API calls" (ActiveTreatmentPlansCard performs real calls) | `pages/dashboard/DashboardPage.tsx:24-28` | Update the comment |
| F-08 | ℹ️ Info | NO | "Create Version" gated to editable statuses only, though MAP §5.2 lists it (audit-only) for accepted/in_progress/on_hold — MAP A21 explicitly permits the stricter UX gate | `containers/TreatmentPlanDetailsContainer.tsx:553-558` | No action; record as deliberate divergence |
| F-09 | ℹ️ Info | NO | `ActiveTreatmentPlansCard` query key uses `user?.id ?? 0` (guarded — no spurious fetch) | `components/treatmentPlans/ActiveTreatmentPlansCard.tsx` | Cosmetic; optional distinct sentinel |

### Verified strengths (no findings)
1. 14/14 transition+approval endpoints and 5/5 item/version endpoints match the router exactly; correct HTTP verbs/status (201/204), empty bodies for transitions.
2. State machine matches backend `PLAN_TRANSITIONS` edge-for-edge; status-gated action bar is the single rendering surface; item editing gated by `isEditableStatus` everywhere.
3. RBAC exact: `require_admin` == frontend `ADMIN_ROLES`; procedure writes `PermissionGate`-gated; plan actions status-gated, not role-gated.
4. No optimistic updates; root invalidation; `keepPreviousData`; 350 ms debounce; lazy version-diff; `key`-remount dialogs.
5. O6 dates, R14 notes semantics, O8 tooth-surface soft validation, O1/O2/O3/O7/O12 scope cuts honored; `extra="forbid"` respected.
6. Clean lint; 975 passing tests; production build succeeds.

### Verdict

> **Option C — Changes Required Before Release.**
>
> The Sprint 12A Treatment Plan + Procedure Catalog frontend is contract-faithful, well-architected, and covered by a real passing test suite. **One release-blocking defect (F-01)** — the Plan Summary card on the detail page renders blank/`—` totals because the detail aggregate does not carry `item_count` / `total_estimated_cost` while the type and page consume them. The remediation is small and localized (derive from `plan.items` in the details container; correct the type and the test fixture; optionally extend the backend aggregate).
>
> All other findings (F-02 … F-09) are non-blocking and can be scheduled as follow-ups. After F-01 is fixed and its regression test updated, the module meets the Option B standard: **approved for production with minor improvements**.

---

## Appendix — Verification Map (authority: source code)

| Area | Verified against |
|---|---|
| 34 plan endpoints (create/list/search/queues/dashboard/by-patient/by-doctor/counts/get/items/transitions/approvals/versions) | `backend/app/modules/treatment/routers/treatment_plan_router.py` (full) |
| 11 procedure endpoints | `backend/app/modules/treatment/routers/procedure_router.py` (full) |
| Request/response schemas | `backend/app/modules/treatment/schemas/{treatment_plan,procedure}.py` |
| Transition tables / enums / constants | `backend/app/modules/treatment/{constants,enums}.py`, `validators/state_machine.py` |
| Aggregate mapper (item_count/totals) | `backend/app/modules/treatment/mappers/treatment_plan_mapper.py` |
| Item update semantics (null handling) | `backend/app/modules/treatment/services/treatment_plan_service.py` (`update_item`) |
| Admin role set | `backend/app/modules/rbac/permissions.py` |
| Doctor↔user lookup (S-13) | `backend/app/modules/doctors/routes.py:214` |
| Frontend implementation | `frontend/src/**` (types, constants, state machine, services, hooks, components, pages, routes, nav, dashboard) |
| Tooling | `frontend/`: lint, test, build (independent runs) |
