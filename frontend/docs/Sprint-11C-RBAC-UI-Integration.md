# Sprint 11C — RBAC UI Integration (Frontend)

## Objective

Build a production-grade client-side Role-Based Access Control (RBAC) layer
that makes the existing UI **permission-aware** against the **verified backend
authorization contract**. This sprint is UI integration only: no new API
endpoints, no invented permissions, no mocking of unsupported backend
functionality.

The backend remains the sole security authority. Every client-side gate is a
UX layer that mirrors what the backend already enforces (403 Forbidden); it
never widens or narrows the backend's access decisions beyond what the
contract proves.

---

## Backend contract (verified source of truth)

Verified against `backend/app/` on the `feature/doctor-management-v3` branch:

| Fact | Evidence |
| --- | --- |
| `GET /auth/me` returns `{id, full_name, email, status}` — **no role** | `backend/app/modules/auth/schemas.py` (`CurrentUserResponse`), `routes.py` |
| JWT contains `sub` (email), `exp`, `iat`, `jti`, `token_type` — **no role claim** | `backend/app/core/security.py` |
| User records include `role_id` and `role_name` | `backend/app/modules/users/schemas.py` (`UserDetailResponse`) |
| `GET /users`, `GET /users/{id}`, role/activate/deactivate patches → **ADMIN only** (`require_admin` = ADMIN + CHIEF_DOCTOR) | `backend/app/modules/users/routes.py`, `rbac/permissions.py` |
| `GET /auth/users/pending`, approve, deactivate → **ADMIN only** | `backend/app/modules/auth/routes.py` |
| Patients list/detail/profile → ADMIN + RECEPTIONIST + `*DOCTOR_ROLES`; activate/deactivate → **ADMIN only** | `backend/app/modules/patients/routes.py` |
| Doctors list → ADMIN + RECEPTIONIST; detail/specializations → + `*DOCTOR_ROLES`; activate/deactivate → **ADMIN only** | `backend/app/modules/doctors/routes.py` |
| Appointments → ADMIN + RECEPTIONIST + `*DOCTOR_ROLES` | `backend/app/modules/appointments/router.py` |
| No Role Management APIs, no Permission APIs, no `GET /roles`, no permission-matrix endpoint | full API surface review |

---

## Role resolution strategy (the hard constraint)

`GET /auth/me` returns no role and the JWT carries no role claim, so the
frontend cannot know the current user's role from the session. The only
backend-sanctioned source of `role_id`/`role_name` for the current user is
`GET /users/{id}` — which is `require_admin`.

**Design: the self-probe.** `useCurrentUserRole` fires `GET /users/{id}` with
the id from `GET /auth/me`:

| Probe outcome | Meaning | Authorization result |
| --- | --- | --- |
| 200 | The caller IS an admin (only admins pass `require_admin`) | `status: 'admin'` — exact role (ADMIN or CHIEF_DOCTOR) resolved from `role_name` |
| 403 | The caller is definitively NOT an admin | `status: 'non-admin'` — denied admin surfaces |
| Other (5xx, network, …) | Indeterminate | `status: 'unknown'` — **fail open** (see below) |

The probe uses `retry: shouldRetryQuery` (403 is never retried — a non-admin
must not hammer the endpoint) and a 5-minute stale time (role changes are
rare, and self-role-change is rejected by the backend). The probe result is
cached under `['rbac','current-role',userId]` and shared by every gate.

**Consequence:** the client can distinguish exactly two access levels —
**admin** and **non-admin**. The five non-admin roles are mutually
indistinguishable. All gating below is built on that binary.

---

## Architecture

```
src/
├── constants/
│   ├── roles.ts                    (existing) canonical role names, ADMIN_ROLES
│   └── rbac.ts                     (new) predicates: isRoleName, roleMeetsRequirement, stale time
├── routes/
│   ├── routeRequirements.ts        (new) ROUTE_ROLE_REQUIREMENTS map + routeRequiresRole()
│   ├── AppRouter.tsx               (wired) admin routes wrapped in <RequireRole/>
│   └── ProtectedRoute.tsx          (existing, unchanged) auth guard
├── hooks/rbac/
│   ├── useCurrentUserRole.ts       (new) the self-probe → admin/non-admin/unknown state
│   └── usePermission.ts            (new) usePermission() + pure buildPermission()
├── components/rbac/
│   ├── RequireRole.tsx             (new) route-level guard (layout-route usage)
│   └── PermissionGate.tsx          (new) action-level gate (hide / disable modes)
├── layouts/components/
│   ├── navigation/navigation.config.ts   (wired) role-filtered getNavGroups(role); Users + Pending Approvals admin items
│   ├── navigation/navigation.types.ts    (updated) roles?: readonly RoleName[]
│   └── sidebar/SidebarContent.tsx        (wired) passes usePermission().role into getNavGroups
└── components/{patients,doctors}/containers + tables
                                       (wired) admin-only status actions gated
```

**Data flow**

```
AuthProvider (GET /auth/me → {id,…})
      │  user.id
      ▼
useCurrentUserRole ──GET /users/{id}──▶ admin | non-admin | unknown
      │
      ▼
usePermission()  { isAdmin, role, can(requiredRoles), state }
      │                      │                    │
      ▼                      ▼                    ▼
SidebarContent        RequireRole           PermissionGate
(getNavGroups(role))  (route guard)         (action gate)
```

---

## Policy map

### Route level (`routes/routeRequirements.ts` → `AppRouter.tsx`)

| Route | Requirement | Enforcement |
| --- | --- | --- |
| `/users`, `/users/:userId` | ADMIN + CHIEF_DOCTOR | `RequireRole requiredRoles={ADMIN_ROLES}` |
| `/admin/users/pending` | ADMIN + CHIEF_DOCTOR | `RequireRole requiredRoles={ADMIN_ROLES}` |
| Dashboard, Patients, Doctors, Appointments | none (any authenticated user) | deliberately **not** gated — these modules admit non-admin roles the client cannot distinguish |

`RequireRole` behaviour: probe loading → full-screen loader; known admin with
the role → render; known non-admin → `Navigate` to dashboard (or
`deniedFallback`); **unknown → render (fail open)**.

### Navigation (`navigation.config.ts`)

- **Users** and **Pending Approvals** items carry `roles: ADMIN_ROLES` — shown
  (and enabled) for admins only. The previously `disabled: true` Users item is
  now a live admin link.
- Non-admin items cannot be modelled (limitation below) — the remaining items
  stay visible to all authenticated users.
- `getNavGroups(role)` drops role-restricted items the role cannot access and
  drops groups left empty.

### Action level (`PermissionGate` / container gating)

| Action | Backend requirement | UI treatment |
| --- | --- | --- |
| Patient activate/deactivate (list rows, details header, quick actions) | ADMIN only | hidden for non-admins |
| Doctor activate/deactivate (list rows, details header) | ADMIN only | hidden for non-admins |
| Patient/Doctor create + edit | ADMIN + RECEPTIONIST | **not** gated (cannot distinguish RECEPTIONIST client-side; backend 403s others) |
| Appointment actions, doctor availability/leave toggles | ADMIN + RECEPTIONIST + doctor roles | **not** gated (same limitation) |
| Users module actions (Add User, role/status changes) | ADMIN only | covered by the route guard on the whole `/users` page |

---

## Hidden vs. disabled — intentional and documented

- **`hide` (default)** — denied → the control is rendered as nothing (or the
  provided `fallback`). Used for destructive row actions (deactivate/
  reactivate) so screen readers and keyboard users never encounter them.
- **`disable`** — denied → the control is rendered with `disabled` +
  `aria-disabled` injected, preserving layout while staying inert. Available
  for toolbar CTAs where a disappearing button would cause layout shift.
- Both modes are **conservative while the probe is in flight**: nothing is
  shown/active until access is proven — no flash of admin actions for
  non-admins, no leaked destructive buttons.

---

## Fail-open vs. fail-closed policy

| Resolution state | Route guard | Action gate |
| --- | --- | --- |
| `loading` | loader | denied (hidden/disabled) |
| `admin` | allow if role requirement met | allow if role requirement met |
| `non-admin` | **deny** (redirect) | denied |
| `unknown` (transient probe failure) | **allow** (backend 403s if truly forbidden) | denied (hiding a button on a network blip is harmless; leaking it is not) |

Rationale: blocking an admin's whole screen on a transient error strands real
users, while hiding an action button temporarily costs nothing. The backend is
the authority in both cases.

---

## Known backend limitations (explicitly NOT worked around)

1. **`GET /auth/me` has no role** — resolved via the `GET /users/{id}`
   self-probe; costs one extra request per session (cached, never retried on
   403).
2. **Non-admin roles are indistinguishable client-side** — a GENERAL_DOCTOR
   and a DENTAL_ASSISTANT look identical to the frontend. Any surface that
   mixes non-admin roles (patients create/edit, appointments, doctor
   availability) cannot be gated precisely and remains backend-enforced.
3. **No roles/permissions endpoints** — `ROUTE_ROLE_REQUIREMENTS` and nav
   `roles` derive from `constants/roles.ts`, which mirrors the backend seed
   (`backend/app/database/seed_roles.py`). A future `GET /roles` endpoint
   would let the client resolve all roles and lift limitation 2.
4. **A non-admin visiting a restricted route fires one 403** (the probe) —
   expected, non-retried, and surfaced nowhere (it is the authorization
   signal itself).

**If role/permission management APIs are ever added to the backend, that work
is a separate sprint** (role CRUD, permission matrix UI, dynamic nav) — it
must not be bolted onto this UI-integration layer.

---

## Production readiness report

### Security posture

- **Defense in depth, backend-first.** Every gate mirrors a verified backend
  `require_roles`/`require_admin` rule. Client-side gates can be bypassed by a
  crafted client — the backend still 403s. No gate grants anything the backend
  would reject.
- **Deny by default at the action level** while resolution is pending; deny
  definitively for known non-admins; fail open only at the route level on
  indeterminate errors (documented above).
- **No secrets, no fabricated permissions.** The only role data used is
  `constants/roles.ts` (mirrors `backend/app/core/constants.py`).

### Accessibility

- Hidden controls are removed from the DOM (never tab-focusable, never read by
  assistive tech) — the deliberate choice for destructive row actions.
- Disabled controls carry both `disabled` and `aria-disabled` for screen
  readers.
- Guards render a labelled full-screen loader (`RouteLoader`) during
  resolution, never a blank flash.

### Performance

- One extra request per session (`GET /users/{id}` self-probe), cached with a
  5-minute stale time, deduped across all gates, and never retried on 403.
- Navigation recomputes from the same cached probe — no additional calls.

### Test coverage

| Area | Coverage |
| --- | --- |
| Policy constants | `constants/rbac.test.ts`, `routes/routeRequirements.test.ts` |
| Role probe | `hooks/rbac/useCurrentUserRole.test.tsx` (200/403/5xx/loading/no-provider) |
| Authorization surface | `hooks/rbac/usePermission.test.tsx` (buildPermission semantics) |
| Route guard | `components/rbac/RequireRole.test.tsx` (allow/deny/loader/fail-open/fallback) |
| Action gate | `components/rbac/PermissionGate.test.tsx` (hide/disable/fallback/conservative) |
| Route integration | `routes/AppRouter.test.tsx` (admin enters, non-admin redirected, shared routes open) |
| Navigation | `layouts/.../navigation.config.test.ts` (role filtering) |
| Action gating in context | Patient/Doctor list + details container tests (admin renders, non-admin hides) |

### Acceptance criteria checklist

- [x] All protected routes enforce role requirements (`RequireRole` in AppRouter + integration tests).
- [x] Navigation reflects the current user's permissions (role-filtered `getNavGroups`).
- [x] Unauthorized actions are inaccessible in the UI (admin-only status actions gated).
- [x] No backend contract violations (verified endpoints only; no invented permissions; no new APIs).
- [x] Existing functionality remains unchanged (shared routes/actions untouched; only verified admin-only surfaces gated).
- [x] TypeScript, ESLint, tests, and production build all pass.
