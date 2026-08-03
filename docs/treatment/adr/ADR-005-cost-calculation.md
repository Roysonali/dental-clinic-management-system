# ADR-005: Cost Calculation Strategy

| Field | Value |
|---|---|
| **ADR ID** | ADR-005 |
| **Status** | Accepted |
| **Date** | 2026-07-13 |
| **Module** | Treatment Plan |
| **Deciders** | Engineering Team |

---

## Context

Each treatment plan item has an estimated cost and an optional discount. The total plan cost is the sum of all item costs minus their discounts. This total is frequently displayed (plan proposals, patient quotations, dashboard summaries).

## Problem

Should the total plan cost be stored as a computed column/field, or should it be calculated at query time from the individual line items?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Compute at query time** | Sum all item costs minus discounts whenever the total is needed | Always accurate; no sync issues; simple | Slightly more expensive queries; cannot sort/filter by total without computation |
| **B: Store as computed column** | Use a generated column: `total_cost = sum(item_cost - discount)` | DB maintains consistency; indexed; always up to date | PostgreSQL generated columns cannot reference other tables — would require a trigger |
| **C: Store as application field** | Calculate total in service layer on save, store in a column on the plan | Fast reads; no computation on every query | Data drift risk — if items change without recalculating total; requires synchronization logic |
| **D: Materialized view** | Create a materialized view that computes totals | Fast reads; refreshable on schedule | Stale data between refreshes; additional DB object to maintain |

## Decision

**Option A: Compute at query time.**

## Rationale

- **No data inconsistency risk:** The total is derived from source data (item costs and discounts). Storing it introduces a synchronization problem — any modification to an item's cost or discount must trigger a recalculation of the plan total. This is a classic denormalization trap.
- **Computational cost is negligible:** A typical plan has 5-20 items. Summing 20 decimal values takes microseconds. At thousands of queries per day, this is not a measurable performance concern.
- **Simpler code:** No triggers, no computed column logic, no materialized view refresh scheduling. The total is calculated in the mapper layer when building the response.

## Consequences

### Positive
- Zero data inconsistency risk
- Simpler service and repository logic
- No migration burden for future financial features

### Negative
- Slightly more expensive list queries (mitigated — paginated lists include items_count but not total_cost)
- Cannot sort plan lists by total cost without computing per-row (acceptable — sorting by total cost is not a current requirement)

## Where Computation Happens

```python
# In ItemMapper.to_response():
subtotal = (item.estimated_cost or 0) - (item.discount or 0)

# In TreatmentPlanResponse (computed at mapper layer):
items: list[ItemResponse]
# Total is NOT stored on the plan — frontend computes sum from items array
```

The individual item's `subtotal` is computed in the mapper. The plan-level total is intentionally excluded from the response schema — the frontend computes it from the items array. This reinforces the principle that total is derived, not stored.

## Alternatives Rejected

**Option B (Computed column)** was rejected because PostgreSQL's generated columns cannot reference values from related tables. A trigger-based approach would add complexity without benefit.

**Option C (Stored application field)** was rejected due to the synchronization risk. Every item CRUD operation would need to recalculate and update the plan total. A bug in any of these code paths would introduce data drift that is difficult to detect.

**Option D (Materialized view)** was rejected as over-engineering for a value that is computationally trivial and only needed for display.

## Future Considerations

If sorting/filtering by total cost becomes a requirement, a cached field can be added to the plan table with trigger-based updates. This is a safe additive change that does not require migrating existing data.

## Related ADRs

- ADR-004 (Database Design Decisions) — defines Numeric(10,2) type for cost fields
- ADR-001 (Aggregate Root) — cost computation is within the aggregate boundary
