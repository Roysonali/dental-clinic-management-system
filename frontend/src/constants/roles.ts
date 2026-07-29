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
