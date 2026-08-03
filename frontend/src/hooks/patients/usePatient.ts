import { useQuery } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { patientQueryKeys } from './usePatients';
import type { PatientResponse } from '../../types/patient';

/**
 * Single patient query — GET /patients/{id}.
 *
 * @param id — patient UUID (string)
 * @param enabled — set false until the id is ready (e.g. while a drawer opens)
 */
export function usePatient(id: string | undefined | null, enabled = true) {
  return useQuery<PatientResponse>({
    queryKey: patientQueryKeys.detail(id ?? ''),
    queryFn: () => patientService.get(id as string),
    enabled: enabled && !!id,
  });
}
