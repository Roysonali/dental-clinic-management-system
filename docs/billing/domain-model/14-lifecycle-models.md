# Lifecycle Models — Billing Module

> **Document Type:** Lifecycle Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Lifecycle Models |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 09-domain-entities.md, 15-state-machines.md, 07-workflows.md |

---

## 1. Purpose

This document describes the lifecycle models for each main entity in the Billing domain. Each lifecycle defines the stages an entity passes through from creation to termination, the valid transitions between stages, and the business significance of each stage.

---

## 2. Invoice Lifecycle

```
                ┌─────────┐
                │  Draft  │
                └────┬────┘
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
        ┌──────────┐  ┌────────────┐
        │  Issued  │  │  Cancelled │
        └────┬─────┘  └────────────┘ (Terminal)
             │
        ┌────┴──────────────────────┐
        │           │               │
        ▼           ▼               ▼
  ┌──────────┐ ┌────────────┐ ┌──────────┐
  │   Paid   │ │ Partially │ │  Overdue │
  │          │ │   Paid     │ │          │
  └──────────┘ └────────────┘ └──────────┘
        │           │               │
        └───────────┴───────────────┘
                        │
                        ▼
                  ┌──────────┐
                  │   Void   │
                  │ (Terminal)│
                  └──────────┘
```

### Stage Definitions

| Stage | Phase | Description | Editable? | Key Actions |
|---|---|---|---|---|
| **Draft** | MVP | Invoice being prepared. Line items can be added, modified, or removed freely. | Yes (fully) | Add line items, apply discounts, preview, issue |
| **Issued** | MVP | Invoice sent to patient. Line items and totals are frozen. Available for payment. | No (line items) | Record payments, cancel (if unpaid), void (with refunds) |
| **PartiallyPaid** | MVP | Some payments received, balance remains. | No | Record additional payments, void (with refunds) |
| **Paid** | MVP | All charges have been settled. Outstanding balance is zero. | No | Void (with full refund) |
| **Overdue** | Phase 2 | Due date passed with outstanding balance. | No | Collection actions, record payments, void |
| **Cancelled** | MVP | Terminated before any payments received. | No (terminal) | View only |
| **Void** | MVP | Terminated after payments refunded. | No (terminal) | View only |

### Transition Triggers

| Transition | Trigger | Actor | Condition |
|---|---|---|---|
| Draft → Issued | Issue invoice | Accountant | At least one line item |
| Draft → Cancelled | Cancel invoice | Accountant | Always allowed |
| Draft → Void | Void invoice | Admin | Always allowed |
| Issued → Paid | Full payment | System (auto) | Payments ≥ grand total |
| Issued → PartiallyPaid | Partial payment | System (auto) | Payment < outstanding balance |
| Issued → Overdue | Time elapsed | System (scheduled) | Past due date + balance > 0 |
| Issued → Cancelled | Cancel invoice | Accountant | No payments received |
| Issued → Void | Void invoice | Admin | All payments refunded |
| PartiallyPaid → Paid | Full payment | System (auto) | Payments ≥ grand total |
| PartiallyPaid → Overdue | Time elapsed | System (scheduled) | Past due date + balance > 0 |
| PartiallyPaid → Cancelled | Cancel invoice | Accountant | No remaining payments expected |
| PartiallyPaid → Void | Void invoice | Admin | All payments refunded |
| Paid → Void | Void invoice | Admin | All payments refunded |
| Overdue → Paid | Payment received | System (auto) | Balance fully paid |
| Overdue → PartiallyPaid | Partial payment | System (auto) | Payment received |
| Overdue → Cancelled | Cancel invoice | Accountant | No payments received |
| Overdue → Void | Void invoice | Admin | All payments refunded |

### Invalid Transitions

| From → To | Reason |
|---|---|
| Draft → Paid | Cannot skip Issued state — invoice must be issued before payment can be recorded |
| Draft → Overdue | Cannot be overdue without being issued first |
| Issued → Draft | Reversal not permitted after issuance (immutability) |
| Cancelled → Any | Terminal state |
| Void → Any | Terminal state |
| Paid → Issued | Cannot revert payment status |
| Paid → PartiallyPaid | Only refunds can reduce paid amount (Phase 2) |

---

## 3. Payment Lifecycle

```
    ┌─────────┐
    │ Pending │
    └────┬────┘
         │
    ┌────┴────┬────────┐
    │         │        │
    ▼         ▼        ▼
┌─────────┐ ┌────────┐ ┌──────┐
│Completed│ │ Failed │ │ Void │
│         │ │        │ │(Term)│
└────┬────┘ └────────┘ └──────┘
     │
    ┌┴──────────┐
    │           │
    ▼           ▼
┌──────────┐ ┌──────────┐
│ Refunded │ │ Reversed │
│ (Term)   │ │ (Term)   │
└──────────┘ └──────────┘
```

### Stage Definitions

| Stage | Description | Terminal? |
|---|---|---|
| Pending | Payment initiated, awaiting completion | No |
| Completed | Payment successfully processed | No |
| Failed | Payment declined or processing error | No (can retry to Pending) |
| Void | Voided by admin before completion | Yes |
| Refunded | All funds returned to patient | Yes |
| Reversed | Payment reversed after completion | Yes |

---

## 4. Credit Note Lifecycle

```
                ┌─────────┐
                │  Draft  │
                └────┬────┘
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
        ┌──────────┐  ┌──────────┐
        │  Issued  │  │   Void   │
        └────┬─────┘  └──────────┘ (Terminal)
             │
        ┌────┴──────────────────┐
        │            │          │
        ▼            ▼          ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Applied  │ │ Expired  │ │   Void   │
  │(Terminal)│ │(Terminal)│ │(Terminal)│
  └──────────┘ └──────────┘ └──────────┘
```

### Stage Definitions

| Stage | Description | Terminal? |
|---|---|---|
| Draft | Being prepared, fully editable | No |
| Issued | Finalized, immutable, available for application | No |
| Applied | Full credit consumed against invoice | Yes |
| Expired | Validity period passed with balance remaining | Yes |
| Void | Cancelled before or after issuance | Yes |

---

## 5. Receipt Lifecycle

```
┌─────────────┐
│  Generated  │ ← Created via explicit API call
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Cancelled  │ ← Terminal
└─────────────┘
```

Receipts have a simple lifecycle: created once via explicit API call and either remain generated (immutable) or are cancelled.

---

## 6. PatientCredit Lifecycle

```
┌───────────┐
│  Created  │ ← From overpayment, credit note, or advance payment (Phase 3)
└─────┬─────┘
      │
      ▼
┌────────────┐
│  Available │ ← Ready to be applied to future invoices
└─────┬──────┘
      │
      ├──→ Consumed (applied to invoice) → Depleted
      ├──→ Expired (if credit note source has expiry)
      └──→ Refunded (returned to patient)
```

---

## 7. LineItem Lifecycle

```
┌───────────┐
│  Added    │ ← When invoice is in Draft
└─────┬─────┘
      │
      ▼
┌───────────┐
│  Editable │ ← Line item can be modified while parent invoice is Draft
└─────┬─────┘
      │
      ▼
┌───────────┐
│  Frozen   │ ← Parent invoice issued — line item is immutable
└─────┬─────┘
      │
      ▼
┌───────────┐
│ Preserved │ ← Parent invoice cancelled/voided — data retained for audit
└───────────┘
```

---

## 8. Lifecycle Comparison Table

| Entity | Initial State | Terminal State(s) | Immutable At | Created By |
|---|---|---|---|---|
| Invoice | Draft | Cancelled, Void | Issued | User |
| LineItem | Added | Frozen | Invoice issued | User (via invoice) |
| Payment | Pending | Refunded, Reversed, Void | Completed | User |
| PaymentAllocation | Created | Reversed | Created | System (via payment) |
| Receipt | Generated | Generated (cancelled possible) | Generated | User (explicit API call) |
| CreditNote | Draft | Applied, Expired, Void | Issued | User |
| PatientCredit | Created | Depleted, Expired, Refunded | Created | System (auto) |
| InvoiceStatusHistory | Created | Append-only (never terminates) | Created | System (auto) |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [09-domain-entities.md](09-domain-entities.md) |
| **Related** | [15-state-machines.md](15-state-machines.md), [07-workflows.md](../07-workflows.md) |
| **Next Reading** | [15-state-machines.md](15-state-machines.md) |
