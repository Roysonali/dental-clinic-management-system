# Domain Services — Billing Module

> **Document Type:** Domain Service Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Domain Services |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 08-domain-model.md, 11-aggregate-design.md |

---

## 1. Purpose

This document defines the domain services within the Billing module. Domain services encapsulate operations that do not naturally belong to a single aggregate root — either because they involve multiple aggregates or because they are stateless computational operations.

---

## 2. Service Classification

| Service Type | Description |
|---|---|
| **Aggregate Service** | Orchestrates operations across multiple aggregates |
| **Calculation Service** | Performs stateless financial computations |
| **Policy Service** | Evaluates configurable business policies against an operation |
| **Sequence Service** | Manages document number generation |
| **Notification Service** | Triggers cross-context notifications (Phase 3) |

---

## 3. Domain Service Catalog

### 3.1 Invoice Generation Service

| Attribute | Description |
|---|---|
| **Type** | Aggregate Service |
| **Phase** | MVP |
| **Purpose** | Generates an invoice from a treatment plan, copying plan items as invoice line items |
| **Actors** | Accountant, Billing Executive |
| **Aggregates Involved** | Invoice (create), TreatmentPlan (read, mark items invoiced) |

**Responsibilities:**

- Validate that the treatment plan is in an eligible status (Accepted, In Progress)
- Validate that no active invoice exists for the treatment plan (BR-121)
- Copy selected treatment plan items as invoice line items with cost estimates as default prices
- Track price overrides when the user modifies prices from the plan estimates
- Mark plan items as invoiced after successful invoice creation
- Support partial billing (only selected items from the plan)
- Support multi-plan consolidation (items from multiple plans on one invoice)

**Inputs:**

- Treatment plan ID(s)
- Patient ID
- User ID (acting user)
- Optional: selected plan item IDs (for partial billing)

**Outputs:**

- Created Invoice aggregate (Draft status)
- Updated treatment plan item status (marked as invoiced)
- Audit trail entries for price overrides (if any)

---

### 3.2 Payment Allocation Service

| Attribute | Description |
|---|---|
| **Type** | Aggregate Service |
| **Phase** | MVP |
| **Purpose** | Allocates a payment across one or more invoices, creating PaymentAllocation records and updating invoice balances |
| **Actors** | Receptionist, Accountant |
| **Aggregates Involved** | Payment (create), Invoice (read/compute), PatientCredit (create if overpayment) |

**Responsibilities:**

- Create Payment aggregate with validated amount and method
- Validate allocation amounts against invoice outstanding balances
- Create PaymentAllocation records for each invoice
- Detect overpayment and trigger PatientCredit creation
- Update invoice statuses (Paid, PartiallyPaid) based on new balances
- Generate Receipt aggregate via explicit API call (receipt generation service)

**Scenarios:**

| Scenario | Behavior |
|---|---|
| Full payment, single invoice | One Payment, one PaymentAllocation, Invoice → Paid |
| Partial payment, single invoice | One Payment, one PaymentAllocation, Invoice → PartiallyPaid |
| Multi-invoice payment | One Payment, multiple PaymentAllocations, each invoice updated |
| Overpayment | Payment, allocation capped at invoice total, PatientCredit for excess |

---

### 3.3 Invoice Numbering Service

| Attribute | Description |
|---|---|
| **Type** | Sequence Service |
| **Phase** | MVP |
| **Purpose** | Generates sequential, gapless document numbers for invoices, receipts, payments, refunds, and credit notes |
| **Aggregates Involved** | DocumentSequence |

**Responsibilities:**

- Reserve the next number from the document_sequences table using row-level locking
- Return the formatted document number (prefix + padded sequence)
- Log the consumption in the sequence_consumption table (for audit)
- Handle failure cases: if document creation fails after number reservation, the number is consumed but marked as failed in the audit log

**Number Formats:**

| Document Type | Prefix | Example | Sequence |
|---|---|---|---|
| Invoice | INV- | INV-00001 | Invoice sequence |
| Receipt | RCT- | RCT-00001 | Receipt sequence |
| Payment | PAY- | PAY-00001 | Payment sequence |
| Refund | RFD- | RFD-00001 | Refund sequence |
| Credit Note | CN- | CN-00001 | Credit note sequence |

---

### 3.4 Refund Processing Service (Phase 2)

| Attribute | Description |
|---|---|
| **Type** | Aggregate Service |
| **Phase** | Phase 2 |
| **Purpose** | Processes a refund by creating a refund PaymentAllocation that reverses the original allocation, updating invoice balances |
| **Actors** | Accountant, Billing Manager |
| **Aggregates Involved** | Payment (read), PaymentAllocation (create), Invoice (read/compute) |

**Responsibilities:**

- Validate refund amount does not exceed original payment amount
- Create refund PaymentAllocation (is_refund = true) referencing the original allocation
- Update the invoice's outstanding balance (increase by refund amount)
- Update payment status (Refunded)
- Generate refund receipt
- Enforce refund threshold approval workflow (if configured)

---

### 3.5 Discount Approval Service (Phase 2)

| Attribute | Description |
|---|---|
| **Type** | Policy Service |
| **Phase** | Phase 2 |
| **Purpose** | Evaluates whether a discount requires approval and manages the approval workflow |
| **Actors** | Accountant (requester), Billing Manager/Admin (approver) |
| **Aggregates Involved** | Invoice (read), ApprovalRequest (external or within Discount VO) |

**Responsibilities:**

- Compare discount value against configured threshold (percentage and/or fixed amount)
- If below threshold: allow immediate application
- If above threshold: create approval request, route to approver
- On approval: apply discount and recalculate totals
- On rejection: notify requester, keep discount unapplied
- Enforce approval expiry (configurable period)

---

### 3.6 Tax Calculation Service (Phase 2)

| Attribute | Description |
|---|---|
| **Type** | Calculation Service |
| **Phase** | Phase 2 |
| **Purpose** | Computes tax amounts for line items based on configured tax rates |
| **Actors** | System (automatic) |

**Responsibilities:**

- Apply configured tax rate(s) to line item net amount
- Support multiple tax rates per line item (e.g., GST + PST)
- Round tax amounts using standard financial rounding
- Support tax-exempt line items with exemption reason recording
- Freeze applied tax rate details (name, rate) on the line item at invoice creation

**Inputs:**

- Line item net amount
- Selected tax rate(s) with current rates
- Tax exemption status (if applicable)

**Outputs:**

- Line item tax amount(s)
- Total tax amount for the invoice

---

### 3.7 Overdue Detection Service

| Attribute | Description |
|---|---|
| **Type** | Batch Service |
| **Phase** | Phase 2 |
| **Purpose** | Scheduled service that identifies invoices past their due date with outstanding balance and transitions them to Overdue status |
| **Actors** | System (scheduled task) |

**Responsibilities:**

- Query for invoices in Issued or PartiallyPaid status past their due date
- Transition qualifying invoices to Overdue status
- Record status transition in InvoiceStatusHistory
- Make overdue data available for reporting and collections workflows

---

## 4. Service Interaction Map

```
                    ┌──────────────────────────┐
                    │  Invoice Generation       │
                    │  Service                  │
                    │                           │
                    │  TP → Invoice + LineItems │
                    └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────────┐
                    │  Payment Allocation       │
                    │  Service                  │
                    │                           │
                    │  Payment + Allocations    │
                    │  + Receipt                │
                    └──────────┬───────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
  │ Refund       │   │ Discount     │   │ Tax Calculation  │
  │ Processing   │   │ Approval     │   │ Service          │
  │ Service      │   │ Service      │   │ (Phase 2)        │
  │ (Phase 2)    │   │ (Phase 2)    │   │                  │
  └──────────────┘   └──────────────┘   └──────────────────┘

                    ┌──────────────────────────┐
                    │  Invoice Numbering        │
                    │  Service                  │
                    │                           │
                    │  (Utility — used by all   │
                    │   document creation)      │
                    └──────────────────────────┘
```

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [11-aggregate-design.md](11-aggregate-design.md) |
| **Related** | [14-lifecycle-models.md](14-lifecycle-models.md), [16-financial-calculation-model.md](16-financial-calculation-model.md) |
| **Next Reading** | [14-lifecycle-models.md](14-lifecycle-models.md) |
