# Billing Module — Complete Remediation Report

> **Task:** DensCare Billing Module remediation after the independent production audit
> (`Billing-Complete-Independent-Production-Review.md`).
> **Method:** Every audit finding was **verified against the actual source code and tests**
> before any change (the task explicitly forbade trusting the audit unverified). The audit
> document itself is not present in the current working tree, so all findings below were
> reproduced/refuted directly from `backend/app/modules/billing/`, `backend/tests/*` and
> `frontend/src/*`.
> **Status:** ✅ Remediation complete — all suites green (see §12).

---

## 1. Findings verified (Phase 1)

| # | Audit finding | Verdict | Evidence / outcome |
|---|---|---|---|
| 1 | Invoice financial summary defect (`paid_amount`/`outstanding_amount` hardcoded `0.00` in mapper) | **CONFIRMED — P0** | `InvoiceMapper._compute_financial_summary()` emitted `Decimal("0.00")` for both fields; correct computation existed in `FinancialCalculationService` but was never attached. **Fixed** (see §5). |
| 2 | Unit test UUID/int actor fixture defect | **CONFIRMED** | `test_refund_service.py` / `test_credit_note_service.py` used `UUID("00000000-…")` for actor FKs (`created_by`, `approved_by`, …) against INTEGER `users.id`. **Fixed** (§6). |
| 3 | Integration test seed defect (`is_active` missing) | **CONFIRMED** | `test_12_system_integration.py` raw-SQL `treatment_plans` seed lacked `is_active` (NOT NULL) and used status `approved` (invalid for `ck_tp_status`); the `patient_record_diagnoses` seed used stale columns. **Fixed** — the **fixture** was corrected, the DB constraint was NOT weakened (§6). |
| 4 | Integration stale ORM object defect | **CONFIRMED** | WF-007 in `test_13` retained an expired ORM instance across service exception-path rollbacks. **Fixed** by restructuring the test (fresh invoice per terminal-state check); production deletion/rollback semantics untouched (§6). |
| 5 | `DocumentSequenceService.reserved_by: UUID` annotation | **CONFIRMED** | `reserved_by` is an INTEGER FK to `users.id`; annotation said `UUID`. **Fixed** to `int` (all related annotations inspected) (§5). |
| 6 | Receipt/Refund/CreditNote mapper placeholders | **VERIFIED — categorized, NOT changed** | `ReceiptMapper`: model has no `updater`/`notes`/`cancellation_reason`/`print_metadata` columns → **A: legitimately unavailable by design** (+D future scope). `RefundMapper`: `remaining_on_payment=0.00`/`refund_count=1` — documented placeholder, **not user-facing** (no frontend component renders them; the UI derives balances from the authoritative payment aggregate) → **D: future-scope data**. `CreditNoteMapper`: `invoice_date=date.today()` fallback is unreachable in practice (`invoice_id` required + FK-validated) → **D: defensive**. No speculative data invented, no domain expansion (§7). |
| 7 | Missing Refund/CreditNote/Receipt read endpoints | **CONFIRMED absent** | No `GET /billing/refunds`, `GET /billing/credit-notes`, `GET /billing/receipts` (list) — explicitly documented as NOT implemented in the routers. **Deferred** per Phase 8 (product/API scope decision, §3). |
| 8 | PatientCredit orphan | **VERIFIED** | Model/repo/validator/protocol/exceptions exist; **no endpoints** and no migration introduces them into active flows → intentionally reserved future scope. **Kept intact**, documented (§3). |
| 9 | Currency consistency | **PARTIALLY CONFIRMED** | Frontend already presents all Billing amounts in INR via `PAYMENT_CURRENCY_CODE='INR'`. Two residual USD artifacts found: `Fixed amount ($)` discount label and `formatCurrency` default `'USD'`. **Fixed** (§8). Backend multi-currency support (USD/EUR/GBP/INR) untouched by design. |
| 10 | Existing frontend Billing implementation | **VERIFIED aligned** | Endpoints, payloads, enums, pagination, `'billing'` root invalidation all match the backend contract (§9). |
| 11 | Existing mobile Billing implementation | **VERIFIED preserved** | `MobileInvoiceList`/`MobilePaymentList`/`MobileCreateInvoiceForm` untouched; mobile regression tests green (§10). |
| 12 | Existing UI/UX behavior (incl. New Invoice flow) | **CONFIRMED issue + FIXED** | Dashboard → "New invoice" routed through the Invoice List (`?create=true`). Now opens the Create Invoice Drawer **directly on the dashboard** (§10). |

---

## 2. Findings fixed

1. **P0 — Invoice financial summary** (paid/outstanding) — full chain: bulk repo queries → service-layer calculation → attached to ORM aggregates → mapper reads values (never queries).
2. **Mutation responses** now also carry correct financials (`create`/`issue`/`cancel`/`update`), so e.g. cancel-from-partially-paid returns the real `paid_amount`/`outstanding_amount` instead of stale zeros (review follow-up).
3. **`DocumentSequenceService.reserved_by`** annotation `UUID → int`.
4. **Unit test fixtures** — UUID actor IDs → INTEGER stub user IDs in refund/credit-note tests + `routers/conftest.py`.
5. **Integration fixtures** — `test_12` seeds now match the current schema (treatment plan `is_active`, valid status `accepted`, patient-record + diagnosis seed shape, `invoice_line_items` table, current repo APIs); **test_13** stale-ORM + repo-API + session-leak fixes.
6. **Currency/INR** — `Fixed amount ($)` → `Fixed amount (₹)`; `formatCurrency` default `USD → INR` (docstring + tests updated).
7. **Dashboard New Invoice UX** — create drawer opens on the dashboard directly (header + empty-state CTAs); shared `useInvoiceCreateFlow` hook used by both the dashboard and the invoice list (no duplicated create logic).

---

## 3. Findings intentionally deferred (with reasons)

| Finding | Why deferred |
|---|---|
| Refund GET list/detail endpoints | **Product/API scope decision** (Phase 8). The frontend was deliberately built on the React Query mutation cache (documented, tested workaround). Implementing read APIs without an agreed contract would be inventing scope. **Documented limitation** (§11): refund/credit-note detail routes cannot survive a hard refresh/direct navigation because there is no GET endpoint to hydrate them. |
| Credit Note GET list/detail endpoints | Same as above — mutation-cache workaround; not implemented. |
| Receipt GET list endpoint | Same as above. Single receipt GET exists (`/billing/receipts/{id}`) and the receipt detail page survives refresh; only the **list** is absent (not surfaced in the UI). |
| PatientCredit wallet/advance-payment system | **Not implemented** (Phase 9): orphan layer is intentionally reserved future scope. Deleting it or building a wallet would violate the task's do-not-expand directive. |
| ReceiptMapper/RefundMapper/CreditNoteMapper placeholder values | Categorized as **A (unavailable by design)** / **D (future scope)** — see §1 #6. Fixing would require expanding the domain model or shipping read endpoints, both explicitly out of scope. `remaining_on_payment`/`refund_count` are not rendered anywhere in the frontend. |
| Backend lint tooling (ruff/flake8) | **No** `pyproject.toml`, `setup.cfg`, `.flake8`, `tox.ini`, and **no** ruff/flake8/black/mypy in `requirements.txt` — the backend has no lint strategy at all. This is a **project-level** quality-tooling decision, not a Billing-specific one; left untouched per Phase 10. |
| Tax / GST, insurance claims, online payment gateway, patient wallet, PDF/print | Backend features not implemented (Phase-2 placeholders / future scope per the audit). The frontend must not build them. |
| Invoice auto-status transition on payment | Backend never transitions `invoice.status` to `partially_paid`/`paid`/`overdue` over HTTP — payment reality lives in allocations/financials (audit O3). Correcting this would change the API contract; **documented as a backend limitation** (the financials are now correct regardless of the status column). |

---

## 4. Files changed

### Backend (production)
| File | Change |
|---|---|
| `app/modules/billing/repositories/invoice_repository.py` | Added bulk `get_grand_totals_for_invoices(ids)` and `get_allocation_totals_for_invoices(ids)` — single `IN`-clause queries (no N+1). |
| `app/modules/billing/services/financial_calculation_service.py` | Added `calculate_invoice_balance_totals(ids)` (bulk, two aggregate queries, merged per invoice) + `calculate_invoice_balance_summary(invoice)` (single). BR-63 formula: `outstanding = grand_total − paid + refunded`, floored at 0. |
| `app/modules/billing/services/invoice_service.py` | `_attach_financials()` helper (guarded by optional DI); attached in **list** and **detail** reads AND in **all four mutation returns** (`create`, `issue`, `cancel`, `update_draft`). |
| `app/modules/billing/mappers/invoice_mapper.py` | Reads transient `_billing_paid_amount` / `_billing_outstanding_amount` via `getattr(…, Decimal("0.00"))` fallback — the mapper never queries the database. |
| `app/modules/billing/dependencies.py` | Wired `FinancialCalculationService` into `InvoiceService` (prod DI), including the orchestration service construction. |
| `app/modules/billing/services/document_sequence_service.py` | `reserved_by: UUID → int`. |

### Backend (tests)
| File | Change |
|---|---|
| `tests/modules/billing/conftest.py` | `_STUB_USER_ID = 1` (INTEGER FK to `users`). |
| `tests/modules/billing/test_refund_service.py` | UUID actor literals → integer stubs. |
| `tests/modules/billing/test_credit_note_service.py` | UUID actor literals → integer stubs. |
| `tests/modules/billing/routers/conftest.py` | `STUB_USER_ID` UUID → int. |
| `tests/modules/billing/test_invoice_financial_summary.py` | **NEW** — 12 tests (see §5 scenarios). |
| `tests/integration/billing/test_12_system_integration.py` | Seeds match current schema (treatment plan `is_active` + status `accepted`, patient record + diagnosis shape, `invoice_line_items`), current repo APIs (`filter-based list`, payment `find_by_patient`), doctor-code collision, TestClient session-close override. |
| `tests/integration/billing/test_13_e2e_business_workflows.py` | `get_allocations_for_payment` → `pay_svc.get_allocations()`, audit-count expectation, WF-007 restructured (fresh invoice per terminal check — no stale ORM access), TestClient session-close override. |

### Frontend
| File | Change |
|---|---|
| `src/hooks/billing/useInvoiceCreateFlow.ts` | **NEW** — shared create-draft-invoice flow (mutation, error mapping, toast, post-save navigation). |
| `src/pages/billing/BillingDashboardPage.tsx` | Owns create-open state; renders `CreateInvoiceDrawer` (desktop) / `MobileCreateInvoiceForm` (mobile) + toast **on the dashboard**. |
| `src/components/billing/BillingDashboardHeader.tsx` | `onNewInvoice` prop — no longer navigates to the Invoice List. |
| `src/components/billing/BillingDashboardEmptyState.tsx` | `onNewInvoice` prop — opens the dashboard drawer directly. |
| `src/components/billing/containers/BillingDashboardContainer.tsx` | Optional `onRequestCreate` forwarded to the empty state. |
| `src/components/billing/invoices/containers/InvoiceListContainer.tsx` | Refactored to use `useInvoiceCreateFlow` (behavior identical; merged toast stack; intent-strip-before-navigate preserved). |
| `src/constants/billing.ts` | `Fixed amount ($)` → `Fixed amount (₹)`. |
| `src/utils/formatting.ts` | `formatCurrency` default `USD → INR` + docstring (INR is the Billing presentation currency). |
| `src/utils/formatting.test.ts` | Default-currency test updated to INR. |
| `src/components/billing/BillingDashboardHeader.test.tsx` | Updated to the new `onNewInvoice` contract (no navigation). |
| `src/components/billing/invoices/containers/InvoiceListContainer.test.tsx` | Removed obsolete dashboard→list handoff e2e test (behavior moved). |
| `src/pages/billing/BillingDashboardPage.test.tsx` | **NEW** — dashboard opens drawer directly; create + navigate flow. |

---

## 5. Backend changes / financial correctness

### The authoritative chain (single source of truth)
```
InvoiceRepository.get_allocation_totals_for_invoices(ids) ─┐
InvoiceRepository.get_grand_totals_for_invoices(ids) ──────┴→ FinancialCalculationService
                                                             .calculate_invoice_balance_totals(ids)
                                                                    │  (BR-63)
                                                            InvoiceService._attach_financials()
                                                                    │  (transient ORM attrs)
                                                            InvoiceMapper.to_read() / to_list_item()
                                                                    │  (read-only transfer)
                                                            GET /billing/invoices
                                                            GET /billing/invoices/{id}
                                                            mutation responses (create/issue/cancel/update)
```
- **No N+1:** the bulk method runs exactly two aggregate queries (bounded by the page's invoice IDs), then merges.
- **No DB in mapper:** the mapper only reads service-attached transient attributes (defensive `getattr` fallback to `0.00`).
- **Backend remains authoritative:** `PaymentValidator`/`PaymentService.allocate_payment` still enforce the outstanding check (`PaymentExceedsInvoice`, BR-63) — the UI boundary is informational, never relied upon for financial safety.

### Scenarios covered by `test_invoice_financial_summary.py` (12 tests)
1. Draft invoice → `paid=0`, `outstanding=grand_total`
2. Issued invoice with no payment → `paid=0`, `outstanding=grand_total`
3. Partially paid (1500 total, 1340 allocated) → `paid=1340`, `outstanding=160`
4. Fully paid → `outstanding=0`
5. Multiple allocations accumulate
6. Payment deallocation restores outstanding
7. Refund allocation affects outstanding
8. Zero balance after full payment
9. Allocating more than outstanding **rejected** by the service (`PaymentExceedsInvoice`)
10. Exact-outstanding allocation allowed
11. `issue_invoice` **response** carries real financials (no stale zeros)
12. `cancel_invoice` from an invoice with 500 allocated returns `paid=500`, `outstanding=1000`

### Phase 3 chain verification
Invoice ₹1,500 / allocated ₹1,340 / outstanding ₹160: the invoice API returns `outstanding_amount=160.00`; `AllocatePaymentDialog` renders "₹160.00 due" and clamps its max at 160.00; the backend independently rejects ₹160.01+ with `PaymentExceedsInvoice` (integration-tested). UI and backend agree; backend is authoritative.

---

## 6. Test fixture fixes

- **UUID → INTEGER actor IDs:** `test_refund_service.py`, `test_credit_note_service.py`, `routers/conftest.py`, and the unit `conftest.py` now use INTEGER stub user IDs matching production `users.id`. Legitimate UUID document IDs (`invoice_id`, `payment_id`, `refund_id`, …) were **left as UUIDs** — only actor/FK columns that are INTEGER were corrected. A sweep of `UUID(`/`uuid.UUID` across `tests/modules/billing` confirmed no incorrect actor UUIDs remain.
- **`test_12` seeds** now match the current schema: `is_active` added to the `treatment_plans` seed (NOT NULL constraint **kept**), status `approved → accepted` (valid `ck_tp_status` value), diagnosis seed rewritten (patient record first, correct columns), `invoice_items → invoice_line_items`, and stale repository API calls replaced (filter-based list, payment `find_by_patient`). A doctor-code conflict with integration-conftest seeds was also resolved.
- **`test_13`:** stale ORM access eliminated (WF-007 restructured — fresh invoice per terminal-state check, because the fixture's external-transaction model means service exception-path rollbacks wipe prior test data; production semantics untouched); `get_allocations_for_payment` → `pay_svc.get_allocations()`; invoice audit-count expectation corrected; TestClient `get_db` overrides now close sessions (the leak blocked `drop_all` session teardown).

---

## 7. Mapper audit outcome (receipt / refund / credit note)

- **ReceiptMapper** (`updater=None`, `notes=None`, `cancellation_reason=None`, `print_metadata=None`, `audit_trail=[]`): the Receipt model has **no such columns** — these are schema-defined future-scope fields. **A: legitimately unavailable by design.** No change.
- **RefundMapper** (`remaining_on_payment=0.00`, `refund_count=1`): documented placeholder ("service layer should overwrite"), but there are no refund read endpoints and **no frontend component renders these fields** — the UI computes balances from the authoritative payment aggregate (`total_amount`, `financials.refunded_amount`). **D: future-scope data.** No change (no contract requires it).
- **CreditNoteMapper** (`invoice_date=date.today()` fallback): unreachable in practice — `invoice_id` is required and FK-validated, so `invoice is None` never occurs in a read. **D: defensive fallback.** No change.
- **InvoiceMapper**: fixed (P0) — see §5.

No data was invented; the domain model was not expanded.

---

## 8. Currency / INR verification

- Frontend Billing presentation currency: `PAYMENT_CURRENCY_CODE = 'INR'` (₹) — used by every dashboard/invoice/payment/refund/credit-note/receipt surface via the shared `formatCurrency`.
- **Fixed:** `Fixed amount ($)` discount label → `Fixed amount (₹)`.
- **Fixed:** `formatCurrency` default `'USD' → 'INR'` (no caller relied on the old default — a codebase sweep confirmed every call site passes an explicit code; the change is behavior-neutral and removes the last USD default from Billing utilities).
- Verified clean: KPI grid, recent invoices/payments, patient financial summary, invoice list/detail/line items/dialogs, payment list/detail/dialogs, refund/credit-note/receipt surfaces, mobile cards, empty states, helper texts, and tests (`RecordPaymentDrawer.test.tsx` explicitly asserts **no** `$`/`USD`; `MobilePaymentCard`/`MobileInvoiceCard` tests assert no `$`).
- Backend Decimal precision untouched; backend multi-currency support (USD/EUR/GBP/INR, `CurrencyCode` enum) intentionally preserved — the Invoice create form still defaults to INR (`defaultCreateInvoiceValues` → `currency_code=INR`).

---

## 9. Frontend contract verification

- `billingService.ts` / `hooks/billing/*` / `types/billing.ts` / `components/billing/*` / `pages/billing/*` were cross-checked against the backend contract: endpoint URLs, payloads, response mapping, enums, Decimal/Money string handling, pagination/filter/sort params, error handling, and React Query invalidation all aligned. Mutations invalidate the `'billing'` root (`billingQueryKeys.all`) — no duplicate API requests introduced.
- The new `useInvoiceCreateFlow` keeps the create contract identical across both entry points (dashboard + invoice list).

---

## 10. UI/UX fixes and regression status

- **New Invoice flow (fixed):** Billing Dashboard → **Create Invoice Drawer directly** (header + empty-state CTAs). The user is no longer forced through Invoice List → New Invoice → Create Drawer. The invoice list's URL create-intent support (`?create=true`, deep-link/back-nav) is **retained** and still tested.
- Desktop layout, drawers/dialogs, tables, loading/empty/error/disabled/permission states: unchanged and green (existing test suites).
- Mobile UX preserved: `MobileInvoiceList`, `MobilePaymentList`, `MobileCreateInvoiceForm`, bottom nav untouched; the dashboard reuses `MobileCreateInvoiceForm` on the phone breakpoint (consistent with the Invoice List mobile pattern).
- Horizontal-overflow regression guard test (`w-full min-w-0`) still passes.

---

## 11. Remaining known limitations

1. **Refund / Credit Note detail routes depend on the React Query mutation cache** — no GET list/detail endpoints exist for refunds or credit notes; a hard refresh or direct navigation to those routes cannot hydrate the data. This is the documented Phase 8 production-readiness concern and requires a product/API decision (implement read endpoints) to close.
2. **Invoice status column is not auto-synced with payments** (audit O3): `partially_paid`/`paid`/`overdue` are never set by the API; the **financials are correct** (this remediation), but status-driven filters/views reflect the backend's documented behavior.
3. **No backend lint tooling** — project-level improvement recommended (ruff or flake8 + mypy), not addressed here by design.
4. **Backend currency default is USD** in schemas, but the frontend always sends INR explicitly and presents INR; backend multi-currency remains intentional.

---

## 12. Test & build results

| Suite | Result |
|---|---|
| Backend — `pytest tests/modules/billing` | ✅ **490 passed** (was 478 + 12 new financial-correctness tests; no failures) |
| Backend — `pytest tests/integration/billing` | ✅ **253 passed** (was 5 failures + 24 errors; no failures/errors) |
| Frontend — `npm run test` | ✅ **205 files / 1506 tests passed** (0 failures) |
| Frontend — `npm run lint` | ✅ **clean** (eslint, exit 0) |
| Frontend — `npm run build` | ✅ **success** (vite + tsc) |

---

## 13. Final verdict

**PRODUCTION READY WITH MINOR FOLLOW-UPS**

- Every financial-critical defect identified in the audit was reproduced, fixed, and regression-tested:
  - `paid_amount` / `outstanding_amount` are now financially correct on list, detail, and mutation responses.
  - Allocation safety is authoritative on the backend; the UI displays the same outstanding figures.
  - The entire Billing test suite (unit + integration) is green and trustworthy (no unexplained failures).
  - No incorrect UUID actor IDs remain; integration fixtures match the current schema; no stale ORM access.
  - `DocumentSequenceService.reserved_by` matches the production `int` type.
  - INR presentation is consistent across Billing (₹); no USD artifacts introduced.
  - The existing Invoice/Payment mobile UX is preserved; the Dashboard New Invoice flow now opens the create drawer directly.
- The follow-ups are **deliberate, documented product decisions** (refund/credit-note/receipt read endpoints, PatientCredit wallet, backend lint tooling) — not defects — and are explicitly deferred in §3.
