# Billing Payments — UI Fidelity + INR Currency Remediation Report

**Module:** Payments (`/billing/payments` + `/billing/payments/:paymentId`)
**Sprint:** 14A.3 follow-up — focused fidelity review against the approved Payments reference
**Scope:** Payments list page + Record Payment drawer (+ all payment surfaces that show amounts)
**Status:** Complete — all quality gates pass, browser-verified.

---

## 1. Backend contract verification (currency — source of truth)

Before changing any presentation, the actual Payments backend contract was
re-verified against `backend/app/modules/billing/`:

| Backend fact | Location | Consequence |
|---|---|---|
| `CurrencyCode` supports **USD / EUR / GBP / INR** | `enums.py` | INR is a backend-supported ISO 4217 code |
| `PaymentCreateRequest` accepts **no currency field** (patient_id, payment_method, total_amount, payment_date, reference_number, notes) | `schemas/payment.py` (`PaymentBase`) | The client never sends a currency — nothing to change in the create payload |
| The **payment model has no currency column** | `models/payment.py` | A payment has no intrinsic currency |
| Response `currency_code` is **derived**: first allocation's invoice currency, else `DEFAULT_CURRENCY` (**USD**) | `mappers/payment_mapper.py::_currency_code` | Unallocated Pending payments report `USD` from the backend default — this is the "incorrect USD" seen in the UI, not a per-payment contract value |

**Remediation decision:** because the backend does **not** pin payments to USD
(USD is only the unallocated-payment *fallback*), the Payments UI now presents
all amounts in **INR (₹)** per the approved product requirement, using the
existing shared `formatCurrency(value, code)` formatter — which already maps
`INR → ₹` (no new formatter was created). A single module constant
`PAYMENT_CURRENCY_CODE = 'INR'` in `constants/billing.ts` is the one place the
presentation currency is defined.

No backend endpoints, payloads, or lifecycle rules were touched.

---

## 2. UI/UX issues found

1. **Currency was USD everywhere.** Table financial columns, financial summary,
   allocations, receipt card, and all dialogs formatted via the backend's
   derived `currency_code` (`'USD'` for unallocated payments) or hardcoded
   `?? 'USD'` fallbacks; the drawer amount input used `prefix="$"` with
   `helperText="USD — up to two decimal places"`.
2. **Drawer field pairing deviated from the reference.** Patient spanned the
   full drawer width (`md:col-span-2`), forcing Method + Amount onto one row
   and Date + Reference onto the next — the reference pairs Patient | Method
   (row 1), Total Amount | Payment Date (row 2), Reference Number (row 3),
   Notes full width (row 4).

Everything else (page header, filter rows, "Filters apply on the server" note,
table columns/hierarchy, pinned drawer footer, lifecycle dialogs, loading /
empty / error / permission states, responsive behaviour) already matched the
reference from the 14A.3 implementation and was left unchanged.

---

## 3. Remediation performed

### 3.1 Currency — INR everywhere in Payments

**`frontend/src/constants/billing.ts`**
- Added `PAYMENT_CURRENCY_CODE: CurrencyCode = 'INR'` with a doc comment
  recording the backend contract facts above.

**`dialogs/RecordPaymentDrawer.tsx`**
- Amount input: `prefix="₹"`, `helperText="INR — up to two decimal places"`
  (composed from `PAYMENT_CURRENCY_CODE`).
- Field pairing restructured to the reference layout (still a single
  `md:grid-cols-2` grid; Patient no longer spans two columns):

  ```
  Row 1  Patient *          | Payment Method *
  Row 2  Total Amount *     | Payment Date *
  Row 3  Reference Number   (full width, "Optional" helper)
  Row 4  Notes              (full width, 0/500 counter)
  ```
- All other drawer behaviour preserved: pinned footer, scrollable body,
  informational lifecycle callout, valid HTML form semantics, inline +
  server-side validation.

**`PaymentTable.tsx`** — Total Amount / Allocated / Unallocated now format
with `PAYMENT_CURRENCY_CODE` instead of `financials.currency_code`.

**`PaymentFinancialSummaryCard.tsx`** — total / allocated / refunded /
unallocated + the "Currency" caption row now show INR.

**`PaymentAllocationsCard.tsx`** — invoice grand total + allocated amount
now INR.

**`PaymentReceiptCard.tsx`** — receipt amount now INR.

**Dialogs** (`CompletePaymentDialog`, `DeletePaymentDialog`,
`DeallocatePaymentDialog`, `AllocatePaymentDialog`):
- `?? 'USD'` fallbacks replaced with `PAYMENT_CURRENCY_CODE`.
- Allocate dialog amount input `prefix="₹"`; invoice outstanding /
  unallocated / remaining-rows all INR.

**`AllocatePaymentDialog`** — also gained a no-op-query `queryFn` earlier in
14A.3 for the receipt cache-read (unchanged here).

> **Out of scope (deliberately untouched):** the Billing **Dashboard** module
> (`BillingDashboardContainer`, `RecentPayments`, KPI cards) still formats with
> the backend dashboard `currency_code`. The sprint spec limits currency
> remediation to the Payments module; dashboard currency is a separate module
> with its own backend totals and was not modified.

### 3.2 Files changed

| File | Change |
|---|---|
| `frontend/src/constants/billing.ts` | Added `PAYMENT_CURRENCY_CODE = 'INR'` |
| `frontend/src/components/billing/payments/dialogs/RecordPaymentDrawer.tsx` | ₹ prefix, INR helper text, reference field pairing |
| `frontend/src/components/billing/payments/PaymentTable.tsx` | INR financial columns |
| `frontend/src/components/billing/payments/PaymentFinancialSummaryCard.tsx` | INR values + caption |
| `frontend/src/components/billing/payments/PaymentAllocationsCard.tsx` | INR allocation amounts |
| `frontend/src/components/billing/payments/PaymentReceiptCard.tsx` | INR receipt amount |
| `frontend/src/components/billing/payments/dialogs/CompletePaymentDialog.tsx` | INR summary |
| `frontend/src/components/billing/payments/dialogs/DeletePaymentDialog.tsx` | INR summary |
| `frontend/src/components/billing/payments/dialogs/DeallocatePaymentDialog.tsx` | INR amounts |
| `frontend/src/components/billing/payments/dialogs/AllocatePaymentDialog.tsx` | ₹ prefix + INR calculation card |

### 3.3 Tests added/updated

- `PaymentTable.test.tsx` — fixtures `currency_code: 'INR'`; assertions
  `₹1,500.00 / ₹1,200.00 / ₹300.00`.
- `containers/PaymentListContainer.test.tsx` — fixtures INR; assertions
  `₹1,500.00`, `₹2,120.75 due`.
- `containers/PaymentDetailsContainer.test.tsx` — fixtures INR; assertions
  `₹1,500.00`, `₹1,000.00`.
- `dialogs/RecordPaymentDrawer.test.tsx` — **new test**: asserts the ₹ prefix,
  the `INR — up to two decimal places` helper text (via `aria-describedby`),
  and that no `$` / `USD` text is present in the drawer.

No existing tests were removed.

---

## 4. Accessibility

- Amount helper text remains wired via `aria-describedby` → `HelperText`
  (announced with the field; the new test asserts this association).
- `aria-invalid`, `aria-required`, labels, keyboard navigation, and the
  existing drawer/dialog focus-trap + Escape behaviour are unchanged.
- Currency is a text symbol (`₹`) beside the amount — no colour-only or
  icon-only communication.

## 5. Responsive behaviour

- Desktop: two-column drawer form (reference pairing).
- Tablet/mobile: the existing `grid-cols-1 md:grid-cols-2` collapses to one
  column; drawer becomes full width (`max-sm`), footer stays pinned, body
  scrolls.
- The wide payments table keeps its internal horizontal scroll (table
  container only) — no page-level overflow.

---

## 6. Validation results

| Gate | Result |
|---|---|
| `npm test` | ✅ **1368/1368 passed** (179 files) — includes the new INR drawer test |
| `npm run lint` | ✅ clean |
| `tsc -b` | ✅ clean |
| `npm run build` | ✅ succeeds |

### Browser verification (live Vite + real backend data)

| Check | Result |
|---|---|
| Payments list, 1280×800 | Table Total Amount shows **₹500.00 / ₹1,500.00** (INR) |
| Record payment drawer | **₹** before Total Amount; helper text **"INR — up to two decimal places"** |
| Mobile (~504px) | `innerWidth 504 = scrollWidth 504` (no horizontal scroll); drawer fits viewport; form stacks to one column |
| Console | No errors on list or drawer |

---

## 7. Deviations from the reference — and why

1. **USD → INR (approved product requirement).** The reference sample figures
   (`$1,500.00`) were illustrative; the sprint spec explicitly requires the
   Payments UI to use ₹/INR. Backend contract verified: INR is a supported
   `CurrencyCode` and payments carry no stored currency, so this is a
   presentation decision consistent with the backend.
2. **Dashboard currency untouched (visible inconsistency, by design).** The
   Dashboard module has its own backend `currency_code` totals and is outside
   the specified scope — but note that the **same payment** currently renders
   `$1,500.00` on the Dashboard's Recent Payments card (`RecentPayments.tsx`
   still uses `pay.financials.currency_code`) while it renders `₹1,500.00` on
   the Payments page. This is compliant with the sprint's "do not modify
   unrelated modules" rule; aligning the Dashboard's payment display to INR is
   the natural next follow-up.
3. **Invoice-owned values re-presented in INR (presentation overlay).**
   `PaymentAllocationsCard` (invoice grand total) and `AllocatePaymentDialog`
   (invoice outstanding) format amounts that belong to a linked invoice in
   INR. This is a presentation overlay over invoice values in the Payments
   UI — it does **not** claim the invoice's own currency changed.
4. **No reference change was made to lifecycle / dialogs / navigation** — the
   14A.3 implementation already matched the reference structure.

## 8. Remaining limitations

- Payments **created before this change** that are unallocated will keep
  reporting `currency_code: "USD"` from the backend; the UI now presents INR
  regardless (per product requirement). If a payment is later allocated to an
  invoice whose currency is INR, the backend value and the UI agree.
- The Dashboard's Recent Payments card still formats with the dashboard
  currency until the Dashboard module is separately reviewed.

---

*Backend untouched. No Billing contract modified. All changes are presentation
and test changes inside the Payments module.*
