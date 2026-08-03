# Glossary — Billing Module

> **Document Type:** Terminology Reference
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Standardized terminology reference for all stakeholders across the Billing module documentation.

| Field | Value |
|---|---|
| Document | Glossary |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | All billing module documents |

---

## Table of Contents

- [A](#a)
- [B](#b)
- [C](#c)
- [D](#d)
- [E](#e)
- [F](#f)
- [G](#g)
- [I](#i)
- [J](#j)
- [L](#l)
- [M](#m)
- [N](#n)
- [O](#o)
- [P](#p)
- [R](#r)
- [S](#s)
- [T](#t)
- [U](#u)
- [V](#v)
- [W](#w)

---

## A

### Accounting Software Integration
- **Definition:** The ability to export billing data (invoices, payments, credit notes) to third-party accounting platforms such as QuickBooks, Xero, or Zoho Books.
- **Context:** Phase 3 capability. Allows clinics to maintain their external accounting systems without manual data entry.
- **Related:** Chart of Accounts, Journal Entry, Export

### Advance Payment
- **Definition:** A payment collected from a patient before services are rendered or before an invoice is generated.
- **Context:** Also known as a deposit or pre-payment. Stored as a credit in the patient's wallet (Phase 3).
- **Related:** Patient Wallet, Deposit, Pre-payment

### Aging (Receivables Aging)
- **Definition:** The classification of outstanding invoice balances by time period since the invoice due date — typically 0–30 days, 31–60 days, 61–90 days, and 90+ days.
- **Context:** Used in financial reporting to track how long invoices have been unpaid. Key metric for cash flow management.
- **Related:** Overdue, Receivables, Outstanding Balance

### Approval Request
- **Definition:** A formal request submitted when a discount, refund, or void action exceeds a configured threshold, requiring review and approval by an authorized user.
- **Context:** Part of the Discount Approval Workflow (Phase 2). Tracks the requester, amount, reason, status, and resolution.
- **Related:** Discount Approval Workflow, Threshold, Escalation

### Audit Trail
- **Definition:** A chronological record of all changes made to financial data, capturing who made the change, what changed, when, and why.
- **Context:** Every mutation (create, update, cancel, void, reverse) is recorded. Audit records are append-only and immutable.
- **Related:** Immutability, Status Change History, Price Override

---

## B

### Base Currency
- **Definition:** The primary currency used for financial reporting in a clinic. All multi-currency transactions are converted to the base currency for consolidated reporting.
- **Context:** Phase 3 feature. Configurable per clinic.
- **Related:** Multi-currency, Exchange Rate

### Billing Manager

### BRD (Business Requirements Document)
- **Definition:** A formal document that defines the business objectives, scope, stakeholder needs, functional and non-functional requirements for a module or project.
- **Context:** The Billing module BRD is documented in `01-business-analysis.md`. It serves as the authoritative reference for architects, engineers, QA, product owners, and clinic administrators.
- **Related:** Functional Requirement, NFR, Scope, Stakeholder

- **Definition:** A business role responsible for day-to-day billing operations, including invoice creation, payment recording, discount approval, refunds, and credit notes.
- **Context:** One of the primary actors for the Billing module. Maps to the Accountant / Billing Manager role in the RBAC system.
- **Related:** Clinic Administrator, Receptionist

### Branch
- **Definition:** A physical location of a dental clinic operating under the same organization. In multi-branch deployments, each branch may have independent numbering, tax configuration, and user permissions.
- **Context:** Phase 3 capability.
- **Related:** Multi-branch Support, Branch-scoped Permission

---

## C

### Cancellation
- **Definition:** The act of marking an invoice as cancelled before any payment is received. The invoice number is retired and not reused.
- **Context:** Distinct from Voiding — cancellation applies only to invoices with no payments. See Void.
- **Related:** Void, Invoice Status Lifecycle

### Chart of Accounts
- **Definition:** A listing of financial accounts used in accounting systems to categorize transactions (e.g., revenue accounts, asset accounts, liability accounts).
- **Context:** Used in Accounting Software Integration (Phase 3) to map DensCare transaction types to accounting system accounts.
- **Related:** Accounting Software Integration, Journal Entry

### Cheque
- **Definition:** A payment method where the patient issues a physical or digital cheque. The cheque number is recorded for tracking.
- **Context:** One of the supported payment methods in the Billing module.
- **Related:** Payment Method

### Clinic Administrator
- **Definition:** A business role with the highest level of billing permissions, including configuration, approval of large financial actions, and full data visibility.
- **Context:** Maps to the Clinic Administrator role in DensCare. Typically the practice owner or general manager.
- **Related:** Billing Manager, Configure Billing Settings

### Consolidated Receipt
- **Definition:** A single receipt covering multiple invoices paid in one transaction. Useful when a patient pays for several treatments at once.
- **Context:** Supported in MVP when a single payment is allocated across multiple invoices.
- **Related:** Receipt, Multi-invoice Payment

### Coordination of Benefits
- **Definition:** The process of determining payment responsibility when a patient is covered by more than one insurance policy (primary and secondary).
- **Context:** Phase 3 insurance feature. Claims are submitted to both insurers in a defined order.
- **Related:** Insurance Support, Primary Insurance, Secondary Insurance

### Credit Note
- **Definition:** A financial document issued to correct an invoice — reducing the amount owed or providing a credit for future services.
- **Context:** Phase 2 feature. Used for price adjustments, returned services, or billing errors. Has a unique sequential number and configurable expiry.
- **Related:** Invoice, Refund, Patient Credit

### Credit Note Expiry
- **Definition:** The date after which a credit note can no longer be applied to invoices.
- **Context:** Configurable per clinic or per credit note. Prevents indefinite outstanding credits.
- **Related:** Credit Note

---

## D

### Deposit
- **Definition:** See Advance Payment.

### Discount
- **Definition:** A reduction applied to the price of a line item or the total of an invoice. Can be a fixed amount or a percentage.
- **Context:** Applied at the line-item level or invoice level. Discounts exceeding configured thresholds require approval (Phase 2).
- **Related:** Discount Approval Workflow, Threshold, Price Override

### Discount Approval Workflow
- **Definition:** A multi-step process for approving discounts that exceed a configured threshold, involving request, review, approval/rejection, and audit.
- **Context:** Phase 2 feature. Prevents unauthorized discounting by requiring supervisory approval.
- **Related:** Discount, Threshold, Approval Request

### Draft
- **Definition:** The initial status of an invoice, during which it can be freely edited. The only editable status in the invoice lifecycle.
- **Context:** Invoices must be issued (transitioned from Draft to Issued) before payments can be collected against them.
- **Related:** Invoice Status Lifecycle, Issued

### Due Date
- **Definition:** The date by which an invoice's outstanding balance must be paid to avoid being marked as Overdue.
- **Context:** Defaults to invoice date + configured payment terms (e.g., 30 days). Configurable per clinic.
- **Related:** Overdue, Payment Terms

---

## E

### E-Invoicing
- **Definition:** The electronic generation, transmission, and receipt of invoices in a structured, standards-compliant digital format, often with digital signatures and government portal submission.
- **Context:** Phase 3 capability. Required in jurisdictions with mandatory e-invoicing regulations (e.g., EU, Saudi Arabia, India).
- **Related:** Digital Signature, Government Portal Submission

### EDI (Electronic Data Interchange)
- **Definition:** A standardized electronic format for exchanging business documents between organizations, such as insurance claim submissions between healthcare providers and insurance companies.
- **Context:** Referenced in FR-16 (Insurance Support) as a claim submission method (Phase 3). Allows automated submission of insurance claims in standardized EDI formats (e.g., ANSI X12 837 dental claim).
- **Related:** Insurance Support, Insurance Claim, Coordination of Benefits

### Escalation
- **Definition:** The routing of an approval request to a higher-level approver when the primary approver does not act within a defined time period.
- **Context:** Part of the Discount Approval Workflow (Phase 2). Prevents bottlenecks in the approval process.
- **Related:** Approval Request, Discount Approval Workflow

### Exchange Rate
- **Definition:** The rate at which one currency can be exchanged for another. Frozen at the time of invoice creation for audit purposes.
- **Context:** Phase 3 capability. Can be entered manually or sourced from an automated exchange rate service.
- **Related:** Multi-currency, Base Currency

### Export
- **Definition:** The ability to download financial data (reports, transactions) in standard formats such as CSV, PDF, or Excel.
- **Context:** Phase 2 reporting feature. Also used for Accounting Software Integration (Phase 3).
- **Related:** Reports, Accounting Software Integration

---

## F

### Financial Dashboard
- **Definition:** A real-time visual display of key financial metrics including revenue totals, receivables aging, payment method distribution, and tax collected.
- **Context:** Phase 2 feature. Provides at-a-glance financial performance monitoring.
- **Related:** Reports, Revenue, Receivables Aging

### Full Refund
- **Definition:** A refund that returns the entire amount of a payment to the patient.
- **Context:** Phase 2 feature. Results in the payment being fully reversed.
- **Related:** Refund, Partial Refund

---

## G

### Government Portal Submission
- **Definition:** The electronic submission of invoices to a government-mandated tax or e-invoicing portal as required by local regulations.
- **Context:** Phase 3 e-invoicing capability.
- **Related:** E-Invoicing

### Grand Total
- **Definition:** The final amount of an invoice, computed as: subtotal − total discount + total tax.
- **Context:** Computed server-side; never accepted from client input. Displayed prominently on invoices.
- **Related:** Subtotal, Total Discount, Total Tax

---

## I

### Idempotency Key
- **Definition:** A unique identifier provided by the client when creating a payment, ensuring that the same payment is not processed more than once even if the request is retried.
- **Context:** Critical for payment gateway integration (Phase 3) to prevent duplicate charges.
- **Related:** Payment Gateway Integration

### Immutability
- **Definition:** The property of financial records that prevents modification after they are finalized. Once an invoice is issued or a payment is recorded, its core data cannot be changed.
- **Context:** Financial integrity principle. Corrections flow through credit notes, cancellations, or voids — never through in-place edits.
- **Related:** Audit Trail, Issued, Void

### Insurance Claim
- **Definition:** A formal request submitted to an insurance provider for reimbursement of covered dental procedures.
- **Context:** Phase 3 feature. Generated from invoice line items referencing insurable procedures.
- **Related:** Insurance Support, Coordination of Benefits

### Insurance Provider
- **Definition:** An external company that provides dental insurance coverage to patients. Managed as master data in the Insurance module.
- **Context:** Phase 3 feature. Stores provider details, claim submission methods, and contact information.
- **Related:** Insurance Support, Patient Insurance Policy

### Insurance Support
- **Definition:** The overall capability for managing insurance billing, including provider management, policy tracking, claim generation, and receivable tracking.
- **Context:** Phase 3 feature. Requires coordination with the Insurance module.
- **Related:** Insurance Claim, Insurance Provider, Patient Insurance Policy

### Invoice
- **Definition:** A formal financial document issued by the clinic to a patient, listing services provided with itemized charges, discounts, taxes, and the total amount due.
- **Context:** The core entity of the Billing module. Has a unique sequential number, status lifecycle, and associated line items, payments, receipts, and credit notes.
- **Related:** Invoice Number, Invoice Status Lifecycle, Line Item

### Invoice Date
- **Definition:** The date on which an invoice is issued. Used for payment terms calculation and reporting.
- **Context:** Defaults to current date. Distinct from the due date.
- **Related:** Due Date

### Invoice Number
- **Definition:** A unique, sequentially generated identifier for an invoice. Configurable prefix and digit length.
- **Context:** Must be gapless and non-reusable for legal compliance. Different from the system's internal record ID.
- **Related:** Sequential Numbering, Invoice

### Invoice Status Lifecycle
- **Definition:** The defined set of statuses an invoice can occupy and the valid transitions between them: Draft → Issued → Paid / Partially Paid / Overdue → Cancelled / Void.
- **Context:** Transitions are guarded — invalid transitions (e.g., Draft → Paid) are rejected.
- **Related:** Draft, Issued, Paid, Partially Paid, Overdue, Cancelled, Void

### Issued
- **Definition:** The status of an invoice after it has been finalized and made available for payment. Once Issued, the invoice is immutable.
- **Context:** Invoices in Issued status cannot have their line items modified. Corrections require cancellation + re-issuance or credit notes.
- **Related:** Invoice Status Lifecycle, Immutability

---

## J

### Journal Entry
- **Definition:** An accounting record that debits and credits different accounts to represent a financial transaction (e.g., invoicing a patient debits Accounts Receivable and credits Revenue).
- **Context:** Used in Accounting Software Integration (Phase 3) to export transactions in a format compatible with double-entry accounting.
- **Related:** Accounting Software Integration, Chart of Accounts

---

## L

### Line Item
- **Definition:** An individual entry on an invoice representing a single charge for a product or service, with description, quantity, unit price, discount, tax, and net amount.
- **Context:** An invoice must have at least one line item. Line items can reference treatment plan items, procedure codes, or be free-text entries.
- **Related:** Invoice, Net Amount, Unit Price

---

## M

### Multi-branch Support
- **Definition:** The capability to configure and operate the Billing module independently per clinic branch while supporting consolidated cross-branch reporting.
- **Context:** Phase 3 feature. Includes branch-level numbering, tax configuration, and user permissions.
- **Related:** Branch, Branch-scoped Permission

### Multi-currency Support
- **Definition:** The capability to invoice and accept payments in multiple currencies, with exchange rate management and dual-amount display.
- **Context:** Phase 3 feature. Currency is frozen at invoice creation.
- **Related:** Base Currency, Exchange Rate

### Multi-invoice Payment
- **Definition:** A single payment that is allocated across multiple invoices. Common when a patient pays a consolidated amount covering several treatments.
- **Context:** Supported in MVP. The payment amount is split into allocations per invoice.
- **Related:** Payment, Payment Allocation

---

## N

### NFR (Non-Functional Requirement)
- **Definition:** A requirement that specifies system qualities rather than specific behaviors — such as performance, security, availability, auditability, reliability, and maintainability.
- **Context:** The Billing module NFRs are documented in `03-non-functional-requirements.md`. They define targets for response times, throughput, uptime, encryption, logging, and error handling.
- **Related:** Functional Requirement, Performance, Security, Availability

### Net Amount
- **Definition:** The effective charge for a line item after applying discounts but before tax: (unit price × quantity) − discount.
- **Context:** Computed server-side. Tax is calculated on the net amount.
- **Related:** Line Item, Unit Price, Discount

### Notifications
- **Definition:** Automated email or SMS messages sent to patients or staff for billing events such as invoice issuance, payment reminders, overdue alerts, and payment confirmations.
- **Context:** Phase 3 feature. Requires notification module and template management.
- **Related:** Invoice, Payment, Overdue

---

## O

### Outstanding Balance
- **Definition:** The remaining amount due on an invoice, computed as: grand total − sum of payments + sum of refunds − applied credits.
- **Context:** Displayed on invoices and patient financial summaries. Drives overdue status determination.
- **Related:** Invoice, Payment, Partial Payment, Credit Note

### Overdue
- **Definition:** The status of an invoice when the due date has passed and the outstanding balance is greater than zero.
- **Context:** Overdue invoices are tracked in receivables aging reports. May trigger notifications (Phase 3).
- **Related:** Due Date, Outstanding Balance, Receivables Aging

### Overpayment
- **Definition:** A payment that exceeds the outstanding balance of an invoice.
- **Context:** Requires explicit confirmation during payment entry. The excess is recorded as a patient credit.
- **Related:** Patient Credit, Payment

---

## P

### Paid
- **Definition:** The status of an invoice when the sum of all payments equals or exceeds the grand total.
- **Context:** The final positive status in the invoice lifecycle.
- **Related:** Invoice Status Lifecycle, Outstanding Balance

### Paid (Status)
- **Definition:** See Paid.

### Partial Payment
- **Definition:** A payment that covers only part of an invoice's outstanding balance, leaving a remaining balance.
- **Context:** Multiple partial payments can be recorded against a single invoice. The invoice status changes to Partially Paid until the balance is cleared.
- **Related:** Payment, Outstanding Balance, Partially Paid

### Partially Paid
- **Definition:** The status of an invoice that has received at least one payment but still has an outstanding balance.
- **Context:** Intermediate status between Issued and Paid.
- **Related:** Invoice Status Lifecycle, Partial Payment

### Patient
- **Definition:** The recipient of dental services and the responsible party for invoice payment. Invoices are always linked to a patient.
- **Context:** The patient record is sourced from the Patient Management module. The patient may have a financial responsibility (direct) or may have a third-party payer (insurance).
- **Related:** Patient Management Module, Patient Financial Summary

### Patient Credit
- **Definition:** A positive balance on a patient's account, resulting from overpayment or unapplied credit notes.
- **Context:** Patient credit can be applied to future invoices. Tracked in the Patient Financial Summary (Phase 2).
- **Related:** Overpayment, Credit Note, Patient Financial Summary

### Patient Financial Summary
- **Definition:** A comprehensive view of a patient's financial status, including all invoices, payments, credits, outstanding balance, and treatment cost vs. billed comparison.
- **Context:** Phase 2 feature. Provides a single-page view for billing inquiries.
- **Related:** Patient, Outstanding Balance, Patient Credit

### Patient Insurance Policy
- **Definition:** The record of a patient's insurance coverage, including provider, policy number, coverage percentage, deductible, and effective dates.
- **Context:** Phase 3 feature. Stored per patient, potentially multiple policies (primary + secondary).
- **Related:** Insurance Support, Insurance Provider

### Patient Portal
- **Definition:** A web-based interface through which patients can view their billing information, make payments, and download documents.
- **Context:** Phase 3 feature. Requires a separate Patient Portal module.
- **Related:** Invoice, Receipt, Online Payment

### Patient Wallet
- **Definition:** A stored-value account associated with a patient, holding advance payments and credits that can be consumed against invoices.
- **Context:** Phase 3 feature. Supports top-ups, consumption, and refunds.
- **Related:** Advance Payment, Patient Credit

### Payment
- **Definition:** A financial transaction where money is transferred from the patient (or third party) to the clinic in settlement of an invoice.
- **Context:** Recorded with method, amount, date, and invoice allocation. Supports multiple payment methods and partial/in-full payments.
- **Related:** Payment Method, Payment Allocation, Payment Reversal

### Payment Allocation
- **Definition:** The assignment of a payment's amount to one or more invoices.
- **Context:** A single payment can be split across multiple invoices. The sum of allocations must equal the payment amount.
- **Related:** Payment, Multi-invoice Payment

### Payment Gateway
- **Definition:** An external service that processes online payments (credit card, debit card) on behalf of the clinic.
- **Context:** Phase 3 feature. Requires provider-agnostic abstraction layer.
- **Related:** Payment Gateway Integration, Online Payment

### Payment Method
- **Definition:** The instrument used to make a payment. Supported methods include Cash, Card (Credit/Debit), Cheque, Bank Transfer, and Other.
- **Context:** Extensible — new methods can be added through configuration without code changes.
- **Related:** Payment

### Payment Reversal
- **Definition:** The cancellation of a previously recorded payment, restoring the invoice's outstanding balance.
- **Context:** Distinct from Refund — reversal removes the payment record; refund returns money to the patient. Both have audit trails.
- **Related:** Payment, Refund, Payment Reversal

### Payment Terms
- **Definition:** The configuration that determines an invoice's due date relative to its issue date (e.g., "Net 30" means due in 30 days).
- **Context:** Configurable per clinic. Default applied to all invoices unless overridden.
- **Related:** Due Date

### Price Override
- **Definition:** The act of changing the unit price of an invoice line item from its default value (e.g., treatment plan estimated cost).
- **Context:** Tracked with original price, overridden price, user, and timestamp for audit purposes.
- **Related:** Treatment Plan Integration, Audit Trail, Discount

### Procedure Code
- **Definition:** A standardized code identifying a specific dental procedure (e.g., ADA CDT code or custom clinic code).
- **Context:** Used on invoice line items to identify the service being billed. Critical for insurance claim generation.
- **Related:** Line Item, Insurance Support, Treatment Plan Integration

---

## R

### RPO (Recovery Point Objective)
- **Definition:** The maximum acceptable amount of data loss measured in time. For example, an RPO of 1 hour means at most 1 hour of data could be lost in a disaster.
- **Context:** Implied by the daily database backup requirement (NFR-53). A 24-hour RPO is assumed for the Billing module MVP.
- **Related:** RTO, Availability, Backup

### RTO (Recovery Time Objective)
- **Definition:** The maximum acceptable time to restore system functionality after a failure or disaster. For example, an RTO of 4 hours means the system must be operational within 4 hours of an incident.
- **Context:** Defined as 4 hours during business hours for the Billing module (NFR-52). Drives infrastructure and disaster recovery planning.
- **Related:** RPO, Availability, Unscheduled Downtime

### Receipt
- **Definition:** A formal document issued to a patient confirming that a payment has been received. Includes receipt number, date, payment details, and invoice reference.
- **Context:** Automatically generated when a payment is recorded. Has a unique sequential number. Re-printable at any time.
- **Related:** Payment, Receipt Number, Consolidated Receipt

### Receipt Number
- **Definition:** A unique, sequentially generated identifier for a receipt. Configurable prefix and separate sequence from invoice numbers.
- **Context:** Generated on demand when a user calls the receipt generation API.
- **Related:** Receipt, Sequential Numbering

### Receivables
- **Definition:** The total amount of money owed to the clinic by patients for services that have been invoiced but not yet paid.
- **Context:** Also called Accounts Receivable. Tracked through invoice outstanding balances.
- **Related:** Outstanding Balance, Receivables Aging

### Receivables Aging
- **Definition:** See Aging.

### Receptionist
- **Definition:** A business role responsible for front-desk payment collection, receipt issuance, and basic billing inquiries.
- **Context:** Can record payments, view invoices and receipts, and search financial records. Cannot create invoices or approve discounts.
- **Related:** Payment, Receipt, Billing Manager

### Refund
- **Definition:** The return of money to a patient for a previously recorded payment — due to overpayment, treatment cancellation, or billing error.
- **Context:** Phase 2 feature. Can be full or partial. Requires approval if above threshold. Generates a refund receipt.
- **Related:** Full Refund, Partial Refund, Payment Reversal

### Refund Receipt
- **Definition:** A receipt documenting that a refund has been processed. Generated when a refund is completed.
- **Context:** Phase 2 feature. Separate from payment receipt.
- **Related:** Refund, Receipt

### Reports
- **Definition:** Structured summaries of financial data for analysis and decision-making, including revenue reports, aging reports, tax summaries, and payment method summaries.
- **Context:** Phase 2 feature. Exportable to CSV, PDF, and Excel.
- **Related:** Financial Dashboard, Export

### Revenue
- **Definition:** The total amount of money collected by the clinic from patient payments within a given period.
- **Context:** A key metric displayed on the Financial Dashboard and available in Revenue Reports.
- **Related:** Financial Dashboard, Reports

---

## S

### Sequential Numbering
- **Definition:** A numbering system where document numbers (invoice, receipt, credit note) are assigned in increasing order without gaps.
- **Context:** Required for legal compliance in many jurisdictions. Each document type has its own sequence.
- **Related:** Invoice Number, Receipt Number, Credit Note

### Status Change History
- **Definition:** A chronological log of all status transitions an invoice has undergone, recording the old status, new status, user, timestamp, and reason.
- **Context:** Part of the audit trail. Provides full visibility into the invoice lifecycle.
- **Related:** Audit Trail, Invoice Status Lifecycle

### Subtotal
- **Definition:** The sum of (unit price × quantity) for all line items on an invoice, before discounts and taxes.
- **Context:** One of the computed totals on an invoice.
- **Related:** Grand Total, Total Discount, Total Tax

---

## T

### Tax Amount
- **Definition:** The monetary amount of tax calculated on a line item or invoice, computed as net amount × (tax rate / 100).
- **Context:** Phase 2 feature. Computed server-side using configured tax rates.
- **Related:** Tax Management, Tax Rate, Net Amount

### Tax Exemption
- **Definition:** A legal exclusion from tax liability for specific line items, entire invoices, or specific patients.
- **Context:** Phase 2 feature. Requires recording the exemption reason for audit purposes.
- **Related:** Tax Management, Tax Rate

### Tax Management
- **Definition:** The capability to configure tax rates, assign them to invoices, auto-calculate tax amounts, and generate tax reports.
- **Context:** Phase 2 feature. Supports multiple concurrent tax rates per line item (e.g., GST + PST).
- **Related:** Tax Rate, Tax Amount, Tax Exemption

### Tax Rate
- **Definition:** A percentage applied to the net amount of a line item to compute the tax amount.
- **Context:** Phase 2 feature. Configurable per clinic with name, percentage, and active status.
- **Related:** Tax Management, Tax Amount

### Threshold
- **Definition:** A configurable limit (percentage or fixed amount) above which a discount, refund, or void requires approval.
- **Context:** Central to the Discount Approval Workflow (Phase 2). Separate thresholds may exist for different action types.
- **Related:** Discount Approval Workflow, Approval Request

### Total Discount
- **Definition:** The sum of all discounts applied to line items and the invoice level.
- **Context:** Computed server-side as part of invoice totals.
- **Related:** Grand Total, Subtotal, Discount

### Total Tax
- **Definition:** The sum of all tax amounts across all line items on an invoice.
- **Context:** Phase 2 computed field.
- **Related:** Grand Total, Tax Amount

### Treatment Plan Integration
- **Definition:** The capability to generate invoices directly from treatment plans, converting cost estimates into invoice line items with audit tracking of price differences.
- **Context:** MVP feature. Bridges clinical planning and financial operations.
- **Related:** Treatment Plan Module, Price Override

---

## U

### Unit Price
- **Definition:** The price charged for a single unit of a service or product on an invoice line item.
- **Context:** Defaults from treatment plan estimates or procedure catalog. Can be overridden with audit tracking.
- **Related:** Line Item, Price Override

---

## V

### Void
- **Definition:** The act of invalidating an invoice that may have had payments recorded. Requires refunding any payments first.
- **Context:** Distinct from Cancellation — void applies to invoices with payment history. Voided invoices retain all data for audit.
- **Related:** Cancellation, Invoice Status Lifecycle, Refund

---

## W

### Wallet
- **Definition:** See Patient Wallet.

### Write-Off
- **Definition:** The accounting practice of removing an outstanding balance that is considered uncollectible.
- **Context:** Not explicitly supported in MVP or Phase 2. May be handled via credit notes or a future Bad Debt feature.
- **Related:** Outstanding Balance, Credit Note

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [README.md](README.md) |
| **Related** | [01-business-analysis.md](01-business-analysis.md), [06-business-rules.md](06-business-rules.md), [07-workflows.md](07-workflows.md) |
| **Next Reading** | [01-business-analysis.md](01-business-analysis.md) (start of the document path) |
