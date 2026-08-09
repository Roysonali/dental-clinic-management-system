import { useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type { ReceiptRead } from '../../types/billing';

/**
 * Receipt mutations (Sprint 14A.5).
 *
 * Regeneration is a document-reproduction workflow (no financial data
 * changes), but it writes an audit event, so the `'billing'` ROOT is
 * invalidated on success (the shared invalidation contract) and the
 * receipt detail key is refreshed from the mutation response — the same
 * contract as the other billing mutations.
 */

/** POST /billing/receipts/{id}/regenerate — re-produce an existing receipt. */
export function useRegenerateReceipt() {
  const queryClient = useQueryClient();
  return useMutation<ReceiptRead, Error, string>({
    mutationFn: (id) => billingService.regenerateReceipt(id),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all });
      void queryClient.setQueryData(billingQueryKeys.receiptDetail(receipt.id), receipt);
    },
  });
}
