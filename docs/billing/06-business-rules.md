# Business Rules — Billing Module

> **Document Type:** Business Rules Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Phase Labels:** [MVP], [PHASE 2], [PHASE 3] identify the target implementation phase for each rule.

| Field | Value |
|---|---|
| Document | Business Rules Specification |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 02-functional-requirements.md, 07-workflows.md, glossary.md |

---

## Table of Contents

1. [Core Financial Rules](#1-core-financial-rules)
2. [Invoice Lifecycle Rules](#2-invoice-lifecycle-rules)
3. [Line Item Rules](#3-line-item-rules)
4. [Pricing and Discount Rules](#4-pricing-and-discount-rules)
5. [Tax Rules](#5-tax-rules)
6. [Payment Rules](#6-payment-rules)
7. [Receipt Rules](#7-receipt-rules)
8. [Refund Rules](#8-refund-rules)
9. [Credit Note Rules](#9-credit-note-rules)
10. [Numbering Rules](#10-numbering-rules)
11. [Audit and Immutability Rules](#11-audit-and-immutability-rules)
12. [Treatment Plan Integration Rules](#12-treatment-plan-integration-rules)
13. [Discount Approval Rules (Phase 2)](#13-discount-approval-rules-phase-2)
14. [Multi-currency Rules (Phase 3)](#14-multi-currency-rules-phase-3)
15. [Patient Wallet Rules (Phase 3)](#15-patient-wallet-rules-phase-3)

---

## 1. Core Financial Rules

These rules govern the fundamental financial integrity of the Billing module.

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-1 | Every invoice SHALL reference exactly one patient | An invoice is a financial document owed by a specific patient or responsible party | MVP |
| BR-2 | Every invoice SHALL have at least one line item | An invoice with no charges is not a valid financial document | MVP |
| BR-3 | Every invoice SHALL have a unique invoice number | Legal and audit requirement for financial documents | MVP |
| BR-4 | Invoice totals SHALL be computed by the system, not accepted from client input | Prevents tampering with financial amounts | MVP |
| BR-5 | The grand total of an invoice SHALL equal: subtotal − total discount + total tax | Standard financial formula; must be enforced server-side | MVP |
| BR-6 | All monetary amounts SHALL be stored with precision appropriate to the currency (default: 2 decimal places) | Prevents rounding errors in financial calculations | MVP |
| BR-7 | A negative total on an invoice SHALL NOT be permitted | An invoice represents charges owed; negative totals require a credit note, not a negative invoice | MVP |
| BR-8 | Financial records SHALL NOT be hard-deleted after creation | Legal requirement for financial document retention and audit | MVP |

---

## 2. Invoice Lifecycle Rules

These rules govern the status transitions and lifecycle of invoices.

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-10 | An invoice SHALL start in Draft status | Allows review before issuing | MVP |
| BR-11 | An invoice in Draft status SHALL be editable (line items, prices, discounts, notes) | Draft is working state | MVP |
| BR-12 | An invoice in Issued status SHALL NOT have its line items modified (immutable) | Issued invoice is a financial document; changes require credit note or cancellation | MVP |
| BR-13 | An invoice SHALL transition from Draft to Issued only when it has at least one line item | Valid invoice requires charges | MVP |
| BR-14 | An invoice SHALL transition from Issued to Paid only when total payments ≥ grand total | Payment completeness check | MVP |
| BR-15 | An invoice SHALL transition from Issued to Partially Paid when at least one payment is recorded but total payments < grand total | Partial payment tracking | MVP |
| BR-16 | An invoice SHALL transition to Overdue when the due date has passed and the outstanding balance > 0 | Triggers collections process | MVP |
| BR-17 | An invoice SHALL NOT transition from Cancelled or Void to any other status | Terminal statuses | MVP |
| BR-18 | A Cancelled invoice SHALL have a cancellation reason recorded | Audit requirement | MVP |
| BR-19 | A Voided invoice SHALL have a void reason recorded | Audit requirement | MVP |
| BR-20 | An invoice with payments recorded SHALL NOT be cancelled directly — payments must be reversed or refunded first | Prevents orphan payments | MVP |
| BR-21 | The invoice due date SHALL default to a configurable number of days from the invoice date (e.g., 30 days) | Standard payment terms | MVP |

### Allowed Status Transitions

```
Draft ──────────► Issued
Draft ──────────► Cancelled
Draft ──────────► Void
Issued ─────────► Paid (when fully paid)
Issued ─────────► Partially Paid (when partially paid)
Issued ─────────► Overdue (when past due with balance)
Issued ─────────► Cancelled (if no payments received)
Issued ─────────► Void
Partially Paid ─► Paid (when remaining balance paid)
Partially Paid ─► Overdue (when past due with balance)
Partially Paid ─► Cancelled (if no payments received)
Partially Paid ─► Void (requires refund of payments)
Paid ───────────► Void (requires refund)
Overdue ────────► Paid (when balance paid)
Overdue ────────► Partially Paid (when partial payment received)
Overdue ────────► Cancelled (if no payments received)
Overdue ────────► Void (requires refund)
Cancelled ──────► (Terminal)
Void ───────────► (Terminal)
```

---

## 3. Line Item Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-30 | Each line item SHALL have a description (required) | Financial documents require item descriptions | MVP |
| BR-31 | Each line item SHALL have a unit price ≥ 0 | Prices cannot be negative; zero is allowed for complimentary items | MVP |
| BR-32 | Each line item SHALL have a quantity ≥ 1 | Quantity must be positive | MVP |
| BR-33 | The line item net amount SHALL be computed as: (unit price × quantity) − line item discount amount | Standard formula | MVP |
| BR-34 | A line item discount SHALL be either a fixed amount or a percentage, not both | Simplifies computation and prevents ambiguity | MVP |
| BR-35 | If a line item discount is a percentage, the discount amount SHALL be computed as: (unit price × quantity) × (discount percentage / 100) | Standard formula | MVP |
| BR-36 | A line item discount SHALL NOT exceed the line item subtotal (unit price × quantity) | Prevents negative line item amounts | MVP |
| BR-37 | A line-item-level tax-exempt flag MAY override the invoice-level tax configuration | Allows selective tax exemption | Phase 2 |

---

## 4. Pricing and Discount Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-40 | The invoice subtotal SHALL be computed as: sum of (unit price × quantity) for all line items | Standard formula | MVP |
| BR-41 | The total discount amount SHALL be computed as: sum of all line item discount amounts | Standard formula | MVP |
| BR-42 | The total tax amount SHALL be computed as: sum of all line item tax amounts | Standard formula | MVP |
| BR-43 | The grand total SHALL be computed as: subtotal − total discount + total tax | Standard formula | MVP |
| BR-44 | An invoice-level discount MAY be applied in addition to line-item-level discounts | Supports both global and targeted discounts | MVP |
| BR-45 | The maximum total discount on an invoice SHALL be configurable (percentage of subtotal) | Prevents excessive discounting | MVP |
| BR-46 | When a price is overridden from a treatment plan estimate, the difference SHALL be tracked | Enables treatment-vs-billed comparison reporting | MVP |

---

## 5. Tax Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-50 | Tax rates SHALL be configurable per jurisdiction | Different regions have different tax laws | Phase 2 |
| BR-51 | Multiple tax rates MAY apply to a single line item (e.g., state + federal tax) | Supports layered tax systems (e.g., GST + PST in Canada) | Phase 2 |
| BR-52 | The tax rate applied at invoice creation SHALL be frozen for that invoice | Tax rate changes must not retroactively affect issued invoices | Phase 2 |
| BR-53 | A tax-exempt line item SHALL have a recorded exemption reason | Audit requirement for tax-exempt charges | Phase 2 |
| BR-54 | The tax amount per line item SHALL be computed as: net amount × (tax rate / 100) | Standard formula | Phase 2 |
| BR-55 | Tax rounding SHALL follow standard financial rounding (round half up, 2 decimal places) | Consistent tax calculation | Phase 2 |
| BR-56 | A tax rate SHALL have a name, percentage, and active/inactive status | Tax rate management | Phase 2 |

---

## 6. Payment Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-60 | A payment SHALL be recorded against at least one invoice | All payments must be attributable | MVP |
| BR-61 | A payment amount SHALL be > 0 | Zero or negative payments are not valid | MVP |
| BR-62 | The total allocated amount of a payment SHALL equal the payment amount | Prevents unbalanced allocations | MVP |
| BR-63 | Payment allocation to an invoice SHALL NOT exceed the invoice's outstanding balance (unless overpayment is explicitly permitted and flagged) | Prevents overpayment without consent | MVP |
| BR-64 | Overpayments SHALL be tracked as credit balance on the patient account | Excess payment should not be lost | MVP |
| BR-65 | A payment using method "Cheque" SHALL have a cheque number recorded | Cheque tracking | MVP |
| BR-66 | A payment using method "Card" SHOULD have a transaction ID or authorization code recorded | Card payment tracking | MVP |
| BR-67 | A payment reversal SHALL record the original payment ID, reason, and authorizing user | Full audit trail | MVP |
| BR-68 | A reversed payment SHALL restore the invoice's outstanding balance by the reversed amount | Financial consistency | MVP |

---

## 7. Receipt Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-70 | A receipt SHALL be generated via explicit API call for a completed payment | Explicit receipt generation | MVP |
| BR-71 | A receipt SHALL reference the payment(s) that generated it | Traceability | MVP |
| BR-72 | A receipt SHALL reference the invoice(s) the payment was applied to | Clear payment-to-invoice linkage | MVP |
| BR-73 | A receipt SHALL have a unique receipt number | Document identification | MVP |
| BR-74 | A consolidated receipt MAY cover multiple invoices paid in a single transaction | Simplifies multi-payment receipting | MVP |
| BR-75 | A receipt SHALL be re-printable at any time | Patients may lose original receipts | MVP |
| BR-76 | A receipt SHALL NOT be modifiable after generation | Receipt is a record of completed transaction | MVP |

---

## 8. Refund Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-80 | A refund SHALL reference the original payment | Traceability | Phase 2 |
| BR-81 | A refund amount SHALL NOT exceed the original payment amount | Prevents over-refunding | Phase 2 |
| BR-82 | A refund SHALL be recorded with reason and authorized by user | Audit requirement | Phase 2 |
| BR-83 | A refund MAY be partial (refund part of a payment) | Supports partial refunds | Phase 2 |
| BR-84 | A refund SHALL adjust the invoice's paid amount — the invoice may revert to Partially Paid status | Financial consistency | Phase 2 |
| BR-85 | Refunds exceeding a configurable threshold SHALL require approval | Financial control | Phase 2 |
| BR-86 | A refund receipt SHALL be generated upon refund processing | Documentation | Phase 2 |

---

## 9. Credit Note Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-90 | A credit note SHALL reference an invoice | Traceability to original transaction | Phase 2 |
| BR-91 | A credit note amount SHALL NOT exceed the invoice grand total | Prevents over-crediting | Phase 2 |
| BR-92 | A credit note MAY be for a partial amount of the invoice | Supports line-item corrections | Phase 2 |
| BR-93 | A credit note SHALL have a unique credit note number | Document identification | Phase 2 |
| BR-94 | A credit note MAY be applied to outstanding invoices | Credit can offset future charges | Phase 2 |
| BR-95 | A credit note SHALL have a configurable expiry period | Prevents stale credits | Phase 2 |
| BR-96 | An expired credit note SHALL NOT be applied to invoices | Business rule after expiry | Phase 2 |
| BR-97 | A credit note SHALL NOT be modified after issuance — only voided | Immutability principle | Phase 2 |
| BR-98 | A voided credit note SHALL have a void reason | Audit requirement | Phase 2 |

---

## 10. Numbering Policy

### 10.1 Document Number Formats

| Document Type | Default Prefix | Format Example | Phase |
|---|---|---|---|
| Invoice | `INV-` | `INV-00001` | MVP |
| Receipt | `RCT-` | `RCT-00001` | MVP |
| Payment | `PAY-` | `PAY-00001` | MVP |
| Refund | `RFD-` | `RFD-00001` | MVP |
| Credit Note | `CN-` | `CN-00001` | Phase 2 |

### 10.2 Numbering Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-100 | Invoice numbers SHALL be sequential and gapless | Legal requirement in many jurisdictions | MVP |
| BR-101 | Invoice number prefix SHALL be configurable (e.g., "INV-", "DENS-") | Clinic branding preference | MVP |
| BR-102 | Invoice number minimum digit length SHALL be configurable (e.g., 5 digits → INV-00001) | Consistent formatting | MVP |
| BR-103 | Invoice number starting number SHALL be configurable (e.g., start at 1000) | Clinics with existing numbering | MVP |
| BR-104 | Cancelled and Voided invoice numbers SHALL NOT be reused | Numbering integrity | MVP |
| BR-105 | Receipt, payment, refund, and credit note numbers SHALL follow the same sequential gapless pattern as invoices | Consistent numbering across all document types | MVP |
| BR-106 | Each document type SHALL use an independent number sequence | Clear document identification; each type has its own sequence | MVP |

### 10.3 Numbering Policy Details

| Policy | Description |
|---|---|
| **Uniqueness** | Each document number is unique within its document type sequence. No two invoices share the same number. No two receipts share the same number. Cross-type collisions (e.g., INV-00001 vs. RCT-00001) are allowed since they belong to different sequences. |
| **Reset Policy** | Number sequences SHALL NOT be resettable through the application UI. Reset requires direct database intervention by an authorized administrator. Sequence resets are logged and audited. |
| **Concurrency** | Number generation uses a dedicated sequence table with row-level locking to prevent race conditions under concurrent creation. Two users creating invoices simultaneously will receive different numbers. |
| **Gap Tolerance** | Number consumption is atomic — once a number is reserved, it is consumed even if the subsequent document creation fails. This ensures gapless sequences. Reserved-but-failed numbers are tracked in the sequence consumption audit log. |
| **Multi-branch Support** | For multi-branch deployments (Phase 3), each branch may have its own independent number sequence. The branch identifier may be incorporated into the prefix (e.g., "BR1-INV-", "BR2-INV-"). |
| **Format Customization** | Prefix, minimum digit length, and starting number are configurable per document type via the admin settings. Prefix may include alphanumeric characters and hyphens. |

---

## 11. Audit and Immutability Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-110 | Every financial record SHALL have created_by and created_at fields | Basic audit trail | MVP |
| BR-111 | Every financial record SHALL have updated_by and updated_at fields | Change tracking | MVP |
| BR-112 | Invoice status changes SHALL be recorded with old status, new status, user, timestamp, and reason | Full status change history | MVP |
| BR-113 | Price overrides SHALL be recorded with original price, new price, user, timestamp | Price change audit | MVP |
| BR-114 | Financial audit records SHALL be append-only — no modification or deletion | Audit integrity | MVP |
| BR-115 | Audit records SHALL be retained for a configurable period (minimum 7 years by default) | Regulatory compliance | MVP |
| BR-116 | An invoice SHALL NOT be hard-deleted after it transitions out of Draft | Immutability after issuance | MVP |
| BR-117 | A payment SHALL NOT be hard-deleted after creation | Financial record integrity | MVP |

---

## 12. Treatment Plan Integration Rules

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-120 | An invoice MAY be generated from a treatment plan in Accepted or In Progress status | Plan must be active to bill | MVP |
| BR-121 | A treatment plan SHALL have at most one active (non-cancelled, non-voided) invoice | Prevents double billing | MVP |
| BR-122 | Treatment plan items SHALL be marked as invoiced after invoice generation | Prevents re-invoicing | MVP |
| BR-123 | When generating an invoice from a treatment plan, treatment plan cost estimates SHALL become invoice line item default prices | Consistent starting point | MVP |
| BR-124 | Price overrides on invoice line items sourced from treatment plans SHALL be tracked | Audit of pricing changes | MVP |
| BR-125 | A partial invoice MAY be generated from selected treatment plan items (not all items required) | Supports phased billing | MVP |
| BR-126 | Multiple treatment plans MAY be combined into a single invoice for the same patient | Consolidated billing | MVP |

---

## 13. Discount Approval Rules (Phase 2)

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-130 | A discount that exceeds the configured threshold SHALL require approval before it can be applied | Financial control | Phase 2 |
| BR-131 | The discount threshold SHALL be configurable as a percentage of the line item subtotal and/or as a fixed amount | Flexible configuration | Phase 2 |
| BR-132 | An approval request SHALL be routed to the configured approver role(s) | Route to appropriate reviewer | Phase 2 |
| BR-133 | An approved discount SHALL record the approver, approval timestamp, and approval notes | Audit trail | Phase 2 |
| BR-134 | A rejected discount SHALL record the rejecting user, timestamp, and rejection reason | Audit trail | Phase 2 |
| BR-135 | A pending approval request SHALL expire after a configurable period | Prevents stale requests | Phase 2 |
| BR-136 | Approval escalation SHALL route to the next-level approver if the primary approver does not act within a configurable period | Prevents bottlenecks | Phase 2 |

---

## 14. Multi-currency Rules (Phase 3)

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-140 | All line items on a single invoice SHALL use the same currency | Currency consistency on a single document | Phase 3 |
| BR-141 | The exchange rate used at invoice creation SHALL be frozen for that invoice | Prevents exchange rate fluctuations affecting issued invoices | Phase 3 |
| BR-142 | The base currency for reporting SHALL be configurable per clinic | Reporting consistency | Phase 3 |

---

## 15. Patient Wallet Rules (Phase 3)

| ID | Rule | Rationale | Phase |
|---|---|---|---|
| BR-150 | A patient wallet SHALL have a non-negative balance | Wallet cannot be negative | Phase 3 |
| BR-151 | Wallet top-ups SHALL be recorded as payments with the payment method "Wallet Top-up" | Financial tracking | Phase 3 |
| BR-152 | Wallet consumption against invoices SHALL be recorded as a payment with the payment method "Wallet" | Clear payment attribution | Phase 3 |
| BR-153 | A wallet refund SHALL NOT exceed the wallet balance | Prevents over-refunding | Phase 3 |

---

## 16. Business Edge Cases

This section documents expected business behavior for edge case scenarios that may arise during billing operations.

| # | Edge Case | Expected Business Behavior | Phase |
|---|---|---|---|
| EC-1 | Procedure cancelled after invoicing | If an invoice has been issued for a procedure that is later cancelled, the clinic issues a credit note for the cancelled amount (Phase 2), or cancels the invoice and re-issues if no payments received. | MVP |
| EC-2 | Price changes after treatment approval | New price used as default invoice line item price. Price difference tracked in audit trail. Significant changes should trigger re-approval. | MVP |
| EC-3 | Patient overpayment | Excess recorded as patient credit, applicable to future invoices or refundable on request. | MVP |
| EC-4 | Partial refund | Only portion of payment reversed. Remaining balance stays allocated. Invoice balance adjusts. | Phase 2 |
| EC-5 | Full refund | Entire payment reversed. Invoice balance returns to pre-payment state. | Phase 2 |
| EC-6 | Deleted procedure after partial billing | Already invoiced items remain on the invoice. Removed procedure unavailable for future billing. | MVP |
| EC-7 | Merged patient records | All financial records reassigned to target patient. Financial continuity preserved. | MVP |
| EC-8 | Duplicate payment attempt | Duplicate detected and rejected with clear warning. | MVP |
| EC-9 | Payment reversal on paid invoice | Status reverts to Partially Paid (or Issued if no payments remain). Reversal receipt generated. | MVP |
| EC-10 | Modification attempt on paid invoice | Rejected. Corrections use credit notes or refunds. | MVP |
| EC-11 | Treatment plan revision after partial billing | Invoiced items marked as billed. New plan version contains only unbilled items. | MVP |
| EC-12 | Offline payment synchronization | On reconnect, offline payments synchronized and allocated. Duplicate detection prevents double-recording. | Phase 3 |
| EC-13 | Long-running treatment plans | Partial billing allows invoicing completed procedures while deferred items remain available. | MVP |
| EC-14 | Advance payment adjustments | Advance applied to final invoice. Excess refunded or held as credit. Shortfall collected at settlement. | Phase 3 |

---

## 17. Business Constraints Matrix

| Entity / Field | Max Discount | Approval Required | Editable After Issue | Audited | Configurable | Immutable |
|---|---|---|---|---|---|---|
| Invoice — Line Items | BR-45 | No (below threshold) | No | Yes | No | Yes (after issue) |
| Invoice — Grand Total | N/A | N/A | No | Yes | No | Yes (after issue) |
| Invoice — Discount | BR-45 | BR-130 (above threshold) | No | Yes | Yes (threshold) | No (before issue) |
| Invoice — Notes | N/A | No | Yes (additive) | Yes | No | No |
| Invoice — Status | N/A | For void/cancel | N/A | Yes | No | No |
| Line Item — Unit Price | BR-36 | No | No | Yes | No | Yes (after issue) |
| Line Item — Quantity | N/A | No | No | Yes | No | Yes (after issue) |
| Line Item — Discount | BR-36 | BR-130 (above threshold) | No | Yes | Yes (threshold) | No (before issue) |
| Payment — Amount | N/A | No | No (reversal only) | Yes | No | Yes (after recording) |
| Payment — Reversal | N/A | BR-85 (above threshold) | N/A | Yes | Yes (threshold) | No (reversal allowed) |
| Receipt — Amount | N/A | N/A | No | Yes | No | Yes |
| Refund — Amount | N/A | BR-85 (above threshold) | No | Yes | Yes (threshold) | Yes (after processing) |
| Credit Note — Amount | N/A | No | No | Yes | No | Yes (after issuance) |
| Credit Note — Expiry | N/A | N/A | No | Yes | Yes (period) | Yes (after issuance) |
| Invoice Number — Prefix | N/A | N/A | N/A | Yes | Yes | No |
| Invoice Number — Sequence | N/A | N/A | N/A | Yes | Yes (start value) | Yes (numbers retired) |
| Tax Rate — Percentage | N/A | No | N/A | Yes | Yes | No |
| Discount Threshold | N/A | N/A | N/A | Yes | Yes | No |

**Legend:** Max Discount = upper limit enforced; Approval Required = exceeds threshold triggers workflow; Editable After Issue = modifiable after document finalized; Audited = changes captured in audit trail; Configurable = changeable via admin UI; Immutable = permanently fixed once set.

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md), [02-functional-requirements.md](02-functional-requirements.md) |
| **Related** | [05-user-roles-and-permissions.md](05-user-roles-and-permissions.md), [07-workflows.md](07-workflows.md), [glossary.md](glossary.md) |
| **Next Reading** | [07-workflows.md](07-workflows.md) → [08-future-scope.md](08-future-scope.md) |
