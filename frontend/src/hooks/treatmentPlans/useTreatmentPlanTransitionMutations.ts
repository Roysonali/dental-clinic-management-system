import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

/**
 * Plan status transition mutations (10 endpoints, no request body).
 * Every transition changes `status` — which every list, queue, dashboard
 * and the detail view derive from — so the `'treatment-plans'` root is
 * invalidated on success (architecture report §9).
 */

type TransitionFn = (id: string) => Promise<TreatmentPlanResponse>;

function useTransitionMutation(transitionFn: TransitionFn) {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, string>({
    mutationFn: (planId) => transitionFn(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}

/** POST /treatment-plans/{id}/submit-for-review (draft → under_review; ≥1 item). */
export function useSubmitForReview() {
  return useTransitionMutation((id) => treatmentPlanService.submitForReview(id));
}

/** POST /treatment-plans/{id}/approve-review (under_review → proposed). */
export function useApproveReview() {
  return useTransitionMutation((id) => treatmentPlanService.approveReview(id));
}

/** POST /treatment-plans/{id}/reject-review (under_review → draft). */
export function useRejectReview() {
  return useTransitionMutation((id) => treatmentPlanService.rejectReview(id));
}

/** POST /treatment-plans/{id}/accept (proposed → accepted). */
export function useAcceptPlan() {
  return useTransitionMutation((id) => treatmentPlanService.acceptPlan(id));
}

/** POST /treatment-plans/{id}/decline (proposed → rejected). */
export function useDeclinePlan() {
  return useTransitionMutation((id) => treatmentPlanService.declinePlan(id));
}

/** POST /treatment-plans/{id}/cancel (any non-terminal → cancelled). */
export function useCancelPlan() {
  return useTransitionMutation((id) => treatmentPlanService.cancelPlan(id));
}

/** POST /treatment-plans/{id}/start-treatment (accepted → in_progress; ≥1 item). */
export function useStartTreatment() {
  return useTransitionMutation((id) => treatmentPlanService.startTreatment(id));
}

/** POST /treatment-plans/{id}/hold (in_progress → on_hold). */
export function usePutOnHold() {
  return useTransitionMutation((id) => treatmentPlanService.putOnHold(id));
}

/** POST /treatment-plans/{id}/resume (on_hold → in_progress). */
export function useResumeTreatment() {
  return useTransitionMutation((id) => treatmentPlanService.resume(id));
}

/** POST /treatment-plans/{id}/complete (in_progress/on_hold → completed). */
export function useCompletePlan() {
  return useTransitionMutation((id) => treatmentPlanService.complete(id));
}
