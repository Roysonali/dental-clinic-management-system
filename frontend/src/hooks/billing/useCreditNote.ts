import { useQuery } from '@tanstack/react-query';
import { billingQueryKeys } from './billingQueryKeys';
import type { CreditNoteRead } from '../../types/billing';

/**
 * Credit note detail query.
 *
 * The backend currently exposes NO GET /billing/credit-notes/{id} endpoint.
 * Data is supplied exclusively from mutation responses (create/issue/apply/void)
 * via `queryClient.setQueryData` in the mutation hooks.
 *
 * `enabled: false` prevents accidental network calls; the query returns cached
 * data when available, or `undefined` when not.
 */
export function useCreditNote(id: string | undefined) {
  return useQuery<CreditNoteRead>({
    queryKey: billingQueryKeys.creditNoteDetail(id ?? ''),
    queryFn: async () => {
      // Intentionally unreachable — backend has no GET endpoint yet.
      // Data comes from mutation cache.
      throw new Error('Credit note detail endpoint not available');
    },
    enabled: false,
    staleTime: Infinity,
  });
}
