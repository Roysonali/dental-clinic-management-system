import { useQuery } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { PaginatedResponse, PlanListParams, TreatmentPlanListItem } from '../../types/treatmentPlan';

/**
 * Doctor dashboard "My Active Treatment Plans" query — GET
 * /treatment-plans/by-doctor/{doctorId} filtered to active plans.
 *
 * The current user's doctor UUID is resolved via `doctorService.getByUserId`
 * (the established user→doctor mapping used by the appointments module).
 */
export function useMyActiveTreatmentPlans(doctorId: string | null | undefined) {
  const id = doctorId ?? '';
  const params: PlanListParams = { page: 1, page_size: 5, is_active: true };
  return useQuery<PaginatedResponse<TreatmentPlanListItem>>({
    queryKey: treatmentPlanQueryKeys.byDoctor(id, params),
    queryFn: () => treatmentPlanService.listByDoctor(id, params),
    enabled: id.length > 0,
  });
}
