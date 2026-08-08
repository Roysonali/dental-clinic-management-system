

## 1. How to use this document

1. Copy **Section 2 verbatim** into Lovable as the single generation prompt.
2. Lovable generates **each screen as an independent, individually downloadable artifact** — never one long scrolling canvas (Section 5 contains the export instruction that is embedded in the prompt).
3. Use **Section 6 (Screen Checklist)** to verify every expected screen exists and is exported.
4. Use **Sections 3–4** as the design constraints and DensCare design-language reference the prompt points at.
5. Screens that the backend does not support (Section 7) must **never** be generated.

---

## 2. The Standalone Lovable Prompt (paste verbatim)

```
You are generating UI design screens for the Billing module of DensCare, an
enterprise dental-clinic management system. DensCare already ships production
modules for Authentication, Patients, Appointments, Doctors, Users/RBAC,
Treatment Plans, and Patient Records. The Billing module UI must look and feel
identical to those existing modules.

Assume you have ZERO prior knowledge of DensCare. Everything you need is in
this prompt.

═══════════════════════════════════════════════════════════════════
HARD RULES — read before designing anything
═══════════════════════════════════════════════════════════════════
1. GENERATE EACH SCREEN AS A SEPARATE, INDIVIDUALLY DOWNLOADABLE
   ARTWORK. Every page, drawer, dialog, and form in the checklist below
   must be its own standalone screen you can export one at a time as a
   PNG/SVG. Do NOT compose multiple pages into one long scrolling
   canvas. Do NOT combine a page and its dialog into a single export.
   One screen = one export.
2. Use ONLY the backend capabilities listed in Section B. Never invent
   screens, buttons, fields, statuses, or workflows that are not listed.
   Never add tax/GST, insurance claims, payment gateways, patient
   wallets, installments, print/PDF buttons, or financial reports.
3. Match the DensCare enterprise design language in Section C exactly:
   layout, spacing, typography, tables, drawers, dialogs, forms,
   filters, badges, summary cards, empty/loading/error states, and
   navigation must be identical in style to the completed modules.
4. Follow WCAG accessibility: 4.5:1 minimum contrast, visible focus
   states, keyboard-reachable controls, semantic labels, large touch
   targets (44px), no color-only status communication.
5. Be responsive and production-grade: design at 1440px desktop width,
   and also provide a mobile 390px variant for the primary list pages.
6. No implementation details, no code, no architecture. Only UI design.

═══════════════════════════════════════════════════════════════════
A. PRODUCT CONTEXT
═══════════════════════════════════════════════════════════════════
DensCare is a dental clinic management system used by ADMIN,
RECEPTIONIST, DENTAL_ASSISTANT, and four DOCTOR roles
(CHIEF_DOCTOR, GENERAL_DOCTOR, SPECIALIST_DOCTOR, CONSULTING_DOCTOR).

The Billing module manages the clinic's money:
- Invoices created from treatments, issued with permanent numbers,
  and settled by payments.
- Payments recorded against patients and allocated to invoices.
- Receipts generated for completed payments.
- Refunds against completed payments, with an approve/reject step.
- Credit notes that correct issued invoices.
- A dashboard with financial totals and recent activity.

Every role can view and create records. RECEPTIONIST, DOCTORS and
ADMIN can perform workflow actions (issue, cancel, complete, allocate,
approve, apply). Only ADMIN can delete. DENTAL_ASSISTANT cannot perform
workflow actions. Hide every action a role cannot perform.

═══════════════════════════════════════════════════════════════════
B. BACKEND CAPABILITIES (the ONLY truth — everything must map to these)
═══════════════════════════════════════════════════════════════════
B1. DASHBOARD
- GET /billing/dashboard — six KPI money cards (Total Invoiced,
  Total Collected, Total Refunded, Total Outstanding, Total Credited,
  and a card for Paid Invoice Count) plus count cards (Invoice Count,
  Outstanding Invoice Count, Payment Count, Credit Note Count),
  a "Recent Invoices" table (max 5), a "Recent Payments" table (max 5),
  and an optional Patient Financial Summary panel when a patient is
  selected.
- GET /billing/summary — the same KPI totals for a compact widget.
- Totals are: invoiced = Σ invoice grand totals; collected = Σ non-refund
  allocations; refunded = Σ refund allocations; outstanding = invoiced −
  collected + refunded (never negative); credited = Σ credit-note amounts.

B2. INVOICES
- List: paginated table. Server-side filters: free-text search (invoice
  number or patient name), patient, doctor, status, created-between
  date range. Sortable columns: Created, Updated, Invoice Number,
  Due Date, Status. Pagination: page + page size (max 100), response
  has items/total/page/page_size. Row shows: invoice number, status
  badge, patient (code + name), doctor, invoice date, due date,
  grand total, item count, created at. Actions per row by status and
  role:  Open (all), Issue (draft), Cancel (draft/issued/partially_paid/
  overdue — NEVER from paid), Delete (draft, ADMIN only).
- Detail: header with invoice number + status badge; patient, doctor,
  treatment plan, and appointment summary blocks; line-items table
  (sequence, description, quantity, unit price, discount, net amount);
  financial summary (subtotal, discount total, tax total — show as
  "$0.00" when tax is absent — grand total); notes; creator/updater;
  version; actions: Issue, Cancel (with reason dialog), and a
  "Create Credit Note" action for issued invoices.
- Create (DRAWER): patient picker (required), optional treatment
  plan / appointment / doctor pickers, invoice date, due date
  (default +30 days), currency (USD/EUR/GBP/INR, default USD),
  notes, and a dynamic line-items editor with at least one row:
  description, quantity (min 1), unit price, discount type
  (PERCENTAGE or FIXED_AMOUNT) + value, and a read-only computed net
  amount and running grand total. Saving creates a DRAFT; show the
  placeholder number as "Draft — number assigned on issue".
- Edit Draft (DRAWER): edit notes and due date only. Line items are
  NOT editable in this release.
- Issue Confirmation (DIALOG): "Issue this invoice? A permanent invoice
  number (INV-#####) will be assigned and the invoice becomes
  immutable." Confirm / Cancel.
- Cancel Confirmation (DIALOG): required reason textarea (max 500),
  "Cancel this invoice?" Confirm is disabled until a reason is typed.

B3. PAYMENTS
- List: paginated table. Server-side filters: patient, payment method,
  status, created-between date range. NO free-text search. Sortable
  columns: Created, Updated, Payment Number, Payment Date, Total
  Amount, Status, Payment Method. Row shows: payment number, status
  badge, patient, method, total amount, allocated amount, unallocated
  amount, allocation count, payment date, created at.
- Detail: header with payment number + status badge; patient; method;
  total / allocated / refunded / unallocated amounts; reference number;
  notes; allocations table (invoice number + patient + grand total,
  allocated amount, is_refund badge "Refund", created at); receipt
  summary if one exists; actions: Complete (pending), Fail (pending),
  Void (pending), Allocate (completed), Deallocate, Generate Receipt
  (completed, no receipt yet), Regenerate Receipt.
- Create Payment (DRAWER): patient picker (required), payment method
  (CASH, CARD, UPI, BANK_TRANSFER, CHEQUE, INSURANCE, WALLET),
  total amount (> 0), payment date, optional reference number,
  optional notes. Saving creates a PENDING payment (number PAY-#####).
- Complete / Fail / Void Confirmation (DIALOGS): optional reason field
  for Fail/Void; explicit confirm text.
- Allocate Payment (DIALOG): pick a payable invoice (issued /
  partially paid / overdue) for the same patient, enter allocation
  amount (must be ≤ unallocated balance and ≤ invoice outstanding),
  live balance feedback. One allocation per payment+invoice pair —
  disable invoices already allocated to this payment.
- Deallocate Confirmation (DIALOG): confirm removal from an invoice.

B4. RECEIPTS (no list page — surfaced from payment detail)
- Generate Receipt (DIALOG/ACTION): choose a completed payment without
  a receipt. The receipt amount equals the payment total and the date
  is today — do NOT offer amount or date fields.
- Receipt Detail (PAGE or PANEL): receipt number (RCT-#####), status
  "Generated" badge, patient, linked payment (number, method, date,
  total), amount, receipt date, financial summary, print metadata
  (print count, last printed, duplicate copy), document metadata,
  and an audit trail timeline.
- Regenerate Receipt (DIALOG/ACTION): confirm reproduction of the
  document; no financial change.

B5. REFUNDS (no list page — surfaced from payment detail)
- Create Refund (DRAWER): payment picker (completed payments with a
  refundable balance), refund amount (≤ refundable balance — show
  remaining balance live), reason (required, max 1000).
- Approve / Reject / Complete (DIALOGS): Reject requires a reason.
  Complete creates the refund allocation; a fully refunded payment
  shows status "Refunded".
- Refund Timeline: show PENDING → APPROVED → COMPLETED (or REJECTED)
  steps with reviewer and timestamps from the audit trail.

B6. CREDIT NOTES (no list page — surfaced from invoice detail)
- Create Credit Note (DRAWER): invoice picker (shows grand total),
  patient, amount (≤ invoice grand total — show remaining allowed
  live), reason (required, max 2000), optional expiry date.
- Issue / Void / Apply (DIALOGS): Void requires a reason; Apply
  consumes the full remaining balance (no partial apply).
- Credit Note Timeline: DRAFT → ISSUED → APPLIED (or VOID) with
  actor + timestamps.

B7. STATUS VALUES (use these exact lowercase values for badges)
- Invoice: draft, issued, partially_paid, paid, overdue, cancelled,
  void.
- Payment: pending, completed, failed, refunded, reversed, void.
- Receipt: generated, cancelled.
- Refund: pending, approved, rejected, completed.
- Credit note: draft, issued, applied, void, expired.
- IMPORTANT: invoice statuses partially_paid / paid / overdue are NOT
  set by the backend from payments. Display payment progress from the
  payment allocations you have, but never claim the invoice status
  changed. Never show a paid/partially_paid filter as a primary
  self-maintaining workflow.
- IMPORTANT: invoice detail financials paid_amount / outstanding_amount
  come back as 0.00 from the API — never render those two numbers.

B8. NUMBER FORMATS
- Invoice INV-#####, Payment PAY-#####, Receipt RCT-#####,
  Refund RFD-#####, Credit note CN-##### (5-digit zero-padded).
- Draft invoices show "Draft — number assigned on issue" instead of a
  number.
- Money: 2 decimals, right-aligned in tables; currency symbol from the
  document's currency code (default USD).

B9. ROLES (hide controls the user cannot use)
- Read + create/edit drafts: all roles.
- Workflow (issue, cancel, complete, fail, void, allocate, deallocate,
  approve/reject/complete refund, issue/void/apply credit note,
  regenerate receipt): ADMIN, RECEPTIONIST, and the four doctor roles.
  DENTAL_ASSISTANT sees read-only.
- Delete (draft invoice, pending payment): ADMIN only.
- If the API returns 403 "Role not assigned" / "Insufficient
  permissions", show the DensCare permission state.

═══════════════════════════════════════════════════════════════════
C. DENSCARE DESIGN LANGUAGE (match these exactly)
═══════════════════════════════════════════════════════════════════
- Layout: left sidebar navigation with section icons and labels, top
  bar with page title + primary action button, content area with
  summary cards on top, then the table. Consistent 24px grid gutters.
- Typography: enterprise sans-serif (Inter or similar); page title
  ~24px/600; table header 12px uppercase letter-spaced; body 14px;
  numeric columns tabular. 1.5 line-height.
- Color: clean white/light-gray canvas with a single strong accent
  for primary actions; semantic status colors ONLY via badges:
  neutral-gray for draft/pending/void/rejected, blue/info for
  issued/generated/approved, teal/green for paid/completed/applied,
  amber for overdue, red for cancelled/failed, violet for refunded/
  credit. Never color-code money; render it plain.
- Badges: small pill, 11px/600 uppercase, 8px horizontal padding,
  tinted background (10–15% opacity) + solid text of the same hue.
- Tables: full-width, 48–56px rows, subtle row hover, right-aligned
  numeric columns, sticky header, sortable column headers with asc/desc
  chevrons, server pagination footer (page size selector 10/20/50/100,
  prev/next + "Page X of Y").
- Drawers: right-side panel 480px (640px for forms with line-item
  editors), full-height, header with title + close, footer with
  Cancel / primary action, backdrop dims the page, Escape closes.
- Dialogs: centered modal ~440px, icon + title + description,
  optional required-reason textarea, footer Cancel / destructive or
  primary action, focus trapped.
- Forms: labeled inputs (12px/600 uppercase labels), helper text,
  inline validation with error color + message under the field,
  disabled states for unavailable actions, tabular input for money,
  select dropdowns for enums and pickers with search.
- Summary cards: 4-per-row, icon + label (12px uppercase) + value
  (24px/700) + optional delta caption; subtle border and shadow.
- Navigation: Billing section contains Dashboard, Invoices, Payments,
  and a "Money in / Money out" grouping: Receipts, Refunds, and
  Credit Notes are ACTION SURFACES reached from Payment/Invoice detail
  — do not design top-level list pages for them.
- Empty state: centered illustration/icon + title + helper text +
  primary CTA when a create action exists.
- Loading state: skeleton rows matching table geometry; spinner for
  drawers/dialogs.
- Error state: full-width inline alert banner (icon + message +
  optional retry) for list/detail failures; inline field errors in
  forms; a dedicated permission state (lock icon, "You don't have
  permission", helper text) for 403.
- Confirm destructive actions with the DensCare confirmation dialog
  pattern; disable submit while in flight.

═══════════════════════════════════════════════════════════════════
D. SCREEN CHECKLIST — generate and export EVERY item, one per export
═══════════════════════════════════════════════════════════════════
DASHBOARD
[ ] Billing Dashboard page (KPI cards + recent invoices + recent
    payments + optional patient summary panel)
[ ] Dashboard empty state (no data)
[ ] Dashboard loading state (skeletons)
[ ] Dashboard error state (banner + retry)
[ ] Dashboard permission state (403)

INVOICES
[ ] Invoice List page (search, filters, sortable table, pagination)
[ ] Invoice List empty state
[ ] Invoice List loading state
[ ] Invoice List error state
[ ] Invoice List permission state
[ ] Invoice Detail page (header, line items, financial summary,
    audit info, actions)
[ ] Invoice Detail loading/error states
[ ] Create Invoice Drawer (line-item editor)
[ ] Create Invoice Drawer validation errors
[ ] Edit Draft Invoice Drawer (notes + due date)
[ ] Issue Invoice Confirmation Dialog
[ ] Cancel Invoice Confirmation Dialog (required reason)
[ ] Delete Draft Invoice Confirmation Dialog (ADMIN)

PAYMENTS
[ ] Payment List page (filters, sortable table, pagination, no
    free-text search)
[ ] Payment List empty state
[ ] Payment List loading/error/permission states
[ ] Payment Detail page (allocations table, receipt summary,
    financial summary, actions)
[ ] Create Payment Drawer
[ ] Create Payment validation errors
[ ] Complete Payment Confirmation Dialog
[ ] Fail Payment Confirmation Dialog (optional reason)
[ ] Void Payment Confirmation Dialog (optional reason)
[ ] Allocate Payment Dialog (invoice picker + live balance)
[ ] Deallocate Confirmation Dialog
[ ] Delete Pending Payment Confirmation Dialog (ADMIN)

RECEIPTS (action surface — no list)
[ ] Generate Receipt Dialog (from payment detail)
[ ] Receipt Detail page (print metadata + audit trail)
[ ] Regenerate Receipt Confirmation Dialog

REFUNDS (action surface — no list)
[ ] Create Refund Drawer (payment picker + live refundable balance)
[ ] Approve Refund Confirmation Dialog
[ ] Reject Refund Confirmation Dialog (required reason)
[ ] Complete Refund Confirmation Dialog
[ ] Refund status timeline (pending → approved → completed/rejected)

CREDIT NOTES (action surface — no list)
[ ] Create Credit Note Drawer (invoice picker + amount cap)
[ ] Issue Credit Note Confirmation Dialog
[ ] Void Credit Note Confirmation Dialog (required reason)
[ ] Apply Credit Note Confirmation Dialog
[ ] Credit note status timeline (draft → issued → applied/void)

MOBILE
[ ] Invoice List — mobile 390px variant
[ ] Payment List — mobile 390px variant
[ ] Create Invoice Drawer — mobile 390px variant

═══════════════════════════════════════════════════════════════════
E. NEVER GENERATE (backend does not support any of these)
═══════════════════════════════════════════════════════════════════
- Receipt / Refund / Credit Note LIST pages or list tables
- Tax or GST fields, tax-rate editors, tax reports
- Insurance claim forms or coverage fields
- Online payment gateway flows, gateway order/payment screens
- Patient wallet / patient credit balance top-ups
- Advance payments or unallocated payment application
- Installments / EMI / invoice splitting
- Invoice VOID action (only Cancel exists)
- Payment REVERSAL action
- Receipt cancellation action
- Reports: aging, revenue, cashflow, daily/monthly/yearly, KPIs
- PDF/print generation buttons or file downloads
- Editing issued invoices, completed payments, generated receipts,
  or applied credit notes
- Partial credit-note application
- Any button that calls an endpoint not listed in Section B
```

---

## 3. Backend Capability Notes (context for the team, not for Lovable)

| Capability | Backend truth | UI decision |
|---|---|---|
| Dashboard totals | `GET /billing/dashboard` + `/billing/summary` return SQL-computed totals (correct at any volume) | KPI cards; recent invoices/payments (≤5); patient summary when patient selected |
| Invoice list | `GET /billing/invoices` — search + patient/doctor/status/date filters, 5 sort fields, pagination | Full DataTable; **no amount filter**; date filter = created-between |
| Invoice lifecycle | create(draft) → issue → cancel; delete(draft, ADMIN); edit = notes+due only | Drawers/dialogs exactly per checklist; line items fixed at creation |
| Payment list | `GET /billing/payments` — filters only, **no free-text search** | No search box on payments |
| Payment lifecycle | create(pending) → complete → allocate → receipt; fail/void; deallocate | Sequential confirm dialogs; allocate dialog with live balance checks |
| Receipts | generate (amount=payment total, 1/payment), get, regenerate; **no list** | Action surface on payment detail only |
| Refunds | create → approve/reject(reason)/complete; **no read endpoints** | Action surface + status timeline on payment detail |
| Credit notes | create → issue → void(reason)/apply(all-or-nothing); **no read endpoints** | Action surface + status timeline on invoice detail |
| Status truth | Invoice `paid/partially_paid/overdue` never set by API; per-invoice paid/outstanding = 0.00 | Never render those; derive progress from allocations |

## 4. Design Constraints (repeat of the prompt's hard rules)

1. **One screen = one export.** Pages, drawers, dialogs, and forms are separate, individually downloadable artifacts. No composite canvases.
2. **Only Section B capabilities.** Every control maps to a real endpoint or field.
3. **DensCare design language.** Same components, spacing, typography, badges, drawers, dialogs, filters, summary cards, and states as the completed modules.
4. **WCAG AA.** Contrast ≥ 4.5:1, visible focus, keyboard operable, 44px targets, no color-only status.
5. **Responsive.** 1440px desktop designs; 390px mobile variants for the primary list pages and the invoice create drawer.
6. **Roles respected.** Hide workflow actions for DENTAL_ASSISTANT; hide delete outside ADMIN; show the permission state on 403.
7. **States everywhere.** Every page ships empty, loading, error, and permission states; every form ships validation-error states.

## 5. Export Instruction (embedded in the prompt — Section 2, Hard Rule 1)

> "GENERATE EACH SCREEN AS A SEPARATE, INDIVIDUALLY DOWNLOADABLE ARTWORK. Every page, drawer, dialog, and form in the checklist below must be its own standalone screen you can export one at a time as a PNG/SVG. Do NOT compose multiple pages into one long scrolling canvas. Do NOT combine a page and its dialog into a single export. One screen = one export."

This instruction appears verbatim inside the Lovable prompt so Lovable's output workflow produces ~44 independent downloadable screens, not one canvas.

## 6. Screen Checklist (complete — every screen in the prompt)

### Dashboard
| # | Screen | Type |
|---|---|---|
| 1 | Billing Dashboard page | Page |
| 2 | Dashboard empty state | State |
| 3 | Dashboard loading state | State |
| 4 | Dashboard error state | State |
| 5 | Dashboard permission state | State |

### Invoices
| # | Screen | Type |
|---|---|---|
| 6 | Invoice List page | Page |
| 7 | Invoice List empty state | State |
| 8 | Invoice List loading state | State |
| 9 | Invoice List error state | State |
| 10 | Invoice List permission state | State |
| 11 | Invoice Detail page | Page |
| 12 | Invoice Detail loading/error states | States |
| 13 | Create Invoice Drawer | Drawer/Form |
| 14 | Create Invoice Drawer validation errors | Form state |
| 15 | Edit Draft Invoice Drawer | Drawer/Form |
| 16 | Issue Invoice Confirmation Dialog | Dialog |
| 17 | Cancel Invoice Confirmation Dialog (required reason) | Dialog |
| 18 | Delete Draft Invoice Confirmation Dialog (ADMIN) | Dialog |

### Payments
| # | Screen | Type |
|---|---|---|
| 19 | Payment List page | Page |
| 20 | Payment List empty state | State |
| 21 | Payment List loading/error/permission states | States |
| 22 | Payment Detail page | Page |
| 23 | Create Payment Drawer | Drawer/Form |
| 24 | Create Payment validation errors | Form state |
| 25 | Complete Payment Confirmation Dialog | Dialog |
| 26 | Fail Payment Confirmation Dialog (optional reason) | Dialog |
| 27 | Void Payment Confirmation Dialog (optional reason) | Dialog |
| 28 | Allocate Payment Dialog (invoice picker + live balance) | Dialog |
| 29 | Deallocate Confirmation Dialog | Dialog |
| 30 | Delete Pending Payment Confirmation Dialog (ADMIN) | Dialog |

### Receipts (action surface — no list)
| # | Screen | Type |
|---|---|---|
| 31 | Generate Receipt Dialog | Dialog |
| 32 | Receipt Detail page (print metadata + audit trail) | Page |
| 33 | Regenerate Receipt Confirmation Dialog | Dialog |

### Refunds (action surface — no list)
| # | Screen | Type |
|---|---|---|
| 34 | Create Refund Drawer (live refundable balance) | Drawer/Form |
| 35 | Approve Refund Confirmation Dialog | Dialog |
| 36 | Reject Refund Confirmation Dialog (required reason) | Dialog |
| 37 | Complete Refund Confirmation Dialog | Dialog |
| 38 | Refund status timeline | Component |

### Credit Notes (action surface — no list)
| # | Screen | Type |
|---|---|---|
| 39 | Create Credit Note Drawer (amount cap) | Drawer/Form |
| 40 | Issue Credit Note Confirmation Dialog | Dialog |
| 41 | Void Credit Note Confirmation Dialog (required reason) | Dialog |
| 42 | Apply Credit Note Confirmation Dialog | Dialog |
| 43 | Credit note status timeline | Component |

### Mobile variants
| # | Screen | Type |
|---|---|---|
| 44 | Invoice List — 390px | Mobile |
| 45 | Payment List — 390px | Mobile |
| 46 | Create Invoice Drawer — 390px | Mobile |

**Total: 46 exportable screens.** Every one is individually downloadable; none is a composite.

## 7. Excluded Screens (backend does not support — must never be generated)

| Excluded | Why |
|---|---|
| Receipt list page | No `GET /billing/receipts` (O1) |
| Refund list page + refund detail page | No GET endpoints for refunds (O1) |
| Credit note list page + credit note detail page | No GET endpoints for credit notes (O1) |
| Tax/GST screens | Phase-2 placeholders only (§15) |
| Insurance claim screens | `INSURANCE` is a payment-method value only (§15) |
| Payment gateway screens | No gateway endpoints; metadata is reference-only (§15) |
| Patient wallet / credit top-up | `PatientCredit` has no endpoints (§15) |
| Installments / EMI | Not present (§15) |
| Invoice void action | Only cancel is routed (§15) |
| Payment reversal action | `REVERSED` unreachable via API (§15) |
| Receipt cancellation action | `CANCELLED` unreachable via API (§15) |
| Financial reports (aging/cashflow/monthly/etc.) | Explicitly NOT implemented (§15) |
| PDF/print export | No rendering layer; receipts are JSON (§15) |

## 8. Acceptance Criteria (this sprint is complete when)

- ✅ Backend reviewed end-to-end (`Billing-Backend-Contract-Review.md`).
- ✅ No unsupported backend capability appears in the UI prompt or checklist.
- ✅ Billing Backend Contract Review document is complete.
- ✅ Standalone Lovable prompt is complete (Section 2).
- ✅ Screen Checklist covers every backend-supported screen (46 items, Section 6).
- ✅ Lovable is explicitly instructed to generate each screen as an individually downloadable export (Section 2, Hard Rule 1; Section 5).
- ✅ No React implementation or frontend architecture work has started.
