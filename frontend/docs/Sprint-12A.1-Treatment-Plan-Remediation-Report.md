# DensCare — Sprint 12A.1 Treatment Plan Remediation & Production Hardening Report

**Date:** August 7, 2026
**Scope:** Targeted remediation of all findings from the independent production review
(`Sprint-12A-Treatment-Plan-Independent-Production-Review.md`) against the approved
[BCR] `Treatment-Plan-Backend-Contract-Review.md`, [MAP] `Treatment-Plan-UI-Backend-Capability-Mapping.md`
and [ARCH] `Sprint-12A-Treatment-Plan-Frontend-Architecture-Report.md`.
**Guardrails honored:** no redesign, no new features, no backend changes.

---

## 1. Executive Summary

All review findings (F-01 … F-07) are **resolved**, including the single release-blocking defect
F-01 (Plan Summary card rendered blank/`—` totals). F-02 (header approval-action gating) is fixed so
the header and the Approval tab share one gating source of truth. Decimal wire typing is now
contract-tested (F-03), test coverage is expanded (F-04), the bundle is code-split (F-05), a
misleading constant name is corrected (F-06), and stale comments are updated (F-07). The two
informational findings (F-08/F-09) are documented as deliberate/cosmetic and left unchanged.

| Gate | Result |
|---|---|
| `npm test` | ✅ **1031 tests pass (137 files)** — up from 975 |
| `npm run lint` | ✅ 0 errors / 0 warnings |
| `tsc -b` | ✅ clean |
| `npm run build` | ✅ success — main bundle 788 kB → **254 kB** (route + vendor chunks) |

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/types/treatmentPlan.ts` | **F-01** — introduced `TreatmentPlanBase`; `TreatmentPlanListItem extends TreatmentPlanBase` (keeps `item_count`/`total_estimated_cost`); `TreatmentPlanResponse extends TreatmentPlanBase` with the aggregate fields and **no** list-only fields. Comments updated (F-07). |
| `src/components/treatmentPlans/containers/TreatmentPlanDetailsContainer.tsx` | **F-01** — derives `itemCount`/`totalEstimatedCost` from `plan.items` (memoised); passes them to `ProgressSummaryCard`. **F-02** — passes `plan.approval` into `PlanTransitionActions`. |
| `src/utils/treatmentPlanStateMachine.ts` | **F-02** — added `APPROVAL_ACTIONS`, `isApprovalAction`, `approvalActionsForSubState`. **F-06** — renamed `ALLOWED_PLAN_TRANSITIONS` → `ENDPOINT_BACKED_TRANSITIONS`. **F-07** — corrected the `planActionsForStatus` doc comment. |
| `src/components/treatmentPlans/PlanTransitionActions.tsx` | **F-02** — accepts `approval`; PROPOSED renders `approvalActionsForSubState(approval)` ∪ non-approval actions (accept/decline/cancel). |
| `src/components/treatmentPlans/ApprovalStatusCard.tsx` | **F-02** — reuses `approvalActionsForSubState` (single source of truth, no drift between header and tab). |
| `src/routes/AppRouter.tsx` | **F-05** — `React.lazy` for the three Treatment Plan/Procedure pages; `Suspense` wraps `<Routes>` (correct react-router pattern) with a `Spinner` fallback. |
| `vite.config.ts` | **F-05** — Rolldown `build.rollupOptions.output.codeSplitting.groups` (vendor-react / vendor-query / vendor-forms), per the DensCare engineering blueprint §3.2. |
| `src/pages/dashboard/DashboardPage.tsx` | **F-07** — corrected the stale "All data is placeholder — no API calls" comment (My Treatment Plans + Upcoming Appointments are live). |
| `src/hooks/treatmentPlans/useTreatmentPlanItemMutations.ts` | **F-07** — updated the stale `item_count`/`total_estimated_cost` invalidation comment (values are now derived on the detail view). |

### Test files modified / added

| File | Change |
|---|---|
| `src/components/treatmentPlans/containers/TreatmentPlanDetailsContainer.test.tsx` | **F-01** — aggregate fixture no longer carries the list-only fields; added the F-01 regression test (summary derives `1` item / `₱1500.00`; no `₱—` placeholder). |
| `src/hooks/treatmentPlans/useTreatmentPlanTransitionMutations.test.tsx` | **F-01** — fixture corrected (removed list-only fields). |
| `src/hooks/treatmentPlans/useTreatmentPlanItemMutations.test.tsx` | **F-01** — fixture corrected (removed list-only fields). |
| `src/utils/treatmentPlanStateMachine.test.ts` | **F-04** — `accepted`/`in_progress`/`on_hold` action coverage; all **14** endpoint suffixes asserted; **F-02** — `approvalActionsForSubState`/`isApprovalAction` coverage; **F-06** — renamed constant. |
| `src/utils/treatmentPlanFormatting.test.ts` | **new** — `parseSnapshotMoney` (string Decimal / number / NaN-safe) + `formatTreatmentCost` (F-03). |
| `src/utils/procedureFormSchema.test.ts` | **new** — code/name/description/cost/category bounds (F-04). |
| `src/utils/itemFormSchema.test.ts` | **F-04** — FDI boundaries 11/48/49/50/51/85/86/0/10/100 + negative/non-numeric costs/discounts. |
| `src/hooks/treatmentPlans/useTreatmentPlanFilters.test.ts` | **new** — params memo, O6 date pass-through, `is_active` mapping, 350 ms debounce, page reset, clear (F-04). |
| `src/services/treatmentPlanService.test.ts` | **F-04** — list query-param coverage (`search`, `is_active`, `date_from`/`date_to`, `sort_by`/`sort_order`); **F-01/F-03** — wire-contract block (no list fields on the aggregate; Decimal-as-number on items; Decimal-as-string in snapshots). |
| `src/services/procedureService.test.ts` | **F-03** — `default_cost` Decimal-as-number wire assertion. |
| `src/components/treatmentPlans/PlanTransitionActions.test.tsx` | **F-02** — sub-state gating cases (unsigned → Doctor Approve; signed → Revoke + patient buttons; patient-decided → Revoke only). |

---

## 3. Fixes Implemented

### F-01 — Plan Summary Contract Fix (🔴 release blocker) — RESOLVED

- **Root cause (verified against `backend/app/modules/treatment/schemas/treatment_plan.py`):**
  the backend aggregate `TreatmentPlanResponse` has **no** `item_count` / `total_estimated_cost`;
  those are list-only fields computed by the list mapper. The frontend type wrongly
  `extends TreatmentPlanListItem`, so `plan.item_count`/`plan.total_estimated_cost` were
  `undefined` → `formatFee(undefined)` → `—`.
- **Fix:** split the type — `TreatmentPlanBase` (shared fields) → `TreatmentPlanListItem`
  (+ list-only fields) and `TreatmentPlanResponse` (aggregate fields, no list-only fields).
  The details container now derives `itemCount = plan.items.length` and
  `totalEstimatedCost = Σ plan.items[].estimated_cost` (Decimal-as-number on the wire), and the
  UI renders real values for every plan.
- **Fixture correction:** the three aggregate fixtures that embedded the wrong assumption were
  corrected — this is why the suite now catches the defect instead of masking it.
- **Regression tests:** details-container test asserts the Plan Summary card renders the derived
  `1` item / `₱1500.00` and no `₱—`; service wire-contract test asserts `'item_count' in detail`
  and `'total_estimated_cost' in detail` are both `false`, and that the container-style derivation
  sums correctly.

### F-02 — Approval Action Gating (🟠 required UX) — RESOLVED

- **Root cause:** `planActionsForStatus('proposed')` rendered the approval actions regardless of
  the approval record sub-state, and never offered `doctor-revoke` at all — a signed plan still
  showed "Doctor Approve", an unsigned one showed "Patient Accepts/Declines" (guaranteed 409s).
- **Fix:** new pure helper `approvalActionsForSubState(approval)` in the state machine
  (doctor-approve ⇔ unsigned; doctor-revoke ⇔ signed; patient buttons ⇔ signed + patient pending).
  `PlanTransitionActions` unions the sub-state actions with the status-driven non-approval actions
  (accept/decline/cancel are NOT sub-state gated — verified in the backend `accept_plan`/`decline_plan`,
  which only require PROPOSED). The details container passes `plan.approval`, and `ApprovalStatusCard`
  now derives its gating from the same helper, so header and tab cannot drift.

### F-03 — Decimal Response Typing (🟡) — RESOLVED

- **Verified wire format:** top-level response Decimals (`estimated_cost`, `discount`,
  `default_cost`) are JSON numbers; version snapshot money (`items_snapshot`) is `str(Decimal)`
  strings. The existing types already reflected this (items `number`, snapshots `string`), so no
  type changes were required — the ambiguity is now **contract-tested**:
  `typeof item.estimated_cost === 'number'`, `typeof snapshot.estimated_cost === 'string'`,
  `typeof procedure.default_cost === 'number'`, plus `parseSnapshotMoney` NaN-safety.

### F-04 — Expanded Test Coverage (🟡) — RESOLVED

- New `procedureFormSchema.test.ts` (the only form schema missing a dedicated test file).
- State machine now covers `accepted`/`in_progress`/`on_hold` action sets and asserts **all 14**
  endpoint suffixes (was 4/14).
- New `useTreatmentPlanFilters.test.ts` (params memo, O6 date pass-through verbatim, `is_active`
  mapping, debounce, page reset, clear).
- Item schema now covers FDI boundaries 11/48/49/50/51/85/86/0/10/100 and negative/non-numeric
  costs.
- Service tests now cover list query params (`search`, `is_active`, `date_from`/`date_to`,
  `sort_by`/`sort_order`).

### F-05 — Route-Level Code Splitting (🟡) — RESOLVED

- The three Treatment Plan / Procedure pages are `React.lazy`-loaded with a `Spinner` fallback;
  `Suspense` correctly wraps `<Routes>` (react-router requires `Route`/`Fragment` children).
- Vite 8 is Rolldown-powered, so the blueprint's Rollup `manualChunks` object form is replaced by
  the native `codeSplitting.groups` API (`vendor-react`, `vendor-query`, `vendor-forms`).
- **Result:** main bundle 788.49 kB → **254.20 kB** (gzip 61.79 kB); route chunks
  (Details 51.75 kB, List 15.47 kB, Procedures 13.71 kB) load on demand; the `>500 kB` Vite
  warning is gone.

### F-06 — Transition Constant Rename (🟡) — RESOLVED

- `ALLOWED_PLAN_TRANSITIONS` → **`ENDPOINT_BACKED_TRANSITIONS`** — the name now reflects that the
  map intentionally omits the state-machine-legal but endpointless `proposed→draft` /
  `rejected→draft` edges (O12). All references (source + tests) updated.

### F-07 — Stale Comments (🟡) — RESOLVED

- `DashboardPage` header comment (ActiveTreatmentPlansCard performs real API calls).
- `useTreatmentPlanItemMutations` invalidation comment (derived totals).
- Type-file and state-machine doc comments brought in line with the corrected behavior.

---

## 4. Regression Tests Added (summary)

- **F-01:** Plan Summary derives `item_count` + total from `plan.items`; detail payload has no
  list-only keys; derived sum matches container logic.
- **F-02:** header hides/swaps approval actions by sub-state (4 new component cases + 5 state
  machine cases).
- **F-03:** Decimal-as-number (items, procedures) vs Decimal-as-string (snapshots); `parseSnapshotMoney`
  contract.
- **F-04:** procedure schema, filters hook, FDI boundaries, service query params, full transition
  endpoint map.

---

## 5. Validation Results

| Command | Result |
|---|---|
| `npm test` | ✅ **1031 tests / 137 files passed** (975 before remediation — 56 new) |
| `npm run lint` | ✅ 0 errors / 0 warnings |
| `tsc -b` | ✅ clean |
| `npm run build` | ✅ success — chunked output, no >500 kB warning |

---

## 6. Confirmation

- **F-01 — RESOLVED.** The release blocker is fixed at the type, derivation, fixture, and
  regression-test level. The Plan Summary card renders correct derived totals for valid plans.
- **F-02 — RESOLVED.** Header approval actions are gated by the approval record sub-state via the
  shared `approvalActionsForSubState` helper; the header and the Approval tab can no longer drift,
  and the UI never offers a call the backend would reject with 409 for these four actions.

---

## 7. Remaining Informational Items (no action required)

| ID | Item | Disposition |
|---|---|---|
| F-08 | "Create Version" gated to editable statuses only, though MAP §5.2 lists it (audit-only) for accepted/in_progress/on_hold | Recorded as a deliberate divergence — MAP A21 explicitly permits the stricter UX gate. No change. |
| F-09 | `ActiveTreatmentPlansCard` query key uses `user?.id ?? 0` sentinel | Cosmetic; guarded so no spurious fetch occurs. No change. |

The Treatment Plan + Procedure Catalog module is now at the **Option B** standard — approved for
production with minor improvements — per the independent review's own verdict criteria. Work on the
Billing module may proceed.

---

*This document is the deliverable for Sprint 12A.1. No backend code was modified; the module was
not redesigned; no new features were introduced.*
