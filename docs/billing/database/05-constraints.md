# Constraints — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document defines all constraints applied to the Billing module tables — primary keys (covered in 04), unique constraints, check constraints, exclusion constraints, and business-rule enforcement at the database level.

---

## 2. Constraint Philosophy: Defense in Depth

### Why Constraints at Both Layers?

Financial data integrity is too important to rely on a single enforcement layer. The Billing module enforces constraints at **both the application layer and the database layer**, following a defense-in-depth strategy.

### Application Layer (Repository + Service)

The application layer is the **primary** enforcement point:

| Constraint Type | Enforced By | Why at This Layer |
|---|---|---|
| Business rules (e.g., "discount cannot exceed subtotal") | Service layer | Business rules involve complex logic (cross-entity validation, state machine checks) that is impractical in database constraints. |
| Status transitions | Service layer + State machine | State machines are best expressed in application code with clear guard conditions and transition actions. |
| Cross-aggregate rules (e.g., BR-121: one active invoice per plan) | Service layer | Requires querying other aggregates and making atomic decisions. |
| Authorization (e.g., "only admin can void") | Service layer (with RBAC) | Permissions are not a database concern. |
| Business identifier formatting (e.g., INV-00001) | Service layer | Formatting is an application concern, not a storage concern. |

### Database Layer (Check Constraints + Unique Indexes)

The database layer serves as a **safety net** — it catches violations that the application layer should have prevented:

| Constraint Type | Enforced By | Why at This Layer |
|---|---|---|
| Data type integrity (e.g., amount > 0) | Check constraints | Prevents application bugs from corrupting financial data. A bug in the service layer should not produce a negative payment. |
| Uniqueness (e.g., unique invoice_number) | Unique constraints | Race conditions in the application layer can produce duplicates. Unique constraints guarantee uniqueness at the database level. |
| Referential integrity (e.g., line_item must belong to an invoice) | Foreign key constraints | Prevents orphaned child records due to application bugs. |
| NOT NULL for required fields | NOT NULL constraints | Catches null-value bugs before they reach production reporting. |
| Enum-like validation (e.g., valid status values) | Check constraints | Documents the allowed values at the schema level and prevents invalid statuses from being written. |

### Why Both? The Argument for Redundancy

| Argument | Counter-argument | Resolution |
|---|---|---|
| "Database constraints are redundant if the application validates correctly" | Software bugs are inevitable. A constraint at the database layer is insurance against application-layer defects. | Both layers are enforced. The database constraint is the last line of defense. |
| "Check constraints are hard to maintain across migrations" | Check constraints rarely change for financial schemas (status values are stable, amount positivity is permanent). README changes to constraints are explicit and reviewed. | Acceptable maintenance cost for the safety provided. |
| "The application layer should be the single source of truth" | The database is the actual source of truth — it's where the data lives. Constraints on the data ensure integrity even if all application instances restart or bugs are introduced. | The application layer validates business rules; the database layer validates data integrity. |

### Specific Financial Defenses

For financial data, the defense-in-depth approach provides specific protections:

1. **Payment amount > 0:** Enforced by service validation (BR-61) AND database check constraint (`chk_payment_amount`)
2. **Cancellation reason required:** Enforced by service logic AND database check constraint (`chk_cancellation_reason`)
3. **Invoice number uniqueness:** Enforced by service-level sequence generation AND unique constraint on `invoice_number`
4. **Line item quantity ≥ 1:** Enforced by service validation (BR-32) AND database check constraint (`chk_quantity_positive`)
5. **Status values:** Enforced by state machine (service layer) AND database CHECK constraint (`chk_invoice_status_valid`)

This dual enforcement ensures that no single software defect can produce an invalid financial record.

---

## 3. Unique Constraints

| Table | Column(s) | Purpose | Phase |
|---|---|---|---|
| `invoices` | `invoice_number` | Legal document identifier uniqueness | MVP |
| `payments` | `payment_number` | Document identifier uniqueness | MVP |
| `receipts` | `receipt_number` | Document identifier uniqueness | MVP |
| `credit_notes` | `credit_note_number` | Document identifier uniqueness | Phase 2 |
| `payment_allocations` | `(payment_id, invoice_id)` WHERE `is_refund = FALSE` | Prevents duplicate positive allocation for same payment/invoice | MVP |
| `document_sequences` | `document_type` | One row per document type | MVP |
| `tax_rates` | `(name, jurisdiction)` | Unique tax rate name within jurisdiction | Phase 2 |

---

## 3. Check Constraints

| Table | Constraint | Condition | Business Rule |
|---|---|---|---|
| `invoices` | `chk_invoice_status_valid` | `status IN ('draft','issued','partially_paid','paid','overdue','cancelled','void')` | BR-10 through BR-20 |


| `invoices` | `chk_invoice_dates` | `due_date >= invoice_date` | Due date cannot precede invoice date |
| `invoices` | `chk_cancellation_reason` | `status != 'Cancelled' OR cancellation_reason IS NOT NULL` | BR-18 |
| `invoices` | `chk_void_reason` | `status != 'void' OR void_reason IS NOT NULL` | BR-19 |
| `invoices` | `chk_currency_length` | `LENGTH(currency) = 3` | Valid ISO 4217 code |
| `invoice_line_items` | `chk_quantity_positive` | `quantity >= 1` | BR-32 |
| `invoice_line_items` | `chk_unit_price` | `unit_price >= 0` | BR-31 |
| `invoice_line_items` | `chk_net_amount` | `net_amount >= 0` | BR-36 (discount cannot exceed subtotal) |
| `invoice_line_items` | `chk_discount_type` | `discount_type IS NULL OR discount_type IN ('PERCENTAGE','FIXED_AMOUNT')` | BR-34 |
| `payments` | `chk_payment_amount` | `total_amount > 0` | BR-61 |
| `payments` | `chk_payment_status` | `status IN ('pending','completed','failed','refunded','reversed','void')` | Payment state machine |
| `payments` | `chk_payment_method` | `LENGTH(payment_method) >= 2` | Minimum 2-char method identifier |
| `payment_allocations` | `chk_allocation_amount` | `allocated_amount > 0` | Allocation must be positive |
| `receipts` | `chk_receipt_amount` | `amount > 0` | Receipt amount must be positive |
| `credit_notes` | `chk_credit_status` | `status IN ('draft','issued','applied','expired','void')` | Credit note state machine |
| `credit_notes` | `chk_credit_amount` | `amount > 0` | Credit amount must be positive |
| `credit_notes` | `chk_void_reason_cn` | `status != 'void' OR void_reason IS NOT NULL` | BR-98 |
| `patient_credits` | `chk_original_amount` | `original_amount > 0` | Credit must be positive |
| `patient_credits` | `chk_remaining_amount` | `remaining_amount >= 0` | BR-150 |

---

## 4. NOT NULL Constraints (Business Rules)

| Table | Column | Business Rule |
|---|---|---|
| `invoices` | `patient_id` | BR-1 — must reference a patient |
| `invoices` | `invoice_number` | BR-3 — unique invoice number required |
| `invoice_line_items` | `description` | BR-30 — must have a description |
| `invoices` | `status` | Always has a status |
| `payments` | `patient_id` | Payment must be attributable to a patient |
| `payments` | `payment_method` | BR-65/66 — method required |
| `credit_notes` | `invoice_id` | BR-90 — must reference an invoice |
| `credit_notes` | `reason` | BR-82 — reason required for correction |

---

## 5. Exclusion Constraints

| Constraint | Purpose | Implementation |
|---|---|---|
| No overlapping credit periods | Not required — credit notes have simple expiry dates | CHECK constraint on expiry_date |
| No double-booking payment allocations | Prevented by unique index on (payment_id, invoice_id) | Partial unique index |

---

## 6. Default Value Constraints

| Table | Column | Default | Rationale |
|---|---|---|---|
| `invoices` | `status` | `'draft'` | BR-10 — starts in draft |
| `invoices` | `invoice_date` | `CURRENT_DATE` | Invoice date is current date |
| `invoices` | `due_date` | `CURRENT_DATE + 30` | Standard 30-day payment terms |
| `invoices` | `currency` | `'USD'` | Default currency |
| `invoice_line_items` | `quantity` | `1` | Default quantity |
| `payments` | `status` | `'completed'` | MVP — no gateway pending state |
| `payments` | `is_reversed` | `FALSE` | Not reversed by default |
| `payment_allocations` | `is_refund` | `FALSE` | Not a refund by default |
| `document_sequences` | `current_value` | `0` | Start at 0, first increment produces 1 |
| `document_sequences` | `min_digits` | `5` | Default 5-digit padding |
| `document_sequences` | `start_value` | `1` | Start numbering at 1 |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [06-indexing-strategy.md](06-indexing-strategy.md), [06-business-rules.md](../06-business-rules.md) |
| **Next** | [06-indexing-strategy.md](06-indexing-strategy.md) |
