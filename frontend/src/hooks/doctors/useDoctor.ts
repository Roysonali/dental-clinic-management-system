import { useQuery } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { doctorQueryKeys } from './useDoctors';
import type { DoctorResponse } from '../../types/doctor';

/**
 * Single doctor query — GET /doctors/{id}.
 *
 * @param id — doctor UUID (string)
 * @param enabled — set false until the id is ready (e.g. while a drawer opens)
 */
export function useDoctor(id: string | undefined | null, enabled = true) {
  return useQuery<DoctorResponse>({
    queryKey: doctorQueryKeys.detail(id ?? ''),
    queryFn: () => doctorService.get(id as string),
    enabled: enabled && !!id,
  });
}
