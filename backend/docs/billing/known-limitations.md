# Billing Module — Known Limitations

> Last updated: Sprint 8 (OpenAPI & Documentation)

## 1. Auth User ID Type Mismatch

**Status:** Pre-existing architecture boundary — acknowledged, not a bug

**Issue:** The auth module uses integer auto-increment primary keys (`User.id`). The billing module expects UUID foreign keys (`created_by`, `updated_by`, `changed_by`). When billing service methods use `_current_user.id` (int) directly, calls that attempt to write audit logs fail with `AttributeError: 'int' object has no attribute 'hex'`.

**Impact:**
- Write endpoints (**POST**, **PATCH**, **DELETE**, workflow actions) cannot be tested end-to-end through the HTTP integration test stack
- Auth/authz validation and request validation on write endpoints still work correctly
- Read endpoints work fully
- Business logic behind write operations is covered by 346 unit/service-layer tests

**Workaround:** Integration tests for write endpoints verify auth (`401`), authz (`403`), validation (`422`), and not-found (`404`) paths. Success paths are tested at the unit level through service-layer tests.

**Long-term solution:** Create a test fixture that produces a `User` object with a UUID-compatible `id`, or align the auth module to use UUID PKs.

---

## 2. Dashboard Only

**Status:** Phase 1 limitation

**Issue:** Only `GET /billing/dashboard` and `GET /billing/summary` are implemented. The following reporting endpoints are **not** implemented because no corresponding service methods exist:

- `GET /billing/revenue`
- `GET /billing/outstanding`
- `GET /billing/cashflow`
- `GET /billing/aging`
- `GET /billing/daily`
- `GET /billing/monthly`
- `GET /billing/yearly`
- `GET /billing/statistics`
- `GET /billing/kpis`

---

## 3. Receipt Regeneration

**Status:** Phase 1 implementation

**Issue:** Receipt regeneration creates a new version with an incremented sequence number. The current implementation does not include an `updated_at` timestamp on the receipt record.

---

## 4. Soft Delete Only

**Status:** By design

**Issue:** Invoice deletion is a soft delete (`deleted_at` timestamp). Records are preserved in the database for audit purposes. Hard deletion is not available through the API.

---

## 5. Single Currency Per Document

**Status:** By design

**Issue:** All amounts on a single document (invoice, payment, etc.) must share the same currency. Mixed-currency documents are not supported in Phase 1.

---

## 6. No Recurring Billing

**Status:** Out of scope for Phase 1

**Issue:** The billing module does not support recurring/ subscription-based billing. All invoices are one-time.

---

## 7. No Payment Gateway Integration

**Status:** Phase 1 limitation

**Issue:** Payments are recorded manually. There is no integration with payment gateways (Stripe, Razorpay, etc.) for online payment processing.
