# Billing Module — Operational Runbooks

> **Module:** `app.modules.billing`
> **Sprint:** 10B.6 (Documentation & Operational Readiness)
> **Last updated:** July 25, 2026

---

## Table of Contents

1. [Failed Migration Recovery](#1-failed-migration-recovery)
2. [Database Rollback](#2-database-rollback)
3. [Failed Invoice Generation](#3-failed-invoice-generation)
4. [Failed Payment Allocation](#4-failed-payment-allocation)
5. [Failed Refund Processing](#5-failed-refund-processing)
6. [Document Sequence Recovery](#6-document-sequence-recovery)
7. [Audit Log Verification](#7-audit-log-verification)
8. [Connection Pool Exhaustion](#8-connection-pool-exhaustion)
9. [Incident Investigation](#9-incident-investigation)

---

## 1. Failed Migration Recovery

### Symptoms
- Application fails to start with `alembic.util.exc.CommandError`
- Database schema does not match expected state
- Error in application logs: `relation "billing_<table>" does not exist`

### Investigation

```bash
# 1. Check current alembic state
alembic current

# 2. Check migration history
alembic history

# 3. Check if any billing tables exist
psql $DATABASE_URL -c "\dt billing_*"

# 4. Check application logs for migration errors
journalctl -u denscare-api -n 100 | grep -i migration
```

### Recovery Procedure

```bash
# Option A: If migration never completed (safe to retry)
alembic upgrade head

# Option B: If migration partially applied
# 1. Check what revision was last applied
alembic current

# 2. Stamp to the last successful revision
alembic stamp <last_successful_revision>

# 3. Re-run migration
alembic upgrade head

# Option C: If data inconsistency exists
# 1. Rollback
alembic downgrade -1

# 2. Fix the issue (e.g., constraint violation)
# 3. Re-apply
alembic upgrade head
```

### Escalation
If migration continues to fail after 2 retries, escalate to database administrator. Do not manually edit the `alembic_version` table.

---

## 2. Database Rollback

### When to Rollback
- Migration introduced a breaking schema change
- Performance regression after migration
- Data integrity issue discovered post-migration

### Rollback Procedure

```bash
# 1. Rollback billing migration
alembic downgrade -1

# 2. Verify rollback
alembic current

# 3. Verify billing tables removed
psql $DATABASE_URL -c "\dt billing_*"

# 4. Restart application
systemctl restart denscare-api

# 5. Verify application starts without errors
journalctl -u denscare-api -n 50 | tail
```

### Post-Rollback Validation

```sql
-- Verify no orphaned billing data
SELECT COUNT(*) FROM billing_invoices;
-- Should fail with "relation does not exist" if rollback successful

-- Verify alembic version
SELECT version_num FROM alembic_version;
```

---

## 3. Failed Invoice Generation

### Symptoms
- API returns 500 or 422 on `POST /billing/invoices`
- Error in application logs: `InvoiceCreationFailed` or `SequenceReservationFailed`
- Client reports invoice not created

### Investigation

```bash
# 1. Check application logs for the specific error
journalctl -u denscare-api -n 200 | grep -i "invoice.*fail\|INVOICE_CREATION_FAILED\|SEQUENCE_RESERVATION_FAILED"

# 2. Check document sequence health
psql $DATABASE_URL -c "SELECT * FROM billing_document_sequences WHERE document_type = 'invoice';"

# 3. Check for recent failed sequence reservations
psql $DATABASE_URL -c "SELECT * FROM billing_sequence_consumption_logs WHERE document_type = 'invoice' AND status = 'FAILED' ORDER BY reserved_at DESC LIMIT 10;"
```

### Common Causes & Resolutions

| Cause | Detection | Resolution |
|-------|-----------|------------|
| Patient does not exist | `PatientNotFound` in logs | Verify patient ID; create patient if needed |
| Document sequence not configured | `DocumentSequenceNotFound` | Run seed script to initialize sequences |
| Duplicate invoice number | `IntegrityError` in logs | Extremely rare; retry the request |
| Missing line items | `LineItemValidationFailed` | Ensure at least 1 line item in request |
| Database connection error | Connection timeout in logs | Check database health and connection pool |
| Validation error | `INVOICE_VALIDATION_FAILED` | Check request payload against API documentation |

### Recovery

```bash
# 1. Fix the root cause (e.g., initialize missing sequence)
# 2. Retry the invoice creation request
# 3. Verify invoice created successfully
psql $DATABASE_URL -c "SELECT id, invoice_number, status FROM billing_invoices ORDER BY created_at DESC LIMIT 1;"
```

### Escalation
If the error is `SEQUENCE_RESERVATION_FAILED` and sequence row exists but is corrupted, escalate to database administrator.

---

## 4. Failed Payment Allocation

### Symptoms
- API returns 409 or 422 on `POST /billing/payments/{id}/allocate`
- Error in logs: `PaymentExceedsInvoice`, `InvalidPaymentStatusTransition`, or `IntegrityError`
- Payment amount not reflecting on invoice

### Investigation

```bash
# 1. Check payment status
psql $DATABASE_URL -c "SELECT id, payment_number, status, total_amount FROM billing_payments WHERE id = '<payment_id>';"

# 2. Check invoice status and outstanding amount
psql $DATABASE_URL -c "SELECT id, invoice_number, status FROM billing_invoices WHERE id = '<invoice_id>';"

# 3. Check existing allocations
psql $DATABASE_URL -c "SELECT id, invoice_id, allocated_amount, is_refund FROM billing_payment_allocations WHERE payment_id = '<payment_id>';"
```

### Common Causes & Resolutions

| Cause | Detection | Resolution |
|-------|-----------|------------|
| Payment not in COMPLETED status | `InvalidPaymentStatusTransition` | Complete payment first: `POST /payments/{id}/complete` |
| Invoice not in payable status | `InvalidInvoiceStatusTransition` | Invoice must be ISSUED, PARTIALLY_PAID, or OVERDUE |
| Allocation exceeds payment balance | `PaymentExceedsInvoice` | Reduce allocation amount |
| Invoice already fully paid | `PaymentExceedsInvoice` | Verify invoice outstanding balance |
| Duplicate allocation | `IntegrityError` (unique constraint) | Allocation already exists; verify with GET /allocations |

### Recovery

```bash
# 1. Verify payment has been completed
# 2. Verify invoice is in a payable status
# 3. Verify allocation amount <= payment unallocated balance
# 4. Retry the allocation request
```

---

## 5. Failed Refund Processing

### Symptoms
- API returns 409 or 422 on refund workflow endpoints
- Error in logs: `RefundExceedsPayment`, `InvalidRefundStatusTransition`
- Refund not progressing through its lifecycle

### Investigation

```bash
# 1. Check refund status
psql $DATABASE_URL -c "SELECT id, refund_number, status, amount FROM billing_refunds WHERE id = '<refund_id>';"

# 2. Check payment status
psql $DATABASE_URL -c "SELECT id, payment_number, status, total_amount FROM billing_payments WHERE id = '<payment_id>';"

# 3. Check total refunded amount against payment
psql $DATABASE_URL -c "SELECT COALESCE(SUM(amount), 0) as total_refunded FROM billing_refunds WHERE payment_id = '<payment_id>' AND status = 'COMPLETED';"
```

### Common Causes & Resolutions

| Cause | Detection | Resolution |
|-------|-----------|------------|
| Payment not COMPLETED | Logs show payment status | Refunds require completed payments |
| Refund exceeds payment | `RefundExceedsPayment` | Reduce refund amount |
| Wrong transition order | `InvalidRefundStatusTransition` | Follow: PENDING → APPROVED → COMPLETED |
| Reject requires reason | 422 error | Add rejection reason to request body |
| Refund already completed | 409 error | Refund is in terminal state; no action needed |

### Recovery

```bash
# 1. Verify refund is in expected status
# 2. Follow correct transition order:
#    POST /billing/refunds              → PENDING
#    POST /billing/refunds/{id}/approve → APPROVED
#    POST /billing/refunds/{id}/complete → COMPLETED
# 3. If stuck in PENDING, approve or reject
# 4. Only APPROVED refunds can be completed
```

---

## 6. Document Sequence Recovery

### Symptoms
- `SequenceReservationFailed` errors in logs
- Duplicate document numbers detected
- Sequence counter desynchronized after database restore

### Investigation

```bash
# 1. Check all document sequence counters
psql $DATABASE_URL -c "SELECT document_type, current_value, next_value FROM billing_document_sequences ORDER BY document_type;"

# 2. Compare with actual document counts
psql $DATABASE_URL -c "
SELECT 'invoice' as doc_type, COUNT(*) as count FROM billing_invoices
UNION ALL
SELECT 'payment', COUNT(*) FROM billing_payments
UNION ALL
SELECT 'receipt', COUNT(*) FROM billing_receipts
UNION ALL
SELECT 'refund', COUNT(*) FROM billing_refunds
UNION ALL
SELECT 'credit_note', COUNT(*) FROM billing_credit_notes;"

# 3. Check for gaps in sequence consumption log
psql $DATABASE_URL -c "SELECT document_type, status, COUNT(*) FROM billing_sequence_consumption_logs GROUP BY document_type, status;"
```

### Recovery

If sequences are desynchronized (next_value < actual max document number):

```bash
# 1. Find the current max document number for each type
MAX_INV=$(psql $DATABASE_URL -t -c "SELECT MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+') AS INTEGER)) FROM billing_invoices;")
MAX_PAY=$(psql $DATABASE_URL -t -c "SELECT MAX(CAST(SUBSTRING(payment_number FROM '[0-9]+') AS INTEGER)) FROM billing_payments;")

# 2. Update sequence counters (admin-only operation)
psql $DATABASE_URL -c "
UPDATE billing_document_sequences
SET current_value = $MAX_INV, next_value = $MAX_INV + 1, updated_at = NOW()
WHERE document_type = 'invoice';"

# 3. Verify sync
psql $DATABASE_URL -c "SELECT document_type, current_value, next_value FROM billing_document_sequences ORDER BY document_type;"
```

**Warning:** Manually updating sequence counters can cause document number collisions. Only perform this during a maintenance window with no concurrent document creation.

---

## 7. Audit Log Verification

### Purpose
Verify that financial audit logs are complete and consistent.

### Procedure

```sql
-- 1. Count audit log entries by entity type (last 24 hours)
SELECT entity_type, action, COUNT(*) as count
FROM billing_audit_logs
WHERE changed_at >= NOW() - INTERVAL '24 hours'
GROUP BY entity_type, action
ORDER BY entity_type, action;

-- 2. Check for invoices without audit logs
SELECT i.id, i.invoice_number, i.created_at
FROM billing_invoices i
LEFT JOIN billing_audit_logs al
    ON al.entity_id = i.id::text
    AND al.entity_type = 'invoice'
WHERE al.id IS NULL;

-- 3. Verify audit log entries have user attribution
SELECT COUNT(*) as unattributed_entries
FROM billing_audit_logs
WHERE changed_by IS NULL;

-- 4. Check for unusual activity (bulk operations)
SELECT changed_by, entity_type, action, COUNT(*) as count
FROM billing_audit_logs
WHERE changed_at >= NOW() - INTERVAL '1 hour'
GROUP BY changed_by, entity_type, action
HAVING COUNT(*) > 10
ORDER BY count DESC;

-- 5. Verify sequence consumption log consistency
SELECT cl.status, COUNT(*), MIN(cl.reserved_at), MAX(cl.reserved_at)
FROM billing_sequence_consumption_logs cl
GROUP BY cl.status;
```

### Expected Results

| Check | Expected |
|-------|----------|
| Audit log entries count | > 0 for active systems |
| Invoices without audit logs | 0 |
| Unattributed entries | 0 |
| PENDING consumption logs | 0 (all should be COMPLETED or FAILED) |

---

## 8. Connection Pool Exhaustion

### Symptoms
- API returns 503 Service Unavailable
- Error in logs: `sqlalchemy.exc.TimeoutError: QueuePool limit of size X overflow Y reached`
- Database CPU/memory normal but API unresponsive

### Investigation

```bash
# 1. Check current active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# 2. Check idle connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle' AND state_change < NOW() - INTERVAL '5 minutes';"

# 3. Check application log for connection errors
journalctl -u denscare-api -n 100 | grep -i "pool\|timeout\|connection"
```

### Emergency Recovery

```bash
# 1. Increase pool size (restart required)
# Modify app/database/session.py or set via environment variable
export SQLALCHEMY_POOL_SIZE=20
export SQLALCHEMY_MAX_OVERFLOW=30

# 2. Kill long-running idle connections
psql $DATABASE_URL -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < NOW() - INTERVAL '30 minutes'
AND pid <> pg_backend_pid();"
```

### Long-term Fix
- Review connection pool configuration in [deployment.md](deployment.md#connection-pool)
- Ensure `pool_recycle` is set (recommended: 1800 seconds)
- Verify `pool_pre_ping=True` (already set in codebase)
- Monitor connection pool usage with application metrics

---

## 9. Incident Investigation

### Initial Triage

```bash
# 1. Collect error logs (last 30 minutes)
journalctl -u denscare-api --since "30 min ago" | grep -i "error\|exception\|fail\|critical" | tail -100

# 2. Check for correlation ID patterns
journalctl -u denscare-api --since "30 min ago" | grep -oE "req_[a-z0-9]+" | sort | uniq -c | sort -rn | head -10

# 3. Check database health
psql $DATABASE_URL -c "SELECT pg_is_in_recovery();"
psql $DATABASE_URL -c "SELECT pg_database_size('$(echo $DATABASE_URL | sed 's/.*\///')')/1024/1024 as size_mb;"
```

### Financial Incident Investigation Flow

```
Incident Reported
    │
    ▼
1. Identify affected financial entity (invoice/payment/refund)
    │
    ▼
2. Query entity by ID or number
    ├─ psql billing_invoices WHERE invoice_number = 'INV-XXXXX'
    └─ psql billing_refunds WHERE refund_number = 'RFD-XXXXX'
    │
    ▼
3. Query audit trail for the entity
    ├─ billing_audit_logs WHERE entity_id = '<id>'
    │
    ▼
4. Query sequence consumption log
    ├─ billing_sequence_consumption_logs WHERE document_id = '<id>'
    │
    ▼
5. Query application logs for transaction context
    ├─ journalctl | grep '<entity_id>'
    │
    ▼
6. Determine root cause
    ├─ State transition error → review state machine
    ├─ Financial constraint violation → review amounts
    └─ Infrastructure error → review database/infrastructure health
```

### Escalation Contacts

| Issue Type | Contact | Response Time |
|------------|---------|---------------|
| Database corruption | Database Administrator | 30 min |
| Financial data inconsistency | Financial Systems Lead | 1 hour |
| Application bug | Development Team | Next business day |
| Security incident | Security Officer | Immediate |

---

*See also: [deployment.md](deployment.md), [checklists.md](checklists.md)*
