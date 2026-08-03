# Migration Strategy — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document defines the migration strategy for deploying the Billing module schema. It specifies the migration ordering, dependency resolution, data migration requirements (if any), and rollback considerations.

---

## 2. Migration Ordering

Migrations must be applied in dependency order. A table must exist before any table that references it.

### Migration Graph

```
Phase 1: Foundation (no dependencies)
├── document_sequences
├── tax_rates (Phase 2 — but no dependencies, can be added anytime)

Phase 2: Core Aggregates
├── invoices → depends on: document_sequences (for number generation)
├── invoice_line_items → depends on: invoices, tax_rates?
├── invoice_status_history → depends on: invoices

Phase 3: Payments
├── payments → depends on: document_sequences
├── payment_allocations → depends on: payments, invoices

Phase 4: Receipts
├── receipts → depends on: payments, document_sequences
├── receipt_invoices → depends on: receipts, invoices

Phase 5: Patient Credits
├── patient_credits → depends on: payments (for source allocation)

Phase 6: Credit Notes (Phase 2)
├── credit_notes → depends on: invoices, document_sequences
```

---

## 3. Migration Table

| Sequence | Migration | Dependencies | Phase | Rollback Risk |
|---|---|---|---|---|
| 1 | Create `document_sequences` | None | MVP | Low — no production data |
| 2 | Create `tax_rates` | None | Phase 2 | Low — configuration only |
| 3 | Create `invoices` | Seq 1 | MVP | High — financial data |
| 4 | Create `invoice_line_items` | Seq 3 | MVP | High — financial data |
| 5 | Create `invoice_status_history` | Seq 3 | MVP | Low — append-only log |
| 6 | Create `payments` | Seq 1 | MVP | High — financial data |
| 7 | Create `payment_allocations` | Seq 3, 6 | MVP | High — financial data |
| 8 | Create `receipts` | Seq 6 | MVP | Medium — financial data |
| 9 | Create `receipt_invoices` | Seq 3, 8 | MVP | Low — join table |
| 10 | Create `patient_credits` | Seq 6 | MVP | Low — derived data |
| 11 | Create `credit_notes` | Seq 1, 3 | Phase 2 | Medium — Phase 2 |
| 12 | Create `sequence_consumption_log` | Seq 1 | MVP | Low — log data |
| 13-25 | Create indexes (see 06-indexing-strategy) | All tables | MVP | Low — no data changes |

---

## 4. Seed Data Migrations

| Migration | Data | Purpose |
|---|---|---|
| Seed `document_sequences` | One row per document type: invoice, receipt, payment, refund, credit_note | Initial sequence values for numbering |
| Seed `tax_rates` (Phase 2) | Default zero-rated tax entries | Starting configuration |

### Document Sequence Seed Data

| `document_type` | `prefix` | `current_value` | `min_digits` | `start_value` |
|---|---|---|---|---|
| `invoice` | `INV-` | 0 | 5 | 1 |
| `receipt` | `RCT-` | 0 | 5 | 1 |
| `payment` | `PAY-` | 0 | 5 | 1 |
| `refund` | `RFD-` | 0 | 5 | 1 |
| `credit_note` | `CN-` | 0 | 5 | 1 |

---

## 5. Data Migration Rules

| Rule | Description |
|---|---|
| **No existing Billing data** | This is a new module. No data migration from a legacy system is required. |
| **External module data** | Patient, User, Doctor, and Treatment Plan data already exists in their respective schemas. Billing references them by UUID — no data copy needed. |
| **Idempotent migrations** | All migrations must be idempotent. Running the same migration twice must be safe. |

---

## 6. Rollback Strategy

| Scenario | Rollback Action |
|---|---|
| Index creation failed | Drop index, fix, re-run |
| Table creation failed | Drop table (no data yet), fix, re-run |
| Seed data insertion failed | Rollback transaction, fix data, re-run |
| Post-release rollback required | Create new migration(s) to add/drop/modify; never modify an already-applied migration |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [03-table-specifications.md](03-table-specifications.md) |
| **Related** | [13-schema-review-checklist.md](13-schema-review-checklist.md) |
| **Next** | [11-performance-considerations.md](11-performance-considerations.md) |
