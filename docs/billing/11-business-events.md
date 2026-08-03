# Business Events — Billing Module

> **Document Type:** Domain Events Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Document important domain events that occur within the Billing module — each event represents a meaningful business occurrence that may trigger side effects, notifications, or downstream processes.

| Field | Value |
|---|---|
| Document | Business Events |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 07-workflows.md, 09-financial-invariants.md, 10-module-interaction-matrix.md |

---

## Table of Contents

1. [Event Model](#1-event-model)
2. [Invoice Events](#2-invoice-events)
3. [Payment Events](#3-payment-events)
4. [Receipt Events](#4-receipt-events)
5. [Discount Events](#5-discount-events)
6. [Refund Events](#6-refund-events)
7. [Credit Note Events](#7-credit-note-events)
8. [Patient Credit Events](#8-patient-credit-events)
9. [Integration Events (Future)](#9-integration-events-future)

---

## 1. Event Model

Each event is described using the following attributes:

| Attribute | Description |
|---|---|
| **Event Name** | Business name of the event |
| **Trigger** | Business action or system condition that causes the event |
| **Actor** | Who or what initiates the event (user role, system, external system) |
| **Business Outcome** | What happens as a result — within Billing and for downstream consumers |
| **Phase** | MVP, Phase 2, or Phase 3 |

---

## 2. Invoice Events

### Invoice Created

| Attribute | Description |
|---|---|
| **Trigger** | User creates a new invoice (draft) — from treatment plan or ad hoc |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Invoice exists in Draft status. Invoice number is reserved. Invoice is editable. |
| **Phase** | MVP |

### Invoice Issued

| Attribute | Description |
|---|---|
| **Trigger** | User issues a Draft invoice, transitioning it to Issued status |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Invoice is frozen — line items cannot be modified. Invoice number is committed. Invoice becomes available for payment collection. Patient may be notified (Phase 3). |
| **Phase** | MVP |

### Invoice Cancelled

| Attribute | Description |
|---|---|
| **Trigger** | User cancels an Issued invoice (no payments received) |
| **Actor** | Accountant, Billing Manager, Clinic Administrator |
| **Business Outcome** | Invoice transitions to Cancelled status. Invoice number is retired. If linked to a treatment plan, plan items become available for re-invoicing. |
| **Phase** | MVP |

### Invoice Voided

| Attribute | Description |
|---|---|
| **Trigger** | User voids an invoice after refunding all payments |
| **Actor** | Accountant (with approval), Clinic Administrator |
| **Business Outcome** | Invoice transitions to Void status. All payments refunded. Invoice number is retired. Complete audit trail preserved. |
| **Phase** | MVP |

### Invoice Overdue

| Attribute | Description |
|---|---|
| **Trigger** | Invoice due date passes with outstanding balance > 0 |
| **Actor** | System (scheduled process) |
| **Business Outcome** | Invoice transitions to Overdue status. Overdue invoice appears in receivables aging report. Patient may receive overdue notification (Phase 3). |
| **Phase** | Phase 2 |

### Invoice Paid

| Attribute | Description |
|---|---|
| **Trigger** | Total payments received ≥ invoice grand total |
| **Actor** | System (automatic, triggered by payment) |
| **Business Outcome** | Invoice transitions to Paid status. Outstanding balance is zero. Receipt is generated. |
| **Phase** | MVP |

---

## 3. Payment Events

### Payment Recorded

| Attribute | Description |
|---|---|
| **Trigger** | User records a payment against one or more invoices |
| **Actor** | Receptionist, Accountant, Billing Manager |
| **Business Outcome** | Payment is stored with method, amount, and allocation. Invoice payment status updates. Patient credit balance updates (if overpayment). |
| **Phase** | MVP |

### Payment Reversed

| Attribute | Description |
|---|---|
| **Trigger** | User reverses a previously recorded payment |
| **Actor** | Accountant, Clinic Administrator |
| **Business Outcome** | Payment is marked as reversed. Invoice outstanding balance increases by reversed amount. Receipt is adjusted (or reverse receipt generated). |
| **Phase** | MVP |

### Payment Allocation Updated

| Attribute | Description |
|---|---|
| **Trigger** | A payment allocation is modified (e.g., reallocation between invoices) |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Both affected invoices have their outstanding balances recalculated. |
| **Phase** | Phase 2 |

---

## 4. Receipt Events

### Receipt Generated

| Attribute | Description |
|---|---|
| **Trigger** | User explicitly generates a receipt via POST /billing/receipts with payment_id |
| **Actor** | Receptionist, Accountant, Billing Manager |
| **Business Outcome** | Receipt is created with unique number. Receipt is available for viewing, printing, and email delivery. |
| **Phase** | MVP |

### Receipt Reprint Requested

| Attribute | Description |
|---|---|
| **Trigger** | User or patient requests a copy of a previously generated receipt |
| **Actor** | Receptionist, Accountant, Patient (Phase 3) |
| **Business Outcome** | Receipt is retrieved and displayed/printed. Request is logged for audit. |
| **Phase** | MVP |

---

## 5. Discount Events

### Discount Applied

| Attribute | Description |
|---|---|
| **Trigger** | User applies a discount (below threshold — immediate) |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Line item or invoice total is reduced. Discount is recorded with user attribution. Invoice totals recalculated. |
| **Phase** | MVP |

### Discount Approval Requested

| Attribute | Description |
|---|---|
| **Trigger** | User applies a discount exceeding the configured threshold |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Approval request is created. Discount is pending — not yet applied. Approver is notified (in-app). |
| **Phase** | Phase 2 |

### Discount Approved

| Attribute | Description |
|---|---|
| **Trigger** | Approver approves the discount request |
| **Actor** | Billing Manager, Clinic Administrator |
| **Business Outcome** | Discount is applied to the invoice. Approval decision is recorded with approver, timestamp, and notes. Invoice totals recalculated. |
| **Phase** | Phase 2 |

### Discount Rejected

| Attribute | Description |
|---|---|
| **Trigger** | Approver rejects the discount request |
| **Actor** | Billing Manager, Clinic Administrator |
| **Business Outcome** | Discount is not applied. Rejection is recorded with reason. Original discount is removed. User must take corrective action. |
| **Phase** | Phase 2 |

### Discount Approval Expired

| Attribute | Description |
|---|---|
| **Trigger** | Approval request passes the configured expiry period without action |
| **Actor** | System (automatic) |
| **Business Outcome** | Pending approval is expired. Discount must be re-requested if still needed. |
| **Phase** | Phase 2 |

---

## 6. Refund Events

### Refund Processed

| Attribute | Description |
|---|---|
| **Trigger** | User processes a full or partial refund against a payment |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Payment is partially or fully reversed. Invoice outstanding balance recalculated. Refund receipt generated. Refund reason recorded. |
| **Phase** | Phase 2 |

### Refund Approval Requested

| Attribute | Description |
|---|---|
| **Trigger** | Refund amount exceeds the configured threshold |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Approval request is created. Refund is pending. Approver is notified. |
| **Phase** | Phase 2 |

---

## 7. Credit Note Events

### Credit Note Issued

| Attribute | Description |
|---|---|
| **Trigger** | User issues a credit note against an invoice |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Credit note is created with unique number. Reference to original invoice is recorded. Patient credit balance is increased (or invoice balance reduced if applied immediately). |
| **Phase** | Phase 2 |

### Credit Note Applied to Invoice

| Attribute | Description |
|---|---|
| **Trigger** | User applies a credit note to reduce an outstanding invoice balance |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Invoice outstanding balance is reduced by the applied credit amount. Credit note consumption is recorded. |
| **Phase** | Phase 2 |

### Credit Note Expired

| Attribute | Description |
|---|---|
| **Trigger** | Credit note passes its configurable validity period without being fully consumed |
| **Actor** | System (automatic) |
| **Business Outcome** | Remaining credit on the credit note can no longer be applied. The credit note transitions to Closed/Expired status. |
| **Phase** | Phase 2 |

### Credit Note Voided

| Attribute | Description |
|---|---|
| **Trigger** | User voids an unused credit note |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Credit note transitions to Void status. Any remaining credit is reversed. Void reason is recorded. |
| **Phase** | Phase 2 |

---

## 8. Patient Credit Events

### Overpayment Recorded

| Attribute | Description |
|---|---|
| **Trigger** | Payment exceeds invoice total and overpayment is confirmed |
| **Actor** | Receptionist, Accountant, Billing Manager |
| **Business Outcome** | Excess payment amount is recorded as patient credit. Patient credit balance increases. |
| **Phase** | MVP |

### Patient Credit Consumed

| Attribute | Description |
|---|---|
| **Trigger** | Patient credit is applied to an outstanding invoice |
| **Actor** | Accountant, Billing Manager |
| **Business Outcome** | Invoice balance is reduced. Patient credit balance decreases. |
| **Phase** | Phase 2 |

---

## 9. Integration Events (Future)

### Insurance Claim Submitted

| Attribute | Description |
|---|---|
| **Trigger** | Insurance claim is generated from invoice line items and submitted to provider |
| **Actor** | Insurance Desk Staff, System (automatic) |
| **Business Outcome** | Claim is recorded with status "Submitted." Insurance receivable is tracked. Invoice payment status may show partial insurance attribution. |
| **Phase** | Phase 3 |

### Accounting Export Completed

| Attribute | Description |
|---|---|
| **Trigger** | Scheduled or manual export of billing data to accounting software |
| **Actor** | System (automatic), Accountant |
| **Business Outcome** | Journal entries are generated. Export file is created and optionally uploaded to accounting platform. Export is logged for audit. |
| **Phase** | Phase 3 |

### Online Payment Received

| Attribute | Description |
|---|---|
| **Trigger** | Payment gateway processes a patient's online payment |
| **Actor** | Payment Gateway (external system) |
| **Business Outcome** | Payment is completed and allocated to the referenced invoice. Receipt can be generated. Invoice payment status is updated. |
| **Phase** | Phase 3 |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [07-workflows.md](07-workflows.md) |
| **Related** | [09-financial-invariants.md](09-financial-invariants.md), [10-module-interaction-matrix.md](10-module-interaction-matrix.md) |
| **Next Reading** | [12-search-and-reporting-specification.md](12-search-and-reporting-specification.md) |
