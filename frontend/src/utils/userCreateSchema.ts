import { z } from 'zod';
import { roleAssignmentSchema } from './userFormSchema';
import { passwordSchema } from './passwordSchema';

/**
 * Add-User form schema (Sprint 11B Phase 1D).
 *
 * Mirrors the backend contract EXACTLY — verified against
 * `backend/app/modules/auth/schemas.py` (`UserRegister`) and
 * `backend/app/core/exception_handlers.py`:
 *
 * - `full_name`  → required, 2–100 chars, normalized (trim + collapse
 *   internal whitespace) — same as the backend `normalize_full_name`.
 * - `email`      → required, valid email, normalized to lowercase —
 *   same as the backend `normalize_email`.
 * - `password`   → required, 8–128 chars, must contain at least one
 *   uppercase letter, one lowercase letter, one digit and one special
 *   character — same as the backend `validate_password_complexity`.
 *   Shared with `RegisterForm` via `utils/passwordSchema.ts`.
 * - `role_id`    → required positive integer (numeric string) — reuses
 *   the Phase 1A `roleAssignmentSchema` rule (`gt=0`) verbatim.
 *
 * No frontend-only rules are added. Unknown/extra fields are rejected by
 * the backend (`extra="forbid"`) so they are simply not part of the form.
 */
export const userCreateSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must not exceed 100 characters')
    .transform((value) => value.trim().replace(/\s+/g, ' ')),
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address')
    .transform((value) => value.trim().toLowerCase()),
  password: passwordSchema,
  role_id: roleAssignmentSchema.shape.role_id,
});

/** Inferred (output) type — must stay assignable to UserCreateFormValues. */
export type UserCreateSchema = z.infer<typeof userCreateSchema>;
