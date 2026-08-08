/**
 * Query key factory for billing queries (cache + invalidation contract).
 *
 * All keys share the `'billing'` root so future Billing phases (invoices,
 * payments, receipts, refunds, credit notes) can invalidate the dashboard
 * with `invalidateQueries({ queryKey: ['billing'] })` after mutations —
 * the same root-prefix convention used by treatment plans and patient
 * records.
 */
export const billingQueryKeys = {
  all: ['billing'] as const,
  /** Dashboard snapshot; the patient filter is part of the key. */
  dashboard: (patientId?: string) => ['billing', 'dashboard', patientId ?? 'all'] as const,
} as const;
