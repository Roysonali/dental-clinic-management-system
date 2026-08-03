# Audit Requirements — Billing Module

> **Document Type:** Audit Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Define what financial events must be audited, what information must be captured, retention expectations, and compliance considerations.

| Field | Value |
|---|---|
| Document | Audit Requirements |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 06-business-rules.md (Section 11), 09-financial-invariants.md, 07-workflows.md, 03-non-functional-requirements.md (Section 5, 9) |

---

## Table of Contents

1. [Audit Philosophy](#1-audit-philosophy)
2. [Events to Audit](#2-events-to-audit)
3. [Audit Record Structure](#3-audit-record-structure)
4. [Who Performed Action](#4-who-performed-action)
5. [When Action Occurred](#5-when-action-occurred)
6. [Why Action Was Taken](#6-why-action-was-taken)
7. [Before/After Values](#7-beforeafter-values)
8. [Retention Expectations](#8-retention-expectations)
9. [Compliance Considerations](#9-compliance-considerations)
10. [Audit Visibility](#10-audit-visibility)

---

## 1. Audit Philosophy

The Billing module follows a comprehensive audit approach based on these principles:

| Principle | Description |
|---|---|
| **Non-repudiation** | Every financial transaction can be definitively attributed to a specific user at a specific time. No anonymous operations. |
| **Immutability** | Once an audit record is created, it cannot be modified or deleted. Audit data is append-only. |
| **Completeness** | Every mutation of financial data is audited. No operation falls outside the audit scope. |
| **Traceability** | Every audit record includes enough context to reconstruct the state of the system at the time of the operation. |
| **Retention** | Audit data is retained for the legally mandated period (minimum 7 years by default, configurable per deployment). |

---

## 2. Events to Audit

### 2.1 Invoice Events

| Event | Audit Capture | Phase |
|---|---|---|
| Invoice Created | Full invoice snapshot at creation time (patient, line items, amounts, user, timestamp) | MVP |
| Invoice Edited (Draft) | Changed fields with before/after values | MVP |
| Invoice Issued | Old status (Draft), new status (Issued), user, timestamp | MVP |
| Invoice Cancelled | Old status, new status (Cancelled), reason, user, timestamp | MVP |
| Invoice Voided | Old status, new status (Void), reason, user, timestamp | MVP |
| Invoice Status Change (any) | Old status, new status, trigger (payment, time), user/system, timestamp | MVP |

### 2.2 Line Item Events

| Event | Audit Capture | Phase |
|---|---|---|
| Line Item Added | Full line item detail (description, quantity, unit price, discount, tax) | MVP |
| Line Item Modified | Changed fields with before/after values | MVP |
| Line Item Removed | Complete line item snapshot before removal | MVP |
| Price Override | Original price, overridden price, difference, user, timestamp | MVP |

### 2.3 Payment Events

| Event | Audit Capture | Phase |
|---|---|---|
| Payment Recorded | Payment amount, method, reference number, allocations to invoices, user, timestamp | MVP |
| Payment Reversed | Reverse reason, original payment reference, user, timestamp | MVP |
| Payment Allocation Modified | Original allocation, new allocation, invoice IDs, user, timestamp | Phase 2 |

### 2.4 Receipt Events

| Event | Audit Capture | Phase |
|---|---|---|
| Receipt Generated | Receipt number, payment reference, invoice reference, amount, method, user, timestamp | MVP |
| Receipt Reprint | Receipt number, user who requested reprint, timestamp | MVP |

### 2.5 Discount Events

| Event | Audit Capture | Phase |
|---|---|---|
| Discount Applied (auto) | Discount amount/percentage, line item ID, user, timestamp | MVP |
| Discount Approval Requested | Discount details, requested by user, timestamp, request ID | Phase 2 |
| Discount Approved | Request ID, approved by user, approval timestamp, notes | Phase 2 |
| Discount Rejected | Request ID, rejected by user, rejection timestamp, reason | Phase 2 |
| Discount Approval Expired | Request ID, expiry timestamp | Phase 2 |

### 2.6 Refund Events (Phase 2)

| Event | Audit Capture | Phase |
|---|---|---|
| Refund Processed | Refund amount, original payment reference, reason, user, timestamp | Phase 2 |
| Refund Approval Requested | Refund details, requested by, timestamp | Phase 2 |
| Refund Approved/Rejected | Decision, approver, timestamp, reason | Phase 2 |

### 2.7 Credit Note Events (Phase 2)

| Event | Audit Capture | Phase |
|---|---|---|
| Credit Note Issued | Full credit note snapshot (amount, reason, invoice reference, line items) | Phase 2 |
| Credit Note Applied | Credit note ID, invoice ID, applied amount, user, timestamp | Phase 2 |
| Credit Note Expired | Credit note ID, remaining amount, expiry timestamp | Phase 2 |
| Credit Note Voided | Credit note ID, void reason, user, timestamp | Phase 2 |

### 2.8 Configuration Events

| Event | Audit Capture | Phase |
|---|---|---|
| Numbering Configuration Changed | Old prefix, new prefix, old starting number, new starting number, user | MVP |
| Discount Threshold Changed | Old threshold, new threshold, user | Phase 2 |
| Tax Rate Created/Modified/Deactivated | Tax rate details, user | Phase 2 |
| Payment Terms Changed | Old terms, new terms, user | MVP |

---

## 3. Audit Record Structure

Every audit record SHALL contain the following fields:

| Field | Type | Description | Required |
|---|---|---|---|
| Event ID | UUID | Unique identifier for the audit record | Always |
| Event Type | String | Category of event (e.g., "invoice.issued", "payment.recorded") | Always |
| Timestamp | TIMESTAMP | When the action occurred (server time, UTC) | Always |
| Actor ID | UUID | User who performed the action | Always |
| Actor Role | String | Role of the user at time of action | Always |
| Entity Type | String | Type of entity affected (Invoice, Payment, Receipt, etc.) | Always |
| Entity ID | UUID | Identifier of the affected entity | Always |
| Action | String | Description of the action performed | Always |
| Before State | JSONB | Snapshot of relevant fields before the change | When applicable |
| After State | JSONB | Snapshot of relevant fields after the change | When applicable |
| Reason | Text | Business reason for the action (cancellation reason, void reason, etc.) | When required |
| IP Address | String | Originating IP of the request | Always |
| Correlation ID | UUID | End-to-end tracing identifier | Always |

---

## 4. Who Performed Action

Every audit record SHALL identify:

| Attribution | Source | Notes |
|---|---|---|
| User ID | JWT token (sub claim) | Comes from Auth module |
| User Role | RBAC lookup at time of action | Captured at action time, not referenced live |
| User Name | User Management | For display in audit views |
| System Actions | "system" identifier | For automated processes (overdue check, approval expiry) |
| External System | "gateway" or integration name | For Phase 3 payment gateway webhooks |

---

## 5. When Action Occurred

| Requirement | Standard |
|---|---|
| Timestamp precision | Microsecond precision |
| Timezone | UTC (stored); local timezone for display |
| Clock source | Server system clock (NTP-synchronized) |
| Event ordering | Sequential by timestamp; tie-breaking by event ID UUID |
| Duration tracking | For multi-step operations, record start and end timestamps |

---

## 6. Why Action Was Taken

The reason SHOULD be captured for the following action types:

| Action | Reason Required? | Examples |
|---|---|---|
| Invoice Cancellation | Required | "Incorrect patient selected", "Duplicate invoice" |
| Invoice Voiding | Required | "Invoice issued in error, payments refunded" |
| Payment Reversal | Required | "Duplicate payment recorded" |
| Price Override | Recommended | "Loyalty discount applied" |
| Discount (above threshold) | Required | "Promotional pricing for referral patient" |
| Refund | Required | "Treatment cancelled, patient requested refund" |
| Credit Note | Required | "Price adjustment — incorrect rate applied" |
| Void | Required | "Credit note issued in error" |

---

## 7. Before/After Values

Before/after snapshots SHOULD be captured for:

| Operation | Before Contains | After Contains |
|---|---|---|
| Invoice Edit | Previous field values | New field values |
| Line Item Price Change | Original unit price | Overridden unit price |
| Status Transition | Previous status | New status |
| Payment Allocation Change | Original allocations | Modified allocations |
| Discount Application | Original amount | Discounted amount |
| Configuration Change | Previous configuration | New configuration |

### Snapshot Rules

| Rule | Description |
|---|---|
| Full snapshot for creates | When an entity is created, the "before" state is empty; "after" state contains the full entity |
| Differential snapshot for updates | Only changed fields are captured in before/after (not the entire entity) |
| Full snapshot for deletes | When an entity is removed (soft-delete/cancel/void), "before" state contains the full entity; "after" state is empty |
| JSONB storage | Snapshots are stored as JSONB for schema flexibility |

---

## 8. Retention Expectations

| Requirement | Standard | Phase |
|---|---|---|
| Minimum retention period | 7 years from the date of the audited event | MVP |
| Configurable retention | Retention period configurable via system settings | MVP |
| Archiving | Records older than retention period may be archived (not deleted) | Phase 3 |
| Purge policy | No automatic purging — archived records are retained indefinitely | Phase 3 |
| Export for legal hold | Audit data for specific patients/transactions must be exportable on request | Phase 2 |

### Retention by Record Type

| Record Type | Minimum Retention | Notes |
|---|---|---|
| Invoice audit records | 7 years after invoice date | Matches standard tax record retention |
| Payment audit records | 7 years after payment date | — |
| Receipt audit records | 7 years after receipt date | — |
| Credit note audit records | 7 years after credit note date | — |
| Configuration changes | Duration of clinic operation | Configuration history should not expire |
| Discount approval records | 7 years | May be needed for tax audit |
| Refund records | 7 years after refund | — |

---

## 9. Compliance Considerations

| Regulation | Relevant Audit Requirements |
|---|---|
| **GDPR** (General Data Protection Regulation) | Right to access audit data; right to erasure (with legal hold exceptions for financial records); data retention limits |
| **HIPAA** (Health Insurance Portability and Accountability Act) | Access logs for protected health information; audit controls; integrity controls |
| **Local Tax Regulations** (varies by jurisdiction) | Sequential invoice numbering audit; retention of financial records for minimum period; audit trail for corrections |
| **PCI DSS** (Payment Card Industry Data Security Standard) | Audit logs for access to cardholder data; tracking of payment processing events; monitoring of access to payment systems |
| **SOX** (Sarbanes-Oxley, if applicable) | Audit trail for financial transactions; retention of audit records; access controls for financial systems |

---

## 10. Audit Visibility

### Who Can View Audit Data

| Role | View Scope |
|---|---|
| Clinic Administrator | Full audit data — all modules, all users, all time periods |
| Accountant / Billing Manager | Billing module audit data — all billing events, all users |
| External Auditor (read-only access) | Full audit data — read-only, time-boxed access |
| Doctors | Audit data for their own actions only (limited) |
| Receptionist | No audit data access — only current transaction data |

### Audit Search Capabilities

| Search Criterion | Available |
|---|---|
| By date range | Yes |
| By user | Yes |
| By entity type (Invoice, Payment, etc.) | Yes |
| By entity ID | Yes |
| By event type | Yes |
| By patient | Yes (filter audit events related to a patient's invoices) |
| Full-text search on reasons | Phase 2 |

### Audit Export

| Capability | Phase |
|---|---|
| Export audit data for a specific date range | Phase 2 |
| Export audit data for a specific entity | Phase 2 |
| Export audit data for a specific user | Phase 2 |
| CSV format | Phase 2 |
| PDF format (readable report) | Phase 2 |
| Include before/after snapshots in export | Phase 2 |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [06-business-rules.md](06-business-rules.md) (Section 11 — Audit and Immutability Rules) |
| **Related** | [03-non-functional-requirements.md](03-non-functional-requirements.md) (Sections 5, 8, 9), [09-financial-invariants.md](09-financial-invariants.md) |
| **Next Reading** | [14-definition-of-done.md](14-definition-of-done.md) |
