# Database Decision Log — Billing Module

> **Document Type:** Architecture Decision Record Collection (Phase 3)
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document records every major database architecture decision for the Billing module. Each decision is documented with its context, alternatives considered, rationale, benefits, trade-offs, and future impact.

---

## Decision DB-01: UUID Primary Keys

| Attribute | Value |
|---|---|
| **Decision** | Use UUID v4 for all primary keys |
| **Date** | 2026-07-20 |
| **Status** | Approved (Phase 2 ADR) |

### Alternatives Considered

| Option | Description |
|---|---|
| `SERIAL` / `BIGSERIAL` | Auto-increment integer keys |
| `ULID` | Time-sortable unique identifiers |
| Natural keys | Use domain identifiers (invoice_number) as PK |

### Rationale

UUIDs provide global uniqueness without a central sequence, enabling multi-branch deployments and offline-capable future clients. They prevent enumeration attacks on API endpoints (no sequential IDs). UUIDs also align with the existing DensCare architecture.

### Benefits

- Merge-friendly for multi-branch deployments
- No sequential guessing of financial record IDs
- Consistent with existing DensCare modules
- Framework-friendly (UUID type widely supported)

### Trade-offs

- Larger index size (16 bytes vs 4 bytes for INTEGER)
- Slower index insertion under high concurrency (random distribution)
- Less human-readable

### Future Impact

UUIDs support multi-branch (each branch generates IDs independently without collision) and offline-first architectures. No migration required.

---

## Decision DB-02: No Stored Invoice Totals

| Attribute | Value |
|---|---|
| **Decision** | Invoice totals (subtotal, discount total, tax total, grand total, outstanding balance) are NOT stored. They are computed on read from line items and payment allocations. |
| **Date** | 2026-07-20 |
| **Status** | Approved (Phase 2 ADR-BILL-009) |

### Alternatives Considered

| Option | Description |
|---|---|
| Store totals as cached columns | Compute on write, store for fast reads |
| Store totals + recompute on batch | Update totals on write, periodic reconciliation |

### Rationale

Storing totals creates a risk of inconsistency between the stored value and the source data. Computing on read ensures the balance is always correct. Performance at expected clinic scale (< 25,000 invoices/year) is acceptable.

### Benefits

- No data inconsistency risk
- No cross-aggregate write operations
- Single source of truth

### Trade-offs

- Balance queries require aggregation (acceptable — indexed)
- Cannot filter by outstanding balance directly in WHERE clause (use application-layer)

### Future Impact

If performance becomes a bottleneck, add a cached `outstanding_balance` column to `invoices` updated via application events or database triggers. The schema supports this addition without changes to existing columns.

---

## Decision DB-03: VARCHAR Instead of ENUM for Statuses

| Attribute | Value |
|---|---|
| **Decision** | Status columns use `VARCHAR(30)` instead of PostgreSQL `ENUM` |
| **Date** | 2026-07-20 |
| **Status** | Approved |

### Alternatives Considered

| Option | Description |
|---|---|
| PostgreSQL ENUM type | Native enum with strong typing |
| INTEGER lookup | Store integer FK to a status reference table |
| VARCHAR with CHECK constraint | String column with allowed-values check |

### Rationale

PostgreSQL ENUM types require `ALTER TYPE ... ADD VALUE` for new statuses, which blocks concurrent reads/writes. VARCHAR with CHECK constraints is more flexible — new statuses can be added by modifying the constraint (or removing it entirely if the application enforces valid transitions). CHECK constraints also provide documentation at the schema level.

### Benefits

- No ALTER TYPE blocking for new statuses
- Self-documenting in queries (human-readable)
- Consistent with VARCHAR pattern for payment methods

### Trade-offs

- No type-level enforcement (application must also validate)
- CHECK constraint changes require table scans to validate existing data (acceptable at this scale)

### Future Impact

New statuses (e.g., `PaymentPlan`, `Disputed`) can be added by modifying the CHECK constraint. No schema-level migration needed beyond the constraint change.

---

## Decision DB-04: Pessimistic Locking for Outstanding Balance Read

| Attribute | Value |
|---|---|
| **Decision** | Use `SELECT FOR UPDATE` on the invoice row when reading outstanding balance during payment allocation |
| **Date** | 2026-07-20 |
| **Status** | Approved |

### Alternatives Considered

| Option | Description |
|---|---|
| Optimistic locking with retry | Read balance, compute allocation, check version on write |
| Application-level mutex | Serialize payment operations in application code |
| No locking (allow overpayment) | Detect overpayment after the fact and create credit |

### Rationale

If two receptionists record payments for the same invoice concurrently, both could read the same outstanding balance and allocate more than available. `SELECT FOR UPDATE` prevents this race condition. Optimistic locking would cause one of the receptionists' transactions to fail and require a retry — acceptable but UX-impairing. Allowing overpayment without control conflicts with BR-63.

### Benefits

- Prevents concurrent over-allocation
- No retry logic needed for normal operation
- Simple, proven pattern

### Trade-offs

- Invoice row is locked during allocation transaction (typically <100ms — acceptable)
- Under high contention (rare in clinics), other balance reads may wait

### Future Impact

If contention becomes an issue (unlikely at clinic scale), consider moving to optimistic locking with automatic retry.

---

## Decision DB-05: Payment Method as Extensible VARCHAR

| Attribute | Value |
|---|---|
| **Decision** | Store `payment_method` as `VARCHAR(30)` without a reference table or ENUM |
| **Date** | 2026-07-20 |
| **Status** | Approved |

### Alternatives Considered

| Option | Description |
|---|---|
| ENUM | Fixed set of payment methods |
| Payment method reference table | FK to a lookup table |
| VARCHAR | Free-text method identifier |

### Rationale

The clinic accepts all payment modes and may add new ones (Mobile Money, Insurance, Wallet) without schema changes. A lookup table would require a JOIN for every payment read. VARCHAR provides flexibility with minimal overhead. The application maintains a list of valid payment methods.

### Benefits

- New payment methods require no schema changes
- No JOIN overhead for payment reads
- Simple implementation

### Trade-offs

- No database-level validation of valid methods (application layer validates)
- Inconsistent naming possible (e.g., "cash", "Cash", "CASH")

### Future Impact

If payment methods grow numerous and need metadata (fee percentages, settlement time), migrate to a `payment_methods` reference table. The VARCHAR column can remain as a display identifier.

---

## Decision DB-06: No Insurance Settlement Tables

| Attribute | Value |
|---|---|
| **Decision** | Do not model insurance settlement workflows in the current schema |
| **Date** | 2026-07-20 |
| **Status** | Approved |

### Alternatives Considered

| Option | Description |
|---|---|
| Full insurance model | Insurance policies, claims, settlements tables |
| Minimal extension points | Add nullable insurance fields for future use |

### Rationale

The clinic confirmed that patients pay the clinic directly and claim reimbursement independently. Modeling insurance settlement would add complexity without business value. The patient credit + payment method approach supports the current workflow: patient pays via their method, and later claims from their insurer.

### Benefits

- Simpler schema — no unused tables
- Faster MVP delivery
- No insurance-specific logic to maintain

### Trade-offs

- Future insurance integration requires new tables
- Cannot currently report on insurance-claimable revenue

### Future Impact

When insurance support is required, add `insurance_policies` and `insurance_claims` tables as described in 12-future-compatibility.md. The core invoice and payment schema remains unchanged.

---

## Decision DB-07: Tax Tables Exist, GST Disabled by Configuration

| Attribute | Value |
|---|---|
| **Decision** | Include `tax_rates` table and `tax_rate_id`/`tax_amount` on `invoice_line_items` from Phase 1, but enable GST through configuration (not schema changes) |
| **Date** | 2026-07-20 |
| **Status** | Approved |

### Alternatives Considered

| Option | Description |
|---|---|
| Add tax only when needed | Add tables and columns in future migration |
| Full tax from MVP | Complete tax computation in MVP |

### Rationale

Adding columns later requires a migration on the `invoice_line_items` table (which will have production data). Including the columns from the start avoids this migration. Defaulting tax to inactive means the MVP workflow ignores tax without schema pain.

### Benefits

- No migration needed when GST is enabled
- Historical data structure supports future tax calculation
- Schema is future-ready from day one

### Trade-offs

- Two extra columns on `invoice_line_items` with NULL values during no-GST period
- Extra reference table (`tax_rates`) with no active data initially

### Future Impact

When GST is enabled: populate `tax_rates` with actual rates, set `is_active = TRUE`, enable tax computation in the invoice calculation service. No schema changes required.

---

## Decision DB-08: Soft Delete Prohibition

| Attribute | Value |
|---|---|
| **Decision** | Financial records are NEVER soft-deleted. They transition to terminal statuses. |
| **Date** | 2026-07-20 |
| **Status** | Approved (Phase 2 ADR-002) |

### Alternatives Considered

| Option | Description |
|---|---|
| Soft delete (`deleted_at`, `is_deleted`) | Mark records as deleted without removing them |
| Hard delete | Permanently remove records |
| Status-based retirement | Transition to Cancelled/Void status |

### Rationale

Financial records must be retained for audit and compliance (BR-8, BR-116, BR-117). Soft delete creates a query burden — every query must filter `WHERE deleted_at IS NULL`. Status-based retirement is the standard accounting practice: cancelled invoices remain visible in reports and queries but are excluded from revenue calculations.

### Benefits

- Full audit trail — nothing is hidden
- No deleted-record filtering in queries
- Aligns with standard accounting practices
- No data loss risk

### Trade-offs

- All tables grow permanently (acceptable — financial data is low volume)
- Cannot recover "accidentally" cancelled records (by design — financial immutability)

### Future Impact

All financial records remain in the database permanently. Archival strategies may be needed for records older than the regulatory retention period (minimum 7 years).

---

## Decision DB-09: Receipt as Standalone Table

| Attribute | Value |
|---|---|
| **Decision** | `receipts` is a standalone table with its own PK, not a child of `payments` |
| **Date** | 2026-07-20 |
| **Status** | Approved (Phase 2 ADR-BILL-007) |

### Alternatives Considered

| Option | Description |
|---|---|
| Receipt as column on `payments` | Add receipt number + date to payments table |
| Receipt as child of `payments` | Receipt table with FK to payment and cascade delete |

### Rationale

Receipts are immutable proof of payment. A payment may be refunded, but the original receipt remains valid. If receipt were a child of payment, refunding could affect the receipt reference. A standalone table keeps receipt data independent of payment lifecycle changes.

### Benefits

- Receipts survive payment reversals
- Independent receipt numbering sequence
- Can cache/index receipts independently

### Trade-offs

- Receipt creation requires cross-table INSERT (acceptable — automatic and rare)
- Joining receipt to payment requires a query (indexed)

### Future Impact

Supports consolidated receipts (one receipt for multiple payments) via the `receipt_invoices` join table.

---

## Decision DB-10: Monetary Precision (NUMERIC(12,2))

| Attribute | Value |
|---|---|
| **Decision** | All monetary amounts use `NUMERIC(12,2)` — 12 digits total, 2 decimal places |
| **Date** | 2026-07-20 |
| **Status** | Approved |

### Alternatives Considered

| Option | Description |
|---|---|
| NUMERIC(10,2) | Standard for many financial systems |
| NUMERIC(12,4) | Higher precision for forex |
| BIGINT (cents) | Store amounts as integer cents |

### Rationale

12 digits allows up to $9,999,999,999.99 — sufficient for any invoice line item or payment. 2 decimal places matches standard currency precision. NUMERIC avoids floating-point rounding errors common with REAL/DOUBLE PRECISION.

### Benefits

- No floating-point rounding errors
- Sufficient for dental clinic scale
- Readable in queries (no cents conversion)

### Trade-offs

- Larger storage than INTEGER-based cents (5 bytes vs 8 bytes for BIGINT)
- Slightly slower math than INTEGER (negligible at clinic scale)

### Future Impact

If multi-currency with high-precision currencies (e.g., KWD with 3 decimal places) is needed, increase precision to NUMERIC(12,3) or use currency-specific precision stored alongside the amount.

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | All documents (01–13) |
| **Related** | [domain-model/19-architecture-decisions.md](../domain-model/19-architecture-decisions.md) |
| **Next** | [diagrams/logical-er-diagram.md](diagrams/logical-er-diagram.md) |
