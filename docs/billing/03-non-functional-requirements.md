# Non-Functional Requirements — Billing Module

> **Document Type:** Non-Functional Requirements Specification
> **Status:** DRAFT | **Target Quality Score:** 9.9/10
> **Phase Labels:** [MVP], [PHASE 2], [PHASE 3] identify the target implementation phase for each requirement.

| Field | Value |
|---|---|
| Document | Non-Functional Requirements Specification |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Last Updated | 2026-07-20 |
| Related Documents | 01-business-analysis.md, 02-functional-requirements.md, 06-business-rules.md |

---

## Table of Contents

1. [Performance](#1-performance)
2. [Scalability](#2-scalability)
3. [Security](#3-security)
4. [Availability](#4-availability)
5. [Auditability](#5-auditability)
6. [Reliability](#6-reliability)
7. [Maintainability](#7-maintainability)
8. [Compliance Considerations](#8-compliance-considerations)
9. [Logging](#9-logging)
10. [Error Handling Expectations](#10-error-handling-expectations)
11. [Usability](#11-usability)
12. [Interoperability](#12-interoperability)

---

## 1. Performance

| ID | Category | Requirement | Target | Phase |
|---|---|---|---|---|
| NFR-1 | Response Time | Invoice creation (with up to 20 line items) | <500ms | MVP |
| NFR-2 | Response Time | Invoice search (exact match by number) | <200ms | MVP |
| NFR-3 | Response Time | Invoice search (partial patient name with filters) | <500ms for 50,000 records | MVP |
| NFR-4 | Response Time | Payment recording | <300ms | MVP |
| NFR-5 | Response Time | Receipt generation | <500ms | MVP |
| NFR-6 | Response Time | Financial dashboard load | <2s | Phase 2 |
| NFR-7 | Response Time | Report generation (30-day range) | <5s | Phase 2 |
| NFR-8 | Response Time | Patient financial summary load | <1s | Phase 2 |
| NFR-9 | Throughput | Concurrent invoice creation | 10 requests/second minimum | MVP |
| NFR-10 | Throughput | Concurrent payment recording | 20 requests/second minimum | MVP |
| NFR-11 | Data Volume | Handle invoice with up to 50 line items | No performance degradation | MVP |
| NFR-12 | Data Volume | Search across 100,000+ invoice records | Response within <2s | MVP |

---

## 2. Scalability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-20 | System SHALL support linear scaling with additional application instances | Horizontal scaling without data loss | MVP |
| NFR-21 | System SHALL handle 5× peak day transaction volume without degradation | Peak volume based on clinic size × 5 | MVP |
| NFR-22 | System SHALL support data archiving for records older than configurable retention period | Archiving does not impact active query performance | Phase 3 |
| NFR-23 | System SHALL support read replicas for reporting queries (dashboard, reports) | Reporting queries routed to replica | Phase 2 |
| NFR-24 | System SHALL support database indexes optimized for common search/filter patterns | Query plan uses indexes for ≥90% of searches | MVP |

---

## 3. Security

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-30 | All billing API endpoints SHALL require authentication | 401/403 on missing/invalid credentials | MVP |
| NFR-31 | All billing operations SHALL be subject to RBAC permission checks | Unauthorized operations rejected | MVP |
| NFR-32 | Financial data SHALL be transmitted over encrypted channels (TLS 1.2+) | HTTPS enforced | MVP |
| NFR-33 | Sensitive financial data at rest SHALL be encrypted | Database-level encryption (e.g., TDE) or application-level for PII | MVP |
| NFR-34 | Invoice totals SHALL be validated server-side; client-provided totals SHALL be rejected | Server recomputes all totals | MVP |
| NFR-35 | Payment amount SHALL NOT exceed invoice outstanding balance without explicit confirmation | Overpayment flagged for review | MVP |
| NFR-36 | Discount percentages SHALL have a system-wide maximum (configurable) | Discount capped at configured max | MVP |
| NFR-37 | Idle session timeout SHALL apply to billing screens | Timeout after configurable period | MVP |
| NFR-38 | Access to financial reports SHALL require explicit permission | Report access gated by RBAC | Phase 2 |
| NFR-39 | Bulk export of financial data SHALL be logged and require elevated permissions | Export audited | Phase 2 |
| NFR-40 | API rate limiting SHALL apply to financial endpoints | Rate limit configurable per role | MVP |

---

## 4. Availability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-50 | System SHALL achieve 99.5% uptime during clinic operating hours | 99.5% availability (≈3.6 hours downtime/month max) | MVP |
| NFR-51 | Scheduled maintenance SHALL be notified at least 48 hours in advance | Email notification to all billing users | MVP |
| NFR-52 | Unscheduled downtime SHALL be resolved within 4 hours during business hours | 4-hour recovery time objective (RTO) | MVP |
| NFR-53 | Database backups SHALL be taken at least daily | Point-in-time recovery capability | MVP |
| NFR-54 | Payment processing SHALL continue to function during network interruptions by supporting offline recording | Offline payment records queued for sync | Phase 3 |

---

## 5. Auditability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-60 | Every financial transaction SHALL be traceable to the user who performed it | User ID recorded on every mutation | MVP |
| NFR-61 | Every status change on an invoice SHALL be recorded with old status, new status, timestamp, user, and reason | Full status change history maintained | MVP |
| NFR-62 | Price overrides SHALL be tracked with original price, overridden price, user, and timestamp | Override history maintained | MVP |
| NFR-63 | Discount approval decisions SHALL be recorded with approver, timestamp, and decision | Approval audit trail | Phase 2 |
| NFR-64 | Refund and credit note actions SHALL be fully audited | Full mutation history | Phase 2 |
| NFR-65 | Audit records SHALL be append-only and immutable | No modification or deletion of audit records | MVP |
| NFR-66 | Audit data SHALL be retained for the legally mandated period (configurable, minimum 7 years) | Configurable retention policy | MVP |
| NFR-67 | System SHALL support exporting audit trail data for external auditor review | CSV/PDF export of audit data | Phase 2 |

---

## 6. Reliability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-70 | Invoice number generation SHALL be gapless and sequential, even under concurrent creation | Sequence generator ensures no gaps | MVP |
| NFR-71 | Invoice creation SHALL be atomic — all line items must succeed or the entire invoice fails | Transactional integrity | MVP |
| NFR-72 | Payment allocation to invoices SHALL be atomic — no partial allocations | Transactional integrity | MVP |
| NFR-73 | System SHALL prevent duplicate invoice generation from the same treatment plan items | Deduplication check on creation | MVP |
| NFR-74 | System SHALL validate financial calculations (subtotal, tax, discount, total) on both create and retrieve | Server-side validation on write; periodic integrity check | MVP |
| NFR-75 | System SHALL recover gracefully from database connection failures during payment recording | Idempotency key support for payment retry | MVP |
| NFR-76 | Data consistency checks SHALL be run periodically to detect anomalies in financial data | Scheduled integrity job | Phase 2 |

---

## 7. Maintainability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-80 | System SHALL follow existing DensCare modular monolith architecture patterns | Consistent with Auth, Patient, Treatment Plan modules | MVP |
| NFR-81 | Tax configuration SHALL be modifiable without code changes | Admin UI for tax rate management | Phase 2 |
| NFR-82 | Discount thresholds SHALL be configurable without code changes | Admin UI for threshold configuration | Phase 2 |
| NFR-83 | Invoice numbering configuration SHALL be modifiable without code changes | Admin UI for numbering prefix, starting number | MVP |
| NFR-84 | Payment method list SHALL be extensible without code changes | Configurable payment method list | MVP |
| NFR-85 | Report templates SHALL use a data-driven approach — new reports should not require code changes | Report framework with configurable fields | Phase 2 |
| NFR-86 | System SHALL support feature flags for phased rollout of Phase 2 and Phase 3 features | Feature toggle mechanism | MVP |

---

## 8. Compliance Considerations

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-90 | Invoice numbering SHALL comply with local tax authority sequential numbering requirements | Gapless, sequential, non-reusable numbers | MVP |
| NFR-91 | Invoice data retention SHALL comply with applicable data protection regulations (e.g., GDPR, local tax laws) | Configurable retention with minimum 7-year default | MVP |
| NFR-92 | Audit trail SHALL comply with financial record-keeping regulations | Append-only audit with complete attribution | MVP |
| NFR-93 | Tax calculation SHALL comply with applicable tax regulations per jurisdiction | Configurable rates with audit trail | Phase 2 |
| NFR-94 | E-invoicing SHALL comply with regional e-invoicing standards where applicable | Standards-compliant output format | Phase 3 |
| NFR-95 | Patient financial data SHALL be handled in compliance with healthcare data privacy regulations (e.g., HIPAA, PIPEDA) | Data access controls, encryption, audit | MVP |
| NFR-96 | Refund and credit note handling SHALL comply with applicable consumer protection and tax regulations | Proper documentation and audit | Phase 2 |

---

## 9. Logging

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-100 | All financial mutations SHALL be logged at INFO level with full payload (excluding sensitive PII) | Structured logging | MVP |
| NFR-101 | Failed financial operations SHALL be logged at ERROR level with stack trace | Error logging with correlation ID | MVP |
| NFR-102 | Authentication failures on billing endpoints SHALL be logged at WARN level | Security event logging | MVP |
| NFR-103 | Authorization failures (permission denied) SHALL be logged at WARN level | Security event logging | MVP |
| NFR-104 | Payment gateway errors SHALL be logged at ERROR level with gateway response | Integration error logging | Phase 3 |
| NFR-105 | Logs SHALL include correlation IDs for end-to-end request tracing | Correlation ID in every log entry | MVP |
| NFR-106 | Audit logs SHALL be stored separately from application logs (different storage or retention policy) | Audit log preserved per compliance requirements | MVP |
| NFR-107 | Application logs SHALL follow a structured format (e.g., JSON) for machine parsing | Structured logging format | MVP |

---

## 10. Error Handling Expectations

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-110 | Validation errors SHALL return clear, human-readable messages identifying the specific field and reason | Structured error response with field-level errors | MVP |
| NFR-111 | Business rule violations SHALL return specific error codes for each violation type | Error code enumeration | MVP |
| NFR-112 | Authorization failures SHALL return 403 with a clear message | 403 Forbidden response | MVP |
| NFR-113 | Authentication failures SHALL return 401 with a clear message | 401 Unauthorized response | MVP |
| NFR-114 | Concurrent modification conflicts SHALL be detected and reported (optimistic locking) | Version conflict detected on update | MVP |
| NFR-115 | Payment processing failures SHALL provide clear next-step guidance | "Retry" or "contact support" messaging | MVP |
| NFR-116 | Idempotency SHALL be supported for payment creation to prevent duplicate processing | Idempotency key accepted on payment endpoints | MVP |
| NFR-117 | Downstream service failures (e.g., Treatment Plan module unavailable) SHALL return 503 with clear message | Graceful degradation | MVP |
| NFR-118 | System SHALL support rollback of failed multi-step financial operations | Transaction rollback on failure | MVP |

---

## 11. Usability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-120 | Invoice display SHALL show line-item-level breakdown with unit price, quantity, discount, tax, and net amount | Clear itemized display | MVP |
| NFR-121 | Payment entry screen SHALL show invoice outstanding balance prominently | Balance visible during payment entry | MVP |
| NFR-122 | Financial reports SHALL be readable in both screen and print formats | Print-optimized report views | Phase 2 |
| NFR-123 | Search results SHALL show key summary information without requiring drill-down | Summary columns in search results | MVP |
| NFR-124 | User confirmation SHALL be required before destructive actions (void, cancel, reverse) | Confirmation dialog | MVP |

---

## 12. Interoperability

| ID | Requirement | Target | Phase |
|---|---|---|---|
| NFR-130 | System SHALL follow existing DensCare API conventions for consistency | Consistent with existing module APIs | MVP |
| NFR-131 | System SHALL support standard data export formats (CSV, JSON) | Export functionality | Phase 2 |
| NFR-132 | Payment gateway integration SHALL use a provider-agnostic interface for swappability | Abstract payment gateway interface | Phase 3 |
| NFR-133 | Accounting software export SHALL support at least one standard format (e.g., CSV with configurable field mapping) | Standard export format | Phase 3 |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [01-business-analysis.md](01-business-analysis.md) |
| **Related** | [02-functional-requirements.md](02-functional-requirements.md), [06-business-rules.md](06-business-rules.md) |
| **Next Reading** | [04-feature-list.md](04-feature-list.md) → [05-user-roles-and-permissions.md](05-user-roles-and-permissions.md) |
