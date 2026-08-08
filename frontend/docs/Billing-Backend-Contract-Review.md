# Billing Module — Backend Contract Review (Sprint 14A)

> **Document type:** Mandatory backend contract review (Blocking Task)
> **Scope:** Backend Billing module (`backend/app/modules/billing/`) — **single source of truth** for all frontend Billing work.
> **Status:** ✅ VERIFIED against actual backend implementation (source code, not OpenAPI docs)
> **Date:** 2026-08-07
> **Method:** Every claim below was verified by reading all 6 routers, all 15 schema modules, all 11 models, all 9 services, all 8 repositories, all validators (incl. the pure state machine), all 6 mappers, enums, constants, exceptions, DI dependencies, the global exception handler, the RBAC dependency, `backend/main.py` registration, and the invoice/payment mappers. Cross-referenced against `backend/tests/modules/billing/*` and `backend/tests/integration/billing/*`.

---

## 1. Executive Summary

### 1.1 Module purpose

The Billing module is the **financial heart** of DensCare. It is built around five independent aggregate roots — **Invoice** (aggregate root, ADR-001), **Payment**, **Receipt**, **Refund**, and **Credit Note** — plus supporting infrastructure: **PaymentAllocation** (owned by Payment), **DocumentSequence** (ADR-003 gap-tracked numbering), **BillingAuditLog** (append-only), **PatientCredit** (model exists, **no endpoints**), and **InvoiceStatusHistory** (append-only).

The module follows the enterprise pattern already established by the Treatment Plan and Patient Records modules: routers are thin transport layers, services own transactions (commit/rollback), repositories flush only, validators enforce business rules, a pure **state machine** (`validators/state_machine.py`) is the sole authority on transition legality, and an orchestration service composes multi-step workflows (create→issue, receive payment, process refund, apply credit note, dashboard).

### 1.2 Readiness verdict

| Dimension | Verdict |
|---|---|
| Invoice: full lifecycle (draft → issue → cancel; edit/delete draft) | ✅ Complete — 7 endpoints, fully enforced state machine |
| Invoice list: search + filters + sorting + pagination | ✅ Complete (server-side) |
| Payment: create/complete/fail/void + **allocation engine** | ✅ Complete — 11 endpoints, row-locking, balance guards |
| Payment list: filters + sorting + pagination | ✅ Complete (**no free-text search**) |
| Receipt: generate / get / regenerate | ✅ Present (3 endpoints) — **no list** |
| Refund: create/approve/reject/complete | ✅ Present (4 endpoints) — **no read endpoints at all** |
| Credit note: create/issue/void/apply | ✅ Present (4 endpoints) — **no read endpoints at all** |
| Dashboard + financial totals | ✅ Present (2 endpoints, SQL aggregates) |
| Tax / GST | 🔴 **Not implemented** — `tax_rate_id`/`tax_amount` are Phase-2 placeholders; no tax calculation exists |
| Insurance claims | 🔴 **Not implemented** — `INSURANCE` is a payment-method enum value only |
| Online payment gateway | 🔴 **Not implemented** — `gateway_metadata` is always null except `gateway_txn_id = reference_number` |
| Patient wallet / advance payments | 🔴 **Not implemented** — `PatientCredit` model has no endpoints; allocation always requires an `invoice_id` |
| Reports beyond totals (aging, cashflow, monthly, KPI…) | 🔴 **Not implemented** — no `/revenue`, `/outstanding`, `/aging`, `/cashflow`, `/daily`, `/monthly`, `/yearly`, `/statistics`, `/kpis` |
| Invoice auto-status on payment (→ paid / partially_paid / overdue) | 🔴 **NOT enforced over HTTP** (O3) |
| Per-invoice `paid_amount` / `outstanding_amount` in API responses | 🔴 **Always `0.00`** in mapper output (O4) |
| PDF / printable rendering | 🔴 **Not implemented** — receipts return a structured JSON DTO (`PrintableReceipt`), no file/PDF |

**Overall frontend readiness: ✅ READY for a Dashboard + Invoices + Payments module with complete list/detail/edit/workflow UI, an action + single-detail surface for Receipts, and action-only surfaces for Refunds and Credit Notes.** The backend is production-shaped (state machine, optimistic versioning, row locks, financial invariants, audit log, gap-tracked numbering, pagination) and all **31 live endpoints** are registered in `main.py`. The frontend **must not** build: tax, insurance claims, payment-gateway flows, patient wallet, installment/EMI, tax/aging/cashflow reports, PDF/print generation, refund/credit-note/receipt list views, or invoice status synced from payments.

### 1.3 The actual money workflow (as enforced by the API)

```
[Treatment plan / appointment (other modules)] 
        ↓ (references)
Draft Invoice (POST /billing/invoices, temp number DRAFT-XXXXXXXX)   [status=draft]
        ↓  POST /{id}/issue   → permanent INV-00001 number reserved, status=issued (IMMUTABLE)
Issued Invoice
        ↓  POST /billing/payments (PAY-00001, status=pending)  →  POST /{id}/complete (status=completed)
        ↓  POST /billing/payments/{id}/allocate {invoice_id, amount}  → PaymentAllocation created
        ↓  POST /billing/receipts {payment_id}  → RCT-00001 generated (amount = payment.total_amount)
Paid-in-full / partial (DERIVED from allocations — invoice.status is NOT updated, see O3)
        ↓  POST /billing/refunds {payment_id, amount, reason} → pending → approve → complete
              → creates refund allocation (is_refund=true); payment → refunded if fully refunded
        ↓  POST /billing/credit-notes {invoice_id, patient_id, amount, reason} → draft → issue → apply
              → remaining_balance set to 0.00 (application is all-or-nothing, no partial apply)
        ↓  POST /billing/invoices/{id}/cancel {cancellation_reason}  (from DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE — NOT from PAID)
```

### 1.4 Important implementation observations (read first)

| # | Observation | Severity |
|---|---|---|
| **O1** | **Refunds and credit notes have NO read endpoints at all; receipts have only a single-read.** `GET /billing/refunds` / `GET /billing/refunds/{id}` / `GET /billing/credit-notes` / `GET /billing/credit-notes/{id}` / `GET /billing/receipts` (list) are explicitly documented as **NOT implemented** in the routers — the only receipt read is `GET /billing/receipts/{id}`. `RefundRead` and `CreditNoteRead` are **mutation-only** response DTOs; `ReceiptRead` is returned by both the mutations and `GET /receipts/{id}`. `RefundListItem/ListResponse/SearchRequest/Filter`, `CreditNoteListItem/ListResponse`, `ReceiptListItem/ListResponse/SearchRequest/Filter` are **dead schema code** — no route returns them. The UI cannot show refund/credit-note/receipt lists, but **can** show a single receipt detail. | 🔴 |
| **O2** | **Receipts are auto-quantity and un-allocatable.** `ReceiptService.generate_receipt()` always sets `amount = payment.total_amount`, `receipt_date = date.today()` — the client only supplies `payment_id`. One receipt per payment (DB `unique` on `payment_id`). There is **no receipt cancellation endpoint** even though `ReceiptStatus.CANCELLED` exists in the state machine. | 🟠 |
| **O3** | **Invoice status is NEVER auto-transitioned to `partially_paid`, `paid`, or `overdue` by any endpoint.** `PaymentService.allocate_payment()` creates the allocation and audits, but never writes `invoice.status` (verified: the only `invoice.status =` assignments in the whole module are `ISSUED` and `CANCELLED` in `invoice_service.py`). The statuses `partially_paid`/`paid`/`overdue` are only reachable via direct DB writes/seeds. The invoice list's "paid/outstanding" reality lives in **allocations**, not the status column. | 🔴 |
| **O4** | **Per-invoice `financials.paid_amount` and `financials.outstanding_amount` are hardcoded `0.00` in the API responses.** `InvoiceMapper._compute_financial_summary()` computes `subtotal/discount_total/tax_total/grand_total` from line items but always emits `paid_amount=Decimal("0.00")` and `outstanding_amount=Decimal("0.00")` — despite the schema docstring claiming "resolved at read time". The correct read-time computation exists in `FinancialCalculationService` but **is not used by the mappers**. The frontend must NOT trust these two fields; it must not even render them from API data. | 🔴 |
| **O5** | **Dashboard totals ARE computed correctly (SQL aggregates).** `GET /billing/dashboard` and `GET /billing/summary` use `FinancialCalculationService.calculate_billing_totals()` → repository `get_invoice_aggregates()` / `get_payment_totals()` / `get_credit_note_totals()` — `SUM` queries, correct regardless of data volume. `total_outstanding = total_invoiced − total_collected + total_refunded` (floored at 0). Recent lists = 5 most recent invoices + 5 most recent payments. Optional `patient_id` adds a patient financial summary. | ✅ |
| **O6** | **Date filters apply to `created_at`, not the document date.** The invoice router documents `date_from`/`date_to` as filtering on `invoice_date`, and the payment router says `payment_date`, but both repositories filter `created_at >= date_from` / `created_at <= date_to`. UI filter labels should say "created between", or expect mismatches. | 🟠 |
| **O7** | **Invoice list advertises `grand_total` as sortable, but it silently falls back to `created_at`.** `constants.ALLOWED_SORT_FIELDS` includes `grand_total`, but `InvoiceRepository._SORT_FIELDS` does not implement it; `_resolve_sort_field()` falls back to the default. Effective invoice sort fields: `created_at, updated_at, invoice_number, due_date, status`. Payment sort fields: `created_at, updated_at, payment_number, payment_date, total_amount, status, payment_method`. | 🟡 |
| **O8** | **Payments list has NO free-text search.** `GET /billing/payments` accepts only `patient_id, payment_method, status, date_from, date_to` (no `query` param); `PaymentRepository.search()` exists but is not routed. Invoices, by contrast, support `query` (invoice number + patient first/last name, `ILIKE %term%`). | 🟡 |
| **O9** | **Allocation is strictly one-per payment+invoice pair.** `allocate_payment` rejects a second non-refund allocation for the same payment+invoice (`PaymentValidationFailed` 409 "already has an allocation"). Partial allocation to the same invoice therefore requires either deallocation first or multiple payments. The DB also enforces a partial unique index. | 🟡 |
| **O10** | **Client-supplied line-item `net_amount` is schema-required but recomputed by the service.** `InvoiceItemCreate.net_amount` is required and range-validated, but `InvoiceService._validate_and_attach_items()` recomputes `net_amount = unit_price × quantity − discount_value` (floored at 0) and **ignores** the client value. `GrandTotalMismatch` exists but is never raised by the create path. The UI must let the user edit unit_price/quantity/discount and treat net/grand totals as read-only computed values. | 🟡 |
| **O11** | **Draft invoice numbers are temporary placeholders.** `POST /billing/invoices` generates `DRAFT-<8 hex>` (max 30 chars). The permanent `INV-00001` number is only assigned at `POST /{id}/issue` (atomic with the status change — sequence reservation is inside the same transaction). A draft must never be displayed with a permanent-looking invoice number. | 🟡 |
| **O12** | **Sequence numbers are consumed even when the workflow later fails/rolls back.** `DocumentSequenceService.reserve_next_number()` increments `document_sequences.current_value` and writes a `SequenceConsumptionLog`; the increment is atomic with the caller's transaction, so a rolled-back issue does **not** reclaim the number (by design — gap tracking, ADR-003). Numbering is NOT gapless. | 🟢 |
| **O13** | **`MAX_SEQUENCE_NUMBER = 999`** caps each document series at 999 in Phase 1 (formatted `{prefix}{value:05d}`, e.g. `INV-00999`). Exceeding it raises `BillingValidationError` (422). `DEFAULT_SEQUENCE_MIN_DIGITS = 5`. | 🟡 |
| **O14** | **Currency support is `USD | EUR | GBP | INR`, default `USD`, single currency per invoice.** `PaymentMethod` = `cash | card | upi | bank_transfer | cheque | insurance | wallet`. `Insurance` and `wallet` are selectable enum values but have **no dedicated workflow** (O15). | 🟡 |
| **O15** | **Payment "reversed" status is unreachable via HTTP.** The state machine allows `completed → reversed`, but no endpoint exposes it (only `complete`, `fail`, `void`). `is_reversed`/`reversal_reason` columns exist; `deallocate` writes an audit with action `payment_reversed` but does **not** change status. | 🟠 |
| **O16** | **Refund rejection requires a reason at the service layer, but the router schema makes it optional.** `RefundService.reject_refund()` validates `reason` via `validate_rejection_reason` (raises `RefundValidationFailed` 422 if missing/blank), while `RefundWorkflowRequest.reason` is `Optional`. The UI must require a reason before calling reject (backend enforces it regardless). | 🟡 |
| **O17** | **Payment update/delete are Pending-only; invoice update/delete are Draft-only.** `validate_editable()` gates both. Deleting a draft invoice or pending payment is a **hard delete** (repo `delete()` + commit). A payment that already has a receipt cannot be deleted (FK `ON DELETE RESTRICT` → `IntegrityError` → 500 `PaymentCreationFailed`); the service does not pre-check this. | 🟡 |
| **O18** | **Credit notes reserve their permanent number at DRAFT creation** (unlike invoices, which reserve at issue). A draft credit note already carries `CN-00001`; voiding an issued credit note leaves the number consumed. | 🟢 |
| **O19** | **The BillingOrchestrationService workflows are NOT exposed via any route.** `complete_invoice_workflow`, `receive_payment_workflow`, `process_refund_workflow`, `apply_credit_note_workflow` exist as application-service compositions (create→issue→apply etc., each step its own transaction) but **no router calls them**. The frontend must compose multi-step flows from the individual endpoints (matching the Patient-Records O2 pattern). | 🟠 |
| **O20** | **Error envelope is `{success, message, details}`; error codes are stripped.** `BillingException.to_dict()` (the `{error:{code,...}}` shape) is dead code — the global handler emits only `success/message/details`. Frontend branches on HTTP status + `message` (exactly like existing modules). 422 `details` = sanitized Pydantic error array. | 🟠 |

---

## 2. Module Structure

### 2.1 Folder / file map (`backend/app/modules/billing/`)

```
billing/
├── __init__.py                      # (empty)
├── constants.py                     # precision, financial bounds, numbering prefixes, field limits, 5 transition maps
├── enums.py                         # 11 enums: InvoiceStatus, PaymentMethod, PaymentStatus, PaymentAllocationType,
│                                    #   CreditNoteStatus, ReceiptStatus, CurrencyCode, RefundStatus, DocumentType,
│                                    #   AuditAction, SequenceConsumptionStatus
├── exceptions.py                    # BillingException + 30 subclasses (NotFound/Conflict/Validation/Financial/System)
├── dependencies.py                  # get_*_service factories (repo → validator → service per request)
├── mappers/                         # 6 stateless ORM→DTO mappers (invoice, payment, receipt, refund, credit_note, dashboard)
├── mixins/                          # audit.py, financial.py (money_column/currency_column), versioning.py (version/doc_version)
├── models/                          # 11 models (see §7)
├── repositories/                    # 8 repositories (aggregate-root repos; children persisted via parent)
├── routers/                         # billing_router (prefix /billing) + 6 sub-routers
├── schemas/                         # 15 schema modules (base/common/pagination/types/validators/mixins/metadata/
│                                    #   summaries + 6 domain families)
├── services/                        # base.py + 8 services (invoice, payment, receipt, refund, credit_note,
│                                    #   document_sequence, financial_calculation, billing_orchestration)
├── utils/                           # money.py, numbering.py, validation.py (not referenced by routers)
└── validators/                      # state_machine.py (pure) + 7 domain validators + protocols.py + financial_validator.py
```

### 2.2 Relevant shared infrastructure (outside the module)

| File | Role |
|---|---|
| `backend/main.py` | `app.include_router(billing_router)` — **single registration point** (all 6 sub-routers attach inside `routers/__init__.py`); CORS for `localhost:5173` / `127.0.0.1:5173`; `register_exception_handlers(app)` |
| `backend/app/dependencies/auth.py` | `oauth2_scheme`, `get_current_user` (JWT `sub` = email → User; inactive user → 401) |
| `backend/app/modules/rbac/permissions.py` | `require_roles([...])` (403 `"Role not assigned"` / `"Insufficient permissions"`), `require_admin` = `{ADMIN, CHIEF_DOCTOR}` |
| `backend/app/core/constants.py` | `ROLE_ADMIN`, `ROLE_RECEPTIONIST`, `ROLE_DENTAL_ASSISTANT`, `DOCTOR_ROLES` = `{CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` |
| `backend/app/core/exception_handlers.py` | `billing_exception_handler` with MRO-based status map: NotFound→404, Conflict→409, Validation→422, Financial→422, else→500; global `{success, message, details}` envelope; 422 sanitizer |
| `backend/app/database/session.py` | `get_db` session dependency |

### 2.3 Dependency graph

```
Router ──► Service (owns commit/rollback) ──► Repository (flush only)
   │              │                                  └─► SELECT ... FOR UPDATE row locks
   │              ├─► Validator (business rules, FK existence via cross-module repos)
   │              ├─► StateMachine (pure transition legality)
   │              ├─► DocumentSequenceService (number reservation, atomic w/ caller txn)
   │              └─► AuditRepository (append-only BillingAuditLog)
   └─► response_model (Pydantic DTO) ← Mapper (explicit construction; computed fields)
```

**FK wiring (Sprint 12A hardening):** `InvoiceValidator` is injected with Patient, Doctor, Appointment, TreatmentPlan and Diagnosis repositories; `PaymentValidator` and `CreditNoteValidator` with Patient. Every create validates referenced entities exist before persisting (404 on missing).

---

## 3. Router Review

All routers are mounted under the parent `billing_router` (`prefix="/billing"`, registered in `main.py`). No API version prefix. Every endpoint declares `response_model`, `summary`, `description`, `status_code`, and `responses`.

| Sub-router | Prefix | Tags | Endpoints |
|---|---|---|---|
| `invoice.py` | `/billing/invoices` | `Invoices` | 7 |
| `payment.py` | `/billing/payments` | `Payments` | 11 |
| `receipt.py` | `/billing/receipts` | `Receipts` | 3 |
| `refund.py` | `/billing/refunds` | `Refunds` | 4 |
| `credit_note.py` | `/billing/credit-notes` | `Credit Notes` | 4 |
| `dashboard.py` | `/billing` | `Billing Reports` | 2 |

**Total: 31 live endpoints.** Shared `_COMMON_ERROR_RESPONSES` documents 401/403/404/409/422 for every endpoint.

---

## 4. Endpoint Inventory (31 endpoints — all live in `main.py`)

**Legend:** 🔐 = Bearer JWT. **READ** = `{ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, 4×doctor}`. **WRITE** = same as READ. **WF** (workflow: issue/cancel/complete/fail/void/allocate/deallocate/approve/reject/regenerate) = `{ADMIN, RECEPTIONIST, 4×doctor}` (**DENTAL_ASSISTANT excluded**). **DEL** = `{ADMIN}` only.

### 4.1 Invoices — `/billing/invoices`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 1 | `GET` | `/billing/invoices` | Paginated list; `query` (invoice number + patient name ILIKE), `patient_id`, `doctor_id`, `status`, `date_from`, `date_to` (→ `created_at`, O6), `page`, `page_size`, `sort_by`, `sort_order` | 🔐 READ | 200 | query | `InvoiceListResponse` |
| 2 | `POST` | `/billing/invoices` | Create invoice in **DRAFT** with ≥1 line item; temp number `DRAFT-XXXXXXXX`; validates all FKs | 🔐 WRITE | **201** | `InvoiceCreateRequest` | `InvoiceRead` |
| 3 | `GET` | `/billing/invoices/{invoice_id}` | Full aggregate: items, patient, doctor, treatment_plan, appointment, creator/updater, financials, version | 🔐 READ | 200 | — | `InvoiceRead` |
| 4 | `PATCH` | `/billing/invoices/{invoice_id}` | Update draft: **notes + due_date only** (line-item replacement NOT exposed in this sprint; `items=None` hardcoded) | 🔐 WRITE | 200 | `InvoiceDraftUpdateRequest` | `InvoiceRead` |
| 5 | `POST` | `/billing/invoices/{invoice_id}/issue` | Draft → Issued; reserves permanent `INV-#####`; invoice becomes immutable | 🔐 WF | 200 | — | `InvoiceRead` |
| 6 | `POST` | `/billing/invoices/{invoice_id}/cancel` | DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE → Cancelled (**NOT from PAID** — PAID's only transition is VOID, which has no endpoint); **cancellation_reason required** (1–500) | 🔐 WF | 200 | `CancelInvoiceRequest` | `InvoiceRead` |
| 7 | `DELETE` | `/billing/invoices/{invoice_id}` | **Hard delete** a Draft invoice (with line items) | 🔐 DEL | **204** | — | — |

**Errors:** issue → 409 invalid transition / missing items; cancel → 409 invalid transition (incl. from PAID, which the state machine blocks) or 422 missing reason; update/delete → 409 non-draft; missing → 404.

### 4.2 Payments — `/billing/payments`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 8 | `GET` | `/billing/payments` | Paginated list; `patient_id`, `payment_method`, `status`, `date_from`, `date_to` (→ `created_at`, O6), `page`, `page_size`, `sort_by`, `sort_order`; **no free-text query (O8)** | 🔐 READ | 200 | query | `PaymentListResponse` |
| 9 | `POST` | `/billing/payments` | Create payment in **PENDING**; reserves `PAY-#####` immediately | 🔐 WRITE | **201** | `PaymentCreateRequest` | `PaymentRead` |
| 10 | `GET` | `/billing/payments/{payment_id}` | Full aggregate: allocations, patient, creator/updater, financials, gateway metadata, version | 🔐 READ | 200 | — | `PaymentRead` |
| 11 | `PATCH` | `/billing/payments/{payment_id}` | Update **Pending** payment: `reference_number` + `notes` only | 🔐 WRITE | 200 | `PaymentMetadataUpdateRequest` | `PaymentRead` |
| 12 | `DELETE` | `/billing/payments/{payment_id}` | **Hard delete** a Pending payment | 🔐 DEL | **204** | — | — |
| 13 | `POST` | `/billing/payments/{payment_id}/complete` | Pending → Completed (required before allocation) | 🔐 WF | 200 | — | `PaymentRead` |
| 14 | `POST` | `/billing/payments/{payment_id}/fail` | → Failed (reason optional, audit-only) | 🔐 WF | 200 | `PaymentStatusChangeRequest` | `PaymentRead` |
| 15 | `POST` | `/billing/payments/{payment_id}/void` | → Void (reason optional, audit-only) | 🔐 WF | 200 | `PaymentStatusChangeRequest` | `PaymentRead` |
| 16 | `POST` | `/billing/payments/{payment_id}/allocate` | Allocate amount to invoice (payment+invoice row-locked; balance + duplicate checks) | 🔐 WF | **201** | `PaymentAllocateRequest` | `PaymentAllocationSummary` |
| 17 | `POST` | `/billing/payments/{payment_id}/deallocate` | Remove an allocation (payment+invoice locked) | 🔐 WF | **204** | `PaymentDeallocateRequest` | — |
| 18 | `GET` | `/billing/payments/{payment_id}/allocations` | All allocations for a payment (incl. refund allocations, `is_refund`) | 🔐 READ | 200 | — | `list[PaymentAllocationSummary]` |

**Errors:** allocate → 409 payment not completed / invoice not payable / duplicate; 422 allocation exceeds payment unallocated or invoice outstanding. complete/fail/void → 409 invalid transition.

### 4.3 Receipts — `/billing/receipts`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 19 | `POST` | `/billing/receipts` | Generate receipt for a **COMPLETED** payment (one per payment); amount = payment total, date = today | 🔐 WRITE | **201** | `ReceiptGenerateRequest` | `ReceiptRead` |
| 20 | `GET` | `/billing/receipts/{receipt_id}` | Single receipt aggregate (payment, patient, financials, print/document metadata, audit trail) | 🔐 READ | 200 | — | `ReceiptRead` |
| 21 | `POST` | `/billing/receipts/{receipt_id}/regenerate` | Re-produce document (status must be GENERATED; audit event `regenerated`; no financial change) | 🔐 WF | 200 | — | `ReceiptRead` |

**No list endpoint (O1).** **No cancellation endpoint (O2).**

### 4.4 Refunds — `/billing/refunds`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 22 | `POST` | `/billing/refunds` | Create refund in **PENDING** against a COMPLETED payment; amount ≤ refundable balance (all non-rejected refunds count); reserves `RFD-#####` | 🔐 WRITE | **201** | `RefundCreateRequest` | `RefundRead` |
| 23 | `POST` | `/billing/refunds/{refund_id}/approve` | Pending → Approved (sets reviewer metadata) | 🔐 WF | 200 | — | `RefundRead` |
| 24 | `POST` | `/billing/refunds/{refund_id}/reject` | Pending → Rejected; **reason required at service level (O16)** | 🔐 WF | 200 | `RefundWorkflowRequest` | `RefundRead` |
| 25 | `POST` | `/billing/refunds/{refund_id}/complete` | Approved → Completed; locks payment, creates `is_refund=true` allocation; payment → **refunded** if fully refunded | 🔐 WF | 200 | — | `RefundRead` |

**No read/list/update/delete endpoints at all (O1).**

### 4.5 Credit Notes — `/billing/credit-notes`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 26 | `POST` | `/billing/credit-notes` | Create in **DRAFT**; amount ≤ invoice grand total (BR-91, invoice row-locked); reserves `CN-#####` at creation (O18) | 🔐 WRITE | **201** | `CreditNoteCreateRequest` | `CreditNoteRead` |
| 27 | `POST` | `/billing/credit-notes/{credit_note_id}/issue` | Draft → Issued (sets issue_date = today); becomes applicable/voidable | 🔐 WF | 200 | — | `CreditNoteRead` |
| 28 | `POST` | `/billing/credit-notes/{credit_note_id}/void` | Draft or Issued → Void; **void_reason required** (1–1000) | 🔐 WF | 200 | `CreditNoteVoidRequest` | `CreditNoteRead` |
| 29 | `POST` | `/billing/credit-notes/{credit_note_id}/apply` | Issued (not expired, remaining > 0) → Applied; **remaining_balance = 0** (no partial apply) | 🔐 WF | 200 | — | `CreditNoteRead` |

**No read/list/update/delete endpoints at all (O1).**

### 4.6 Dashboard & Summary — `/billing`

| # | Method | Endpoint | Purpose | Auth | Success | Request | Response |
|---|---|---|---|---|---|---|---|
| 30 | `GET` | `/billing/dashboard` | Full dashboard: `totals` (10 fields), `recent_invoices` (≤5), `recent_payments` (≤5), optional `patient_summary` when `?patient_id=`, `generated_at` | 🔐 READ | 200 | query `patient_id?` | `BillingDashboardResponse` |
| 31 | `GET` | `/billing/summary` | Lightweight `totals`-only payload for widgets | 🔐 READ | 200 | — | `BillingTotalsResponse` |

**Not implemented (explicitly documented in the router):** `/revenue`, `/outstanding`, `/cashflow`, `/aging`, `/daily`, `/monthly`, `/yearly`, `/statistics`, `/kpis`.

---

## 5. Request Schema Review

All billing schemas inherit `BillingBaseModel` → `ConfigDict(extra="forbid", str_strip_whitespace=True, validate_default=True)` → **unknown fields → 422**; text is whitespace-stripped. All monetary fields quantize to 2 decimals (`NUMERIC(12,2)`, max `999999999999.99`, min `0.00`) via `BillingValidators.validate_money_amount`.

### 5.1 `InvoiceCreateRequest` (POST /billing/invoices)

| Field | Type | Required | Validation |
|---|---|---|---|
| `patient_id` | UUID | ✅ | Must exist (404) |
| `treatment_plan_id` | UUID \| null | ❌ | Must exist if set (404) |
| `appointment_id` | UUID \| null | ❌ | Must exist if set (404) |
| `doctor_id` | UUID \| null | ❌ | Must exist if set (404) |
| `invoice_date` | date | ✅ | Must be ≤ `due_date` |
| `due_date` | date | ✅ | Must be ≥ `invoice_date`; default 30 days after invoice date at service layer |
| `currency_code` | str | ❌ (default `"USD"`) | Exactly 3 chars, uppercased; supported `USD/EUR/GBP/INR` |
| `notes` | str \| null | ❌ | ≤ 2000 |
| `items` | `list[InvoiceItemCreate]` | ✅ | **min 1** item (empty → 422) |

### 5.2 `InvoiceItemCreate` (nested, min 1)

| Field | Type | Required | Validation |
|---|---|---|---|
| `description` | str | ✅ | 1–500 |
| `quantity` | int | ❌ (default 1) | ≥ 1 |
| `unit_price` | Decimal | ✅ | ≥ 0 (2dp) |
| `discount_type` | str \| null | ❌ | `PERCENTAGE` \| `FIXED_AMOUNT` |
| `discount_value` | Decimal \| null | ❌ | ≥ 0; service enforces ≤ line subtotal |
| `net_amount` | Decimal | ✅ | ≥ 0 — **recomputed by service (O10)** |
| `sequence_number` | int | ✅ | ≥ 1, unique per invoice |
| `plan_item_id` | UUID \| null | ❌ | FK → treatment_plan_items (must exist, belong to the invoice's plan) |
| `diagnosis_id` | UUID \| null | ❌ | FK → patient_record_diagnoses (must exist, belong to the patient) |
| `original_price` | Decimal \| null | ❌ | Audit-only (treatment plan estimate) |
| `override_reason` | str \| null | ❌ | ≤ 500 |

### 5.3 Update/action request schemas

| Schema | Endpoint | Fields | Notes |
|---|---|---|---|
| `InvoiceDraftUpdateRequest` | PATCH invoice | `notes?` (≤2000), `due_date?` | **Only these two**; line items not editable via API in this sprint |
| `CancelInvoiceRequest` | POST invoice/cancel | `cancellation_reason` (**required**, 1–500) | |
| `PaymentCreateRequest` | POST payment | `patient_id` ✅, `payment_method` ✅ (enum), `total_amount` ✅ (>0), `payment_date` ✅, `reference_number?` (≤100, stripped→null), `notes?` (≤500) | |
| `PaymentMetadataUpdateRequest` | PATCH payment | `reference_number?`, `notes?` | Pending-only |
| `PaymentStatusChangeRequest` | fail / void | `reason?` (≤500) | Audit-only |
| `PaymentAllocateRequest` | allocate | `invoice_id` ✅, `amount` ✅ (>0) | |
| `PaymentDeallocateRequest` | deallocate | `invoice_id` ✅ | |
| `ReceiptGenerateRequest` | POST receipt | `payment_id` ✅ | amount/date are server-derived (O2) |
| `RefundCreateRequest` | POST refund | `payment_id` ✅, `amount` ✅ (>0), `reason` ✅ (1–1000) | |
| `RefundWorkflowRequest` | reject | `reason?` (≤500) | Service requires it (O16) |
| `CreditNoteCreateRequest` | POST credit-note | `invoice_id` ✅, `patient_id` ✅, `amount` ✅ (>0, ≤ invoice grand total), `reason` ✅ (1–2000), `expiry_date?` | |
| `CreditNoteVoidRequest` | void credit-note | `void_reason` ✅ (1–1000) | |
| `InvoiceStatusTransitionRequest`, `PaymentSearchRequest`, `RefundSearchRequest`, `ReceiptSearchRequest`, `InvoiceFilter`, `PaymentFilter`, `RefundFilter`, `ReceiptFilter`, `RefundUpdateRequest`, `ReceiptUpdateRequest`, `InvoiceUpdateRequest`, `PaymentUpdateRequest`, `RefundStatusTransitionRequest`, `ReceiptStatusTransitionRequest` | — | — | **Dead schema code — no route uses them (O1)** |

**422 details shape (verified):** `details` = sanitized Pydantic array `[{"type","loc","msg","input","ctx"?}]`.

---

## 6. Response Schema Review

**Serialization:** UUIDs → strings; datetimes → ISO 8601 (UTC); money → `Decimal` serialized as JSON string (Pydantic v2). All response DTOs `extra="forbid"`. `created_by`/`updated_by`/`changed_by` are **int** (auth.users.id is INTEGER, not UUID).

### 6.1 `InvoiceListResponse` (list) / `InvoiceListItem`

`{items: InvoiceListItem[], total, page, page_size}` — **no `pages` field** (unlike Patient Records). `InvoiceListItem` = `id, invoice_number, status, patient{id, patient_code, full_name, is_active}, doctor{id, doctor_code, user_full_name, is_active}|null, invoice_date, due_date, financials, item_count, created_at`.

### 6.2 `InvoiceRead` (detail + all mutations)

`id, invoice_number, document_type:"invoice", status, patient, doctor|null, treatment_plan{id, plan_code, status}|null, appointment{id, appointment_number, appointment_date}|null, creator{id, full_name}|null, updater|null, invoice_date, due_date, currency_code, notes|null, cancellation_reason|null, void_reason|null, items[] (InvoiceItemSummary), financials, version, doc_version, created_at, created_by, updated_at, updated_by`.

`financials` (⚠ see O4): `currency_code, subtotal, discount_total, tax_total, grand_total, paid_amount (ALWAYS 0.00), outstanding_amount (ALWAYS 0.00)`.

### 6.3 `PaymentListResponse` / `PaymentListItem` / `PaymentRead`

`PaymentListItem` = `id, payment_number, status, patient, payment_method, total_amount, payment_date, financials, allocation_count, created_at`. `PaymentRead` adds `creator/updater, reference_number|null, is_reversed, reversal_reason|null, notes|null, allocations[], gateway_metadata, version, doc_version`.

- `financials` (mapper-computed, **correct**): `currency_code, total_amount, allocated_amount, refunded_amount, unallocated_amount`.
- `allocations[]` = `{id, invoice{id, invoice_number, patient, invoice_date, currency_code, grand_total}|null, allocated_amount, is_refund, created_at}` — refund allocations carry `invoice: null` and `is_refund: true`.
- `gateway_metadata` = `{gateway_txn_id: reference_number, gateway_order_id: null, bank_reference_number: null, payment_source: null}` when a reference exists, else `null` (O15).

### 6.4 Read models: receipt (single-get) vs refund/credit-note (mutation-only)

`ReceiptRead` **has a GET endpoint** (`GET /billing/receipts/{id}`, §4.3) and is also the response of the generate/regenerate mutations. `RefundRead` and `CreditNoteRead` are **mutation-only** — no GET endpoint exists for either (O1).

`ReceiptRead` = `{id, receipt_number, document_type, status, patient, payment{...}, creator, updater, receipt_date, amount, currency_code, notes|null, cancellation_reason|null, receipt_invoices[], financials, print_metadata|null, document_metadata, audit_trail[]}`. `RefundRead` = `{id, refund_number, status, patient, payment{...}, invoices[], creator, updater, reviewer, amount, reason, currency_code, notes, rejection_reason, reviewed_by, reviewed_at, financials, gateway_metadata, document_metadata, audit_trail[], version, doc_version}`. `CreditNoteRead` = `{id, credit_note_number, status, patient, invoice{...}, creator, updater, amount, remaining_balance, reason, issue_date, expiry_date|null, void_reason|null, financials, document_metadata, audit_trail[], version, doc_version}`.

### 6.5 Dashboard responses

`BillingTotalsResponse` (from `/summary` and embedded in `/dashboard`): `total_invoiced, total_collected, total_refunded, total_outstanding, total_credited, invoice_count, paid_invoice_count, outstanding_invoice_count, payment_count, credit_note_count`. `BillingDashboardResponse` adds `recent_invoices: InvoiceListItem[]` (≤5, `created_at DESC`), `recent_payments: PaymentListItem[]` (≤5), `patient_summary|null`, `generated_at`.

---

## 7. Database Model Review

All models extend `Base`; UUID PKs (`uuid4`, app-generated); `DateTime(timezone=True)` with `server_default=func.now()` / `onupdate=func.now()`; `users.id` FKs are **INTEGER**. **All aggregates carry `version` + `doc_version` (optimistic lock + logical revision) via `VersioningMixin`** — receipts and allocations do not.

| Model / table | Key columns & constraints | Relationships |
|---|---|---|
| **Invoice** `invoices` | `patient_id` (FK RESTRICT, not null), `treatment_plan_id`/`appointment_id`/`doctor_id` (FK SET NULL), `invoice_number` (String 30, **unique**), `invoice_date`, `due_date` (**CHECK `due_date >= invoice_date`**), `status` (Enum, CHECK), `currency_code` (CHECK `^[A-Z]{3}$`), `notes`, `cancellation_reason` (CHECK required when cancelled), `void_reason` (CHECK required when void), audit cols, `version`. Indexes on patient/treatment_plan/appointment/doctor/status/patient_status/currency/invoice_date/due_date/created_at | `items` (cascade delete-orphan, ordered by sequence), `status_history` (append-only), `credit_notes`, `patient`, `treatment_plan`, `appointment`, `doctor`, `creator`, `updater` |
| **InvoiceItem** `invoice_line_items` | `invoice_id` (FK CASCADE), `plan_item_id` (FK SET NULL), `diagnosis_id` (FK SET NULL), `sequence_number` (**UNIQUE (invoice_id, sequence_number)**), `description` (500), `quantity` (CHECK ≥1), `unit_price` (CHECK ≥0), `discount_type` (CHECK `PERCENTAGE\|FIXED_AMOUNT`), `discount_value` (CHECK ≥0), `net_amount` (CHECK ≥0), `tax_rate_id` (Phase 2), `tax_amount` (Phase 2), `original_price`, `override_reason`, audit cols, version | `invoice`, `plan_item`, `diagnosis`, `creator`, `updater` |
| **InvoiceStatusHistory** `invoice_status_history` | `invoice_id` (FK CASCADE), `from_status|null`, `to_status`, `changed_by` (int FK), `changed_at`, `reason` | append-only; indexed `(invoice_id, changed_at)` |
| **Payment** `payments` | `patient_id` (FK RESTRICT), `payment_number` (String 30, unique), `payment_method` (Enum, CHECK), `total_amount` (**CHECK > 0**), `payment_date`, `reference_number` (≤100), `status` (Enum, default `pending`, CHECK), `is_reversed` (bool), `reversal_reason` (CHECK required when reversed), `notes`, audit cols, version. Indexes on patient/status/payment_date/created_at/method+status/patient+status | `payment_allocations` (cascade), `receipt` (uselist=False, 1:1), `patient`, `creator`, `updater` |
| **PaymentAllocation** `payment_allocations` | `payment_id` (FK CASCADE), `invoice_id` (FK RESTRICT, **nullable** — advance payments), `allocated_amount` (CHECK > 0), `is_refund` (bool), `refund_reason` (CHECK required when refund), `original_allocation_id` (self-FK), `created_by`, `created_at`. **Partial unique index `(payment_id, invoice_id)` WHERE `is_refund=FALSE AND invoice_id IS NOT NULL`** (O9) | `payment`, `invoice`, `creator`, `original_allocation` |
| **Receipt** `receipts` | `payment_id` (FK RESTRICT, **unique** — 1 receipt per payment), `receipt_number` (String 30, unique), `receipt_date`, `amount`, `status` (Enum `generated\|cancelled`, CHECK), `created_by`, `created_at`. **No version columns** | `payment`, `receipt_invoices`, `creator` |
| **ReceiptInvoice** `receipt_invoices` | composite PK `(receipt_id, invoice_id)`, both FKs (CASCADE / RESTRICT) | consolidated receipts |
| **Refund** `refunds` | `payment_id` (FK RESTRICT), `refund_number` (String 30, unique), `amount` (CHECK > 0), `reason`, `status` (Enum, CHECK), `reviewed_by`/`reviewed_at`, `rejection_reason` (CHECK required when rejected), audit cols, version | `payment`, `creator`, `reviewer`, `updater` |
| **CreditNote** `credit_notes` | `invoice_id` (FK RESTRICT), `patient_id` (FK RESTRICT), `credit_note_number` (String 30, unique), `issue_date`, `amount` (CHECK > 0), `remaining_balance` (CHECK ≥0 and ≤ amount), `reason`, `status` (Enum, CHECK), `expiry_date`, `void_reason` (CHECK required when void), audit cols, version | `invoice`, `patient`, `creator`, `updater` |
| **DocumentSequence** `document_sequences` | `document_type` (PK String 20), `prefix` (String 10, CHECK `^[A-Z-]+$`), `current_value` (≥0), `min_digits` (≥1, default 5), `start_value` (≥1), audit cols | `consumption_logs` |
| **SequenceConsumptionLog** `sequence_consumption_log` | `document_type` (FK CASCADE), `number_assigned` (≥1), `reserved_at`, `reserved_by` (int FK), `document_id|null`, `status` (CHECK `completed\|failed\|rolled_back`) | gap tracking (ADR-003) |
| **BillingAuditLog** `billing_audit_logs` | `entity_type` (String 50), `entity_id` (UUID), `action` (String 30), `old_value`/`new_value` (JSONB, nullable), `changed_by` (int FK), `changed_at`, `reason`. Indexes on entity/action/changed_by/changed_at. **Append-only** | `changer` |
| **PatientCredit** `patient_credits` | `patient_id`, `source_allocation_id`, `source_credit_note_id`, `original_amount` (>0), `remaining_amount` (≥0, ≤ original), `expiry_date`, audit cols | **model only — no service, no endpoints (O15)** |

---

## 8. Repository Review

| Repository | Key responsibilities |
|---|---|
| `InvoiceRepository` | `_SORT_FIELDS` = `{created_at, updated_at, invoice_number, due_date, status}` (O7); `_ALLOWED_UPDATE_FIELDS` = `{notes, cancellation_reason, void_reason, due_date, updated_by}`; `list(search, patient_id, doctor_id, status, date_from→**created_at**, date_to→**created_at**, page, page_size, sort_by, sort_order)`; `get_for_update` (row lock); `search(term, limit)` type-ahead (not routed); `get_invoice_grand_total` (SUM net_amount), `get_total_allocated_for_invoice` (non-refund SUM), `get_total_refunded_for_invoice` (refund SUM), `get_invoice_aggregates(patient_id?)` (SQL aggregates: total_grand_total, total_paid, total_refunded, paid_count, outstanding_count = total − paid) |
| `PaymentRepository` | `_SORT_FIELDS` = `{created_at, updated_at, payment_number, payment_date, total_amount, status, payment_method}`; `_ALLOWED_UPDATE_FIELDS` = `{reference_number, is_reversed, reversal_reason, notes, updated_by}`; `list(patient_id, status, payment_method, date_from→created_at, date_to→created_at, …)`; `search` (not routed, O8); `get_total_allocated_for_payment`, `get_payment_totals(patient_id?)`, `add_allocation`, `remove_allocation` |
| `ReceiptRepository` | create / get / get_for_update; **no list** |
| `RefundRepository` | create / get_for_update / `get_completed_refund_total(payment_id)`, `get_outstanding_refund_total(payment_id)` (PENDING+APPROVED+COMPLETED, excludes REJECTED) |
| `CreditNoteRepository` | create / get / get_for_update / `get_credit_note_totals(patient_id?)` |
| `DocumentSequenceRepository` | `increment(document_type)` (row lock + `current_value + 1`), `persist_consumption_log`, get-by-type |
| `AuditRepository` | append-only create; list/get filters (not routed) |
| `PatientCreditRepository` | **No service uses it** |

**Pagination (uniform):** `page` (ge=1, default 1), `page_size` (ge=1, le=100, default 20); repository clamps. Response `{items, total, page, page_size}` — **no `pages`**. Unknown `sort_by` falls back to `created_at`; invalid `sort_order` → 422 (regex `^(asc|desc)$`).

---

## 9. Service Layer Review

**Transaction model:** every mutating service method: row-lock (`get_for_update`) → validator checks → state-machine check → mutate → audit write (`BillingAuditLog`) → `commit()`; on any known exception `rollback()` + re-raise; on `IntegrityError`/`SQLAlchemyError` rollback + raise the module's `*CreationFailed` (500). Repositories never commit. `DocumentSequenceService` deliberately does **not** commit — the caller's transaction owns the number reservation (atomicity, O12).

### 9.1 Invoice workflow (`InvoiceService`)

- **create**: currency → number format/unique (temp `DRAFT-…`) → date defaults (due = invoice + 30d) → item-presence → FK existence (patient/treatment_plan/appointment/doctor) → build aggregate → validate items (description, qty ≥1, unit_price ≥0, discount ≤ subtotal, **net_amount recomputed**, sequence unique, line-item FKs `plan_item_id`/`diagnosis_id`) → initial status-history row (`null → draft`, reason "Initial creation") → persist → commit.
- **issue**: lock → `validate_status_transition(invoice, ISSUED)` (state machine + must have items) → reserve `INV-#####` (same txn) → `status=issued`, append history, audit `issued` (old/new JSON) → commit. **Invoice becomes immutable.**
- **cancel**: lock → transition check (**state machine blocks PAID→CANCELLED** — allowed from DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE) → `validate_cancellable` (non-terminal, **PAID excluded**, + reason) → `status=cancelled`, history, audit → commit.
- **update_draft**: lock → `validate_editable` (Draft only) → apply `notes`/`due_date` (due ≥ invoice_date) → items replacement **hardcoded `items=None` from the router (O1 sprint scope)** → commit.
- **delete_draft**: lock → Draft check → repo hard delete → commit.
- **get / search**: read-only.

### 9.2 Payment workflow (`PaymentService`)

- **create**: patient exists → amount > 0 → method valid → date valid → reserve `PAY-#####` (or validate supplied number) → build `PENDING` → audit `created` → commit.
- **complete / fail / void**: lock → state-machine transition (`pending→completed`, `pending→failed`, `pending→void`) → status + `updated_by` → audit (`completed`/`failed`/`voided`, reason optional) → commit.
- **allocate**: **lock payment + lock invoice** → payment `COMPLETED` (`validate_allocatable`) → invoice payable (`ISSUED | PARTIALLY_PAID | OVERDUE`) → amount > 0 → **unallocated balance** (total − non-refund allocations) → **invoice outstanding** (`grand_total − paid + refunded`, BR-63) → duplicate pair check → create allocation (`is_refund=false`) → audit `payment_received` → commit. **Does not touch invoice.status (O3).**
- **deallocate**: lock both → find non-refund allocation for pair → remove → audit `payment_reversed` → commit. **No status change (O15).**
- **get / search / get_allocations**: read-only.

### 9.3 Receipt workflow (`ReceiptService`)

- **generate**: lock payment → `validate_generatable` (payment COMPLETED, no duplicate receipt) → reserve `RCT-#####` → build receipt (`amount = payment.total_amount`, `receipt_date = today`, GENERATED) → audit `created` → commit → return `(Receipt, PrintableReceipt)`.
- **get**: read-only (+ printable DTO).
- **regenerate**: lock receipt → status must be GENERATED → audit `regenerated` → commit. **No financial change.**

### 9.4 Refund workflow (`RefundService`)

- **create**: lock payment → `validate_refundable_payment` (COMPLETED) → amount > 0 → **over-refund guard**: `existing outstanding (PENDING+APPROVED+COMPLETED) + new ≤ payment.total` → reserve `RFD-#####` → build PENDING → audit `refund_created` → commit.
- **approve**: lock refund → `pending→approved` → set `reviewed_by`/`reviewed_at` → audit `refund_approved` → commit.
- **reject**: lock → `pending→rejected` → **reason required** → set reviewer + `rejection_reason` → audit `refund_rejected` → commit.
- **complete**: lock refund → `approved→completed` → **re-lock payment** and re-validate refundable (belt-and-suspenders) → re-check `completed refunds + amount ≤ total` → create **refund allocation** (`is_refund=true`, `invoice_id=null`, `refund_reason=reason`, `original_allocation_id=null`) → `status=completed` → **if fully refunded: payment → `refunded`** (state-machine-validated) + payment audit → refund audit → commit.

### 9.5 Credit note workflow (`CreditNoteService`)

- **create**: patient exists → **lock invoice** → amount > 0 → **amount ≤ invoice grand total** (BR-91/FI-CN-002) → reason valid → expiry date valid → reserve `CN-#####` → build DRAFT (`remaining_balance = amount`) → audit `created` → commit.
- **issue**: lock → `draft→issued` (+ editable check) → `issue_date = today` → audit `issued` → commit. **Immutable after issue (FI-CN-003).**
- **void**: lock → `validate_voidable` (not terminal + reason) + transition → set `void_reason`, `status=void` → audit `voided` → commit.
- **apply**: lock → `validate_applicable` (ISSUED, not expired, remaining > 0) + transition → `status=applied`, **`remaining_balance = 0`** → audit `credit_applied` → commit. **All-or-nothing; no partial application.**

### 9.6 Support services

- **`DocumentSequenceService`**: `reserve_next_number` (validate type → validate row → `increment()` with lock → consumption log `completed` → **no commit** → formatted number `{prefix}{value:05d}`), `preview_next_number` (read-only), `get_sequence`.
- **`FinancialCalculationService`** (read-only, single source of truth for calculations): per-invoice grand/paid/refunded/outstanding; per-payment allocated/unallocated/refunded/remaining-refundable; credit-note remaining/applied; `calculate_patient_financial_summary`; `calculate_billing_totals`; consistency checks (`check_invoice_payment_consistency`, `check_payment_allocation_consistency`). **Used by the dashboard/summary endpoints — NOT by the invoice/payment mappers (O4).**
- **`BillingOrchestrationService`** (application service): `complete_invoice_workflow`, `receive_payment_workflow`, `process_refund_workflow`, `apply_credit_note_workflow`, `get_billing_dashboard` — **only `get_billing_dashboard` is routed (O19).**

---

## 10. Validator Review

| Validator | Rules (verified) |
|---|---|
| `state_machine.py` (**pure, sole authority**) | `validate_invoice_transition / validate_payment_transition / validate_refund_transition / validate_receipt_transition / validate_credit_note_transition` — all transition maps live in `constants.py`. Plus `validate_transition`, `can_transition`, `is_terminal_state`, `is_editable_state` |
| `FinancialValidator` | currency code (ISO 4217, supported set), positive / non-negative amounts, precision bounds, grand-total consistency, currency consistency (single currency per doc) |
| `InvoiceValidator` | existence, `validate_editable` (Draft only), `validate_immutable`, `validate_cancellable` (state-machine-gated: DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE — **PAID excluded** — + reason required), `validate_voidable` (non-terminal + reason; **no void endpoint exists**), `validate_issuable` (Draft + ≥1 item), `validate_payable` (`ISSUED/PARTIALLY_PAID/OVERDUE`), number format ≤30 + unique, invoice/due-date ranges, discount ≤ subtotal, line-item sequence uniqueness, total consistency, FK existence (patient/treatment_plan/appointment/doctor), line-item FKs (`plan_item_id` ∈ invoice's plan, `diagnosis_id` ∈ patient) |
| `PaymentValidator` | existence, `validate_editable` (Pending), `validate_allocatable` (Completed), `validate_payment_method` (enum), `validate_payment_date`, number format/unique, patient exists |
| `ReceiptValidator` | `validate_generatable` (payment COMPLETED + no existing receipt), `validate_regeneratable` (status GENERATED), existence |
| `RefundValidator` | `validate_refundable_payment` (COMPLETED), `validate_status_transition`, `validate_rejection_reason` (**required**), `validate_payment_refunded_transition` (payment → refunded only when fully refunded) |
| `CreditNoteValidator` | existence, `validate_editable` (Draft), `validate_applicable` (ISSUED + not expired + remaining > 0), `validate_voidable` (reason required), `validate_reason`, `validate_expiry_date`, patient exists |
| `DocumentSequenceValidator` | document type valid, sequence row exists, `validate_next_number` (≤ `MAX_SEQUENCE_NUMBER`) |

---

## 11. Workflow Analysis (state machines — all enforced over HTTP)

### 11.1 Invoice (`InvoiceStatus`)

```
DRAFT ──► ISSUED ──► PARTIALLY_PAID ──► PAID        CANCELLED (terminal)
  │          │            │             │               ▲
  │          │            └──► OVERDUE ─┘               │
  │          │                 │                        │
  ├──► CANCELLED               ├──► CANCELLED ──────────┘
  └──► VOID                    └──► VOID (PAID→VOID only)     VOID (terminal)
```

Reachable over HTTP: **DRAFT → ISSUED** (`/issue`) and **DRAFT / ISSUED / PARTIALLY_PAID / OVERDUE → CANCELLED** (`/cancel`) — **PAID cannot be cancelled** (its only transition is VOID, which has no endpoint). `PARTIALLY_PAID/PAID/OVERDUE/VOID` are otherwise **not reachable** through any endpoint (O3/O15). Editable = Draft only.

### 11.2 Payment (`PaymentStatus`)

```
PENDING ──► COMPLETED ──► REFUNDED (terminal)
   │            │
   ├──► FAILED ─┘ (FAILED → PENDING exists in map but no endpoint)
   └──► VOID (terminal)          REVERSED (in map, no endpoint — O15)
```

Reachable over HTTP: **PENDING → COMPLETED/FAILED/VOID**; **COMPLETED → REFUNDED** (side-effect of fully refunding via refund complete). Editable = Pending only; allocatable = Completed.

### 11.3 Receipt (`ReceiptStatus`)

`GENERATED → CANCELLED` (in map; **no cancellation endpoint** — O2). Regenerate requires GENERATED. No editable states.

### 11.4 Refund (`RefundStatus`)

```
PENDING ──► APPROVED ──► COMPLETED (terminal)
   │
   └──► REJECTED (terminal)   — all four transitions have endpoints
```

Editable = Pending (no update endpoint exists though).

### 11.5 Credit note (`CreditNoteStatus`)

```
DRAFT ──► ISSUED ──► APPLIED (terminal)
   │          │
   └──► VOID └──► VOID            EXPIRED (terminal; in map, auto-expiry not implemented)
```

All four transitions (create → draft, issue, void, apply) have endpoints. Editable = Draft. Apply is all-or-nothing.

### 11.6 Full frontend workflow (each step = one HTTP call, server-authoritative)

```
1. Create invoice draft      POST /billing/invoices
2. Edit draft (notes/due)    PATCH /billing/invoices/{id}          [while draft]
3. Issue                     POST /billing/invoices/{id}/issue     → INV-#####, immutable
4. Create payment            POST /billing/payments                → PAY-#####, pending
5. Complete payment          POST /billing/payments/{id}/complete
6. Allocate to invoice       POST /billing/payments/{id}/allocate  {invoice_id, amount}
7. Generate receipt          POST /billing/receipts {payment_id}   → RCT-#####
   (repeat 4–7 for partial payments — one allocation per payment+invoice, O9)
8. Refund (optional)         POST /billing/refunds → approve → complete  (payment → refunded if full)
9. Credit note (optional)    POST /billing/credit-notes → issue → apply (remaining → 0)
10. Cancel invoice (from DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE — **not from PAID**)  POST /billing/invoices/{id}/cancel {reason}
```

---

## 12. Authentication & RBAC

### 12.1 Authentication

Bearer JWT (`OAuth2PasswordBearer(tokenUrl="/auth/login")`); `get_current_user` decodes `sub` (email) → DB User, **inactive users → 401**. All 31 billing endpoints are protected; **no public endpoints**.

### 12.2 Role matrix (exact, from per-router role lists)

| Operation | Allowed roles | Example endpoints |
|---|---|---|
| **READ** (list, detail, allocations, dashboard, summary) | `{ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` | `GET /invoices`, `GET /payments`, `GET /receipts/{id}`, `GET /billing/dashboard` |
| **WRITE** (create + edit drafts/pending, generate receipts, create refunds/credit notes) | same READ set | `POST /invoices`, `PATCH /invoices/{id}`, `POST /payments`, `PATCH /payments/{id}`, `POST /receipts`, `POST /refunds`, `POST /credit-notes` |
| **WORKFLOW** (issue, cancel, complete, fail, void, allocate, deallocate, approve/reject/complete refund, issue/void/apply credit note, regenerate receipt) | `{ADMIN, RECEPTIONIST, CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR}` — **DENTAL_ASSISTANT excluded** | `POST /invoices/{id}/issue`, `POST /payments/{id}/allocate`, `POST /refunds/{id}/approve`, `POST /credit-notes/{id}/apply` |
| **DELETE** (hard delete draft invoice / pending payment) | `{ADMIN}` | `DELETE /invoices/{id}`, `DELETE /payments/{id}` |

- 403 messages: `"Role not assigned"` (no role) / `"Insufficient permissions"` (wrong role) — HTTPException wrapped by the global handler.
- **No ownership scoping**: any READ-role user can read any record; any WRITE-role user can create; no "creator only" or per-doctor isolation.
- **The frontend cannot discover allowed transitions from the API** — hardcode this matrix client-side; the backend remains authoritative.

---

## 13. Search / Filtering / Pagination

| Endpoint | Search | Filters | Sort | Pagination |
|---|---|---|---|---|
| `GET /billing/invoices` | `query` → `invoice_number` OR patient `first_name`/`last_name` ILIKE | `patient_id`, `doctor_id`, `status` (exact), `date_from`, `date_to` (→ **created_at**, O6) | `created_at` (default) \| `updated_at` \| `invoice_number` \| `due_date` \| `status` (O7: `grand_total` falls back) | `page` ≥1, `page_size` 1–100 (default 20) → `{items, total, page, page_size}` |
| `GET /billing/payments` | **none (O8)** | `patient_id`, `payment_method`, `status`, `date_from`, `date_to` (→ created_at) | `created_at` \| `updated_at` \| `payment_number` \| `payment_date` \| `total_amount` \| `status` \| `payment_method` | same |
| `GET /billing/dashboard` | — | `patient_id?` (patient-level summary) | recent: `created_at DESC` (≤5) | — |

`sort_order` default `"desc"` (invoice/payment list routers), regex `^(asc|desc)$` → invalid = 422. Empty result → `{items: [], total: 0, page, page_size}` (200).

---

## 14. Error Handling

### 14.1 Envelope (what the frontend actually receives)

Every error body: `{"success": false, "message": "<string>", "details": <object|null>}`. **Error codes are NOT transmitted (O20).** Branch on HTTP status + `message` (exactly like existing modules' `parseApiError`).

### 14.2 Status-code map (verified from the global handler + exception hierarchy)

| HTTP | Trigger |
|---|---|
| **400** | `HTTPException` from RBAC-adjacent paths only; most business failures use 409/422 (see below) |
| **401** | Missing/expired/invalid JWT; inactive user — `"Could not validate credentials"` |
| **403** | Role denied — `"Role not assigned"` / `"Insufficient permissions"` |
| **404** | `InvoiceNotFound`, `PaymentNotFound`, `ReceiptNotFound`, `RefundNotFound`, `CreditNoteNotFound`, `AllocationNotFound`, `DocumentSequenceNotFound`, `PatientCreditNotFound`, `InvoiceLineItemNotFound`; plus cross-module `PatientNotFound`, `DoctorNotFound`, `AppointmentNotFoundException`, `TreatmentPlanNotFound`, `ItemNotFound`, `DiagnosisNotFound` (FK validation) |
| **409** | `BillingConflictError` subclasses: `InvoiceNotEditable`, `PaymentNotEditable`, `Invalid*StatusTransition` (invoice/payment/receipt/refund/credit-note), `DuplicateInvoiceDetected`, `DuplicateLineItemSequence`, `InvoiceNumberAlreadyUsed`, `CreditNoteNotApplicable`, `PaymentAlreadyAllocated` (reserved for future use) |
| **422** | `BillingValidationError` (`InvoiceValidationFailed`, `LineItemValidationFailed`, `PaymentValidationFailed`, `ReceiptValidationFailed`, `CreditNoteValidationFailed`, `RefundValidationFailed`, `PatientCreditValidationFailed`) **and** `BillingFinancialError` (`NegativeAmountNotAllowed`, `CurrencyMismatch`, `PrecisionExceeded`, `PaymentExceedsInvoice`, `RefundExceedsPayment`, `GrandTotalMismatch`), plus Pydantic request-validation 422 (sanitized `details` array) |
| **500** | `BillingException` subclasses outside the four mapped families (`InvoiceCreationFailed`, `PaymentCreationFailed`, `CreditNoteCreationFailed`, `RefundCreationFailed`, `SequenceReservationFailed`) and any unhandled exception → `"An unexpected error occurred"` |

> **⚠ Duplicate-allocation detail:** `allocate_payment` raises `PaymentValidationFailed` (a `BillingValidationError` → **422**) with the "already has an allocation" message. The router's documented 409 applies to transition conflicts (`InvalidPaymentStatusTransition`/`InvalidInvoiceStatusTransition`, Conflict family) and duplicate-allocation states reachable through other validation paths — **not** to `PaymentValidationFailed`. The UI should treat both 409 and 422 as recoverable inline errors.

### 14.3 Known quirks

- `date_from`/`date_to` semantics ≠ documented (`created_at`, O6).
- Missing required reason (cancel/void/reject) → 422 (validation family), not 400.
- Deleting a pending payment that has a receipt → `IntegrityError` → 500 (O17).
- Allocation amount over balance → 422 (`PaymentExceedsInvoice`), not 409.

---

## 15. Unsupported Features (must NOT appear in the UI)

| Feature | Status | Evidence |
|---|---|---|
| Tax / GST lines, tax rates, tax totals | ❌ Phase 2 placeholder | `tax_rate_id`/`tax_amount` columns exist; `DEFAULT_TAX_RATE=0`; no tax calculation anywhere; schemas call it "(Phase 2)" |
| Insurance claims workflow | ❌ | `INSURANCE` is only a `PaymentMethod` enum value; no claim/coverage fields or endpoints |
| Online payment gateway integration | ❌ | No gateway endpoints; `gateway_metadata` is populated only with `gateway_txn_id = reference_number`; no webhooks |
| Patient wallet / patient credit | ❌ | `PatientCredit` model + repository exist; no service, no endpoints |
| Advance / unallocated payments | ❌ | `PaymentAllocation.invoice_id` is nullable in the schema but `allocate` **requires** `invoice_id`; no unallocated-apply flow |
| Installments / EMI / partial-invoice splitting | ❌ | Not present anywhere |
| Refund / credit-note / receipt **list & detail pages** | ❌ | No GET endpoints (O1) |
| Invoice **void** action | ❌ | `VOID` in state machine; only `cancel` is routed |
| Receipt cancellation | ❌ | `CANCELLED` in state machine; only generate/regenerate routed |
| Payment **reversal** | ❌ | `REVERSED` in state machine; not routed (O15) |
| Payment → invoice auto-status sync (`paid`/`partially_paid`/`overdue`) | ❌ | O3 |
| Reports: aging, revenue, cashflow, daily/monthly/yearly, KPIs, statistics | ❌ | Explicitly documented NOT implemented in the dashboard router |
| Tax reports / accounting exports / GL integration | ❌ | None |
| PDF / print generation | ❌ | Receipts return structured JSON (`PrintableReceipt`); no rendering |
| Document upload / attachments on invoices | ❌ | Not present |
| Editing issued invoices, completed payments, generated receipts, applied credit notes | ❌ | Immutability enforced (409/422) |
| Partial credit-note application | ❌ | Apply sets `remaining_balance = 0` wholesale |
| Multi-currency on one document | ❌ | Single currency enforced (`validate_currency_consistency`) |

---

## 16. API Capabilities Matrix

| Feature | Supported | Endpoint(s) | Frontend implication | Backend limitation |
|---|---|---|---|---|
| Invoice list + search + filters + sort | ✅ | `GET /invoices` | Full DataTable with SearchBar, filter panel (patient/doctor/status/date), sortable columns, Pagination | No amount filter; `grand_total` sort falls back (O7); date filters = created_at (O6) |
| Invoice detail | ✅ | `GET /invoices/{id}` | Detail page with items table, patient/doctor/plan/appointment, financials | `paid_amount`/`outstanding_amount` always 0.00 (O4) |
| Create invoice (draft) | ✅ | `POST /invoices` | Create Drawer: patient picker + dynamic line items | net_amount is server-computed (O10); temp DRAFT- number (O11) |
| Edit draft | ✅ | `PATCH /invoices/{id}` | Edit drawer: notes + due date only | **No line-item editing** (O1 sprint scope) |
| Issue invoice | ✅ | `POST /invoices/{id}/issue` | Confirmation dialog (no body) | Draft-only; assigns INV-##### |
| Cancel invoice | ✅ | `POST /invoices/{id}/cancel` | Confirmation dialog with required reason | DRAFT/ISSUED/PARTIALLY_PAID/OVERDUE (**not PAID**); reason required |
| Delete draft invoice | ✅ | `DELETE /invoices/{id}` | Confirm dialog | **ADMIN only**; hard delete |
| Payment list + filters + sort | ✅ | `GET /payments` | DataTable (patient/method/status/date filters) | **No free-text search (O8)**; date filters = created_at |
| Create payment | ✅ | `POST /payments` | Record Payment drawer (patient, method, amount, date, reference, notes) | Pending status first; PAY-##### at create |
| Complete / fail / void payment | ✅ | `POST .../complete` `/fail` `/void` | Action buttons + confirm dialogs | Pending-only; reason optional (audit) |
| Payment detail + allocations | ✅ | `GET /payments/{id}`, `GET .../allocations` | Detail page incl. allocation list (refund vs payment badges) | — |
| Allocate payment → invoice | ✅ | `POST .../allocate` | Allocate dialog: pick payable invoice + amount | Needs COMPLETED payment + payable invoice; one allocation per pair (O9); amount ≤ balances |
| Deallocate | ✅ | `POST .../deallocate` | Confirm dialog | Removes allocation; no status change |
| Generate / view / regenerate receipt | ✅ | `POST /receipts`, `GET /receipts/{id}`, `POST .../regenerate` | Generate action + receipt detail view; **no list** — surface receipts inside payment detail | amount=payment total; 1 per payment (O2) |
| Refund lifecycle | ✅ | `POST /refunds` → approve/reject/complete | Create Refund dialog + workflow actions from payment detail | **No refund list/detail endpoints (O1)** — track via payment allocations |
| Credit note lifecycle | ✅ | `POST /credit-notes` → issue/void/apply | Create + workflow actions from invoice detail | **No list/detail endpoints (O1)**; apply is all-or-nothing |
| Billing dashboard | ✅ | `GET /billing/dashboard` | KPI cards (6 money + 4 count), recent invoices (5), recent payments (5), optional patient summary | Correct SQL aggregates (O5) |
| Billing summary widget | ✅ | `GET /billing/summary` | Lightweight totals widget | — |
| Tax, insurance, gateway, wallet, reports, PDF, list views | ❌ | — | **Do not build** | See §15 |

---

## 17. Backend Risks & Frontend Implications

| # | Risk | Severity | UI mitigation / workaround |
|---|---|---|---|
| R1 | Invoice status never reflects payment progress (O3) | 🔴 | Render a derived "Payment progress" badge from the **payment detail/allocations** data and dashboard totals; never claim `invoice.status == paid` from list data. On the invoice detail page, treat `issued` + zero allocations as "outstanding"; do not filter lists by paid/partially_paid via the status filter expecting self-maintaining data |
| R2 | `financials.paid_amount` / `outstanding_amount` are always `0.00` in responses (O4) | 🔴 | Never render these two fields from API data. Compute display values client-side (dashboard totals are correct; per-invoice compute from payment allocations fetched separately, or omit) |
| R3 | No refund/credit-note/receipt list or detail endpoints (O1) | 🟠 | Design navigation so Receipts, Refunds, and Credit Notes are **action surfaces reachable from Payment detail / Invoice detail**, not top-level list modules. No empty-state "list" pages for these |
| R4 | No free-text payment search (O8) | 🟡 | Provide patient/method/status/date filters + server pagination; no search box on payments (or do client-side filtering of loaded page only — not recommended) |
| R5 | Line items not editable after draft creation via API (O1 sprint scope) | 🟠 | Create-draft drawer must capture full line items up front; edit drawer limited to notes + due date |
| R6 | Date filters apply to `created_at` (O6) | 🟡 | Label filters "created between" to match backend behavior |
| R7 | Allocation is 1:1 per payment+invoice (O9) | 🟡 | Guide partial-payment flow: new payment per additional allocation; allow deallocate-then-reallocate |
| R8 | Draft invoice shows temp `DRAFT-XXXXXXXX` (O11) | 🟡 | Display "Draft — number assigned on issue" instead of a fake number |
| R9 | Sequence cap 999 per series (O13) | 🟡 | Treat as an ops concern; surface backend 422 message verbatim if hit |
| R10 | Payment delete can 500 if a receipt exists (O17) | 🟡 | Hide/disable delete on payments that have a receipt (infer from `allocation_count`/payment detail `receipt`), and surface generic 500 gracefully |
| R11 | `grand_total` sort silently falls back (O7) | 🟢 | Don't offer a grand-total sort column |
| R12 | Currency codes other than USD/EUR/GBP/INR rejected | 🟢 | Render currency from response; don't offer a currency editor beyond defaults |
| R13 | Error codes not serialized (O20) | 🟠 | Use existing `parseApiError` (message + fieldErrors) pattern; branch on status |

---

## 18. Frontend Contract (exact)

### 18.1 Endpoints the UI may call (31)

See §4. Every call requires the Bearer token; `page_size` ≤ 100; `sort_order` ∈ {asc, desc}; `extra="forbid"` on all bodies.

### 18.2 Non-negotiable rules

1. **Never** render `financials.paid_amount` / `financials.outstanding_amount` from invoice responses (always 0.00).
2. **Never** present invoice status `paid`/`partially_paid`/`overdue` as actionable — they are not reachable via API.
3. **Never** build list pages for refunds, credit notes, or receipts (no endpoints).
4. **Never** build void-invoice, reverse-payment, cancel-receipt, edit-issued, tax, insurance, gateway, wallet, installment, or reporting screens.
5. Line-item totals: input unit_price/quantity/discount; compute net/grand client-side for UX, but trust the server response after save.
6. Require reasons for: cancel invoice, void credit note, reject refund; pass them to the API.
7. Receipts: one per payment; regenerate only; view from payment detail.
8. Payment flow: create (pending) → complete → allocate → receipt (4 separate calls; each has its own toast/error handling).
9. Refund flow: create → approve (or reject w/ reason) → complete; fully refunded payment flips to `refunded`.
10. Credit-note flow: create → issue → apply (or void w/ reason); apply zeroes remaining balance.

### 18.3 Validation mirror (frontend form rules = backend exactly)

| Field | Rule |
|---|---|
| Invoice items | description 1–500; quantity ≥1; unit_price ≥0; discount ≥0 & ≤ subtotal; sequence unique; at least 1 item |
| invoice_date ≤ due_date; due_date ≥ invoice_date (default +30d) | |
| Payment | total_amount > 0; method ∈ 7 enum values; reference ≤100; notes ≤500 |
| Refund | amount > 0; reason 1–1000; amount ≤ payment refundable balance |
| Credit note | amount > 0 & ≤ invoice grand total; reason 1–2000 |
| Reasons | cancel 1–500; void credit note 1–1000; reject refund required |
| Currency | exactly 3 chars; USD/EUR/GBP/INR |

### 18.4 Error mapping

Use the existing `parseApiError` (`frontend/src/services/apiError.ts`): `message` → banner, `fieldErrors` → inline 422s, `kind` auth/forbidden/not-found branching. No new error parsing. Both 409 and 422 may be recoverable workflow errors (see §14.2 note).

---

## 19. Backend Source Map (verification appendix)

| Claim area | Files verified |
|---|---|
| Router registration | `backend/main.py`, `backend/app/modules/billing/routers/__init__.py` |
| Endpoints | `routers/invoice.py`, `payment.py`, `receipt.py`, `refund.py`, `credit_note.py`, `dashboard.py` |
| Schemas | `schemas/base.py`, `common.py`, `pagination.py`, `types.py`, `validators.py`, `mixins.py`, `metadata.py`, `summaries.py`, `invoice.py`, `invoice_item.py`, `payment.py`, `receipt.py`, `refund.py`, `credit_note.py`, `dashboard.py` |
| Services | `services/invoice_service.py`, `payment_service.py`, `receipt_service.py`, `refund_service.py`, `credit_note_service.py`, `document_sequence_service.py`, `financial_calculation_service.py`, `billing_orchestration_service.py`, `base.py` |
| Repositories | `repositories/invoice_repository.py`, `payment_repository.py` (+ credit_note/refund/receipt/document_sequence/audit) |
| Models | `models/invoice.py`, `invoice_item.py`, `payment.py`, `payment_allocation.py`, `receipt.py`, `refund.py`, `credit_note.py`, `document_sequence.py`, `audit_log.py`, `patient_credit.py`, `models/__init__.py` |
| Validators / state machine | `validators/state_machine.py`, `invoice_validator.py`, `payment_validator.py`, `financial_validator.py`, `protocols.py` |
| Enums / constants / exceptions | `enums.py`, `constants.py`, `exceptions.py` |
| Mappers | `mappers/invoice_mapper.py`, `payment_mapper.py` (financial-summary computation) |
| DI / RBAC / errors | `dependencies.py`, `app/modules/rbac/permissions.py`, `app/core/constants.py`, `app/core/exception_handlers.py` |
| Tests cross-reference | `backend/tests/modules/billing/*`, `backend/tests/integration/billing/*` |
