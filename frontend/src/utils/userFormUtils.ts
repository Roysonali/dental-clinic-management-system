import type { ChangeRoleRequest, RoleFormValues } from '../types/user';

/**
 * User form utilities.
 *
 * The only backend-supported user mutation form is role assignment, so
 * this module maps between the user record, the role form and the
 * `ChangeRoleRequest` payload. Create/update payload mappers are
 * intentionally absent — the backend exposes no create/update endpoints
 * (accounts are registered via the auth module and approved there).
 */

/**
 * Map a user record (list row or detail) into role form values.
 *
 * `role_id: null` (user without a role) → `''` (nothing selected).
 */
export function responseToRoleForm(user: { role_id: number | null }): RoleFormValues {
  return {
    role_id: user.role_id == null ? '' : String(user.role_id),
  };
}

/**
 * Transform role form values into the PATCH /users/{id}/role payload.
 *
 * The form always holds a validated positive-integer string, so this is
 * a direct parse — mirroring the backend `ChangeRoleRequest.role_id`.
 */
export function roleFormToPayload(values: RoleFormValues): ChangeRoleRequest {
  return {
    role_id: Number(values.role_id),
  };
}

/**
 * True when the selected role equals the user's current role.
 *
 * UI convenience for the Phase 1C role-change flow: when unchanged, the
 * request can be skipped entirely (the backend would otherwise apply a
 * redundant write).
 */
export function isRoleUnchanged(values: RoleFormValues, currentRoleId: number | null): boolean {
  if (values.role_id === '' || currentRoleId == null) return false;
  const next = Number(values.role_id);
  return Number.isFinite(next) && next > 0 && next === currentRoleId;
}
