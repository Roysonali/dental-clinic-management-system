# Billing Invoice Module — UI/UX Remediation & Production Hardening Report

**Sprint:** 14A.2 (Invoice module remediation follow-up)
**Scope:** `frontend/src` — Invoice list, toolbar, table, drawers, dialogs, shared DatePicker primitive
**Backend contract:** untouched. No endpoint, payload, response model, lifecycle rule, validation rule or permission behavior was changed.

---

## 1. Problems discovered

1. **Filter row is clipped at the right edge.** At a 1440×900 viewport the entire filter toolbar (Patient / Doctor / Status / Invoice from / Invoice to / Sort by / Order) rendered as a **single 1336px-wide row** (x = 320 → 1656). The rightmost controls — `Sort by` and `Order` — extended past the 1440px viewport and were cut off.
2. **The page content was wider than the workspace.** The intrinsic width of the toolbar (the sum of its fixed control widths) escaped the constrained page container; the Workspace's `overflow-x-hidden` clipped the overflow instead of the layout wrapping.
3. **`flex-wrap` never engaged.** The row had `flex flex-wrap` declared, but wrapping only happens when the flex container has a *definite* width — the container was sized by its content, so it grew to fit everything on one line.
4. **Mobile drawer overflow.** The Create/Edit invoice drawers used a fixed `min-w-[520px]`/`min-w-[460px]` floor. Below `sm`, `max-sm:!max-w-full` caps the *maximum* width but does **not** release the *minimum*, so a 375px phone would still get a 520px panel.
5. **DatePicker field labels were not programmatically associated.** The `Invoice from` / `Invoice to` / `Invoice Date` / `Due Date` triggers are `<button>` elements; the visible `FormField` label had no `htmlFor`/`id` wiring, so the field name was only discoverable visually (placeholder-only naming for assistive tech).
6. **Table had no minimum width strategy.** The invoice table relied entirely on the available viewport; on smaller screens columns compressed into unreadable cells instead of scrolling in a controlled, table-scoped way.

## 2. Root causes

- **The `InvoiceListContainer` root was not width-constrained.** It rendered `<div className="flex flex-col gap-4">` inside `PageWrapper` → `Stack`, and `Stack` defaults to `align="start"`. With `align-items: flex-start`, the container is *not* stretched to the content width and sizes to its content instead. Because it lacked `w-full min-w-0`, its intrinsic width (≈1336px — the toolbar's fixed control widths) defined the layout width, and every descendant (including the toolbar's `flex-wrap` row) was laid out inside an unconstrained containing block → no wrapping, right side clipped by the Workspace.
- **Fixed control widths summed beyond available width.** Patient 256 + Doctor 192 + Status 176 + From 160 + To 160 + Sort 176 + Order 144 + 6 × 12px gaps = **1336px** — wider than the ≈1056px content area at 1440px.
- **`min-width` on the drawer panels** (520px / 460px) overflowed sub-`sm` viewports.
- **DatePicker label gap:** the shared `DatePicker` composed `FormField` (label) but never forwarded an element `id` for the trigger button.
- **No min-width on the invoice table** — the shared `DataTable` scroll wrapper (`overflow-x-auto`) is correct, but the table needed a declared minimum width to scroll gracefully instead of squeezing.

## 3. UI/UX changes

### 3.1 Root-cause fix (width constraint) — `InvoiceListContainer.tsx`, `InvoiceDetailsContainer.tsx`

The list container root changed from `flex flex-col gap-4` to **`flex w-full min-w-0 flex-col gap-4`** — exactly the pattern already used by the sibling list containers (`PatientRecordListContainer`, `DoctorListContainer`). This constrains the page to the available content width and re-enables normal `flex-wrap` behaviour. The details container root received the same `w-full min-w-0` hardening.

This is the single change that fixes Problems 1–3 (clipped filters, page wider than viewport, uncontrolled overflow). The application shell (sidebar, header, Workspace) was **not** modified.

### 3.2 Toolbar restructure — `InvoiceToolbar.tsx`

- **Search:** desktop width changed from `lg:max-w-sm` (384px) to **`lg:max-w-[440px]`** (target range 400–440px); tablet/mobile remain fluid/full-width (`w-full` below `lg`).
- **Filters grouped into two rows** (task-preferred structure), each `flex flex-wrap items-end gap-3`:
  - **Row 1 — entity & status:** Patient (`w-full sm:w-64`), Doctor (`w-48`), Status (`w-44`).
  - **Row 2 — date range & sorting:** Invoice from (`w-40`), Invoice to (`w-40`), Sort by (`w-44`), Order (`w-36`).
- On desktop each row fits comfortably (row 1 ≈ 648px, row 2 ≈ 676px at 1440 content width ≈1056px); on narrower viewports the rows wrap onto additional lines; on mobile everything stacks.
- All seven backend filters, their labels, placeholders and handlers are **unchanged** — the grouping is purely layout/spacing (no visible group headings, no new design language).
- The patient picker wrapper lost its `min-w-[220px]` (no longer needed once the container is constrained; it contributed to the overflow maths).
- The toolbar root also gained `w-full min-w-0` (belt-and-suspenders with §3.1).

### 3.3 Table — `InvoiceTable.tsx`

- Added **`tableClassName="min-w-[1024px]"`** to the shared `DataTable`. Behaviour is now the task's model: page width fixed → table receives the available width → if columns genuinely cannot fit, **only the table container** (`overflow-x-auto` on the `DataTable` wrapper) scrolls. The page itself never overflows. This mirrors the established `DoctorTable` pattern (`min-w-[1400px]`).
- Column content is unchanged: invoice number (mono, prominent; draft caption "Draft — number assigned on issue"), status badge, patient/doctor name + muted code, dates, right-aligned `grand_total` via the shared `formatCurrency`, items, created datetime, state-machine-driven row actions.

### 3.4 Drawers — `CreateInvoiceDrawer.tsx`, `EditInvoiceDrawer.tsx`

- Added **`max-sm:min-w-0`** to both drawer panels so the 520px/460px floors are released below `sm` and the panel becomes full-width on phones (the existing `max-sm:!max-w-full` only capped the max width — it could not override the min width).
- No change to the sticky-footer architecture (single `<Form className="flex h-full flex-col">` with `Drawer.Body` scrolling and `Drawer.Footer` pinned) — that was already correct.

### 3.5 Shared DatePicker label association — `DatePicker.tsx`

- The trigger button now carries `id={triggerId}` and the `FormField` receives `inputId={triggerId}`, giving every DatePicker field a real `<label for>` association (buttons are labelable elements). `getByLabelText('Invoice from')` etc. now work.
- An explicit **`aria-label`** (`${label}: ${currentValue}`) supplies the computed accessible name, so assistive tech announces e.g. **"Due Date: Aug 22, 2026"** on focus instead of only the raw value or only the label.
- This is a **shared-primitive** improvement: it benefits every DatePicker usage app-wide (patients' DOB, appointments, treatment plans, patient records, invoices). The accessible-name change is why a small number of existing tests in other modules that queried date triggers by the bare formatted value were updated (see §7).

## 4. Responsive changes

| Viewport | Behaviour |
|---|---|
| ≥1280px | Two clean filter rows; all controls fully visible; table fits with no horizontal scroll. |
| 1024–1280px | Filter rows wrap onto additional lines; no clipping; no browser-level horizontal scroll. |
| 640–1024px | Search is fluid; filters wrap; table scrolls horizontally *inside its own container*. |
| <640px (mobile) | Search full-width; filters stack; drawer becomes full-viewport width; table scrolls internally. |

No `overflow-x: auto` was added to the page, Workspace, or application shell. Horizontal scrolling is scoped exclusively to the `DataTable` wrapper. The sidebar/header/shell remain stable at every width.

## 5. Accessibility changes

- DatePicker trigger ↔ label association (§3.5) — labels no longer rely on placeholders.
- `aria-label` on date triggers now carries label + current value for screen readers.
- Verified (existing + new tests): all seven filter controls reachable by `getByLabelText`/label association; `aria-label`s on icon-only row actions; table `aria-label="Invoices"` + `aria-sort` on sortable headers; required-field indicators; visible focus states; drawer/modal focus traps and Escape handling (unchanged shared primitives, re-verified).

## 6. Drawer / dialog changes

- **Create/Edit drawers:** footer (Cancel / Save draft|Save changes) stays pinned while the body scrolls — confirmed in-browser (§8). Body scrolling + pinned footer was already the architecture; the remediation only fixed the mobile min-width floor.
- **Dialogs (Issue / Cancel / Delete):** reviewed — sizes, padding, title/description hierarchy, button hierarchy (secondary Cancel + primary/danger confirm), focus handling, Escape, backdrop close are all correct and unchanged.

## 7. Files changed

**Production code**
- `frontend/src/components/billing/invoices/containers/InvoiceListContainer.tsx` — `w-full min-w-0` on root (root-cause fix).
- `frontend/src/components/billing/invoices/containers/InvoiceDetailsContainer.tsx` — same hardening.
- `frontend/src/components/billing/invoices/InvoiceToolbar.tsx` — 440px search, two grouped `flex-wrap` filter rows, `w-full min-w-0` root.
- `frontend/src/components/billing/invoices/InvoiceTable.tsx` — `tableClassName="min-w-[1024px]"`.
- `frontend/src/components/billing/invoices/dialogs/CreateInvoiceDrawer.tsx` — `max-sm:min-w-0`.
- `frontend/src/components/billing/invoices/dialogs/EditInvoiceDrawer.tsx` — `max-sm:min-w-0`.
- `frontend/src/components/common/Input/DatePicker.tsx` — label association + informative `aria-label` (shared primitive).

**Tests**
- `frontend/src/components/billing/invoices/InvoiceToolbar.test.tsx` — **new** (11 tests: search rendering + width bound, all filter labels, two-row grouping, New invoice CTA, Clear behaviour, change propagation, doctor loading state, label accessibility).
- `frontend/src/components/billing/invoices/containers/InvoiceListContainer.test.tsx` — added layout regression guard (`w-full min-w-0` root).
- `frontend/src/components/billing/invoices/dialogs/CreateInvoiceDrawer.test.tsx` — added mobile min-width guard; adapted date query to the label association.
- `frontend/src/components/billing/invoices/dialogs/EditInvoiceDrawer.test.tsx` — adapted date queries to the informative accessible name.
- `frontend/src/components/patients/containers/PatientFormContainer.test.tsx` — adapted DOB query to the label association.
- `frontend/src/components/doctors/DoctorForm.test.tsx`, `frontend/src/components/common/UserSearchSelect/UserSearchSelect.test.tsx`, `frontend/src/routes/treatmentRouting.test.tsx` — **test-infrastructure robustness only**: bumped debounced-search wait timeouts (load flakes under the parallel full suite; passes in isolation). No production code touched.

## 8. Browser verification (Chrome, live backend on :8000)

Measured on the running app (`uiadmin@denscare.com` admin session):

| Viewport | document scrollWidth / innerWidth | Order select right edge | Result |
|---|---|---|---|
| 1920×1080 | 1920 / 1920 | 1156px | ✅ no horizontal overflow |
| 1440×900 | 1440 / 1440 | **996px** (was 1656px — clipped) | ✅ **fixed** |
| 1280×800 | 1280 / 1280 | 996px | ✅ no horizontal overflow |
| ~1024×768 | 1024 / 1024 | Order 464px, Sort by 840px | ✅ filters wrapped, both visible |
| ~504px (Chrome min width; mobile-equivalent) | 504 / 504 | — | ✅ no document overflow |

- Search input width at 1440px: **440px** (target 400–440px).
- **Drawer (mobile ~504px):** the Create Invoice drawer spans the full viewport width (panel right = 504 ≤ innerWidth 504 — no overflow), `Save draft`/`Cancel` footer visible (16px from viewport bottom) and **stays visible while the drawer body scrolls**.
- **No console errors** on any viewport.
- Note: Chrome's minimum window width is ~500px, so the requested 390px mobile width was verified at 504px (plus the `max-sm:min-w-0` unit-test guard for <640px). The 1920×1080 target was verified.

## 9. Backend compatibility confirmation

- No backend file was changed; no endpoint, request payload, response model, lifecycle rule, validation rule or permission behavior was altered.
- The frontend still sends exactly the same `GET /billing/invoices` params (query/status/patient_id/doctor_id/date_from/date_to/sort_by/sort_order/page/page_size) and the same create/edit/issue/cancel/delete payloads.
- Row actions remain state-machine driven (`getInvoiceActions`), Delete stays admin-gated, 403 → permission state (never retried), filters remain 100% server-side.
- No fake features (payments/receipts/refunds/credit notes/GST/insurance) were added.

## 10. Remaining limitations

1. **Sticky table header not implemented.** The shared `DataTable` wraps the table in `overflow-x-auto`, which computes `overflow-y: auto` — making the *wrapper* (not the page) the sticky scroll container. A `position: sticky; top: 0` header would therefore never engage without either nested vertical scrolling (rejected per §11 of the task: no unnecessary nested scroll containers) or a generic DataTable redesign (rejected per §10 of the task). Deliberately skipped; documented here for future work.
2. **True 390px viewport not directly measurable** in this environment (Chrome minimum window ≈500px); the sub-640px drawer behaviour is covered by the `max-sm:min-w-0` unit-test guard and the 504px in-browser check.
3. **Pre-existing flaky tests** in unrelated modules (`DoctorForm`, `UserSearchSelect`, `treatmentRouting`) under parallel full-suite load were made robust via timeout bumps (test-only). The invoice module itself has no flaky tests.
4. The DatePicker `aria-label` change is a shared-primitive behavioural change (accessible-name format for date triggers) — intentional per §34 (label association, WCAG orientation) and covered by updated tests, but it does affect other modules' date fields' announced names.

## 11. Quality gates

- `npm test` — **1294/1294 passed** across 170 files (invoice suite green, plus the updated cross-module tests).
- `npm run lint` — clean.
- `tsc -b` — clean.
- `npm run build` — succeeds.
