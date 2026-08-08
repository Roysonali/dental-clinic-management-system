# Sprint 14A.2 — Billing Invoice Module Implementation Report

Invoice Management (Phase 2 of the Billing build-out) for the DensCare dental
clinic management system. Scope limited to **Invoices only** — Payments,
Receipts, Refunds, Credit Notes and Billing Reports were intentionally **not**
implemented (Phases 3–6). The Billing Dashboard (Phase 1) was not redesigned;
its Invoice quick actions were wired to the new routes.

All endpoint names, fields, statuses, transitions, permissions and limits below
were verified against the actual backend (`backend/app/modules/billing/`) —
the backend is the single source of truth.

## 1. Files created

```
frontend/src/components/billing/invoices/
  InvoiceToolbar.tsx                Server-side search/filter/sort toolbar
  InvoiceTable.tsx                  List table (DataTable), state-machine actions
  InvoiceListPermission.tsx         403 permission state (list)
  InvoiceDetailActions.tsx          Header lifecycle actions (draft vs issued vs paid)
  InvoiceDetailSkeleton.tsx         Detail loading skeleton layout
  InvoiceDetailError.tsx            Detail error state (safe copy + Retry + Back)
  InvoiceDetailPermission.tsx       Detail 403 permission state
  InvoiceSummaryCards.tsx           Patient / Doctor / Treatment Plan / Appointment cards
  InvoiceLineItemsTable.tsx         Line-items table (qty, unit price, discount, net)
  InvoiceFinancialSummaryCard.tsx   Subtotal / discount / tax / grand total
  InvoiceRecordInfo.tsx             Created/updated by+at, invoice/due date, version
  InvoiceNotesCard.tsx              Notes card (no truncation)
  LineItemsEditor.tsx               Create-drawer dynamic line-item array
  containers/InvoiceListContainer.tsx     List orchestration (filters, drawers, dialogs)
  containers/InvoiceDetailsContainer.tsx  Detail orchestration (lifecycle actions)
  dialogs/CreateInvoiceDrawer.tsx   New draft invoice drawer (≈40–45% width, sticky footer)
  dialogs/EditInvoiceDrawer.tsx     Edit-draft drawer (notes + due date only)
  dialogs/IssueInvoiceDialog.tsx    Issue confirmation (send icon)
  dialogs/CancelInvoiceDialog.tsx   Destructive cancel with required reason
  dialogs/DeleteInvoiceDialog.tsx   Destructive delete-draft confirmation
  (+ a test file for each, listed in §13)

frontend/src/hooks/billing/
  useInvoices.ts                    List query (server-side params)
  useInvoice.ts                     Detail query (lazy-enabled for edit prefill)
  useInvoiceFilters.ts              Server-side filter state reducer
  useInvoiceMutations.ts            create / update-draft / issue / cancel / delete

frontend/src/utils/
  invoiceStateMachine.ts            Backend transition → action mapping
  invoiceFormSchema.ts              Zod forms mirroring backend bounds
  invoiceFormUtils.ts               Form values ↔ backend payload converters

frontend/src/pages/billing/
  InvoiceListPage.tsx               /billing/invoices
  InvoiceDetailsPage.tsx            /billing/invoices/:invoiceId

frontend/src/services/billingService.test.ts
```

## 2. Files modified

```
frontend/src/types/billing.ts                       Invoice list/detail/create/update types (+ sort fields)
frontend/src/constants/billing.ts                   Status options, sort options, page sizes, limits
frontend/src/services/billingService.ts             Invoice endpoint calls (list/get/create/update/issue/cancel/delete)
frontend/src/hooks/billing/billingQueryKeys.ts      invoiceList / invoiceDetail factories + root invalidation
frontend/src/hooks/treatmentPlans/useTreatmentPlans.ts  Expose enabled flag (used by create drawer)
frontend/src/utils/date.ts                          addDaysISO / todayLocalISO helpers
frontend/src/routes/routes.ts                       BILLING_INVOICES / BILLING_INVOICE_DETAIL constants
frontend/src/routes/AppRouter.tsx                   Lazy invoice list + detail routes (ProtectedRoute)
frontend/src/layouts/components/navigation/navigation.config.ts  "Invoices" item under Billing
frontend/src/components/billing/BillingDashboardHeader.tsx      "New invoice" → Invoice List route
frontend/src/components/billing/RecentInvoices.tsx              "View all" → Invoice List route
frontend/src/components/billing/BillingDashboardEmptyState.tsx  "New invoice" CTA → Invoice List route
frontend/src/components/billing/BillingDashboardHeader.test.tsx / BillingDashboardContainer.test.tsx  updated for the wired CTAs
```

## 3. Invoice endpoints used

| Endpoint | Purpose |
| --- | --- |
| `GET /billing/invoices` | Server-side paginated list with `search`, `patient_id`, `doctor_id`, `status`, `date_from`, `date_to`, `page`, `page_size`, `sort_by`, `sort_order` |
| `GET /billing/invoices/{id}` | Full aggregate (patient/doctor/plan/appointment, items, financials, audit) |
| `POST /billing/invoices` | Create draft invoice |
| `PATCH /billing/invoices/{id}` | Update draft (only `notes` + `due_date`) |
| `POST /billing/invoices/{id}/issue` | Issue draft (assigns permanent number) |
| `POST /billing/invoices/{id}/cancel` | Cancel (requires `cancellation_reason`) |
| `DELETE /billing/invoices/{id}` | Delete draft (admin-only) |

No other endpoints are consumed; no endpoint is invented.

## 4. Request/response contracts consumed

- **`InvoiceListItem`** — `invoice_number`, `status`, patient/doctor summaries,
  `invoice_date`, `due_date`, `financials {currency_code, subtotal,
  discount_total, tax_total, grand_total, paid_amount, outstanding_amount}`,
  `item_count`, `created_at`.
- **`InvoiceRead`** — the above plus `document_type`, treatment-plan /
  appointment summaries, `creator`/`updater`, `notes`, `cancellation_reason`,
  `void_reason`, `items[]`, `version`, `doc_version`, `created_by/updated_by`,
  `updated_at`.
- **`InvoiceCreatePayload`** — `patient_id` (required), `invoice_date` +
  `due_date` (due ≥ invoice), `currency_code`, `items[]` (≥ 1), optional
  `treatment_plan_id` / `appointment_id` / `doctor_id` / `notes`.
- **`InvoiceItemCreatePayload`** — `description`, `quantity`, `unit_price`,
  `discount_type`, `discount_value`, `net_amount`, `sequence_number` — mirroring
  the backend's own `_compute_item_net_amount` rule
  `net = max(0, unit_price × quantity − discount_value)`.
- **`InvoiceDraftUpdatePayload`** — `due_date`, `notes` (only fields the
  backend PATCH accepts on a draft).
- **`InvoiceCancelPayload`** — `cancellation_reason` (1–500 chars, required).

## 5. React Query hooks

- `useInvoices(params)` — key `['billing','invoices','list',params]`,
  `placeholderData: keepPreviousData`, `retry: shouldRetryQuery` (never retries
  401/403).
- `useInvoice(id, { enabled })` — key `['billing','invoices','detail',id]`;
  the list page enables it lazily only when the Edit drawer opens.
- `useInvoiceFilters()` — controlled server-side filter state (search debounce,
  status/patient/doctor/date range, page/page_size, sort).
- `useCreateInvoice` / `useUpdateDraftInvoice` / `useIssueInvoice` /
  `useCancelInvoice` / `useDeleteInvoice` — each invalidates
  `invalidateQueries({ queryKey: ['billing'] })` on success, refreshing the
  affected list, detail and the **Billing Dashboard** through the shared root.

## 6. Components created vs reused

**Created (module-scoped):** the 20 components in §1 (toolbar, table, detail
cards, dialogs/drawers, state components).

**Reused (no duplicates):** `DataTable` (+ `SortState`), `Pagination`,
`Drawer`, `Modal`, `Button`/`IconButton`, `Input`/`Select`/`Textarea`/
`DatePicker`, `StatusBadge` (with `INVOICE_STATUS_VARIANTS`), `Tooltip`,
`Skeleton`, `EmptyState`, `ResultState`, `Alert`, `ToastContainer`, `Icon`,
`Card`, `Form`/`FormActions`/`ValidationSummary`, `PatientPicker`,
`PermissionGate`, `usePermission`, `parseApiError`, `formatCurrency`,
`formatISODate`/`formatISODateTime`, `useDoctors`, `useTreatmentPlans`,
`useAppointmentOptions`.

## 7. RBAC rules

- **No parallel permission system.** All role decisions flow through the
  existing `usePermission` / `PermissionGate` / `RequireRole` infra.
- **Delete is admin-gated** — the backend `_INVOICE_DELETE_ROLES` restricts
  `DELETE /billing/invoices/{id}` to ADMIN; the row action is wrapped in
  `<PermissionGate requiredRoles={ADMIN_ROLES} mode="hide">` so non-admins
  never see it (client-side mirror of a backend rule, documented as such).
- **403 handling** — list and detail both classify errors via `parseApiError`;
  `kind === 'forbidden'` renders the permission state
  (`InvoiceListPermission` / `InvoiceDetailPermission`, no role names
  hardcoded) and `shouldRetryQuery` prevents any automatic retry.
- **CTA visibility** — "New invoice" and "View all" (dashboard) are wired to
  the Invoice List route; "Record payment" stays disabled (Phase 3).

## 8. State machine / action mapping

Mirrors `INVOICE_TRANSITIONS` in `backend/app/modules/billing/constants.py`
and the router's exposed endpoints (there is **no void endpoint**, so a Paid
invoice — whose only legal transition is void — exposes no actions):

| Backend status | Actions shown | Notes |
| --- | --- | --- |
| `draft` | Issue · Edit · Cancel · Delete | Delete admin-gated via PermissionGate |
| `issued` / `partially_paid` / `overdue` | Cancel | Backend cancel accepts non-terminal statuses |
| `paid` | — | No void endpoint → no actions |
| `cancelled` / `void` | — | Terminal |

The reference screenshot's contradiction (an "Issue" button on an already
ISSUED invoice) is **not** reproduced — Issue only renders for `draft`.

## 9. Invoice list filters (all backend-driven)

- Search (invoice number or patient name) → backend `search` param.
- Patient, Doctor, Status (`INVOICE_STATUS_OPTIONS`), Created date range
  (`date_from` / `date_to`).
- Server-side sort (`created_at`, `invoice_number`, `grand_total`, `status`,
  `due_date`, `updated_at`) and pagination (`page` / `page_size`, max 100).
- **ACTIVE FILTERS = VISIBLE DATA** — no client-side filtering; the reference's
  illustrative filter/data contradiction is not reproduced.

## 10. Validation rules (client mirrors backend; backend is authoritative)

- `patient_id` required; `invoice_date` + `due_date` required (ISO `YYYY-MM-DD`);
  **due date ≥ invoice date** (cross-field).
- `currency_code` 3 chars (USD default — matches backend `DEFAULT_CURRENCY`).
- `notes` ≤ 2000 (backend `INVOICE_NOTES_MAX_LENGTH`, not the reference's 500).
- `items` ≥ 1 (`MIN_LINE_ITEMS_PER_INVOICE`); per item: description 1–500,
  quantity ≥ 1, unit price ≥ 0, discount value ≥ 0 and ≤ line subtotal
  (backed by the service's `_validate_and_attach_items`).
- Cancel reason required, 1–500 chars (`CANCEL_REASON_MAX_LENGTH`).
- Edit form exposes **only** `notes` + `due_date` (the backend PATCH contract) —
  line items are not editable in this release.
- 422 responses map Pydantic `details[]` back to field errors via the shared
  `parseApiError` (dotted `items.0.description` paths included).

## 11. Loading / error / empty / 403 states

**List:** skeleton rows (toolbar + pagination stay put); DataTable error panel
"Failed to load data" + Retry (`refetch()`, no reload); 403 → permission state;
two distinct empties — "No invoices yet" (+ New invoice) vs "No invoices match
these filters" (+ Clear filters).

**Detail:** full skeleton layout (header, summary cards, line items, financial
summary, record info, notes); error → `InvoiceDetailError` ("Couldn't load this
invoice", safe copy, Retry + Back to invoices); 403 → permission state.

**Dialogs:** submitting disables + shows loading; server errors surface in an
`Alert` inside the dialog; validation summary + per-field errors.

## 12. Tests added

Pure utilities: `invoiceStateMachine.test.ts` (every status → action map),
`invoiceFormSchema.test.ts` (required fields, cross-field due≥invoice, notes
max, item bounds, discount cap, cancel reason), `invoiceFormUtils.test.ts`
(net formula, payload conversion, defaults).

Hooks: `useInvoices.test.tsx`, `useInvoice.test.tsx`,
`useInvoiceFilters.test.ts`, `useInvoiceMutations.test.tsx` (each mutation
calls the endpoint and invalidates the `['billing']` root).

Components: `InvoiceTable.test.tsx` (columns, state-machine actions, admin-gated
delete, permission), `InvoiceDetailActions.test.tsx` (draft vs issued vs paid),
`LineItemsEditor` coverage inside the drawer tests, and full dialog suites —
`IssueInvoiceDialog`, `CancelInvoiceDialog` (required reason, max length,
submit), `DeleteInvoiceDialog`, `CreateInvoiceDrawer` (validation, add/remove
items, preview total, submit, server errors), `EditInvoiceDrawer` (only
editable fields, prefill, save, Save enabled on open via `trigger()`).

Containers: `InvoiceListContainer.test.tsx` (server params, sort/pagination,
empty states, 403 never-retried, 500 + Retry, row navigation, issue/cancel/
delete flows, create-drawer flow), `InvoiceDetailsContainer.test.tsx`
(aggregate render, action availability per status, issue/cancel/edit flows,
404 + Retry, 403, skeleton).

Service: `billingService.test.ts` — every invoice endpoint's method/URL/params.

Dashboard regression: `BillingDashboardHeader.test.tsx` /
`BillingDashboardContainer.test.tsx` updated for the now-navigating Invoice CTAs.

## 13. Backend limitations discovered

- **Draft invoices carry a temp `DRAFT-xxxxxx` number** from the backend; no
  permanent number exists until issue. The UI shows the backend's own temp
  number with a muted "number assigned on issue" caption — no fabricated
  numbers.
- **No void endpoint** — a Paid invoice exposes no lifecycle actions (its only
  legal transition, void, is unreachable). Implemented as-is.
- **PATCH is notes + due_date only** on drafts — line items are not editable in
  this release; the Edit drawer explains this and exposes only those fields.
- **No credit-note capability in this phase** — the reference's "Create credit
  note" action is omitted (module is Phase 6); the state machine reflects only
  backend-exposed transitions.
- **`patient_summary`** remains dashboard-only (Phase 1) — no per-invoice
  summary endpoint was fabricated.

## 14. UI deviations from the reference (and why)

1. **No "Create credit note" action** — backend capability does not exist in
   this phase (Phase 6). "Backend wins."
2. **Issue button never appears on issued invoices** — the reference showed it;
   the real state machine forbids it.
3. **Edit drawer restricts to due date + notes** — the backend PATCH contract
   supports only those fields; the reference's full line-item editor is not
   reproduced.
4. **No row-action clipping** — the reference clipped the right-hand actions;
   the shared `DataTable` + `IconButton` row-action pattern keeps every action
   accessible.
5. **Create drawer submit/footer inside a single `<Form>`** — the whole drawer
   (header/body/sticky footer) is wrapped in one form so the footer's
   `type="submit"` button is a form descendant (HTML submit semantics) while the
   footer stays pinned. This is the fix for the initial
   submit-outside-form defect, not a visual deviation.
6. **DatePicker-driven validation surfaces on submit** — field-level `isValid`
   updates don't fire for the calendar's programmatic `onChange` in this
   RHF/zodResolver/zod-4 stack; the Save button blocks invalid submits and
   shows the validation summary (the app-wide "errors on submit" pattern). The
   Edit drawer additionally runs `trigger()` after `reset()` so Save is enabled
   immediately for a valid prefill.

## 15. Validation results

| Gate | Result |
| --- | --- |
| `npm test` | ✅ 169 files / **1281 tests passed** (billing invoice module: 29 new test files) |
| `npm run lint` | ✅ no errors |
| `tsc -b` | ✅ no errors |
| `npm run build` | ✅ built; `InvoiceListPage` (~22.3 kB) and `InvoiceDetailsPage` (~16.9 kB) emitted as lazy route chunks |

Scope respected: only the Invoice module (Phase 2) was implemented; Payments,
Receipts, Refunds, Credit Notes and Billing Reports were **not** started.

## 16. Independent production review (follow-up)

An adversarial re-review of the Invoice module was performed against the
actual backend (routers, schemas, services, validators, enums, constants,
repositories, RBAC). One genuine defect and one documentation inaccuracy were
found and fixed.

### 16.1 Review findings

| Area | Verdict |
| --- | --- |
| **Backend contract compliance** | ✅ Endpoints (POST / PATCH / issue / cancel / DELETE / GET list / GET detail), query params, `InvoiceCreateRequest` (patient + invoice_date + due_date + currency, items ≥ 1), `InvoiceDraftUpdateRequest` (notes + due_date only), `CancelInvoiceRequest` (reason 1–500 required), delete (Draft + ADMIN) — all exact |
| **Lifecycle edge cases** | ✅ State machine mirrors `INVOICE_TRANSITIONS` exactly; no `void` router endpoint exists, so the frontend correctly offers **no** actions on Paid invoices (whose only legal transition is `void`) and none on terminal Cancelled/Void. Edit drawer enforces `minDate = invoice_date` matching backend `validate_due_date` |
| **RBAC** | ✅ Delete ADMIN-gated via `PermissionGate` (hide); read/write roles include DENTAL_ASSISTANT (backend `_INVOICE_READ/WRITE_ROLES`); workflow (issue/cancel) excludes DENTAL_ASSISTANT — backend 403 surfaces in-dialog (established DensCare pattern) |
| **Audit trail** | ✅ Backend writes `BillingAuditLog` on issue + cancel and status history on every transition; frontend surfaces created/updated by + version + doc_version in the Record card and forwards cancellation reasons verbatim |
| **Sorting contract** | 🐛 **Bug found & fixed** — see §16.2 |
| **Route comment accuracy** | 📝 **Inaccuracy fixed** — see §16.3 |

### 16.2 Bug fixed — `grand_total` was offered as a sort field the backend ignores

**Root cause:** the backend invoice repository whitelists exactly
`{created_at, updated_at, invoice_number, due_date, status}`
(`InvoiceRepository._ALLOWED_SORT_FIELDS`); `_resolve_sort_field` silently
falls back to the default (`created_at`) for any unknown value. The frontend
surfaced `grand_total` in **three** places: the `InvoiceSortField` type, the
`INVOICE_SORT_OPTIONS` toolbar select, and the sortable **Grand Total** table
header. Selecting it produced **no error — the backend silently sorted by
created_at**, which is a worse failure mode than an explicit rejection.

**Fix (presentation-only, backend untouched):**

- `frontend/src/types/billing.ts` — removed `'grand_total'` from the
  `InvoiceSortField` union; documented the backend whitelist in the type
  comment so the constraint survives future edits.
- `frontend/src/constants/billing.ts` — removed the `Grand total` entry from
  `INVOICE_SORT_OPTIONS`.
- `frontend/src/components/billing/invoices/InvoiceTable.tsx` — removed
  `sortable: true` from the `grand_total` column (the column still renders;
  its header no longer claims a sort the backend cannot honour).
- `frontend/src/components/billing/invoices/InvoiceToolbar.test.tsx` and
  `frontend/src/hooks/billing/useInvoiceFilters.test.ts` — updated to assert
  only backend-supported sort fields (`due_date`, `invoice_number`).

### 16.3 Docs inaccuracy fixed — DENTAL_ASSISTANT and the read role set

`AppRouter.tsx` claimed invoice/payment **read** endpoints allow "the same set
minus DENTAL_ASSISTANT". The backend `_INVOICE_READ_ROLES` and
`_PAYMENT_READ_ROLES` both **include** DENTAL_ASSISTANT (ADMIN, RECEPTIONIST,
DENTAL_ASSISTANT, DOCTOR roles). DENTAL_ASSISTANT is excluded only from
workflow actions (invoice issue/cancel; payment complete/fail/void/allocate),
and delete is ADMIN-only. The route comment was rewritten to state the real
role sets and the fail-closed behaviour.

### 16.4 Re-verified correct (no change needed)

- PATCH sends **only** `notes` + `due_date` — the router docstring claims
  "replacement line items", but `InvoiceDraftUpdateRequest` (extra="forbid")
  has no `items` field; the frontend already matches the *actual* schema
  (documented as a backend docstring mismatch in §13, no frontend change).
- Create payload omits optional FKs when empty; currency defaults USD matching
  the backend default; notes trimmed to `null` when empty (schema strips
  whitespace server-side).
- All mutations invalidate the shared `['billing']` root + detail key; delete
  also `removeQueries` the detail key (no stale ghost detail page).
- `shouldRetryQuery` never auto-retries 401/403; 403 renders the
  permission-denied state; field errors from `InvoiceValidationFailed` map to
  `editFieldErrors` / `createFieldErrors`.

### 16.5 Validation after the review

| Gate | Result |
| --- | --- |
| `npm test` | ✅ 179 files / **1370 tests passed** |
| `npm run lint` | ✅ no errors |
| `tsc -b` | ✅ no errors |
| `npm run build` | ✅ built successfully |

Backend untouched. The Invoice module now offers only backend-whitelisted sort
fields and the routing documentation matches the actual RBAC contract.

## 17. INR presentation sweep (follow-up)

Full-INR product decision: the Invoice module display surfaces now present
amounts in INR (`PAYMENT_CURRENCY_CODE`) like the dashboard and Payments
module, and the create form **defaults to INR** — so new invoices are recorded
as `currency_code=INR` (backend `CurrencyCode` supports INR; the create
contract is unchanged). Amounts themselves remain the backend's; only the
presentation symbol/currency is applied client-side.

### 17.1 Files changed

- `src/utils/invoiceFormUtils.ts` — `defaultCreateInvoiceValues()` now defaults
  `currency_code` to `PAYMENT_CURRENCY_CODE` ('INR'); the create payload is
  sent as `currency_code=INR`.
- `src/components/billing/invoices/InvoiceTable.tsx` — list Grand Total column
  → `PAYMENT_CURRENCY_CODE`.
- `src/components/billing/invoices/InvoiceFinancialSummaryCard.tsx` — subtotal
  / discount / tax / grand total + the Currency label → `PAYMENT_CURRENCY_CODE`.
- `src/components/billing/invoices/InvoiceLineItemsTable.tsx` — unit price /
  discount / net amounts → `PAYMENT_CURRENCY_CODE`.
- `src/components/billing/invoices/LineItemsEditor.tsx` — per-row net-amount
  caption → `PAYMENT_CURRENCY_CODE`.
- `src/components/billing/invoices/dialogs/CreateInvoiceDrawer.tsx` — preview
  grand total → `PAYMENT_CURRENCY_CODE` (removed the now-unused
  `watchedCurrency` watch; the Currency selector remains as the create
  contract UI, now defaulting to INR).
- `src/components/billing/invoices/dialogs/IssueInvoiceDialog.tsx`,
  `EditInvoiceDrawer.tsx`, `DeleteInvoiceDialog.tsx` — confirmation amounts →
  `PAYMENT_CURRENCY_CODE`.
- `src/constants/billing.ts` — `PAYMENT_CURRENCY_CODE` doc comment now covers
  the whole Billing module (Payments + Dashboard + Invoice display).
- Tests: invoice fixtures → `INR` and `$` assertions → `₹` across
  `InvoiceTable`, `InvoiceListContainer`, `InvoiceDetailsContainer`,
  `CancelInvoiceDialog`, `CreateInvoiceDrawer`, `DeleteInvoiceDialog`,
  `EditInvoiceDrawer`, `IssueInvoiceDialog`, `invoiceFormUtils`,
  `invoiceFormSchema` tests.

### 17.2 Sweep results

- **Payment dialogs**: already fully INR (Complete / Fail / Void / Allocate /
  Deallocate / Delete) — verified again, no stragglers.
- **Zero `'USD'` and zero `$` remain** in the billing module source or tests
  (grep sweep clean). The only remaining `currency_code` reads in billing
  source are the create-form contract field and fixtures whose display is
  now overridden by the presentation constant.
- The Invoice create **selector** still offers all backend `CurrencyCode`
  values (contract UI); display is uniformly INR regardless of the recorded
  code, per the approved full-uniformity decision.

### 17.3 Validation

| Gate | Result |
| --- | --- |
| `npm test` | ✅ 179 files / **1370 tests passed** |
| `npm run lint` | ✅ no errors |
| `tsc -b` | ✅ no errors |
| `npm run build` | ✅ built successfully |

Backend untouched.
