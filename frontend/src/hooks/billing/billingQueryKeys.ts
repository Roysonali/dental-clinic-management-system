import type { InvoiceListParams, PaymentListParams } from '../../types/billing';

/**
 * Query key factory for billing queries (cache + invalidation contract).
 *
 * All keys share the `'billing'` root so every Billing phase (dashboard,
 * invoices, payments, receipts, refunds, credit notes) can invalidate the
 * dashboard with `invalidateQueries({ queryKey: ['billing'] })` after
 * mutations — the same root-prefix convention used by treatment plans and
 * patient records.
 *
 * Invoice keys (Sprint 14A.2):
 * - `['billing', 'invoices', 'list', params]` — paginated list; `params` is
 *   a stable plain object so identical filter sets share one cache entry.
 * - `['billing', 'invoices', 'detail', id]` — full aggregate per invoice.
 *
 * Payment keys (Sprint 14A.3):
 * - `['billing', 'payments', 'list', params]` — server-side filter/sort/page.
 * - `['billing', 'payments', 'detail', id]` — full payment aggregate (the
 *   detail page renders `allocations` from this aggregate).
 * - `['billing', 'payments', 'allocations', id]` — GET /{id}/allocations,
 *   consumed by the Allocate dialog to visibly disable invoices that already
 *   have an allocation from this payment (the backend rejects duplicates
 *   with a 409).
 * - `['billing', 'receipts', 'by-payment', id]` — receipt generated for a
 *   payment (the backend has no GET-by-payment lookup; the receipt is cached
 *   here from the generate mutation's response and surfaced by the Receipt
 *   card on the payment detail page).
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
  /** Paginated payment list — server-side filters encoded in `params`. */
  paymentList: (params: PaymentListParams) =>
    ['billing', 'payments', 'list', params] as const,
  /** Single payment aggregate. */
  paymentDetail: (id: string) => ['billing', 'payments', 'detail', id] as const,
  /** Allocation summaries for a payment (GET /billing/payments/{id}/allocations). */
  paymentAllocations: (id: string) =>
    ['billing', 'payments', 'allocations', id] as const,
  /** Receipt generated for a payment (cache from the generate mutation). */
  receiptForPayment: (paymentId: string) =>
    ['billing', 'receipts', 'by-payment', paymentId] as const,
  /** Single credit note aggregate (cached from mutation responses — backend has no GET endpoint). */
  creditNoteDetail: (id: string) =>
    ['billing', 'credit-notes', 'detail', id] as const,
} as const;
