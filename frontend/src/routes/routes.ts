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
  PATIENTS: '/patients',
  DOCTORS: '/doctors',
  APPOINTMENTS: '/appointments',
  TREATMENT_PLANS: '/treatment-plans',
  BILLING: '/billing',
  SETTINGS: '/settings',
} as const;

/** Auth route paths */
export type AuthRoute = (typeof ROUTES.AUTH)[keyof typeof ROUTES.AUTH];
