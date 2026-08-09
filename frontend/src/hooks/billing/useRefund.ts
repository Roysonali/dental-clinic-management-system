import { useQuery } from '@tanstack/react-query';
import { billingQueryKeys } from './billingQueryKeys';
import type { RefundRead } from '../../types/billing';

/**
 * Refund detail query.
 *
 * The backend exposes NO GET /billing/refunds/{id} endpoint — `RefundRead`
 * is only returned by the create/approve/reject/complete mutations, which
 * cache it via `queryClient.setQueryData` (same contract as credit notes).
 *
 * `enabled: false` prevents accidental network calls; the query returns the
 * cached refund when available, or `undefined` when the page is opened
 * directly without a prior mutation in this session.
 */
export function useRefund(id: string | undefined) {
  return useQuery<RefundRead>({
    queryKey: billingQueryKeys.refundDetail(id ?? ''),
    queryFn: async () => {
      // Intentionally unreachable — backend has no GET endpoint yet.
      // Data comes from the mutation cache.
      throw new Error('Refund detail endpoint not available');
    },
    enabled: false,
    staleTime: Infinity,
  });
}
