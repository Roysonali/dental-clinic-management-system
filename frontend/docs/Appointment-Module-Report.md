# Appointment Module — Sprint 10A + 10A.1 + 10A.2 Completion Report

**Module:** Appointments (frontend) · **Branch:** `feature/appointment`
**Report date:** 2026-08-04 · **Status:** Production-ready (OpenCode review: Approved / Option B)
**Sprint 10A.2:** Post-review hardening — React Query retry policy, doctor create
flow UX, timezone-safe date helper, query-key namespacing, repo cleanup,
documentation corrections.

---

## 1. Executive Summary

The Appointment module was continued from the baseline left by the previous
implementation engineer (Kilo). Kilo's foundation — types, services, constants,
React Query hooks, list components, dashboard widget and routing — was reviewed
against the Patient module standard and the backend contract, fixed where it had
genuine issues, and then completed with the missing backend-aligned features:

- **Appointment Details page** (`GET /appointments/{id}`)
- **Create flow** (`POST /appointments`) via a New Appointment drawer
- **Edit / Reschedule flow** (`PUT /appointments/{id}`)
- **Cancel flow** (`PATCH /appointments/{id}/cancel`) with confirmation dialog

A full test suite (services, hooks, components, containers, pages, form utils,
date utils) was added, matching the Patient module's depth, and the module was
hardened for production (accessibility, query gating, memoization, coverage
config, error/empty/loading states).

**Verdict: READY.** The module reaches the same enterprise quality bar as the
approved Patient module. It compiles, lints, builds and passes 307 tests.
Backend contract alignment is exact; no frontend-only fields or invented
endpoints were introduced.

---

## 2. Architecture Review

The module follows the exact architecture of the approved Patient module:

| Layer | Patient module (reference) | Appointment module |
|---|---|---|
| Types | `types/patient.ts` | `types/appointment.ts`, `types/doctor.ts` |
| Constants | `constants/patient.ts` | `constants/appointment.ts` |
| Services | `services/patientService.ts` | `services/appointmentService.ts`, `doctorService.ts` |
| Hooks | `hooks/patients/*` | `hooks/appointments/*`, `hooks/doctors/useDoctors.ts` |
| Presentational components | `components/patients/*` | `components/appointments/*` |
| Containers | `components/patients/containers/*` | `components/appointments/containers/*` |
| Pages | `pages/patients/*` | `pages/appointments/*` |
| Form utils | `patientFormUtils.ts` | `appointmentFormUtils.ts` |

**Shared infrastructure reused (zero duplication):** `DataTable`, `Pagination`,
`Modal`, `Drawer`, `StatusBadge`/`Badge`, `Button`, `IconButton`, `Icon`,
`Skeleton`, `Spinner`, `EmptyState`, `ResultState`, `PatientAvatar`, `Tabs`,
`Form`/`FormActions`/`ValidationSummary`/`FormField`, `Select`, `Textarea`,
`DatePicker`, `TimePicker`, `PageWrapper`, `ContentContainer`,
`@tanstack/react-query`, `parseApiError`, `useDebounce`, `renderWithProviders`.

**No new architectural patterns introduced.** React Query usage mirrors
`usePatients`/`usePatientMutations` (query-key factories, `keepPreviousData`,
invalidate-on-success). Mutations invalidate the whole `appointments` prefix so
list, today and detail views stay fresh.

---

## 3. Review of Kilo's Implementation

### Reviewed files
`types/appointment.ts`, `types/doctor.ts`, `services/appointmentService.ts`,
`services/doctorService.ts`, `constants/appointment.ts`,
`hooks/useAppointments.ts`, `hooks/useTodayAppointments.ts`,
`hooks/useAppointmentNames.ts`, `components/AppointmentStatusBadge.tsx`,
`AppointmentHeader.tsx`, `AppointmentTable.tsx`, `UpcomingAppointmentCard.tsx`,
`UpcomingAppointments.tsx`, `containers/AppointmentListContainer.tsx`,
`pages/AppointmentListPage.tsx`, `utils/date.ts`, routing + dashboard wiring.

### Verdict
High quality. Clean layering, exact backend enum/pagination alignment, graceful
fallbacks, good memoization (`useMemo` for ids and enrichment), and the
`useAppointmentNames` caching design is sound. **No architectural rewrites were
needed.**

### Genuine issues found & fixed
| # | Issue | Fix |
|---|---|---|
| 1 | `useAppointmentNames` iterated the **raw** id arrays in its queryFn while deduplicating only the query key — duplicate ids caused duplicate API calls | QueryFn now resolves against the deduplicated, sorted id-sets |
| 2 | `AppointmentListContainer` did not pass `totalCount`/`pageSize` to `Pagination` (no "X–Y of N results" line, unlike the Patient module) | Added both props |
| 3 | Dashboard `UpcomingAppointments` usage was mis-indented (cosmetic) | Fixed |
| 4 | Coverage config (`vite.config.ts`) did not instrument appointment module files | Added appointment/doctor files to `coverage.include` |
| 5 | No tests existed for the module | Full suite added (see §7) |

---

## 4. Backend Compatibility Verification

Verified against `backend/app/modules/appointments/router.py`, `schema.py`,
`enums.py`, `service.py`, `validators.py` and `app/core/constants.py`:

| Backend endpoint | Method/status | Frontend |
|---|---|---|
| `GET /appointments?skip&limit` | 200, `{items, total}` | `appointmentService.list` + `useAppointments` |
| `POST /appointments` | 201, `AppointmentResponse` | `appointmentService.create` + `useCreateAppointment` + New Appointment drawer |
| `GET /appointments/today` | 200, array | `appointmentService.today` + `useTodayAppointments` + dashboard widget |
| `GET /appointments/{id}` | 200, `AppointmentResponse` | `appointmentService.get` + `useAppointment` + Details page |
| `PUT /appointments/{id}` | 200, `AppointmentResponse` | `appointmentService.update` + `useUpdateAppointment` + Edit drawer |
| `PATCH /appointments/{id}/cancel` | 200, `AppointmentResponse` | `appointmentService.cancel` + `useCancelAppointment` + Cancel dialog |
| `GET /doctors` (list) | 200, `{items, total, page, page_size}` | `doctorService.list` + `useDoctors` (dentist dropdown) |
| `GET /doctors/user/{id}` | 200, `DoctorResponse` | `doctorService.getByUserId` (name enrichment) |

**Enums:** `AppointmentStatus` (7 values) and `AppointmentType` (6 values) match
verbatim. **Pagination:** skip/limit default 20, max 100 — mirrored in
constants. **Error envelope:** backend `{success, message, details}` handled by
the shared `parseApiError` (including Pydantic field errors mapped to form
fields).

### Known backend limitations (mirrored, not invented around)
1. **No status-transition endpoint.** `AppointmentStatusUpdate` exists in
   `schema.py` but is **not routed**. The only lifecycle mutation available is
   `cancel`. The UI therefore provides no Check-in / In-Treatment / Complete /
   No-Show buttons; the status badge is display-only and the Edit action is
   disabled only for `Completed` (the service's sole edit restriction).
2. **Cancel is only valid from `Scheduled`/`Confirmed`** (validator
   `validate_status_transition`). The UI exposes the cancel action only for
   those two statuses.
3. **`GET /doctors` is ADMIN/RECEPTIONIST only.** Doctor-role users cannot load
   the dentist list; the form degrades gracefully (empty dropdown + helper
   note, current dentist still shown in edit mode). Documented in code.
4. **List endpoint has no search/sort/filter query params** — only skip/limit.
   Search and status filtering are therefore applied **client-side over the
   current page's enriched rows**; sorting is client-side (DataTable). No
   doctor/date toolbar filters were invented (no backend support).
5. **`patient_id` is not editable** in `AppointmentUpdate` — the form locks the
   patient in edit mode.

---

## 5. Features Completed in This Sprint

- **Appointment Details page** — `/appointments/:appointmentId` with hero header
  (back link, appointment number, status badge, type, schedule summary,
  created/updated audit), details card (date/time/duration/type/status, reason,
  notes), people card (patient linked to their record, dentist), edit drawer
  and cancel dialog. Loading / error+retry / not-found states included.
- **Create flow** — "New Appointment" button (list header) → drawer with the
  shared form → POST → navigates to the new appointment.
- **Edit / Reschedule flow** — row action + details-page Edit button → drawer
  pre-filled from the record → PUT → invalidates caches.
- **Cancel flow** — row action (Scheduled/Confirmed only) + details-page button
  → confirmation dialog with appointment summary → PATCH → invalidates caches.
- **PatientPicker** — searchable patient combobox (debounced search, avatar
  results, clear button, fixed-label mode for edit), reusing `useDebounce`,
  `patientService.list` and `PatientAvatar`.
- **Dentist dropdown** — `useDoctors` (gated to drawer-open), edit mode always
  keeps the current dentist selectable.
- **Form validation mirrors the backend** — required ids, ISO date, Mon–Sat
  working days, clinic sessions (10:00–13:00 / 17:00–21:00 incl. duration),
  durations 15/30/45/60, type enum, 3–500 char reason, ≤5000 notes. Server
  errors map to fields via `parseApiError`.
- **Row actions** — View / Edit (disabled for Completed) / Cancel (only
  cancellable statuses) with accessible labels.
- **Pagination** — footer with Previous/Next, page numbers, summary line
  (`1–20 of 45 appointments`) and a rows-per-page selector. While a client-side
  search/status filter is active the footer is intentionally hidden — it would
  otherwise show a backend total that doesn't match the filtered view.

---

## 5A. Sprint 10A.1 — UI/UX Refinement & Enterprise Consistency

A dedicated pass brought the Appointment list page to the exact visual and
layout standard of the approved Patient module. **No backend contracts, React
Query architecture, services or endpoints were touched** — UI/UX only.

### What changed (before → after)

| Aspect | Before | After (Patient parity) |
|---|---|---|
| Page hierarchy | Custom `AppointmentHeader` (title + summary + page-size inline) | Shared `PageHeader` (title + subtitle) in `AppointmentListPage`, identical to `PatientListPage` |
| Toolbar | None — no search, filters or columns menu | `AppointmentToolbar` mirroring `PatientToolbar`: search + status filter + Columns menu + **New Appointment** CTA (Columns renders *beneath* the CTA, never beside it) |
| Status filter | None | `AppointmentFilters` — compact native `<select>` (All + 7 statuses) styled with the same toolbar tokens |
| Pagination | Rows-per-page under the header button, visually disconnected | All controls in the shared `Pagination` footer: Previous/Next, page numbers, "X–Y of N results", rows-per-page selector |
| Empty state | Text only | Shared `EmptyState` (icon, title, description, **New Appointment** CTA) via `DataTable.emptyAction` |
| Error state | Small centered region | Full-width `ResultState` panel (same width as the table) with centered Retry, via the shared `DataTable` |
| 401 UX | Raw "Not authenticated" | "Your session has expired. Please sign in again." via the new shared `apiErrorMessage()` helper |
| Spacing/alignment | Title/CTA/page-size disconnected | Patient `PageHeader` rhythm; `DataTableToolbar` gap/stacking tokens; controls share heights, radii, focus/hover states |

### Filtering semantics (backend-aligned)
`GET /appointments` supports only `skip`/`limit` (verified in `router.py`) —
there is no server-side search, status, doctor or date filter. Per the
"(if backend supports)" guidance, doctor/date filters were **not** added;
search + status are applied **client-side over the current page's enriched
rows** (`useAppointmentFilters` + a memoised filter in the container), giving
Patient-equivalent toolbar UX without inventing contract params.

While a search/status filter is active the footer pagination is intentionally
hidden — client-side filtering only ever sees the current backend page, so the
backend total and page controls would otherwise be misleading.

### Files
- **Created:** `AppointmentToolbar.tsx`, `AppointmentFilters.tsx`,
  `hooks/appointments/useAppointmentFilters.ts` + 3 test files
  (`AppointmentToolbar.test.tsx`, `AppointmentFilters.test.tsx`,
  `useAppointmentFilters.test.tsx`)
- **Modified:** `AppointmentListPage.tsx`, `AppointmentTable.tsx`,
  `AppointmentListContainer.tsx`, `AppointmentDetailsContainer.tsx`,
  `services/apiError.ts` (added `apiErrorMessage`), `services/apiError.test.ts`,
  `AppointmentTable.test.tsx`, `AppointmentListContainer.test.tsx`,
  `AppointmentListPage.test.tsx`
- **Removed:** `AppointmentHeader.tsx` + its test (responsibilities moved to
  `PageHeader` + the `Pagination` footer)

### Verification (this pass)
- **Accessibility:** native `<select>` with `aria-label`, visible focus ring,
  keyboard-navigable options, decorative chevron (`pointer-events-none`);
  search/status/columns/CTA share design-system heights, radii, hover and
  focus states; CTA is `shrink-0 whitespace-nowrap` (never wraps); toolbar
  stacks responsively below `lg`.
- **Responsive:** toolbar wraps exactly like the Patient module; Columns moves
  beneath the CTA; filters wrap naturally; no overlapping controls.
- **Regression:** full suite green (see §7); `tsc`/ESLint clean for the
  module; `vite build` succeeds.

---

## 5B. Sprint 10A.2 — Post-Review Hardening

OpenCode's independent production review approved the module (Option B). The
following targeted improvements were implemented — **no redesign, no backend
changes, no new endpoints, no shared-infrastructure churn**:

### 1. React Query retry hardening
- New shared `shouldRetryQuery(failureCount, error)` in `services/apiError.ts`:
  **401/403 → never retry** (outcome cannot change); all other failures
  (network, 5xx, timeout…) **retain the global default single retry**.
- Applied to `useDoctors` and `useAppointmentNames` — the two queries that can
  legitimately hit authorization failures (doctor-role users reading
  ADMIN/RECEPTIONIST endpoints). No more wasted retry attempts on expected
  403s. API contracts unchanged.

### 2. Doctor create flow (403 on dentist list)
- Root cause: `POST /appointments` allows doctors, but `GET /doctors` is
  ADMIN/RECEPTIONIST-only, so a doctor-role user sees an empty dentist
  dropdown and cannot complete the form.
- Safe frontend-only fix (no invented API, no auth bypass): the form now
  renders an explicit `role="alert"` banner explaining the dentist list could
  not be loaded and why (permission-restricted), and advising a receptionist
  can schedule it — instead of a silent empty dropdown. Edit mode still
  preserves the current dentist via `GET /doctors/user/{id}`.
- Backend dependency documented: the frontend has no authenticated user-context
  hook, so auto-selecting the caller's own dentist is not possible without an
  additional backend contract (out of scope).

### 3. Timezone hardening
- `AppointmentForm` used `new Date().toISOString().slice(0, 10)` for the
  date-picker `minDate` — UTC-based, off-by-one in timezones east of UTC.
- New `todayLocalISO()` helper in `utils/date.ts` builds `YYYY-MM-DD` from
  local calendar components; the form now uses it.

### 4. Query-key hardening
- `useAppointmentNames` previously flattened both id-lists into one array
  (`['appointment-names', ...patientIds, ...dentistIds]`) where a patient id
  and dentist id sharing a primitive value could collide. The key is now
  namespaced: `['appointment-names', { patients, dentists }]`.

### 5. Repository cleanup
- Removed orphaned `src/pages/dashboard/AppointmentItem.tsx` (unused since the
  dashboard switched to `UpcomingAppointments`).
- Added `coverage/` to `frontend/.gitignore` and **untracked the 174 committed
  coverage HTML artifacts** (`git rm -r --cached coverage`) — files remain on
  disk locally, no longer staged for commits.

### 6. Documentation corrections (this report)
- Test count corrected (307), lint/tsc results corrected and clearly split into
  **module-scoped** vs **repository-wide** validation, coverage figures
  refreshed (see §7), pagination wording corrected (§5) to state that the
  footer hides while a client-side filter is active.

---

## 6. Files Created / Modified

### Created (25)
- `src/types/appointment.ts` *(modified — added payload + form types)*
- `src/types/doctor.ts` *(modified — added list params/response)*
- `src/services/appointmentService.ts` *(modified — create/update/cancel)*
- `src/services/doctorService.ts` *(modified — list)*
- `src/hooks/appointments/useAppointment.ts`
- `src/hooks/appointments/useAppointmentMutations.ts`
- `src/hooks/doctors/useDoctors.ts`
- `src/components/appointments/PatientPicker.tsx`
- `src/components/appointments/AppointmentForm.tsx`
- `src/components/appointments/AppointmentDrawer.tsx`
- `src/components/appointments/CancelAppointmentDialog.tsx`
- `src/components/appointments/AppointmentDetailsHeader.tsx`
- `src/components/appointments/AppointmentInfoCard.tsx`
- `src/components/appointments/AppointmentPartiesCard.tsx`
- `src/components/appointments/appointmentFormUtils.ts`
- `src/components/appointments/containers/AppointmentFormContainer.tsx`
- `src/components/appointments/containers/AppointmentDetailsContainer.tsx`
- `src/pages/appointments/AppointmentDetailsPage.tsx`

### Tests created (22)
- `services/appointmentService.test.ts`, `services/doctorService.test.ts`
- `hooks/appointments/useAppointments.test.tsx`, `useAppointment.test.tsx`,
  `useAppointmentNames.test.tsx`, `useTodayAppointments.test.tsx`,
  `useAppointmentMutations.test.tsx`
- `components/appointments/AppointmentForm.test.tsx`,
  `AppointmentHeader.test.tsx`, `AppointmentStatusBadge.test.tsx`,
  `AppointmentTable.test.tsx`, `UpcomingAppointments.test.tsx`,
  `UpcomingAppointmentCard.test.tsx`, `PatientPicker.test.tsx`,
  `CancelAppointmentDialog.test.tsx`, `appointmentFormUtils.test.ts`
- `components/appointments/containers/AppointmentListContainer.test.tsx`,
  `AppointmentDetailsContainer.test.tsx`
- `pages/appointments/AppointmentListPage.test.tsx`,
  `AppointmentDetailsPage.test.tsx`
- `utils/date.test.ts`

### Modified
- `src/components/appointments/AppointmentTable.tsx` (row actions)
- `src/components/appointments/containers/AppointmentListContainer.tsx`
  (navigation, drawer, dialog, New Appointment, pagination props)
- `src/hooks/appointments/useAppointmentNames.ts` (dedupe fix + namespaced
  query key + `shouldRetryQuery`)
- `src/hooks/doctors/useDoctors.ts` (`shouldRetryQuery` retry policy)
- `src/services/apiError.ts` (`shouldRetryQuery` helper)
- `src/components/appointments/AppointmentForm.tsx` (`todayLocalISO` minDate +
  dentist-list-unavailable banner)
- `src/utils/date.ts` (`todayLocalISO` helper)
- `src/constants/appointment.ts` (durations, type options, cancel rules)
- `src/routes/AppRouter.tsx` (details route)
- `src/pages/dashboard/DashboardPage.tsx` (indentation)
- `vite.config.ts` (coverage include)
- `.gitignore` (added `coverage/`; untracked 174 committed coverage artifacts)

### Removed (Sprint 10A.2)
- `src/pages/dashboard/AppointmentItem.tsx` (orphaned — unused since the
  dashboard switched to `UpcomingAppointments`)

---

## 7. Test Summary

```
Test Files  44 passed (44)
     Tests  307 passed (307)
```

- **Pre-existing patient/common/infra test files** — untouched, still green.
- **Appointment module tests** cover: services (incl. `apiErrorMessage`),
  hooks (list, detail, names, today, mutations, filters), form utils, date
  utils, components (badge, table, toolbar, filters, form, picker, cancel
  dialog, upcoming widgets), containers (list + details) and pages.
- **Sprint 10A.1 additions:** `AppointmentToolbar.test.tsx` (5),
  `AppointmentFilters.test.tsx` (4), `useAppointmentFilters.test.tsx` (6),
  plus new cases in the table (toolbar wiring, empty-state CTA), list
  container (rows-per-page footer, client-side search/status filtering,
  pagination hidden while filtering, 401 friendly message, full-width error
  panel), page (PageHeader) and `apiError.test.ts` (`apiErrorMessage`).
- **Sprint 10A.2 additions:** `shouldRetryQuery` cases in `apiError.test.ts`
  (401/403 no-retry + retained retry for transient/network failures),
  `todayLocalISO` cases in `date.test.ts` (local-timezone boundary),
  query-key namespace collision case in `useAppointmentNames.test.tsx`, and
  the dentist-list-error banner case in `AppointmentForm.test.tsx`.

### Coverage summary (appointment module)
| Scope | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `components/appointments` (incl. containers) + `pages/appointments` + `hooks/appointments` | ~87–92% | ~86–88% | ~86% | ~92% |
| `constants/appointment.ts` | 100% | 73% | 100% | 100% |
| `hooks/doctors/useDoctors.ts` | 100% | 100% | 100% | 100% |
| `services/doctorService.ts` | 100% | 100% | 100% | 100% |
| `services/apiError.ts` (incl. `shouldRetryQuery`) | 96% | 91% | 100% | 98% |
| `utils/date.ts` (incl. `todayLocalISO`) | 96% | 95% | 100% | 100% |

> **Coverage note:** figures above are from a **module-scoped** coverage run
> (appointment files + the shared `apiError.ts`/`date.ts`). The repository-wide
> `npm run test:coverage` run includes all common components and is not a
> meaningful module metric — module numbers are reported here.

---

## 8. Accessibility Verification

- **Dialog/Drawer**: shared `Modal`/`Drawer` primitives provide `role="dialog"`,
  `aria-modal`, `aria-label`, focus trap, Escape-to-close and focus restore.
- **Table**: `aria-label` on table, `aria-sort` on sortable headers, `aria-busy`
  while loading, keyboard-sortable header buttons, labelled icon row actions
  (`View APT-…`, `Edit APT-…`, `Cancel APT-…`).
- **Forms**: labels associated with controls, `aria-invalid`, error/helper
  `aria-describedby`, `ValidationSummary` with `role="alert"` error banners.
- **Pagination**: `aria-label`/`aria-current="page"` on page buttons.
- **PatientPicker**: `role="combobox"`, `aria-expanded`, `aria-controls`,
  `role="listbox"`/`role="option"`, `aria-selected`. (Full arrow-key combobox
  navigation is a documented enhancement — Tab reaches all options.)
- **Distinct action names**: dialog confirm renamed to "Yes, Cancel Appointment"
  to avoid duplicate accessible names with the header action.
- **Keyboard activation**: `UpcomingAppointmentCard` is `role="button"` +
  `tabIndex=0` when clickable.

---

## 9. Performance Verification

- **React Query**: `keepPreviousData` on the list (no layout jump), cached name
  enrichment (`staleTime: 5min`, deduplicated), mutation invalidation of the
  `appointments` prefix only.
- **Query gating**: `useDoctors` is enabled only while the create/edit drawer is
  open — the list/details pages never fire `GET /doctors` on load (and never
  hit the 403 doctors receive on that endpoint).
- **Memoization**: id arrays, enriched rows, dentist options and detail
  enrichment are `useMemo`-derived; `useAppointmentNames` results are shared
  across subscribers via a single query key.
- **No re-render hotspots**: containers pass stable callbacks; presentational
  components are pure.

---

## 10. Regression Verification

- Full suite: **307/307 passing** (patient module and shared-infra tests
  included — no regressions).
- `vite build`: **succeeds** (2137 modules; chunk-size warning is pre-existing
  and unrelated to this module).
- ESLint scoped to the module: **clean**.
- TypeScript: **no errors in any appointment/doctor file**.

### Pre-existing foundation errors (NOT introduced by this work)
`tsc -b` reports **20 errors in foundation files** that predate this module and
are unrelated to it: `auth/forms/LoginForm.tsx` (3), `RegisterForm.tsx` (3),
`RememberMeCheckbox.tsx` (1), `common/Avatar/index.ts` (1),
`common/Drawer/Drawer.tsx` (2), `common/Dropdown/Dropdown.tsx` (1),
`common/StatCard/StatCard.tsx` (1), `common/Tooltip/Tooltip.tsx` (2),
`layouts/components/header/index.ts` (3), `theme/colors.ts` (1),
`types/auth.ts` (1). ESLint also flags `types/auth.ts` (`RoleName` unused).
These should be tracked separately from the Appointment module.

---

## 11. Known Backend Limitations (frontend-facing)

1. No status-transition endpoint — only cancel (see §4).
2. Cancel restricted to `Scheduled`/`Confirmed`.
3. Doctor list is ADMIN/RECEPTIONIST only (graceful degradation implemented;
   Sprint 10A.2 added an explanatory banner + retry policy so doctor-role
   users get a clear message instead of a silent empty dropdown).
4. No server-side search/filters on the list endpoint (client-side only).
5. `patient_id` immutable after creation.
6. `GET /doctors` returns no paged UX beyond page 1 (max 100 active doctors
   assumed sufficient for the dropdown).
7. **No authenticated user-context hook in the frontend** — the create flow
   cannot auto-select the caller's own dentist for doctor-role users. Doing so
   would require an additional backend contract (out of scope); the form
   explains the limitation instead.

---

## 12. Validation Results

> **Scope split:** module-scoped results (appointment/doctor files + shared
> `apiError.ts`/`date.ts`) are listed separately from repository-wide results,
> which include pre-existing foundation issues unrelated to this module.

| Command | Scope | Result |
|---|---|---|
| `npm run test` | repository-wide | ✅ 44 files, 307 tests passed |
| `npx tsc -b` | repository-wide | ⚠️ 20 **pre-existing** foundation errors (listed in §10) |
| `npx tsc -b` | module | ✅ 0 errors in any appointment/doctor/`apiError`/`date` file |
| `npm run lint` | module | ✅ clean (0 errors, 0 warnings) |
| `npm run lint` | repository-wide | ⚠️ 9 pre-existing problems in foundation files (7 errors, 2 warnings) |
| `vite build` | repository-wide | ✅ builds successfully (chunk-size warning pre-existing) |
| `npm run test:coverage` | module | ✅ ≥86% branch, ≥92% line for appointment files (see §7) |

**No new lint/tsc/build warnings were introduced by this sprint's changes.**

---

## 13. Final Production Readiness Assessment

| Criterion | Status |
|---|---|
| Enterprise architecture (layered, container/presentational) | ✅ |
| Full reuse of shared infrastructure (no duplication) | ✅ |
| Exact backend contract alignment (endpoints, enums, DTOs, errors) | ✅ |
| Strong TypeScript typing (no `any` in source) | ✅ |
| Comprehensive tests (services → pages) | ✅ |
| Accessibility (dialogs, tables, forms, keyboard) | ✅ |
| Performance (query gating, memoization, invalidation) | ✅ |
| Error / loading / empty states | ✅ |
| Production build | ✅ |

**Ready for independent review (OpenCode) with minimal expected remediation.**
