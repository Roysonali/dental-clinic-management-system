# Table Specifications — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document specifies every table in the Billing module's database schema. Each table entry includes its purpose, columns with types, nullability, defaults, and business descriptions.

---

## 2. Table: `invoices`

**Purpose:** The central financial document. Records charges owed by a patient for dental services.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `invoice_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `patient_id` | `UUID` | NO | — | Reference to Patient Management module |
| `treatment_plan_id` | `UUID` | YES | NULL | Source treatment plan (optional) |
| `appointment_id` | `UUID` | YES | NULL | Source appointment (optional) |
| `doctor_id` | `UUID` | YES | NULL | Treating doctor (optional) |
| `invoice_number` | `VARCHAR(30)` | NO | — | Sequential display number (unique) |
| `invoice_date` | `DATE` | NO | `CURRENT_DATE` | Date of invoice creation |
| `due_date` | `DATE` | NO | `CURRENT_DATE + 30` | Payment due date |
| `status` | `VARCHAR(30)` | NO | `'draft'` | Invoice status (draft/issued/partially_paid/paid/overdue/cancelled/void) |
| `currency` | `VARCHAR(3)` | NO | `'USD'` | ISO 4217 currency code |
| `notes` | `TEXT` | YES | NULL | Free-text notes (append-only after issue) |
| `cancellation_reason` | `TEXT` | YES | NULL | Required when status = Cancelled |
| `void_reason` | `TEXT` | YES | NULL | Required when status = void |
| `version` | `INTEGER` | NO | `1` | Optimistic locking version |
| `created_by` | `UUID` | NO | — | Reference to User Management |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |
| `updated_by` | `UUID` | NO | — | Last update user reference |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last update timestamp |

**Candidate Keys:** `invoice_id` (PK), `invoice_number` (unique)

---

## 3. Table: `invoice_line_items`

**Purpose:** Individual charge entries on an invoice. Owned by Invoice aggregate.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `line_item_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `invoice_id` | `UUID` | NO | — | FK to `invoices` (composition) |
| `plan_item_id` | `UUID` | YES | NULL | Source treatment plan item (optional) |
| `diagnosis_id` | `UUID` | YES | NULL | Reference to Patient Records diagnosis (optional) |
| `description` | `VARCHAR(500)` | NO | — | Procedure description |
| `quantity` | `INTEGER` | NO | `1` | Quantity (≥ 1) |
| `unit_price` | `NUMERIC(12,2)` | NO | — | Price per unit (≥ 0) |
| `discount_type` | `VARCHAR(20)` | YES | NULL | 'PERCENTAGE' or 'FIXED_AMOUNT' |
| `discount_value` | `NUMERIC(12,2)` | YES | NULL | Discount percentage or amount |
| `net_amount` | `NUMERIC(12,2)` | NO | — | (unit_price × quantity) − discount |
| `tax_rate_id` | `UUID` | YES | NULL | FK to `tax_rates` (Phase 2) |
| `tax_amount` | `NUMERIC(12,2)` | YES | NULL | Tax amount (Phase 2) |
| `original_price` | `NUMERIC(12,2)` | YES | NULL | Original treatment plan estimate price |
| `override_reason` | `VARCHAR(200)` | YES | NULL | Reason for price override |
| `version` | `INTEGER` | NO | `1` | Optimistic locking version |
| `created_by` | `UUID` | NO | — | Reference to User Management |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |
| `updated_by` | `UUID` | NO | — | Last update user reference |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last update timestamp |

**Candidate Keys:** `line_item_id` (PK)

---

## 4. Table: `invoice_status_history`

**Purpose:** Append-only audit trail of every invoice status change.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `status_history_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `invoice_id` | `UUID` | NO | — | FK to `invoices` (composition) |
| `from_status` | `VARCHAR(30)` | YES | NULL | Previous status (NULL for first entry) |
| `to_status` | `VARCHAR(30)` | NO | — | New status |
| `changed_by` | `UUID` | NO | — | User who triggered the change |
| `changed_at` | `TIMESTAMPTZ` | NO | `NOW()` | When the change occurred |
| `reason` | `TEXT` | YES | NULL | Reason for the change |

**Candidate Keys:** `status_history_id` (PK)

**Indexes:** `(invoice_id, changed_at)` for chronological audit trail

---

## 5. Table: `payments`

**Purpose:** Records a financial transaction transferring funds from patient to clinic. Aggregate root.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `payment_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `patient_id` | `UUID` | NO | — | Reference to Patient Management |
| `payment_number` | `VARCHAR(30)` | NO | — | Sequential display number (unique) |
| `payment_method` | `VARCHAR(30)` | NO | — | Extensible payment method identifier |
| `total_amount` | `NUMERIC(12,2)` | NO | — | Total payment amount (> 0) |
| `payment_date` | `DATE` | NO | `CURRENT_DATE` | Date of payment |
| `reference_number` | `VARCHAR(100)` | YES | NULL | Gateway transaction ID, cheque number, etc. |
| `status` | `VARCHAR(30)` | NO | `'completed'` | Payment status |
| `is_reversed` | `BOOLEAN` | NO | `FALSE` | True if fully reversed |
| `reversal_reason` | `TEXT` | YES | NULL | Reason for reversal |
| `notes` | `TEXT` | YES | NULL | Free-text notes |
| `version` | `INTEGER` | NO | `1` | Optimistic locking version |
| `created_by` | `UUID` | NO | — | User who recorded the payment |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |
| `updated_by` | `UUID` | NO | — | Last update user reference |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last update timestamp |

**Candidate Keys:** `payment_id` (PK), `payment_number` (unique)

---

## 6. Table: `payment_allocations`

**Purpose:** Links a Payment to an Invoice with the allocated amount. Owned by Payment aggregate. Supports allocated payments (invoice_id set), advance/unallocated payments (invoice_id NULL), and refund allocations.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `allocation_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `payment_id` | `UUID` | NO | — | FK to `payments` (composition) |
| `invoice_id` | `UUID` | YES | NULL | FK reference to `invoices` (NULL for advance/unallocated payments) |
| `allocated_amount` | `NUMERIC(12,2)` | NO | — | Amount allocated to this invoice |
| `is_refund` | `BOOLEAN` | NO | `FALSE` | True if this is a refund allocation |
| `refund_reason` | `TEXT` | YES | NULL | Reason for refund (if `is_refund`) |
| `original_allocation_id` | `UUID` | YES | NULL | Self-ref to reversed allocation |
| `created_by` | `UUID` | NO | — | User who created the allocation |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |

**Candidate Keys:** `allocation_id` (PK)

**Uniqueness:** `(payment_id, invoice_id)` with partial index where `is_refund = FALSE AND invoice_id IS NOT NULL` to prevent duplicate non-refund allocations for the same payment/invoice pair. Note: advance payments (invoice_id IS NULL) can have only one allocation row per payment.

---

## 7. Table: `receipts`

**Purpose:** Formal acknowledgment of payment. Read-only after creation.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `receipt_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `payment_id` | `UUID` | NO | — | FK reference to `payments` |
| `receipt_number` | `VARCHAR(30)` | NO | — | Sequential display number (unique) |
| `receipt_date` | `DATE` | NO | `CURRENT_DATE` | Date of receipt |
| `amount` | `NUMERIC(12,2)` | NO | — | Total receipted amount |
| `status` | `VARCHAR(20)` | NO | `'generated'` | Receipt lifecycle status (generated/cancelled) |
| `created_by` | `UUID` | NO | — | User who generated the receipt |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |

**Candidate Keys:** `receipt_id` (PK), `receipt_number` (unique)

---

## 8. Table: `receipt_invoices`

**Purpose:** Join table supporting consolidated receipts (one receipt for multiple invoices).

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `receipt_id` | `UUID` | NO | — | FK to `receipts` |
| `invoice_id` | `UUID` | NO | — | FK reference to `invoices` |

**Candidate Keys:** `(receipt_id, invoice_id)` (composite PK)

---

## 9. Table: `credit_notes` (Phase 2)

**Purpose:** Financial document correcting an issued invoice.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `credit_note_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `invoice_id` | `UUID` | NO | — | FK reference to corrected invoice |
| `patient_id` | `UUID` | NO | — | Reference to Patient Management |
| `credit_note_number` | `VARCHAR(30)` | NO | — | Sequential display number (unique) |
| `issue_date` | `DATE` | NO | `CURRENT_DATE` | Date of issuance |
| `amount` | `NUMERIC(12,2)` | NO | — | Credit note amount |
| `remaining_balance` | `NUMERIC(12,2)` | NO | — | Unapplied balance (decreases as applied) |
| `reason` | `TEXT` | NO | — | Reason for issuing credit note |
| `status` | `VARCHAR(30)` | NO | `'Draft'` | Credit note status |
| `expiry_date` | `DATE` | YES | NULL | Configurable validity period |
| `void_reason` | `TEXT` | YES | NULL | Required when voided |
| `version` | `INTEGER` | NO | `1` | Optimistic locking version |
| `created_by` | `UUID` | NO | — | User reference |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |
| `updated_by` | `UUID` | NO | — | Last update user reference |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last update timestamp |

**Candidate Keys:** `credit_note_id` (PK), `credit_note_number` (unique)

---

## 10. Table: `patient_credits`

**Purpose:** Tracks positive balances owed to a patient from overpayments, credit notes, or advance payments.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `patient_credit_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `patient_id` | `UUID` | NO | — | Reference to Patient Management |
| `source_allocation_id` | `UUID` | YES | NULL | Source payment allocation (overpayment) |
| `source_credit_note_id` | `UUID` | YES | NULL | Source credit note |
| `original_amount` | `NUMERIC(12,2)` | NO | — | Original credit amount |
| `remaining_amount` | `NUMERIC(12,2)` | NO | — | Currently available credit |
| `expiry_date` | `DATE` | YES | NULL | Optional expiry for credit-note-sourced credits |
| `created_by` | `UUID` | NO | — | System user (auto-generated) |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |
| `updated_by` | `UUID` | NO | — | Last update user reference |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last update timestamp |

**Candidate Keys:** `patient_credit_id` (PK)

---

## 11. Table: `document_sequences`

**Purpose:** Manages sequential number generation per document type.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `document_type` | `VARCHAR(30)` | NO | — | 'invoice', 'receipt', 'payment', 'refund', 'credit_note' |
| `prefix` | `VARCHAR(10)` | NO | — | e.g., 'INV-', 'RCT-', 'PAY-' |
| `current_value` | `BIGINT` | NO | `0` | Current sequence value |
| `min_digits` | `INTEGER` | NO | `5` | Minimum digit length for padding |
| `start_value` | `BIGINT` | NO | `1` | Starting sequence value |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last increment timestamp |
| `updated_by` | `UUID` | NO | — | User who triggered last increment |

**Candidate Keys:** `document_type` (PK)

---

## 12. Table: `sequence_consumption_log`

**Purpose:** Audit record of every number reserved from a sequence.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `document_type` | `VARCHAR(30)` | NO | — | Which sequence was consumed |
| `number_assigned` | `BIGINT` | NO | — | The number that was reserved |
| `reserved_at` | `TIMESTAMPTZ` | NO | `NOW()` | When reserved |
| `reserved_by` | `UUID` | NO | — | User who triggered reservation |
| `document_id` | `UUID` | YES | NULL | Created document ID (NULL if creation failed) |
| `status` | `VARCHAR(20)` | NO | `'completed'` | 'completed', 'failed', 'rolled_back' |

**Candidate Keys:** `id` (PK)

---

## 13. Table: `tax_rates` (Phase 2)

**Purpose:** Configurable tax rate reference data.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `tax_rate_id` | `UUID` | NO | `gen_random_uuid()` | Primary key |
| `name` | `VARCHAR(50)` | NO | — | Display name (e.g., 'GST', 'VAT 20%') |
| `rate` | `NUMERIC(5,3)` | NO | — | Percentage rate (0.000 to 100.000) |
| `jurisdiction` | `VARCHAR(100)` | NO | — | Tax jurisdiction (e.g., 'Federal', 'State') |
| `is_active` | `BOOLEAN` | NO | `TRUE` | Available for use on new invoices |
| `created_by` | `UUID` | NO | — | User reference |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Creation timestamp |
| `updated_by` | `UUID` | NO | — | Last update user reference |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Last update timestamp |

**Candidate Keys:** `tax_rate_id` (PK), `name` (unique within jurisdiction)

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [02-entity-to-table-mapping.md](02-entity-to-table-mapping.md) |
| **Related** | [04-primary-and-foreign-keys.md](04-primary-and-foreign-keys.md), [05-constraints.md](05-constraints.md) |
| **Next** | [04-primary-and-foreign-keys.md](04-primary-and-foreign-keys.md) |
