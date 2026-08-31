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
    RESET_PASSWORD: '/auth/reset-password',
  },
  DASHBOARD: '/dashboard',
  ADMIN: {
    PENDING_USERS: '/admin/users/pending',
  },
  PATIENTS: '/patients',
  DOCTORS: '/doctors',
  USERS: '/users',
  APPOINTMENTS: '/appointments',
  APPOINTMENTS_CALENDAR: '/appointments/calendar',
  TREATMENT_PLANS: '/treatment-plans',
  PROCEDURES: '/procedures',
  PATIENT_RECORDS: '/patient-records',
  BILLING: '/billing',
  /** Invoice list (Phase 2 — Sprint 14A.2). */
  BILLING_INVOICES: '/billing/invoices',
  /** Credit Note detail (Phase 4 — Sprint 14A.4). */
  BILLING_CREDIT_NOTES: '/billing/credit-notes',
  /** Payment list (Phase 3 — Sprint 14A.3). */
  BILLING_PAYMENTS: '/billing/payments',
  /** Receipt detail (Phase 5 — Sprint 14A.5). */
  BILLING_RECEIPTS: '/billing/receipts',
  /** Refund timeline (Phase 5 — Sprint 14A.5). */
  BILLING_REFUNDS: '/billing/refunds',
  SETTINGS: '/settings',
} as const;

/**
 * Query param name that asks a list page to auto-open its create drawer.
 *
 * Dashboard quick-action CTAs ("New Patient", "Schedule Appointment",
 * "Create Invoice") navigate to the target list with `?create=true` so the
 * user lands directly on the creation form — no second click. The list
 * containers consume the intent on mount and strip it again when the
 * drawer closes. `INVOICE_CREATE_QUERY_PARAM` is the original billing-only
 * export kept for backward compatibility — it is the same value.
 */
export const CREATE_QUERY_PARAM = 'create';

/**
 * Backward-compatible alias for {@link CREATE_QUERY_PARAM} — same value.
 *
 * Kept for the billing module (InvoiceListContainer + its tests), which
 * predates the generic constant and documents the invoice create handoff.
 */
export const INVOICE_CREATE_QUERY_PARAM = CREATE_QUERY_PARAM;

/**
 * List routes that render their own compact mobile header (hamburger +
 * page title + add action, reference screens 47/48) on the phone breakpoint
 * and therefore hide the global header there. Detail pages keep the global
 * header. Single source of truth shared by AppShell (header hiding) and the
 * list pages themselves.
 */
export const MOBILE_COMPACT_HEADER_ROUTES: readonly string[] = [
  ROUTES.BILLING_INVOICES,
  ROUTES.BILLING_PAYMENTS,
  ROUTES.PATIENTS,
  ROUTES.APPOINTMENTS,
  ROUTES.TREATMENT_PLANS,
  ROUTES.PATIENT_RECORDS,
  ROUTES.DOCTORS,
  ROUTES.USERS,
] as const;

/** Auth route paths */
export type AuthRoute = (typeof ROUTES.AUTH)[keyof typeof ROUTES.AUTH];
