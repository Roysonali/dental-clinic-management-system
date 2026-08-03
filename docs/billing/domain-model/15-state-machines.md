# State Machines — Billing Module

> **Document Type:** State Machine Specification (Phase 2)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | State Machines |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Related Documents | 14-lifecycle-models.md, 07-workflows.md |

---

## 1. Purpose

This document defines the formal state machines for the Billing domain entities. Each state machine specifies valid and invalid transitions, guards (conditions that must be met for a transition to occur), and the actions triggered on each transition.

---

## 2. Invoice State Machine

### States

| State | Type | Description |
|---|---|---|
| `Draft` | Non-terminal | Invoice being prepared |
| `Issued` | Non-terminal | Invoice finalized and sent to patient |
| `PartiallyPaid` | Non-terminal | Partial payment received |
| `Paid` | Non-terminal | Fully paid |
| `Overdue` | Non-terminal | Past due with balance |
| `Cancelled` | Terminal | Terminated with no payments |
| `Void` | Terminal | Terminated with payments refunded |

### Transitions

| Current State | Target State | Trigger | Guard | Action |
|---|---|---|---|---|
| Draft | Issued | `issue()` | Has ≥ 1 line item | Freeze line items, commit invoice number, record status change |
| Draft | Cancelled | `cancel()` | None | Record cancellation reason, release plan items (if linked) |
| Draft | Void | `void()` | None | Record void reason |
| Issued | PartiallyPaid | `recordPayment()` | Payment < outstanding balance | Update status, record status change |
| Issued | Paid | `recordPayment()` | Payments ≥ grand total | Update status |
| Issued | Overdue | `checkOverdue()` | Past due date + balance > 0 | Update status, record status change |
| Issued | Cancelled | `cancel()` | No payments received | Record cancellation reason, release plan items |
| Issued | Void | `void()` | User has void permission | Record void reason, verify payments refunded |
| PartiallyPaid | Paid | `recordPayment()` | Payments ≥ grand total | Update status |
| PartiallyPaid | Overdue | `checkOverdue()` | Past due date + balance > 0 | Update status, record status change |
| PartiallyPaid | Cancelled | `cancel()` | No remaining payments expected | Record cancellation reason |
| PartiallyPaid | Void | `void()` | User has void permission + payments refunded | Record void reason |
| Paid | Void | `void()` | User has void permission + payments refunded | Record void reason |
| Overdue | Paid | `recordPayment()` | Payments ≥ grand total | Update status |
| Overdue | PartiallyPaid | `recordPayment()` | Payment < outstanding balance | Update status |
| Overdue | Cancelled | `cancel()` | No payments received | Record cancellation reason |
| Overdue | Void | `void()` | User has void permission + payments refunded | Record void reason |

### Guard Definitions

```yaml
issue_guard:
  description: "Invoice can only be issued if it has at least one line item"
  condition: "invoice.line_items.count >= 1"
  error: "INVOICE_NO_LINE_ITEMS"

cancel_guard:
  description: "Invoice can only be cancelled if no payments have been recorded"
  condition: "invoice.total_payments == 0"
  error: "INVOICE_HAS_PAYMENTS"

void_guard:
  description: "Invoice can only be voided if all payments have been refunded"
  condition: "invoice.total_payments == invoice.total_refunds"
  error: "INVOICE_UNREFUNDED_PAYMENTS"

overdue_check:
  description: "Invoice is overdue if past due date with outstanding balance"
  condition: "current_date > invoice.due_date AND invoice.outstanding_balance > 0"
```

### Invalid Transitions

| From → To | Reason |
|---|---|
| Draft → Paid | Must be issued before payments can be recorded |
| Draft → Overdue | Must be issued before becoming overdue |
| Issued → Draft | Invoice is immutable after issuance |
| Cancelled → Any | Terminal state — no further transitions |
| Void → Any | Terminal state — no further transitions |
| Paid → Issued | Cannot revert payment |
| Paid → PartiallyPaid | Refunds reduce paid amount, not status reversion |
| Overdue → Issued | Cannot revert to issued |

---

## 3. Payment State Machine

### States

| State | Type | Description |
|---|---|---|
| `Pending` | Non-terminal | Payment initiated, awaiting completion |
| `Completed` | Non-terminal | Successfully processed |
| `Failed` | Non-terminal | Processing failed (can retry to Pending) |
| `Void` | Terminal | Voided by admin before completion |
| `Refunded` | Terminal | All funds returned |
| `Reversed` | Terminal | Payment reversed after completion |

### Transitions

| Current State | Target State | Trigger | Guard | Action |
|---|---|---|---|---|
| Pending | Completed | `complete()` | Payment confirmed | Mark payment successful |
| Pending | Failed | `fail()` | Payment error or timeout | Record failure reason |
| Pending | Void | `void()` | Admin action | Record void reason |
| Completed | Refunded | `processRefund()` | Full refund processed | Create refund allocation, update invoice balance |
| Completed | Reversed | `reverse()` | Payment reversed | Reverse allocation, update invoice balance |
| Failed | Pending | `retry()` | Retry requested | Reset to pending for retry |

### Invalid Transitions

| From → To | Reason |
|---|---|
| Pending → Refunded | Cannot refund a payment that never completed |
| Completed → Pending | Cannot revert a completed payment |
| Failed → Completed | A failed payment cannot be retroactively marked successful |
| Refunded → Any | Terminal state |
| Reversed → Any | Terminal state |
| Void → Any | Terminal state |

---

## 4. Credit Note State Machine

### States

| State | Type | Description |
|---|---|---|
| `Draft` | Non-terminal | Being prepared, editable |
| `Issued` | Non-terminal | Finalized, immutable |
| `Applied` | Terminal | Full credit consumed |
| `Expired` | Terminal | Validity period passed |
| `Void` | Terminal | Cancelled |

### Transitions

| Current State | Target State | Trigger | Guard | Action |
|---|---|---|---|---|
| Draft | Issued | `issue()` | Credit note has required fields | Freeze credit note data, commit number |
| Draft | Void | `void()` | None | Record void reason |
| Issued | Applied | `apply()` | Amount = remaining balance | Set to fully applied, update invoice |
| Issued | Expired | `checkExpiry()` | Past expiry date + balance > 0 | Set status to Expired |
| Issued | Void | `void()` | None | Record void reason |

### Invalid Transitions

| From → To | Reason |
|---|---|
| Draft → Applied | Must be issued before it can be applied |
| Applied → Any | Terminal state |
| Expired → Any | Terminal state |
| Void → Any | Terminal state |
| Expired → Applied | Expired credit notes are no longer valid |

---

## 5. State Machine Enforcement Rules

| Rule | Description |
|---|---|
| **Guard enforcement** | Every transition must pass its guard before execution. If the guard fails, the transition is rejected with a domain error. |
| **Side effects** | Each transition may trigger side effects (status history recording, receipt generation, notification sending). Side effects are part of the transition, not separate operations. |
| **Atomicity** | A state transition and its side effects must occur within a single transaction boundary to prevent partial state updates. |
| **Audit logging** | Every successful transition is recorded in the entity's status history (or equivalent audit log) with old state, new state, actor, timestamp, and reason. |
| **No silent transitions** | No transition can occur without being recorded. Even system-triggered transitions (overdue detection) must leave an audit trail. |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [14-lifecycle-models.md](14-lifecycle-models.md) |
| **Related** | [diagrams/invoice-lifecycle.md](diagrams/invoice-lifecycle.md), [diagrams/payment-lifecycle.md](diagrams/payment-lifecycle.md) |
| **Next Reading** | [16-financial-calculation-model.md](16-financial-calculation-model.md) |
