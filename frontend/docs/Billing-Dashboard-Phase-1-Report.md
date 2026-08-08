# Sprint 14A.1 — Billing Dashboard (Phase 1) Implementation Report

Billing Dashboard frontend implementation for the DensCare dental clinic
management system. Scope limited to the **Billing Dashboard only** — the
Invoice, Payment, Receipt, Refund and Credit Note modules were intentionally
**not** implemented (Phases 2–6).

## 1. Files created

```
frontend/src/types/billing.ts                       Backend-faithful types (dashboard/invoice/payment/summaries)
frontend/src/constants/billing.ts                   Status→badge maps, payment-method labels
frontend/src/constants/billing.test.ts
frontend/src/services/billingService.ts             GET /billing/dashboard only
frontend/src/hooks/billing/billingQueryKeys.ts      'billing' root + dashboard(patientId) key factory
frontend/src/hooks/billing/useBillingDashboard.ts   Dashboard query (retry: shouldRetryQuery)
frontend/src/hooks/billing/useBillingDashboard.test.tsx
frontend/src/components/billing/BillingKpiCard.tsx
frontend/src/components/billing/BillingKpiGrid.tsx
frontend/src/components/billing/RecentInvoices.tsx
frontend/src/components/billing/RecentPayments.tsx
frontend/src/components/billing/PatientFinancialSummary.tsx
frontend/src/components/billing/BillingDashboardHeader.tsx
frontend/src/components/billing/BillingDashboardHeader.test.tsx
frontend/src/components/appointments/PatientPicker.a11y.test.tsx  (Sprint 14A.1-H: no form/label React warnings)
frontend/src/components/billing/BillingDashboardLoading.tsx
frontend/src/components/billing/BillingDashboardError.tsx
frontend/src/components/billing/BillingDashboardPermission.tsx
frontend/src/components/billing/BillingDashboardEmptyState.tsx
frontend/src/components/billing/containers/BillingDashboardContainer.tsx
frontend/src/components/billing/containers/BillingDashboardContainer.test.tsx
frontend/src/pages/billing/BillingDashboardPage.tsx
frontend/src/components/common/SectionHeader/        Moved from pages/dashboard (shared dashboard section heading)
```

## 2. Files modified

```
frontend/src/utils/formatting.ts        Added formatCurrency() + formatCount() (shared currency/number formatting home)
frontend/src/utils/formatting.test.ts   Tests for the new helpers
frontend/src/routes/AppRouter.tsx       Lazy /billing route → BillingDashboardPage (ProtectedRoute-only)
frontend/src/routes/routeMeta.ts        Title → "Billing Dashboard"
frontend/src/pages/dashboard/DashboardPage.tsx  Import SectionHeader from its new common location
frontend/src/pages/dashboard/SectionHeader.tsx  Deleted (moved to components/common/SectionHeader)
frontend/src/components/appointments/PatientPicker.tsx  (14A.1-H) Wire inputId through to the search input (label association; clears React dev warnings)
frontend/src/components/billing/BillingDashboardHeader.tsx  (14A.1-H) aria-describedby → sr-only disabled-CTA hints
frontend/src/components/billing/RecentInvoices.tsx          (14A.1-H) Same for "View all"
frontend/src/components/billing/RecentPayments.tsx          (14A.1-H) Same for "View all"
frontend/src/components/billing/BillingDashboardHeader.test.tsx  (14A.1-H) aria-describedby linkage test
frontend/src/components/billing/containers/BillingDashboardContainer.test.tsx  (14A.1-H) sr-only hint assertions
```

## 3. Backend endpoints used

| Endpoint | Purpose |
| --- | --- |
| `GET /billing/dashboard` | Single consolidated request: system-wide totals, up to 5 recent invoices, up to 5 recent payments, and an optional `patient_summary` when `?patient_id=` is provided |

No other endpoint is consumed. The dashboard is **not** front-end aggregated —
the backend's consolidated contract is the single source of truth.

## 4. React Query hooks created

- `useBillingDashboard(patientId?)` — `queryKey: ['billing','dashboard', patientId ?? 'all']`.
  Switching patients changes the key → refetch; the system-wide snapshot stays cached.
- `shouldRetryQuery` is used so 401/403 are never retried (403 renders the
  permission state without hammering the endpoint); other failures keep the
  global single-retry.
- Shared invalidation root `['billing']` — future phases invalidate the
  dashboard via `invalidateQueries({ queryKey: ['billing'] })` after mutations.

## 5. Components created vs reused

**Created (module-scoped, per the task's component list):** `BillingDashboardPage`,
`BillingDashboardHeader`, `BillingKpiGrid`, `BillingKpiCard`,
`PatientFinancialSummary`, `RecentInvoices`, `RecentPayments`,
`BillingDashboardEmptyState`, `BillingDashboardLoading`, `BillingDashboardError`,
`BillingDashboardPermission`.

**Reused (no duplicates):** `PageHeader`, `Button`/`IconButton`, `Tooltip`,
`Icon`, `Badge` + `StatusBadge` (with per-module `statusMap`), `Skeleton`,
`Card`-style tokens, `DataTable` (recent activity tables), `EmptyState`
(empty dashboard), `Alert` (error banner), `PatientPicker` (patient selector),
`SectionHeader` (moved to `components/common`). KPI cards mirror the shared
`StatCard` visual language (same border/radius/shadow/typography tokens).

## 6. RBAC behavior

- No new or parallel permission system. `_REPORT_READ_ROLES` on the backend
  allows **all** roles, so the route is `ProtectedRoute`-only (no role gate) —
  exactly like the other all-role modules (patients, patient records). The
  backend remains the authority.
- A backend `403` renders `BillingDashboardPermission` (lock icon, "You don't
  have permission", `Error 403 · Insufficient permissions`). No role names are
  hardcoded. `shouldRetryQuery` prevents automatic retry on 403.
- Quick actions are **backend-capability aware**: when the Invoice phase
  shipped (Sprint 14A.2), the "New invoice" CTA and the Recent Invoices
  "View all" were wired to the real Invoice List route. "Record payment" and
  the Recent Payments "View all" remain **disabled** — the Payments workflow
  is Phase 3 and does not exist yet (backend-compatible over visual
  approximation).

## 7. Dashboard states implemented

1. **Populated** — 10-card KPI grid (4/2/1 responsive columns), patient
   financial summary, two-column Recent Invoices + Recent Payments.
2. **Empty** — zeroed KPI cards + centered `EmptyState` ("No billing activity
   yet") with disabled CTAs. Emptiness is a UI presentation derived from the
   backend's own count totals (`invoice_count === 0 && payment_count === 0 &&
   credit_note_count === 0`) — no invented metric.
3. **Loading** — skeleton layout mirroring the final grid/sections
   (`aria-busy`, no spinner, minimal layout shift).
4. **Error** — `Alert` banner ("Couldn't load billing dashboard", user-safe
   copy — raw backend messages never shown) + KPI grid degraded to "— /
   Unavailable"; Retry invalidates via `refetch()` (no page reload).
5. **Permission denied** — on backend 403, dedicated state; never auto-retried.

## 8. Tests added (43 new)

- `formatting.test.ts` — `formatCurrency` (grouping, all 4 ISO codes, default
  USD, unknown-code fallback, nullish/invalid) and `formatCount`.
- `constants/billing.test.ts` — every backend status/method enum value mapped.
- `useBillingDashboard.test.tsx` — endpoint params, per-patient cache keys,
  loading state, invalidation root.
- `BillingDashboardContainer.test.tsx` — populated KPIs/invoices/payments,
  loading skeletons, error + Unavailable grid + Retry refetch, 403 permission
  state (exactly one endpoint call), empty state with zeroed KPIs, patient
  summary flow through the shared `PatientPicker`, accessible labelled tables,
  disabled "View all".
- `BillingDashboardHeader.test.tsx` — title/subtitle and non-actionable
  (disabled) quick actions.

## 9. Backend limitations discovered

- **No patient-summary endpoint** separate from the dashboard — it is exposed
  as the optional `patient_summary` on `GET /billing/dashboard?patient_id=`.
  Implemented exactly that way (no invented endpoint).
- **Aggregated totals carry no currency code** — `BillingTotalsResponse` has no
  `currency_code`. `formatCurrency` therefore defaults to **USD** (see §12 for
  the verified single-currency invariant that makes this safe). Per-invoice/
  per-payment rows use their own `financials.currency_code`.
- **No dedicated empty/error/permission flags** — states are derived from the
  backend's own count totals (empty) and HTTP status codes (error/403).
- The reporting endpoints listed as NOT implemented in
  `backend/app/modules/billing/routers/dashboard.py` (revenue/outstanding/
  cashflow/aging/kpis, etc.) were **not** used or fabricated.

## 10. Deviations from the visual reference (and why)

1. **Notification icon omitted from the page header** — the application's
   global header (`HeaderRight`) already renders the notification bell on every
   authenticated page; duplicating it in the page header would be redundant.
2. **"Record payment" and the payments "View all" render disabled** — the
   Payment workflow is Phase 3. Per the "backend wins" rule, the buttons
   preserve the layout but stay non-actionable (with accessible sr-only hints).
   The Invoice CTAs ("New invoice", invoices "View all") shipped with the
   Invoice phase (Sprint 14A.2) and now navigate to the Invoice List route.
3. **Patient selector in the summary card reuses `PatientPicker`** (existing
   infrastructure) rather than a bespoke dashboard select; the selected chip
   shows the patient name (code is visible in the search results).
4. **KPI icons use a neutral tile with restrained status colours** instead of
   the reference's stronger per-KPI tiles — consistent with the DensCare design
   system's "no unnecessary decoration / restrained colours" language.
5. **USD as the default currency for code-less totals** (see §9) — `$`-prefixed
   values follow the backend's default invoice currency rather than the
   ₱-based symbol used by the treatment-plan module.
6. **`SectionHeader` moved from `pages/dashboard` to `components/common`** —
   billing components must not import from `pages/` (inverted layering); the
   move is API-identical and the home dashboard was updated to match.

## 11. Validation gates (all pass)

| Gate | Result |
| --- | --- |
| `npm test` | ✅ 151 files / 1146 tests passed (includes 43+ billing tests and 2 new a11y regression tests) |
| `npm run lint` | ✅ no errors |
| `tsc -b` | ✅ no errors |
| `npm run build` | ✅ built; `BillingDashboardPage` emitted as its own lazy chunk (~14.6 kB) |

> Note: the vitest "forks" worker pool intermittently times out on this Windows
> machine (observed as "Failed to start forks worker" / "Timeout waiting for
> worker to respond"). Re-running yields a clean full-suite pass — this is an
> environment-level flake, not a test failure. All billing tests pass in
> isolation consistently.

## 12. Currency semantics verification (Sprint 14A.1-H)

**Conclusion: the USD fallback for aggregate dashboard totals is semantically
safe — Billing is strictly single-currency in the current phase.** No code
change was required; the invariant is documented here.

Evidence (backend is the source of truth):

- `backend/app/modules/billing/constants.py` — `DEFAULT_CURRENCY: CurrencyCode
  = CurrencyCode.USD`. Invoices default to USD and every invoice row in the
  live database carries `currency_code = "USD"`.
- Multi-currency is an explicitly **deferred Phase 3** feature:
  - `docs/billing/02-functional-requirements.md` — FR-22 (Multi-currency
    Support, Phase 3; exchange rates, dual-amount display).
  - `docs/billing/06-business-rules.md` — BR-140 (Phase 3).
  - `docs/billing/08-future-scope.md` §4.7 — "MVP assumes single-currency
    operation in the clinic's local currency."
  - `docs/billing/01-business-analysis.md` — Assumption 8 / constraint C-7.
- **Per-document single currency is enforced today**:
  `financial_validator.validate_currency_consistency` (raises
  `CurrencyMismatch`, exceptions.py:414) and
  `utils/validation.assert_currency_consistency` back `FI-CROSS-004`
  ("All line items on a single invoice must use the same currency").
- `backend/docs/billing/known-limitations.md` §5 — "Single Currency Per
  Document — By design."

Because aggregate totals (invoice + payment allocations + refunds + credit
notes) can only ever be summed in the single clinic currency, presenting them
as USD matches the backend invariant. When multi-currency lands (Phase 3), the
backend must expose a currency on `BillingTotalsResponse` and the frontend will
consume it — no frontend-side assumption will be introduced.

## 13. Disabled CTA accessibility (Sprint 14A.1-H)

"New invoice", "Record payment" and both "View all" buttons remain
**non-actionable** (Phases 2–3 not built). The hardening pass made their
explanations accessible:

- **Problem:** natively disabled buttons cannot receive focus, so the
  hover/focus `Tooltip` is unreachable by keyboard and screen readers only
  announced the "disabled" state without any reason.
- **Fix (existing pattern, no new tooltip architecture):** each disabled button
  gets `aria-describedby` wired to an `sr-only` span carrying the explanation
  (the same association pattern `FormField`/`Input` use for field hints). The
  `Tooltip` remains for pointer users.
- **Verified live (Chrome):** hovering "New invoice" shows "New invoice
  arrives in the Invoices phase"; hovering "Record payment" shows "Record
  payment arrives in the Payments phase"; hovering "View all" shows the
  matching list-phase hint. DOM inspection confirmed all four disabled buttons
  carry valid `aria-describedby` → `sr-only` targets, and no tab-order
  breakage (no `tabindex` overrides). Disabled buttons are correctly skipped by
  keyboard tabbing.
- **Regression guard:** `BillingDashboardHeader.test.tsx` and
  `BillingDashboardContainer.test.tsx` assert the `aria-describedby` →
  `sr-only` linkage.

Related: `PatientPicker` (shared component reused by the dashboard) previously
emitted two React dev warnings ("A form field element should have an id or
name attribute" / "Incorrect use of <label for=...>") because its search input
had no `id` while `FormField` rendered `htmlFor` from `useId`. Fixed by wiring
`inputId` through to the input — matching the shared `Input` pattern. New
`PatientPicker.a11y.test.tsx` guards both visual states (input and selected
chip) against form/label warnings; both are clean.

## 14. Manual UI smoke verification (Sprint 14A.1-H)

Performed against the running environment (backend `127.0.0.1:8000` with live
PostgreSQL data; frontend Vite dev server on `localhost:5173`):

| Check | Result |
| --- | --- |
| Populated dashboard | ✅ 10 KPI cards with live values (Total Invoiced $4,320.00, Total Collected $1,340.00, Total Refunded $0.00, Total Outstanding $2,980.00, Total Credited $500.00, Paid Invoices 0, Invoice Count 3, Outstanding Invoices 3, Payment Count 1, Credit Note Count 1) |
| Recent Invoices | ✅ INV-00001 (Issued, $1,340.00), DRAFT-581AF1CE (Draft, $1,490.00), DRAFT-31EBF404 (Draft, $1,490.00) — real backend rows |
| Recent Payments | ✅ PAY-00001 (Completed, $1,500.00, Card) |
| Patient summary selection | ✅ Selecting "Test Patient-Two" returned Invoiced $4,320.00 / Collected $1,340.00 / Outstanding $2,980.00 / Credited $500.00 (matches `patient_summary`) |
| Empty dashboard | Covered by automated tests (live DB has activity; not reproducible without wiping data) |
| Loading state | Covered by automated tests (skeleton layout) |
| Server error / 403 | Covered by automated tests (error banner + Unavailable KPIs + Retry; 403 permission state, no auto-retry) |
| Responsive desktop 1280px | ✅ KPI grid 4 columns |
| Responsive tablet 768px | ✅ KPI grid 2 columns, no horizontal scroll |
| Responsive mobile 375px | ✅ 1-column KPIs, sections stacked, no horizontal scroll, header CTAs fit |
| No console errors / React warnings | ✅ Clean after the `PatientPicker` fix (verified before and after patient selection) |
| Disabled CTA tooltip accessibility | ✅ Hover tooltips + `aria-describedby` → `sr-only` (see §13) |

No backend behavior was changed.

## 15. Sprint 14A.2 follow-up — Invoice phase shipped

Sprint 14A.2 implemented the **Invoice module** (Phase 2 of the Billing build
out). Impact on the dashboard:

- **"New invoice" header CTA** now navigates to `/billing/invoices` (the
  Invoice List page, whose toolbar opens the create-invoice drawer) instead of
  rendering disabled.
- **Recent Invoices "View all"** now navigates to `/billing/invoices`.
- **Recent Payments "View all"** and **"Record payment"** remain disabled
  (Payments = Phase 3); their `aria-describedby` → `sr-only` hints are
  unchanged.
- **Billing query-key invalidation is now shared**: `billingQueryKeys` gained
  `invoiceList` / `invoiceDetail` factories and every invoice mutation
  invalidates the `['billing']` root, which refreshes this dashboard after
  invoice create/issue/cancel/delete/edit actions elsewhere in the module.

See `frontend/docs/Billing-Invoice-Module-14A-2-Report.md` for the full
Invoice implementation report.

Full-suite validation after Sprint 14A.2: `npm test` 1281/1281 across 169
files, `npm run lint` clean, `tsc -b` clean, `npm run build` succeeds.
