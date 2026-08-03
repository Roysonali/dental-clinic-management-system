# Schema Review Checklist — Billing Module

> **Document Type:** Quality Assurance Document
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This checklist serves as a pre-implementation verification gate. Before SQLAlchemy model implementation begins, the database architecture must be reviewed against these criteria.

---

## 2. Completeness Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | All aggregate roots have a primary table | ⬜ | |
| 2 | All child entities have a table with FK to parent | ⬜ | |
| 3 | All value objects are inlined or have a reference table | ⬜ | |
| 4 | All domain entities from Phase 2 are represented | ⬜ | |
| 5 | Join tables exist for all M:N relationships | ⬜ | |

**Expected:** 10 tables (MVP) + 3 tables (Phase 2) as specified in 03-table-specifications

---

## 3. Key Strategy Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | All PKs are UUID type | ⬜ | |
| 2 | All PKs use `gen_random_uuid()` default | ⬜ | |
| 3 | No composite PKs (except join tables) | ⬜ | |
| 4 | Candidate keys (invoice_number, etc.) have unique constraints | ⬜ | |
| 5 | FK columns to external modules have NO DB constraints | ⬜ | |
| 6 | FK columns within Billing schema HAVE DB constraints | ⬜ | |

---

## 4. Constraints Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | All NOT NULL constraints from business rules are applied | ⬜ | |
| 2 | All check constraints from 05-constraints.md are specified | ⬜ | |
| 3 | All unique constraints from 05-constraints.md are specified | ⬜ | |
| 4 | The partial unique index for BR-121 is defined | ⬜ | |
| 5 | Default values from 05-constraints.md are specified | ⬜ | |

---

## 5. Audit Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | All core tables have `created_by`, `created_at`, `updated_by`, `updated_at` | ⬜ | |
| 2 | `invoice_status_history` table exists with all required columns | ⬜ | |
| 3 | Append-only policy is enforced (no UPDATE/DELETE on history) | ⬜ | |
| 4 | Soft delete is NOT present on any financial record table | ⬜ | |
| 5 | Version column exists on all tables requiring optimistic locking | ⬜ | |

---

## 6. Indexing Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | All indexes from 06-indexing-strategy.md are specified | ⬜ | |
| 2 | Partial indexes for active-only queries are defined | ⬜ | |
| 3 | Composite index for overdue detection is defined | ⬜ | |
| 4 | Index for balance computation on `payment_allocations.invoice_id` is defined | ⬜ | |
| 5 | No redundant indexes exist | ⬜ | |

---

## 7. Migration Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | Migration ordering from 10-migration-strategy.md is followed | ⬜ | |
| 2 | Seed data for `document_sequences` is included | ⬜ | |
| 3 | All migrations are idempotent | ⬜ | |
| 4 | Rollback plan exists for each migration | ⬜ | |

---

## 8. Performance Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | Critical query paths (load invoice, record payment) have index coverage | ⬜ | |
| 2 | Row estimates for Year 1 are within acceptable limits | ⬜ | |
| 3 | Transaction lengths are within acceptable limits | ⬜ | |
| 4 | Lock contention scenarios (number reservation) are addressed | ⬜ | |

---

## 9. Architecture Compliance Checklist

| # | Check | Status | Verified By |
|---|---|---|---|
| 1 | No cross-module foreign key constraints to non-Billing tables | ⬜ | |
| 2 | All monetary columns use NUMERIC(12,2) | ⬜ | |
| 3 | Payment method is VARCHAR (not ENUM) | ⬜ | |
| 4 | Status columns are VARCHAR (not ENUM) | ⬜ | |
| 5 | Timestamps use TIMESTAMPTZ (not TIMESTAMP) | ⬜ | |
| 6 | Invoice outstanding balance is NOT stored | ⬜ | |
| 7 | Invoice grand total is NOT stored | ⬜ | |

---

## 10. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Database Architect | | | |
| Engineering Lead | | | |
| QA Lead | | | |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | All documents (01–12) |
| **Related** | [01-database-overview.md](01-database-overview.md) |
| **Next** | [14-database-decision-log.md](14-database-decision-log.md) |
