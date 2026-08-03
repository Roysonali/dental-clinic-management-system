# Aggregate Design — Billing Module

> **Document Type:** Aggregate Architecture Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Aggregate Design |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 08-domain-model.md, 09-domain-entities.md, 10-value-objects.md, 12-entity-relationships.md |

---

## 1. Purpose

This document defines the aggregate boundaries within the Billing domain. Aggregates are transactional consistency boundaries — all changes to entities within an aggregate are committed atomically. This document describes each aggregate's root, members, transaction boundary, consistency rules, and cross-aggregate references.

---

## 2. Aggregate Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    Billing Domain Aggregates                     │
│                                                                  │
│  ┌──────────────────┐          ┌──────────────────┐              │
│  │    Invoice        │          │    Payment        │              │
│  │                   │◄────────►│                   │              │
│  │  Root: Invoice    │  Alloc   │  Root: Payment    │              │
│  │  LineItem (child) │──────────│  PaymentAlloc     │              │
│  │  StatusHistory    │          │  (child)          │              │
│  │  (child)          │          │                   │              │
│  └──────────────────┘          └──────────────────┘              │
│         ↕                               ↕                        │
│  ┌──────────────────┐          ┌──────────────────┐              │
│  │    Receipt        │          │  CreditNote       │              │
│  │                   │          │                   │              │
│  │  Root: Receipt    │          │  Root: CreditNote │              │
│  │  (read-only)      │          │  (Phase 2)        │              │
│  └──────────────────┘          └──────────────────┘              │
│                                                                  │
│  ┌──────────────────┐          ┌──────────────────┐              │
│  │  PatientCredit    │          │  DocumentSequence │              │
│  │                   │          │                   │              │
│  │  Root: PatientCredit│        │  Root: BillingDoc │              │
│  │  (Phase 1/3)     │          │  Sequence (util)  │              │
│  └──────────────────┘          └──────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Aggregate Definitions

### 3.1 Invoice Aggregate

| Attribute | Value |
|---|---|
| **Aggregate Root** | Invoice |
| **Members** | LineItem, InvoiceStatusHistory |
| **Transaction Boundary** | All mutations to an Invoice's line items and status history must occur within a single database transaction |
| **Consistency Rules** | Line items sum must equal computed totals; status transitions must be valid; cannot have zero line items |
| **Cross-Aggregate References** | References Patient (by ID), TreatmentPlan (by ID), Doctor (by ID), Appointment (by ID) |

**Members Detail:**

| Member | Type | Cardinality | Load Strategy |
|---|---|---|---|
| Invoice | Entity (root) | 1 | Always loaded with aggregate |
| LineItem | Child entity | 0..N | Eagerly loaded with aggregate |
| InvoiceStatusHistory | Child entity | 0..N | Lazy-loaded on demand |

**Consistency Enforcement:**

| Invariant | Enforced At | Enforcement Mechanism |
|---|---|---|
| At least one line item | Issue transition | Aggregate root validates before allowing Issued status |
| Totals computed correctly | Every mutation | Line items always accessed through aggregate root; totals recomputed |
| No invalid status transitions | Status change | State machine validation in aggregate root method |
| Line items sum to invoice | Every mutation | Subtotal, discount total, tax total, grand total always derived |

**Design Notes:**

- PaymentAllocation is deliberately excluded from the Invoice aggregate. It belongs to the Payment aggregate to support multi-invoice payments without cross-aggregate transactions. The Invoice's outstanding balance is derived by querying PaymentAllocation records.
- Line items are loaded eagerly because they are always needed when working with an invoice. The expected maximum of 20-30 line items per invoice makes eager loading acceptable.
- StatusHistory is loaded lazily because it is needed only for audit display, not for business logic.

---

### 3.2 Payment Aggregate

| Attribute | Value |
|---|---|
| **Aggregate Root** | Payment |
| **Members** | PaymentAllocation |
| **Transaction Boundary** | Payment creation, allocation, and reversal must occur within a single transaction |
| **Consistency Rules** | Sum of allocations must equal payment amount; each allocation cannot exceed the referenced invoice's outstanding balance |
| **Cross-Aggregate References** | References Patient (by ID), Invoice (by ID via allocation) |

**Members Detail:**

| Member | Type | Cardinality | Load Strategy |
|---|---|---|---|
| Payment | Entity (root) | 1 | Always loaded |
| PaymentAllocation | Child entity | 1..N | Eagerly loaded (needed for balance validation) |

**Consistency Enforcement:**

| Invariant | Enforced At | Enforcement Mechanism |
|---|---|---|
| Allocations sum to payment total | Payment creation | Aggregate root sums allocations and validates |
| Allocation ≤ invoice outstanding balance | Payment creation | Validated before commit (read from Invoice aggregate ID) |
| Reversal restores invoice balance | Reversal | Reversal allocation created with is_refund flag |

---

### 3.3 Receipt Aggregate

| Attribute | Value |
|---|---|
| **Aggregate Root** | Receipt |
| **Members** | None (single entity aggregate) |
| **Transaction Boundary** | Receipt creation (automatic with payment) |
| **Consistency Rules** | Must reference at least one payment; receipt data is immutable |
| **Cross-Aggregate References** | References Payment (by ID), Invoice (by ID) |

**Design Notes:**

- Receipt is a single-entity aggregate. It is created once and never modified.
- Receipt creation is triggered by a domain event (PaymentRecorded). It can be retried if the initial creation fails.

---

### 3.4 CreditNote Aggregate (Phase 2)

| Attribute | Value |
|---|---|
| **Aggregate Root** | CreditNote |
| **Members** | None (single entity aggregate) |
| **Transaction Boundary** | Credit note creation, issuance, and application |
| **Consistency Rules** | Amount cannot exceed referenced invoice grand total; cannot be modified after issuance; expiry enforcement |
| **Cross-Aggregate References** | References Invoice (by ID) |

**Design Notes:**

- CreditNote is a single-entity aggregate in Phase 2. Future enhancements may add CreditNoteAllocation as a child entity if split-application across multiple invoices is needed.
- The CreditNote references an Invoice by ID but does not own it. Applying a credit note updates the Invoice's outstanding balance (cross-aggregate operation).

---

### 3.5 PatientCredit Aggregate

| Attribute | Value |
|---|---|
| **Aggregate Root** | PatientCredit |
| **Members** | None (single entity aggregate) |
| **Transaction Boundary** | Credit creation and consumption |
| **Consistency Rules** | Balance cannot go negative; credit cannot be applied after expiry (if applicable) |
| **Cross-Aggregate References** | References Patient (by ID), optionally PaymentAllocation or CreditNote |

**Design Notes:**

- PatientCredit is lightweight in Phase 1 (only overpayment tracking). It may be absorbed into a Patient Wallet aggregate in Phase 3.
- Credit balance is computed rather than stored to prevent inconsistency between the credit record and its originating events.

---

### 3.6 DocumentSequence Aggregate

| Attribute | Value |
|---|---|
| **Aggregate Root** | DocumentSequence |
| **Members** | SequenceConsumptionLog |
| **Transaction Boundary** | Number reservation |
| **Consistency Rules** | Each number is consumed exactly once; sequence is monotonically increasing |
| **Cross-Aggregate References** | None (utility aggregate) |

**Design Notes:**

- DocumentSequence is a supporting aggregate, not a core domain aggregate. It exists to ensure gapless numbering.
- Number reservation uses row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions.
- Consumed numbers are recorded in SequenceConsumptionLog for auditability, even if the subsequent document creation fails.

---

## 4. Aggregate Comparison

| Feature | Invoice | Payment | Receipt | CreditNote | PatientCredit | DocumentSeq |
|---|---|---|---|---|---|---|
| **Aggregate Root** | Invoice | Payment | Receipt | CreditNote | PatientCredit | DocumentSeq |
| **Child Entities** | LineItem, StatusHistory | PaymentAllocation | None | None | None | ConsumptionLog |
| **Value Objects** | Money, InvoiceNumber, Discount, InvoiceStatus | Money, PaymentMethod, PaymentStatus | Money, InvoiceNumber | Money, CreditNoteStatus | Money | N/A |
| **Transaction Boundary** | Per invoice operation | Per payment operation | One-time create | Per credit note operation | Per credit operation | Per number reservation |
| **Lazy Load** | StatusHistory | None | N/A | N/A | N/A | ConsumptionLog |
| **Cross-Aggregate Ref** | Patient, TreatmentPlan | Patient, Invoice | Payment, Invoice | Invoice | Patient | None |

---

## 5. Aggregate Interaction Rules

| Rule | Description |
|---|---|
| **Identity-based references** | Aggregates reference each other by ID only. They never hold object references to entities in other aggregates. |
| **Eventual consistency** | Cross-aggregate updates (e.g., updating invoice balance after payment) use domain events or a saga, not distributed transactions. |
| **Read-only queries** | Cross-aggregate queries (e.g., "get invoice with payment history") use application-level joins or read models, not aggregate traversals. |
| **Ownership** | An entity belongs to exactly one aggregate. LineItem belongs to Invoice. PaymentAllocation belongs to Payment. |
| **Single aggregate per transaction** | A transaction should modify only one aggregate. If multiple aggregates need updating, use domain events for eventual consistency. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [09-domain-entities.md](09-domain-entities.md) |
| **Related** | [12-entity-relationships.md](12-entity-relationships.md), [13-domain-services.md](13-domain-services.md) |
| **Next Reading** | [12-entity-relationships.md](12-entity-relationships.md) |
