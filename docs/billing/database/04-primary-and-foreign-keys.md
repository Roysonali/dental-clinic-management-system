# Primary and Foreign Keys — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document defines the primary key strategy and foreign key relationships for the Billing module schema. It documents how keys are generated, which relationships have enforced constraints, and which are application-level only.

---

## 2. Primary Key Strategy

| Decision | Standard | Rationale |
|---|---|---|
| **Type** | UUID v4 | Globally unique, no sequential guessing, merge-friendly for multi-branch |
| **Generation** | `gen_random_uuid()` (PostgreSQL) | Standard PostgreSQL function, no extension needed |
| **Naming** | `{table_singular}_id` | Consistent, self-documenting |
| **Single-column** | Always | No composite PKs (except join tables) |
| **Surrogate** | Always | Domain identifiers (invoice_number, receipt_number) are separate unique keys |

---

## 3. Primary Keys by Table

| Table | PK Column | Type | Notes |
|---|---|---|---|
| `invoices` | `invoice_id` | UUID | |
| `invoice_line_items` | `line_item_id` | UUID | |
| `invoice_status_history` | `status_history_id` | UUID | |
| `payments` | `payment_id` | UUID | |
| `payment_allocations` | `allocation_id` | UUID | |
| `receipts` | `receipt_id` | UUID | |
| `receipt_invoices` | `(receipt_id, invoice_id)` | Composite UUID | Join table exception |
| `credit_notes` | `credit_note_id` | UUID | Phase 2 |
| `patient_credits` | `patient_credit_id` | UUID | |
| `document_sequences` | `document_type` | VARCHAR(30) | Natural PK — simple key |
| `sequence_consumption_log` | `id` | UUID | |
| `tax_rates` | `tax_rate_id` | UUID | Phase 2 |

---

## 4. Enforced Foreign Keys (Within Billing Schema)

These foreign keys are enforced at the database level because both tables are within the Billing schema:

| FK Column | Parent Table | Child Table | Type | On Delete |
|---|---|---|---|---|
| `invoice_id` | `invoices` | `invoice_line_items` | Composition (owned) | RESTRICT |
| `invoice_id` | `invoices` | `invoice_status_history` | Composition (owned) | RESTRICT |
| `payment_id` | `payments` | `payment_allocations` | Composition (owned) | RESTRICT |
| `payment_id` | `payments` | `receipts` | Reference (unowned) | RESTRICT |
| `receipt_id` | `receipts` | `receipt_invoices` | Composition (owned) | RESTRICT |
| `original_allocation_id` | `payment_allocations` | `payment_allocations` | Self-reference | SET NULL |
| `tax_rate_id` | `invoice_line_items` | `tax_rates` | Reference | RESTRICT (Phase 2) |

---

## 5. Application-Level References (No DB Constraint)

These references are enforced at the **application layer** only. Billing does not own the referenced data, so no foreign key constraint exists:

| FK Column | Referenced Module | Tables Using It | Rationale |
|---|---|---|---|
| `patient_id` | Patient Management | `invoices`, `payments`, `credit_notes`, `patient_credits` | Patient data owned by another module |
| `treatment_plan_id` | Treatment Plans | `invoices` | Plan data owned by another module |
| `appointment_id` | Appointment Management | `invoices` | Appointment data owned by another module |
| `doctor_id` | Doctor Management | `invoices` | Doctor data owned by another module |
| `plan_item_id` | Treatment Plans | `invoice_line_items` | Plan item data owned by another module |
| `diagnosis_id` | Patient Records | `invoice_line_items` | Diagnosis data owned by another module |
| `created_by` | User Management | All tables with audit columns | User data owned by another module |

---

## 6. FK to External Module — Merge/Delete Impact

| External Module | If Record Is Deleted | If Patient Merged |
|---|---|---|
| Patient Management | Billing records remain (audit requirement). Patient reference becomes orphaned. | All billing `patient_id` references updated to target patient ID. |
| User Management | Billing audit trail retains the user_id. User name may be resolved via read-model projection. | N/A — users are not merged. |
| Treatment Plans | Billing invoice retains `treatment_plan_id` for audit. Plan data may be incomplete. | Not applicable. |
| Doctor Management | Billing invoice retains `doctor_id` for audit. | Not applicable. |

---

## 7. Business Identifier Policy

### Technical Identifiers vs. Business Identifiers

The Billing module maintains a strict separation between **technical identifiers** (used internally by the system) and **business identifiers** (used by humans for communication, legal documents, and audits):

| Aspect | Technical Identifier | Business Identifier |
|---|---|---|
| **Purpose** | Internal system reference | Human-visible document identification |
| **Type** | `UUID` (v4) | `VARCHAR` (formatted string) |
| **Example** | `a1b2c3d4-...` | `INV-00001` |
| **Unique?** | Yes (by definition) | Yes (by constraint) |
| **Sequential?** | No (random) | Yes (gapless sequential) |
| **Exposed to users?** | Never | Always (on invoices, receipts, reports) |
| **Used in URLs?** | Yes (API paths) | Optional (display only) |
| **Changeable?** | Never | Never (frozen at issuance) |
| **Merge-friendly?** | Yes (UUIDs don't collide) | Requires prefix scheme for multi-branch |
| **Controlled by?** | `gen_random_uuid()` | `document_sequences` table |

### Business Identifier Formats

| Document Type | Column | Prefix | Format Example |
|---|---|---|---|
| Invoice | `invoice_number` | `INV-` | `INV-00001` |
| Receipt | `receipt_number` | `RCT-` | `RCT-00001` |
| Payment | `payment_number` | `PAY-` | `PAY-00001` |
| Refund | `refund_number` | `RFD-` | `RFD-00001` |
| Credit Note (Phase 2) | `credit_note_number` | `CN-` | `CN-00001` |

### Why Two Identifiers?

| Reason | Explanation |
|---|---|
| **Performance** | UUIDs are ideal for internal indexing and distributed systems. Sequential numbers are poor for distributed PKs due to write contention. |
| **Security** | Exposing sequential IDs in APIs allows enumeration attacks. UUIDs prevent guessing of adjacent record IDs. |
| **Human usability** | `INV-00001` is easier for patients and staff to communicate than `a1b2c3d4-e5f6-...`. |
| **Audit compliance** | Sequential document numbers are required by tax authorities in many jurisdictions. Random UUIDs do not satisfy this requirement. |
| **Multi-branch** | UUIDs guarantee global uniqueness without coordination. Business identifiers use branch-specific prefixes (e.g., `BR1-INV-00001`). |

---

## 8. Cascade Policy

### Conceptual Cascade Behavior

The Billing module follows these cascade rules based on ownership relationships:

| Relationship | Ownership | Cascade Behavior | Rationale |
|---|---|---|---|
| `invoices` → `invoice_line_items` | Composition (parent owns child) | **RESTRICT** — parent cannot be deleted while children exist. Parent transitions to terminal status; children remain. | Financial records are never deleted. The status transition preserves children for audit. |
| `invoices` → `invoice_status_history` | Composition | **RESTRICT** — same as above. | Status history is append-only audit data. |
| `payments` → `payment_allocations` | Composition | **RESTRICT** — payment cannot be deleted while allocations exist. Payment reversal is handled via refund allocations, not deletion. | Prevents orphaned allocations and ensures audit integrity. |
| `payments` → `receipts` | Reference (receipt references payment) | **RESTRICT** — receipt references the payment. Payment reversal does not cascade to receipt. | Receipts are immutable proof of payment. A reversed payment does not invalidate the original receipt. |
| `receipts` → `receipt_invoices` | Composition | **RESTRICT** — standard composition behavior. | Receipt-invoice links should not be orphaned. |
| `payment_allocations` → `payment_allocations` (self) | Self-reference (refund) | **SET NULL** — if original allocation is removed, refund allocation's original_allocation_id is set to NULL. | Refund traceability is valuable but not mandatory for record integrity. A refund without an explicit original reference is still a valid financial record. |

### Cascade Decision Summary

| Entity | On Delete | On Update |
|---|---|---|
| Invoice → LineItem | RESTRICT | CASCADE (if invoice_id changes — unlikely) |
| Invoice → StatusHistory | RESTRICT | CASCADE |
| Payment → PaymentAllocation | RESTRICT | CASCADE |
| Payment → Receipt (reference) | RESTRICT (no cascade) | RESTRICT (no cascade) |
| Receipt → ReceiptInvoice | RESTRICT | CASCADE |
| PaymentAllocation → self (refund) | SET NULL | SET NULL |

### Cascade Violations Are Prevented by Business Logic

Cascade behavior at the database level is a safety net. The real protection comes from application-level business rules:

- Invoices cannot be deleted — they transition to Cancelled/Void
- Payments cannot be deleted — they are reversed via refund allocations
- Line items cannot be deleted after invoice issuance
- Receipts are never deleted

The RESTRICT constraints exist to catch bugs in the application layer, not to control normal operation.

---

## 9. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [05-constraints.md](05-constraints.md), [diagrams/foreign-key-map.md](diagrams/foreign-key-map.md) |
| **Next** | [05-constraints.md](05-constraints.md) |
