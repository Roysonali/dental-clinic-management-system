import { z } from 'zod';

/**
 * Shared password policy schema (Sprint 11B review cleanup).
 *
 * Mirrors the backend `validate_password_complexity` EXACTLY — verified
 * against `backend/app/modules/auth/schemas.py` (`UserRegister.password`):
 *
 * - 8–128 characters
 * - at least one uppercase letter, one lowercase letter, one digit and
 *   one special (non-alphanumeric) character
 *
 * Single canonical source of the password rules, reused by every form
 * that sets a new password:
 * - `RegisterForm` (public registration)
 * - `userCreateSchema` (Sprint 11B Phase 1D Add-User drawer)
 *
 * No frontend-only rules are added — the backend is the authority.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one digit')
  .regex(
    /[^a-zA-Z0-9]/,
    'Password must contain at least one special character',
  );
