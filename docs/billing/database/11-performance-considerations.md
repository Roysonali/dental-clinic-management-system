# Performance Considerations — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document describes the performance characteristics, expected query volumes, optimization strategies, and scalability considerations for the Billing module database.

---

## 2. Expected Data Volumes

| Table | Initial Rows | Monthly Growth | Year 1 Estimate | Notes |
|---|---|---|---|---|
| `invoices` | 0 | 500–2,000 | 6,000–24,000 | Per single-clinic deployment |
| `invoice_line_items` | 0 | 2,000–10,000 | 24,000–120,000 | ~5 line items per invoice avg |
| `invoice_status_history` | 0 | 1,000–4,000 | 12,000–48,000 | ~2 status changes per invoice |
| `payments` | 0 | 500–2,000 | 6,000–24,000 | ~1 payment per invoice |
| `payment_allocations` | 0 | 500–2,500 | 6,000–30,000 | ~1.2 allocations per payment |
| `receipts` | 0 | 500–2,000 | 6,000–24,000 | 1:1 with payments |
| `credit_notes` | 0 | 50–200 | 600–2,400 | ~10% of invoices (Phase 2) |
| `patient_credits` | 0 | 50–200 | 600–2,400 | ~10% of invoices |
| `document_sequences` | 5 | 0 | 5 | Static (5 rows) |
| `sequence_consumption_log` | 0 | 1,500–6,000 | 18,000–72,000 | ~3 per document |

**Total rows Year 1:** ~80,000–350,000 (well within PostgreSQL single-table capacity of billions)

---

## 3. Query Performance Targets

| Query Type | Target Latency | Frequency | Criticality |
|---|---|---|---|
| Load invoice with line items | < 50ms | Very high | Critical — every invoice operation |
| Record payment | < 100ms | High | Critical — front desk operation |
| Compute outstanding balance | < 50ms | High | Critical — every invoice view |
| List invoices by patient | < 200ms | High | Critical — search |
| Generate next document number | < 20ms | Very high | Critical — every document creation |
| Generate overdue report | < 1s | Low (scheduled) | Medium — daily |
| Generate revenue report | < 3s | Low (scheduled) | Medium — monthly |

---

## 4. Query Optimization Strategies

| Strategy | Application |
|---|---|
| **Covering indexes** | Include selected columns in index to avoid table lookups for frequent queries |
| **Partial indexes** | Index only active records (e.g., non-terminal invoices) to reduce index size |
| **Composite indexes** | Multi-column indexes for queries with multiple WHERE conditions (e.g., `(due_date, status)` for overdue detection) |
| **Descending indexes** | Recent-first ordering for timestamp columns |
| **Read-model materialization** | For complex reports (revenue by doctor, aging summary), consider materialized views refreshed on schedule |
| **Denormalized balance** | If computed outstanding balance becomes a performance bottleneck, add a cached `outstanding_balance` column updated via triggers or application events |

---

## 5. Connection Pool Configuration

| Parameter | Recommended | Rationale |
|---|---|---|
| Min connections | 2 | Always have at least one ready |
| Max connections | 20 | Clinic scale — 20 concurrent DB connections is generous |
| Connection timeout | 5s | Quick failure under load |
| Idle timeout | 300s | Release unused connections |
| Max lifetime | 1800s | Rotate connections every 30 minutes |

---

## 6. Transaction Length Guidelines

| Operation | Expected Duration | Notes |
|---|---|---|
| Create invoice + line items | < 200ms | Single aggregate transaction |
| Record payment + allocations | < 300ms | Cross-aggregate (payment + receipt via event) |
| Cancel invoice | < 100ms | Status update + history + release plan items |
| Number reservation | < 20ms | Single-row lock, quick release |
| Generate overdue status | < 1s per batch | Batch processing outside business hours |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [06-indexing-strategy.md](06-indexing-strategy.md) |
| **Related** | [09-optimistic-locking.md](09-optimistic-locking.md) |
| **Next** | [12-future-compatibility.md](12-future-compatibility.md) |
