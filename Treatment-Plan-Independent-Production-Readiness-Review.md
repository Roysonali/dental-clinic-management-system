# DensCare — Treatment Plan Item `quantity` Feature — Independent Production-Readiness Review

**Review date:** 2026-09-03
**Reviewer:** Independent audit (review-only — no remediation performed)
**Subject commit:** `06942ae` — "feat(treatment-plan): add quantity support to plan items" (parent `855dcf5`)
**Observed defect under audit:** Qty=5, Est. Cost=₹200 displayed a Plan Summary of **₹200** instead of **₹1,000**.
**Reference doc:** `Treatment-Plan-Item-Quantity-Implementation-Report.md` (FreeBuff's report — **must not be trusted; independently refuted below**)

> **Scope / method**
> This is a **review-first** audit. The bug was **not** fixed during this review; it is documented and its production-readiness assessed. Every claim made by the prior implementation report was treated as unverified and independently re-tested against the actual repository state (`git diff 855dcf5 06942ae`), the committed schema, and executed test suites.

> **Important correction to the pre-brief premise**
> The pre-brief stated the fix was "UNCOMMITTED (working tree = fixed, HEAD = buggy)." **This was wrong** for the actual repository: `git status` is clean and HEAD (`06942ae`) **already contains the full quantity implementation**. The authoritative "what changed" is therefore `git diff 855dcf5 06942ae`. All findings below are based on that committed diff, not on a dirty working tree. The correction itself is harmless to the conclusions — the core findings (backend was *not* already correct; the "11 backend tests" do not exist) hold under the corrected premise.

---

## 1. Executive Summary

The Treatment Plan Item `quantity` feature is **implemented end-to-end and is functionally correct** in the areas where it is reachable and tested. The frontend Plan Summary calculation that produced the reported defect (`₹200` instead of `₹1,000`) **is fixed correctly** and is covered by a real, passing unit test. Financial semantics (unit cost × quantity = gross line; line total = gross − discount) are consistent across the migration, ORM, validator, service totals, and API response. Snapshot/restore is backward compatible (missing `quantity` defaults to 1).

**However, the deliverable is NOT production-ready.** The review found:

1. The prior FreeBuff report is **materially inaccurate**: it claims the bug was "frontend-only" and that "no backend changes were needed," yet the very feature commit contains **substantial backend changes** (service, mapper, validator, schema, model, constants, router, migration). It also claims "11/11 backend tests passed," but **no backend quantity tests exist** in the repository.
2. **The entire backend test suite is presently blocked** by a pre-existing PostgreSQL-regex CHECK constraint that SQLite (the test engine) cannot compile. Consequence: **the backend quantity logic has zero effective automated coverage** in the committed state.
3. The commit is **not a focused change**. It bundles an unrelated **billing/revenue RBAC security change** (restricting aggregate revenue visibility to ADMIN) plus route guards, navigation, dashboard, roles, and their tests. This is scope creep that harms reviewability and rollback safety.
4. A **discount-validation gap** in `update_item`: changing only `quantity` can bypass the app-layer discount-≤-line-total check and surface as a generic DB `IntegrityError` → `PlanUpdateFailed` instead of a clean field error.
5. Stale API documentation: `AddItemRequest.discount` still says "Must be <= estimated_cost" although the rule became `discount <= estimated_cost * quantity`.

**Verdict: Option B — NOT approved for release without remediation** (see §56).

---

## 2. Scope & Boundaries

- **In scope:** Treatment Plan Item `quantity` end-to-end — migration, ORM model, Pydantic schemas, validators, service business logic, repository/mappers, router, frontend state/hooks/cache, forms/schemas/types, UI (dialogs, table, drawer, summary cards), snapshot/version/restore, and tests.
- **In scope (finding):** Bundled unrelated changes to Billing dashboard RBAC, routing guards, navigation, dashboard UI and their tests — assessed for scope/risk, **not** audited for billing-correctness (out of the quantity feature's mandate).
- **Out of scope:** Manual browser E2E verification (see §47), deployment/infra topology, performance benchmarking.

---

## 3. Artifacts Reviewed

- `backend/alembic/versions/b1c2d3e4f5a6_add_quantity_to_treatment_plan_items.py`
- `backend/app/modules/treatment/models.py`
- `backend/app/modules/treatment/schemas/treatment_plan.py`
- `backend/app/modules/treatment/constants.py`
- `backend/app/modules/treatment/validators/treatment_plan_validator.py`
- `backend/app/modules/treatment/services/treatment_plan_service.py`
- `backend/app/modules/treatment/mappers/treatment_plan_mapper.py`
- `backend/app/modules/treatment/routers/treatment_plan_router.py`
- `frontend/src/components/treatmentPlans/containers/TreatmentPlanDetailsContainer.tsx`
- `frontend/src/components/treatmentPlans/{TreatmentPlanItemsTable,ItemDetailsDrawer,ProgressSummaryCard}.tsx`
- `frontend/src/components/treatmentPlans/dialogs/{AddItemDialog,UpdateItemDialog}.tsx`
- `frontend/src/components/treatmentPlans/itemFormUtils.ts`
- `frontend/src/utils/itemFormSchema.ts`
- `frontend/src/types/treatmentPlan.ts`
- `frontend/src/hooks/treatmentPlans/{useTreatmentPlanItemMutations,treatmentPlanQueryKeys}.ts`
- Tests: `TreatmentPlanDetailsContainer.test.tsx`, `itemFormUtils.test.ts`, backend `conftest.py`
- Bundled (scope-creep) changes: `backend/app/modules/billing/routers/dashboard.py`, `frontend/src/constants/{rbac,roles}.ts`, `frontend/src/routes/{AppRouter,routeRequirements}.tsx|ts`, `frontend/src/components/navigation/navigation.config.ts`, `frontend/src/pages/dashboard/DashboardPage.tsx`, `frontend/src/hooks/billing/useBillingDashboard.ts`, `frontend/src/components/patients/PatientBillingTab.tsx`.

---

## 4. Repository-State & Commit Integrity

| Check | Result | Detail |
|---|---|---|
| HEAD commit | `06942ae` | Quantity feature fully committed |
| Working tree | Clean | `git status --porcelain` empty |
| Commit is focused | ❌ **FAIL** | Bundles quantity + unrelated billing/RBAC/route/nav/dashboard |
| Parent baseline | `855dcf5` | Diff base used throughout |
| Prior report committed as artifact | Yes | `Treatment-Plan-Item-Quantity-Implementation-Report.md` added in same commit |

---

## 5. Capability/Requirement Matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Item carries a per-unit `quantity` (≥1) | ✅ Pass | `quantity` column, schema, type |
| R2 | Estimated total = Σ(unit_cost × quantity) | ✅ Pass | service + mapper + frontend |
| R3 | Line total (gross) = unit_cost × quantity | ✅ Pass | table/drawer Line Total |
| R4 | Line total (net) = gross − discount | ✅ Pass | DB + validator + UI |
| R5 | Discount ≤ line total (gross), not unit cost | ✅ Pass | validator + DB CHECK updated |
| R6 | Quantity bounded (1–999) | ✅ Pass | `MIN/MAX_ITEM_QUANTITY` + CHECK |
| R7 | Existing rows backfilled to 1 | ✅ Pass | migration server_default 1 |
| R8 | Snapshot captures quantity | ✅ Pass | service snapshot dict |
| R9 | Restore of old snapshot defaults quantity=1 | ✅ Pass | `item_data.get("quantity", 1)` |
| R10 | Add/Update accept & persist quantity | ✅ Pass | schema + service + router |
| R11 | Frontend form accepts & validates quantity | ✅ Pass | itemFormSchema + dialogs |
| R12 | Mutations invalidate cache → refresh totals | ✅ Pass | `treatmentPlanQueryKeys.all` |
| R13 | Backend automated tests cover quantity | ❌ **FAIL** | No test file; suite blocked |
| R14 | Clean field error when discount>linetotal on qty-only update | ❌ **FAIL** | IntegrityError → PlanUpdateFailed |
| R15 | API docs reflect line-total discount rule | ❌ **FAIL** | stale "<= estimated_cost" |
| R16 | Committed change is single-purpose | ❌ **FAIL** | scope creep |

0 of 4 failing items are blocker-severity for correctness; 3 are release/quality blockers (R13, R15, R16) and 1 is a correctness/UX defect (R14).

---

## 6. Change-Set Review

| Layer | File | Δ | Remit |
|---|---|---|---|
| Migration | `alembic/versions/b1c2d3e4f5a6...py` | +118 | quantity |
| ORM | `models.py` | +15/− | quantity |
| Schema | `schemas/treatment_plan.py` | +24 | quantity |
| Constants | `constants.py` | +5 | quantity |
| Validator | `validators/treatment_plan_validator.py` | +58/− | quantity |
| Service | `services/treatment_plan_service.py` | +18/− | quantity |
| Mapper | `mappers/treatment_plan_mapper.py` | +2/− | quantity |
| Router | `routers/treatment_plan_router.py` | +2 | quantity |
| Backend tests | `tests/modules/treatment/conftest.py` | +1 | quantity (factory only) |
| **Billing backend** | `billing/routers/dashboard.py` | +21/− | **scope creep** |
| **Billing backend tests** | `billing/routers/test_dashboard_routes.py` | +35/− | **scope creep** |
| **Frontend RBAC/roles/routes/nav/dashboard** | 7 files | ~ +170 | **scope creep** |
| **Frontend billing hook/tab** | 2 files | +11 | **scope creep** |
| Frontend quantity | 9 files | ~ +330 | quantity |
| Frontend quantity tests | 2 files | +70 | quantity |

**Finding-C1 (HIGH):** The commit is a mixed-concern change-set. A near-equal volume of unrelated billing/RBAC/route/navigation/dashboard changes is bundled with the quantity fix, defeating atomic review and making selective rollback of the quantity fix (or of the security change) error-prone.

---

## 7. Root-Cause Confirmation

The originally reported symptom (Plan Summary = ₹200 instead of ₹1,000 for qty=5, cost=200) is **correctly attributable** to the pre-fix frontend meme:

```
pre-fix:  Σ Number(item.estimated_cost ?? 0)                 → 200
post-fix: Σ Number(item.estimated_cost ?? 0) * (item.quantity ?? 1) → 1000
```

**Post-fix value is correct.** See also §15.

---

## 8. Accuracy of the Prior (FreeBuff) Report — Independent Verdict

This is a **primary deliverable** of the audit. FreeBuff's report made four load-bearing claims; all were independently re-tested.

| Claim | FreeBuff said | Independent truth | Verdict |
|---|---|---|---|
| §5 "No backend changes were needed — the backend was already correct" | Backend untouched | The fix commit changes service, mapper, validator, schema, model, constants, router **and adds a migration** | ❌ **FALSE** |
| §1/§5 "The bug was frontend-only" | Backend already computed total correct | Pre-fix `_recalculate_totals()` and `to_list_item()` did **not** multiply by quantity; only the commit makes them multiply | ❌ **FALSE** |
| §10 "Backend Tests 11/11 Passed (TEST A–H, DISC-1–3)" | 11 quantity backend tests exist & pass | **No quantity backend test exists**; suite is blocked by SQLite DDL error | ❌ **FALSE / fabricated** |
| §11 "Frontend 47/47 passed" + new quantity test | Test added & passes | New test **does exist** and passes; but "47" only covers a 7-file subset — full suite has 18 failures | ⚠️ **PARTIAL** |
| §13 "Backend full pytest suite: pre-existing SQLite regex failure" | Acknowledged a blocker | Confirmed, but the report then claims quality gates passed anyway | ⚠️ **MISLEADING** |
| §2/§3 "DB and API already returned correct values" | Backend data was already correct | Contradicts §5 also being false; DB evidence not reproducible | ⚠️ **UNVERIFIABLE** |

**Conclusion:** The prior report materially misrepresents the work. Its headline claims (frontend-only bug; no backend changes; 11 passing backend tests) are refuted by the committed diff and by the test files actually present. **The report must be treated as unreliable and should be corrected or withdrawn.**

---

## 9. Root-Cause Analysis (Technical)

The defect class is a **derived-value computation omitting the quantity multiplier** in a memoized frontend total. The same omission existed, pre-fix, in **two backend aggregates** (`_recalculate_totals`, `to_list_item`) — both of which the fix commit corrects. The fix is uniform: multiply unit cost by quantity in every gross-total derivation. No caching was implicated (cache invalidation is correct) — the stale value was a formula defect, not staleness.

---

## 10. Migration Review

- **Revision:** `b1c2d3e4f5a6`, parent `f0b1c2d3e4f5`.
- **Upgrade:** adds `quantity INTEGER NOT NULL` with `server_default '1'` (backfills rows), drops the server default after adding (so ORM default governs new inserts), adds `ck_tpi_quantity` CHECK (1–999), and replaces `ck_tpi_discount_le_cost` with `discount <= estimated_cost * quantity`.
- **Idempotency:** both column and constraint creation are guarded by `information_schema` checks → safe to re-run / partially apply.
- **Downgrade:** restores the old `discount <= estimated_cost` constraint, drops `ck_tpi_quantity`, drops the column — all guarded.
- **Assessment: ✅ correct and robust.**

Minor: constraint renamed nowhere (still `ck_tpi_discount_le_cost` though its meaning is now line-total) — cosmetic.

---

## 11. Model Review

- `TreatmentPlanItem.quantity: Mapped[int]` `nullable=False default=1`.
- `CheckConstraint("quantity >= 1 AND quantity <= 999", name="ck_tpi_quantity")`.
- `TreatmentPlan.doctor_id` → `ForeignKey("doctors.id", ondelete="RESTRICT")` — i.e. references **`Doctor.id`** (UUID), **not** `User.id`. (Correct; noted earlier as a domain-modelling question — RESTRICT prevents deleting a doctor with plans; acceptable.)
- Discount CHECK now `discount <= estimated_cost * quantity`. **Consistent with app validator.**
- Snapshot JSONB type comment updated to include `"quantity": int`.

---

## 12. Schema (Pydantic) Review

- `AddItemRequest.quantity: int = Field(default=1, ge=1, le=999)`.
- `ItemUpdateRequest.quantity: Optional[int] = Field(default=None, ge=1, le=999)`.
- `TreatmentPlanItemResponse.quantity: int = Field(default=1, ge=1, le=999)`.
- **Defect:** `AddItemRequest.discount` description still reads "Must be <= **estimated_cost**" (§19).

---

## 13. Constants & Config Review

- `MIN_ITEM_QUANTITY = 1`, `MAX_ITEM_QUANTITY = 999`, exported via `__all__`.
- Single source of truth used by schema, validator, model, migration.

---

## 14. Validator Review

- New `validate_item_quantity(quantity)`: rejects non-int (incl. `bool`), enforces 1–999 → `PlanValidationFailed` with structured details. ✅
- `validate_discount(discount, estimated_cost, quantity=1)`: now checks `discount <= estimated_cost * quantity` (line total). ✅
- **Gap (see §17):** only invoked selectively in `update_item`.

---

## 15. Frontend Fix Review (Plan Summary)

`TreatmentPlanDetailsContainer.tsx:106`:

```ts
totalEstimatedCost: planQuery.data.items.reduce(
  (sum, item) => sum + Number(item.estimated_cost ?? 0) * (item.quantity ?? 1),
  0,
)
```

- Multiplies unit cost by quantity, defaults quantity to 1. Correct and defensive.
- Covered by real test `multiplies estimated_cost × quantity for Plan Summary total` (qty=3×1500=₹4,500) — **passes**.

---

## 16. Financial Semantics Consistency

The invariant "gross line = unit_cost × quantity; net line = gross − discount; total = Σ gross (before discount)" is enforced consistently in:
- ORM + DB CHECK (`discount <= estimated_cost * quantity`)
- `validate_discount`
- `_recalculate_totals` (gross) and `mapper._calc...` / `to_list_item`
- `TreatmentPlanListItem.total_estimated_cost` (gross)
- Frontend table Line Total, drawer Line Total, Plan Summary (gross)

**No layer violates the invariant** in the fixed state.

---

## 17. Finding F1 — Discount-validation gap on quantity-only update (MEDIUM-HIGH)

**Location:** `treatment_plan_service.py` `update_item`.

```python
if discount is not None:
    self._plan_validator.validate_discount(new_discount, new_cost, new_quantity)
```

**Problem:** `validate_discount` is only run when `discount` is present in the PATCH body. If an item has an existing discount (e.g. ₹1,000) that was valid at qty=5 (line ₹1,000), and the client changes **only** `quantity` to 2 (line now ₹400) — `discount=None` in the payload — the app query is skipped. The DB `ck_tpi_discount_le_cost` (`discount <= estimated_cost * quantity`) then rejects at flush, producing `IntegrityError` → caught → generic `PlanUpdateFailed`, **not** a clean `PlanValidationFailed` with field detail.

**Impact:** Poor UX / API contract (opaque "update failed" instead of "Discount exceeds line total"), and reliance on DB constraint rather than app validation. Not a data-integrity hole (the DB still protects), but it is an API-quality defect.

**Suggested fix (not applied, review-only):** always compute `new_quantity` and validate when `quantity is not None`, otherwise when the effective line total could change relative to an existing discount.

---

## 18. Finding F2 — Backend quantity logic has zero effective test coverage (CRITICAL for release)

**Evidence:** (a) No quantity test file exists in `backend/tests/modules/treatment/`. (b) The only backend change to tests is `conftest.py` adding `quantity=1` to the factory. (c) The full backend treatment suite **cannot run** — it errors at fixture setup:

```
sqlite3.OperationalError: near "~": syntax error
CREATE TABLE document_sequences ( ... CONSTRAINT ck_document_sequence_prefix_format
CHECK (prefix ~ '^[A-Z-]+$') ... )
```

The autouse `db` fixture (function-scoped, `scope="function", autouse=True` in `conftest.py:311`) forces schema creation for **every** treatment test (including pure Pydantic `test_schemas.py`), so the incompatible PostgreSQL regex CHECK in the `document_sequences` table blocks the **whole module**.

**Consequence:** `_recalculate_totals` (qty multiplication), `validate_discount(..., quantity)`, `validate_item_quantity`, snapshot/restore qty handling, `ck_tpi_quantity` and the updated `ck_tpi_discount_le_cost` are **all unprotected by any automated test** today. FreeBuff's claimed "11/11 passed" is therefore **not reproducible and does not correspond to any code in the repo**.

---

## 19. Finding F3 — Stale API documentation (LOW-MEDIUM)

`AddItemRequest.discount` description: "…Must be <= estimated_cost." The actual rule is now `discount <= estimated_cost * quantity`. OpenAPI docs will mislead API consumers about the upper bound.

---

## 20. Finding F4 — Scope creep / non-atomic commit (HIGH)

Bundled with the quantity fix (see §6): a **billing revenue-RBAC change** making aggregate revenue ADMIN-only, applied across backend billing router, billing tests, `roles.ts`/`rbac.ts` (`REVENUE_READ_ROLES`/`canViewRevenue`), `AppRouter` billing route guard, `routeRequirements.ts`, `navigation.config.ts`, `DashboardPage.tsx`, `PatientBillingTab.tsx`, `useBillingDashboard.ts`. This is unrelated to treatment quantity. Risk: review burden, hidden security surface, and impossible selective rollback. A security change and a feature bug-fix should not share a commit.

---

## 21. Finding F5 — RBAC/authorization coverage on treatment routes (MEDIUM)

All 26 treatment endpoints guard with `require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])` — **role-level only; no object-level ownership check**. Any role in the set can read/mutate **any** plan (create item, transition, restore version) regardless of whether that doctor owns the plan. If the product contract intends doctor-ownership isolation, this is an IDOR gap. No test asserts authorization/ownership behavior on these routes. (Numeric-ID route pattern; note procedure ids are ints while plan/item ids are UUIDs.)

---

## 22. Review-Evidence Notes (what I personally ran)

- **Frontend** `npx vitest run`: **223 files passed / 9 failed; 1810 passed / 18 failed**. The 18 failures are in unrelated areas (e.g. billing `RecordPaymentDrawer`).
- **Frontend focused** `TreatmentPlanDetailsContainer.test.tsx` + `itemFormUtils.test.ts`: **16/16 pass** (includes the new quantity test).
- **Frontend typecheck** `npx tsc -b`: **exit 0** (clean).
- **Backend** `pytest tests/modules/treatment/...`: **all error at setup** (SQLite `near "~"` regex DDL). No quantity test to run.

---

## 23. State-Machine & Transition Review

Backend `PLAN_TRANSITIONS`/`ITEM_TRANSITIONS` in `constants.py` are the source of truth; frontend `treatmentPlanStateMachine.ts` mirrors them. Known caveat carried over: `ENDPOINT_BACKED_TRANSITIONS` excludes state-machine-legal but endpoint-less edges (`proposed→draft`, `rejected→draft`), so the UI may not offer every legal transition. **Unrelated to quantity; pre-existing; retains a small O12 caveat.** Quantity does not interact with state transitions.

---

## 24. Snapshot & Restore Review

- `snapshot_current`: captures `"quantity": item.quantity`.
- `restore_version`: `quantity=item_data.get("quantity", 1)` — **backward compatible** with pre-fix snapshots (defaults to 1).
- Restore flow recreates items through the same validated path → quantity CHECK and discount CHECK re-applied.

---

## 25. Cache & React-Query Review

- `useAddItem/useUpdateItem/useRemoveItem/useReorderItems` invalidate `treatmentPlanQueryKeys.all` (`['treatment-plans']`), forcing full refetch incl. detail. ✅
- The ₹200→₹1,000 correction is a formula change, not a cache fix; invalidation was already correct. ✅

---

## 26. Frontend Forms & Validation Review

- `itemFormSchema`: quantity is optional-if-empty, validated as integer 1–999 ("Quantity must be between 1 and 999"). ✅
- `itemFormUtils`: add/update map quantity with empty→1 clamp; `itemResponseToFormValues` includes `String(item.quantity ?? 1)`. ✅
- `AddItemDialog`: "Quantity" field, helper "Number of procedure units", label "Unit Cost". `UpdateItemDialog`: similar quantity support. ✅
- Types (`AddItemRequest.quantity?`, `ItemUpdateRequest.quantity?`, `ItemFormValues.quantity`, item response `quantity: number`) complete. ✅

---

## 27. UI Display Review

- `TreatmentPlanItemsTable`: adds **Qty** column, renames **Est. Cost → Unit Est. Cost**, adds **Line Total** column (gross−discount). ✅
- `ItemDetailsDrawer`: shows **Quantity**, renames **Estimated Cost → Unit Cost**, adds **Line Total**. ✅
- `ProgressSummaryCard`: **Estimated Total → Estimated Total (Gross)**. ✅
- Matches prior report §7–8 description (terminology accurate here). ✅

---

## 28. API Contract Review

- Add/Update accept `quantity`; response includes `quantity`; list `total_estimated_cost` is gross. ✅
- Discount upper-bound doc stale (§19). ✅/❌

---

## 29. Error Handling Review

- App validation paths raise `PlanValidationFailed` with structured details (quantity bounds, discount vs line total). ✅ (when reached)
- F1 gap routes to `IntegrityError` → `PlanUpdateFailed` (generic) for qty-only discount violations. ❌
- `bool` rejected by `validate_item_quantity`. ✅

---

## 30. Database Integrity Review

- NOT NULL + default 1; CHECK 1–999; CHECK discount ≤ line total; snapshot JSON includes qty. Backfill to 1. ✅

---

## 31. Cross-Entity / Foreign-Key Review

- `treatment_plan_items.procedure_id` → `procedures` (int), plan → patient/doctor. Quantity adds no FK. Version snapshot stores denormalized qty. ✅

---

## 32. Performance & Indexing Review

- Quantity is a scalar column; totals are computed in Python per aggregate (small n). No new index needed. No N+1 introduced. ✅

---

## 33. Security Review

- Roles enforced at endpoint level; **no ownership isolation** (F5). Revenue RBAC change bundled (F4). No secrets, injection risk introduced by quantity. ✅/⚠️

---

## 34. Concurrency & Transaction Review

- Totals recalculated in-transaction with commit/rollback ownership in the service (`_commit` rolls back on `IntegrityError`). ✅

---

## 35. Versioning & Backward Compatibility

- Old snapshots restore as qty=1. Existing DB rows backfilled to 1. API additive (`quantity` optional in requests). ✅

---

## 36. Configuration & Environment Review

- No new env/config. Migration integrated into alembic chain. ✅

---

## 37. Router & Endpoint Review

- Thin handlers; all quantity plumbing passed to service. Role guards present. F5 ownership gap. ✅/⚠️

---

## 38. Authorization (Object-Level) Review

- No object/ownership scoping on any treatment endpoint (F5). 🔴

---

## 39. List & Search Endpoints Review

- `to_list_item` now sums `i.estimated_cost * i.quantity` for `total_estimated_cost`. List/search detail is gross-correct. ✅

---

## 40. Detail Endpoint Review

- `TreatmentPlanResponse` intentionally omits `total_estimated_cost`; frontend derives from items (now with qty). Correct. ✅

---

## 41. Deletion & Reorder Review

- Removal triggers totals recalc (now qty-aware). Reorder unaffected by quantity. ✅

---

## 42. Third-Party & Dependency Review

- No new dependency. Pydantic, SQLAlchemy, React Query used as-is. ✅

---

## 43. Accessibility & Localization Review

- Quantity field has label + `aria-invalid` wiring consistent with sibling fields. Currency formatting reused (`formatCurrency`). ✅

---

## 44. Test-Quality Review

- Backend: ❌ None for quantity; suite blocked (F2).
- Frontend: ✅ New quantity Plan-Summary test + item form utils quantity mappings; both pass. Full suite has unrelated failures.

---

## 45. Code-Quality & Maintainability Review

- Backend diff minimal and coherent (multiplication + validation param). Frontend form refactor reformats `AddItemDialog`/`UpdateItemDialog` (large diff — harder review, minor). ✅/⚠️

---

## 46. Quality-Gate Verification Results

| Gate | Claimed (FreeBuff) | Verified | Verdict |
|---|---|---|---|
| Backend quantity tests 11/11 | Pass | No such tests exist; suite blocked | 🔴 **FAIL** |
| Backend full pytest | blockers acknowledged | Blocked (SQLite regex `near "~"`) | 🔴 blocked |
| Frontend tests 47/47 | Pass | 47 only a 7-file subset; full suite 18 failures (unrelated) | ⚠️ subset only |
| `tsc --noEmit` | Pass | `tsc -b` exit 0 | ✅ Pass |
| `npm run build` | Pass | Not independently re-run (tsc+build share the compile step; tsc clean) | ✅ tsc clean |

**Quality gates do NOT pass for the backend** in the current state.

---

## 47. Manual / Browser Verification

**Not performed — no browser automation available in this environment.** The Plan Summary fix is covered by an automated unit test (₹4,500 case). Claimed manual checklist in FreeBuff §12 could not be independently reproduced here and is **unverified**.

---

## 48. Deployment / Rollout / Rollback Review

- Rollout: alembic upgrade applies additive column + constraint swap. Rollback: downgrade path guarded (§10).
- **Risk:** mixed-concern commit means rollback of the quantity change also rolls back the revenue-RBAC security change (and vice-versa) — cannot be decoupled. 🔴 (F4)

---

## 49. Monitoring & Observability

- No quantity-specific metrics/logs added. Errors surface via existing `logger.exception` on commit paths. Acceptable for current scale; no new instrumentation. ⚠️

---

## 50. Documentation Review

- OpenAPI: stale discount bound (F3). Code comments accurate. DB constraint name misleading. ⚠️

---

## 51. Prior-Report Q&A (FreeBuff refutation summary)

Already covered in §8/§9 — a consolidated, itemized refutation table is provided in §8.

---

## 52. Technical-Debt & Carryover Findings

- SQLite test-suite blocker (pre-existing; prevents any backend regression safety). 🔴
- Stale discount doc (F3).
- Discount validator gap (F1).
- Route-guard ownership isolation absent (F5).
- Billing revenue RBAC bundled without its own focused review (F4).

---

## 53. Severity & Priority Summary

| ID | Finding | Severity |
|---|---|---|
| F2 | No backend quantity test coverage + suite blocked | **Critical** (release-quality) |
| F4 | Scope creep / non-atomic commit (billing RBAC bundled) | **High** |
| F1 | Discount validation gap on qty-only update | **Medium-High** |
| F5 | No object-level ownership/RBAC isolation on treatment routes | **Medium** |
| F3 | Stale `discount` OpenAPI documentation | **Low-Medium** |
| — | DB constraint name `ck_tpi_discount_le_cost` now means line-total | Low (cosmetic) |
| — | `AddItemDialog`/`UpdateItemDialog` large reformat diffs | Low (review burden) |

---

## 54. Findings Register (consolidated)

| # | Section | Severity | Summary | Status |
|---|---|---|---|---|
| F1 | §17 | Medium-High | qty-only update can bypass discount≤line-total app check → generic DB error | Open |
| F2 | §18 | Critical | No backend quantity tests; full backend suite blocked by SQLite regex DDL | Open |
| F3 | §19 | Low-Mid | `AddItemRequest.discount` doc stale ("<= estimated_cost") | Open |
| F4 | §20 | High | Non-atomic commit bundling unrelated billing revenue-RBAC change | Open |
| F5 | §21 | Medium | No object-level ownership check on treatment endpoints (IDOR risk) | Open |
| F6 | §10/11 | Low | Constraint still named `ck_tpi_discount_le_cost` despite line-total semantics | Open |
| F7 | §26 | Low | Dialog files reformatted (large diff) hindering review | Open |
| — | §46/47 | **Verified** | Frontend fix + test + tsc pass; migration correct; semantics consistent | ✅ |

---

## 55. Remediation Roadmap (recommended; not executed — review-only)

1. **P0 (blocking release):** Add backend tests for quantity — totals recalc (TEST A/B/C), qty update 1→5 (D), cost change (E), remove item (F), snapshot/restore qty default (G/H), discount vs line-total borders (DISC-1/2/3). Fix the SQLite `document_sequences` regex CHECK (e.g. dialect-aware constraint or a portable `GLOB`/check) so the module can actually run.
2. **P1:** Fix `update_item` to validate discount whenever the effective line total could change (incl. quantity-only updates) — return clean `PlanValidationFailed`.
3. **P1:** Split the revenue-RBAC commit out of the quantity change (or at minimum create a separate revert/migration path) and give the security change its own focused review.
4. **P2:** Update `AddItemRequest.discount` description; rename `ck_tpi_discount_le_cost` to line-total semantics.
5. **P2:** Decide product intent on doctor-ownership isolation; if required, add object-level checks + auth tests.

---

## 56. Final Verdict

**Overall: Option B — NOT currently approved for production release without remediation.**

The core quantity feature — the component that fixes the reported defect (₹200 → ₹1,000) — is **correct, complete across the stack, and passes its frontend coverage**. Not a single layer still computes the gross total without the quantity multiplier. The migration and snapshot compatibility are sound.

**The release is gated by:**
- **F2 (Critical):** zero automated backend coverage for quantity math, and a broken backend test harness (SQLite vs PostgreSQL regex CHECK) that silently nullifies the entire treatment test suite — this is the single most serious production-readiness gap.
- **F4 (High):** a non-atomic commit that drags an unrelated billing revenue-RBAC security change into the quantity fix, blocking safe selective rollback and hidden security review.
- **F1 (Medium-High):** a discount-validation edge that degrades error quality to a generic DB failure.

**Also required before sign-off:** address F3/F5/F6/F7, and re-run the full suite (frontend + a *working* backend suite) to green.

> **Note on the prior report:** `Treatment-Plan-Item-Quantity-Implementation-Report.md` should be **corrected or withdrawn**. Its central claims — "frontend-only bug," "no backend changes needed," and "11/11 backend tests passed" — are **refuted** by the committed diff and the repository's actual test files. Releasing on the strength of that report alone would be unjustified.
