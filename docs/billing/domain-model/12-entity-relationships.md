# Entity Relationships — Billing Module

> **Document Type:** Entity Relationship Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Entity Relationships |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 09-domain-entities.md, 11-aggregate-design.md, 18-er-diagram.md |

---

## 1. Purpose

This document defines the relationships between domain entities in the Billing module — how they reference each other, the cardinality of those references, and the ownership boundaries. It distinguishes between composition (owned) relationships and reference (not owned) relationships.

---

## 2. Relationship Legend

| Symbol | Meaning |
|---|---|
| ──◆ | Composition (child owned by parent) |
| ──◇ | Aggregation (reference, not owned) |
| ──→ | Directed reference (A references B) |
| 1 | One |
| * | Many (zero or more) |
| 0..1 | Optional one |

---

## 3. Entity Relationship Map

```
Patient ──1───────────── Invoice
  │                      │    │
  │                      │    └──*── LineItem
  │                      │
  │                      └──*── InvoiceStatusHistory
  │
  ├──1────────────── Payment
  │                     │
  │                     └──*── PaymentAllocation ──1── Invoice
  │                                              │
  │                                              └──0..1 (refund)
  │
  ├──1───────────── Receipt ──*── Payment
  │                                  │
  │                                  └──*── Invoice
  │
  ├──1───────────── CreditNote ──1── Invoice
  │
  └──1───────────── PatientCredit ──0..1── PaymentAllocation
                                                │
                                                └──0..1── CreditNote


  TreatmentPlan ──0..1── Invoice (via treatment_plan_id)
  Doctor ────────0..1── Invoice (via doctor_id)
  Appointment ───0..1── Invoice (via appointment_id)
  User ──────────1── Invoice (created_by, updated_by)
  User ──────────1── Payment (created_by)
```

---

## 4. Relationship Details

### 4.1 Invoice Relationships

| Entity | Relationship | Cardinality | Type | Description |
|---|---|---|---|---|
| Patient | Invoice → Patient | Many-to-One | Reference (unowned) | Every invoice references a patient. A patient can have many invoices. |
| LineItem | Invoice → LineItem | One-to-Many | Composition (owned) | Invoice owns its line items. Line items are deleted when the invoice is cancelled/voided (logical deletion only). |
| InvoiceStatusHistory | Invoice → StatusHistory | One-to-Many | Composition (owned) | Invoice owns its status change history. |
| TreatmentPlan | Invoice → TreatmentPlan | Many-to-One | Reference (unowned) | Optional reference to the treatment plan that sourced this invoice. |
| Doctor | Invoice → Doctor | Many-to-One | Reference (unowned) | Optional reference to the treating doctor. |
| Appointment | Invoice → Appointment | One-to-One | Reference (unowned) | Optional reference to the appointment. |
| PaymentAllocation | Invoice ← PaymentAllocation | One-to-Many | Reference (inverse) | PaymentAllocations reference the invoice. The invoice does not own them. |
| CreditNote | Invoice ← CreditNote | One-to-Many | Reference (inverse) | CreditNotes reference the invoice being corrected. |
| User | Invoice → User | Many-to-One | Reference (unowned) | Created by and last updated by user. |

### 4.2 Payment Relationships

| Entity | Relationship | Cardinality | Type | Description |
|---|---|---|---|---|
| Patient | Payment → Patient | Many-to-One | Reference (unowned) | Payment belongs to a patient. |
| PaymentAllocation | Payment → Allocation | One-to-Many | Composition (owned) | Payment owns its allocations. |
| Receipt | Payment ← Receipt | One-to-One | Reference (inverse) | Receipt references the payment. |
| User | Payment → User | Many-to-One | Reference (unowned) | Created by user. |

### 4.3 PaymentAllocation Relationships

| Entity | Relationship | Cardinality | Type | Description |
|---|---|---|---|---|
| Payment | Allocation → Payment | Many-to-One | Composition (owned) | Belongs to a payment. |
| Invoice | Allocation → Invoice | Many-to-One | Reference (unowned) | Allocated to an invoice. |
| PaymentAllocation (self) | Allocation → OriginalAllocation | Many-to-One | Reference (self) | Refund allocation references the original allocation it reverses. |

### 4.4 Receipt Relationships

| Entity | Relationship | Cardinality | Type | Description |
|---|---|---|---|---|
| Payment | Receipt → Payment | Many-to-One | Reference (unowned) | Receipt references the payment. |
| Invoice | Receipt → Invoice | Many-to-Many | Reference (unowned) | Receipt references one or more invoices. |

### 4.5 CreditNote Relationships

| Entity | Relationship | Cardinality | Type | Description |
|---|---|---|---|---|
| Invoice | CreditNote → Invoice | Many-to-One | Reference (unowned) | Credit note references the corrected invoice. |
| Patient | CreditNote → Patient | Many-to-One | Reference (unowned) | Credit note belongs to a patient. |

### 4.6 PatientCredit Relationships

| Entity | Relationship | Cardinality | Type | Description |
|---|---|---|---|---|
| Patient | PatientCredit → Patient | Many-to-One | Reference (unowned) | Credit belongs to a patient. |
| PaymentAllocation | PatientCredit → Allocation | One-to-One | Reference (unowned) | Optional origin (overpayment). |
| CreditNote | PatientCredit → CreditNote | One-to-One | Reference (unowned) | Optional origin (credit note). |

---

## 5. Ownership Summary

| Entity | Owned By | Owning Aggregate | Owns Entities | Reference Only |
|---|---|---|---|---|
| Invoice | — | Invoice (root) | LineItem, StatusHistory | Patient, TreatmentPlan, Doctor, Appointment |
| LineItem | Invoice | Invoice | — | TreatmentPlanItem (if sourced) |
| Payment | — | Payment (root) | PaymentAllocation | Patient |
| PaymentAllocation | Payment | Payment | — | Invoice |
| Receipt | — | Receipt (root) | — | Payment, Invoice |
| CreditNote | — | CreditNote (root) | — | Invoice, Patient |
| PatientCredit | — | PatientCredit (root) | — | Patient |
| InvoiceStatusHistory | Invoice | Invoice | — | — |

---

## 6. Referential Integrity Rules

| Rule | Description |
|---|---|
| **No orphaned children** | A child entity (LineItem, PaymentAllocation) must always have a parent aggregate root. Cascade delete is logical only (soft-delete for audit). |
| **Identity-only references** | Cross-aggregate references are by ID only. No foreign key enforcement from owned entities to entities in other aggregates (enforced at the application layer). |
| **Patient references required** | Invoice, Payment, CreditNote, PatientCredit all require a valid patient reference. No financial record can exist without a patient. |
| **Invoice balance is derived** | The invoice's outstanding balance is not stored. It is computed as: grand_total − sum(payment_allocations) + sum(refunds). This ensures consistency even if allocation records change. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [11-aggregate-design.md](11-aggregate-design.md) |
| **Related** | [18-er-diagram.md](18-er-diagram.md), [diagrams/entity-relationship.md](diagrams/entity-relationship.md) |
| **Next Reading** | [13-domain-services.md](13-domain-services.md) |
