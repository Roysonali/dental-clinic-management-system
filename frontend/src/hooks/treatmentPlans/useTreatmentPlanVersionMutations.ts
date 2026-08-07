import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

/** POST /treatment-plans/{id}/versions (201) — immutable snapshot; `change_reason` 1–500. */
export function useCreateVersion() {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, { planId: string; changeReason: string }>({
    mutationFn: ({ planId, changeReason }) =>
      treatmentPlanService.createVersion(planId, changeReason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}

/** POST /treatment-plans/{id}/versions/{versionId}/restore — editable statuses only. */
export function useRestoreVersion() {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, { planId: string; versionId: string }>({
    mutationFn: ({ planId, versionId }) =>
      treatmentPlanService.restoreVersion(planId, versionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}
