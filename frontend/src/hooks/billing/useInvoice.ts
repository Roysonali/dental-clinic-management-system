import { useQuery } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { InvoiceRead } from '../../types/billing';

/**
 * Single invoice query — GET /billing/invoices/{id}.
 *
 * Returns the full aggregate (patient/doctor/treatment-plan/appointment
 * summaries, line items, financials, audit metadata). 404 → error state
 * (\"may have been removed\"); 403 → permission state; never auto-retried.
 *
 * `enabled: false` lets callers fetch on demand (e.g. the list page fetches
 * the full aggregate only when the Edit action opens the edit drawer).
 */
export function useInvoice(id: string, options?: { enabled?: boolean }) {
  return useQuery<InvoiceRead>({
    queryKey: billingQueryKeys.invoiceDetail(id),
    queryFn: () => billingService.getInvoice(id),
    enabled: options?.enabled ?? true,
    retry: shouldRetryQuery,
  });
}
