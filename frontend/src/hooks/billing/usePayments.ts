import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { PaymentListParams, PaymentListResponse } from '../../types/billing';

/**
 * Paginated payment list query — GET /billing/payments.
 *
 * The backend fully supports server-side filter/sort/pagination, so `params`
 * flow straight into the query key and the endpoint (there is no free-text
 * `query` param on this endpoint — the list is filtered via the toolbar's
 * Patient / Method / Status / date-range controls). `keepPreviousData` keeps
 * the current page visible while paging/filtering. `shouldRetryQuery` never
 * retries 401/403 — a 403 surfaces as the permission-denied state instead of
 * hammering the endpoint.
 */
export function usePayments(params: PaymentListParams) {
  return useQuery<PaymentListResponse>({
    queryKey: billingQueryKeys.paymentList(params),
    queryFn: () => billingService.listPayments(params),
    placeholderData: keepPreviousData,
    retry: shouldRetryQuery,
  });
}
