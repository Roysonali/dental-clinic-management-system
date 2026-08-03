# Functional Requirements — Billing Module

> **Document Type:** Functional Requirements Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Phase Labels:** [MVP], [PHASE 2], [PHASE 3] identify the target implementation phase for each requirement.

| Field | Value |
|---|---|
| Document | Functional Requirements Specification |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 01-business-analysis.md, 04-feature-list.md, 07-workflows.md |

---

## Table of Contents

1. [FR-1: Invoice Management](#fr-1-invoice-management-mvp)
2. [FR-2: Invoice Line Items](#fr-2-invoice-line-items-mvp)
3. [FR-3: Treatment Plan Integration](#fr-3-treatment-plan-integration-mvp)
4. [FR-4: Payment Management](#fr-4-payment-management-mvp)
5. [FR-5: Receipts](#fr-5-receipts-mvp)
6. [FR-6: Search & Filtering](#fr-6-search--filtering-mvp)
7. [FR-7: Audit Trail](#fr-7-audit-trail-mvp)
8. [FR-8: Role-based Permissions](#fr-8-role-based-permissions-mvp)
9. [FR-9: Discount Approval Workflow](#fr-9-discount-approval-workflow-phase-2)
10. [FR-10: Tax Management](#fr-10-tax-management-phase-2)
11. [FR-11: Refunds](#fr-11-refunds-phase-2)
12. [FR-12: Credit Notes](#fr-12-credit-notes-phase-2)
13. [FR-13: Patient Financial Summary](#fr-13-patient-financial-summary-phase-2)
14. [FR-14: Financial Dashboard](#fr-14-financial-dashboard-phase-2)
15. [FR-15: Reports](#fr-15-reports-phase-2)
16. [FR-16: Insurance Support](#fr-16-insurance-support-phase-3)
17. [FR-17: Payment Gateway Integration](#fr-17-payment-gateway-integration-phase-3)
18. [FR-18: Notifications](#fr-18-notifications-phase-3)
19. [FR-19: Patient Portal Integration](#fr-19-patient-portal-integration-phase-3)
20. [FR-20: Accounting Software Integration](#fr-20-accounting-software-integration-phase-3)
21. [FR-21: Multi-branch Support](#fr-21-multi-branch-support-phase-3)
22. [FR-22: Multi-currency Support](#fr-22-multi-currency-support-phase-3)
23. [FR-23: E-Invoicing](#fr-23-e-invoicing-phase-3)
24. [FR-24: Advance Payments / Patient Wallet](#fr-24-advance-payments--patient-wallet-phase-3)

---

## FR-1: Invoice Management [MVP]

**Actor:** Accountant, Billing Manager, Receptionist (view only)
**Preconditions:** User is authenticated. Patient record exists. For plan-linked invoices, a treatment plan in Accepted or In Progress status exists.
**Postconditions:** An invoice is created with a unique sequential number. Invoice status is set to Draft.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-1.1 | System SHALL create an invoice linked to a patient | Critical | Created invoice references a valid patient ID |
| FR-1.2 | System SHALL auto-generate a unique invoice number with configurable prefix | Critical | Invoice number format: configurable prefix + sequential number (e.g., INV-00001) |
| FR-1.3 | System SHALL support configurable invoice numbering (prefix, starting number, minimum digit length) | Critical | Prefix, starting number, and digit length configurable via system settings |
| FR-1.4 | System SHALL store invoice-level fields: invoice date, due date, currency, notes, terms and conditions | Critical | All fields stored and retrievable |
| FR-1.5 | System SHALL compute invoice totals: subtotal, total discount amount, total tax amount, grand total | Critical | Computed totals match manual calculation |
| FR-1.6 | System SHALL support the following invoice status lifecycle: Draft → Issued → Paid / Partially Paid / Overdue → Cancelled / Void | Critical | Status transitions follow defined state machine |
| FR-1.7 | System SHALL allow editing of Draft invoices only | Critical | Non-Draft invoices reject modification attempts |
| FR-1.8 | System SHALL allow issuing a Draft invoice, transitioning it to Issued status | Critical | Issued invoice is frozen; no further line-item edits |
| FR-1.9 | System SHALL support cancelling an Issued invoice with reason | Critical | Cancelled invoice retains all data; marked as cancelled |
| FR-1.10 | System SHALL support voiding an invoice with reason (for erroneous invoices) | High | Voided invoice retains all data; void reason recorded |
| FR-1.11 | System SHALL NOT allow hard deletion of any invoice after creation | Critical | Delete operation is prohibited; cancellation/voiding is the only option |
| FR-1.12 | System SHALL store invoice terms and conditions (free text) | Medium | Terms stored per invoice, defaulting from clinic configuration |
| FR-1.13 | System SHALL support optional reference to an appointment | Medium | Appointment ID stored when provided |
| FR-1.14 | System SHALL support optional reference to a treating doctor | Medium | Doctor ID stored when provided |

### Invoice Status Lifecycle

```
Draft → Issued
Draft → Cancelled (with reason)
Draft → Void (with reason)
Issued → Paid (when fully paid)
Issued → Partially Paid (when partially paid)
Issued → Overdue (when past due date with outstanding balance)
Issued → Cancelled (with reason)
Issued → Void (with reason)
Partially Paid → Paid (when remaining balance paid)
Partially Paid → Overdue (when past due with balance)
Partially Paid → Cancelled (with reason)
Partially Paid → Void (with reason; refund payments first)
Paid → Void (with reason; refund payments first)
Overdue → Paid (when balance paid)
Overdue → Partially Paid (when partial payment received)
Overdue → Cancelled (with reason)
Overdue → Void (with reason; refund payments first)
Cancelled → (Terminal)
Void → (Terminal)
```

---

## FR-2: Invoice Line Items [MVP]

**Actor:** Accountant, Billing Manager
**Preconditions:** An invoice exists. Procedures exist (if referencing treatment plan items).
**Postconditions:** Line items are added to the invoice with calculated amounts.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-2.1 | System SHALL add line items to an invoice | Critical | Line items stored with invoice reference |
| FR-2.2 | System SHALL store per line item: description, quantity, unit price, discount amount, discount percentage, tax rate, tax amount, net amount | Critical | All fields stored |
| FR-2.3 | System SHALL compute line item net amount as: (unit price × quantity) − discount | Critical | Computed correctly |
| FR-2.4 | System SHALL compute line item tax amount as: net amount × (tax rate / 100) | Critical | Computed correctly |
| FR-2.5 | System SHALL allow line-item-level discounts (fixed amount or percentage) | Critical | Both discount types supported |
| FR-2.6 | System SHALL allow editing of line items only when invoice is in Draft status | Critical | Non-Draft invoices reject line-item changes |
| FR-2.7 | System SHALL support optional reference to a treatment plan item ID | High | When sourced from treatment plan, the original plan item is tracked |
| FR-2.8 | System SHALL support optional reference to a procedure code from the Procedure catalog | High | Procedure code stored for reporting |
| FR-2.9 | System SHALL support optional reference to a diagnosis from Patient Records | Medium | Diagnosis ID stored for clinical context |
| FR-2.10 | System SHALL support non-procedure line items (e.g., consultation fee, lab fee, miscellaneous charge) | High | Free-text description with unit price allowed |
| FR-2.11 | System SHALL support line item ordering (sequence number) | Medium | Line items ordered within invoice |

---

## FR-3: Treatment Plan Integration [MVP]

**Actor:** Accountant, Billing Manager
**Preconditions:** A treatment plan exists in Accepted or In Progress status.
**Postconditions:** An invoice is created with line items matching the treatment plan items.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-3.1 | System SHALL generate an invoice from a treatment plan in a single action | Critical | Invoice created with all plan items as line items |
| FR-3.2 | System SHALL copy treatment plan item data (procedure, description, estimated cost, quantity) as invoice line item defaults | Critical | Defaults copied; prices may be overridden |
| FR-3.3 | System SHALL allow override of unit prices when generating invoice from plan | Critical | Price override permitted with audit tracking |
| FR-3.4 | System SHALL track the price difference between treatment plan estimate and invoice amount per line item | High | Difference stored for reporting |
| FR-3.5 | System SHALL support generating an invoice from multiple treatment plans for the same patient | High | Multiple plan references on single invoice |
| FR-3.6 | System SHALL support partial billing (select subset of treatment plan items for invoicing) | High | Unbilled plan items remain available for future invoices |
| FR-3.7 | System SHALL mark treatment plan items as invoiced after invoice generation | Critical | Plan items show invoiced status; prevents double billing |
| FR-3.8 | System SHALL NOT allow generating an invoice from a treatment plan in Draft or Cancelled status | Critical | Plan must be Accepted or In Progress |

---

## FR-4: Payment Management [MVP]

**Actor:** Receptionist, Accountant, Billing Manager
**Preconditions:** An invoice exists. Invoice is in Issued status or later.
**Postconditions:** A payment is recorded. Invoice payment status is updated.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-4.1 | System SHALL record a payment against one or more invoices | Critical | Payment recorded with invoice allocation |
| FR-4.2 | System SHALL support the following payment methods: Cash, Card (Credit/Debit), Cheque, Bank Transfer, Other | Critical | All methods selectable |
| FR-4.3 | System SHALL support multiple partial payments against a single invoice | Critical | Invoice can have multiple payment records |
| FR-4.4 | System SHALL update invoice status to "Paid" when total payments equal or exceed invoice total | Critical | Status transition triggered |
| FR-4.5 | System SHALL update invoice status to "Partially Paid" when partial payment is received | Critical | Status reflects partial payment |
| FR-4.6 | System SHALL update invoice status to "Overdue" when due date has passed and balance remains | Critical | Automated or event-driven status check |
| FR-4.7 | System SHALL store per payment: amount, method, reference number (e.g., cheque number, transaction ID), payment date, notes | Critical | All fields stored |
| FR-4.8 | System SHALL support payment reversal with reason | High | Reversal recorded with audit trail; invoice balance recalculated |
| FR-4.9 | System SHALL allow over-payment (payment exceeding invoice total) | Medium | Overpayment recorded; excess treated as credit towards future invoices |
| FR-4.10 | System SHALL attribute a single payment across multiple invoices (bulk payment) | High | Payment split across invoice allocations |
| FR-4.11 | System SHALL display remaining balance on the invoice | Critical | Balance = total − sum(payments) |

---

## FR-5: Receipts [MVP]

**Actor:** System (automatic), Receptionist, Accountant
**Preconditions:** A payment is completed against an invoice.
**Postconditions:** A receipt is generated and available for viewing/printing.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-5.1 | System SHALL generate a receipt when requested via API for a completed payment | Critical | Receipt generated on explicit API call |
| FR-5.2 | System SHALL generate a unique receipt number with configurable prefix | Critical | Receipt number format: configurable prefix + sequential number |
| FR-5.3 | System SHALL store receipt details: receipt number, receipt date, payment reference, invoice reference, amount, payment method, patient name, payment collector | Critical | All fields stored |
| FR-5.4 | System SHALL support consolidated receipt for multiple invoices paid in a single transaction | High | Single receipt references multiple invoices |
| FR-5.5 | System SHALL support re-printing of any previously generated receipt | High | Receipts retrievable by number, invoice, or patient |
| FR-5.6 | System SHALL support displaying receipt in printable format | Medium | Print-formatted view available |

---

## FR-6: Search & Filtering [MVP]

**Actor:** All billing users
**Preconditions:** Financial records exist.
**Postconditions:** Matching records are displayed in paginated results.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-6.1 | System SHALL search invoices by invoice number (exact and partial match) | Critical | Search returns matching invoices |
| FR-6.2 | System SHALL search invoices by patient name (partial, case-insensitive match) | Critical | Search returns matching invoices |
| FR-6.3 | System SHALL search payments by payment reference number | Critical | Search returns matching payments |
| FR-6.4 | System SHALL filter invoices by status (Draft, Issued, Paid, Partially Paid, Overdue, Cancelled, Void) | Critical | Filter returns correct subset |
| FR-6.5 | System SHALL filter by date range (invoice date, due date, payment date) | Critical | Date range filter on all financial records |
| FR-6.6 | System SHALL filter invoices by patient ID | High | Patient-scoped listing |
| FR-6.7 | System SHALL filter by payment method | High | Payment method filter |
| FR-6.8 | System SHALL support pagination with configurable page size (default 20, max 100) | Critical | Paginated results with total count |
| FR-6.9 | System SHALL support sorting by invoice date, due date, amount, status, patient name | High | ASC/DESC sorting |

---

## FR-7: Audit Trail [MVP]

**Actor:** System (automatic)
**Preconditions:** Any financial transaction occurs.
**Postconditions:** An audit record is created.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-7.1 | System SHALL record the user who created any financial record | Critical | Creation user stored |
| FR-7.2 | System SHALL record the user who last updated any financial record | Critical | Last-update user stored |
| FR-7.3 | System SHALL record the timestamp when any financial record was created | Critical | Creation timestamp stored |
| FR-7.4 | System SHALL record the timestamp when any financial record was last updated | Critical | Update timestamp stored |
| FR-7.5 | System SHALL maintain a status change history log for every invoice | Critical | Status changes tracked with old status, new status, user, timestamp, reason |
| FR-7.6 | System SHALL maintain a payment history log for every invoice | Critical | Payment additions and reversals tracked |
| FR-7.7 | System SHALL track price overrides with original and new values | High | Override history stored per line item |
| FR-7.8 | System SHALL NOT allow modification or deletion of any audit record | Critical | Audit records are append-only |

---

## FR-8: Role-based Permissions [MVP]

**Actor:** System (enforcement)
**Preconditions:** User is authenticated. RBAC module is available.
**Postconditions:** Permission check passes or fails.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-8.1 | System SHALL enforce that only authorized roles can create invoices | Critical | Unauthorized user receives permission error |
| FR-8.2 | System SHALL enforce that only authorized roles can record payments | Critical | Unauthorized user receives permission error |
| FR-8.3 | System SHALL enforce that only authorized roles can void/cancel invoices | Critical | Unauthorized user receives permission error |
| FR-8.4 | System SHALL enforce that only authorized roles can approve discounts | Critical | Unauthorized user receives permission error |
| FR-8.5 | System SHALL enforce that only authorized roles can reverse payments | Critical | Unauthorized user receives permission error |
| FR-8.6 | System SHALL enforce read-only access for roles without billing permissions | High | View-only users see data but cannot modify |
| FR-8.7 | System SHALL enforce branch-scoped permissions for multi-branch deployments | Medium | Users in Branch A cannot see Branch B financial data |

---

## FR-9: Discount Approval Workflow [Phase 2]

**Actor:** Accountant (requester), Billing Manager / Clinic Administrator (approver)
**Preconditions:** Invoice exists. Discount amount or percentage exceeds configured threshold.
**Postconditions:** Discount is approved or rejected.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-9.1 | System SHALL support configurable discount approval thresholds (percentage and/or fixed amount) | High | Thresholds configurable via system settings |
| FR-9.2 | System SHALL require approval when a discount exceeds the configured threshold | High | Discount not applied until approved |
| FR-9.3 | System SHALL send approval request to configured approver(s) | High | Approval request created and routed |
| FR-9.4 | System SHALL record approval or rejection with user, timestamp, and notes | High | Decision audited |
| FR-9.5 | System SHALL allow approval escalation to higher-level approver | Medium | Escalation configurable |
| FR-9.6 | System SHALL expire approval requests after a configurable period | Medium | Pending approvals older than threshold are expired |

---

## FR-10: Tax Management [Phase 2]

**Actor:** Clinic Administrator, Accountant
**Preconditions:** System is configured with tax rates.
**Postconditions:** Tax is calculated on invoices.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-10.1 | System SHALL support configurable tax rates with name, rate percentage, and applicability rules | High | Tax rates configurable |
| FR-10.2 | System SHALL allow multiple tax rates applicable to a single invoice line item | High | E.g., GST + PST |
| FR-10.3 | System SHALL auto-calculate tax on invoice line items based on applicable rates | High | Calculation accurate |
| FR-10.4 | System SHALL support tax-exempt line items with reason | High | Tax-exempt flag with explanation |
| FR-10.5 | System SHALL support tax-exempt invoices with reason | Medium | Invoice-level tax exemption |
| FR-10.6 | System SHALL freeze tax rate at invoice creation time | High | Rate changes do not retroactively affect existing invoices |
| FR-10.7 | System SHALL display tax breakdown per rate on invoice | High | Tax shown per applicable rate |
| FR-10.8 | System SHALL provide tax summary data for reporting | Medium | Tax collected per rate per period queryable |

---

## FR-11: Refunds [Phase 2]

**Actor:** Accountant, Billing Manager
**Preconditions:** A payment exists against an invoice. Refund reason is provided.
**Postconditions:** Refund is processed. Payment is reversed.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-11.1 | System SHALL process full refund of a payment | High | Payment fully reversed |
| FR-11.2 | System SHALL process partial refund of a payment | High | Payment partially reversed; remaining balance retained |
| FR-11.3 | System SHALL record refund reason, authorized by user, and timestamp | High | Refund data recorded |
| FR-11.4 | System SHALL require refund approval for amounts exceeding a configurable threshold | High | Over-threshold refunds require approval |
| FR-11.5 | System SHALL generate a refund receipt | High | Refund receipt created |
| FR-11.6 | System SHALL link refund to the original payment method | Medium | Original payment method tracked when available |

---

## FR-12: Credit Notes [Phase 2]

**Actor:** Accountant, Billing Manager
**Preconditions:** An invoice exists. A valid reason for credit note issuance exists.
**Postconditions:** Credit note is created. Patient balance is adjusted.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-12.1 | System SHALL issue a credit note against an invoice | High | Credit note references original invoice |
| FR-12.2 | System SHALL auto-generate a unique credit note number | High | Sequential, configurable prefix |
| FR-12.3 | System SHALL store credit note reason, amount, and line-item details | High | All fields stored |
| FR-12.4 | System SHALL allow application of credit note balance to outstanding invoices | High | Credit applied to specified invoice(s) |
| FR-12.5 | System SHALL support partial credit note application | High | Remaining credit available for future use |
| FR-12.6 | System SHALL expire credit notes after a configurable period | Medium | Expired credits cannot be applied |
| FR-12.7 | System SHALL support voiding an unused credit note | High | Voided with reason |

---

## FR-13: Patient Financial Summary [Phase 2]

**Actor:** Accountant, Receptionist, Patient (via portal Phase 3)
**Preconditions:** Patient has financial records.
**Postconditions:** Summary view is displayed.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-13.1 | System SHALL display per-patient invoice list with status and amounts | High | All invoices listed for patient |
| FR-13.2 | System SHALL display per-patient payment history | High | All payments listed chronologically |
| FR-13.3 | System SHALL display outstanding balance for patient | High | Balance = total billed − total paid − total credit |
| FR-13.4 | System SHALL display treatment plan cost vs. actual billed comparison | Medium | Side-by-side comparison view |
| FR-13.5 | System SHALL display credit note balance | Medium | Available credit displayed |

---

## FR-14: Financial Dashboard [Phase 2]

**Actor:** Accountant, Clinic Administrator, Billing Manager
**Preconditions:** Financial data exists.
**Postconditions:** Dashboard is displayed with metrics.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-14.1 | System SHALL display daily revenue total | High | Current day's collected revenue |
| FR-14.2 | System SHALL display weekly and monthly revenue totals | High | Period-based totals |
| FR-14.3 | System SHALL display outstanding receivables aging (0-30, 31-60, 61-90, 90+ days) | High | Aging buckets with amounts |
| FR-14.4 | System SHALL display payment method distribution | Medium | Pie/bar chart of payment methods |
| FR-14.5 | System SHALL display invoice status distribution | Medium | Count of invoices per status |
| FR-14.6 | System SHALL display tax collected summary for the period | Medium | Tax per rate |
| FR-14.7 | System SHALL support configurable dashboard date range | High | User can select period |

---

## FR-15: Reports [Phase 2]

**Actor:** Accountant, Clinic Administrator
**Preconditions:** Financial data exists.
**Postconditions:** Report is generated and available for download.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-15.1 | System SHALL generate a revenue report for any date range | High | Revenue by day with totals |
| FR-15.2 | System SHALL generate receivables aging report | High | Outstanding by aging bucket |
| FR-15.3 | System SHALL generate tax summary report per rate per period | High | Tax totals per rate |
| FR-15.4 | System SHALL generate payment method summary report | Medium | Amounts per payment method |
| FR-15.5 | System SHALL generate discount summary report | Medium | Discount totals and count |
| FR-15.6 | System SHALL support report export to CSV format | High | Downloadable CSV |
| FR-15.7 | System SHALL support report export to PDF format | Medium | Downloadable PDF |
| FR-15.8 | System SHALL support report export to Excel format | Medium | Downloadable XLSX |

---

## FR-16: Insurance Support [Phase 3]

**Actor:** Insurance Desk Staff, Accountant
**Preconditions:** Insurance module is installed. Patient insurance policy is configured.
**Postconditions:** Insurance claim is submitted. Receivable is tracked.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-16.1 | System SHALL manage insurance provider master data (name, address, contact, electronic claim capability) | Medium | Providers configurable |
| FR-16.2 | System SHALL store patient insurance policy (provider, policy number, coverage percentage/deductible, effective dates) | Medium | Policies stored per patient |
| FR-16.3 | System SHALL generate insurance claims from invoice line items | Medium | Claim created based on invoice data |
| FR-16.4 | System SHALL track claim submission and status | Medium | Claim status (submitted, accepted, rejected, pending, paid) |
| FR-16.5 | System SHALL track insurance receivable separately from patient receivable | Medium | Split receivable tracking |
| FR-16.6 | System SHALL support coordination of benefits (primary + secondary insurance) | Low | Both insurance claims generated |

---

## FR-17: Payment Gateway Integration [Phase 3]

**Actor:** System (automatic), Patient (via portal)
**Preconditions:** Payment gateway is configured. Invoice exists.
**Postconditions:** Payment is processed and recorded.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-17.1 | System SHALL integrate with at least one payment gateway for online payments | Medium | Gateway connection operational |
| FR-17.2 | System SHALL generate payment links for invoices | Medium | Shareable payment URL |
| FR-17.3 | System SHALL automatically record payments received via gateway | Medium | Payment posted from webhook |
| FR-17.4 | System SHALL reconcile gateway payouts with recorded payments | Medium | Batch reconciliation support |

---

## FR-18: Notifications [Phase 3]

**Actor:** System (automatic)
**Preconditions:** Notification configuration is enabled.
**Postconditions:** Notification is sent.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-18.1 | System SHALL send invoice notification to patient (email/SMS) when invoice is issued | Medium | Notification delivered |
| FR-18.2 | System SHALL send payment due reminders before due date | Medium | Reminder sent at configurable interval |
| FR-18.3 | System SHALL send overdue invoice notification | Medium | Overdue alert sent |
| FR-18.4 | System SHALL send payment confirmation with receipt | Medium | Confirmation with receipt attachment |

---

## FR-19: Patient Portal Integration [Phase 3]

**Actor:** Patient
**Preconditions:** Patient portal module is installed. Patient account exists.
**Postconditions:** Patient views billing data.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-19.1 | System SHALL display invoice list to patient via portal | Medium | Patient sees invoices |
| FR-19.2 | System SHALL display invoice detail (line items, totals, status) | Medium | Invoice detail visible |
| FR-19.3 | System SHALL allow patient to make online payments via portal | Medium | Payment processed |
| FR-19.4 | System SHALL allow patient to download invoices and receipts | Medium | PDF download available |

---

## FR-20: Accounting Software Integration [Phase 3]

**Actor:** Accountant, System (automatic)
**Preconditions:** Accounting software integration is configured.
**Postconditions:** Financial data is exported.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-20.1 | System SHALL export invoice data in format compatible with accounting software | Medium | Export generated (e.g., CSV, JSON) |
| FR-20.2 | System SHALL support chart of accounts mapping | Medium | Accounts configurable per transaction type |
| FR-20.3 | System SHALL export payment data with invoice references | Medium | Payments included in export |
| FR-20.4 | System SHALL support automated scheduled exports | Low | Daily/weekly export schedule |

---

## FR-21: Multi-branch Support [Phase 3]

**Actor:** Clinic Administrator, Accountant
**Preconditions:** Multiple branches are configured in the system.
**Postconditions:** Branch-scoped financial operations.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-21.1 | System SHALL support branch-level invoice numbering | Low | Each branch has independent sequence |
| FR-21.2 | System SHALL support branch-level tax configuration | Low | Tax rates per branch |
| FR-21.3 | System SHALL support consolidated cross-branch reporting | Low | Super-admin can view all branches |
| FR-21.4 | System SHALL support branch-scoped user permissions | Low | User sees only assigned branch(es) |

---

## FR-22: Multi-currency Support [Phase 3]

**Actor:** Accountant, Clinic Administrator
**Preconditions:** Multi-currency configuration is enabled.
**Postconditions:** Foreign currency transactions are processed.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-22.1 | System SHALL support invoicing in foreign currencies | Low | Currency selectable per invoice |
| FR-22.2 | System SHALL support exchange rate management (manual or automated) | Low | Rates configurable |
| FR-22.3 | System SHALL display amounts in both invoice currency and base currency | Low | Dual display for reporting |
| FR-22.4 | System SHALL freeze exchange rate at invoice creation | Low | Rate locked for audit |

---

## FR-23: E-Invoicing [Phase 3]

**Actor:** System (automatic)
**Preconditions:** E-invoicing standards are configured per region.
**Postconditions:** Invoice is submitted to regulatory portal.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-23.1 | System SHALL support e-invoicing format per regional standards | Low | E-invoice compliant with target standard |
| FR-23.2 | System SHALL support digital signature for e-invoices | Low | Signature applied |
| FR-23.3 | System SHALL support submission to government e-invoicing portal | Low | Submission successful |

---

## FR-24: Advance Payments / Patient Wallet [Phase 3]

**Actor:** Receptionist, Patient, Accountant
**Preconditions:** Patient wallet feature is configured.
**Postconditions:** Advance payment is recorded. Wallet balance is updated.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-24.1 | System SHALL support advance payment collection from patient | Low | Pre-payment recorded in wallet |
| FR-24.2 | System SHALL maintain patient wallet balance | Low | Running balance tracked |
| FR-24.3 | System SHALL allow wallet balance to be consumed against invoices | Low | Wallet deduction on invoice payment |
| FR-24.4 | System SHALL support wallet top-up via multiple payment methods | Low | Top-up recorded |
| FR-24.5 | System SHALL support wallet refund | Low | Refund against wallet balance |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md), [glossary.md](glossary.md) |
| **Related** | [04-feature-list.md](04-feature-list.md), [06-business-rules.md](06-business-rules.md), [07-workflows.md](07-workflows.md) |
| **Next Reading** | [03-non-functional-requirements.md](03-non-functional-requirements.md) → [06-business-rules.md](06-business-rules.md) |
