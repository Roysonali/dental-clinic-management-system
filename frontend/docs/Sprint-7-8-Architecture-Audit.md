# DensCare — Sprint 7 & Sprint 8 Architecture Audit Report

**Date:** August 1, 2026  
**Audit Scope:** Complete review of `frontend/src` — components, hooks, utils, layouts, pages, theme.  
**Result:** **Option B (both sprints partially complete)** — implement only missing pieces, reuse everything else.

---

## 1. Audit Method

Every folder under `frontend/src` was inspected:

| Area | Reviewed |
|------|----------|
| `components/common/` | All 30+ primitive folders (Button, Input, Select, Checkbox, Radio, Switch, Grid, Stack, Skeleton, EmptyState, ResultState, Pagination, SearchBar, StatusBadge, Alert, Dropdown, Popover, Modal, Drawer, Toast, etc.) |
| `components/auth/` | Login/Register forms (form conventions, react-hook-form usage) |
| `layouts/` | AppShell, Sidebar, Header, MobileDrawer, Workspace |
| `hooks/` | useMediaQuery, usePageTitle, useGlobalShortcut |
| `utils/` | formatting, storage, validation |
| `theme/` | colors, typography, spacing, radius, shadows, transitions, breakpoints |
| `pages/` | Dashboard, Login, Register |
| `package.json` | Dependency contracts (react-hook-form, zod, react-query, zustand) |

Files were **opened and read** — decisions were not made from folder names alone.

---

## 2. Sprint 7 — Core Data Display Framework

### 2.1 Existing Components (REUSE — do not recreate)

| Component | File Path | Purpose | Reusability | Production Readiness | Missing Features |
|-----------|-----------|---------|-------------|----------------------|------------------|
| `Pagination` | `components/common/Pagination/Pagination.tsx` | Page navigation (first/last/prev/next, ellipsis, page-size slot) | High — generic, layout-agnostic | ✅ Production-ready (aria-current, aria-label) | None material |
| `SearchBar` | `components/common/SearchBar/SearchBar.tsx` | Search input with icon, clear, loading, shortcut kbd | High | ✅ Production-ready | Does **not** debounce by design — needs `useDebounce` wrapper (now provided) |
| `Skeleton` | `components/common/Skeleton/Skeleton.tsx` | Loading placeholders incl. `table-row` variant | High | ✅ | — |
| `EmptyState` | `components/common/EmptyState/EmptyState.tsx` | Empty-list states (icon, title, description, actions) | High | ✅ | — |
| `ResultState` | `components/common/ResultState/ResultState.tsx` | Full-page outcome states (error/success/warning/info) | High | ✅ | — |
| `StatusBadge` | `components/common/StatusBadge/StatusBadge.tsx` | Status-cell primitive (maps domain status → badge variant) | High — this **is** the Status Cell capability | ✅ | — |
| `Checkbox` | `components/common/Checkbox/Checkbox.tsx` | Row/bulk selection checkbox (supports **indeterminate**) | High — required for bulk selection | ✅ | — |
| `Alert` | `components/common/Alert/Alert.tsx` | Error-state banner with retry actions | High | ✅ | — |
| `Badge` / `Card` / `Grid` / `Stack` / `Spinner` / `LoadingOverlay` | `common/` | Supporting primitives | High | ✅ | — |

### 2.2 Missing Components (IMPLEMENT — Sprint 7)

| Capability | Status | Notes |
|-----------|--------|-------|
| Generic Table / DataGrid / DataTable | ❌ **Missing** | No `<table>` component exists anywhere in the project |
| Column definitions | ❌ **Missing** | No column-descriptor type or API |
| Sorting | ❌ **Missing** | No sortable-header primitive, no sort-state model |
| Table Toolbar (search + filters + actions + column visibility) | ❌ **Missing** | SearchBar exists but no toolbar composition |
| Bulk selection / row selection | ❌ **Missing** | Checkbox primitive exists; no table-level selection model |
| Column visibility | ❌ **Missing** | No toggling mechanism |
| Table actions (row action cells) | ❌ **Missing** | No per-row action pattern |

**Verdict: Sprint 7 is PARTIALLY implemented.** The building blocks exist; the DataTable framework itself does not.

---

## 3. Sprint 8 — Reusable Form Infrastructure

### 3.1 Existing Components (REUSE — do not recreate)

| Component | File Path | Purpose | Reusability | Production Readiness |
|-----------|-----------|---------|-------------|----------------------|
| `FormField` | `components/common/Form/FormField.tsx` | Field wrapper (Label + control + HelperText + ErrorMessage, `aria-describedby`) | High | ✅ |
| `Label` / `HelperText` / `ErrorMessage` | `common/Form/` | Field anatomy | High | ✅ |
| `Input` | `common/Input/Input.tsx` | Text input (icons, prefix/suffix, error/success/readOnly) | High | ✅ |
| `Textarea` | `common/Input/Textarea.tsx` | Multi-line (autoResize, char count) | High | ✅ |
| `Select` | `common/Input/Select.tsx` | Native dropdown (placeholder, disabled options) | High | ✅ |
| `PasswordInput` | `common/Input/PasswordInput.tsx` | Password with show/hide | High | ✅ |
| `Checkbox` / `Radio` / `RadioGroup` / `Switch` | `common/` | Boolean/choice inputs | High | ✅ |
| `Grid` | `common/Grid/Grid.tsx` | Responsive form layout | High | ✅ |
| `Section` | `common/Section/Section.tsx` | Form sections / page sections | High | ✅ |
| `validation.ts` | `utils/validation.ts` | Email/password/presence helpers | High | ✅ |
| `react-hook-form` + `zod` + `@hookform/resolvers` | `package.json` | Form state + validation (already used in Login/Register) | High | ✅ |

### 3.2 Missing Components (IMPLEMENT — Sprint 8)

| Capability | Status | Notes |
|-----------|--------|-------|
| Form wrapper (`<Form>` component) | ❌ **Missing** | Pages use raw `<form>` |
| Form actions bar (submit/cancel) | ❌ **Missing** | Repeated manually |
| Validation summary (form-level error list) | ❌ **Missing** | 422 responses need a summary UI |
| MultiSelect | ❌ **Missing** | Only native single Select exists |
| DatePicker | ❌ **Missing** | No date control at all |
| TimePicker | ❌ **Missing** | No time control at all |
| FileUpload | ❌ **Missing** | No file control at all |
| `useDebounce` hook | ❌ **Missing** | SearchBar explicitly defers debouncing to a wrapper |

**Verdict: Sprint 8 is PARTIALLY implemented.** Core field primitives are production-ready; composition and advanced pickers are missing.

---

## 4. Duplicate Risk Analysis

- **No existing `Table`/`DataGrid`/`Form` component exists** — the file-picker initially suggested `common/Table/` paths, but **verification via glob + ripgrep confirmed those files do not exist**. The named `Pagination.tsx`, `TablePagination.tsx`, `TableToolbar.tsx` candidates were hallucinations — only the generic `Pagination/` and `SearchBar/` folders exist.
- New `DataTable` will **compose** existing `Checkbox`, `Skeleton`, `EmptyState`, `ResultState`, `StatusBadge`, `Pagination`, `SearchBar` — no duplication.
- New form components will **compose** existing `FormField`, `Button`, `Badge`, `Popover`, `Grid` — no duplication.
- No form library is being added; the existing `react-hook-form` + `zod` stack is retained.

---

## 5. Architecture Assessment

| Question | Answer |
|----------|--------|
| Is Sprint 7 already implemented? | **No** — partial. Building blocks exist; DataTable framework absent. |
| Is Sprint 8 already implemented? | **No** — partial. Field primitives exist; composition + pickers absent. |
| Partially implemented? | **Yes, both.** |
| Which parts should be reused? | All components in §2.1 and §3.1. |
| Which parts should never be recreated? | Pagination, SearchBar, Skeleton, EmptyState, ResultState, StatusBadge, Checkbox, FormField, Input, Textarea, Select, Switch, Grid, Section, validation utils. |

---

## 6. Recommendation

**Option B — Sprint partially complete. Implement only missing pieces. Reuse everything else.**

- Sprint 7: Implement `DataTable` + `DataTableToolbar` + column/sort/selection type model. Compose existing primitives.
- Sprint 8: Implement `Form`, `FormActions`, `ValidationSummary`, `MultiSelect`, `DatePicker`, `TimePicker`, `FileUpload`, `useDebounce`. Compose existing primitives.

---

## 7. Implementation Summary

### Files Created

| File | Sprint | Purpose |
|------|--------|---------|
| `components/common/DataTable/types.ts` | 7 | Column descriptors, sort state, selection, visibility types |
| `components/common/DataTable/DataTable.tsx` | 7 | Generic data table (columns, sorting, selection, skeleton/empty/error states, row actions) |
| `components/common/DataTable/DataTableToolbar.tsx` | 7 | Search + filter slot + column-visibility menu |
| `components/common/DataTable/index.ts` | 7 | Barrel export |
| `components/common/Form/Form.tsx` | 8 | Form wrapper (`noValidate`, preventDefault, spacing) |
| `components/common/Form/FormActions.tsx` | 8 | Submit/cancel action bar with loading state |
| `components/common/Form/ValidationSummary.tsx` | 8 | Form-level error list (RHF-compatible) |
| `components/common/Input/MultiSelect.tsx` | 8 | Multi-select with checkbox menu |
| `components/common/Input/DatePicker.tsx` | 8 | Calendar popover date picker |
| `components/common/Input/TimePicker.tsx` | 8 | Time list picker (12h/24h, configurable step) |
| `components/common/Input/FileUpload.tsx` | 8 | Drag-and-drop file upload with validation |
| `hooks/useDebounce.ts` | 7 | Debounced value hook (completes SearchBar contract) |

### Files Modified

| File | Change |
|------|--------|
| `components/common/Form/index.ts` | Export `Form`, `FormActions`, `ValidationSummary` |
| `components/common/Input/index.ts` | Export `MultiSelect`, `DatePicker`, `TimePicker`, `FileUpload` |

### Components Reused (not recreated)
`Checkbox`, `Skeleton`, `EmptyState`, `ResultState`, `Alert`, `StatusBadge`, `Pagination`, `SearchBar`, `Button`, `Badge`, `FormField`, `Popover`, `Grid`, `Icon`, `Dropdown`, `InlineMessage`.

### Architectural Decisions
1. **`DataTable` is data-agnostic and uncontrolled-by-default** — accepts controlled props (`sortState`, `selectedKeys`, `columnVisibility`) for container-driven state.
2. **Toolbar is a separate composition via render-prop** — kept separate so tables without toolbars stay lean; the `toolbar` render-prop receives `columnVisibility`/`setColumnVisibility` helpers so consumers compose `<DataTableToolbar>` through the same controlled/uncontrolled state as the table.
3. **All new inputs extend `BaseFieldProps`** — identical label/error/helper API to `Input`/`Select`/`Textarea` for zero-friction swapping.
4. **Popover-based pickers** — reuse the existing `Popover` primitive for trigger/outside-click/Escape handling; no new floating-layer code.
5. **No new dependencies** — calendar and time lists are hand-rolled, matching the project's zero-extra-dep stance.

### Accessibility Considerations
- `DataTable`: `aria-sort` on sortable headers, real `<th scope="col">`, checkbox header with `aria-label` + indeterminate state, keyboard-focusable sort buttons, `aria-busy` on skeleton rows.
- `ValidationSummary`: `role="alert"` via `Alert`.
- Pickers: `aria-haspopup="dialog"`, `aria-expanded`, full keyboard trigger (Enter/Space), Escape-close via `Popover`.
- `FormActions`: submit button type + `aria-busy` loading state.
- All components respect `motion-reduce` and the global `:focus-visible` ring.

### Design System Compliance
- Tailwind v4 tokens (`text-body`, `text-caption`, `text-label`, `rounded-lg`, `border-neutral-300`, `primary-*`, `danger-*`) throughout.
- All styling via theme utilities; no inline hex values, no new CSS.
- Icons always wrapped via `<Icon>` (Lucide) per project convention.
- Barrel exports + JSDoc on every component.

---

## 8. Success Criteria

| Criterion | Status |
|-----------|--------|
| Entire frontend reviewed before implementation | ✅ (§1) |
| No duplicate components introduced | ✅ (§4) |
| Existing reusable infrastructure fully leveraged | ✅ (§7) |
| Sprint 7 & 8 implemented only where genuinely missing | ✅ (§6) |
| Enterprise architecture strengthened without regressions | ✅ TypeScript strict + lint pass, zero changes to locked shell/layout |
