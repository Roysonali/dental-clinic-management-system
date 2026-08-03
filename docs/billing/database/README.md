# Database Architecture — Billing Module

> **Document Type:** Database Architecture Specification (Phase 3)
> **Status:** Draft
> **Last Updated:** 2026-07-20

| Field | Value |
|---|---|
| Document | Database Architecture |
| Module | Billing |
| Version | 1.0 |
| Status | Draft |
| Owner | Engineering Team |
| Phase Dependencies | Phase 1 (Business Docs — Approved), Phase 2 (Domain Model — Approved) |

---

## 1. Purpose

This document defines the complete database architecture for the DensCare Billing module. It specifies the table design, key strategy, constraints, indexing, audit mechanisms, and migration planning required to implement the Phase 2 domain model in a relational database.

The documentation is **implementation-independent**. It describes *what* the schema should be and *why*, without producing SQL DDL, SQLAlchemy models, or Alembic migrations. ORM implementation can begin directly from this specification.

---

## 2. Document Structure

```
docs/billing/database/
├── README.md                             ← You are here
├── 01-database-overview.md               — Schema context, principles, architecture constraints
├── 02-entity-to-table-mapping.md         — Mapping from domain entities to relational tables
├── 03-table-specifications.md            — Complete table definitions with columns and types
├── 04-primary-and-foreign-keys.md        — Key strategy, foreign key relationships
├── 05-constraints.md                     — Unique, check, exclusion, and business constraints
├── 06-indexing-strategy.md               — Index design for query performance
├── 07-normalization.md                   — Normalization decisions and denormalization trade-offs
├── 08-audit-and-versioning.md            — Audit columns, soft delete, versioning patterns
├── 09-optimistic-locking.md              — Concurrency control with version fields
├── 10-migration-strategy.md              — Migration ordering and data migration planning
├── 11-performance-considerations.md      — Query patterns, expected volumes, optimization
├── 12-future-compatibility.md            — Insurance, GST, wallet, multi-branch readiness
├── 13-schema-review-checklist.md         — Pre-implementation verification checklist
├── 14-database-decision-log.md           — All major decisions with rationale and trade-offs
├── 15-money-handling-policy.md           — Enterprise monetary precision, rounding, and currency policy
└── diagrams/
    ├── logical-er-diagram.md             — Logical entity-relationship diagram
    ├── physical-er-diagram.md            — Physical table-relationship diagram
    └── foreign-key-map.md                — Foreign key reference map
```

---

## 3. Design Tenets

The database design follows these architectural tenets:

| Tenet | Description |
|---|---|
| **UUID Primary Keys** | All tables use UUID primary keys. No auto-increment integer keys. |
| **Immutable Financial Records** | Issued invoices, completed payments, and generated receipts are immutable. No in-place updates. |
| **Audit Trail** | Every table includes `created_by`, `created_at`, `updated_by`, `updated_at`. Status changes recorded in history tables. |
| **Soft Delete Prohibited** | Financial records are never soft-deleted. They transition to terminal statuses (Cancelled, Void) and remain in the database. |
| **Derived Balances** | Invoice outstanding balance is computed on read, never stored. |
| **ID-only External References** | Billing tables store UUID references to other modules (Patient, Doctor, User, TreatmentPlan) but never own that data. |
| **Extensible Payment Methods** | Payment method is stored as a flexible type, not a hard-coded enum. |
| **Gateway-Agnostic Payments** | Payment records store a generic `reference_number` for gateway transaction IDs rather than gateway-specific fields. |
| **Configurable Tax** | Tax structures exist in the schema but are enabled through configuration, not code changes. |
| **Payment Flexibility** | Payments can span multiple invoices, be unallocated (advance), or be partially allocated. Schema supports all patterns natively. |

---

## 4. Architecture Constraints

| Constraint | Source | Impact |
|---|---|---|
| Modular Monolith | DensCare architecture | Billing tables are in the same database instance but in a separate schema/namespace. |
| Repository Pattern | DensCare architecture | Table access is through repository classes, not direct SQL. |
| UUID Primary Keys | Architecture decision | All PKs are UUID v4. No SERIAL/BIGSERIAL. |
| No direct cross-module FK enforcement | Domain model (17-integration-boundaries) | References to Patient, User, Doctor, TreatmentPlan are by UUID only — no foreign key constraints to external module tables. |

---

## 5. Client Business Decisions

| Decision | Database Impact |
|---|---|
| All payment modes accepted | `payment_method` stored as flexible string/reference, not enum |
| No payment gateway selected | `reference_number` field for any gateway transaction ID; no gateway-specific schema |
| No direct insurance payments | No insurance settlement tables; patient credit + payment method for patient-paid claims |
| GST not currently charged | Tax tables exist but default to zero rates; enabled via configuration |
| Future GST support required | Tax structures designed for multi-rate, multi-jurisdiction from the start |

---

## 6. Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Phase 2 Reference** | [domain-model/11-aggregate-design.md](../domain-model/11-aggregate-design.md), [domain-model/09-domain-entities.md](../domain-model/09-domain-entities.md) |
| **Phase 1 Reference** | [06-business-rules.md](../06-business-rules.md), [09-financial-invariants.md](../09-financial-invariants.md) |
| **ADRs** | [adr/ADR-001-invoice-as-aggregate-root.md](../adr/ADR-001-invoice-as-aggregate-root.md) through [ADR-005](../adr/ADR-005-discount-approval-workflow.md) |
| **Next** | [01-database-overview.md](01-database-overview.md) |
