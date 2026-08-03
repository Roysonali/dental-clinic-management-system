# Optimistic Locking — Billing Module

> **Document Type:** Database Architecture Specification
> **Status:** Draft
> **Last Updated:** 2026-07-20

---

## 1. Purpose

This document defines the optimistic locking strategy for the Billing module. Optimistic locking prevents lost updates when multiple concurrent users or processes modify the same financial records.

---

## 2. Concurrency Risks in Billing

| Scenario | Risk | Impact |
|---|---|---|
| Two receptionists record payment for the same invoice concurrently | Both read the same outstanding balance and allocate beyond the grand total | Overpayment without explicit patient credit creation |
| Two accountants modify the same draft invoice | Last write wins — one set of changes is lost | Data loss |
| Scheduled overdue detection runs while user is updating invoice | Stale read leads to incorrect status transition | Wrong overdue status |
| Sequence number reservation races | Two users get the same number | Duplicate invoice numbers (audit failure) |

---

## 3. Locking Strategy

| Lock Type | Where Used | Why |
|---|---|---|
| **Optimistic locking (version column)** | Core entity tables (invoices, payments, line items, credit notes) | Most operations are single-user; contention is rare. Version check prevents lost updates without read-locks. |
| **Pessimistic locking (SELECT FOR UPDATE)** | `document_sequences` table | Number reservation must be gapless. Row-level lock prevents two users from reserving the same number. |
| **Pessimistic (SELECT FOR UPDATE)** | Outstanding balance read during payment allocation | Prevents concurrent allocation race condition (see [14-database-decision-log.md](14-database-decision-log.md), Decision DB-04). |

---

## 4. Version Column Implementation

| Aspect | Specification |
|---|---|
| **Column name** | `version` |
| **Type** | `INTEGER` |
| **Default** | `1` |
| **Increment** | +1 on every UPDATE |
| **Initial** | Set to 1 on INSERT |
| **Check** | Version must be included in WHERE clause: `WHERE invoice_id = ? AND version = ?` |
| **On conflict** | If version mismatch, reject update with `OptimisticLockError`. Client must re-read and retry. |

### Example Flow

```
1. User A reads invoice (version = 3)
2. User B reads invoice (version = 3)
3. User A updates invoice: UPDATE ... WHERE invoice_id = X AND version = 3
   → Success, version becomes 4
4. User B updates invoice: UPDATE ... WHERE invoice_id = X AND version = 3
   → Fails: 0 rows affected, version is now 4
5. User B re-reads invoice, sees updated data, re-applies changes
```

---

## 5. Tables with Optimistic Locking

| Table | Version Column | Lock Type | Phase |
|---|---|---|---|
| `invoices` | `version` | Optimistic | MVP |
| `invoice_line_items` | `version` | Optimistic | MVP |
| `payments` | `version` | Optimistic | MVP |
| `credit_notes` | `version` | Optimistic | Phase 2 |
| `document_sequences` | None (pessimistic) | Pessimistic (FOR UPDATE) | MVP |

**Tables without versioning:**

| Table | Rationale |
|---|---|
| `invoice_status_history` | Append-only — no concurrent update risk |
| `receipts` | Immutable after creation — no updates |
| `payment_allocations` | Immutable after creation — refunds create new records, not updates |
| `patient_credits` | Low contention; handle via optimistic locking in the application layer |
| `sequence_consumption_log` | Append-only |

---

## 6. Pessimistic Locking: Document Sequences

| Aspect | Detail |
|---|---|
| **Table** | `document_sequences` |
| **Lock type** | `SELECT ... FOR UPDATE` (row-level) |
| **Scope** | Single row for the document type being reserved |
| **Duration** | Held for the duration of the number reservation transaction only |
| **Retry** | If lock acquisition fails, retry up to 3 times with exponential backoff |
| **Deadlock prevention** | Always lock in consistent order (by `document_type` alphabetically) |

### Number Reservation Flow

```
BEGIN TRANSACTION;
  SELECT current_value FROM document_sequences
  WHERE document_type = 'invoice' FOR UPDATE;
  -- Application increments: next_value = current_value + 1
  UPDATE document_sequences
  SET current_value = next_value, updated_at = NOW(), updated_by = ?
  WHERE document_type = 'invoice';
  INSERT INTO sequence_consumption_log (document_type, number_assigned, ...);
  formatted_number = prefix + LPAD(next_value, min_digits, '0');
COMMIT;
-- Use formatted_number in subsequent document creation
```

---

## 7. Pessimistic Locking: Outstanding Balance Read

| Aspect | Detail |
|---|---|
| **Scenario** | Payment allocation reads invoice outstanding balance |
| **Lock type** | `SELECT ... FOR UPDATE` on the invoice row |
| **Scope** | Single invoice row being allocated against |
| **Duration** | For the duration of the payment allocation transaction |
| **Why** | Prevents two concurrent payments from both reading the same balance and allocating more than available |
| **Alternative rejected** | Optimistic locking on balance — too many retries under concurrent payment scenarios |

---

## 8. Retry Strategy

| Scenario | Retry Strategy |
|---|---|
| Optimistic lock failure | Client re-reads the record and retries the operation (manual for UI, automatic for scheduled tasks) |
| Sequence lock timeout | Retry up to 3 times with 50ms, 100ms, 200ms backoff |
| Balance read lock timeout | Rollback and notify user — manual retry required |

---

## Cross-Reference Navigation

| Direction | Documents |
|---|---|
| **Prerequisite** | [08-audit-and-versioning.md](08-audit-and-versioning.md) |
| **Related** | [14-database-decision-log.md](14-database-decision-log.md) (Decision DB-04) |
| **Next** | [10-migration-strategy.md](10-migration-strategy.md) |
