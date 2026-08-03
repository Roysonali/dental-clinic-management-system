# Entity-to-Table Mapping — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document maps each domain entity from the Phase 2 domain model to its corresponding database table(s). It documents how aggregates, entities, and value objects are represented in the relational schema.

---

## 2. Mapping Legend

| Domain Concept | Representation |
|---|---|
| Aggregate Root | Primary table for the aggregate |
| Child Entity | Child table with FK to aggregate root |
| Value Object | Inlined as columns in the owning table |
| Enum Value Object | VARCHAR column (never ENUM) |
| Domain Event | Status history table |
| Composition | FK with NOT NULL constraint |

---

## 3. Mapping Table

| Domain Entity | Type | Table(s) | Phase | FK References | Notes |
|---|---|---|---|---|---|
| **Invoice** | Aggregate Root | `invoices` | MVP | `patient_id`, `treatment_plan_id?`, `doctor_id?`, `appointment_id?` | Core financial document |
| **LineItem** | Child Entity | `invoice_line_items` | MVP | `invoice_id` (composition) | Owned by Invoice |
| **InvoiceStatusHistory** | Child Entity | `invoice_status_history` | MVP | `invoice_id` (composition) | Append-only audit |
| **Payment** | Aggregate Root | `payments` | MVP | `patient_id` | Supports multi-invoice |
| **PaymentAllocation** | Child Entity | `payment_allocations` | MVP | `payment_id` (composition), `invoice_id` | Join entity |
| **Receipt** | Aggregate Root | `receipts` | MVP | `payment_id`, `invoice_id` (via join) | Read-only |
| **CreditNote** | Aggregate Root | `credit_notes` | Phase 2 | `invoice_id`, `patient_id` | Independent aggregate |
| **PatientCredit** | Aggregate Root | `patient_credits` | MVP (basic) / Phase 3 (wallet) | `patient_id`, `source_allocation_id?`, `source_credit_note_id?` | Overpayment tracking |
| **DocumentSequence** | Utility Root | `document_sequences` | MVP | None | Number generation |
| **SequenceConsumptionLog** | Child Entity | `sequence_consumption_log` | MVP | `document_sequence_type` (logical) | Audit of number consumption |

---

## 4. Value Object Mapping

| Value Object | Mapped To | Representation |
|---|---|---|
| Money | Various `_amount` columns | `NUMERIC(12,2)` in owning table |
| InvoiceNumber | `invoices.invoice_number` | `VARCHAR(30)` — formatted string |
| InvoiceStatus | `invoices.status` | `VARCHAR(30)` |
| PaymentMethod | `payments.payment_method` | `VARCHAR(30)` — extensible |
| PaymentStatus | `payments.status` | `VARCHAR(30)` |
| CreditNoteStatus | `credit_notes.status` | `VARCHAR(30)` (Phase 2) |
| Discount | `invoice_line_items.discount_type` + `discount_amount` + `discount_percentage` | Two columns: type + one of amount/percentage |
| TaxRate | `tax_rates` (reference table) | Normalized table (Phase 2) |
| DateRange | Filter query parameters | Not stored — query-time only |

---

## 5. Value Inlining Decisions

| Value Object | Inlined? | Reason |
|---|---|---|
| Money (amounts) | ✅ Inlined | Monetary amounts are scalar values attached to a single entity |
| Discount | ✅ Inlined | Discount is always part of a LineItem or Invoice row |
| InvoiceNumber | ✅ Inlined | Invoice number is inseparable from the invoice |
| TaxRate | ❌ Normalized | Tax rates are shared reference data, not entity attributes |
| PaymentMethod | ✅ Inlined | Method is a simple attribute of the payment |
| Status | ✅ Inlined | Status is a simple attribute of the owning entity |

---

## 6. Non-Domain Tables

These tables exist to support domain operations but do not directly represent domain entities:

| Table | Purpose | Notes |
|---|---|---|
| `document_sequences` | Sequential number generation | One row per document type |
| `sequence_consumption_log` | Audit of number consumption | Records every reserved number |
| `tax_rates` | Tax rate configuration (Phase 2) | Reference data |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-database-overview.md](01-database-overview.md) |
| **Related** | [domain-model/09-domain-entities.md](../domain-model/09-domain-entities.md) |
| **Next** | [03-table-specifications.md](03-table-specifications.md) |
