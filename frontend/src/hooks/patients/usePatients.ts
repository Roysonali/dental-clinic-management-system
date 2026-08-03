import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import type { PatientListParams, PatientListResponse } from '../../types/patient';

/** Query key prefix for all patient queries (used for cache invalidation). */
export const patientQueryKeys = {
  all: ['patients'] as const,
  list: (params: PatientListParams) =>
    [
      'patients',
      'list',
      params.page ?? 1,
      params.page_size ?? 20,
      params.search ?? '',
      params.is_active ?? 'all',
    ] as const,
  detail: (id: string) => ['patients', 'detail', id] as const,
};

/**
 * Paginated patient list query.
 *
 * Uses `keepPreviousData` so pagination, search and filter changes keep the
 * previous rows visible while the next page loads (no layout jump).
 *
 * @param params — page/page_size/search/is_active aligned with GET /patients
 */
export function usePatients(params: PatientListParams) {
  return useQuery<PatientListResponse>({
    queryKey: patientQueryKeys.list(params),
    queryFn: () => patientService.list(params),
    placeholderData: keepPreviousData,
  });
}
