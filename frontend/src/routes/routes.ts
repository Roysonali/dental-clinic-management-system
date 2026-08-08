/**
 * Route path constants.
 *
 * Single source of truth for all application routes.
 * Use these constants instead of hardcoded strings throughout the app.
 */
export const ROUTES = {
  HOME: '/',
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    FORGOT_PASSWORD: '/auth/forgot-password',
  },
  DASHBOARD: '/dashboard',
  ADMIN: {
    PENDING_USERS: '/admin/users/pending',
  },
  PATIENTS: '/patients',
  DOCTORS: '/doctors',
  USERS: '/users',
  APPOINTMENTS: '/appointments',
  TREATMENT_PLANS: '/treatment-plans',
  PROCEDURES: '/procedures',
  PATIENT_RECORDS: '/patient-records',
  BILLING: '/billing',
  /** Invoice list (Phase 2 — Sprint 14A.2). */
  BILLING_INVOICES: '/billing/invoices',
  SETTINGS: '/settings',
} as const;

/** Auth route paths */
export type AuthRoute = (typeof ROUTES.AUTH)[keyof typeof ROUTES.AUTH];
