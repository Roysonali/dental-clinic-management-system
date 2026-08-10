import { useQuery } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { ReceiptRead } from '../../types/billing';

/**
 * Single receipt query — GET /billing/receipts/{id}.
 *
 * Returns the full aggregate (patient, linked payment, financials,
 * document metadata, audit trail). 404 → error state; 403 → permission
 * state; never auto-retried (the backend owns authorization).
 */
export function useReceipt(id: string) {
  return useQuery<ReceiptRead>({
    queryKey: billingQueryKeys.receiptDetail(id),
    queryFn: () => billingService.getReceipt(id),
    retry: shouldRetryQuery,
  });
}
