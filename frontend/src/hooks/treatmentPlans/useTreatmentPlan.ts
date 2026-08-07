import { useQuery } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

/**
 * Full plan aggregate query — GET /treatment-plans/{id}.
 * Disabled until an id is provided.
 */
export function useTreatmentPlan(id: string | null | undefined, enabled = true) {
  const planId = id ?? '';
  return useQuery<TreatmentPlanResponse>({
    queryKey: treatmentPlanQueryKeys.detail(planId),
    queryFn: () => treatmentPlanService.getPlan(planId),
    enabled: enabled && planId.length > 0,
  });
}
