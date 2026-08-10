import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { InvoiceListParams, InvoiceListResponse } from '../../types/billing';

/**
 * Paginated invoice list query — GET /billing/invoices.
 *
 * The backend fully supports server-side search/filter/sort/pagination, so
 * `params` flow straight into the query key and the endpoint. `keepPreviousData`
 * keeps the current page visible while paging/filtering (no layout jump).
 * `shouldRetryQuery` never retries 401/403 — a 403 surfaces as the
 * permission-denied state instead of hammering the endpoint.
 */
export function useInvoices(params: InvoiceListParams, enabled = true) {
  return useQuery<InvoiceListResponse>({
    queryKey: billingQueryKeys.invoiceList(params),
    queryFn: () => billingService.listInvoices(params),
    placeholderData: keepPreviousData,
    retry: shouldRetryQuery,
    enabled,
  });
}
