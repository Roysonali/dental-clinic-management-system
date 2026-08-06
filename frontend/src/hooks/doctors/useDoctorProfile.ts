import { useQuery } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { doctorQueryKeys } from './useDoctors';
import type { DoctorProfileResponse } from '../../types/doctor';

/**
 * Doctor profile query — GET /doctors/{id}/profile.
 *
 * Returns the full profile plus specializations and the weekly schedule
 * template. Recommended data source for the Doctor Details page.
 *
 * @param id — doctor UUID (string)
 * @param enabled — set false until the id is ready
 */
export function useDoctorProfile(id: string | undefined | null, enabled = true) {
  return useQuery<DoctorProfileResponse>({
    queryKey: doctorQueryKeys.profile(id ?? ''),
    queryFn: () => doctorService.getProfile(id as string),
    enabled: enabled && !!id,
  });
}
