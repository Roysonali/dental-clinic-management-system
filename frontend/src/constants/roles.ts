/**
 * RBAC role constants matching backend `app/core/constants.py`.
 *
 * This is the canonical source for role definitions.
 * Import from here in types/auth.ts and throughout the app.
 */

/** All available RBAC roles */
export const ROLES = {
  ADMIN: 'ADMIN',
  CHIEF_DOCTOR: 'CHIEF_DOCTOR',
  GENERAL_DOCTOR: 'GENERAL_DOCTOR',
  SPECIALIST_DOCTOR: 'SPECIALIST_DOCTOR',
  CONSULTING_DOCTOR: 'CONSULTING_DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  DENTAL_ASSISTANT: 'DENTAL_ASSISTANT',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Roles that are classified as doctor-level */
export const DOCTOR_ROLES: readonly RoleName[] = [
  ROLES.CHIEF_DOCTOR,
  ROLES.GENERAL_DOCTOR,
  ROLES.SPECIALIST_DOCTOR,
  ROLES.CONSULTING_DOCTOR,
] as const;

/** Human-readable labels for each role */
export const ROLE_LABELS: Record<RoleName, string> = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.CHIEF_DOCTOR]: 'Chief Doctor',
  [ROLES.GENERAL_DOCTOR]: 'General Doctor',
  [ROLES.SPECIALIST_DOCTOR]: 'Specialist Doctor',
  [ROLES.CONSULTING_DOCTOR]: 'Consulting Doctor',
  [ROLES.RECEPTIONIST]: 'Receptionist',
  [ROLES.DENTAL_ASSISTANT]: 'Dental Assistant',
};

/** Check if a role is a doctor-level role */
export const isDoctorRole = (role: RoleName): boolean =>
  DOCTOR_ROLES.includes(role);

/**
 * Admin-level roles.
 *
 * Mirrors the backend admin set exactly — `_ADMIN_ROLES` in
 * `backend/app/modules/rbac/permissions.py` = { ADMIN, CHIEF_DOCTOR }.
 * Do not add roles here that the backend does not treat as admin.
 */
export const ADMIN_ROLES: readonly RoleName[] = [
  ROLES.ADMIN,
  ROLES.CHIEF_DOCTOR,
] as const;

/** Check if a role is admin-level (ADMIN or CHIEF_DOCTOR). */
export const isAdminRole = (role: RoleName): boolean =>
  ADMIN_ROLES.includes(role);

/**
 * Role → numeric `role_id` mapping for the admin approval flow.
 *
 * The backend exposes no `GET /roles` endpoint, yet `PATCH
 * /auth/users/{id}/approve` requires a numeric `role_id`. This mapping
 * mirrors the deterministic insert order of
 * `backend/app/database/seed_roles.py` (roles are seeded in this exact
 * order and only if absent, so a fresh database yields ids 1–7).
 *
 * TODO: replace with a server-provided roles list once the backend adds
 * a roles endpoint — hardcoding ids is fragile against reseeded DBs.
 */
export const ROLE_IDS: Record<RoleName, number> = {
  [ROLES.ADMIN]: 1,
  [ROLES.CHIEF_DOCTOR]: 2,
  [ROLES.GENERAL_DOCTOR]: 3,
  [ROLES.SPECIALIST_DOCTOR]: 4,
  [ROLES.CONSULTING_DOCTOR]: 5,
  [ROLES.RECEPTIONIST]: 6,
  [ROLES.DENTAL_ASSISTANT]: 7,
};
