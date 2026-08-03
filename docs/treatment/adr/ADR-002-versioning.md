# ADR-002: Versioning Strategy

| Field | Value |
|---|---|
| **ADR ID** | ADR-002 |
| **Status** | Accepted |
| **Date** | 2026-07-13 |
| **Module** | Treatment Plan |
| **Deciders** | Engineering Team |

---

## Context

After a patient accepts a treatment plan, the agreed scope and costs become the clinical contract. If modifications are required mid-treatment (e.g., additional procedures discovered, cost adjustments), the original agreement must be preserved and the changes must be tracked as revisions — not as in-place modifications.

## Problem

How should treatment plan modifications be tracked after patient acceptance while preserving the original agreed scope and providing a complete audit trail?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: JSONB immutable snapshot** | When a post-acceptance modification occurs, serialize all current items into a JSONB column on a new version row. Subsequent edits operate on the current (now versioned) plan. | Simple implementation; complete immutability; no schema changes for new versions | JSONB cannot be directly queried via JOINs; snapshot is a data duplicate |
| **B: Separate items_snapshot table** | A dedicated table with FK to version, each row representing one item at version-creation time. One row per item per version. | Queryable; normalizable; no JSONB | Schema explosion: 50 items × 5 versions = 250 rows; complex queries for "version at time X" |
| **C: Temporal tables (SQL:2011)** | Use PostgreSQL's table inheritance or temporal extension to track row-level history automatically | Automatic; no application code | Complex setup; PostgreSQL temporal support is limited; hard to query "snapshot at version" |
| **D: Soft-delete + active flag** | Mark old items as inactive, create new items for the new version | Simple concept | Fragile; items lose their plan association; hard to reconstruct a version coherently |

## Decision

**Option A: JSONB Immutable Snapshot.**

## Rationale

- **Immutability by construction:** JSONB columns are never modified after creation. Reading a version always returns exactly what was stored at version creation time — no JOINs, no aggregation, no risk of data drift.
- **Simple query pattern:** `SELECT items_snapshot FROM treatment_plan_versions WHERE plan_id = ? AND version_number = ?` returns the complete state in a single query.
- **Storage efficiency:** A snapshot is typically 2-5 KB per version (20-50 items with tooth numbers and costs). Even at 10 versions per plan across 10,000 plans, storage is under 500 MB.
- **No schema migration:** Adding new fields to items doesn't require snapshot table migrations — the JSONB adapts automatically.
- **Proven pattern:** JSONB snapshots are a well-established pattern in financial systems for invoice versioning, contract revisions, and audit logging.

## Consequences

### Positive
- Complete immutability — version data never changes after creation
- Single-query access to historical snapshots
- Schema-agnostic — items can gain new fields without migration
- Simple code — serialize on write, deserialize on read

### Negative
- JSONB cannot be indexed for individual field queries (not needed — versions are read as complete documents)
- Data duplication between active items and snapshot (acceptable — snapshots are small and infrequent)

## Alternatives Rejected

**Option B (Separate snapshot table)** was rejected because it introduces complexity without benefit. Each version would require 20-50 rows in a snapshot_items table, making "get version X" a multi-row aggregation query. The JSONB approach provides better read performance.

**Option C (Temporal tables)** was rejected due to PostgreSQL's limited support. Application-level versioning provides more control and predictable behavior.

**Option D (Soft-delete + active flag)** was rejected because reconstructing a specific historical version would require filtering by timestamps and active flags — a fragile and error-prone approach.

## Trigger Conditions

A new version is automatically created when a modification is attempted on a plan whose status is NOT in the editable set:
- Editable statuses: `draft`, `under_review`, `proposed`
- Version-triggering statuses: `accepted`, `in_progress`, `on_hold`

## Related ADRs

- ADR-001 (Aggregate Root) — versions are owned by the TreatmentPlan aggregate
- ADR-003 (State Machine) — version creation is tied to specific status transition rules
- ADR-004 (Database Design Decisions) — JSONB column specifications
