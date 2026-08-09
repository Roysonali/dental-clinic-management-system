# Billing — Credit Note Module Report (Sprint 14A.4)

**Date:** 2026-08-09
**Scope:** Stabilization and production-hardening of the Billing → Credit Notes frontend module.
**Status:** ✅ Complete — TypeScript, tests, lint, and production build all pass.

---

## 1. Executive verdict on the previous implementation

Kilo's implementation was **partially correct — the substance was right, the wiring was not.**

- **Correct (retained as-is):** backend endpoint/method mapping, request/response shapes, the mutation-cache strategy for the detail page (the backend exposes **no GET** endpoints), the state machine, the overall dialog/drawer UX, the shared-component choices, and the credit note type definitions.
- **Incorrect (fixed):** five files had wrong relative import paths (some resolved to non-existent `src/common/` / `src/components/billing/utils/`); the container referenced an unused type and pushed a non-existent field onto a weakly-inferred array; the create drawer never propagated the selected invoice into the form (submissions would have carried the wrong or empty `invoice_id`); `ResultState` was used with non-existent variants (`empty`, `forbidden`); the invoice detail container referenced an unimported icon; and the RBAC gating of the Void action contradicted the backend (gated to admins, while the backend allows receptionists and doctors to void).
- **Regression risk introduced by Kilo:** the duplicate "Apply credit note" button in the credit note detail header (rendered both standalone and inside the actions component) was removed.

No shared infrastructure was duplicated or replaced; every component reuses the existing DensCare design-system primitives.

---

## 2. Initial state discovered

`npx tsc -b --noEmit` reported **25 errors** across the module:

| File | Errors |
|---|---|
| `creditNotes/containers/CreditNoteDetailsContainer.tsx` | 6 (5 × cannot-find-module `../../../../common/…`, 1 × unused `CreditNoteRead`, 1 × `isNotApplicable` on weakly-typed timeline array) |
| `creditNotes/CreateCreditNoteDrawer.tsx` | 9 (5 × cannot-find-module `../../../common/…`, 1 × `PatientListItem` missing from `types/billing`, 2 × resolver/`SubmitHandler` type mismatch from `expiry_date: string` vs `string \| undefined`, 1 × implicit-any `e` — a knock-on of the unresolved `Select` import) |
| `creditNotes/CreditNoteDetailEmpty.tsx` | 3 (2 × cannot-find-module, 1 × unused `navigate`) |
| `creditNotes/CreditNoteDetailPermission.tsx` | 1 (`variant="forbidden"` not in `ResultVariant`) |
| `creditNotes/CreditNoteSummaryCard.tsx` | 2 (wrong `../../utils|types` paths) |
| `creditNotes/CreditNoteTimeline.tsx` | 1 (unused `ReactNode`) |
| `creditNotes/IssueCreditNoteDialog.tsx` | 2 (wrong `../../utils|types` paths) |
| `creditNotes/VoidCreditNoteDialog.tsx` | 2 (wrong `../../utils|types` paths) |
| `invoices/containers/InvoiceDetailsContainer.tsx` | 1 (`FileText` not imported) |

---

## 3. Import-path problems found (root cause)

Files in `creditNotes/` (depth: `src/components/billing/creditNotes/`) and `creditNotes/containers/` (one level deeper) had inconsistent `../` counts:

- **From `creditNotes/`** → `src/` is `../../../`, `components/common` is `../../common/`. Several files used `../../../common/…` (resolving to non-existent `src/common/`) for shared components while correctly using `../../../types|utils|services|constants`.
- **From `creditNotes/containers/`** → `components/common` is `../../../common/`, `src/` is `../../../../`. The container used `../../../../common/…` (→ `src/common/`) while correctly using `../../../../types|utils|hooks|services|constants`.

All occurrences were verified against the actual filesystem and corrected to the exact paths shown above. No `../../../../` blind-fixes were applied.

---

## 4. Kilo changes retained (verified correct)

- `services/billingService.ts` — credit note endpoints (`POST /billing/credit-notes`, `/{id}/issue`, `/{id}/void`, `/{id}/apply`), exact paths/methods/payload types.
- `hooks/billing/useCreditNote.ts` + `useCreditNoteMutations.ts` — disabled query reading the mutation cache + `setQueryData` on every mutation; `billingQueryKeys.all` invalidation (shared billing contract).
- `types/billing.ts` — `CreditNoteRead`/`CreditNoteCreatePayload`/`CreditNoteVoidPayload`/summaries mirror `schemas/credit_note.py` exactly.
- `routes/AppRouter.tsx`, `routes/routes.ts`, `pages/billing/CreditNoteDetailsPage.tsx` — route wiring.
- `constants/billing.ts` — `CREDIT_NOTE_STATUS_VARIANTS`, reason length constants (match backend `constants.py`).
- `ApplyCreditNoteDialog.tsx` — already had correct paths and preserved create/issue/apply/void behavior, validation, loading/error handling, and design-system usage; **not rewritten**.
- `IssueCreditNoteDialog.tsx` / `VoidCreditNoteDialog.tsx` — functionality, form behavior, and accessibility preserved; only import paths corrected.
- `CreditNoteDetailActions.tsx`, `CreditNoteSummaryCard.tsx`, `CreditNoteTimeline.tsx`, `CreditNoteDetailSkeleton.tsx`, `CreditNoteReasonCard.tsx`, `index.ts` — logic retained.

## 5. Kilo changes corrected

- **`CreateCreditNoteDrawer.tsx` (rewritten):**
  - Fixed all five `common` imports.
  - `PatientListItem` now imported from `types/patient` (it never lived in `types/billing`); invoice-summary fetches typed as `InvoiceRead` (list type requires `item_count`, detail type does not carry it).
  - **Functional bug fixed:** selecting an invoice never updated the form — `invoice_id` (and `patient_id`) are now written via `setValue` in `handleInvoiceChange`, and the patient auto-fills from the selected invoice. Dropdown data moved to TanStack Query (`enabled: open`), the established billing pattern (cf. `CreateInvoiceDrawer`), which also eliminated `react-hooks/set-state-in-effect` lint errors. The summary block is **derived** (never set in effects) and only renders when it matches the form's actual `invoice_id`.
  - Invoice fetches go through `queryClient.ensureQueryData` reusing the invoice-detail cache.
- **`CreditNoteDetailsContainer.tsx`:** fixed the five `common` paths; removed the unused `CreditNoteRead`/`Icon`/`CheckCircle2` imports; typed the timeline array as `CreditNoteTimelineItem[]` (fixes `isNotApplicable`); removed the duplicate Apply button and the redundant `isVoidable` gate.
- **`CreditNoteDetailActions.tsx`:** RBAC corrected — Issue/Apply/Void are now gated by `CREDIT_NOTE_WORKFLOW_ROLES` (see §7), not Void-by-admin-only.
- **`CreditNoteDetailEmpty.tsx`:** fixed paths, removed unused `useNavigate`, `variant="info"` + `FileQuestion` icon.
- **`CreditNoteDetailPermission.tsx`:** `variant="error"` + `ShieldAlert` icon.
- **`CreditNoteSummaryCard.tsx`, `IssueCreditNoteDialog.tsx`, `VoidCreditNoteDialog.tsx`, `CreditNoteTimeline.tsx`:** corrected paths / removed unused import.
- **`utils/creditNoteFormSchema.ts`:** `expiry_date` is now optional in `CreditNoteCreateFormValues` (matches the zod schema exactly, resolving the resolver/`SubmitHandler` mismatch).
- **`constants/roles.ts`:** added `CREDIT_NOTE_WORKFLOW_ROLES`.
- **`invoices/containers/InvoiceDetailsContainer.tsx`:** added the missing `FileText` lucide import (the only change to this file).

---

## 6. Backend endpoints verified (source of truth: `backend/app/modules/billing/`)

| Endpoint | Method | Body | Success | Notes |
|---|---|---|---|---|
| `/billing/credit-notes` | POST | `invoice_id`, `patient_id`, `amount` (>0, ≤ invoice grand total — BR-91), `reason` (1–500 runtime), `expiry_date?` | 201 `CreditNoteRead` | Roles: ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, all DOCTOR_ROLES |
| `/billing/credit-notes/{id}/issue` | POST | — | 200 `CreditNoteRead` | Draft → Issued; assigns permanent CN number |
| `/billing/credit-notes/{id}/void` | POST | `void_reason` (required) | 200 `CreditNoteRead` | Draft/Issued → Void |
| `/billing/credit-notes/{id}/apply` | POST | — | 200 `CreditNoteRead` | Issued → Applied; remaining balance → 0 |

**Not implemented by the backend (confirmed):** `GET /billing/credit-notes`, `GET /{id}`, `PATCH`, `DELETE`. The frontend detail page therefore reads the TanStack Query cache populated by mutation responses — this design is preserved.

**Validation notes:** the runtime reason cap is the service validator's `CREDIT_NOTE_REASON_MAX_LENGTH` (500) — the frontend matches it exactly. The void schema allows 1000 chars but the frontend conservatively caps at 500 (`CREDIT_NOTE_VOID_REASON_MAX_LENGTH`); the backend accepts shorter input, so the frontend is a safe subset. The backend validates `amount <= grand_total` at create time; there is no already-credited computation, so the drawer's "Already Credited / Remaining Allowed" block is informational only (documented in code).

## 7. Credit Note lifecycle verified

DRAFT → ISSUED, VOID · ISSUED → APPLIED, VOID, EXPIRED · APPLIED / VOID / EXPIRED terminal. The frontend `creditNoteStateMachine.ts` mirrors backend `CREDIT_NOTE_TRANSITIONS`; audit actions `created / issued / credit_applied / voided` match `AuditAction` and drive the timeline.

## 8. RBAC verified

Backend router (`routers/credit_note.py`):
- **Create:** ADMIN, RECEPTIONIST, DENTAL_ASSISTANT, DOCTOR_ROLES — i.e., every role; no frontend gate required.
- **Workflow (issue/apply/void):** ADMIN, RECEPTIONIST, DOCTOR_ROLES — DENTAL_ASSISTANT excluded.

Frontend now gates Issue/Apply/Void behind `PermissionGate` with the new `CREDIT_NOTE_WORKFLOW_ROLES` constant (mirrors the backend exactly, in `hide` mode so unauthorized actions are fully absent). Kilo's prior admin-only Void gate was a contradiction and was corrected. The invoice detail's "Create credit note" button is ungated because create is open to all roles.

## 9. UI/UX verification

The module uses only existing design-system primitives — `Card`, `Button`, `IconButton`, `Drawer`, `Modal`, `Alert`, `Select`/`Textarea`/`DatePicker`, `Form` + `FormActions` + `ValidationSummary`, `StatusBadge`, `ResultState`, `Skeleton`, `Toast`, `Icon`, `PermissionGate`. No duplicate components were introduced. Loading/empty/error/permission states mirror the Invoice and Payment detail pages; the removed duplicate Apply button removes a visible UX defect.

## 10. Accessibility verification

- Every form field has a visible `<label>`/`FormField` label with `htmlFor` association; required markers are rendered (`*`).
- Fields expose `aria-invalid` + `aria-describedby` pointing at per-field error text.
- `Drawer`/`Modal` receive `ariaLabel`; the drawer close `IconButton` has `aria-label="Close"`.
- Server/validation errors render in `role="alert"` regions (`ValidationSummary`, `Alert`); toasts use `role="alert"`/`aria-live`.
- Buttons carry meaningful names ("Issue credit note", "Apply credit note", "Void credit note", "Save draft").
- `ResultState` (loading skeleton) exposes `role="status"` + sr-only text; the permission/empty/error states are title+description based, not color-only.
- Focus handling: Escape closes overlays, focus traps in `Drawer`/`Modal`, focus returns to the opener.

## 11. Tests added

- `src/utils/creditNoteStateMachine.test.ts` — 6 tests (transitions, terminal/editable statuses, labels).
- `src/utils/creditNoteFormSchema.test.ts` — 13 tests (create/void bounds, money parsing).
- `src/utils/creditNoteFormatting.test.ts` — 10 tests (number/amount/date/datetime formatting).
- Total: **29 new tests**, all passing.

## 12. Final validation

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npx tsc -b --noEmit` | ✅ PASS (exit 0) |
| Tests | `npm test` | ✅ PASS — 182 files / 1400 tests |
| Lint | `npm run lint` | ✅ PASS (exit 0) |
| Build | `npm run build` | ✅ PASS (`✓ built in …`) |

## 13. Files modified

**Corrected (tracked):** `frontend/src/constants/roles.ts` (+`CREDIT_NOTE_WORKFLOW_ROLES`), `frontend/src/components/billing/invoices/containers/InvoiceDetailsContainer.tsx` (+`FileText` import).
**Corrected (new, untracked):** `frontend/src/components/billing/creditNotes/` (12 files + `containers/CreditNoteDetailsContainer.tsx`), `frontend/src/utils/creditNoteFormSchema.ts`, `creditNoteFormatting.ts`, `creditNoteStateMachine.ts`, the 3 new test files, plus the pre-existing Kilo additions retained (`useCreditNote*.ts`, `CreditNoteDetailsPage.tsx`, `billingService.ts`, `types/billing.ts`, `billingQueryKeys.ts`, `constants/billing.ts`, routes).
**Report:** this file.

## 14. Remaining limitations

1. **No backend GET endpoints** for credit notes — the detail page cannot deep-link to a credit note that was not created in the current session (empty state with "Create Credit Note" instead). This is a backend limitation, not a frontend defect; the cache-based design is documented in code and hooks.
2. **"Already Credited" is not tracked** — the backend validates `amount <= grand_total` but does not expose or enforce cumulative credit against an invoice, so the drawer's credit summary is informational.
3. **Patient select is freely editable** to a patient that differs from the invoice's patient; the backend accepts it (it validates patient existence only). Auto-fill mitigates accidental mismatches.
4. **`CREDIT_NOTE_VOID_REASON_MAX_LENGTH` (500) is stricter than the backend schema (1000)** — safe (never sends what the backend rejects), but intentionally conservative.
5. **No credit note list page** — the backend exposes no list endpoint; the module currently surfaces through Invoice detail (create) and the detail route.
