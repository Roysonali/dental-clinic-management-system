import { z } from 'zod';
import { ROLE_ID_MIN } from '../constants/user';

/**
 * User form schemas.
 *
 * The User Management backend exposes exactly ONE user mutation form:
 * role assignment (`PATCH /users/{user_id}/role`, payload
 * `ChangeRoleRequest { role_id: int = Field(gt=0) }`). There are no
 * create/update/profile forms — those endpoints do not exist, so no
 * schemas are invented here.
 *
 * The form holds `role_id` as a string (select value, matching the
 * doctor module convention of numeric inputs as strings); validation
 * mirrors the backend `gt=0` rule exactly.
 */
export const roleAssignmentSchema = z.object({
  role_id: z
    .string()
    .min(1, 'Role is required')
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= ROLE_ID_MIN,
      'Role is required',
    ),
});

/** Inferred type — must stay assignable to RoleFormValues for RHF. */
export type RoleAssignmentSchema = z.infer<typeof roleAssignmentSchema>;
