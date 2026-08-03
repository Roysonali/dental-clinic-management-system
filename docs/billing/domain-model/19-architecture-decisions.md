# Architecture Decisions — Billing Domain Model (Phase 2)

> **Document Type:** Architecture Decision Record Collection (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Architecture Decisions |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | adr/*.md, 08-domain-model.md, 11-aggregate-design.md |

---

## 1. Purpose

This document records key architecture decisions made during Phase 2 domain modeling. Each decision is documented with its context, the options considered, the chosen approach, rationale, and consequences.

---

## Decision 01: Payment Allocation Ownership

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-006 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

The PaymentAllocation entity sits at the boundary between the Invoice aggregate and the Payment aggregate. Two previous ADRs (ADR-001 and ADR-004) conflicted on where PaymentAllocation should reside:

- ADR-001 (Invoice as Aggregate Root) listed PaymentAllocation within the Invoice aggregate boundary
- ADR-004 (Payment Allocation Model) described PaymentAllocation as a separate entity owned by Payment

### Decision

PaymentAllocation is owned by the **Payment aggregate root**.

### Rationale

1. **Invariant enforcement:** The Payment aggregate must enforce that the sum of all allocations equals the payment amount (BR-62). This invariant requires PaymentAllocation to be inside the Payment aggregate boundary.
2. **Multi-invoice payments:** A single Payment can span multiple Invoices. If PaymentAllocation were inside the Invoice aggregate, recording a multi-invoice payment would require modifying multiple Invoice aggregates in one transaction — violating aggregate atomicity.
3. **Refund traceability:** Refund allocations reference the original allocation via `original_allocation_id`. This self-referencing relationship is naturally maintained within the Payment aggregate.
4. **Invoice balance derivation:** The Invoice's outstanding balance is computed by querying PaymentAllocation records (sum of allocations − sum of refunds), not by storing it. This works regardless of which aggregate owns the allocations.

### Consequences

- **Positive:** Clean aggregate boundaries; no cross-aggregate transactions for payment operations; consistent with other DDD implementations.
- **Positive:** Invoice balance is always derived, never stored — eliminating a source of inconsistency.
- **Negative:** Computing invoice outstanding balance requires a query across aggregates (read-only — acceptable).
- **Negative:** Updating payment status on invoice requires eventual consistency or a read-model refresh.
- **Update required:** ADR-001 (Invoice as Aggregate Root) must be updated to remove PaymentAllocation from its aggregate boundary.

---

## Decision 02: Receipt as Standalone Aggregate

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-007 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

Receipts are generated via an explicit API call for completed payments. They serve as formal proof of payment for patients. The question is whether a Receipt should be a child of the Payment aggregate or an independent aggregate.

### Decision

Receipt is a **standalone aggregate root**.

### Rationale

1. **Immutability:** Receipts are generated once and never modified. This is fundamentally different from the Payment aggregate, which supports reversal and refund operations.
2. **Lifecycle independence:** A Payment may be refunded (changing its state), but the original Receipt remains valid as proof of the initial payment. If Receipt were a child of Payment, refunding would affect the receipt reference.
3. **Re-printability:** Receipts must be retrievable and re-printable at any time. A standalone aggregate with its own identity (receipt number) supports this cleanly.
4. **Performance:** Standalone receipts can be cached or stored in a read-optimized form without impacting payment operations.

### Consequences

- **Positive:** Clean separation of concerns — payment operations do not affect receipt data.
- **Positive:** Receipts are independently queryable and cacheable.
- **Positive:** Refunds do not invalidate or alter existing receipts.
- **Negative:** Receipt generation requires a cross-aggregate operation (create Payment → create Receipt). Mitigated by using a domain event.

---

## Decision 03: PatientCredit as Aggregate Root

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-008 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

PatientCredit tracks positive balances owed to a patient — from overpayments, credit notes, or advance payments. It must support creation (from payment overage or credit note), consumption (applied to invoices), and expiry (credit notes). The question is where PatientCredit fits in the aggregate hierarchy.

### Decision

PatientCredit is an **independent aggregate root** within the Billing bounded context.

### Rationale

1. **Ownership:** PatientCredit is financial data that must be managed within the billing context. It is not patient demographic data.
2. **Cross-source:** A PatientCredit can originate from a PaymentAllocation (overpayment) or a CreditNote. Placing it inside either aggregate would create awkward dependencies.
3. **Lifecycle independence:** PatientCredit has its own lifecycle (create, consume, expire, refund) that is distinct from both Payment and CreditNote lifecycles.
4. **Future evolution:** In Phase 3 (Patient Wallet), PatientCredit will evolve into a more comprehensive entity with additional capabilities. An independent aggregate is easier to extend.

### Consequences

- **Positive:** Clean ownership — all credit-related logic is in one place.
- **Positive:** Independent of Payment and CreditNote lifecycles.
- **Positive:** Easy to extend for Phase 3 wallet features.
- **Negative:** Additional aggregate to manage. Must ensure eventual consistency when credits are created from payments or credit notes.
- **Trade-off:** Consider whether PatientCredit should move to the Patient Management context in Phase 3 (wallet). If so, this aggregate is transitional.

---

## Decision 04: Derived Outstanding Balance

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-009 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

The invoice outstanding balance is the central financial metric — it determines whether an invoice is paid, partially paid, or overdue. The question is whether to store this value on the Invoice or compute it on read.

### Decision

The outstanding balance is **derived (computed on read)**, never stored on the Invoice.

### Rationale

1. **Single source of truth:** Storing the balance creates a risk of inconsistency between the computed value and the stored value. Deriving it ensures accuracy.
2. **Cross-aggregate computation:** The balance depends on PaymentAllocation data (owned by Payment aggregate) and CreditNote data (owned by CreditNote aggregate). Storing it on Invoice would require cross-aggregate writes.
3. **Simplicity:** Deriving the balance avoids the complexity of maintaining a cached value that must be updated on every payment, refund, and credit note operation.
4. **Performance is acceptable:** At clinic scale, computing the balance on read (a simple aggregate query) is fast enough. If performance becomes an issue, a read-model cache can be added later.

### Consequences

- **Positive:** No data inconsistency risk — balance is always correct.
- **Positive:** No cross-aggregate write operations needed.
- **Negative:** Read queries for invoices with balance filters may require aggregation. (Mitigated by indexing on invoice_id in PaymentAllocation.)
- **Negative:** Cannot use the balance as a direct filter in database queries without a subquery or cached column. (Acceptable for MVP — consider a materialized view or cached column in Phase 2.)

---

## Decision 05: Service Layer Not Domain Services

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-010 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

The Billing module has several operations that span multiple aggregates (invoice generation from treatment plans, payment allocation, refund processing). These could be implemented as domain services (in the DDD sense) or as application-layer services.

### Decision

Multi-aggregate operations will be implemented as **application-layer services**, not DDD domain services.

### Rationale

1. **Modular Monolith architecture:** DensCare uses a Modular Monolith, not pure DDD. Application services are the standard pattern for cross-module orchestration (see existing modules).
2. **Infrastructure dependencies:** These services often need to call external modules (Treatment Plans, Users) or trigger domain events — responsibilities of the application layer, not the domain layer.
3. **Existing DensCare pattern:** All existing modules use application-layer services (service layer) for orchestration. The Treatment Plan module follows this pattern. Consistency is preferred over purity.
4. **Anemic domain model avoidance:** Domain logic that belongs to a single aggregate (e.g., status transitions, line item validation, total computation) stays in the aggregate. Only cross-aggregate orchestration lives in the service layer.

### Consequences

- **Positive:** Consistent with existing DensCare architecture.
- **Positive:** Service layer handles infrastructure concerns (external module calls, event publishing) cleanly.
- **Positive:** Domain aggregates remain focused on their own consistency and invariants.
- **Negative:** The service layer must be carefully designed to avoid becoming a "god class" — each service has a narrow, specific responsibility.
- **Documented in:** [13-domain-services.md](13-domain-services.md)

---

## Decision 06: Eventual Consistency for Cross-Aggregate Updates

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-011 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

Several billing operations require updating multiple aggregates: recording a payment (Payment aggregate) must update the invoice's status (Invoice aggregate); issuing a credit note (CreditNote aggregate) must reduce the invoice's outstanding balance (Invoice aggregate). These could be done in a distributed transaction or with eventual consistency.

### Decision

Cross-aggregate updates use **eventual consistency via domain events**, not distributed transactions.

### Rationale

1. **Modular Monolith compatibility:** Domain events are publishable within the same application (in-process) without external infrastructure. This keeps the architecture simple for the MVP.
2. **No distributed transaction overhead:** Two-phase commits or saga orchestrators are unnecessary when all aggregates are in the same application and database.
3. **Acceptable latency:** The update from "Payment Recorded" to "Invoice → Paid" happens within milliseconds (in-process event handler). For all practical purposes, this is synchronous.
4. **Resilience:** If an event handler fails, the event can be retried. The originating aggregate's data is already committed, so no data is lost.
5. **Existing DensCare pattern:** Domain events are already used in the Treatment Plan module for cross-aggregate communication.

### Consequences

- **Positive:** No distributed transaction complexity.
- **Positive:** Event handlers can be retried on failure.
- **Positive:** Consistent with existing module patterns.
- **Negative:** Readers see a temporarily stale invoice status if the event has not yet been processed. (Acceptable — the window is <100ms.)
- **Negative:** Additional infrastructure needed for event publishing and handling.

---

## Decision 07: Tax Rates as Configuration, Not Entities

| Attribute | Value |
|---|---|
| **ID** | ADR-BILL-012 |
| **Status** | Accepted |
| **Date** | 2026-07-20 |
| **Architect** | Engineering Team |

### Context

Tax rates are needed for invoice line items (Phase 2). The question is how to model them — as domain entities with lifecycle or as configuration values.

### Decision

Tax rates are modeled as **configuration values**, not domain entities with lifecycle.

### Rationale

1. **Simplicity:** Tax rates are defined by regulatory authorities, not by the clinic. They change infrequently and have simple attributes (name, rate, jurisdiction, active/inactive).
2. **No complex lifecycle:** Tax rates do not transition through states. They are created, activated, deactivated, and updated — but changes do not affect already-issued invoices (tax rate is frozen at invoice creation).
3. **Configuration is sufficient:** An admin UI for managing tax rates is sufficient. No domain behaviors or invariants beyond the basic validation rules (rate ≥ 0, rate ≤ 100, name required).
4. **Performance:** Tax rates can be cached in memory (they change rarely). No need for aggregate-level transactional protection.

### Consequences

- **Positive:** Simple to implement — no aggregate, no lifecycle management.
- **Positive:** Easy to cache for performance.
- **Positive:** Configurable via admin UI without code changes.
- **Negative:** Tax rate changes do not retroactively affect issued invoices (intentional — see BR-52).

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [adr/ADR-001-invoice-as-aggregate-root.md](../adr/ADR-001-invoice-as-aggregate-root.md) through [adr/ADR-005-discount-approval-workflow.md](../adr/ADR-005-discount-approval-workflow.md) |
| **Related** | [08-domain-model.md](08-domain-model.md), [11-aggregate-design.md](11-aggregate-design.md) |
| **Next Reading** | [diagrams/aggregate-diagram.md](diagrams/aggregate-diagram.md) |
