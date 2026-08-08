import type { InvoiceListParams } from '../../types/billing';

/**
 * Query key factory for billing queries (cache + invalidation contract).
 *
 * All keys share the `'billing'` root so future Billing phases (invoices,
 * payments, receipts, refunds, credit notes) can invalidate the dashboard
 * with `invalidateQueries({ queryKey: ['billing'] })` after mutations — the
 * same root-prefix convention used by treatment plans and patient records.
 *
 * Invoice keys (Sprint 14A.2):
 * - `['billing', 'invoices', 'list', params]` — paginated list; `params` is
 *   a stable plain object so identical filter sets share one cache entry.
 * - `['billing', 'invoices', 'detail', id]` — full aggregate per invoice.
 */
export const billingQueryKeys = {
  all: ['billing'] as const,
  /** Dashboard snapshot; the patient filter is part of the key. */
  dashboard: (patientId?: string) => ['billing', 'dashboard', patientId ?? 'all'] as const,
  /** Paginated invoice list — server-side filters encoded in `params`. */
  invoiceList: (params: InvoiceListParams) =>
    ['billing', 'invoices', 'list', params] as const,
  /** Single invoice aggregate. */
  invoiceDetail: (id: string) => ['billing', 'invoices', 'detail', id] as const,
} as const;
