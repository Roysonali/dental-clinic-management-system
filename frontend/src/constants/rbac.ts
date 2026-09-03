/**
 * RBAC policy constants and pure predicates (Sprint 11C).
 *
 * This module centralises the *policy* layer of client-side authorization:
 * role-group helpers and predicates that the authorization hooks
 * (`hooks/rbac/useCurrentUserRole`, `hooks/rbac/usePermission`), route
 * guards (`components/rbac/RequireRole`), action gates
 * (`components/rbac/PermissionGate`) and the navigation config all build on.
 *
 * Backend contract notes (verified against `backend/app/`):
 * - The canonical role names live in `constants/roles.ts` and mirror
 *   `backend/app/core/constants.py` exactly — nothing is invented here.
 * - The admin role group (`ADMIN_ROLES` = ADMIN + CHIEF_DOCTOR) mirrors
 *   `_ADMIN_ROLES` in `backend/app/modules/rbac/permissions.py`.
 * - The backend exposes NO role/permission management endpoints, NO
 *   `GET /roles`, and `GET /auth/me` returns no role — see
 *   `hooks/rbac/useCurrentUserRole.ts` for how the current user's role is
 *   resolved within those constraints.
 */
import { ROLES, REVENUE_READ_ROLES, type RoleName } from './roles';

/** Every known role name value, used to validate backend-provided strings. */
const ROLE_NAME_VALUES: readonly string[] = Object.values(ROLES);

/** Type guard — is the (backend-provided) string a known role name? */
export function isRoleName(
  value: string | null | undefined,
): value is RoleName {
  return typeof value === 'string' && ROLE_NAME_VALUES.includes(value);
}

/**
 * Pure membership check: does a concrete role satisfy an exact-role
 * requirement? Used for navigation filtering where the role is known.
 *
 * NOTE: this is NOT what gates access. Gates go through
 * `usePermission().can()`, which accounts for the probe-based uncertainty
 * of the current user's role (see hooks/rbac/usePermission.ts).
 */
export function roleMeetsRequirement(
  role: RoleName | null | undefined,
  required: readonly RoleName[],
): boolean {
  return role != null && required.includes(role);
}

/**
 * Can the given role view aggregate revenue / financial analytics?
 *
 * Centralised predicate consumed by the dashboard revenue widget, the
 * billing-dashboard route guard and the sidebar navigation filter.
 * The backend is the authoritative enforcement layer; this helper
 * keeps the *client-side* rendering consistent with the backend's
 * `_REVENUE_READ_ROLES` policy.
 */
export function canViewRevenue(role: RoleName | null | undefined): boolean {
  return role != null && REVENUE_READ_ROLES.includes(role);
}

/**
 * React Query stale time for the current-role self-probe. Role changes are
 * rare (and self-role-change is rejected by the backend), so a long stale
 * time keeps the probe cached across navigations.
 */
export const RBAC_CURRENT_ROLE_STALE_TIME_MS = 5 * 60_000;
