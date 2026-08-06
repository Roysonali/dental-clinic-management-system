import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { doctorQueryKeys } from './useDoctors';
import type {
  SpecializationListParams,
  SpecializationListResponse,
} from '../../types/doctor';

/**
 * Specialization master-data list — GET /specializations.
 *
 * Consumed in Phase 1 by the doctor list filter dropdown (and later by the
 * doctor form). Admin/receptionist/doctor roles may read (backend-enforced).
 */
export function useSpecializations(params: SpecializationListParams = {}, enabled = true) {
  return useQuery<SpecializationListResponse>({
    queryKey: doctorQueryKeys.specializations.list(params),
    queryFn: () => doctorService.listSpecializations(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}
