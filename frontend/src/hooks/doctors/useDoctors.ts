import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { shouldRetryQuery } from '../../services/apiError';
import type {
  DoctorListParams,
  DoctorListResponse,
  SpecializationListParams,
} from '../../types/doctor';

/**
 * Query key namespace for all doctor queries (used for cache invalidation).
 * Mirrors the approved blueprint §8.1.
 */
export const doctorQueryKeys = {
  all: ['doctors'] as const,
  list: (params: DoctorListParams = {}) =>
    [
      'doctors',
      'list',
      params.page ?? 1,
      params.page_size ?? 20,
      params.search ?? '',
      params.is_active ?? 'all',
      params.is_available ?? 'all',
      params.specialization_id ?? 'all',
      params.sort_by ?? 'full_name',
      params.sort_order ?? 'asc',
    ] as const,
  detail: (id: string) => ['doctors', 'detail', id] as const,
  profile: (id: string) => ['doctors', 'profile', id] as const,
  specializations: {
    all: ['specializations'] as const,
    list: (params: SpecializationListParams = {}) =>
      [
        'specializations',
        'list',
        params.page ?? 1,
        params.page_size ?? 20,
        params.is_active ?? 'all',
      ] as const,
  },
  schedules: (doctorId: string) => ['doctors', 'schedules', doctorId] as const,
};

/** Params used by the Appointment dentist-dropdown consumer (legacy mode). */
const APPOINTMENT_DROPDOWN_PARAMS: DoctorListParams = {
  page: 1,
  page_size: 100,
  is_active: true,
};

type UseDoctorsArgs = [enabled?: boolean] | [params: DoctorListParams, enabled?: boolean];

/**
 * Paginated doctor list query — GET /doctors.
 *
 * Backward-compatible with the Appointment module's original signature:
 * - `useDoctors(enabled?)`  → appointment dentist dropdown (active doctors,
 *   page_size 100, 5-minute stale time, static params).
 * - `useDoctors(params, enabled?)` → module list page (parameterized keys,
 *   30-second stale time).
 *
 * Both share the `['doctors','list',...]` key space (distinct params →
 * distinct cache entries) and never retry 401/403 (`shouldRetryQuery`).
 */
export function useDoctors(...args: UseDoctorsArgs) {
  const [first, second] = args;
  // `useDoctors()` / `useDoctors(enabled)` → legacy appointment dropdown
  // behaviour; `useDoctors(params, enabled?)` → module list page.
  const isParams = typeof first === 'object' && first !== null;
  const params = isParams ? first : APPOINTMENT_DROPDOWN_PARAMS;
  const enabled = isParams ? (second ?? true) : typeof first === 'boolean' ? first : true;

  return useQuery<DoctorListResponse>({
    queryKey: doctorQueryKeys.list(params),
    queryFn: () => doctorService.list(params),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: isParams ? 30 * 1000 : 5 * 60 * 1000,
    retry: shouldRetryQuery,
  });
}
