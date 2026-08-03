# ADR-001: TreatmentPlan as Aggregate Root

| Field | Value |
|---|---|
| **ADR ID** | ADR-001 |
| **Status** | Accepted |
| **Date** | 2026-07-13 |
| **Module** | Treatment Plan |
| **Deciders** | Engineering Team |

---

## Context

The Treatment Plan module must manage a set of closely-related entities: the plan itself, its line items (procedures), version snapshots, and approval/acknowledgment records. These entities have strong consistency requirements — for example, items should never exist without a parent plan, and version snapshots must capture a consistent view of all items at a point in time.

## Problem

How should these entities be structured to ensure data consistency, transactional integrity, and clear ownership boundaries?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Single aggregate (TreatmentPlan as root)** | All entities (items, versions, approval) are owned by TreatmentPlan. Changes go through the plan. | Strong consistency; clear ownership; simple transaction boundaries | Larger aggregate; potential performance concern for very large plans |
| **B: Independent entities** | Each entity is independent with loose relationships. Items reference plans, versions reference plans, etc. | More flexible; can modify items independently | Weak consistency guarantees; complex cross-entity transactions; orphaned data risk |
| **C: Event-sourced aggregate** | All changes are stored as an event stream; current state is derived by replaying events | Full audit trail; temporal queries; no data loss | Significant complexity; steep learning curve; over-engineered for current requirements |
| **D: Document store (JSONB on plan)** | Items and versions stored as JSONB arrays directly on the plan row | Simple schema; no joins for reads | Limited queryability; no referential integrity; difficult to index; concurrency issues |

## Decision

**Option A: TreatmentPlan as aggregate root.**

## Rationale

- **Consistency guarantee:** The aggregate boundary ensures that all mutations to a plan's items, versions, and approval are executed within a single database transaction. This prevents orphaned items or version/plan mismatches.
- **Domain alignment:** In the real world, a treatment plan is a single document — items are lines on that document, versions are copies of that document. The aggregate models this accurately.
- **Existing pattern:** The Patient Records module follows the same pattern (PatientRecord as aggregate root owning diagnoses, prescriptions, attachments). Consistency with the existing architecture reduces cognitive load.
- **Performance at scale:** A treatment plan rarely exceeds 50 items (most are 5-15). Loading the entire aggregate is not a performance concern at the expected scale.

## Consequences

### Positive
- Strong consistency guarantees for all plan-related data
- Simple transaction management — one commit per operation
- Child entity cleanup via cascade deletes
- Clear code organization — all plan logic flows through a single service

### Negative
- Loading a plan always loads all items (potential over-fetching for listing endpoints — mitigated by separate list view)
- Reordering items requires loading all items (acceptable at expected scale)

## Alternatives Rejected

**Option B (Independent entities)** was rejected because it would require distributed transactions or eventual consistency to maintain referential integrity between plans and their items — introducing complexity without commensurate benefit.

**Option C (Event sourcing)** was rejected as over-engineering for the MVP. The versioning mechanism (ADR-002) provides an adequate audit trail without the operational complexity of event sourcing.

**Option D (JSONB document store)** was rejected because items need to be individually queryable (by status, by procedure, by tooth number) and updateable. A JSONB array makes individual item operations impractical.

## Future Considerations

If treatment plans grow to hundreds of items (unlikely in dental context), the aggregate could be split by introducing a "PlanSection" entity for grouping related items, with the aggregate root still owning the sections.

## Related ADRs

- ADR-002 (Versioning Strategy) — defines how version snapshots are created
- ADR-004 (Database Design Decisions) — defines FK relationships and cascade rules
