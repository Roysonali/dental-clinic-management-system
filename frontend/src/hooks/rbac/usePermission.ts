import { ROLES, ADMIN_ROLES, type RoleName } from '../../constants/roles';
import { isRoleName } from '../../constants/rbac';
import {
  useCurrentUserRole,
  type CurrentUserRoleState,
} from './useCurrentUserRole';

/** The authorization surface consumed by guards, gates and navigation. */
export interface Permission {
  /** Raw role-resolution state (drives loading vs resolved UI). */
  state: CurrentUserRoleState;
  /** True when the probe proved the current user is an admin. */
  isAdmin: boolean;
  /** False only while the probe is still in flight. */
  isResolved: boolean;
  /**
   * The current user's role when known. Only ever an admin role (ADMIN or
   * CHIEF_DOCTOR): the five non-admin roles cannot be resolved client-side
   * (backend limitation — see useCurrentUserRole).
   */
  role: RoleName | null;
  /**
   * Backend-equivalent access check. Mirrors `require_roles` semantics for
   * what the client can prove:
   * - Known admin → true iff `required` includes an admin role (an admin
   *   passes ADMIN-only and ADMIN+RECEPTIONIST-style requirements, exactly
   *   as the backend would allow).
   * - Anyone else (non-admin / unknown / loading) → false.
   *
   * Requirements that are satisfied ONLY by non-admin roles can never be
   * verified client-side and therefore always return false — the backend
   * remains their authority.
   */
  can: (required: readonly RoleName[]) => boolean;
}

/**
 * Derive the authorization surface from raw probe state. Exported as a pure
 * function so it is unit-testable without React.
 */
export function buildPermission(state: CurrentUserRoleState): Permission {
  const isAdmin = state.status === 'admin';

  // The probe's 200 outcome itself proves admin membership. If the returned
  // role_name is ever an unrecognised string, fall back to ADMIN so gating
  // and navigation stay correct for a proven admin (both admin roles carry
  // identical access; the label is display-only).
  const role: RoleName | null =
    state.status === 'admin' &&
    state.role &&
    isRoleName(state.role.role_name)
      ? state.role.role_name
      : state.status === 'admin'
        ? ROLES.ADMIN
        : null;

  const can = (required: readonly RoleName[]): boolean => {
    if (!isAdmin) return false;
    return required.some((r) => ADMIN_ROLES.includes(r));
  };

  return {
    state,
    isAdmin,
    isResolved: state.status !== 'loading',
    role,
    can,
  };
}

/**
 * Central authorization hook (Sprint 11C).
 *
 * Single entry point for permission-aware UI: route guards
 * (`components/rbac/RequireRole`), action gates
 * (`components/rbac/PermissionGate`), the sidebar and page actions all read
 * from here — no component reaches into the role probe directly.
 *
 * Safe outside an AuthProvider: degrades to a conservative unknown state
 * (deny) instead of throwing, so isolated renders and tests never crash.
 */
export function usePermission(): Permission {
  // No useMemo: `buildPermission` is a trivial pure derivation and the raw
  // state object is recreated on every render anyway, so memoization would
  // be illusory (the reference would never be stable).
  return buildPermission(useCurrentUserRole());
}
