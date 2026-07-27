# Billing Module — Operational Checklists

> **Module:** `app.modules.billing`
> **Sprint:** 10B.6 (Documentation & Operational Readiness)
> **Last updated:** July 25, 2026

---

## 1. Pre-Deployment Checklist

### Code & Configuration Review

- [ ] All integration tests pass: `pytest backend/tests/integration/billing/ -v`
- [ ] All unit tests pass: `pytest backend/tests/modules/billing/ -v`
- [ ] No pending migrations: `alembic current` matches `alembic heads`
- [ ] Environment variables validated:
  - [ ] `DATABASE_URL` points to correct target database
  - [ ] `JWT_SECRET` is set (min 32 characters)
  - [ ] `JWT_ALGORITHM` is one of: HS256, HS384, HS512
  - [ ] `ACCESS_TOKEN_EXPIRE_MINUTES` >= 1
- [ ] Connection pool settings reviewed for expected load
- [ ] Logging configuration reviewed (log levels, handlers)
- [ ] CORS configuration updated for production domains

### Database Readiness

- [ ] Database backup completed
- [ ] Database is accessible from application server
- [ ] Database user has schema modification permissions (for migrations)
- [ ] No long-running transactions on target database
- [ ] Sufficient disk space for migration (~50 MB minimum)
- [ ] Autovacuum is enabled and running

### Infrastructure

- [ ] Application server has network access to database
- [ ] Required ports open (API: 8000/tcp)
- [ ] Health check endpoint configured in load balancer
- [ ] Rate limiting configured at reverse proxy / API gateway
- [ ] Monitoring agent installed and configured
- [ ] Log aggregation destination configured

### Rollback Preparedness

- [ ] Alembic downgrade script tested on staging
- [ ] Database backup available for restore
- [ ] Previous application version available for rollback
- [ ] Rollback procedure documented and accessible

---

## 2. Deployment Execution Checklist

### Migration Phase

- [ ] Run `alembic upgrade head`
- [ ] Verify `alembic current` shows expected revision
- [ ] Verify billing tables created:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'billing_%'
ORDER BY table_name;
```

- [ ] Verify constraints created:

```sql
SELECT conname, contype FROM pg_constraint
WHERE conrelid IN (
    SELECT oid FROM pg_class WHERE relname LIKE 'billing_%'
)
ORDER BY conname;
```

- [ ] Verify indexes created:

```sql
SELECT indexname FROM pg_indexes WHERE tablename LIKE 'billing_%' ORDER BY indexname;
```

- [ ] Verify document sequence seed data:

```sql
SELECT document_type, current_value, next_value FROM billing_document_sequences ORDER BY document_type;
```

### Application Startup Phase

- [ ] Start application
- [ ] Verify application starts without errors
- [ ] Verify health endpoint: `GET /health` returns 200
- [ ] Verify billing endpoints return proper auth errors (401) without token

### Smoke Test Phase

- [ ] Smoke test: `GET /billing/summary` returns 200 with valid token
- [ ] Smoke test: `GET /billing/dashboard` returns 200 with valid token
- [ ] Check application logs for errors after startup
- [ ] Verify zero WARNING or ERROR logs on initial request

---

## 3. Post-Deployment Validation Checklist

### Functional Validation

- [ ] Authentication works on all billing endpoints (401 for unauthenticated)
- [ ] Authorization works (403 for insufficient role)
- [ ] Invoice creation returns 201
- [ ] Invoice listing returns 200
- [ ] Invoice status transitions work (issue, cancel)
- [ ] Payment creation returns 201
- [ ] Payment completion works
- [ ] Payment allocation to invoice works
- [ ] Receipt generation works
- [ ] Refund lifecycle works (create → approve → complete)
- [ ] Credit note lifecycle works (create → issue → apply)
- [ ] Dashboard returns aggregated totals
- [ ] Pagination works on list endpoints
- [ ] Search filtering works (by status, date range, patient)
- [ ] Sorting works on list endpoints

### Error Handling Validation

- [ ] 404 returns proper error response for non-existent resources
- [ ] 409 returns proper error response for invalid state transitions
- [ ] 422 returns proper error response for validation failures
- [ ] 401 returns proper error response for missing/invalid tokens
- [ ] 403 returns proper error response for insufficient permissions

### Audit Trail Validation

- [ ] Invoice creation creates audit log entry
- [ ] Payment allocation creates audit log entry
- [ ] Refund workflow creates audit log entries
- [ ] Credit note workflow creates audit log entries
- [ ] Sequence consumption log entries are created

---

## 4. Database Validation Checklist

### Schema Validation

```sql
-- 1. Verify all billing tables exist (expected: 12)
SELECT COUNT(*) as billing_table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'billing_%';
-- Expected: 12

-- 2. Verify primary key constraints
SELECT conname, contype, relname
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname LIKE 'billing_%' AND contype = 'p'
ORDER BY rel.relname;
-- Expected: Each billing table has exactly 1 primary key

-- 3. Verify foreign key constraints
SELECT conname, contype, relname
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname LIKE 'billing_%' AND contype = 'f'
ORDER BY rel.relname;

-- 4. Verify check constraints
SELECT conname, contype, relname
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname LIKE 'billing_%' AND contype = 'c'
ORDER BY rel.relname;

-- 5. Verify unique constraints
SELECT conname, contype, relname
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname LIKE 'billing_%' AND contype = 'u'
ORDER BY rel.relname;

-- 6. Verify indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename LIKE 'billing_%'
ORDER BY tablename, indexname;
```

### Data Integrity Validation

```sql
-- 1. Verify no orphaned invoice items
SELECT COUNT(*) as orphaned_items
FROM billing_invoice_items i
LEFT JOIN billing_invoices inv ON inv.id = i.invoice_id
WHERE inv.id IS NULL;
-- Expected: 0

-- 2. Verify no orphaned allocations
SELECT COUNT(*) as orphaned_allocations
FROM billing_payment_allocations pa
LEFT JOIN billing_payments p ON p.id = pa.payment_id
LEFT JOIN billing_invoices i ON i.id = pa.invoice_id
WHERE p.id IS NULL OR i.id IS NULL;
-- Expected: 0

-- 3. Verify allocation totals don't exceed invoice totals
SELECT pa.invoice_id, i.invoice_number,
       COALESCE(SUM(pa.allocated_amount), 0) as total_allocated,
       COALESCE(SUM(li.net_amount), 0) as invoice_total
FROM billing_payment_allocations pa
JOIN billing_invoices i ON i.id = pa.invoice_id
JOIN billing_invoice_items li ON li.invoice_id = i.id
WHERE pa.is_refund = FALSE
GROUP BY pa.invoice_id, i.invoice_number
HAVING COALESCE(SUM(pa.allocated_amount), 0) > COALESCE(SUM(li.net_amount), 0);
-- Expected: 0 rows

-- 4. Verify refund totals don't exceed payment totals
SELECT r.payment_id, p.payment_number,
       COALESCE(SUM(r.amount), 0) as total_refunded,
       p.total_amount
FROM billing_refunds r
JOIN billing_payments p ON p.id = r.payment_id
WHERE r.status = 'COMPLETED'
GROUP BY r.payment_id, p.payment_number, p.total_amount
HAVING COALESCE(SUM(r.amount), 0) > p.total_amount;
-- Expected: 0 rows
```

---

## 5. Financial Validation Checklist

- [ ] Invoice grand total = sum of line item net amounts
- [ ] Payment allocation totals ≤ payment total amount
- [ ] Invoice paid amount = sum of allocations (non-refund)
- [ ] Invoice outstanding balance = grand total - paid amount
- [ ] Refund totals per payment ≤ original payment amount
- [ ] No invoice has more paid than grand total
- [ ] No payment has more allocated than total amount
- [ ] All audit log entries have non-null `changed_by`
- [ ] All sequence consumption logs in terminal status (COMPLETED or FAILED)
- [ ] No PENDING sequence consumption logs remain (should be cleaned up)

---

## 6. Release Validation Checklist

### Before Release

- [ ] Architecture review passed
- [ ] Performance audit approved (Sprint 10B.1)
- [ ] Concurrency audit approved (Sprint 10B.2)
- [ ] PostgreSQL production readiness approved (Sprint 10B.3)
- [ ] Logging & observability approved (Sprint 10B.4)
- [ ] Security & compliance approved (Sprint 10B.5)
- [ ] Documentation approved (Sprint 10B.6)
- [ ] All integration tests passed
- [ ] All service-layer unit tests passed
- [ ] Migration tested on staging environment
- [ ] Rollback tested on staging environment
- [ ] Pre-deployment checklist completed

### During Release

- [ ] Deployment checklist completed
- [ ] Smoke tests passed
- [ ] Post-deployment validation completed
- [ ] Database validation passed
- [ ] Financial validation passed
- [ ] Monitoring confirms no error spikes

### After Release

- [ ] Monitor errors for 1 hour post-deployment
- [ ] Verify audit logs being generated
- [ ] Verify document sequence counters incrementing
- [ ] Check database connection pool utilization
- [ ] Document any issues discovered

---

## 7. Rollback Readiness Checklist

- [ ] Previous application version artifact available
- [ ] Alembic downgrade command verified: `alembic downgrade -1`
- [ ] Database backup available and verified restorable
- [ ] Rollback runbook accessible
- [ ] Communication plan ready (who to notify)
- [ ] Expected rollback time estimated (< 15 minutes for migration)
- [ ] Data loss assessment documented (schema rollback is non-destructive to data)

---

*See also: [deployment.md](deployment.md), [runbooks.md](runbooks.md)*
