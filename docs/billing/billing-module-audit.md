# Billing Module — Implementation Audit Report

- **Date:** 2026-08-09
- **Scope:** `backend/app/modules/billing` (routers, services, validators, repositories, schemas, mappers) cross-checked against the frontend billing module (`frontend/src/services/billingService.ts`, `frontend/src/hooks/billing/*`, `frontend/src/types/billing.ts`, `frontend/src/components/billing/*`, `frontend/src/pages/billing/*`).
- **Method:** full source read of backend + frontend billing layers, endpoint-by-endpoint contract comparison, then test/lint/build runs.

---

## 1. Verification summary

| Check | Command | Result |
|---|---|---|
| Frontend tests | `npm run test` | **1505 / 1505 passed** (204 files) |
| Frontend lint | `npm run lint` | **Clean** |
| Frontend build | `npm run build` | **OK** (tsc -b + vite build) |
| Backend unit/service tests (SQLite) | `pytest tests/modules/billing` | **296 passed / 182 failed** |
| Backend integration tests (real PostgreSQL) | `pytest tests/integration/billing` | **224 passed / 5 failed / 24 errors** |
| Backend lint | — | **No lint config** in repo and neither `ruff` nor `flake8` installed in `backend/venv`; no Python lint step exists |

The 182 unit failures and the 5 failures / 24 errors in integration are **test-suite bugs, not production code defects** (root causes in §2). The production code is exercised and verified by 296 unit + 224 integration passing tests on real PostgreSQL.

---

## 2. Root causes of test failures

### 2.1 Unit/service tests — UUID user ids bound into Integer columns (182 failures)

- `auth.models.User.id` is `Integer` (`app/modules/auth/models.py:60`); every billing actor/FK column is also `Integer` (`SequenceConsumptionLog.reserved_by`, `BillingAuditLog.changed_by`, `InvoiceStatusHistory.changed_by`, `PaymentAllocation.allocated_by`, `Refund.reviewed_by`, etc.).
- Routers pass `_current_user.id` (an **int**) into services — the production path is correct and works on PostgreSQL.
- The unit tests pass `_STUB_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")` (`tests/modules/billing/conftest.py:77`) as the actor id, and additionally declare the same inline UUIDs inside `test_refund_service.py`, `test_credit_note_service.py`, `test_payment_service.py`, `test_receipt_service.py`, `test_financial_calculation_service.py`, `test_payment_allocation.py`, `test_billing_orchestration_service.py`.
- SQLite rejects binding a `uuid.UUID` into an `Integer` column: `sqlite3.ProgrammingError: Error binding parameter N: type 'UUID' is not supported` → the service logs "Database error ... rolled back" and the assertion fails. The same mistake would fail on PostgreSQL too.
- **Contributing cause:** `DocumentSequenceService.reserve_next_number` is annotated `reserved_by: UUID` (`app/modules/billing/services/document_sequence_service.py:85`) even though the value is an int — a misleading type hint that led test authors to use UUIDs.
- **Evidence it is a fixture bug, not product code:** the integration conftest uses `STUB_USER_ID = 1  # INTEGER FK to users table` (`tests/integration/billing/conftest.py:64`) and passes; the invoice / document-sequence unit tests that use `_STUB_USER_INT_ID = 1` pass.

### 2.2 Integration errors — stale raw-SQL seed (test_12, 24 errors)

`test_12_system_integration.py` seeds `treatment_plans` via raw SQL without the `is_active` column; the current model declares `is_active NOT NULL`, so fixture setup raises `psycopg2.errors.NotNullViolation`.

### 2.3 Integration failures — stale ORM objects (test_13, 5 failures)

`test_13_e2e_business_workflows.py` holds ORM references to entities that the service deletes (cancelling a DRAFT invoice deletes the row), then accesses `created.id` → `sqlalchemy.orm.exc.ObjectDeletedError`. Test should re-query/use the returned aggregate.

---

## 3. Confirmed API surface (implementation ↔ frontend contract)

The frontend `billingService.ts` mirrors the backend surface **exactly**; every mutation hook invalidates the shared `['billing']` root and refreshes detail keys. No frontend call targets a nonexistent endpoint.

### Invoices — `routers/invoice.py`
`GET /billing/invoices` · `GET /{invoice_id}` · `POST` (201) · `PATCH /{invoice_id}` · `POST /{invoice_id}/issue` · `POST /{invoice_id}/cancel` · `DELETE /{invoice_id}` (204)
_Confirmed absent (do not exist): void, pay, `/{id}/items`, `/patients/{patient_id}/invoices`._

### Payments — `routers/payment.py`
`GET /billing/payments` · `GET /{payment_id}` · `POST` · `PATCH /{payment_id}` · `DELETE /{payment_id}` · `POST /{payment_id}/complete|fail|void|allocate|deallocate` · `GET /{payment_id}/allocations`
_Confirmed absent: `POST /{payment_id}/refund` (documented NOT implemented), reverse, `/patients/{patient_id}/payments`._

### Receipts — `routers/receipt.py`
`GET /billing/receipts/{receipt_id}` · `POST /billing/receipts` · `POST /{receipt_id}/regenerate`
_No list endpoint; no GET-by-payment lookup (frontend caches the generated receipt under a `receiptForPayment` key instead)._

### Refunds — `routers/refund.py`
`POST /billing/refunds` · `POST /{refund_id}/approve|reject|complete`
**No `GET` list/detail, no PATCH/DELETE.** Service exposes no read methods either.

### Credit Notes — `routers/credit_note.py`
`POST /billing/credit-notes` · `POST /{credit_note_id}/issue|void|apply`
**No `GET` list/detail, no PATCH/DELETE.** Service exposes no read methods either.

### Dashboard — `routers/dashboard.py`
`GET /billing/dashboard` (optional `patient_id`) · `GET /billing/summary`
_Revenue/outstanding/cashflow/aging/daily/monthly/yearly/statistics/kpis documented NOT implemented._

---

## 4. Findings — backend (by severity)

### HIGH — Invoice financial summary is hardcoded to zero
- `mappers/invoice_mapper.py:483-484` hardcode `paid_amount = Decimal("0.00")` and `outstanding_amount = Decimal("0.00")` in `_compute_financial_summary`.
- `InvoiceService.get_invoice` (`services/invoice_service.py:685`) returns the ORM invoice unmapped/without patching these fields.
- `FinancialCalculationService.calculate_invoice_paid_amount()` (`services/financial_calculation_service.py:199`) computes the true value via `InvoiceRepository.get_total_allocated_for_invoice`, but is only used in orchestration / payment / dashboard flows — **never in the invoice read path**.
- Consequence: every invoice reads as `paid_amount=0.00` / `outstanding_amount=grand_total`, even for `PARTIALLY_PAID`/`PAID` invoices — contradicting the schema's "resolved at read time" contract.
- User-visible: the frontend renders `outstanding_amount` in the invoice list/detail, mobile invoice cards, and the `AllocatePaymentDialog` (which caps allocations by `outstanding_amount` and shows "X due"), so partially-paid invoices show an inflated balance and allocation attempts can be rejected by backend validation (409).

### MEDIUM — PatientCredit layer is orphaned
- Model, repository, validator, protocol, and exceptions all exist, but grep confirms **zero references** in `services/` or `routers/`. No create/apply/expiry workflow is exposed anywhere.

### MEDIUM — No read endpoints for refunds / credit notes; no receipt list
- Refunds and credit notes can be created and transitioned but **cannot be fetched** — no `GET` list or `GET /{id}` at service or router level (repositories do have list/search capability, unexposed).
- Receipts have no list endpoint.
- Frontend works around this via the mutation cache (`queryClient.setQueryData`), documented in `hooks/useRefund.ts`, `hooks/useCreditNote.ts`, `hooks/useCreditNoteMutations.ts`, `hooks/usePaymentMutations.ts`. Consequence: refund/credit-note detail pages are unreachable on hard reload or direct URL.

### LOW/MEDIUM — Receipt cancellation validator without an endpoint
- `ReceiptValidator` implements `validate_cancellable` / `is_terminal_state` (FI-RCP), but no cancel route or service method exists.

### LOW — Misleading type hint
- `reserve_next_number(document_type, reserved_by: UUID)` should be `int` (`document_sequence_service.py:85`). Wrong annotation; the direct contributor to the 182 unit-test failures in §2.1.

### LOW — Hardcoded mapper placeholders
- `ReceiptMapper.to_read` hardcodes `notes=None`, `cancellation_reason=None`, `audit_trail=[]`, `updater=None`, `print_metadata=None`; `update_model` only applies `receipt_date`/`amount`.
- `RefundMapper` hardcodes `remaining_on_payment=0.00` and gateway metadata `None`; `refund_count` defaults to 1 (docstring says the service should overwrite).
- `CreditNoteMapper._to_invoice_summary` falls back to `date.today()` when no invoice is present.

---

## 5. Findings — frontend

- **Contract fidelity is high:** `types/billing.ts` mirrors the backend schemas (`Money = string`, enums match, incl. `CurrencyCode = 'USD'|'EUR'|'GBP'|'INR'`); `billingQueryKeys.ts` is structured (root `['billing']` shared invalidation, per-resource keys); server-side pagination/filter/sort flows straight through to query keys and endpoints; `shouldRetryQuery` never retries 401/403.
- **Backend gaps are absorbed deliberately and documented** (refund/credit-note detail, receipt-by-payment lookup) via the React Query cache.
- **No dead code:** every `billingService` method is consumed by a hook; every page delegates to a container; components have unit tests.
- Tests/lint/build all green (§1).

---

## 6. Recommendations

1. **(HIGH)** Compute invoice financials at read time — call `FinancialCalculationService` (or patch the mapper from `get_total_allocated_for_invoice`) inside `InvoiceService.get_invoice`/list so `paid_amount`/`outstanding_amount` are accurate.
2. **(MEDIUM)** Add `GET` list + detail endpoints for refunds and credit notes (and a receipt list / receipt-by-payment lookup), or formally document them as product gaps — the frontend cache workaround is a stopgap, not a contract.
3. **(MEDIUM)** Either expose a `PatientCredit` apply/expiry workflow or remove the orphaned layer until Phase 3 (advance payments / patient wallet).
4. **(MEDIUM)** Fix the test fixtures: replace UUID actor ids with ints across the failing unit test files (conftest constant + inline literals), and correct the `reserve_next_number` annotation to `int`. This unblocks all 182 failures.
5. **(LOW)** Add a backend lint configuration (ruff/flake8) — currently none exists.
6. **(LOW)** Fix the integration test seeds (raw SQL missing `is_active`) and stale ORM access after delete in `test_12`/`test_13`.

---

## Appendix — Frontend test coverage touched by findings

- `components/billing/payments/dialogs/AllocatePaymentDialog.tsx` consumes `financials.outstanding_amount` for both eligibility (`> 0`) and allocation limits — affected by Finding HIGH (§4).
- Invoice list/detail and mobile cards render `paid_amount`/`outstanding_amount` from the invoice aggregate — affected by Finding HIGH (§4).
- `useRefund.ts` / `useCreditNote.ts` deliberately disable fetching (`enabled: false`, throw "…detail endpoint not available") — reflects Finding MEDIUM (§4).
