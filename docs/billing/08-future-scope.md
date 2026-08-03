# Future Scope — Billing Module

> **Document Type:** Future Scope and Expansion Roadmap
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Purpose:** Document deferred capabilities, rationale for deferral, architectural considerations, and compatibility goals for Phase 2 and Phase 3 features.

| Field | Value |
|---|---|
| Document | Future Scope |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 01-business-analysis.md, 04-feature-list.md, 02-functional-requirements.md |

---

## Table of Contents

1. [Purpose of This Document](#1-purpose-of-this-document)
2. [Deferral Philosophy](#2-deferral-philosophy)
3. [Phase 2 Deferred Capabilities](#3-phase-2-deferred-capabilities)
4. [Phase 3 Deferred Capabilities](#4-phase-3-deferred-capabilities)
5. [Architectural Considerations for Future Expansion](#5-architectural-considerations-for-future-expansion)
6. [Compatibility Goals](#6-compatibility-goals)
7. [Migration and Upgrade Path](#7-migration-and-upgrade-path)

---

## 1. Purpose of This Document

This document catalogs the capabilities deliberately excluded from the Billing Module MVP (Phase 1) and deferred to Phase 2 and Phase 3. For each deferred capability, it explains:

- **What** is deferred and what it entails
- **Why** it was deferred (business priority, complexity, external dependencies)
- **Architectural considerations** to keep in mind during MVP implementation to avoid costly rework
- **Compatibility goals** to ensure smooth integration when the capability is implemented later

This document serves as a bridge between current implementation and future expansion, ensuring that the MVP architecture does not paint the system into a corner.

---

## 2. Deferral Philosophy

The Billing module follows a phased delivery approach based on the following principles:

| Principle | Description |
|---|---|
| **Core First** | Foundational financial operations (invoicing, payments, receipts) must be stable before adding workflow automation (discount approval, refunds) or integrations (insurance, accounting). |
| **External Dependencies** | Capabilities that require new external modules (Insurance, Patient Portal, Payment Gateway) are deferred until those modules exist or are integrated. |
| **Complexity Management** | Features with high workflow complexity (multi-level discount approval, e-invoicing compliance) are deferred to allow the core data model and API to stabilize. |
| **Regulatory Variability** | Features that vary significantly by jurisdiction (tax management, e-invoicing) are deferred to Phase 2/3 to allow for proper regional configuration design. |
| **User Feedback** | Phase 1 MVP deployment will generate real-world feedback that should inform Phase 2 and Phase 3 priorities and design decisions. |

---

## 3. Phase 2 Deferred Capabilities

Phase 2 capabilities are deferred to the next delivery cycle after MVP stabilization. They represent high-value enhancements that extend the core financial operations with workflow automation, reporting, and financial management.

### 3.1 Discount Approval Workflow

| Aspect | Detail |
|---|---|
| **Capability** | Configurable discount approval thresholds with multi-level approval routing, request/approve/reject/escalate workflow |
| **Deferral Reason** | Adds significant workflow complexity. Core discount application (without approval) is sufficient for MVP. Approval workflow requires user notification infrastructure and role-based routing that is not yet built. |
| **Architectural Consideration** | The MVP should store discount metadata (amount, percentage, source) in a way that an "approved_by" and "approval_status" field can be added without schema migration complexity. Consider a generic "requires_approval" flag on discounts. |
| **Dependencies** | Notification infrastructure (for alerting approvers), escalation routing logic |

### 3.2 Tax Management

| Aspect | Detail |
|---|---|
| **Capability** | Configurable tax rates, automatic tax calculation, multi-rate support (e.g., GST + PST), tax exemption, tax reporting |
| **Deferral Reason** | Tax configuration varies significantly by jurisdiction. MVP clinics may handle tax externally or use flat-rate manual calculation. Tax automation is high-value but not blocking for go-live. |
| **Architectural Consideration** | The invoice line item model should include a "tax_rate" and "tax_amount" field (nullable, default 0) to avoid a schema change when tax management is added. The invoice total computation should support including/excluding tax amounts. |
| **Dependencies** | System configuration UI (for tax rate management) |

### 3.3 Refunds

| Aspect | Detail |
|---|---|
| **Capability** | Full and partial refund processing, refund approval, refund receipts |
| **Deferral Reason** | Refund workflows require payment reversal logic, approval routing, and refund receipt generation. Core payment recording (no reversals) is sufficient for MVP. Clinics can handle refunds manually during MVP period. |
| **Architectural Consideration** | Payment records should support a "reversed" flag and "reversal_reference" field. The invoice outstanding balance computation must account for reversed payments even before the refund UI is built. |
| **Dependencies** | Approval workflow infrastructure |

### 3.4 Credit Notes

| Aspect | Detail |
|---|---|
| **Capability** | Credit note issuance, application to invoices, expiry management, voiding |
| **Deferral Reason** | Credit notes are a correction mechanism that builds on refund and cancellation workflows. MVP clinics can correct billing errors by cancelling and re-invoicing. |
| **Architectural Consideration** | The invoice model should support linkage to credit notes (potentially a "adjusted_by_credit_note_id" field). Consider designing a "financial adjustment" abstraction early that encompasses both refunds and credit notes. |
| **Dependencies** | Refund workflow |

### 3.5 Patient Financial Summary

| Aspect | Detail |
|---|---|
| **Capability** | Per-patient holistic financial view: invoices, payments, credits, outstanding balance, treatment cost vs. billed comparison |
| **Deferral Reason** | This is a read-model / reporting feature that requires stable data from invoices, payments, and credit notes. It is dependent on those features being complete. |
| **Architectural Consideration** | Design query endpoints that aggregate data across financial entities. Avoid building the summary UI until the underlying data is comprehensive. The API should support patient-scoped listing for all financial entities. |
| **Dependencies** | Invoices, Payments, Credit Notes, Refunds |

### 3.6 Financial Dashboard

| Aspect | Detail |
|---|---|
| **Capability** | Real-time dashboard with revenue totals, receivables aging, payment distribution, tax summary, configurable date range |
| **Deferral Reason** | Dashboard is a reporting feature that requires sufficient historical data and stable aggregations. MVP focus is on transaction processing, not analysis. |
| **Architectural Consideration** | Design database queries and indexes to support aggregation queries (SUM, COUNT, GROUP BY date/status/method). Consider materialized views or a reporting database for dashboard performance. |
| **Dependencies** | Sufficient transaction volume, reporting database or materialized view strategy |

### 3.7 Reports

| Aspect | Detail |
|---|---|
| **Capability** | Revenue report, receivables aging, tax summary, payment method summary, discount summary; export to CSV/PDF/Excel |
| **Deferral Reason** | Report generation requires stable data, aggregation queries, and export formatting. MVP focus is on operational transactions. |
| **Architectural Consideration** | Implement a report generation service that can be extended with new report types. Use a data-driven approach rather than hard-coded reports. CSV support should be built first (simplest); PDF and Excel can follow. |
| **Dependencies** | Financial Dashboard, data aggregation infrastructure |

---

## 4. Phase 3 Deferred Capabilities

Phase 3 capabilities are deferred to a later major release. They represent enterprise-level integrations and specialized features that require new external modules or significant infrastructure investment.

### 4.1 Insurance Support

| Aspect | Detail |
|---|---|
| **Capability** | Insurance provider management, patient policy tracking, claim generation from invoices, claim submission (EDI/manual), claim status tracking, coordination of benefits |
| **Deferral Reason** | Insurance support requires a new Insurance module (or significant extension of the Billing module) with provider data, policy management, and claim submission. This is a major feature requiring dedicated design and development effort. Many clinics may not use insurance billing. |
| **Architectural Consideration** | Invoice line items should store procedure codes (e.g., ADA CDT codes) and diagnosis references that insurance claims require. The line item model should support an "insurance_claimable" flag and fields for claim status. |
| **Dependencies** | Insurance module (new), EDI infrastructure, procedure code taxonomy |

### 4.2 Payment Gateway Integration

| Aspect | Detail |
|---|---|
| **Capability** | Integration with payment processors (credit card, debit card), online payment links, automatic payment posting, reconciliation |
| **Deferral Reason** | Requires integration with external payment providers, PCI compliance considerations, and webhook infrastructure. MVP supports offline payment methods (cash, cheque, bank transfer). Online payments are an enhancement. |
| **Architectural Consideration** | Design a payment gateway abstraction layer (interface) that can support multiple providers. Store gateway transaction IDs on payment records. Plan for idempotency keys to prevent duplicate payment processing. |
| **Dependencies** | Payment gateway provider selection, PCI compliance assessment, webhook infrastructure |

### 4.3 Notifications

| Aspect | Detail |
|---|---|
| **Capability** | Email/SMS notifications for invoice issuance, payment reminders, overdue alerts, payment confirmation, receipt delivery |
| **Deferral Reason** | Requires a notification engine (new module or integration with existing service) and template management. MVP clinics can manually communicate with patients. |
| **Architectural Consideration** | Design the billing module to emit events (invoice_issued, payment_received, invoice_overdue) that a notification service can consume. Event payload should include all data needed for notification templates. |
| **Dependencies** | Notification module (new), email/SMS infrastructure, template management |

### 4.4 Patient Portal Integration

| Aspect | Detail |
|---|---|
| **Capability** | Patient self-service invoice viewing, online payment, receipt download, payment history |
| **Deferral Reason** | Requires a Patient Portal module (new) and secure authentication for patient access. MVP focus is on clinic-side operations. |
| **Architectural Consideration** | Design the billing API to support patient-scoped read-only endpoints that can be exposed through a portal without duplicating business logic. Implement proper access controls for patient-facing endpoints. |
| **Dependencies** | Patient Portal module (new), authentication for patients |

### 4.5 Accounting Software Integration

| Aspect | Detail |
|---|---|
| **Capability** | Export to accounting platforms (QuickBooks, Xero, Zoho Books), chart of accounts mapping, automated journal entry generation |
| **Deferral Reason** | Accounting integration requires mapping DensCare financial entities to accounting software constructs. This is deployment-specific and not universally required. MVP clinics can manually enter data into their accounting systems. |
| **Architectural Consideration** | Design a generic export service that produces accounting-friendly data (journal entries with accounts, amounts, dates). Use a provider-agnostic export format with adapters for specific platforms. |
| **Dependencies** | Accounting platform API access, chart of accounts mapping configuration |

### 4.6 Multi-branch Support

| Aspect | Detail |
|---|---|
| **Capability** | Branch-level invoice numbering, tax configuration, reporting; consolidated cross-branch reporting; branch-scoped permissions |
| **Deferral Reason** | Multi-branch is a deployment-specific requirement. Many clinics operate from a single location. Adding branch scope to all billing entities adds significant complexity to the MVP. |
| **Architectural Consideration** | All billing entities should include an optional "branch_id" field (nullable, default null for single-branch deployments). Branch-level filtering should be designed as a query layer that can be enabled when multi-branch is activated. |
| **Dependencies** | Multi-branch module (new or extended from existing), branch management data |

### 4.7 Multi-currency Support

| Aspect | Detail |
|---|---|
| **Capability** | Foreign currency invoicing, exchange rate management, dual-amount display, currency-wise reporting |
| **Deferral Reason** | Multi-currency is a deployment-specific requirement for clinics operating in multiple currency zones. MVP assumes single-currency operation in the clinic's local currency. |
| **Architectural Consideration** | Store currency code on every invoice (defaulting to clinic default). Store amounts in both invoice currency and base currency. Exchange rate should be frozen at invoice creation. |
| **Dependencies** | Exchange rate service (manual or automated), currency configuration |

### 4.8 E-Invoicing

| Aspect | Detail |
|---|---|
| **Capability** | Compliance with regional e-invoicing standards (e.g., EU VAT Directive, India GST e-invoicing, Saudi Arabia ZATCA), digital signature, government portal submission |
| **Deferral Reason** | E-invoicing requirements vary significantly by jurisdiction. It requires understanding of specific regulatory standards, digital signature infrastructure, and government portal APIs. This is a specialized compliance feature. |
| **Architectural Consideration** | The invoice data model must be rich enough to support e-invoicing fields (buyer/seller tax IDs, digital signatures, QR codes). Consider a plugin architecture for jurisdiction-specific e-invoicing formats. |
| **Dependencies** | Regulatory compliance analysis per deployment region, digital signature infrastructure |

### 4.9 Advance Payments / Patient Wallet

| Aspect | Detail |
|---|---|
| **Capability** | Pre-payment and deposit collection, patient wallet balance management, wallet consumption against invoices, wallet top-up and refund |
| **Deferral Reason** | Patient wallet introduces a pre-payment / stored-value concept that significantly extends the payment model. MVP supports payment at time of service or after invoicing. Pre-payment is an enhancement for specific workflows. |
| **Architectural Consideration** | Design the payment model to distinguish between "payment against invoice" and "pre-payment (wallet top-up)." The wallet should be a separate balance entity linked to the patient, consumed at invoice payment time. |
| **Dependencies** | Payment module stability, wallet balance management, wallet-to-invoice allocation logic |

---

## 5. Architectural Considerations for Future Expansion

The following architectural principles should guide MVP implementation to ensure smooth future expansion:

### 5.1 Data Model Extensibility

| Principle | Application |
|---|---|
| **Nullable fields for future use** | Include nullable fields (e.g., tax_rate, tax_amount, branch_id, currency_code) in the MVP schema with sensible defaults. Avoid schema migrations for Phase 2 fields. |
| **Polymorphic references** | Where a reference could point to multiple entity types (e.g., a discount could be on an invoice, line item, or treatment plan), design for polymorphic relationships early. |
| **Status machine extensibility** | The invoice status machine should be extensible — allow adding new statuses (e.g., "Disputed," "In Collections") without rewriting transition validation. |

### 5.2 Service Layer Abstraction

| Principle | Application |
|---|---|
| **Interface-based design** | Define service interfaces (e.g., IPaymentGateway, ITaxCalculator, INotificationService) that can have multiple implementations. MVP implementations can be no-op or simple, with full implementations plugged in later. |
| **Event-driven architecture** | Emit domain events (InvoiceIssued, PaymentRecorded, InvoiceOverdue) that future modules (Notifications, Accounting Export) can subscribe to. Event schema should be forward-compatible. |
| **Strategy pattern for calculations** | Tax calculation, discount calculation, and currency conversion should use strategy/plugin patterns that allow new strategies without modifying core logic. |

### 5.3 Configuration-Driven Approach

| Principle | Application |
|---|---|
| **Externalize configuration** | Invoice numbering, discount thresholds, payment terms, tax rates, and currency defaults should all be externally configurable (admin UI or config file), not hard-coded. |
| **Feature flags** | Phase 2 and Phase 3 features should be feature-flagged so they can be developed and tested in production without being activated. |

### 5.4 Integration Points

| Principle | Application |
|---|---|
| **Define integration contracts early** | Define the interfaces between Billing and other modules (Treatment Plans, Insurance, Accounting) even if the consuming module does not exist yet. This prevents coupling. |
| **Webhook-ready** | The billing module should support outbound webhooks for key events so that future integrations (accounting software, notification services) can receive real-time data. |

---

## 6. Compatibility Goals

| Goal | Description |
|---|---|
| **Backward Compatibility** | Phase 2 and Phase 3 features must not require changes to Phase 1 transaction data. Existing invoices, payments, and receipts must remain valid and queryable after upgrades. |
| **Data Migration** | No data migration should be required when enabling Phase 2 features. New fields must have default values for existing records. |
| **API Versioning** | The billing API should be versioned from the start (v1). Future versions should add new endpoints or fields without breaking existing clients. |
| **No Breaking Schema Changes** | Phase 2 database changes must be additive (new columns, new tables) — not modifications or deletions of existing columns. |
| **Feature Toggle Safety** | Enabling a Phase 2 feature must never impact the performance or correctness of Phase 1 operations. Disabled features must have zero overhead. |

---

## 7. Migration and Upgrade Path

When transitioning from Phase 1 to Phase 2:

1. **Deploy schema migrations** — Add new tables and columns for Phase 2 entities (credit notes, refunds, tax rates, discount approvals).
2. **Enable feature flags** — Phase 2 features are initially disabled behind feature flags for testing.
3. **Backfill data** — For new fields on existing entities, apply default values (e.g., tax_amount = 0 for existing line items).
4. **Test in staging** — Verify that Phase 1 operations still work correctly with Phase 2 schema changes.
5. **Roll out to production** — Enable Phase 2 features gradually, monitoring for issues.
6. **Train users** — Provide training on new workflows (discount approval, refund processing) before enabling.

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md), [04-feature-list.md](04-feature-list.md) |
| **Related** | [02-functional-requirements.md](02-functional-requirements.md), [03-non-functional-requirements.md](03-non-functional-requirements.md) |
| **Next Reading** | [glossary.md](glossary.md) |
