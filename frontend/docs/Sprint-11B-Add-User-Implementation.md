# Sprint 11B — Phase 1D: Add User (Implementation Notes)

> Companion to the authoritative `User-Module-Backend-Contract-Review.md` (2026-08-06).
> This document records the implementation decisions made when building the
> re-scoped **Add User** workflow against the **verified backend contract**.

## 1. What was built

An admin **Add User** drawer on the Users list page that orchestrates the only
backend-supported account-creation path:

```
Admin clicks "Add User" (toolbar)
        ↓
UserCreateDrawer (right drawer)
        ↓
UserCreateForm — exactly four fields:
        full_name, email, password, role_id
        ↓
1. POST /auth/register            {full_name, email, password}   → 201
2. GET  /auth/users/pending       → locate created account by email
3. PATCH /auth/users/{id}/approve {role_id}                       → 200
        ↓
Success toast → user list + pending queue refresh → drawer closes
```

## 2. Architecture (unchanged layering)

```
Pages (UserListPage)
  └─ Containers (UserListContainer → UserCreateContainer)
       ├─ UserCreateDrawer (shell: shared Drawer primitive)
       │    └─ UserCreateForm (stateless, react-hook-form + zod)
       ├─ Hooks (useRegisterUser, useApproveUser)
       └─ Services (authService.register / fetchPendingUsers / approveUser)
```

- **No new service endpoints.** `authService` already exposes `register`,
  `fetchPendingUsers` and `approveUser` — no `createUser()`/`updateUser()`
  wrappers were added (they would imply nonexistent APIs).
- **No new service files.** Only one new hook (`useRegisterUser`); the
  existing `useApproveUser` was enhanced to also invalidate the user
  directory on success.
- **No new types beyond the UI form model** (`UserCreateFormValues`);
  payloads reuse `RegisterRequest` / `UserApprovalRequest`.

## 3. Known backend limitation (verified) and how it is handled

> `POST /auth/register` returns `{message}` only — **it does not return the
> created user's id**, and `PATCH /auth/users/{id}/approve` requires the id.

The container therefore resolves the id by querying
`GET /auth/users/pending` immediately after registration and matching the
account by its normalized email. Because registration commits asynchronously
relative to the queue read, the lookup retries up to **3 total attempts** with
a ~275 ms pause between attempts (stopping the moment the account is found),
per the post-review reliability improvement. Honest fallbacks (no fabricated
APIs):

| Situation | Outcome reported |
|---|---|
| Account found in pending queue (any attempt) → approved with selected role | `approved` (success toast) |
| Account never found after all lookup attempts (race/lookup miss) | `pending` — toast: account awaits approval in the queue |
| Pending-queue lookup itself fails (network) | `pending` — toast: account awaits approval in the queue |
| Registration OK, approval rejected (e.g. concurrently approved) | `approval_failed` — warning toast: account is in the queue |
| Registration rejected (409 duplicate email / 422 validation) | Drawer stays open with the backend message + field errors |

## 4. Validation (mirrors the backend exactly)

| Field | Rule (backend `UserRegister` + `UserApprovalRequest`) | Frontend source |
|---|---|---|
| `full_name` | required, 2–100 chars, whitespace-normalized | `utils/userCreateSchema.ts` |
| `email` | required, valid email, lowercased | same |
| `password` | required, 8–128 chars, upper + lower + digit + special | `utils/passwordSchema.ts` (shared with `RegisterForm`) |
| `role_id` | required, positive integer (`gt=0`) | reuses `roleAssignmentSchema` |

No unsupported fields (username, phone, address, avatar, dob, status) were
introduced — the backend `extra="forbid"` would reject them anyway.

## 5. Files

**New**

- `src/utils/passwordSchema.ts` (+ test) — shared backend-exact password rules
- `src/utils/userCreateSchema.ts` (+ test)
- `src/utils/userCreateFormUtils.ts` (+ test)
- `src/hooks/users/useRegisterUser.ts` (+ test)
- `src/components/users/UserCreateForm.tsx` (+ test)
- `src/components/users/UserCreateDrawer.tsx` (+ test)
- `src/components/users/containers/UserCreateContainer.tsx` (+ test)

**Modified**

- `src/types/user.ts` — added `UserCreateFormValues`
- `src/hooks/auth/usePendingUsers.ts` — `useApproveUser` now also invalidates `['users']`
- `src/components/users/UserToolbar.tsx` — `onAddUser` action (Add User button)
- `src/components/users/UserTable.tsx` — forwards `onAddUser` to the toolbar
- `src/components/users/containers/UserListContainer.tsx` — drawer + success toast wiring
- `src/components/auth/forms/RegisterForm.tsx` — reuses `passwordSchema`
- `src/components/common/Drawer/Drawer.tsx` — optional `initialFocusRef` (backward compatible)
- `src/components/users/UserToolbar.test.tsx`, `src/components/users/containers/UserListContainer.test.tsx`

## 6. Post-review improvements (2026-08-06, Option B)

- **Lookup reliability** — the pending-queue lookup now retries up to 3 total
  attempts (~275 ms apart) when the freshly registered email is not returned,
  stopping immediately when found. Exhaustion preserves the documented
  `pending` fallback.
- **Focus management** — the Full Name input is focused automatically when
  the drawer opens (shared `Drawer` gains an optional `initialFocusRef`;
  default behaviour unchanged).
- **Submitting guard** — while the workflow is in flight the submit, Cancel
  and header-close buttons are disabled (`aria-disabled` on close), and
  Escape / backdrop dismissal is ignored until the workflow settles.
- **Shared validation** — the backend password rules were extracted to
  `utils/passwordSchema.ts`, reused by `RegisterForm` and the Add-User form.

## 7. Not implemented (per the contract review)

- Admin "Create User" endpoint call — does not exist; the drawer uses register + approve.
- Edit User (Phase 1E) — no backend endpoint; only role change exists (already shipped).
- Reset / Change Password — no backend endpoint; `ForgotPasswordPage` remains informational.
