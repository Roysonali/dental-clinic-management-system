import { useQuery } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { PaymentAllocationSummary } from '../../types/billing';

/**
 * Allocation summaries for a payment — GET /billing/payments/{id}/allocations.
 *
 * The payment detail page renders allocations from the aggregate
 * (`PaymentRead.allocations`), so this hook exists for one specific consumer:
 * the **Allocate dialog**, which needs the set of invoices that already have
 * an allocation from this payment so it can visibly disable them (the backend
 * rejects duplicate payment↔invoice allocations with a 409 — matching the
 * reference's "already allocated invoice is visibly disabled" rule).
 *
 * `enabled` (default true) lets the dialog defer the fetch until it opens.
 * `shouldRetryQuery` never retries 401/403.
 */
export function usePaymentAllocations(id: string, enabled = true) {
  return useQuery<PaymentAllocationSummary[]>({
    queryKey: billingQueryKeys.paymentAllocations(id),
    queryFn: () => billingService.getPaymentAllocations(id),
    enabled,
    retry: shouldRetryQuery,
  });
}
