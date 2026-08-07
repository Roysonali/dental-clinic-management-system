import type { PlanListParams } from '../../types/treatmentPlan';

/**
 * Query key factory for every treatment-plan query (used for cache
 * invalidation). All keys share the `'treatment-plans'` root so
 * `invalidateQueries({ queryKey: ['treatment-plans'] })` invalidates
 * lists, detail, queues, dashboard and by-patient/by-doctor together —
 * the React Query invalidation contract (architecture report §9).
 */
export const treatmentPlanQueryKeys = {
  all: ['treatment-plans'] as const,
  list: (params: PlanListParams) => ['treatment-plans', 'list', params] as const,
  search: (term: string) => ['treatment-plans', 'search', term] as const,
  detail: (id: string) => ['treatment-plans', 'detail', id] as const,
  pendingReview: ['treatment-plans', 'pending-review'] as const,
  pendingApproval: ['treatment-plans', 'pending-approval'] as const,
  dashboard: ['treatment-plans', 'dashboard'] as const,
  byPatient: (patientId: string, params: PlanListParams) =>
    ['treatment-plans', 'by-patient', patientId, params] as const,
  byDoctor: (doctorId: string, params: PlanListParams) =>
    ['treatment-plans', 'by-doctor', doctorId, params] as const,
  version: (planId: string, versionId: string) =>
    ['treatment-plans', 'detail', planId, 'version', versionId] as const,
} as const;

/** Names cache key (patient/doctor display-name resolution, R10). */
export const treatmentPlanNamesKey = (patients: readonly string[], doctors: readonly string[]) =>
  ['treatment-plan-names', { patients, doctors }] as const;
