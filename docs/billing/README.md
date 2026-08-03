# Billing Module — DensCare

> **Module Version:** 1.0 (Draft)
> **Status:** Design Documentation in Progress
> **Last Updated:** 2026-07-20

---

## 1. Module Overview

The Billing Module introduces comprehensive financial transaction management to the DensCare Dental Clinic Management System. It enables clinics to generate invoices, collect payments, issue receipts, manage refunds and credit notes, and maintain a complete auditable financial trail for all patient transactions. The module directly integrates with Treatment Plans to convert approved cost estimates into billable invoices, bridging clinical workflows with financial operations.

As the financial backbone of DensCare, the Billing module handles all revenue-cycle operations from invoice creation through payment reconciliation, ensuring regulatory compliance, financial accuracy, and operational efficiency across single-practitioner and multi-doctor clinic environments.

---

## 2. Module Purpose

| Aspect | Description |
|---|---|
| **Primary Function** | Manage the complete billing lifecycle — invoice generation, payment collection, receipting, refunds, credit notes, and financial reconciliation |
| **Business Value** | Eliminates manual billing errors; provides itemized invoices linked to treatment plans; ensures payment tracking; enables financial transparency for patients |
| **Operational Value** | Automated invoice numbering, multi-payment tracking, discount approval workflows, and searchable financial records |
| **Regulatory Value** | Immutable audit trail for all financial transactions; compliant invoice numbering; payment attribution traceability |
| **Integration Value** | Consumes treatment plan cost estimates from Treatment Plans; provides payment data for future Insurance, Accounting, and Patient Portal modules |

---

## 3. Phase Roadmap

The Billing module is delivered across three implementation phases:

| Phase | Focus | Features | Target |
|---|---|---|---|
| **Phase 1 (MVP)** | Core financial operations | Invoice management, invoice items, treatment plan integration, payment management, receipts, search & filtering, audit trail, role-based permissions | Operational go-live |
| **Phase 2** | Financial workflows & reporting | Discount approval workflow, tax management, refunds, credit notes, patient financial summary, financial dashboard, reports | Enhanced capabilities |
| **Phase 3** | Advanced integrations | Insurance support, payment gateway integration, notifications, patient portal integration, accounting software integration, multi-branch support, multi-currency support, e-invoicing, advance payments / patient wallet | Enterprise readiness |

> **Note:** Phase 1 capabilities are mandatory for go-live. Phase 2 and Phase 3 features are documented as future-scope expansions. See [08-future-scope.md](08-future-scope.md) for detailed deferral rationale.

---

## 4. Documentation Structure

```
docs/billing/
├── 00-module-overview.md              — Architectural entry point (start here)
├── README.md                          — Quick-start module overview
├── 01-business-analysis.md            — Business objectives, stakeholders, scope, success criteria
├── 02-functional-requirements.md      — Functional capabilities grouped by feature area
├── 03-non-functional-requirements.md  — Performance, security, availability, audit, compliance
├── 04-feature-list.md                 — Complete feature inventory by implementation phase
├── 05-user-roles-and-permissions.md   — Business role definitions, personas, and action-type mappings
├── 06-business-rules.md               — Financial rules, validation, lifecycle, audit policies
├── 07-workflows.md                    — Major business workflows with state transitions and edge cases
├── 08-future-scope.md                 — Deferred capabilities with rationale and architecture notes
├── 09-financial-invariants.md         — Immutable financial truths the system must always maintain
├── 10-module-interaction-matrix.md    — Billing interaction model with all DensCare modules
├── 11-business-events.md              — Domain events with triggers, actors, and business outcomes
├── 12-search-and-reporting-specification.md — Searchable fields, filters, reports, and dashboard metrics
├── 13-audit-requirements.md           — Audit events, retention, compliance, and visibility
├── 14-definition-of-done.md           — Completion criteria across documentation, architecture, implementation, testing
├── adr/                               — Architecture Decision Records (5 ADRs)
└── glossary.md                        — Standardized business and financial terminology
```

---

## 5. Documentation Conventions

| Convention | Standard |
|---|---|
| **Terminology** | All capitalized business terms (e.g., Invoice, Payment, Credit Note) are defined in the [glossary](glossary.md). |
| **Requirement IDs** | Requirements follow the convention `{Prefix}.{Number}` (e.g., FR-1.1, BR-1, NFR-1), consistent with the DensCare treatment module documentation. The prefix identifies the module context (BILL for Billing). |
| **Cross-references** | References to other Billing documents use relative Markdown links. References to other DensCare modules use the format `[Module Name]`. |
| **Status Labels** | `[MVP]` = Phase 1 mandatory feature; `[PHASE 2]` = Phase 2 feature; `[PHASE 3]` = Phase 3 feature. |
| **Requirement Priority** | Critical = System cannot function without it; High = Important but workaround exists; Medium = Enhancement; Low = Nice-to-have. |
| **Change Management** | All document changes must be reviewed by the Engineering Lead and Product Owner before acceptance. |

---

## 6. Documentation Lifecycle & Versioning

The Billing documentation follows a structured lifecycle from creation to production-readiness:

### 6.1 Lifecycle Stages

| Stage | Description | Gate |
|---|---|---|
| **Draft** | Document is being written. Content may be incomplete or subject to major change. | Author's first commit |
| **Under Review** | Document is complete and submitted for peer, architecture, and product review. Feedback is incorporated during this stage. | Author declares content complete |
| **Approved** | Document has passed all reviews and is accepted as the authoritative specification. Changes require a formal revision cycle. | Engineering Lead + Product Owner sign-off |
| **Deprecated** | Document has been superseded or is no longer applicable. Retained for historical reference only. | Replacement document reaches Approved status |

### 6.2 Version Numbering

Document versions follow `MAJOR.MINOR` semantics:

- **MAJOR** — Incremented on significant structural changes, scope additions, or breaking revisions to documented constraints.
- **MINOR** — Incremented on clarifications, typo fixes, formatting improvements, or small additions that do not alter the documented scope.

All documents start at version `0.1` (initial Draft). The first Approved version is `1.0`.

### 6.3 Review Workflow

1. **Author:** Draft the document following the conventions above. Assign version `0.1` (Draft).
2. **Peer Review:** At least one backend engineer reviews for technical consistency and cross-reference accuracy.
3. **Architecture Review:** Engineering Lead reviews for architectural alignment and consistency with ADRs.
4. **Product Review:** Product Owner reviews for business completeness and alignment with BRD.
5. **Quality Review:** QA Engineer reviews for testability and completeness of acceptance criteria.
6. **Approval:** Final sign-off by Engineering Lead and Product Owner. Version promoted to `1.0` (Approved).
7. **Post-Approval Changes:** Any change requires a new version bump and re-review through steps 2–6.

---

## 7. Integration Points

The Billing module integrates with the following existing DensCare modules:

| Module | Integration Type | Description |
|---|---|---|
| Authentication & Authorization | Hard dependency | All billing endpoints require authentication |
| RBAC | Hard dependency | Role-based permission enforcement on all financial operations |
| User Management | Hard dependency | Audit trail references users; payment attribution to collecting staff |
| Patient Management | Hard dependency | Every invoice references a patient; payment patient attribution |
| Doctor Management | Soft dependency | Invoices may reference treating doctors |
| Appointment Management | Soft dependency | Invoices may reference appointments for context |
| Treatment Plans | Hard dependency | Treatment plan cost estimates serve as the basis for invoice line items |
| Patient Records | Soft dependency | Diagnosis references on invoice line items for clinical context |

**Legend:** Hard dependency = required for core functionality; Soft dependency = optional enhancement.

---

## 8. Key Design Tenets

1. **Invoices are immutable after issuance** — once an invoice reaches Issued status, its line items and totals are frozen. Corrections flow through Credit Notes, not invoice edits.
2. **Financial integrity through audit trails** — every financial transaction (create, update, cancel, refund) is attributed to a user and timestamped. No anonymous operations.
3. **Treatment plan costs are estimates, not binding invoices** — the Billing module consumes cost data from Treatment Plans, but actual line-item prices may differ (e.g., due to negotiated rates or plan changes).
4. **Payment is tracked at the invoice level** — an invoice can be paid through multiple partial payments. Payment reconciliation is mandatory.
5. **Discounts require approval** — discount values exceeding configured thresholds require multi-step approval, preventing unauthorized price reductions.
6. **No hard deletion of financial records** — financial data is immutable for compliance. Invoices and payments can be voided or cancelled, but never deleted.
7. **Invoice numbers follow a predictable, configurable sequence** — numbering is sequential and gap-free, suitable for audit and regulatory requirements.

---

## 9. Implementation Status

| Component | Status |
|---|---|
| Module Overview | Complete |
| Business Analysis | Complete |
| Functional Requirements | Complete |
| Non-Functional Requirements | Complete |
| Feature List | Complete |
| User Roles & Permissions | Complete (expanded with personas) |
| Business Rules | Complete (expanded with edge cases, constraints matrix) |
| Workflows | Complete (expanded with state transitions, revenue cycle) |
| Financial Invariants | Complete |
| Module Interaction Matrix | Complete |
| Business Events | Complete |
| Search & Reporting Specification | Complete |
| Audit Requirements | Complete |
| Definition of Done | Complete |
| Architecture Decision Records | Complete (5 ADRs) |
| Future Scope | Complete |
| Glossary | Complete |
| Architecture Design | Pending |
| API Design | Pending |
| Database Design | Pending |
| Implementation | Pending |

---

## 10. Document Map

| Direction | Documents |
|---|---|
| **Start Here** | README.md → [00-module-overview.md](00-module-overview.md) → [glossary.md](glossary.md) |
| **For Architects** | [01-business-analysis.md](01-business-analysis.md) → [03-non-functional-requirements.md](03-non-functional-requirements.md) → [06-business-rules.md](06-business-rules.md) → [09-financial-invariants.md](09-financial-invariants.md) → [adr/](adr/) → [08-future-scope.md](08-future-scope.md) |
| **For Developers** | [02-functional-requirements.md](02-functional-requirements.md) → [06-business-rules.md](06-business-rules.md) → [07-workflows.md](07-workflows.md) → [10-module-interaction-matrix.md](10-module-interaction-matrix.md) → [11-business-events.md](11-business-events.md) → [glossary.md](glossary.md) |
| **For QA Engineers** | [02-functional-requirements.md](02-functional-requirements.md) → [04-feature-list.md](04-feature-list.md) → [07-workflows.md](07-workflows.md) → [14-definition-of-done.md](14-definition-of-done.md) → [13-audit-requirements.md](13-audit-requirements.md) |
| **For Product Owners** | [01-business-analysis.md](01-business-analysis.md) → [04-feature-list.md](04-feature-list.md) → [08-future-scope.md](08-future-scope.md) → [05-user-roles-and-permissions.md](05-user-roles-and-permissions.md) |
| **For Clinic Administrators** | [05-user-roles-and-permissions.md](05-user-roles-and-permissions.md) → [06-business-rules.md](06-business-rules.md) → [12-search-and-reporting-specification.md](12-search-and-reporting-specification.md) → [glossary.md](glossary.md) |

---

## 11. Related Documents

| Document | Location |
|---|---|
| Treatment Plan Module Documentation | `docs/treatment/` |
| Doctor Management Documentation | `docs/doctor-management/` |
| Project BRD | `docs/BRD.md` |
| Project Documentation Master | `docs/PROJECT_DOCUMENTATION.md` |
