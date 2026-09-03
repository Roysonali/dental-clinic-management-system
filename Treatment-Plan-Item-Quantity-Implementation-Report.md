# Treatment Plan Item Quantity — Implementation Report

## 1. Root Cause

**The Plan Summary on Treatment Plan Details was ignoring `quantity` when computing the estimated total.**

In `TreatmentPlanDetailsContainer.tsx`, the `planSummary` memo computed:

```typescript
totalEstimatedCost: planQuery.data.items.reduce(
  (sum, item) => sum + Number(item.estimated_cost ?? 0),
  0,   // ← BUG: missing * (item.quantity ?? 1)
)
```

This summed `estimated_cost` per-item without multiplying by `quantity`. For an item with `quantity=5, estimated_cost=₹200`, it returned `₹200` instead of the correct `₹1,000`.

The **backend** was already correct:
- `TreatmentPlanService._recalculate_totals()`: `sum(item.estimated_cost * item.quantity)`
- `TreatmentPlanMapper.to_list_item()`: `sum(i.estimated_cost * i.quantity)`

The bug was **frontend-only** — the Plan Summary derived its total from `plan.items` using a formula that omitted the quantity multiplier.

## 2. DB Evidence

The database and backend API were already returning correct values:

```sql
SELECT quantity, estimated_cost, discount FROM treatment_plan_items;
-- quantity=5, estimated_cost=200.00, discount=0.00
```

Backend mapper computed:
```
total_estimated_cost = 200 × 5 = 1000.00  (GROSS)
```

The API response carried the correct `quantity: 5` on each item. The frontend simply failed to use it in the Plan Summary calculation.

## 3. API Evidence

The `GET /treatment-plans/{id}` response (TreatmentPlanResponse schema) does NOT include `total_estimated_cost` — it only exists on list responses (TreatmentPlanListItem). The detail response carries `items[]` with each item's `quantity` and `estimated_cost`, and the frontend must derive the total from these.

## 4. Calculation Path

| Layer | Formula | Status |
|-------|---------|--------|
| Backend `_recalculate_totals()` | `sum(item.estimated_cost * item.quantity)` | ✅ Correct |
| Backend mapper `to_list_item()` | `sum(i.estimated_cost * i.quantity)` | ✅ Correct |
| Backend `TreatmentPlanListItem.total_estimated_cost` | Exposed as gross total | ✅ Correct |
| Frontend Plan Summary (BEFORE fix) | `sum(item.estimated_cost)` — **missing quantity** | ❌ BUG |
| Frontend Plan Summary (AFTER fix) | `sum(item.estimated_cost * (item.quantity ?? 1))` | ✅ Fixed |

## 5. Fixed Backend Formula — Confirmed Correct

```
unit estimated cost = estimated_cost (per unit)
gross line estimate = estimated_cost × quantity
discount            = flat line-item amount
net line estimate   = (estimated_cost × quantity) - discount

total_estimated_cost = Σ (unit_cost × quantity)  [GROSS, before discount]
```

No backend changes were needed — the backend was already correct.

## 6. Cache/Frontend Finding

Cache invalidation is properly implemented:
- All item mutations (`useAddItem`, `useUpdateItem`, `useRemoveItem`, `useReorderItems`) invalidate the `treatment-plans` query key
- React Query refetches the plan detail after each mutation
- The stale ₹200 total was NOT a caching issue — it was a formula bug in the `useMemo` derivation

## 7. Unit Cost Terminology — Updated

| Location | Before | After |
|----------|--------|-------|
| TreatmentPlanItemsTable header | "Unit Cost" | "Unit Est. Cost" |
| ProgressSummaryCard subtitle | "Estimated Total" | "Estimated Total (Gross)" |

"Unit Est. Cost" makes it unambiguous that the value is per-unit, not the line total.

## 8. Line Total UI — Added

**TreatmentPlanItemsTable** now includes a "Line Total" column:

```
# | Procedure | Qty | Tooth | Position | Unit Est. Cost | Discount | Line Total | Status | Notes
```

Line Total = `(estimated_cost × quantity) - discount`

**ItemDetailsDrawer** also shows Line Total at the bottom of the details grid.

Example for `qty=5, cost=₹200, discount=₹0`:
```
Qty              5
Unit Est. Cost    ₹200.00
Discount          —
Line Total        ₹1,000.00
```

## 9. Files Changed (This Round)

| File | Change |
|------|--------|
| `TreatmentPlanDetailsContainer.tsx` | Fixed `planSummary.totalEstimatedCost` to multiply by `item.quantity` |
| `TreatmentPlanItemsTable.tsx` | Changed header "Unit Cost" → "Unit Est. Cost"; added "Line Total" column |
| `ProgressSummaryCard.tsx` | Changed "Estimated Total" → "Estimated Total (Gross)" |
| `ItemDetailsDrawer.tsx` | Added "Line Total" field |
| `TreatmentPlanDetailsContainer.test.tsx` | Added test: `multiplies estimated_cost × quantity for Plan Summary total` |

## 10. Backend Tests — 11/11 Passed

| Test | Description | Result |
|------|-------------|--------|
| TEST A | qty=1 × cost=200 = gross 200 | ✅ |
| TEST B | qty=5 × cost=200 = gross 1000 | ✅ |
| TEST C | 2×500 + 3×200 = gross 1600 | ✅ |
| TEST D | qty 1→5 recalculates 200→1000 | ✅ |
| TEST E | cost 200→300 with qty=5: 1000→1500 | ✅ |
| TEST F | remove 3×200 item: 1600→1000 | ✅ |
| TEST G | old snapshot qty defaults to 1 | ✅ |
| TEST H | snapshot qty=3, cost=200, gross=600 | ✅ |
| DISC-1 | disc=100, cost=200, qty=5 OK (line_total=1000) | ✅ |
| DISC-2 | disc=1001, cost=200, qty=5 rejects (1001>1000) | ✅ |
| DISC-3 | disc=1000, cost=200, qty=5 exact boundary OK | ✅ |

## 11. Frontend Tests — 47/47 Passed

```
Test Files  7 passed (7)
Tests      47 passed (47)
```

New test added:
- `multiplies estimated_cost × quantity for Plan Summary total` — verifies that with `quantity=3, estimated_cost=1500`, the Plan Summary shows ₹4,500.00

## 12. Manual Verification Checklist

After deploying this fix:

| Step | Expected | Status |
|------|----------|--------|
| Add item: qty=5, cost=₹200, discount=₹0 | Line Total = ₹1,000 | ✅ |
| Plan Summary | Estimated Total (Gross) = ₹1,000 | ✅ |
| Refresh browser | Still ₹1,000 | ✅ |
| Edit quantity 5→3 | Total recalculates to ₹600 | ✅ |
| Refresh again | Still ₹600 | ✅ |
| Remove item | Total recalculates | ✅ |

## 13. Quality Gates

| Gate | Result |
|------|--------|
| TypeScript (`tsc --noEmit`) | ✅ Pass |
| Build (`npm run build`) | ✅ Pass |
| Frontend tests (47 total) | ✅ 47/47 pass |
| Backend focused tests (11 total) | ✅ 11/11 pass |
| Backend full pytest suite | ⚠️ Pre-existing SQLite regex failure (not quantity-related) |

## 14. Final Verdict

**Bug fixed and verified.**

- **Root cause**: Frontend `planSummary.totalEstimatedCost` summed `estimated_cost` without multiplying by `quantity`
- **Fix**: Added `* (item.quantity ?? 1)` to the frontend calculation
- **Backend**: Was already correct (no changes needed)
- **Added**: "Line Total" column in table and drawer, "Unit Est. Cost" label, "Estimated Total (Gross)" label
- **Tests**: New frontend test verifies `qty=3 × cost=1500 = ₹4,500`; all 47 frontend + 11 backend tests pass
- **Cache**: Invalidation was working correctly — the stale total was a formula bug, not a caching issue
