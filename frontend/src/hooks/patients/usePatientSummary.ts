import { useQuery } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { patientQueryKeys } from './usePatients';
import type { PatientSummaryResponse } from '../../types/patient';

/** Query key for the patient hub summary. */
export const patientSummaryKey = (id: string) =>
  [...patientQueryKeys.detail(id), 'summary'] as const;

/**
 * Patient hub summary query — GET /patients/{id}/summary.
 *
 * Returns counts, recent items, and billing summary in a single request.
 * Cached per patient with a 30-second stale time.
 *
 * @param patientId — patient UUID (string)
 */
export function usePatientSummary(
  patientId: string | undefined | null,
  enabled = true,
) {
  return useQuery<PatientSummaryResponse>({
    queryKey: patientSummaryKey(patientId ?? ''),
    queryFn: () => patientService.getSummary(patientId as string),
    enabled: enabled && !!patientId,
    staleTime: 30_000,
  });
}
