# Normalization — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document describes the normalization decisions for the Billing module schema. It identifies which normal forms are achieved, where intentional denormalization occurs, and the reasoning behind each decision.

---

## 2. Normal Form Compliance

| Normal Form | Achieved? | Exceptions |
|---|---|---|
| 1NF (Atomic columns) | ✅ Full | — |
| 2NF (Full functional dependency) | ✅ Full | — |
| 3NF (No transitive dependencies) | ✅ Full | — |
| BCNF (Every determinant is a candidate key) | ✅ Full | — |
| 4NF (No multi-valued dependencies) | ✅ Full | — |
| 5NF (Join dependencies) | ✅ Full | — |

The Billing schema is fully normalized to 5NF in the abstract domain model. Intentional denormalizations (documented below) are for performance, not normalization necessity.

---

## 3. Intentional Denormalization

### 3.1 `invoice_line_items.net_amount`

| Aspect | Detail |
|---|---|
| **Derivation** | `(unit_price × quantity) − discount` |
| **Stored?** | Yes |
| **Rationale** | Storing the computed net amount avoids recalculation on every read and provides a snapshot of the amount at the time of invoice creation, even if reference data changes. |
| **Consistency** | Check constraint ensures `net_amount = unit_price × quantity − COALESCE(discount_value, 0)` |
| **Trade-off** | Must be kept in sync with unit_price/quantity/discount. Acceptable because: (a) line items are immutable after issuance, and (b) changes during Draft are infrequent. |

### 3.2 `credit_notes.remaining_balance`

| Aspect | Detail |
|---|---|
| **Derivation** | `amount − sum(applied allocations)` |
| **Stored?** | Yes |
| **Rationale** | Avoids recomputing applied amount from credit note allocations on every read. Phase 2 may introduce a `credit_note_applications` table; this stored column simplifies the read path until then. |
| **Consistency** | Application layer keeps in sync. MVCC reads ensure consistency within transaction. |

### 3.3 `patient_credits.remaining_amount`

| Aspect | Detail |
|---|---|
| **Derivation** | `original_amount − sum(consumed)` |
| **Stored?** | Yes |
| **Rationale** | Most queries against PatientCredit involve checking remaining balance. Storing it avoids a join/subquery on every read. |
| **Consistency** | Application layer keeps in sync. Updated atomically within the transaction that consumes credit. |

---

## 4. Normalization Decisions

| Decision | Chosen Approach | Rejected Alternative | Rationale |
|---|---|---|---|
| Payment method storage | VARCHAR column | ENUM or reference table | Extensibility — clinics may add custom methods. VARCHAR avoids schema changes. |
| Invoice status storage | VARCHAR column | ENUM | Same rationale — new statuses can be added without ALTER TYPE. |
| Discount representation | Two columns (type + value) | Separate discount table | A discount is always part of a line item. Normalizing discounts to a separate table would add joins without benefit. |
| Receipt-to-invoice relationship | Separate join table (`receipt_invoices`) | JSON array on receipts | Joins are needed for reporting and referential integrity. JSON would be unqueryable. |

---

## 5. Why Not Denormalize Further

| Proposed Denormalization | Rejected Because |
|---|---|
| Store invoice grand total on `invoices` | Derived value from line items → risk of inconsistency |
| Store outstanding balance on `invoices` | Cross-aggregate computed value → risk of inconsistency |
| Store patient name on `invoices` | Violates ownership boundary → patient name belongs to Patient Management |
| Store payment allocation invoices as JSONB | Unqueryable for reporting → violates audit requirements |

---

## 6. Normalization Summary

```
3NF Compliance Check:

invoices:
  invoice_id → (patient_id, status, invoice_date, ...)
  invoice_number → (invoice_id, ...)
  invoice_id → invoice_number [trivial]
  No transitive dependencies ✅

invoice_line_items:
  line_item_id → (invoice_id, description, quantity, ...)
  invoice_id → (invoice_date, due_date) [not transitive — different table]
  3NF ✅

payments:
  payment_id → (patient_id, total_amount, payment_date, ...)
  No transitive dependencies ✅

payment_allocations:
  allocation_id → (payment_id, invoice_id, allocated_amount)
  payment_id → (total_amount) [not transitive — different table]
  3NF ✅
```

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [11-performance-considerations.md](11-performance-considerations.md) |
| **Next** | [08-audit-and-versioning.md](08-audit-and-versioning.md) |
