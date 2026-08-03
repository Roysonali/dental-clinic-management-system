# Audit and Versioning — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document defines the audit trail and versioning mechanisms for the Billing module. It covers audit columns, status history tables, version fields for optimistic locking, and the policies governing financial record immutability.

---

## 2. Audit Columns (Every Table)

Every core table in the Billing module includes the following audit columns:

| Column | Type | Nullable | Description |
|---|---|---|---|
| `created_by` | `UUID` | NO | User who created the record |
| `created_at` | `TIMESTAMPTZ` | NO | Timestamp of creation |
| `updated_by` | `UUID` | NO | User who last modified the record |
| `updated_at` | `TIMESTAMPTZ` | NO | Timestamp of last modification |

**Tables with audit columns:** All core tables (invoices, invoice_line_items, payments, payment_allocations, receipts, credit_notes, patient_credits, document_sequences, tax_rates).

**Tables without audit columns:** Join tables (`receipt_invoices`) and append-only log tables (`invoice_status_history`, `sequence_consumption_log`) — these are inherently self-auditing.

---

## 3. Status History Tables

Status changes on core entities are recorded in dedicated history tables:

| Entity | History Table | Phase | Records |
|---|---|---|---|
| Invoice | `invoice_status_history` | MVP | Every status transition with old/new status, user, timestamp, reason |
| Payment | (via version tracking) | MVP | Payment status tracked via version column + `updated_at` |
| CreditNote | (via version tracking) | Phase 2 | Credit note status tracked via version column + `updated_at` |

### 3.1 `invoice_status_history` Schema

| Column | Type | Description |
|---|---|---|
| `status_history_id` | UUID PK | Primary key |
| `invoice_id` | UUID FK | Parent invoice |
| `from_status` | VARCHAR(30) | Previous status (NULL for first entry) |
| `to_status` | VARCHAR(30) | New status |
| `changed_by` | UUID | User who triggered change |
| `changed_at` | TIMESTAMPTZ | When change occurred |
| `reason` | TEXT | Reason for change |

**Append-only:** Records in this table are never modified or deleted.

---

## 4. Append-Only Policy

| Record Type | Append-Only? | Immutable After |
|---|---|---|
| Issued invoices | Yes | Line items frozen at issuance; status transitions still recorded |
| Completed payments | Yes | Amount and method frozen; reversals create new allocations |
| Generated receipts | Yes | Immutable from creation |
| Issued credit notes | Yes | Immutable from issuance |
| Status history | Yes | Immutable from creation |
| Payment allocations | Yes | Immutable from creation; refunds create new allocation records |
| Sequence consumption log | Yes | Immutable from creation |

---

## 5. Version Columns

Core tables include a `version` integer column for optimistic locking:

| Table | Version Column | Start Value | Incremented On |
|---|---|---|---|
| `invoices` | `version` | 1 | Any column update |
| `invoice_line_items` | `version` | 1 | Any column update |
| `payments` | `version` | 1 | Any column update |
| `credit_notes` | `version` | 1 | Any column update |

**Tables without versioning:** `invoice_status_history` (append-only), `receipts` (immutable after creation), `payment_allocations` (immutable after creation), `document_sequences` (row-level lock), `sequence_consumption_log` (append-only).

---

## 6. Created/Updated Timestamp Policies

| Policy | Implementation |
|---|---|
| **Creation** | `created_at` set to `NOW()` on INSERT. Never modified. |
| **Update** | `updated_at` set to `NOW()` on UPDATE. Updated on every modification. |
| **Time zone** | Always UTC. `TIMESTAMPTZ` ensures correct timezone handling. |
| **Application-layer** | Timestamps are set by the database default, not by the application. |

---

## 7. User Attribution Policies

| Policy | Implementation |
|---|---|
| **Creation user** | `created_by` set on INSERT from authenticated user context. Never modified. |
| **Update user** | `updated_by` set on UPDATE from authenticated user context. |
| **System actions** | System-triggered operations (overdue detection, receipt generation) use a dedicated system user UUID. |
| **Deletion** | Financial records are never deleted. No `deleted_by` column. |

---

## 8. Financial Record Deletion Policy

### Core Principle: Never Delete Financial Records

Financial records in the Billing module are **never physically or logically deleted**. This is a non-negotiable architectural policy driven by:

1. **Regulatory compliance:** Tax and financial regulations require retention of financial documents for a minimum period (typically 7 years). Deletion — even soft deletion — violates this requirement.
2. **Audit integrity:** An auditor must be able to trace any financial document. A deleted record creates an unexplained gap.
3. **Patient trust:** Patients expect that their billing history is permanently available for reference.
4. **Legal discovery:** In the event of a dispute, both parties must have access to the original financial records.

### Lifecycle Through Status Transitions

Instead of deletion, financial records progress through status transitions to terminal states:

| Entity | Created As | Terminal State(s) | Transition Trigger |
|---|---|---|---|
| Invoice | `draft` | `cancelled` (no payments), `void` (payments refunded) | User action with reason required |
| Line Item | `Added to Draft` | `Frozen` (invoice issued), `Preserved` (invoice cancelled/voided) | Parent invoice status change |
| Payment | `completed` | `refunded` (all funds returned), `failed` (gateway error) | Refund processing or gateway event |
| Receipt | `generated` | `cancelled` | User action via explicit API call |
| Credit Note | `draft` | `applied` (fully consumed), `expired` (time passed), `void` (cancelled) | Application, expiry, or void action |

### What Happens When a Record Would Be "Deleted"

| User Intent | Actual System Behavior |
|---|---|
| "Delete a draft invoice" | Transition to `Cancelled` status. Data remains visible in audit views. |
| "Remove a line item from draft" | Line item record remains with `is_removed = TRUE` or similar flag (or simply excluded from the invoice — the data is still in the table). |
| "Delete a payment that was recorded by mistake" | If no allocation has been made, the payment can be cancelled/voided. If allocation exists, a refund is processed. |
| "Remove a receipt" | Receipts are immutable and cannot be removed. If the payment was in error, a refund receipt is generated (original receipt remains valid as proof of initial payment). |
| "Purge old records to save space" | Not permitted. Archival strategies may be considered for records older than regulatory retention period (minimum 7 years). |

### Data Retention Summary

| Record Type | Retention Period | Disposal Method |
|---|---|---|
| Active invoices | Indefinite (must be accessible) | N/A |
| Cancelled/Void invoices | Regulatory minimum (default 7 years) | Offline archival after retention period |
| Payments | Indefinite | N/A |
| Receipts | Indefinite | N/A |
| Audit logs | Regulatory minimum (default 7 years) | Offline archival |
| Sequence consumption logs | Regulatory minimum (default 7 years) | Offline archival |

---

## 9. Soft Delete Prohibition

The Billing schema explicitly prohibits soft deletion of financial records:

| Entity | Alternative | Rationale |
|---|---|---|
| Invoice | Cancelled / Void status | BR-116 — cannot hard-delete after Draft |
| Payment | Reversal flag + refund allocations | BR-117 — cannot hard-delete |
| Receipt | Not applicable | Receipts are never deleted |
| Credit Note | Void status | BR-97 — immutable after issuance |
| Line Item | Not applicable | Immutable after invoice issuance |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [09-optimistic-locking.md](09-optimistic-locking.md), [13-audit-requirements.md](../13-audit-requirements.md) |
| **Next** | [09-optimistic-locking.md](09-optimistic-locking.md) |
