# Database Overview — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Database Overview |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | README.md, 02-entity-to-table-mapping.md |

---

## 1. Schema Context

The Billing module operates within a **Modular Monolith** database architecture. All DensCare modules share the same database instance but are logically separated. Billing tables are in a dedicated schema/namespace (`billing`).

### Schema Scope

| Aspect | Detail |
|---|---|
| **Database Engine** | PostgreSQL (primary target) |
| **Schema Name** | `billing` |
| **Tables (MVP)** | 8 tables across 6 aggregates |
| **Tables (Phase 2+)** | 3 additional tables (CreditNote, Refund support) |
| **External References** | Patient Management, User Management, Treatment Plans, Doctor Management, Appointment Management |

---

## 2. Aggregate-to-Table Mapping Summary

| Aggregate Root | MVP Tables | Phase 2 Tables | Notes |
|---|---|---|---|
| Invoice | `invoices`, `invoice_line_items`, `invoice_status_history` | — | Core billing table |
| Payment | `payments`, `payment_allocations` | — | Supports multi-invoice |
| Receipt | `receipts` | — | Read-only after creation |
| CreditNote | — | `credit_notes` | Phase 2 |
| PatientCredit | — | `patient_credits` | Overpayment in MVP via separate approach |
| DocumentSequence | `document_sequences`, `sequence_consumption_log` | — | Utility tables |

---

## 3. Database Design Principles

| Principle | Application |
|---|---|
| **Aggregate boundaries preserved** | Each aggregate root maps to one primary table. Child entities map to separate tables within the same aggregate boundary. No cross-aggregate foreign keys enforce relationships between aggregates — references are at the application level. |
| **Immutable patterns** | Issued invoices, completed payments, and generated receipts use insert-only patterns after their finalization point. Updates beyond that point are prohibited at the application layer. |
| **Computed values** | Invoice subtotal, discount total, tax total, grand total, and outstanding balance are NOT stored. They are computed from source data (line items, allocations). This prevents data inconsistency. |
| **Status history** | Every status change on core entities (Invoice, Payment, CreditNote) is recorded in a dedicated history table with old status, new status, actor, timestamp, and reason. |
| **Soft delete prohibited** | Financial records are never hard or soft deleted. They transition to terminal statuses and remain permanently in the database for audit compliance. |
| **Version-based optimistic locking** | Core tables include a `version` integer column used for optimistic locking. See [09-optimistic-locking.md](09-optimistic-locking.md). |

---

## 4. Database Naming Convention

### Naming Philosophy

Consistent naming is essential for maintainability, especially in a financial system where ambiguity can lead to costly errors. The Billing module follows a naming convention designed for **clarity, consistency, and self-documentation**.

### Table Naming

| Convention | Standard | Example | Rationale |
|---|---|---|---|
| **Table names** | Lowercase, plural snake_case | `invoice_line_items`, `payment_allocations` | Plural reflects that a table holds multiple records. Snake_case is standard in PostgreSQL and SQLAlchemy. Lowercase avoids case-sensitivity issues. |
| **Aggregate root tables** | Singular concept in plural | `invoices`, `payments`, `receipts` | Directly maps to the domain entity name. |
| **Child entity tables** | `{parent}_{child}` | `invoice_line_items`, `payment_allocations` | Prefix with parent name for readability in JOINs. |
| **Join tables** | `{entity_a}_{entity_b}` (alphabetical) | `receipt_invoices` | Both entity names, alphabetically ordered for consistency. |
| **History/log tables** | `{entity}_status_history`, `sequence_consumption_log` | `invoice_status_history` | Suffix indicates purpose (history, log). |
| **Reference tables** | Plural concept | `tax_rates`, `document_sequences` | Contains reference data used by other tables. |

### Column Naming

| Convention | Standard | Example | Rationale |
|---|---|---|---|
| **All columns** | Lowercase, snake_case | `unit_price`, `payment_method` | Consistent with table naming. |
| **Primary key** | `{table_singular}_id` | `allocation_id`, `payment_id` | Unambiguous and self-documenting. |
| **Foreign key** | `{referenced_table_singular}_id` | `invoice_id`, `patient_id` | Immediately identifies the referenced table. |
| **Audit — created** | `created_by`, `created_at` | — | Standard audit fields. `_by` is UUID, `_at` is timestamp. |
| **Audit — updated** | `updated_by`, `updated_at` | — | Same pattern as created. |
| **Version** | `version` | — | Simple, universal. Integer starting at 1. |
| **Status** | `status` | — | `VARCHAR` (not `ENUM`) for extensibility. |
| **Boolean** | `is_` prefix | `is_refund`, `is_reversed` | Reads naturally in conditions: `WHERE is_refund = TRUE`. |
| **Monetary** | `_amount` suffix | `total_amount`, `net_amount` | Clearly identifies monetary values. |
| **Percentage** | `_rate` or `_percentage` suffix | `discount_percentage` | Distinguishes from absolute amounts. |
| **Count/Quantity** | No suffix or `_count` | `quantity`, `line_item_count` | Distinguishable from monetary columns. |
| **Date** | `_date` suffix | `invoice_date`, `due_date` | `DATE` type (no time component). |
| **Timestamp** | `_at` suffix | `created_at`, `updated_at` | `TIMESTAMPTZ` type. |
| **Text/long string** | Descriptive name | `description`, `notes`, `reason` | No suffix needed. |

### Reserved Column Names

The following column names have fixed meanings across all tables:

| Column Name | Type | Meaning |
|---|---|---|
| `created_by` | `UUID` | User who created the record |
| `created_at` | `TIMESTAMPTZ` | When the record was created |
| `updated_by` | `UUID` | User who last modified the record |
| `updated_at` | `TIMESTAMPTZ` | When the record was last modified |
| `version` | `INTEGER` | Optimistic locking counter |

### Column Names NOT Used

| Column Name | Reason Not Used |
|---|---|
| `deleted_at` | Financial records are never soft-deleted. Status-based retirement replaces deletion. |
| `is_deleted` | Same as above. |
| `created_date` | Ambiguous — could be `DATE` or `TIMESTAMP`. `created_at` is unambiguous. |
| `modified_at` | Inconsistent with `created_at`. `updated_at` pairs with `created_at`. |
| `id` | Too generic. `{table_singular}_id` is self-documenting. |

---

## 5. Data Type Strategy

| Domain Concept | Database Type | Precision | Notes |
|---|---|---|---|
| Monetary amounts | `NUMERIC(12,2)` | 12 digits total, 2 decimal places | Standard precision for all currencies |
| Discount percentages | `NUMERIC(5,2)` | 5 digits total, 2 decimal places | Supports 0.00% to 100.00% |
| Tax rates | `NUMERIC(5,3)` | 5 digits total, 3 decimal places | Supports 0.000% to 100.000% |
| Quantities | `INTEGER` | — | Minimum 1 |
| UUIDs | `UUID` | — | All primary and foreign keys |
| Statuses | `VARCHAR(30)` | — | Not ENUM — allows future extension |
| Dates | `DATE` | — | No time component for business dates |
| Timestamps | `TIMESTAMP WITH TIME ZONE` | — | Always UTC |
| Version | `INTEGER` | — | Optimistic locking |
| Long text | `TEXT` | — | Notes, reasons |

---

## 6. Payment Allocation Strategy

The Billing module uses a **three-entity payment allocation model**: `Payment → Payment Allocation → Invoice`. This is a deliberate architectural choice that underpins all payment-related operations.

### The Model

```
Payment (Aggregate Root)
    │
    ├── PaymentAllocation (Child Entity) ──── Invoice (Aggregate Root)
    ├── PaymentAllocation (Child Entity) ──── Invoice (Aggregate Root)
    └── PaymentAllocation (Child Entity) ──── Invoice (Aggregate Root)
```

### Why This Architecture?

The PaymentAllocation join entity exists because a single Payment does not always map to exactly one Invoice. Real-world billing scenarios demand more flexibility:

| Scenario | How the Three-Entity Model Supports It |
|---|---|
| **Partial Payment** | Patient pays $200 toward a $500 invoice. One Payment, one PaymentAllocation for $200. Invoice remains with a $300 outstanding balance. |
| **Multi-Invoice Payment** | Patient pays $800 covering two invoices ($500 + $300). One Payment, two PaymentAllocation records — one per invoice. |
| **Advance Payment** | Patient pays $1,000 deposit before treatment. One Payment, PaymentAllocation with `invoice_id = NULL`. Allocation is updated when the invoice is created. |
| **Overpayment** | Patient pays $600 on a $500 invoice. One Payment, one $500 allocation to invoice, excess $100 recorded as PatientCredit. |
| **Split Payment** | Patient pays $500 using two methods ($300 cash + $200 card). Two Payments, each with its own PaymentAllocation to the same invoice. |
| **Refund** | A refund reverses an allocation: new PaymentAllocation with `is_refund = TRUE` referencing the original allocation. Invoice balance increases. |
| **Future Insurance** | Insurance pays part of an invoice directly to the clinic. Payment recorded with method "Insurance" and allocated to the invoice. Patient pays the remaining balance. |
| **Future Wallet** | Patient uses advance wallet balance to pay an invoice. Wallet consumption recorded as a Payment with method "Wallet," allocated to the invoice. |

### Alternatives Considered

| Option | Description | Why Rejected |
|---|---|---|
| **Option A: Direct Payment → Invoice** | Payment table has `invoice_id` directly, one payment per invoice. | Cannot support multi-invoice payments. Advance payments have no invoice to reference. Split payments across methods are impossible. Requires schema redesign for Phase 2/3 features. |
| **Option B: JSONB allocations on Invoice** | Payment allocation data stored as JSON on the invoice record. | Unqueryable for reporting and reconciliation. No referential integrity. Cannot trace a single payment across multiple invoices. |
| **Option C: JSONB allocations on Payment** | Payment stores `{invoice_id: amount}` as JSONB. | Same drawbacks as Option B. No referential integrity. Cannot easily compute outstanding balance. |
| **Option D: Payment → PaymentAllocation → Invoice (Preferred)** | A dedicated join table with its own identity and attributes. | Chosen for all the reasons above. The only design that supports all current and future payment scenarios without schema redesign. |

### Scalability and Future-Proofing

The three-entity model adds one JOIN to payment queries, but this is a trivial cost at expected clinic scale (< 25,000 payments/year). The benefits — supporting advance payments, multi-invoice payments, refund traceability, insurance integration, and patient wallet — far outweigh the minimal query complexity.

The model is designed to **evolve without schema redesign**:

- **Insurance:** Add `insurance_claim_id` to PaymentAllocation (or a separate insurance_payments table)
- **Wallet:** Add `wallet_transaction_id` to Payment with method "Wallet"
- **Multi-branch:** Add `branch_id` to PaymentAllocation
- **Payment gateway:** Add gateway-specific columns to a separate `gateway_transactions` table referenced by Payment

---

## 7. Invoice Snapshot Policy

### Why Invoices Must Preserve Historical Accuracy

An invoice is a **legal financial document**. Once issued, it represents the exact charges agreed upon at the time of treatment. If reference data changes (procedure prices are updated, treatment plans are revised), the invoice must remain unchanged. The patient and tax authorities hold the clinic accountable for the invoice as originally issued.

### What Is Snapshotted

When an invoice is generated — either from a treatment plan or manually — the following information is **copied** (snapshotted) into the invoice and line item records:

| Information | Source | Stored On | Rationale |
|---|---|---|---|
| Procedure name/description | Treatment plan item or manual entry | `invoice_line_items.description` | The procedure description at the time of billing, not a current description that may change. |
| Unit price | Treatment plan cost estimate or manual override | `invoice_line_items.unit_price` | The agreed price at time of service. Future price changes must not affect this invoice. |
| Quantity | User entry | `invoice_line_items.quantity` | Units billed. |
| Discount | User entry (with optional approval) | `invoice_line_items.discount_type`, `discount_value` | The discount applied at billing time. |
| Tax rate reference | `tax_rates` table | `invoice_line_items.tax_rate_id` | The tax rate in effect at invoice creation. Frozen even if rates change later. |
| Tax amount | Computed | `invoice_line_items.tax_amount` (Phase 2) | The exact tax computed at billing time. |
| Price override tracking | User modification | `invoice_line_items.original_price`, `override_reason` | If the price was changed from the treatment plan estimate, both the original and new values are preserved for audit. |
| Treatment plan reference | Treatment plan | `invoices.treatment_plan_id`, `invoice_line_items.plan_item_id` | References to the source treatment plan for traceability. The plan's current state does not affect the invoice. |
| Invoice date | System default or user override | `invoices.invoice_date` | The date of billing. |
| Invoice number | Sequential generator | `invoices.invoice_number` | The legal document identifier. |

### What Is NOT Snapshotted

The following information is **referenced at read time** (not snapshotted):

| Information | Reason |
|---|---|
| Patient name, address, contact | Patient demographics are managed by the Patient Management module. The invoice references `patient_id`. The patient's name is resolved at read time via a join or read-model. If the patient's name changes (marriage, correction), the invoice shows the current name — this is appropriate for financial documents. |
| Doctor name, specialization | Doctor profile data is owned by Doctor Management. The invoice references `doctor_id`. The doctor's name is resolved at read time. |
| User full name | Audit trail stores `created_by` (UUID). User names are resolved at read time. |
| Role definitions, permissions | RBAC data is owned by the RBAC module. Not relevant to invoices. |
| Treatment plan current status | The plan may be revised or superseded after billing. The invoice preserves only the plan items that were billed, not the plan's current state. |
| Procedure catalog current price | The catalog price may change. The invoice preserves the price at time of billing via `unit_price`. |

### Architectural Principle: Decoupling from External Changes

The snapshot strategy ensures that invoices are **not dependent on the continued correctness of external reference data**:

- If the Procedure Catalog updates a procedure's price, existing invoices are unaffected
- If a Treatment Plan is revised after billing, invoiced line items remain valid
- If a Patient's name changes, the invoice continues to reference the correct patient (by ID rather than by snapshotted name)
- If Tax rates are updated, invoices issued before the change retain the original rates

This decoupling is essential for financial record integrity. An invoice must be a **self-contained historical record** that can be understood without reference to the current state of other modules.

---

## 8. Transaction Boundaries

| Operation | Affected Tables | Notes |
|---|---|---|
| Invoice creation | `invoices` + `invoice_line_items` | Single transaction |
| Invoice issuance | `invoices` (status) + `invoice_status_history` | Single transaction |
| Payment recording | `payments` + `payment_allocations` + `receipts` + `invoice_status_history` | Cross-aggregate via domain event |
| Invoice cancellation | `invoices` (status) + `invoice_status_history` | Single transaction |
| Refund (Phase 2) | `payment_allocations` (refund) + `invoice_status_history` | Single transaction + domain event |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [README.md](README.md) |
| **Next** | [02-entity-to-table-mapping.md](02-entity-to-table-mapping.md) |
