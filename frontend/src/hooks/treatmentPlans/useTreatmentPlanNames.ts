import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { doctorService } from '../../services/doctorService';
import { shouldRetryQuery } from '../../services/apiError';
import { treatmentPlanNamesKey } from './treatmentPlanQueryKeys';

/** Resolved display-name maps keyed by id (null when unresolved). */
export interface TreatmentPlanNames {
  /** patient_id → full_name */
  patientNames: Map<string, string | null>;
  /** doctor_id (UUID) → user_full_name */
  doctorNames: Map<string, string | null>;
}

/**
 * Resolve patient + doctor display names for a set of plan rows.
 *
 * The backend `TreatmentPlanListItem`/`TreatmentPlanResponse` only carry ids
 * (R10), so names are resolved via `GET /patients/{id}` and
 * `GET /doctors/{id}`. Both lookups are BEST-EFFORT: any per-id failure is
 * swallowed and maps to `null`, so lists always render with an ID fallback.
 * Results are cached per deduplicated, sorted id-set, mirroring
 * `useAppointmentNames`.
 */
export function useTreatmentPlanNames(
  patientIds: readonly string[],
  doctorIds: readonly string[],
) {
  const patientKey = useMemo(() => Array.from(new Set(patientIds)).sort(), [patientIds]);
  const doctorKey = useMemo(() => Array.from(new Set(doctorIds)).sort(), [doctorIds]);
  const enabled = patientKey.length > 0 || doctorKey.length > 0;

  return useQuery<TreatmentPlanNames>({
    queryKey: treatmentPlanNamesKey(patientKey, doctorKey),
    queryFn: async () => {
      const patientNames = new Map<string, string | null>();
      const doctorNames = new Map<string, string | null>();

      await Promise.all(
        patientKey.map(async (id) => {
          try {
            const patient = await patientService.get(id);
            patientNames.set(id, patient.full_name ?? null);
          } catch {
            patientNames.set(id, null);
          }
        }),
      );

      await Promise.all(
        doctorKey.map(async (id) => {
          try {
            const doctor = await doctorService.get(id);
            doctorNames.set(id, doctor.user_full_name ?? null);
          } catch {
            doctorNames.set(id, null);
          }
        }),
      );

      return { patientNames, doctorNames };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    // 401/403 (cross-role reads without permission) are expected for some
    // users — never retry them; keep the default retry for transient failures.
    retry: shouldRetryQuery,
  });
}
