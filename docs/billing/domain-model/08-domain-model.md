# Domain Model — Billing Module

> **Document Type:** Domain Architecture Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Domain Model |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 09-domain-entities.md, 10-value-objects.md, 11-aggregate-design.md, 12-entity-relationships.md |

---

## 1. Purpose

This document defines the core domain model for the Billing module. It establishes the conceptual building blocks — aggregates, entities, value objects, domain services, and their relationships — that collectively model the business of dental billing within the DensCare Modular Monolith.

The domain model is **implementation-independent**. It describes *what* the domain is, not *how* it is built. Database schema, ORM models, API endpoints, and service implementations are derived from this model but are outside its scope.

---

## 2. Bounded Context

The Billing module operates within the **Revenue Cycle** bounded context of DensCare:

```
┌─────────────────────────────────────────────────────┐
│                 Revenue Cycle Context                │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │
│  │   Clinical   │ → │   Billing    │ → │ Financial │ │
│  │  Treatment   │   │   (This)     │   │  Reports  │ │
│  │    Plans     │   │              │   │          │ │
│  └──────────────┘   └──────────────┘   └──────────┘ │
│         │                   │                        │
│         ▼                   ▼                        │
│  ┌──────────────┐   ┌──────────────┐                │
│  │  Patient     │   │  Insurance   │                │
│  │  Records     │   │  (Future)    │                │
│  └──────────────┘   └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

**Context boundary:** The Billing context owns financial transaction data and is responsible for invoice lifecycle, payment collection, receipting, refunds, and credit notes. It references but does not own clinical data (patients, treatment plans, appointments).

---

## 3. Core Domain Concepts

### 3.1 Invoice

The central concept in the billing domain. An Invoice represents a financial document that itemizes charges owed by a patient for dental services. It is the **aggregate root** of the billing subdomain.

- **Purpose:** To formally request payment from a patient for services rendered
- **Lifecycle:** Draft → Issued → Paid/Overdue → Terminal (Cancelled/Void)
- **Ownership:** Owns LineItems; references Patient, optionally TreatmentPlan, Doctor, Appointment
- **Key invariant:** Immutable after issuance (see [09-financial-invariants.md](../09-financial-invariants.md))

### 3.2 Line Item

A single charge entry on an invoice. Each line item represents a procedure, product, or fee being billed.

- **Purpose:** To itemize individual charges within an invoice
- **Ownership:** Child entity of Invoice aggregate
- **Key characteristic:** Cannot exist independently — always belongs to exactly one invoice

### 3.3 Payment

A financial transaction where money is transferred from patient to clinic. Payments can be partial (covering part of an invoice) or consolidated (covering multiple invoices).

- **Purpose:** To record the receipt of funds from a patient
- **Lifecycle:** Pending → Completed → Refunded/Reversed/Void
- **Ownership:** Independent aggregate root
- **Relationship:** Allocated to one or more invoices via PaymentAllocation

### 3.4 PaymentAllocation

The join entity that links a Payment to one or more Invoices, recording how much of a payment is applied to each invoice.

- **Purpose:** To enable partial, multi-invoice, and overpayment scenarios
- **Ownership:** Child entity of the Payment aggregate root
- **Key invariant:** Sum of allocations must equal payment amount

### 3.5 Receipt

A document acknowledging receipt of payment. It serves as the patient's proof of payment.

- **Purpose:** To provide formal acknowledgment of payment
- **Lifecycle:** Generated via explicit API call; immutable once created
- **Ownership:** Independent aggregate root (read-only after creation)

### 3.6 Credit Note

A financial document issued to correct an invoice — for price adjustments, returned services, or billing errors.

- **Purpose:** To adjust an invoice without modifying the original document
- **Lifecycle:** Draft → Issued → Applied/Expired/Void
- **Ownership:** Independent aggregate root

### 3.7 Refund

The process of returning funds to a patient. A refund reverses a previously recorded payment.

- **Purpose:** To return money to a patient when owed
- **Lifecycle:** Single-step operation; recorded as part of Payment reversal
- **Ownership:** Part of Payment aggregate (reversal allocation)

### 3.8 Discount

A reduction in the amount charged. Discounts can be applied at the line-item level or the invoice level.

- **Purpose:** To reduce charges for promotional, hardship, or adjustment reasons
- **Ownership:** Property of LineItem or Invoice; not a standalone entity
- **Key constraint:** Discounts above configured threshold require approval (Phase 2)

### 3.9 Patient Credit

A balance of excess payment or credit note value that is available for future invoices.

- **Purpose:** To track funds or credits owed to a patient that can be applied to future charges
- **Ownership:** Child entity or aggregate within Billing context

---

## 4. Ubiquitous Language

| Billing Term | Definition | Notes |
|---|---|---|
| **Invoice** | A financial document itemizing charges owed by a patient | Aggregate root |
| **Line Item** | A single charge entry on an invoice | Child of Invoice |
| **Payment** | A financial transaction transferring funds from patient to clinic | Aggregate root |
| **Payment Allocation** | The association of a payment amount to a specific invoice | Child of Payment |
| **Receipt** | A formal acknowledgment of payment received | Aggregate root |
| **Credit Note** | A document correcting an issued invoice | Aggregate root |
| **Refund** | Returning funds to a patient | Part of Payment |
| **Discount** | A reduction in charges | Value on LineItem/Invoice |
| **Patient Credit** | Available balance from overpayment or credit note | Value object |
| **Outstanding Balance** | The remaining amount due on an invoice | Computed value |
| **Grand Total** | The total amount payable on an invoice (subtotal − discount + tax) | Computed value |

---

## 5. Domain Model Principles

The Billing domain model adheres to the following principles:

| Principle | Application |
|---|---|
| **Aggregate root consistency** | All mutations to an aggregate's members go through the aggregate root. External references use the aggregate root's identity. |
| **Immutability of financial records** | Issued invoices, completed payments, generated receipts, and issued credit notes are immutable. Modifications are not permitted — corrections create new documents. |
| **Derived values** | Financial amounts (subtotal, discount total, tax total, grand total, outstanding balance) are always computed, never stored independently. See [16-financial-calculation-model.md](16-financial-calculation-model.md). |
| **Cross-aggregate eventual consistency** | When a Payment is recorded and allocated to an Invoice, the Invoice's outstanding balance is updated. If these are separate aggregates, this may involve eventual consistency via domain events. |
| **Audit trail** | Every financial mutation is recorded with user, timestamp, and reason. See [13-audit-requirements.md](../13-audit-requirements.md). |

---

## 6. Model Navigation

| Direction | Documents |
|---|---|
| **Next** | [09-domain-entities.md](09-domain-entities.md) — Detailed entity definitions |
| **Related** | [10-value-objects.md](10-value-objects.md), [11-aggregate-design.md](11-aggregate-design.md) |
| **Phase 1 Reference** | [06-business-rules.md](../06-business-rules.md), [09-financial-invariants.md](../09-financial-invariants.md) |
