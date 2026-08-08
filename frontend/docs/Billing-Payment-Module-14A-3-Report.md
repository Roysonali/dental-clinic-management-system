# Billing Payment Module — Sprint 14A.3 Implementation Report

**Module:** Payments (`/billing/payments` + `/billing/payments/:paymentId`)
**Phase:** 14A.3 (Billing build-out — Dashboard 14A.1 → Invoices 14A.2 → **Payments 14A.3**)
**Status:** Complete — all quality gates pass, browser-verified across the full viewport matrix.

---

## 1. Backend contract reviewed

The implementation was written strictly against the existing Billing backend
(`backend/app/modules/billing/`). No endpoints, fields, permissions, or
lifecycle rules were invented. Files reviewed before any frontend code:

| Backend file | What it locked down |
|---|---|
| `routers/payment.py` | Endpoint surface, query params, RBAC role sets, error semantics |
| `schemas/payment.py` | Request/response DTO shapes (`PaymentCreateRequest`, `PaymentRead`, `PaymentListResponse`, `PaymentAllocationSummary`) |
| `services/payment_service.py` | Lifecycle + allocation orchestration, "pending → complete before allocate" rule |
| `repositories/payment_repository.py` | `ALLOWED_SORT_FIELDS`, filter application |
| `mappers/payment_mapper.py` | Aggregate → DTO mapping (financials, allocations, patient summary) |
| `enums.py` | `PaymentMethod`, `PaymentStatus`, `PaymentAllocationType` |
| `constants.py` | `PAYMENT_TRANSITIONS`, `PAYMENT_NUMBER_PREFIX` (`PAY-`), length limits |
| `routers/receipt.py` | Receipt generate/regenerate surface used by the detail Receipt card |
| `schemas/summaries.py` | Nested `PatientSummary` shape |

### Payment lifecycle (backend-authoritative)

```
PENDING ──complete──▶ COMPLETED ──refund (future phase)──▶ REFUNDED
   │  │  │                              │
   │  │  └──void────▶ VOID              └──reverse──▶ REVERSED
   │  └─────fail────▶ FAILED
   └─────delete (admin, hard delete)
```

- **PENDING** — editable, deletable (admin), completable, failable, voidable.
- **COMPLETED** — allocatable (when unallocated > 0), receipt-generatable.
- **FAILED / VOID / REFUNDED / REVERSED** — terminal; no lifecycle actions.

### RBAC (mirrored from the backend, never hardcoded per-user)

| Operation | Roles (backend `_PAYMENT_*_ROLES`) |
|---|---|
| Read list/detail/allocations | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, doctors |
| Create / update | ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, doctors |
| Workflow (complete/fail/void/allocate/deallocate) | ADMIN, RECEPTIONIST, doctors |
| Delete | ADMIN only |

The client does **not** resolve role names for read routes (backend enforces via
403); only the admin-only Delete action uses the existing `PermissionGate`
infrastructure (`usePermission`) to hide the action pre-emptively — the backend
remains authoritative.

---

## 2. Endpoints used (request/response mapping)

| UI action | Endpoint | Payload → response |
|---|---|---|
| List page load / filter / sort / page | `GET /billing/payments` | query `patient_id, payment_method, status, date_from, date_to, sort_by, sort_order, page, page_size` → `PaymentListResponse` |
| Row click → detail | `GET /billing/payments/{id}` | — → `PaymentRead` (full aggregate incl. `financials`, `allocations`, `creator/updater`) |
| Record payment (drawer) | `POST /billing/payments` | `{patient_id, payment_method, total_amount, payment_date, reference_number?, notes?}` → `PaymentRead` (status `pending`) |
| Complete | `POST /billing/payments/{id}/complete` | — → `PaymentRead` |
| Mark failed | `POST /billing/payments/{id}/fail` | `{reason?}` → `PaymentRead` |
| Void | `POST /billing/payments/{id}/void` | `{reason?}` → `PaymentRead` |
| Allocate | `POST /billing/payments/{id}/allocate` | `{invoice_id, amount}` → `PaymentAllocationSummary` |
| Deallocate | `POST /billing/payments/{id}/deallocate` | `{invoice_id}` → 204 |
| Generate receipt (detail card) | `POST /billing/receipts` | `{payment_id}` → `ReceiptRead` |

> **Note:** the backend's dedicated `GET /billing/payments/{id}/allocations`
> endpoint exists but is **not** called by the UI — the detail page renders
> `allocations` from the full `PaymentRead` aggregate (which includes them),
> avoiding a redundant second fetch. Allocation mutations invalidate
> `paymentDetail(id)`, which is what the detail page actually reads.

**Deviations kept minimal:** `PATCH /{id}` (update pending metadata) and the
receipt regenerate endpoint exist in the backend but are **not** surfaced as UI
actions — the reference screen shows no edit-metadata control and
regeneration would be a Receipt-phase feature. Not invented, not wired.

---

## 3. Query architecture

Centralized key factory in `hooks/billing/billingQueryKeys.ts` (extended, not
forked):

```ts
['billing', 'payments', 'list', params]        // server-side filter/sort/page
['billing', 'payments', 'detail', id]
['billing', 'payments', 'allocations', id]     // kept for future/audit use
['billing', 'receipts', 'by-payment', id]      // cache slot for generated receipt
```

- All keys share the `'billing'` root so **every** payment mutation
  invalidates the dashboard and list/detail (`invalidateQueries(['billing'])`)
  — the established 14A.2 convention.
- Hooks: `usePayments`, `usePayment`, `usePaymentFilters` (state hook),
  `usePaymentMutations` (create/complete/fail/void/allocate/deallocate/
  delete/generate-receipt).
- `usePaymentFilters` owns debounced page-reset + the stable plain-object
  params fed into the query key (identical filter sets share one cache entry).
- **`useInvoices` gained an `enabled` option** (same pattern as the 14A.2
  `useTreatmentPlans` change): the Allocate dialog now defers its payable-
  invoice fetch until it actually opens, so a closed dialog never issues a
  network request.

---

## 4. UI screens implemented

### Create-flow navigation

On successful create, the app navigates to the new payment's **detail page**
(`/billing/payments/{id}`). This intentionally differs from the Invoice create
flow (which stays on the list): a fresh payment is Pending and its detail page
is where Complete/Allocate/Generate-receipt actions live, so landing there
presents the immediate next step rather than a list refresh.

### 4.1 Payment list (`/billing/payments`)

- **Page header** — `PageHeader` with "Payments" title + "Billing" muted
  context; primary `+ Record payment` button top-right (wired to open the
  drawer; dashboard "Record payment" CTA navigates here).
- **Filter bar** — compact outlined controls matching the reference:
  Patient (PatientPicker), Method, Status, Payment from, Payment to,
  Sort by, Order. "Filters apply on the server" muted note on the right.
  Responsive `flex-wrap` rows — **never** a fixed-width single row.
- **Table** (`PaymentTable`, shared `DataTable`) — Payment Number (primary,
  muted date/created sub-line), Status (StatusBadge via
  `PAYMENT_STATUS_VARIANTS`), Patient (name primary / code muted), Method,
  Total Amount / Allocated / Unallocated (shared `formatCurrency`,
  right-aligned tabular), Allocations count, Payment Date. Server-side sort
  via sortable headers; `tableClassName="min-w-[1024px]"` so **only the table
  container** scrolls horizontally when tight.
- **Pagination** — shared `Pagination` with "N results", rows-per-page select,
  Prev/Next, all fed by backend `total/page/page_size`.
- **Row actions** — state-machine driven (`getPaymentActions`): Pending →
  Complete / Mark as failed / Void (+ Delete admin-gated via `PermissionGate`);
  Completed → Allocate (only when unallocated > 0).

### 4.2 Payment detail (`/billing/payments/:paymentId`)

- Header card: `← Back to Payments`, payment number `PAY-xxxxx` (h1), status
  badge, `v{version}` chip, patient + reference sub-line, and
  state-machine-driven actions on the right.
- **Overview cards row** — Patient (name/code), Method (label + reference),
  Payment Date + Recorded by. Uppercase micro-labels, strong values.
- **Two-column grid** (`lg:grid-cols-3`): left (2 cols) Allocations card
  (header + Allocate/Deallocate actions, invoice / patient / grand total /
  allocated / type / created) and Notes card (wraps long text); right column
  Financial Summary (total / allocated / refunded / emphasized unallocated),
  Receipt card, Record card (created/updated/version).

### 4.3 Drawers & dialogs

- **Record Payment drawer** — right-side, ~500–520px (full width on mobile);
  header "Record payment" + "Saved as PENDING · number PAY-##### assigned on
  save" + close; form body scrolls independently; **pinned footer**
  (Cancel / Save payment); informative callout about the pending→complete
  lifecycle; React Hook Form + Zod (`paymentFormSchema`), inline field errors
  + `ValidationSummary`; valid-HTML `<form>` submit semantics (no regression
  of the 14A.2 submit fix).
- **Complete payment dialog** — green check icon, summary card, blue primary.
- **Fail payment dialog** — red icon, optional reason (0/500), red destructive
  CTA.
- **Void payment dialog** — neutral Ban icon, optional reason, red CTA.
- **Allocate payment dialog** — radio invoice picker (payable statuses only,
  outstanding shown, selected row tinted), bounded Allocation Amount input
  (min of unallocated + outstanding), calculation card (unallocated /
  invoice outstanding / remaining), blue Allocate.
- **Deallocate dialog** — destructive, shows invoice + allocated + new
  unallocated balance.
- **Delete payment dialog** — admin-gated, Pending-only, destructive red CTA.

All dialogs use the shared `Modal` (centered, backdrop, focus trap, Escape,
`max-w` + `max-h-[85vh]` with internal scroll so the footer stays reachable).

---

## 5. Component architecture

Mirrors the Invoice module exactly (no parallel patterns):

```
src/
├─ types/billing.ts                  # Payment* + Receipt* types (contract-aligned)
├─ constants/billing.ts              # PAYMENT_*_VARIANTS, options, limits
├─ services/billingService.ts        # listPayments/getPayment/createPayment/… (+ tests)
├─ hooks/billing/
│  ├─ billingQueryKeys.ts            # payment keys added
│  ├─ usePayments.ts / usePayment.ts
│  ├─ usePaymentFilters.ts
│  └─ usePaymentMutations.ts
├─ utils/
│  ├─ paymentStateMachine.ts         # getPaymentActions / canAllocate / transitions
│  ├─ paymentFormSchema.ts           # Zod schema (patient, method, amount, date, …)
│  └─ paymentFormUtils.ts            # values → create payload
├─ pages/billing/PaymentListPage.tsx / PaymentDetailsPage.tsx
└─ components/billing/payments/
   ├─ PaymentToolbar / PaymentTable / PaymentListPermission
   ├─ PaymentDetailActions / PaymentOverviewCards / PaymentFinancialSummaryCard
   │  PaymentAllocationsCard / PaymentReceiptCard / PaymentRecordCard / PaymentNotesCard
   ├─ PaymentDetailSkeleton / PaymentDetailError / PaymentDetailPermission
   ├─ containers/PaymentListContainer / PaymentDetailsContainer
   └─ dialogs/ (RecordPaymentDrawer, Complete/Fail/Void/Allocate/Deallocate/Delete)
```

---

## 6. States

| State | Behavior |
|---|---|
| Loading | Skeleton table rows + skeleton detail layout (`PaymentDetailSkeleton`); toolbar stays put; no full-page spinner, no layout shift |
| Empty (no payments at all) | `EmptyState` — "No payments yet" + Record payment CTA; page header + filters retained |
| Filtered-empty | Distinct "No payments match these filters" + Clear filters (different copy from the true-empty state, per backend counts) |
| Error | Table error panel + top `Alert` ("Couldn't load payments") with Retry → `refetch()`; safe copy via `parseApiError`, never raw exceptions |
| Permission denied | 403 → `PaymentListPermission` / `PaymentDetailPermission` (lock icon, "You don't have permission", `Error 403 · Insufficient permissions`); **never auto-retried** (`shouldRetryQuery`) |

---

## 7. Responsive / overflow behavior (browser-verified)

- Container roots use `w-full min-w-0` (the 14A.2 root-cause fix carried
  forward) — no page can exceed the viewport.
- Filters wrap (no clipping) at every width; mobile uses stacked full-width
  controls.
- Only the table container scrolls horizontally (`overflow-x-auto` on the
  DataTable wrapper + `min-w-[1024px]`).
- Drawer: desktop ~500–520px, `max-sm` full-width; body scrolls, footer pinned.
- Dialogs: `max-w-lg`, `max-h-[85vh]` + internal scroll; footer stays visible.
- Detail grid collapses 3-col → single column below `lg`.

---

## 8. Accessibility pass

- Labels associated with all inputs (`FormField` label `htmlFor`); required
  indicators (`*`) on Patient / Payment Method / Total Amount / Payment Date.
- Table: accessible `ariaLabel`, `<th scope>` headers via shared DataTable.
- Dialogs: `Modal` focus trap, Escape close, `aria-labelledby` via `ariaLabel`.
- Status badges include text labels (not color-only); financial columns
  `tabular-nums`.
- Icon buttons (e.g. row actions) have accessible names (`Complete payment
  PAY-00001`); loading states announce via `aria-busy` where the DataTable
  supports it; empty/error/permission states are meaningful text.
- The shared `DatePicker` (improved in 14A.2) carries value in its
  accessible name ("Payment Date: Jul 23, 2026").

---

## 9. Tests added/updated (all passing)

| File | Coverage |
|---|---|
| `utils/paymentStateMachine.test.ts` | transitions, action availability per status |
| `utils/paymentFormSchema.test.ts` | required fields, amount > 0, method enum, date |
| `utils/paymentFormUtils.test.ts` | values → create payload mapping |
| `hooks/billing/usePaymentFilters.test.ts` | param building, debounce, page reset, clear |
| `services/billingService.test.ts` | every payment + receipt endpoint (URL, payload, response, error) |
| `components/billing/payments/PaymentToolbar.test.tsx` | controls, labels, wrap containers, filter callbacks |
| `components/billing/payments/PaymentTable.test.tsx` | columns, hierarchy, sort headers, actions, admin delete gate |
| `dialogs/RecordPaymentDrawer.test.tsx` | header, fields, disabled-until-valid, submit mapping, inline errors, server error alert |
| `containers/PaymentListContainer.test.tsx` | list render, filter params, row nav, 403 no-retry, 500 retry, create flow, complete/fail/void/allocate/delete dialogs, pagination, overflow-regression guard |
| `containers/PaymentDetailsContainer.test.tsx` | aggregate render, financial summary, allocations, receipt card, record metadata, notes, action visibility, lifecycle dialogs |
| Updated: `BillingDashboardHeader.test.tsx`, `containers/BillingDashboardContainer.test.tsx` | Record payment CTA + View all now wired to Payments routes |

The two full-suite "flaky" tests (PatientPicker option / allocate invoice row
arrival under parallel load) were hardened with explicit wait timeouts — the
same load-flakiness class fixed in 14A.2.

---

## 10. Browser verification (actual Chrome sessions)

Login `uiadmin@denscare.com / Secure@Pass1` against the live Vite dev server +
PostgreSQL backend (real seeded data: `PAY-00001`, Completed, $1,500.00).

| Viewport | scrollWidth = innerWidth | Filters | Drawer / Table |
|---|---|---|---|
| 1440×900 | 1440 = 1440 ✅ | full set, clean grid | — |
| 1280×800 | 1280 = 1280 ✅ | full set | drawer left 717 / right 1280 (fits), Save payment + Cancel visible |
| 1024×768 | 1024 = 1024 ✅ | wraps into 4 clean rows | — |
| ~504px (Chrome min) | 504 = 504 ✅ | stacked | table scrolls internally; drawer right edge 504 = viewport ✅ |

- **Detail page** — renders the two-column layout (info cards / allocations /
  notes left; financial summary / receipt / record right); 1280/1280, no
  console errors after the receipt-cache fix.
- **Drawer body scroll** — after programmatically scrolling the form body to
  the bottom, the pinned footer (Save payment / Cancel) stays visible.
- **No uncontrolled horizontal browser scrolling at any width** — sidebar and
  header remain stable; only the table container scrolls.

### Console error found & fixed during verification

`[billing, receipts, by-payment, …]: No queryFn was passed` on the detail
page — the cache-read-back `useQuery` for the generated receipt declared a key
and `enabled: false` but no `queryFn`. Fixed with a never-executed
`queryFn: () => null` (disabled queries never run it). Re-verified: clean
console, all tests green.

---

## 11. Quality gates (final)

| Gate | Result |
|---|---|
| `npm test` | ✅ **1367/1367 passed** (179 files), stable across consecutive full runs |
| `npm run lint` | ✅ clean |
| `tsc -b` | ✅ clean |
| `npm run build` | ✅ succeeds |

---

## 12. Deviations from the reference — and why

| Reference element | Decision |
|---|---|
| Receipt card "Open receipt / Regenerate" buttons | Only **Generate receipt** is surfaced. There is no GET-by-payment lookup and no receipt-id known without a receipt-store phase; regeneration is a Receipt-phase workflow. |
| "Allocate / Deallocate" header actions on every detail | Allocate shows only when `completed && unallocated > 0`; Deallocate only per-allocation, via the allocations card. Backend lifecycle is authoritative. |
| Refunded-status / refund flows | Not rendered as actions — refunds are a **separate future aggregate** (backend `PaymentService` has no `refund_payment()`; a future `RefundRouter` will expose it). |
| Method examples (BANK TRANSFER two-line, UPI) | All values come from `PaymentMethod` labels; multi-word methods wrap naturally, no invented methods. |
| "Filters apply on the server" note | Preserved — filters are always server-side query params. |
| Example data (PAY-00869, Amara Okonkwo, Dana Whitfield) | Used only as visual reference; fixtures in tests are synthetic; UI renders real backend data. |

## 13. Backend limitations (not UI defects)

- No `GET /receipts?payment_id` — a generated receipt is cached client-side
  from the `POST /receipts` response for the session (documented in
  `billingQueryKeys.ts` and `PaymentDetailsContainer`). A future Receipt
  phase / list endpoint can replace this cleanly.
- No bulk operations, exports, or reports — intentionally not built.
- `PATCH /{id}` metadata editing is backend-supported but not surfaced (no
  reference control; avoids inventing a workflow).

## 14. Remaining limitations

- Receipt persistence is session-cache only until the Receipt module ships.
- Payment list rows-per-page options (10/20/50/100) respect the backend
  `page_size ≤ 100`.
- The dashboard's "Recent Payments" section now links through; the payments
  empty-state within Recent Payments remains an aggregate of backend totals.

---

*Backend untouched. No Billing contract modified. All UI behavior maps to a
real endpoint and a real lifecycle rule.*
