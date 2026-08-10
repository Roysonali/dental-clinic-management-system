import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type {
  PaginatedResponse,
  PlanListParams,
  TreatmentPlanListItem,
} from '../../types/treatmentPlan';

/**
 * Paginated treatment plan list query — GET /treatment-plans.
 *
 * The backend fully supports server-side search/filter/sort/pagination, so
 * `params` flow straight to the query key and the endpoint (unlike the
 * appointments module, whose backend only accepts skip/limit). Uses
 * `keepPreviousData` so paging keeps the previous page visible.
 *
 * `enabled` (default true) lets consumers like the invoice create drawer
 * defer the fetch until their host surface opens.
 */
export function useTreatmentPlans(params: PlanListParams, enabled = true) {
  return useQuery<PaginatedResponse<TreatmentPlanListItem>>({
    queryKey: treatmentPlanQueryKeys.list(params),
    queryFn: () => treatmentPlanService.listPlans(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}
