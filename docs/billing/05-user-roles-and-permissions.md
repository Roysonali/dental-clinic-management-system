# User Roles and Permissions — Billing Module

> **Document Type:** Role-Permission Mapping
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Note:** This document describes business roles and the types of actions they require. It does not define RBAC implementation details, permission string naming conventions, or database-level access control mechanisms.

| Field | Value |
|---|---|
| Document | User Roles and Permissions |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 02-functional-requirements.md (FR-8), 06-business-rules.md |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Business Roles](#2-business-roles)
3. [Action Types](#3-action-types)
4. [Role-to-Action Mapping](#4-role-to-action-mapping)
5. [Permission Scenarios](#5-permission-scenarios)
6. [Role Hierarchy Considerations](#6-role-hierarchy-considerations)
7. [Audit Visibility](#7-audit-visibility)

---

## 1. Purpose

This document defines which business roles interact with the Billing module and the types of actions they require for their job functions. It serves as the business specification for implementing RBAC permissions in the Billing module, ensuring that:

- Each role has the minimum necessary access to perform its job (principle of least privilege)
- Sensitive financial operations are restricted to authorized roles
- Audit trails can identify which role performed which action
- Future permission requirements (Phase 2, Phase 3) are anticipated

---

## 2. Business Personas

This section provides detailed business personas for every role that interacts with the Billing module. Each persona describes the role's responsibilities, goals, pain points, and how they use the billing system in their daily work.

### 2.1 Receptionist

| Attribute | Description |
|---|---|
| **Role Name** | Receptionist |
| **Responsibilities** | Front-desk patient check-in, appointment scheduling, payment collection, receipt issuance, basic billing inquiries |
| **Business Goals** | Process payments quickly and accurately; minimize patient wait time at checkout; provide clear receipts; avoid billing errors that require correction later |
| **Daily Activities** | Greet patients arriving for appointments; collect payments at time of service; issue receipts; answer patient questions about charges; search for invoices by patient name; record cash, card, and cheque payments |
| **Billing Responsibilities** | Record payments against invoices; issue receipts; view invoice balances; search invoices by patient name or invoice number; reprint receipts on request |
| **Typical Permissions** | View invoices, record payments, view and reprint receipts. Cannot create invoices, edit line items, apply discounts, void invoices, or process refunds. |
| **Pain Points** | Payment entry is too slow (increases patient wait time); unclear invoice balances lead to incorrect payment collection; receipt reprinting is not easily accessible; system does not clearly show outstanding amount during payment entry |
| **Frequency of Usage** | Multiple times daily — every patient who pays at time of service |

### 2.2 Billing Executive / Accountant

| Attribute | Description |
|---|---|
| **Role Name** | Billing Executive / Accountant |
| **Responsibilities** | Invoice creation and management, payment reconciliation, discount application, refund processing, credit note issuance, financial reporting |
| **Business Goals** | Ensure all billable treatments are invoiced accurately and promptly; maintain high collection rates; minimize billing errors; ensure financial records are audit-ready at all times |
| **Daily Activities** | Generate invoices from completed treatment plans; review and issue draft invoices; reconcile payments received against invoices; process refunds and credit notes (Phase 2); review and approve discounts (Phase 2); respond to patient billing inquiries; generate end-of-day financial reports |
| **Billing Responsibilities** | Create and issue invoices; apply discounts (with approval for above-threshold); record and reverse payments; process refunds (Phase 2); issue credit notes (Phase 2); generate and export financial reports |
| **Typical Permissions** | Full operational billing access: create/edit/issue invoices, record/reverse payments, apply discounts (up to threshold), process refunds (Phase 2), issue credit notes (Phase 2), view and export reports. Requires approval for above-threshold actions. |
| **Pain Points** | Manual data entry for invoices not linked to treatment plans; time spent reconciling partial payments; unclear audit trail when corrections are needed; report generation is time-consuming without automated exports |
| **Frequency of Usage** | Throughout the day — primary billing operator |

### 2.3 Dentist

| Attribute | Description |
|---|---|
| **Role Name** | Dentist (General, Specialist, Chief) |
| **Responsibilities** | Patient diagnosis and treatment; treatment planning (via Treatment Plans module); reviewing treatment costs and billed amounts for own patients |
| **Business Goals** | Understand what patients are being charged for treatments performed; ensure billed amounts match treatment plan estimates (or identify discrepancies); provide patients with accurate cost information |
| **Daily Activities** | Review planned treatments and estimated costs; after treatment, confirm procedures performed; check invoice amounts for their patients when questions arise; review revenue reports for their own productivity (Phase 2) |
| **Billing Responsibilities** | View invoices and payments for patients they have treated. Cannot create invoices, record payments, or perform any billing modification. |
| **Typical Permissions** | View-only access to invoices, payments, and receipts scoped to own patients. No billing modification rights. |
| **Pain Points** | Cannot easily see which of their treatments have been billed and which are still pending; invoice amounts may differ from treatment plan estimates without clear explanation; no visibility into insurance claim status (Phase 3) |
| **Frequency of Usage** | Several times per week — to review treatment costing and answer patient questions |

### 2.4 Clinic Manager

| Attribute | Description |
|---|---|
| **Role Name** | Clinic Manager |
| **Responsibilities** | Overall clinic operations oversight; financial performance monitoring; staff management; approval authority for above-threshold financial actions |
| **Business Goals** | Ensure clinic financial health; monitor revenue and collection trends; approve exceptional discounts and refunds; maintain compliance with financial regulations |
| **Daily Activities** | Review daily revenue summary; approve discount requests above standard thresholds; review overdue invoice report; monitor receivables aging; resolve billing disputes escalated by staff; review financial dashboards and reports (Phase 2) |
| **Billing Responsibilities** | Approve discounts, refunds, and voids exceeding standard thresholds; view all financial reports and dashboards; configure billing settings (numbering, thresholds, payment terms); oversee financial audit trail |
| **Typical Permissions** | Full billing visibility and configuration rights. Approval authority for above-threshold actions. Can view all financial data across all patients and doctors. |
| **Pain Points** | Lack of real-time financial visibility without dashboard (Phase 2); difficult to track which discounts were approved and by whom; receivables aging is not visible without manual report generation |
| **Frequency of Usage** | Daily — performance review and approval management |

### 2.5 Administrator / Practice Owner

| Attribute | Description |
|---|---|
| **Role Name** | Administrator / Practice Owner |
| **Responsibilities** | Ultimate ownership of clinic financial operations; regulatory compliance; strategic financial decisions; system configuration authority |
| **Business Goals** | Maximize revenue and profitability; ensure full regulatory and tax compliance; maintain complete audit trail for all financial transactions; configure billing policies to align with business strategy |
| **Daily Activities** | Review high-level financial summaries; configure tax rates (Phase 2); set discount approval thresholds; configure invoice numbering and payment terms; review audit logs for compliance; authorize exceptional financial actions |
| **Billing Responsibilities** | Configure all billing system settings; approve the largest financial actions (voids, large refunds); review complete audit trail; configure tax rates (Phase 2); manage multi-branch billing configuration (Phase 3) |
| **Typical Permissions** | Highest level of billing permissions: all billing operations, configuration changes, full audit log access, approval of any financial action without restriction. |
| **Pain Points** | Needs consolidated view across multiple locations (Phase 3); audit log review is not easily filterable; configuring billing settings requires navigating multiple screens |
| **Frequency of Usage** | Weekly or as needed — configuration and oversight |

### 2.6 Patient

| Attribute | Description |
|---|---|
| **Role Name** | Patient |
| **Responsibilities** | Payment for dental services received; review of invoices and receipts; understanding treatment costs |
| **Business Goals** | Receive clear, itemized invoices; understand what they are being charged for; get receipts for insurance claims and tax purposes; resolve billing discrepancies easily |
| **Daily Activities** | Receive invoices after treatment; make payments at reception or via online portal (Phase 3); request receipts for insurance claims; inquire about billing discrepancies; request refunds for overpayment or cancelled treatment |
| **Billing Responsibilities** | Pay invoices; request receipts; request refunds; inquire about charges (all through clinic staff — no direct system access in MVP) |
| **Typical Permissions** | No direct system access in MVP. Phase 3 Patient Portal provides self-service view of own invoices, receipts, and payment history. |
| **Pain Points** | Unclear itemized charges leading to confusion; difficulty getting questions answered when staff is busy; no online portal to view billing history (Phase 3); receiving paper receipts that are easily lost |
| **Frequency of Usage** | Per visit — when treatment is completed and payment is due |

### 2.7 Accountant (External / Future)

| Attribute | Description |
|---|---|
| **Role Name** | Accountant (External) |
| **Responsibilities** | Financial record-keeping, tax filing, financial reporting, audit support for the clinic |
| **Business Goals** | Ensure financial records are accurate and complete for tax filing; reconcile clinic revenue with bank deposits; generate accurate financial statements; support tax audits with proper documentation |
| **Daily Activities** | Review revenue and tax reports for period-end closing; reconcile payment records with bank statements; prepare tax filings using tax summary reports; audit financial records for compliance; import data into external accounting software (Phase 3) |
| **Billing Responsibilities** | View and export financial reports (revenue, tax summary, aging); export invoice and payment data for external accounting (Phase 3); review audit trail for compliance |
| **Typical Permissions** | View-only access to financial reports and audit data. Export permissions for data integration with external accounting software (Phase 3). No billing modification rights. |
| **Pain Points** | Manual data entry into external accounting software without integration (Phase 3); difficulty extracting specific data subsets for tax filing; audit log is not easily searchable by event type or date range |
| **Frequency of Usage** | Monthly, quarterly, and annually — for reporting and reconciliation periods |

### 2.8 Future Billing-Specific Roles (Phase 3)

| Role | Typical User | Billing Responsibility |
|---|---|---|
| **Insurance Desk Staff** | Staff managing insurance claims | Insurance claim submission, tracking, receivable management |
| **Branch Administrator** | Branch-level manager | Branch-scoped billing oversight (multi-branch deployment) |

---

## 3. Action Types

The following action types define the categories of operations a role may perform within the Billing module:

| Action Type | Code | Description |
|---|---|---|
| View Invoices | VIEW_INVOICE | View invoice list, detail, and line items |
| Create Invoice | CREATE_INVOICE | Create new invoices (from scratch or from treatment plan) |
| Edit Invoice | EDIT_INVOICE | Modify draft invoices; cannot edit issued invoices |
| Cancel Invoice | CANCEL_INVOICE | Cancel an issued invoice with reason |
| Void Invoice | VOID_INVOICE | Void an invoice (requires elevated permission) |
| View Payments | VIEW_PAYMENT | View payment records and allocation |
| Record Payment | RECORD_PAYMENT | Record a payment against an invoice |
| Reverse Payment | REVERSE_PAYMENT | Reverse a payment with reason (requires elevated permission) |
| View Receipts | VIEW_RECEIPT | View and reprint receipts |
| Generate Receipt | GENERATE_RECEIPT | Receipts are system-generated; this is implicit |
| Approve Discount | APPROVE_DISCOUNT | Approve discounts exceeding threshold (Phase 2) |
| Configure Tax | CONFIGURE_TAX | Manage tax rate configuration (Phase 2) |
| Process Refund | PROCESS_REFUND | Process full/partial refunds (Phase 2) |
| Issue Credit Note | ISSUE_CREDIT_NOTE | Issue and apply credit notes (Phase 2) |
| View Reports | VIEW_REPORT | View financial dashboard and reports (Phase 2) |
| Export Data | EXPORT_DATA | Export reports and financial data (Phase 2) |
| Manage Insurance | MANAGE_INSURANCE | Insurance claim management (Phase 3) |
| Configure Billing | CONFIGURE_BILLING | Configure billing settings: numbering, thresholds, etc. |

---

## 4. Role-to-Action Mapping

### 4.1 Phase 1 (MVP) — Action Mapping

| Action | Clinic Admin | Accountant / Billing Manager | Chief Doctor | General / Specialist Dentist | Receptionist | Patient |
|---|---|---|---|---|---|---|
| View Invoices | ✓ | ✓ | ✓ (own patients) | ✓ (own patients) | ✓ | ✓ (portal, Phase 3) |
| Create Invoice | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit Invoice (Draft) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Cancel Invoice | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Void Invoice | ✓ | ✓ (with threshold) | ✗ | ✗ | ✗ | ✗ |
| View Payments | ✓ | ✓ | ✓ (own patients) | ✓ (own patients) | ✓ | ✓ (portal, Phase 3) |
| Record Payment | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Reverse Payment | ✓ | ✓ (with threshold) | ✗ | ✗ | ✗ | ✗ |
| View Receipts | ✓ | ✓ | ✓ (own patients) | ✓ (own patients) | ✓ | ✓ (portal, Phase 3) |
| Configure Billing Settings | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### 4.2 Phase 2 — Action Mapping

| Action | Clinic Admin | Accountant / Billing Manager | Chief Doctor | General / Specialist Dentist | Receptionist |
|---|---|---|---|---|---|
| Approve Discount | ✓ | ✓ (up to threshold) | ✓ (up to threshold) | ✗ | ✗ |
| Configure Tax | ✓ | ✗ | ✗ | ✗ | ✗ |
| Process Refund | ✓ | ✓ (up to threshold) | ✗ | ✗ | ✗ |
| Issue Credit Note | ✓ | ✓ (up to threshold) | ✗ | ✗ | ✗ |
| View Reports | ✓ | ✓ | ✓ (own patients) | ✓ (own patients) | ✗ |
| Export Data | ✓ | ✓ | ✗ | ✗ | ✗ |

### 4.3 Phase 3 — Action Mapping

| Action | Clinic Admin | Billing Manager | Insurance Desk Staff | Branch Admin |
|---|---|---|---|---|
| Manage Insurance | ✓ | ✓ | ✓ | ✓ (branch scope) |
| Manage Payment Gateway Config | ✓ | ✗ | ✗ | ✗ |
| View Patient Portal Billing | ✓ | ✓ | ✓ | ✓ |
| Multi-branch Configuration | ✓ | ✗ | ✗ | ✓ (branch scope) |
| Multi-currency Configuration | ✓ | ✗ | ✗ | ✗ |

---

## 5. Permission Scenarios

The following scenarios illustrate how permission policies apply in practice:

### Scenario 1: Receptionist Collecting Payment

```
User logs in → Receptionist role
Opens patient invoice → Can VIEW invoice (balance displayed)
Records payment → Can RECORD_PAYMENT
Receipt generated (explicit API call) → Can VIEW_RECEIPT
Cannot: Edit invoice, void invoice, approve discounts, reverse payments
```

### Scenario 2: Accountant Creating Invoice from Treatment Plan

```
User logs in → Accountant role
Selects patient's accepted treatment plan → Can CREATE_INVOICE
Overrides price on a line item → Price override tracked (audited)
Issues invoice → Invoice frozen at Issued status
Cannot: Configure billing settings, configure tax rates
```

### Scenario 3: Clinic Administrator Approving Large Discount

```
User logs in → Clinic Administrator role
Discount requested exceeds standard threshold (e.g., >20%)
Administrator reviews and approves → APPROVE_DISCOUNT
Discount applied to invoice line item
Audit record: requested by Accountant, approved by Administrator
```

### Scenario 4: Doctor Viewing Own Patient Billing

```
User logs in → General Dentist role
Searches for patient → Can VIEW_INVOICE, VIEW_PAYMENT
Invoice list shows only treatments they performed
Cannot: See invoices for other doctors' patients (unless co-treatment)
Cannot: Create invoices, record payments, or modify any financial data
```

### Scenario 5: Billing Manager Processing Refund

```
User logs in → Billing Manager role
Patient requests refund for overpayment
Manager reviews invoice and payment records → Can VIEW
Processes refund → Can PROCESS_REFUND (within threshold)
If over threshold → Requires Clinic Administrator approval
```

---

## 6. Role Hierarchy Considerations

The permission model follows these hierarchy principles:

1. **Clinic Administrator** has the broadest access — all billing actions except those delegated to specific roles by policy.
2. **Accountant / Billing Manager** has full operational access but requires approval for above-threshold actions (voids, large discounts, refunds).
3. **Receptionist** has payment-collection and view access — they touch money but cannot create or modify invoices.
4. **Clinical roles (Chief Doctor, General Dentist, Specialist Dentist)** have view-only access scoped to their own patients. They cannot perform financial operations.
5. **Role escalation** for above-threshold actions (large discounts, refunds, voids) ensures that no single role can unilaterally execute high-risk financial operations.
6. **Patient** has no direct system access in MVP. Phase 3 Patient Portal provides limited self-service view of their own billing data.

---

## 7. Audit Visibility

Every financial action is recorded with:

- User identity (who performed the action)
- User role at time of action
- Action type
- Timestamp
- Relevant entity identifiers (invoice ID, payment ID, etc.)
- Before/after state for modifications

This ensures that even if a role has permission to perform an action, the action is attributed and traceable for audit and compliance purposes.

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md) |
| **Related** | [02-functional-requirements.md](02-functional-requirements.md) (FR-8), [06-business-rules.md](06-business-rules.md) |
| **Next Reading** | [06-business-rules.md](06-business-rules.md) → [07-workflows.md](07-workflows.md) |
