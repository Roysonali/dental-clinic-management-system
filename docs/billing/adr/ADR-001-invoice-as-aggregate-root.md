# ADR-001: Invoice as Aggregate Root

| Field | Value |
|---|---|
| **ADR ID** | ADR-001 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Module** | Billing |
| **Deciders** | Engineering Team |

---

## Context

The Billing module must manage a set of closely-related entities: the invoice itself, its line items (procedures, fees, adjustments), payment allocations, receipts, and status changes. These entities have strong consistency requirements — for example, line items should never exist without a parent invoice, payment allocations must always sum to the payment amount, and the invoice grand total must always equal the sum of its line items minus discounts plus tax.

## Problem

How should these entities be structured to ensure financial data consistency, transactional integrity, and clear ownership boundaries?

## Options Considered

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A: Single aggregate (Invoice as root)** | All entities (line items, payments, allocations, receipts, status history) are owned by Invoice. Changes go through the invoice aggregate. | Strong consistency; clear ownership; simple transaction boundaries; financial integrity guaranteed | Larger aggregate size; potential performance for invoices with 50+ items |
| **B: Independent entities with loose relationships** | Each entity is independent. Invoice lines reference invoices, payments reference invoices via join table. | More flexible; can modify items independently; smaller database transactions | Weak consistency guarantees; risk of orphaned line items; partial-update anomalies possible; complex cross-entity transaction management |
| **C: Event-sourced aggregate** | All billing actions (item added, invoice issued, payment received) stored as events; current state derived by replaying events | Complete audit trail; temporal queries; immutable history | Significant complexity; steep learning curve; over-engineered for current requirements; no existing DensCare module uses this pattern |
| **D: Document store (JSONB on invoice)** | Line items stored as JSONB array directly on invoice row; payments referenced separately | Simple schema; no joins for reads | Limited queryability; no referential integrity for line items; concurrency issues; reporting becomes difficult |

## Decision

**Option A: Invoice as aggregate root.**

## Rationale

- **Consistency guarantee:** The aggregate boundary ensures that all mutations to an invoice's line items, payments, allocations, and status are executed within a single database transaction. This prevents orphaned line items, payment-to-invoice mismatches, or totals that don't sum correctly.
- **Domain alignment:** In the real world, an invoice is a single financial document — line items are entries on that document, payments are settlements against that document. The aggregate models this accurately.
- **Financial integrity:** The invoice total (subtotal − discount + tax) must always equal the sum of its line items. Only the aggregate root can enforce this invariant.
- **Existing DensCare pattern:** The Treatment Plan module (ADR-001) and Patient Records module follow the same aggregate root pattern. Consistency with the existing architecture reduces cognitive load.
- **Performance at scale:** An invoice rarely exceeds 20 line items. Loading the entire aggregate is not a performance concern at the expected clinic scale.

## Consequences

### Positive
- Strong consistency guarantees for all financial data
- Simple transaction management — one commit per invoice operation
- Cascade cleanup handled by the aggregate
- Invoice totals are always computed correctly because the aggregate controls all mutations
- Clear code organization — all invoice logic flows through a single service

### Negative
- Loading an invoice always loads all line items (potential over-fetching for listing views — mitigated by separate summary query)
- Modifying a line item requires loading the entire invoice (acceptable at expected scale)

## Aggregate Boundary

The following entities live within the Invoice aggregate boundary:

| Entity | Description | Always Loaded? |
|---|---|---|
| **Invoice** | Aggregate root — header-level data (patient, dates, totals, status) | Yes |
| **LineItem** | Individual charge entry (description, quantity, unit price, discount, tax) | Yes |
~~| **PaymentAllocation** | Association between a payment and this invoice (allocated amount) | Yes (with payments) |~~
> **⚠️ Updated by ADR-BILL-006:** PaymentAllocation is now owned by the **Payment** aggregate root, not the Invoice aggregate. See [domain-model/19-architecture-decisions.md](domain-model/19-architecture-decisions.md) (Decision 01) for the full rationale. The Invoice's outstanding balance is derived by querying PaymentAllocation records rather than from an owned entity.
| **InvoiceStatusHistory** | Audit trail of status transitions | No — loaded on demand |

Entities OUTSIDE the aggregate boundary (independent roots):

| Entity | Rationale |
|---|---|
| **Payment** | A payment can span multiple invoices (multi-invoice payment). It is a separate aggregate root. |
| **Receipt** | A receipt references one or more payments. Independent aggregate. |
| **CreditNote** | A credit note references an invoice but has its own lifecycle (expiry, application, voiding). Independent aggregate. |

## Alternatives Rejected

**Option B (Independent entities)** was rejected because it would require distributed transactions or eventual consistency to maintain referential integrity between invoices and their line items — introducing financial risk without commensurate benefit.

**Option C (Event sourcing)** was rejected as over-engineering for the MVP. The audit trail mechanism (ADR-002) provides adequate financial record-keeping without the operational complexity of event sourcing.

**Option D (JSONB document store)** was rejected because line items need to be individually queryable (by procedure code, by status) and updateable. A JSONB array makes individual item operations impractical for financial reconciliation.

## Future Considerations

If invoices grow to 100+ line items (possible in enterprise dental chains doing consolidated monthly billing), consider lazy-loading line items with a dedicated repository method. The aggregate root pattern remains, but line items are loaded on demand rather than eagerly.

## Related ADRs

- ADR-002 (Immutable Invoice After Issuance) — defines when and how the invoice aggregate becomes immutable
- ADR-003 (Sequential Numbering Strategy) — defines how invoice numbers are generated within the aggregate
- ADR-004 (Payment Allocation Model) — defines the relationship between Payment and Invoice aggregates
- **ADR-BILL-006 (Phase 2)** — resolves the PaymentAllocation ownership boundary. PaymentAllocation is owned by Payment, not Invoice. See [domain-model/19-architecture-decisions.md](domain-model/19-architecture-decisions.md).
