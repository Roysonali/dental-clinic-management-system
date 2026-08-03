# Indexing Strategy — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document defines the indexing strategy for the Billing module. Indexes are designed to support the most frequent and performance-critical query patterns while minimizing write overhead on insert-heavy tables.

---

## 2. Index Design Principles

| Principle | Application |
|---|---|
| **Query-driven** | Indexes are designed for known query patterns, not created speculatively |
| **Composite where needed** | Multi-column indexes for queries with multiple filters |
| **Partial indexes for status** | Queries frequently filter by status (e.g., "active" = Issued/PartiallyPaid/Overdue) |
| **Covering indexes for reports** | Include commonly selected columns to avoid table lookups |
| **Minimal on insert-heavy** | Payment allocations and status history are append-heavy — minimize non-clustered indexes |
| **Descending for recent-first** | Timestamp indexes DESC for "most recent first" queries |

---

## 3. Index Specifications

### 3.1 `invoices` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_invoices_patient_id` | `patient_id` | B-tree | No | Find invoices by patient |
| `idx_invoices_status` | `status` | B-tree (partial) | No | Filter active/overdue invoices |
| `idx_invoices_invoice_date` | `invoice_date` | B-tree DESC | No | Date-range queries, recent-first |
| `idx_invoices_due_date_status` | `due_date`, `status` | B-tree (composite) | No | Overdue detection query |
| `idx_invoices_treatment_plan` | `treatment_plan_id` | B-tree | No | Find invoices by plan (partial index, WHERE NOT NULL) |

**Partial index for active invoice check (BR-121):**
```
CREATE UNIQUE INDEX uq_invoices_active_plan
ON invoices (treatment_plan_id)
WHERE status NOT IN ('cancelled', 'void')
  AND treatment_plan_id IS NOT NULL;
```
Enforces at most one non-terminal invoice per treatment plan.

### 3.2 `invoice_line_items` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_line_items_invoice` | `invoice_id` | B-tree | No | Load all items for an invoice (primary access path) |

### 3.3 `invoice_status_history` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_status_history_invoice` | `invoice_id`, `changed_at` | B-tree (composite DESC) | No | Chronological audit trail by invoice |

### 3.4 `payments` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_payments_patient_id` | `patient_id` | B-tree | No | Find payments by patient |
| `idx_payments_payment_date` | `payment_date` | B-tree DESC | No | Date-range queries |
| `idx_payments_method` | `payment_method` | B-tree | No | Filter by payment method |
| `idx_payments_reference` | `reference_number` | B-tree | No | Lookup by gateway transaction ID |

### 3.5 `payment_allocations` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_allocations_payment` | `payment_id` | B-tree | No | Load all allocations for a payment |
| `idx_allocations_invoice` | `invoice_id` | B-tree | No | Compute outstanding balance for an invoice |
| `idx_allocations_invoice_refund` | `invoice_id`, `is_refund` | B-tree (partial) | No | Balance computation filtering refunds |

### 3.6 `receipts` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_receipts_payment` | `payment_id` | B-tree | No | Find receipt by payment |
| `idx_receipts_date` | `receipt_date` | B-tree DESC | No | Recent receipts query |

### 3.7 `credit_notes` Table (Phase 2)

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_credit_notes_invoice` | `invoice_id` | B-tree | No | Find credit notes by invoice |
| `idx_credit_notes_patient` | `patient_id` | B-tree | No | Find credit notes by patient |
| `idx_credit_notes_status_expiry` | `status`, `expiry_date` | B-tree | No | Expiry detection query |

### 3.8 `patient_credits` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_patient_credits_patient` | `patient_id` | B-tree | No | Find credits by patient |

### 3.9 `sequence_consumption_log` Table

| Index Name | Columns | Type | Unique | Purpose |
|---|---|---|---|---|
| `idx_consumption_document_type` | `document_type`, `number_assigned` | B-tree (composite DESC) | No | Audit of consumed numbers |
| `idx_consumption_document_id` | `document_id` | B-tree | No | Lookup by created document |

---

## 4. Partial Indexes Summary

| Index | Condition | Purpose |
|---|---|---|
| `uq_invoices_active_plan` | `status NOT IN ('cancelled', 'void') AND treatment_plan_id IS NOT NULL` | Enforce BR-121 |
| `idx_allocations_invoice_refund` | `is_refund = FALSE` | Balance computation |

---

## 5. Query Patterns and Index Coverage

| Query Pattern | Index Used | Expected Frequency |
|---|---|---|
| Load invoice with line items | PK on `invoices`, `idx_line_items_invoice` | Very high (every invoice operation) |
| Find invoices by patient | `idx_invoices_patient_id` | High (patient search) |
| Find overdue invoices | `idx_invoices_due_date_status` | Scheduled (daily) |
| Compute outstanding balance | `idx_allocations_invoice` (aggregate) | High (every invoice view) |
| Record payment allocation | PK on `payments`, `idx_allocations_payment` | High (every payment) |
| Generate next document number | PK on `document_sequences` | High (every document creation) |
| Audit trail by invoice | `idx_status_history_invoice` | Medium (invoice detail view) |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [11-performance-considerations.md](11-performance-considerations.md) |
| **Next** | [07-normalization.md](07-normalization.md) |
