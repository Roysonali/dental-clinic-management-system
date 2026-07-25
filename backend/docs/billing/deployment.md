# Billing Module — Deployment Guide

> **Module:** `app.modules.billing`
> **Sprint:** 10B.6 (Documentation & Operational Readiness)
> **Last updated:** July 25, 2026

---

## 1. Prerequisites

### Infrastructure Requirements

| Requirement | Specification |
|-------------|---------------|
| Python | >= 3.11 |
| PostgreSQL | >= 14 (tested with 14, 15, 16) |
| Alembic | >= 1.13 |
| FastAPI | >= 0.110 |
| SQLAlchemy | >= 2.0 |
| Disk (migrations) | ~50 MB |
| Database storage | Variable; estimate ~2 KB per invoice + line items |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/denscare`) |
| `JWT_SECRET` | ✅ | — | HMAC key for JWT signing (min 32 characters, HS256 recommended) |
| `JWT_ALGORITHM` | ❌ | `HS256` | Allowed: `HS256`, `HS384`, `HS512` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ❌ | `30` | JWT token expiry in minutes |

**Validation:** The `Settings.__init__()` class validates all required variables at startup. If any are missing or invalid, the application fails immediately with a descriptive error.

---

## 2. Database Migration

### Initial Deployment

```bash
# 1. Run all pending migrations
alembic upgrade head

# 2. Verify migration state
alembic current

# 3. Verify billing tables exist
psql $DATABASE_URL -c "\dt billing_*"
```

### Expected Tables

After migration, the following billing tables should exist:

| Table | Type | Purpose |
|-------|------|---------|
| `billing_invoices` | Core | Invoice aggregate root |
| `billing_invoice_items` | Core | Invoice line items |
| `billing_payments` | Core | Payment records |
| `billing_payment_allocations` | Core | Payment-to-invoice allocations |
| `billing_refunds` | Core | Refund records |
| `billing_receipts` | Core | Receipt records |
| `billing_receipt_invoices` | Junction | Receipt-invoice association |
| `billing_credit_notes` | Core | Credit note records |
| `billing_document_sequences` | Infrastructure | Sequential document numbering |
| `billing_sequence_consumption_logs` | Infrastructure | Number reservation audit |
| `billing_patient_credits` | Future | Patient wallet credit tracking |
| `billing_audit_logs` | Infrastructure | Financial audit trail |

### Migration Validation (Post-Deployment)

```sql
-- Verify table count (expected: 12 billing tables)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'billing_%';

-- Verify constraints
SELECT conname, contype, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname LIKE 'billing_%'
ORDER BY rel.relname, conname;

-- Verify indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename LIKE 'billing_%'
ORDER BY tablename, indexname;

-- Verify document sequences seed data
SELECT document_type, current_value, next_value
FROM billing_document_sequences
ORDER BY document_type;
```

---

## 3. Rollback Procedure

### Migration Rollback

```bash
# Rollback the billing migration
alembic downgrade -1

# Or rollback to a specific revision
alembic downgrade <previous_revision_id>

# Verify rollback
alembic current
```

### Data Rollback Considerations

1. **Financial data is durable** — once committed, invoice/payment/refund records are preserved
2. **Document sequences** — rolling back a migration does NOT rewind consumed document numbers. After restore, manually verify `billing_document_sequences.current_value` is not ahead of actual document counts:
   ```sql
   -- Check for gaps/desync
   SELECT 'invoice' as doc_type, COUNT(*) as count FROM billing_invoices
   UNION ALL
   SELECT 'payment', COUNT(*) FROM billing_payments
   UNION ALL
   SELECT 'receipt', COUNT(*) FROM billing_receipts;
   ```
3. **Point-in-time recovery** — if using PITR, verify `billing_document_sequences` values are consistent with restored data

---

## 4. Production Configuration

### Connection Pool

Configure via `DATABASE_URL` query parameters:

```python
# Recommended production pool settings (configured in app/database/session.py)
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,          # Base pool size
    max_overflow=20,       # Max additional connections beyond pool_size
    pool_timeout=30,       # Seconds to wait for a connection from pool
    pool_recycle=1800,     # Recycle connections after 30 minutes
    pool_pre_ping=True,    # Verify connection before using (enabled by default)
)
```

**Guidelines:**
| Deployment Size | pool_size | max_overflow | Notes |
|----------------|-----------|--------------|-------|
| Small (1-2 clinics) | 5 | 10 | Default |
| Medium (3-10 clinics) | 10 | 20 | 30 concurrent API workers |
| Large (10+ clinics) | 20 | 30 | 50+ concurrent API workers |

### Logging Configuration

```python
# Recommended logging configuration (configured in app/core/logging.py)
LOGGING = {
    "version": 1,
    "formatters": {
        "structured": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
        },
    },
    "loggers": {
        "app.modules.billing": {
            "handlers": ["console"],
            "level": "INFO",        # Use DEBUG for troubleshooting
            "propagate": False,
        },
        "sqlalchemy.engine": {
            "handlers": ["console"],
            "level": "WARNING",     # Set to INFO to see SQL queries (dev only)
            "propagate": False,
        },
    },
}
```

### API Server

```bash
# Production startup with Uvicorn
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --limit-concurrency 100 \
    --timeout-keep-alive 30 \
    --log-config logging.json

# Or with Gunicorn
gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --keep-alive 30
```

---

## 5. Startup Order

```
1. PostgreSQL database (must be healthy)
2. Run alembic migrations
3. Verify document sequence seed data exists
4. Start FastAPI application
5. Verify health endpoints respond
6. Run smoke tests
```

---

## 6. Environment-Specific Configuration Guide

### Development

```bash
DATABASE_URL=postgresql://dev:dev@localhost:5432/denscare_dev
JWT_SECRET=dev-secret-key-at-least-32-chars-long!!
```

### Staging

```bash
DATABASE_URL=postgresql://staging:password@staging-db:5432/denscare_staging
JWT_SECRET=<staging-specific-32-char-min-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Production

```bash
DATABASE_URL=postgresql://prod:password@prod-db:5432/denscare_prod?sslmode=require
JWT_SECRET=<production-secret-from-vault>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## 7. Migration Execution Best Practices

### Before Migration

- [ ] Take a database snapshot or backup
- [ ] Run migration on a read replica first (if available)
- [ ] Verify no long-running transactions
- [ ] Check current alembic state: `alembic current`

### During Migration

- Migrations use **transactional DDL** where possible
- Each migration is a single transaction
- If a migration fails mid-way, alembic rolls back the transaction
- Never manually edit migration versions

### After Migration

- [ ] Run migration validation SQL (Section 2)
- [ ] Verify health endpoint returns 200
- [ ] Run smoke tests against billing endpoints
- [ ] Verify document sequence counters initialized
- [ ] Check application logs for errors

---

## 8. Known Deployment Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration timeout on large tables | Deployment failure | Run during maintenance window; test migration on staging first |
| Document sequence desync after restore | Duplicate document numbers | Verify and reset sequences after PITR (see runbooks) |
| Connection pool exhaustion under load | API 503 errors | Configure pool_size per Section 4 guidance |
| Auth user ID type mismatch (int vs UUID) | Write endpoints fail | Acknowledged limitation — see known-limitations.md |

---

*See also: [runbooks.md](runbooks.md), [checklists.md](checklists.md)*
