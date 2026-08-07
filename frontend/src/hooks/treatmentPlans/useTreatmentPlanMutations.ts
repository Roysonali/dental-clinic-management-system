import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { CreatePlanRequest, TreatmentPlanResponse } from '../../types/treatmentPlan';

/**
 * POST /treatment-plans — create plan (DRAFT + approval + version 1).
 * Invalidates every plan query + the names cache on success.
 */
export function useCreateTreatmentPlan() {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, CreatePlanRequest>({
    mutationFn: (payload) => treatmentPlanService.createPlan(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['treatment-plan-names'] });
    },
  });
}
