# Business Analysis — Billing Module

> **Document Type:** Business Requirements Document
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **MVP Scope:** This document covers the complete Billing module scope. Phase-specific features are identified with [MVP], [PHASE 2], and [PHASE 3] labels.

| Field | Value |
|---|---|
| Document | Business Requirements Document |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 02-functional-requirements.md, 04-feature-list.md, 06-business-rules.md |
| Cross-references | Treatment Plan Module, Patient Management Module, User Management Module |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Purpose](#2-purpose)
3. [Business Context](#3-business-context)
4. [Business Objectives](#4-business-objectives)
5. [Scope](#5-scope)
6. [Out-of-Scope Items](#6-out-of-scope-items)
7. [Stakeholders](#7-stakeholders)
8. [Business Problems Solved](#8-business-problems-solved)
9. [Success Criteria](#9-success-criteria)
10. [Assumptions](#10-assumptions)
11. [Constraints](#11-constraints)
12. [Dependencies](#12-dependencies)
13. [Risks](#13-risks)

---

## 1. Executive Summary

The Billing Module introduces comprehensive financial transaction management to DensCare, replacing the current gap between clinical treatment planning and revenue collection. Currently, treatment plans produce itemized cost estimates, but no mechanism exists to convert those estimates into legally compliant invoices, track payments, issue receipts, manage refunds, or provide patients with financial summaries. This results in manual billing processes, revenue leakage, reconciliation difficulties, and audit exposure.

The module delivers an end-to-end billing lifecycle: invoice generation (directly from treatment plans or ad hoc), multi-payment collection and reconciliation, receipt issuance, refund and credit note management, discount approval workflows, and configurable tax handling. It integrates with existing clinical modules (Treatment Plans, Appointments, Patient Records) and establishes the financial data foundation for future Insurance, Accounting, and Patient Portal integrations.

---

## 2. Purpose

This Business Requirements Document (BRD) defines the business objectives, scope, stakeholders, problems, and success criteria for the Billing module. It serves as the authoritative reference for architects, engineers, QA, product owners, and clinic administrators throughout design, implementation, and acceptance testing. It precedes and informs all subsequent technical design documents.

---

## 3. Business Context

DensCare is a dental clinic management platform with the following completed modules:

- **Authentication & Authorization** — Login, token-based authentication, password management
- **RBAC** — Role-based access control with seven roles
- **User Management** — User lifecycle (pending → active → inactive), role assignment
- **Patient Management** — Patient registration, search, profile management
- **Doctor Management** — Doctor profiles, specializations, schedules
- **Appointment Management** — Scheduling, conflict detection, status lifecycle
- **Patient Records** — Clinical documentation, diagnoses, prescriptions, attachments
- **Treatment Plans** — Structured treatment planning with itemized procedures, cost estimation, versioning, and approval workflow

### Existing Financial Gaps

The current system handles clinical and operational workflows comprehensively but has no financial layer. Key gaps include:

| # | Gap | Impact |
|---|---|---|
| G-1 | No invoice generation | Treatment plan costs are estimates only; no legal billing document exists |
| G-2 | No payment tracking | Payments are recorded outside the system (cash log, spreadsheet, or memory) |
| G-3 | No receipting | Patients receive no formal payment acknowledgment from the system |
| G-4 | No refund mechanism | Overpayments or treatment cancellations have no structured refund process |
| G-5 | No discount governance | Price reductions are applied verbally without approval or audit trail |
| G-6 | No tax calculation | Tax amounts (e.g., VAT/GST/HST) are computed manually, risking errors |
| G-7 | No financial reporting | Clinic financial performance cannot be measured or trended within DensCare |
| G-8 | No insurance linkage | No mechanism to submit claims or track insurance receivable amounts |

---

## 4. Business Objectives

| # | Objective | Priority | Phase | Success Metric |
|---|---|---|---|---|
| O-1 | Enable generation of legally compliant invoices with unique sequential numbering | Critical | MVP | 100% of billable treatments generate invoices within 2 weeks of go-live |
| O-2 | Enable invoice line items derived from treatment plan cost estimates | Critical | MVP | ≥90% of invoices reference a treatment plan |
| O-3 | Enable recording and reconciliation of patient payments | Critical | MVP | Every issued invoice has a corresponding payment status |
| O-4 | Enable issuance of payment receipts | Critical | MVP | Receipts generated for 100% of completed payments |
| O-5 | Provide search and filtering across all financial records | High | MVP | Invoice/payment found in <3 seconds by patient name or invoice number |
| O-6 | Maintain immutable audit trail for all financial transactions | Critical | MVP | 100% of financial mutations traced to user + timestamp |
| O-7 | Enforce role-based permissions on financial operations | Critical | MVP | Unauthorized financial actions rejected at API level |
| O-8 | Support discount approval workflows for values exceeding thresholds | High | Phase 2 | 100% of over-threshold discounts follow approval path |
| O-9 | Enable tax calculation with configurable rates | High | Phase 2 | Tax amounts computed correctly for all configured rates |
| O-10 | Support refunds and credit notes for financial corrections | High | Phase 2 | Refund/credit processed with full audit trail |
| O-11 | Provide patient financial summary view | Medium | Phase 2 | Patients can view outstanding balance, payment history |
| O-12 | Deliver financial dashboards and reports | Medium | Phase 2 | KPI dashboard loads in <2 seconds |
| O-13 | Enable insurance claim submission and tracking | Medium | Phase 3 | Direct claim submission from invoice |
| O-14 | Integrate with payment gateways for online payments | Medium | Phase 3 | Online payments posted automatically |
| O-15 | Support multi-branch and multi-currency operations | Low | Phase 3 | Clinics with multiple branches use consolidated billing |

---

## 5. Scope

### 5.1 In Scope (MVP — Phase 1)

1. **Invoice Management [MVP]**
   - Invoice creation (from treatment plan or ad hoc)
   - Configurable invoice numbering (prefix, sequence length, starting number)
   - Invoice status lifecycle (Draft → Issued → Paid → Partially Paid → Overdue → Cancelled → Void)
   - Invoice line items with procedure references, quantities, unit prices, discounts, and totals
   - Invoice-level and line-item-level discounts
   - Subtotal, tax, discount, and total computation
   - Invoice cancellation and voiding with reason tracking

2. **Treatment Plan Integration [MVP]**
   - One-click invoice generation from an accepted treatment plan
   - Copy of treatment plan line items as invoice line items
   - Optional merging of multiple treatment plans into a single invoice
   - Price override capability with audit (difference tracking)

3. **Payment Management [MVP]**
   - Payment recording (cash, card, cheque, bank transfer, other)
   - Multiple partial payments per invoice
   - Payment status tracking per invoice
   - Payment attribution to invoice(s)
   - Payment reversal with reason

4. **Receipts [MVP]**
   - Automatic receipt generation upon payment completion
   - Configurable receipt numbering
   - Receipt reference to invoice(s)
   - Multiple payment methods per receipt (split payments)

5. **Search & Filtering [MVP]**
   - Search by invoice number, patient name, payment reference, date range
   - Filter by status, payment method, date range
   - Sort by date, amount, status, patient name
   - Paginated results

6. **Audit Trail [MVP]**
   - Created by, updated by, created at, updated at on all entities
   - Status change history with timestamps and user attribution
   - Immutable financial records (no hard deletes)

7. **Role-based Permissions [MVP]**
   - Granular permissions for invoice creation, payment recording, discount application, voiding
   - Role-appropriate visibility (e.g., accountants see all, receptionists see payment-only)

### 5.2 In Scope (Phase 2)

1. **Discount Approval Workflow [PHASE 2]**
   - Configurable discount approval thresholds
   - Multi-level approval (manager → director, depending on discount percentage)
   - Approval request, approval, rejection, and escalation
   - Audit trail for approval decisions

2. **Tax Management [PHASE 2]**
   - Configurable tax rates (e.g., VAT 5%, 12%, 18%, 28% or GST/PST/HST)
   - Tax applicability per invoice line item
   - Automatic tax calculation on invoice totals
   - Tax-exempt flag with reason
   - Tax reporting data (tax collected per rate, per period)

3. **Refunds [PHASE 2]**
   - Full and partial refunds
   - Refund against original payment method (where trackable)
   - Refund approval workflow
   - Refund receipt generation
   - Refund reason and authorization tracking

4. **Credit Notes [PHASE 2]**
   - Credit note issuance against invoices
   - Credit note for invoice corrections (price adjustment, cancellation)
   - Credit note application to outstanding invoices
   - Credit note expiry and voiding
   - Linked to original invoice and refund (if applicable)

5. **Patient Financial Summary [PHASE 2]**
   - Per-patient view of all invoices, payments, credits, and outstanding balance
   - Treatment plan cost vs. actual billed comparison
   - Payment history timeline
   - Outstanding balance alerts

6. **Financial Dashboard [PHASE 2]**
   - Daily/Weekly/Monthly revenue totals
   - Outstanding receivables aging
   - Payment method distribution
   - Invoice status distribution
   - Tax collected summary
   - Configurable date range

7. **Reports [PHASE 2]**
   - Revenue report (daily, weekly, monthly, custom range)
   - Receivables aging report (30/60/90+ days)
   - Tax summary report (per rate, per period)
   - Payment method summary
   - Discount summary
   - Export to CSV/Excel/PDF

### 5.3 In Scope (Phase 3)

1. **Insurance Support [PHASE 3]**
   - Insurance provider management
   - Patient policy and coverage tracking
   - Insurance claim generation from invoices
   - Claim submission (EDI or manual)
   - Claim status tracking
   - Insurance receivable tracking
   - Coordination of benefits (primary + secondary insurance)

2. **Payment Gateway Integration [PHASE 3]**
   - Integration with payment processors (credit card, debit card)
   - Online payment links sent to patients
   - Automatic payment posting from gateway webhooks
   - Payment gateway reconciliation

3. **Notifications [PHASE 3]**
   - Invoice generation notification (email/SMS to patient)
   - Payment due reminder
   - Payment confirmation
   - Overdue invoice escalation
   - Receipt delivery

4. **Patient Portal Integration [PHASE 3]**
   - Patient self-service invoice viewing
   - Online payment via portal
   - Payment history access
   - Download receipts and invoices

5. **Accounting Software Integration [PHASE 3]**
   - Export to accounting platforms (e.g., QuickBooks, Xero, Zoho Books)
   - Chart of accounts mapping
   - Automated journal entry generation
   - Reconciliation support

6. **Multi-branch Support [PHASE 3]**
   - Branch-level invoice numbering
   - Branch-level tax configuration
   - Consolidated or branch-separate reporting
   - Cross-branch patient billing

7. **Multi-currency Support [PHASE 3]**
   - Foreign currency invoicing
   - Exchange rate management
   - Multi-currency payment handling
   - Currency-wise reporting

8. **E-Invoicing [PHASE 3]**
   - Compliance with regional e-invoicing standards
   - Digital signature and authentication
   - Government portal submission (where required)

9. **Advance Payments / Patient Wallet [PHASE 3]**
   - Pre-payment and deposit collection
   - Patient wallet balance management
   - Wallet balance consumption against invoices
   - Wallet top-up and refund

---

## 6. Out-of-Scope Items

The following capabilities are explicitly out of scope for the entire Billing module:

| Item | Rationale |
|---|---|
| Payroll processing | Managed by external HR/payroll systems |
| Doctor commission calculation | Deferred to a future Commission/Incentive module |
| General ledger management | Handled by external accounting software |
| Budgeting and forecasting | Requires a separate Financial Planning module |
| Patient financing / EMI plans | Requires a Patient Financing module |
| Late fee / penalty automation | Deferred; can be computed manually via discounts |
| Automated dunning (collections) | Deferred; notifications will trigger reminders only |
| Revenue recognition | Accounting concept; managed by external systems |
| Audit log for non-financial operations | Provided by existing DensCare audit patterns |
| Physical cheque printing | System generates cheque payment records; printing is external |

---

## 7. Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| **Clinic Administrator** | System owner | Complete financial data visibility, audit compliance, cash flow management, regulatory adherence |
| **Chief Doctor / Practice Owner** | Business owner | Revenue tracking, treatment-to-billing conversion rate, financial performance |
| **Accountant / Billing Manager** | Financial operator | Invoice creation, payment reconciliation, discount approval, refund processing, reporting |
| **General Dentist** | Clinical end user | View invoices for their treatments; understand treatment cost vs. billed amount |
| **Receptionist** | Front-desk operator | Collect payments, issue receipts, handle basic billing inquiries |
| **Dental Assistant** | Support | Limited invoice visibility for treatment context |
| **Patient** | Recipient | Receive invoices and receipts; view outstanding balance and payment history |
| **Insurance Desk Staff** | Specialist [Phase 3] | Insurance claim submission and tracking |
| **IT Team** | Implementation | Integration, performance, deployment, maintenance |
| **QA Team** | Validation | Acceptance criteria verification, financial accuracy testing |
| **External Auditor** | Compliance [indirect] | Audit trail completeness, financial record integrity |

---

## 8. Business Problems Solved

| # | Problem | Impact | Solution |
|---|---|---|---|
| P1 | No structured invoice generation | Treatments are billed manually; errors and omissions common | System generates invoices from treatment plans with itemized procedures, prices, and taxes |
| P2 | No payment tracking | Revenue leakage; cannot track who paid, how much, and when | Centralized payment recording with full reconciliation |
| P3 | No receipt issuance | Patients have no formal proof of payment | Automatic receipt generation on payment completion |
| P4 | No discount governance | Unauthorized discounts erode revenue; no audit trail | Discount approval workflow with configurable thresholds |
| P5 | Manual tax calculation | Tax errors cause compliance risk and financial penalties | Configurable tax rates with automatic computation |
| P6 | No refund process | Overpayments and cancellations create financial confusion | Structured refund and credit note workflow |
| P7 | No financial visibility | Clinic cannot measure daily revenue, outstanding receivables, or payment trends | Financial dashboard and configurable reports |
| P8 | No treatment-to-billing linkage | Cannot track which treatments have been billed vs. unbilled | Direct treatment plan integration with billing status tracking |
| P9 | Manual reconciliation | Payment-to-invoice matching is error-prone and time-consuming | Invoice-level payment tracking with partial payment support |

---

## 9. Success Criteria

| # | Criterion | Target | Measurement Method |
|---|---|---|---|
| SC-1 | Invoice adoption rate | ≥95% of completed treatment plans generate an invoice | DB comparison: completed plans vs. invoices referencing a plan |
| SC-2 | Payment capture rate | ≥98% of issued invoices have recorded payments | DB query: invoices with payment status |
| SC-3 | Receipt issuance | 100% of completed payments generate a receipt | DB query: payments with linked receipts |
| SC-4 | Search performance | Any financial record found in <3 seconds | Performance test with 50,000 records |
| SC-5 | Audit completeness | 100% of financial mutations have user + timestamp | DB audit field verification |
| SC-6 | Discount compliance | 100% of over-threshold discounts have approval records | Approval log verification |
| SC-7 | Tax accuracy | Computed tax matches manual calculation for all configured rates | Automated test suite |
| SC-8 | Invoice numbering integrity | Sequential, gapless invoice numbers | Numbering sequence audit |
| SC-9 | User satisfaction | Billing staff report ≥4/5 satisfaction rating | User survey at 1 month post-deployment |

---

## 10. Assumptions and Traceability

Each assumption is documented with its associated business risk, mitigation strategy, and potential business impact if the assumption proves incorrect.

| # | Assumption | Business Risk | Mitigation | Impact if Incorrect |
|---|---|---|---|---|
| 1 | **Patient identity is established** — All patients invoiced through the system already exist in the Patient Management module. | Invoices cannot be created for new or walk-in patients without prior Patient Management registration. | Ensure Patient Management module provides quick registration flow. Consider walk-in patient creation as enhancement. | Moderate — billing workflow interrupted; requires manual workaround to register patient first. |
| 2 | **Treatment plans exist for clinical invoices** — For treatment-linked invoices, an accepted treatment plan exists in the Treatment Plans module. | Treatment-related invoicing is blocked if no plan exists. Ad hoc invoices remain available. | Support ad hoc invoice creation for non-treatment charges. Mandate treatment plan creation as part of clinical workflow. | High — clinical billing cannot proceed without completing treatment planning step first. |
| 3 | **Users are authenticated** — The Auth module handles all authentication; the Billing module does not duplicate login or session management. | Auth module downtime blocks all billing operations. | Implement graceful degradation with cached session validation where feasible. Document Auth dependency for operations monitoring. | Critical — all billing operations become inaccessible during Auth downtime. |
| 4 | **Authorization is role-based** — The RBAC module provides permission enforcement; the Billing module defines required permissions but does not implement access control from scratch. | RBAC misconfiguration could grant unauthorized financial access. | Implement permission self-check endpoints. Provide admin audit for role assignments. | Critical — improper permissions could allow unauthorized financial operations or block legitimate ones. |
| 5 | **Tax rates are jurisdiction-specific** — The system supports configurable tax rates; clinics are responsible for configuring correct rates. | Incorrect tax configuration leads to non-compliance. | Mandate tax review workflow before first invoice generation. Provide tax rate validation on save. | High — financial penalties for incorrect tax calculation; manual correction of issued invoices required. |
| 6 | **Invoice numbers are for display and legal compliance** — The system generates sequential, configurable invoice numbers; regulatory numbering rules are the clinic's responsibility. | Clinic may configure numbering in a way that violates local regulations. | Provide configuration guardrails (warning on unusual settings). Document regulatory requirements in user guide. | Moderate — incorrectly configured numbering may require sequence reset (requires DB intervention). |
| 7 | **Payment gateway integration is optional** — Phase 3 gateway may not be available in all regions; offline methods always remain supported. | Clinics in regions without gateway support cannot offer online payments. | Core payment methods (cash, card, cheque, bank transfer) are always available and not dependent on gateway. | Low — all core payment methods remain available without gateway. |
| 8 | **Multi-currency capability is region-specific** — Multi-currency support targets clinics in multiple currency zones; not all deployments require this. | Development effort for multi-currency may not be justified for single-currency clinics. | Implement as Phase 3 feature gated by configuration. Single-currency clinics see no multi-currency UI. | Low — feature is optional and gated; no impact on single-currency deployments. |
| 9 | **Accounting software integration follows export patterns** — The module exports data in standard formats; vendor-specific API integration is evaluated per deployment. | Export format may not match all accounting software requirements. | Support multiple export formats (CSV, JSON, XLSX). Provide field mapping configuration for common platforms. | Moderate — manual data transformation may be needed for unsupported accounting platforms. |
| 10 | **Hardware (receipt printers, card terminals) is managed externally** — The system generates digital receipts; physical printing requires separate procurement. | Clinic cannot print receipts without compatible hardware. | Provide print-formatted receipt view compatible with standard receipt printers. Document hardware requirements. | Low — digital receipts and on-screen display provide fallback. |

---

## 11. Constraints

| # | Constraint | Description | Related Business Rules |
|---|---|---|---|
| C-1 | Financial records are immutable | Once an invoice reaches Issued status, its line items and totals cannot be modified. Corrections require Credit Notes or invoice cancellation with re-issuance. | [BR-4](06-business-rules.md#1-core-financial-rules), [BR-8](06-business-rules.md#1-core-financial-rules), [BR-12](06-business-rules.md#2-invoice-lifecycle-rules) |
| C-2 | Invoice numbers are sequential and non-reusable | Cancelled/voided invoice numbers are retired, never reused. The sequence advances. | [BR-3](06-business-rules.md#1-core-financial-rules), [BR-100](06-business-rules.md#10-numbering-rules), [BR-104](06-business-rules.md#10-numbering-rules) |
| C-3 | One active invoice per treatment plan | A treatment plan may have at most one active (non-cancelled, non-voided) invoice at any time. | [BR-121](06-business-rules.md#12-treatment-plan-integration-rules) |
| C-4 | Discounts have maximum thresholds | Total discount on an invoice cannot exceed the configured maximum discount percentage (configurable per clinic). Over-threshold discounts require approval. | [BR-44](06-business-rules.md#4-pricing-and-discount-rules), [BR-45](06-business-rules.md#4-pricing-and-discount-rules) |
| C-5 | Refunds cannot exceed paid amount | A refund amount cannot exceed the total amount paid against an invoice. | [BR-81](06-business-rules.md#8-refund-rules) |
| C-6 | Credit note expiry | Credit notes have a configurable validity period after which they cannot be applied. | [BR-95](06-business-rules.md#9-credit-note-rules), [BR-96](06-business-rules.md#9-credit-note-rules) |
| C-7 | Currency consistency | All line items on a single invoice must use the same currency. | [BR-140](06-business-rules.md#14-multi-currency-rules-phase-3) |
| C-8 | Tax rate freeze | The tax rate applied at invoice creation is frozen for that invoice. Changes to tax rates do not retroactively affect existing invoices. | [BR-52](06-business-rules.md#5-tax-rules) |
| C-9 | Audit data retention | Financial audit records are retained for the legally mandated period (configurable, minimum 7 years by default). | [BR-115](06-business-rules.md#11-audit-and-immutability-rules) |

---

## 12. Dependencies

| Dependency | Module | Nature | Criticality |
|---|---|---|---|
| Patient records | Patients | Hard — every invoice references a patient | Critical |
| Treatment plans | Treatment Plans | Hard — invoices generated from plans | Critical (for plan-linked invoices) |
| User records | Users | Hard — audit trail references users | Critical |
| Authentication | Auth | Hard — all endpoints require authentication | Critical |
| Authorization | RBAC | Hard — role-based permission enforcement | Critical |
| Appointment records | Appointments | Soft — optional invoice reference | Low |
| Doctor records | Doctors | Soft — optional treating doctor reference | Low |
| Patient Records (Diagnoses) | Patient Records | Soft — optional line item diagnosis reference | Low |
| Database | Database | Hard — all data persistence | Critical |
| Schema changes | Migrations | Hard — versioned schema management | Critical |

---

## 13. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Invoice amounts may differ from treatment plan estimates | High | Medium | Clear UI differentiation between "estimated" (treatment plan) and "billed" (invoice). Price override is tracked and audited. |
| R2 | Payment reconciliation errors due to partial payments | Medium | High | System tracks per-payment attribution to invoices. Remaining balance is computed in real time. |
| R3 | Discount governance bypass (unauthorized discounts) | Medium | High | Discount approval workflow enforced at the service layer. Exceeding threshold without approval is rejected. |
| R4 | Tax rate configuration errors by clinic staff | Medium | Medium | Tax rate validation on save; mandatory tax review before first invoice generation. |
| R5 | Invoice number sequence gaps due to failed transactions | Low | Medium | Numbering uses a dedicated sequence generator that commits before invoice creation. Failed invoices leave reserved numbers tracked. |
| R6 | Data migration from existing billing systems | High | High | Import tools in Phase 2; manual data entry period post-deployment. |
| R7 | Multi-currency exchange rate volatility | Low | Low | Rates are frozen at invoice creation time. Real-time rate integration deferred to Phase 3. |
| R8 | Payment gateway downtime | Medium | High | Offline payment methods always available. Gateway failures logged for manual reconciliation. |

---

## 14. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [README.md](README.md), [glossary.md](glossary.md) |
| **Related** | [02-functional-requirements.md](02-functional-requirements.md), [04-feature-list.md](04-feature-list.md), [06-business-rules.md](06-business-rules.md) |
| **Next Reading** | [02-functional-requirements.md](02-functional-requirements.md) → [03-non-functional-requirements.md](03-non-functional-requirements.md) → [07-workflows.md](07-workflows.md) |
