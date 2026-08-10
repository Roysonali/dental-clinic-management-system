import { useQuery } from '@tanstack/react-query';
import { billingService } from '../../services/billingService';
import { shouldRetryQuery } from '../../services/apiError';
import { billingQueryKeys } from './billingQueryKeys';
import type { BillingDashboardResponse } from '../../types/billing';

/**
 * Billing dashboard query — GET /billing/dashboard.
 *
 * `patientId` is optional: when provided, the backend includes a
 * patient-level financial summary in the response (system-wide otherwise).
 * The query key encodes the patient filter, so switching patients triggers a
 * refetch of the correct payload (and switching back hits the cache).
 *
 * `shouldRetryQuery` keeps the global single-retry for transient failures but
 * never retries 401/403 — the backend is the authority, and a 403 surfaces as
 * the permission-denied state instead of hammering the endpoint.
 */
export function useBillingDashboard(patientId?: string) {
  return useQuery<BillingDashboardResponse>({
    queryKey: billingQueryKeys.dashboard(patientId),
    queryFn: () => billingService.getDashboard(patientId),
    retry: shouldRetryQuery,
  });
}
