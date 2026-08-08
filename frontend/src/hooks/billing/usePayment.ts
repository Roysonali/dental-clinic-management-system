import { useQuery } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { PaymentRead } from '../../types/billing';

/**
 * Single payment query — GET /billing/payments/{id}.
 *
 * Returns the full aggregate (patient, creator/updater, allocations,
 * financials, gateway metadata, versioning). 404 → error state; 403 →
 * permission state; never auto-retried.
 *
 * `enabled: false` lets callers fetch on demand (e.g. the list page fetches
 * the full aggregate only when the Edit action opens the edit drawer).
 */
export function usePayment(id: string, options?: { enabled?: boolean }) {
  return useQuery<PaymentRead>({
    queryKey: billingQueryKeys.paymentDetail(id),
    queryFn: () => billingService.getPayment(id),
    enabled: options?.enabled ?? true,
    retry: shouldRetryQuery,
  });
}
