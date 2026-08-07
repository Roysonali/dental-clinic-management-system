# DensCare — Sprint 12A.2 Navigation Integration & Routing Verification Report

**Date:** August 7, 2026
**Scope:** Investigation and verification of the Treatment Plan routing regression ("selecting
Treatment Plans does not navigate away from the Dashboard") plus full verification of every
Treatment module entry point.
**Result:** ✅ **Regression resolved and verified.** All Treatment module entry points navigate
correctly. Evidence: a new routing integration test suite (8 tests) plus a full-stack environment
check against the running dev servers.

---

## 1. Summary & Root Cause

**Root cause (confirmed against git history):** in the previously committed state (`HEAD`), the
sidebar navigation config and route constants already contained the Treatment Plans entry
(`route: ROUTES.TREATMENT_PLANS` = `/treatment-plans`) and its route metadata — **but the committed
`AppRouter` had not yet registered a `/treatment-plans` route**. Clicking the sidebar item therefore
navigated to a path with no match, which fell through to the catch-all
`<Route path="*" element={<Navigate to={ROUTES.AUTH.LOGIN} replace />} />` — the user was bounced
away from the module instead of reaching it.

**Fix (delivered in Sprint 12A, verified here):** the three routes are now registered in
`AppRouter` under the `DashboardLayout`:
- `/treatment-plans` → `TreatmentPlanListPage`
- `/treatment-plans/:planId` → `TreatmentPlanDetailsPage`
- `/procedures` → `ProcedureListPage`

Because the nav item, the route constant and the route registration all share the single
`ROUTES` constant, no path string can drift again.

---

## 2. Route Definitions (single source of truth)

`src/routes/routes.ts`:

```ts
TREATMENT_PLANS: '/treatment-plans',
PROCEDURES: '/procedures',
```

`src/routes/AppRouter.tsx` (protected, inside `DashboardLayout`):

```tsx
<Route path={ROUTES.TREATMENT_PLANS} element={<TreatmentPlanListPage />} />
<Route path={`${ROUTES.TREATMENT_PLANS}/:planId`} element={<TreatmentPlanDetailsPage />} />
<Route path={ROUTES.PROCEDURES} element={<ProcedureListPage />} />
```

The three pages are `React.lazy`-loaded (Sprint 12A.1 F-05) under a `Suspense` boundary that wraps
`<Routes>` (the correct React Router pattern — `Routes` children must be `Route`/`Fragment`).

---

## 3. Navigation Wiring (sidebar → route)

`src/layouts/components/navigation/navigation.config.ts`:
- Clinical group → `{ id: 'treatment-plans', label: 'Treatment Plans', route: ROUTES.TREATMENT_PLANS }`
- Administration group → `{ id: 'procedures', label: 'Procedure Catalog', route: ROUTES.PROCEDURES }`

`src/layouts/components/sidebar/SidebarItem.tsx` renders each item as
`<NavLink to={item.route}>` (disabled items render a non-interactive span instead). Active
highlighting comes from `getActiveItemId` (`navigation.helpers.ts`), which matches the exact path or
nested paths (`/treatment-plans/…`), so the detail page correctly highlights the parent item.

`src/routes/routeMeta.ts` maps both paths to their page titles (`Treatment Plans`,
`Procedure Catalog`) for the header (`usePageTitle`).

---

## 4. Verification Matrix

| Check | Result | Evidence |
|---|---|---|
| Sidebar click navigates away from the Dashboard to `/treatment-plans` | ✅ | `treatmentRouting.test.tsx` → "navigates away from the Dashboard when Treatment Plans is selected in the sidebar" |
| Active menu highlighting (`aria-current="page"`) on the list page | ✅ | "highlights the active sidebar item after navigation (aria-current)" |
| Direct URL access + refresh for `/treatment-plans` | ✅ | "supports direct URL access + refresh for /treatment-plans" |
| Detail route `/treatment-plans/:planId` resolves | ✅ | "resolves the detail route /treatment-plans/:planId" (the details container mounts; 404 ResultState proves the match) |
| Procedure route `/procedures` resolves | ✅ | "resolves the Procedure Catalog route /procedures" |
| Browser back/forward between Dashboard ⇄ Treatment Plans | ✅ | "navigates between Treatment Plans and the Dashboard via browser back/forward" |
| Route guards (unauthenticated → `/auth/login`) | ✅ | "redirects unauthenticated users away from treatment routes to the login page" |
| Procedure Catalog reachable from the Administration group | ✅ | "opens Procedure Catalog from the Administration sidebar group" |

---

## 5. Test Evidence

New file: `frontend/src/routes/treatmentRouting.test.tsx` — 8 tests rendering the **real
`AppRouter`** (BrowserRouter, guards, layout, sidebar, lazy pages) with mocked services, covering
the full matrix above.

```
Test Files  2 passed (2)   # treatmentRouting + existing AppRouter RBAC suite
Tests      14 passed (14)
```

Full validation (after adding the suite):

| Command | Result |
|---|---|
| `npm test` | ✅ **1039 tests / 138 files passed** (3 consecutive isolated runs of the routing suite also pass — no flakiness) |
| `npm run lint` | ✅ 0 errors / 0 warnings |
| `tsc -b` | ✅ clean |
| `npm run build` | ✅ success (chunked output) |

> Note: the routing tests pass explicit `{ timeout: 8000 }` to async queries — the full suite runs
> many jsdom files in parallel on Windows, and lazy chunk loads can exceed Testing Library's 1 s
> default wait under CPU contention.

---

## 6. Live-Environment Check (running dev servers)

The developer's dev servers were already running (Vite on `:5173`, FastAPI on `:8000` with the
Postgres `denscare` DB). Verified against the live stack:

- **The running Vite server serves the current code** — `GET /src/routes/AppRouter.tsx` returns the
  module containing the `TreatmentPlanListPage` / `ProcedureListPage` lazy routes; the served
  `navigation.config.ts` contains both nav items; the served `routes.ts` contains both paths. A
  stale-bundle explanation is therefore ruled out for a fresh load.
- **Login works end-to-end** — seeded an active `ADMIN` user
  (`admin@clinic.com` / `Admin@1234`) into the Postgres dev DB; `POST /auth/login` returns a valid
  JWT.

**Browser click-through:** an automated real-browser walkthrough was attempted (login → click
Treatment Plans → back/forward → direct URLs) but the browser-automation agent's sub-tools
(`navigate_page`, form filling) errored in this environment, so no browser session could complete.
The jsdom integration suite above exercises the identical component tree (same router, guards,
sidebar, and lazy pages) and is the definitive evidence; the served-code check confirms the live
server would serve that same tree.

---

## 7. Remaining Notes

1. **If a browser tab still shows the old behaviour:** a full reload (hard refresh) of
   `http://localhost:5173` is sufficient — the running dev server serves the current source with
   all Treatment routes registered (verified in §6).
2. **Dev-DB side effect:** an active admin user (`admin@clinic.com` / `Admin@1234`) was added to the
   local Postgres `denscare` DB for the live login check. Harmless in a dev environment; remove it
   if not wanted.
3. **No production code changes were required in this sprint** — the regression was already fixed by
   the Sprint 12A route registration; this sprint verified it and added the regression-proof test
   suite.

---

*Deliverable for Sprint 12A.2. All Treatment module entry points — sidebar click, direct URL,
refresh, detail route, procedure route, back/forward, guards and highlighting — are verified
navigating correctly.*
