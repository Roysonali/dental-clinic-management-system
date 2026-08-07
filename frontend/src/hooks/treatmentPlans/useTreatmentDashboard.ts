import { useQuery } from '@tanstack/react-query';
import { treatmentPlanService } from '../../services/treatmentPlanService';
import { treatmentPlanQueryKeys } from './treatmentPlanQueryKeys';
import type { DashboardSummaryResponse } from '../../types/treatmentPlan';

/** Dashboard summary query — GET /treatment-plans/dashboard. */
export function useTreatmentDashboard() {
  return useQuery<DashboardSummaryResponse>({
    queryKey: treatmentPlanQueryKeys.dashboard,
    queryFn: () => treatmentPlanService.getDashboard(),
  });
}
