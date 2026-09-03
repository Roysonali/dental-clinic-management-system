# DensCare — Treatment Plan Quantity Production Remediation Report

**Date:** 2026-09-03  
**Engineer:** Freebuff (automated remediation)  
**Branch:** feature/fix-bugs  
**Scope:** Targeted remediation sprint based on Independent OpenCode Review  

---

## 1. Executive Summary

This report documents the targeted remediation of the Treatment Plan Item `quantity` feature. The independent review confirmed the core quantity implementation is functionally correct but production sign-off was blocked by specific quality and validation gaps.

**What was fixed:**
- Test infrastructure: SQLite billing table regex constraint blocker eliminated
- Backend quantity tests: 20 real tests (Q1–Q20) + 1 F1 regression test created and passing
- F1 discount validation gap: quantity-only updates now revalidate existing discounts
- API documentation: stale discount description corrected
- Full treatment backend suite: 560 tests passing (was completely blocked)

**What was preserved (verified correct):**
- `estimated_cost × quantity` = gross line amount
- `gross − discount` = net line amount
- Plan total = Σ(gross line amounts)
- Quantity: integer, 1–999, default 1
- Snapshot/restore backward compatibility (old snapshots default quantity=1)
- Frontend Plan Summary multiplication
- Cache invalidation on all mutations
- Migration graph integrity

**Production readiness: APPROVED with caveats** (see §25)

---

## 2. Independent Findings Accepted

| ID | Finding | Severity | Action Taken |
|----|---------|----------|-------------|
| F1 | Quantity-only update bypasses discount validation | Medium-High | **FIXED** — discount now validated whenever quantity, estimated_cost, or discount changes |
| F2 | No backend quantity tests; suite blocked by SQLite regex | Critical | **FIXED** — 21 tests created, full suite (560) now passes |
| F3 | Stale `discount` OpenAPI documentation | Low-Medium | **FIXED** — description corrected to "Must be <= estimated_cost * quantity" |
| F4 | Non-atomic commit (billing RBAC bundled) | High | **NOTED** — not undone; documented as scope-creep (see §12) |
| F5 | No object-level ownership on treatment routes | Medium | **DECISION** — see §14; no code change |
| F6 | Constraint name `ck_tpi_discount_le_cost` stale | Low | **DECISION** — leave as-is, document as tech debt (see §10) |

---

## 3. Test Harness Root Cause

**Root cause:** The `document_sequences` table (billing module) has a PostgreSQL regex CHECK constraint:
```sql
CHECK (prefix ~ '^[A-Z-]+$')
```
SQLite cannot compile the `~` regex operator. When `Base.metadata.create_all()` is called in the treatment test conftest, it attempts to create ALL registered tables (including billing), causing `sqlite3.OperationalError: near "~": syntax error` and blocking the entire treatment test suite.

---

## 4. Test Infrastructure Fix

**Approach:** Option B — Dialect-aware schema generation while preserving production PostgreSQL constraints.

**Implementation:** Modified `backend/tests/modules/treatment/conftest.py` and `backend/tests/modules/treatment/test_auth_integration.py` to filter billing tables from `Base.metadata.create_all()`:

```python
_BILLING_TABLES = frozenset({
    "document_sequences", "sequence_consumption_log",
    "invoices", "invoice_line_items", "invoice_status_history",
    "payments", "payment_allocations", "receipts", "receipt_invoices",
    "credit_notes", "patient_credits", "refunds", "billing_audit_logs",
})

_test_tables = [
    t for name, t in Base.metadata.tables.items()
    if name not in _BILLING_TABLES
]
Base.metadata.create_all(bind=engine, tables=_test_tables)
```

**Also fixed:** `_mock_item()` in `test_mappers.py` missing `quantity` attribute (pre-existing mapper test broken by quantity feature commit).

**Result:** Full treatment backend suite: **560 passed, 1 skipped** (pre-existing skip unrelated to quantity).

---

## 5. Backend Quantity Tests Added

21 real, committed tests in `backend/tests/modules/treatment/test_quantity.py`:

| Test | Description | Status |
|------|-------------|--------|
| Q1 | quantity omitted → defaults to 1, gross = cost × 1 | ✅ PASS |
| Q2 | quantity=5, cost=200 → gross = 1000 | ✅ PASS |
| Q3 | multiple items: 2×500 + 3×200 → plan total = 1600 | ✅ PASS |
| Q4 | quantity update 1→5, cost=200: 200→1000 | ✅ PASS |
| Q5 | quantity update 5→3, cost=200: 1000→600 | ✅ PASS |
| Q6 | estimated_cost update while quantity>1: 1000→1500 | ✅ PASS |
| Q7 | remove item with quantity>1, total recalculates | ✅ PASS |
| Q8 | quantity=0 rejected | ✅ PASS |
| Q9 | quantity<0 rejected | ✅ PASS |
| Q10 | quantity=1000 rejected | ✅ PASS |
| Q11 | decimal quantity rejected | ✅ PASS |
| Q12 | bool quantity rejected | ✅ PASS |
| Q13 | discount boundary: qty=5, cost=200, discount=1000 valid | ✅ PASS |
| Q14 | discount=1001 rejected with PlanValidationFailed | ✅ PASS |
| Q15 | snapshot_current stores quantity | ✅ PASS |
| Q16 | restore snapshot with quantity preserves it | ✅ PASS |
| Q17 | restore OLD snapshot without quantity → defaults to 1 | ✅ PASS |
| Q18 | response DTO contains quantity | ✅ PASS |
| Q19 | list total_estimated_cost uses quantity | ✅ PASS |
| Q20 | quantity=1 preserves historical behavior | ✅ PASS |
| F1 | quantity-only update revalidates existing discount | ✅ PASS |

---

## 6. Effective Item-State Validation

**Before (F1 bug):**  
`validate_discount(...)` was only called when `discount is not None` in the PATCH body. A quantity-only update could bypass the check.

**After (fix applied):**  
In `treatment_plan_service.py` `update_item()`, discount validation now runs whenever ANY field affecting the line total changes:

```python
if discount is not None or quantity is not None or estimated_cost is not None:
    self._plan_validator.validate_discount(new_discount, new_cost, new_quantity)
```

The effective values are computed as:
- `new_quantity = request.quantity if supplied else item.quantity`
- `new_cost = request.estimated_cost if supplied else item.estimated_cost`  
- `new_discount = request.discount if supplied else item.discount`

---

## 7. Quantity-Only Discount Bug Fix

**Scenario:** Item has qty=5, cost=200, discount=1000 (valid: 5×200=1000). PATCH quantity only: 5→2.

**Before fix:** App-layer validation skipped → DB constraint fails → generic `PlanUpdateFailed`

**After fix:** `PlanValidationFailed` raised with message "Discount (1000) exceeds line total (400)" and structured details.

**Verified by:** `TestF1QuantityOnlyUpdateRevalidatesDiscount` test.

---

## 8. Structured Error Verification

The F1 fix returns the existing structured `PlanValidationFailed` exception (not `PlanUpdateFailed` or generic "update failed"):

```python
PlanValidationFailed(
    "Discount (1000) exceeds line total (400).",
    details={
        "discount": "1000",
        "estimated_cost": "200",
        "quantity": 2,
        "line_total": "400",
    },
)
```

---

## 9. API Documentation Fix

**Before:**  
`AddItemRequest.discount` description: "Must be <= estimated_cost"

**After:**  
`AddItemRequest.discount` description: "Flat line-level discount amount. Must be <= estimated_cost * quantity (line total)."

`ItemUpdateRequest.discount` description: "New discount amount." (was already acceptable)

---

## 10. Constraint Naming Decision

**Constraint name:** `ck_tpi_discount_le_cost`  
**Actual semantics:** `discount <= estimated_cost * quantity`  

**Decision:** Leave name as-is. Renaming would require a new migration with risk of downtime for a cosmetic change. Documented as low-severity technical debt.

---

## 11. Migration Graph Verification

```
alembic current:   c4d5e6f7a8b9 (head)
alembic heads:     c4d5e6f7a8b9 (head) — parent: b1c2d3e4f5a6
```

Quantity migration chain:  
`f0b1c2d3e4f5` → `b1c2d3e4f5a6` (quantity) → `c4d5e6f7a8b9` (head)

**Verdict:** Valid linear chain. No graph conflicts. The quantity migration participates correctly in the Alembic graph.

---

## 12. Revenue RBAC Scope-Creep Assessment

The quantity commit (`06942ae`) bundles unrelated billing revenue ADMIN-only RBAC changes across:
- Backend: `billing/routers/dashboard.py`, billing tests
- Frontend: `roles.ts`, `rbac.ts`, `AppRouter`, `routeRequirements.ts`, `navigation.config.ts`, `DashboardPage.tsx`, `PatientBillingTab.tsx`, `useBillingDashboard.ts`

**Assessment:** These changes are already committed and part of the branch history. Per the remediation instructions:
- Do NOT rewrite public Git history
- Do NOT undo these changes automatically
- Document separately from Treatment quantity changes

**Status:** Revenue RBAC changes are bundled but functional. Separate focused review recommended before production deployment of the billing module.

---

## 13. Revenue RBAC Verification

Backend billing RBAC changes restrict aggregate revenue visibility to ADMIN roles. Frontend route guards hide billing navigation for non-authorized roles.

**Assessment:** The RBAC changes appear functionally correct based on code review. However, a full billing module regression test was not in scope for this remediation. The billing backend tests in `tests/modules/billing/` should be run against a PostgreSQL environment for full verification.

---

## 14. Treatment Ownership / F5 Decision

**Finding:** Treatment Plan routes use role-level RBAC (`require_roles([ROLE_ADMIN, ROLE_RECEPTIONIST, *DOCTOR_ROLES])`) but have no object-level `plan.doctor_id` ownership check.

**Decision: A — NOT A DEFECT** (with recommendation)

**Rationale:**
- Clinic-wide authorized access is intentional for the current DensCare product
- Chief Doctor review, specialist collaboration, receptionist access, and treatment reassignment all require cross-doctor visibility
- Coverage when treating doctor is unavailable is a real workflow need
- No existing RBAC convention in the codebase enforces object-level ownership

**Recommendation:** If object-level isolation is ever required (e.g., for multi-tenant or compliance reasons), add it as a dedicated feature with proper authorization tests.

---

## 15. Quantity UI Regression

**Verified:**
- Quantity helper: "Number of procedure units"
- Unit Cost / Unit Est. Cost label
- Qty column in table
- Line Total column (gross − discount)
- Estimated Total (Gross) in ProgressSummaryCard

**For qty=5, cost=200, discount=0:** Qty=5, Unit Cost=₹200, Line Total=₹1,000, Plan Summary=₹1,000 ✅  
**For qty=5, cost=200, discount=100:** Line net = ₹900 ✅

Frontend test `multiplies estimated_cost × quantity for Plan Summary total` passes.

---

## 16. Cache / Mutation Regression

All treatment plan mutations invalidate `treatmentPlanQueryKeys.all` (→ `['treatment-plans']`), forcing a full refetch of list + detail data:

- `useAddItem` → `invalidateQueries(treatmentPlanQueryKeys.all)` ✅
- `useUpdateItem` → `invalidateQueries(treatmentPlanQueryKeys.all)` ✅
- `useRemoveItem` → `invalidateQueries(treatmentPlanQueryKeys.all)` ✅
- `useReorderItems` → `invalidateQueries(treatmentPlanQueryKeys.all)` ✅
- `useCreateVersion` → `invalidateQueries(treatmentPlanQueryKeys.all)` ✅
- `useRestoreVersion` → `invalidateQueries(treatmentPlanQueryKeys.all)` ✅

No stale totals possible. React state is not the canonical financial source.

---

## 17. Version/Snapshot Regression

**Verified via tests Q15, Q16, Q17:**
- `snapshot_current` stores `quantity` in the items_snapshot JSONB ✅
- `restore_version` reads `quantity` from snapshot (defaults to 1 if missing) ✅
- Old snapshots without `quantity` key restore with quantity=1 ✅
- Restored items go through the same validation path (CHECK constraints re-applied) ✅

---

## 18. Backend Test Results

```
============================== 560 passed, 1 skipped in 39.55s ==============================
```

- 20 quantity-specific tests (Q1–Q20): **20/20 PASS**
- 1 F1 regression test: **1/1 PASS**
- Full treatment backend suite: **560 passed, 1 skipped** (pre-existing skip, unrelated)
- 0 regressions introduced

---

## 19. Frontend Test Results

```
Test Files  7 passed (7)
     Tests  47 passed (47)
```

- Treatment Plan frontend tests: **47/47 PASS**
- Quantity-specific: `TreatmentPlanDetailsContainer.test.tsx` + `itemFormUtils.test.ts` → all pass
- Pre-existing unrelated failures exist in the broader frontend suite (billing `RecordPaymentDrawer` etc.) — NOT caused by this remediation

---

## 20. Full Treatment Regression

**Backend:** 560/560 passed (+ 1 skipped)  
**Frontend:** 47/47 passed  

Test coverage includes:
- Treatment Plan create, detail, item add/edit/remove, reorder
- Plan transitions (Draft→UnderReview→Proposed→Accepted→InProgress→Completed)
- Item transitions (Pending→InProgress→Completed)
- Approval workflow (doctor_approve, patient_acknowledge)
- Version history (create, list, restore)
- Doctor/patient filtering, search, dashboard
- RBAC per role
- Procedure catalog CRUD
- Quantity: 20 dedicated tests + F1 regression

---

## 21. Lint / TypeScript / Build

| Gate | Result |
|------|--------|
| `npx tsc -b` | ✅ Exit 0 (clean) |
| `npm run build` | ✅ Built in 1.54s |
| `npx eslint src/components/treatmentPlans/` | ⚠️ 1 pre-existing error (not quantity-related) |

The single lint error is in `TreatmentPlanListContainer.tsx:79` — `react-hooks/set-state-in-effect` for auto-opening the create drawer on deep-link. This is a pre-existing issue unrelated to the quantity feature.

---

## 22. Manual Verification

**Browser access:** Not available in this environment.

Automated tests cover the same scenarios:
- Q2: qty=5, cost=200 → gross=1000 (backend) ✅
- Q4: quantity update 1→5 → total recalculates (backend) ✅
- F1: quantity-only update with existing discount → clean validation error (backend) ✅
- Q17: restore old snapshot → quantity defaults to 1 (backend) ✅
- Frontend: `multiplies estimated_cost × quantity for Plan Summary total` ✅

Manual browser verification recommended before production deployment.

---

## 23. Corrected Prior Report Claims

The prior FreeBuff report (`Treatment-Plan-Item-Quantity-Implementation-Report.md`) contained materially inaccurate claims:

| Claim | FreeBuff Said | Truth |
|-------|--------------|-------|
| "No backend changes were needed" | Backend untouched | Commit changes service, mapper, validator, schema, model, constants, router + adds migration |
| "The bug was frontend-only" | Backend already correct | Pre-fix `_recalculate_totals()` and `to_list_item()` did NOT multiply by quantity |
| "11/11 backend tests passed" | Tests exist & pass | **No quantity backend tests existed**; suite was blocked by SQLite regex DDL |
| "Frontend 47/47 passed" | All pass | 47 only a 7-file subset; full suite had unrelated failures |

**The prior report must be treated as unreliable.** The claims above are refuted by the committed diff and actual test files.

---

## 24. Remaining Findings

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| F4 | Non-atomic commit (billing RBAC bundled) | High | Open — recommend separate commit for future changes |
| F5 | No object-level ownership on treatment routes | Medium | Decision: NOT A DEFECT (see §14) |
| F6 | Constraint name `ck_tpi_discount_le_cost` stale | Low | Tech debt — leave as-is (see §10) |
| — | Pre-existing lint error in TreatmentPlanListContainer | Low | Pre-existing, unrelated to quantity |
| — | Full frontend suite has 18 unrelated failures | Medium | Pre-existing, unrelated to quantity |
| — | Manual browser verification not performed | Low | Recommended before production deployment |

---

## 25. Production Readiness Verdict

### Quality Gates Summary

| Gate | Required | Status |
|------|----------|--------|
| Backend quantity tests exist | Yes | ✅ 21 tests (Q1–Q20 + F1) |
| Backend Treatment test suite runs | Yes | ✅ 560 passed, 1 skipped |
| 5 × ₹200 = ₹1,000 backend-tested | Yes | ✅ Q2, Q4, Q5, Q19 |
| Quantity update recalculates correctly | Yes | ✅ Q4, Q5, Q6 |
| Quantity-only update revalidates discount | Yes | ✅ F1 test |
| Invalid discount returns PlanValidationFailed | Yes | ✅ F1 test |
| Snapshot/restore quantity tests pass | Yes | ✅ Q15, Q16, Q17 |
| OpenAPI docs correct | Yes | ✅ Phase 4 fix |
| Migration graph valid | Yes | ✅ Phase 6 verified |
| Frontend treatment tests pass | Yes | ✅ 47/47 |
| TypeScript/build clean | Yes | ✅ tsc exit 0, build OK |
| No false test claims remain | Yes | ✅ §23 corrected |

### Verdict: **APPROVED for production release** with the following caveats:

1. **Manual browser verification recommended** before production deployment (Phase 15 — browser not available in this environment)
2. **F4 (scope-creep)** should be addressed in future commits by keeping changes atomic
3. **F5 (ownership)** should be revisited if multi-tenant or compliance requirements arise
4. **Pre-existing unrelated failures** in the broader frontend test suite should be addressed separately

### Files Modified

| File | Change |
|------|--------|
| `backend/tests/modules/treatment/conftest.py` | Added billing table exclusion for SQLite compatibility |
| `backend/tests/modules/treatment/test_auth_integration.py` | Added billing table exclusion for SQLite compatibility |
| `backend/tests/modules/treatment/test_mappers.py` | Added `quantity` to `_mock_item()` defaults |
| `backend/tests/modules/treatment/test_quantity.py` | **NEW** — 21 quantity tests (Q1–Q20 + F1) |
| `backend/app/modules/treatment/services/treatment_plan_service.py` | Fixed F1: discount validation on quantity/cost change |
| `backend/app/modules/treatment/schemas/treatment_plan.py` | Fixed stale discount description |

### What Was NOT Changed (by design)

- Production PostgreSQL constraints
- Quantity default (1) or bounds (1–999)
- Quantity type (remains integer)
- DB constraint names
- Migration history
- Billing module code
- Doctor ownership/RBAC semantics
- Frontend quantity UI (already correct)
