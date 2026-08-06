import { ROUTES } from './routes';
import { ADMIN_ROLES } from '../constants/roles';
import type { RoleName } from '../constants/roles';

/**
 * Route → required-roles policy (Sprint 11C).
 *
 * Single source of truth for which routes are role-restricted and which
 * roles may access them. Consumed by the route guards in `AppRouter.tsx`
 * (via `RequireRole`) and documented in `docs/Sprint-11C-...`.
 *
 * Only routes the BACKEND actually restricts are listed — the frontend
 * must not lock users out of anything the backend allows. Today only the
 * admin-only user-management surfaces are listed (every `/users` and
 * `/auth/users/pending` endpoint is `require_admin` → ADMIN + CHIEF_DOCTOR).
 *
 * The other modules (patients, doctors, appointments, dashboard) are
 * intentionally ABSENT: they allow a mix of non-admin roles that the
 * frontend cannot distinguish client-side (see the known-limitations
 * section of the sprint doc), so the backend remains their authority.
 */
export const ROUTE_ROLE_REQUIREMENTS: Readonly<Record<string, readonly RoleName[]>> = {
  [ROUTES.USERS]: ADMIN_ROLES,
  [`${ROUTES.USERS}/:userId`]: ADMIN_ROLES,
  [ROUTES.ADMIN.PENDING_USERS]: ADMIN_ROLES,
};

/** Look up the roles required to view a route path, if any. */
export function routeRequiresRole(
  pathname: string,
): readonly RoleName[] | undefined {
  return ROUTE_ROLE_REQUIREMENTS[pathname];
}
