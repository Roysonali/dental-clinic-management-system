import type { RegisterRequest } from '../types/auth';
import type { UserCreateFormValues } from '../types/user';
import { ROLE_IDS, ROLE_LABELS, type RoleName } from '../constants/roles';

/**
 * Add-User form utilities (Sprint 11B Phase 1D).
 *
 * Maps the Add-User form onto the two verified backend contracts:
 * - `RegisterRequest`   → POST /auth/register   `{full_name, email, password}`
 * - `{role_id}`         → PATCH /auth/users/{id}/approve
 *
 * The register payload deliberately EXCLUDES `role_id`: the backend
 * `UserRegister` schema is `extra="forbid"` and has no role field — roles
 * are only assigned by the separate approve endpoint. `role_id` is passed
 * through the approve payload instead.
 */

/**
 * Transform Add-User form values into the POST /auth/register payload.
 *
 * Field values are already normalized by `userCreateSchema` (name
 * whitespace-collapsed, email lowercased).
 */
export function userCreateFormToRegisterPayload(
  values: UserCreateFormValues,
): RegisterRequest {
  return {
    full_name: values.full_name,
    email: values.email,
    password: values.password,
  };
}

/**
 * Extract the numeric `role_id` from the form's numeric-string select
 * value. The form schema guarantees a valid positive integer string.
 */
export function roleIdFromUserCreateForm(values: UserCreateFormValues): number {
  return Number(values.role_id);
}

/**
 * Human-readable role label for a numeric `role_id` (for success toasts).
 *
 * The backend exposes no `GET /roles`, so the label is resolved from the
 * seeded `ROLE_IDS` mapping (see `constants/roles.ts` for the seed-order
 * caveat). Falls back to a neutral string for unknown ids.
 */
export function userRoleLabelFromId(roleId: number): string {
  const entries = Object.entries(ROLE_IDS) as [RoleName, number][];
  const entry = entries.find(([, id]) => id === roleId);
  return entry ? ROLE_LABELS[entry[0]] : `Role #${roleId}`;
}
