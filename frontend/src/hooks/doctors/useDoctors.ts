import { useQuery } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { shouldRetryQuery } from '../../services/apiError';
import type { DoctorListResponse } from '../../types/doctor';

/** Query key prefix for doctor queries (used for cache invalidation). */
export const doctorQueryKeys = {
  all: ['doctors'] as const,
  list: ['doctors', 'list'] as const,
};

/**
 * Active doctor list query — GET /doctors?is_active=true&page_size=100.
 *
 * Used by the appointment create/edit form to populate the dentist dropdown.
 * NOTE: the backend restricts this endpoint to ADMIN/RECEPTIONIST; a
 * doctor-role user receives 403. The query therefore surfaces `isError` and
 * the form falls back to an empty dropdown (plus the current dentist in edit
 * mode) instead of blocking the whole page.
 */
export function useDoctors(enabled = true) {
  return useQuery<DoctorListResponse>({
    queryKey: doctorQueryKeys.list,
    queryFn: () =>
      doctorService.list({
        page: 1,
        page_size: 100,
        is_active: true,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
    // Doctors hitting this ADMIN/RECEPTIONIST endpoint receive 403 — retrying
    // cannot change that, so never retry auth/forbidden failures.
    retry: shouldRetryQuery,
  });
}
