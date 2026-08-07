import { useMutation, useQueryClient } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

/**
 * Approval workflow mutations (no request body). These mutate the plan's
 * `approval` record — invalidate the root so the detail card, the
 * pending-approval queue and the dashboard counts refetch.
 */

type ApprovalFn = (id: string) => Promise<TreatmentPlanResponse>;

function useApprovalMutation(approvalFn: ApprovalFn) {
  const queryClient = useQueryClient();
  return useMutation<TreatmentPlanResponse, Error, string>({
    mutationFn: (planId) => approvalFn(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentPlanQueryKeys.all });
    },
  });
}

/** POST /treatment-plans/{id}/doctor-approve (PROPOSED + unsigned). */
export function useDoctorApprove() {
  return useApprovalMutation((id) => treatmentPlanService.doctorApprove(id));
}

/** POST /treatment-plans/{id}/doctor-revoke (PROPOSED + signed). */
export function useDoctorRevoke() {
  return useApprovalMutation((id) => treatmentPlanService.doctorRevoke(id));
}

/** POST /treatment-plans/{id}/patient-acknowledge (PROPOSED + signed + pending). */
export function usePatientAcknowledge() {
  return useApprovalMutation((id) => treatmentPlanService.patientAcknowledge(id));
}

/** POST /treatment-plans/{id}/patient-decline (PROPOSED + signed + pending). */
export function usePatientDecline() {
  return useApprovalMutation((id) => treatmentPlanService.patientDecline(id));
}
