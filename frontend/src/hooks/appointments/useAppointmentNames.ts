import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { doctorService } from '../../services/doctorService';
import { shouldRetryQuery } from '../../services/apiError';

/** Resolved display-name maps keyed by id. */
export interface AppointmentNames {
  /** patient_id -> full_name (null when unresolved) */
  patientNames: Map<string, string | null>;
  /** dentist_id -> user_full_name (null when unresolved) */
  dentistNames: Map<number, string | null>;
}

/**
 * Resolve patient + dentist display names for a set of appointment rows.
 *
 * The backend `AppointmentResponse` only carries ids, so names are resolved
 * via `GET /patients/{id}` and `GET /doctors/user/{id}`. Both lookups are
 * **best-effort**: any per-id failure (404, 403 for roles without
 * cross-user read permission, etc.) is swallowed and maps to `null`, so the
 * list always renders with an ID-based fallback.
 *
 * Results are cached per deduplicated, sorted id-set (react-query queryKey),
 * so paging through appointments reuses cached names.
 */
export function useAppointmentNames(
  patientIds: readonly string[],
  dentistIds: readonly number[],
) {
  const patientKey = useMemo(
    () => Array.from(new Set(patientIds)).sort(),
    [patientIds],
  );
  const dentistKey = useMemo(
    () => Array.from(new Set(dentistIds)).sort((a, b) => a - b),
    [dentistIds],
  );
  const enabled = patientKey.length > 0 || dentistKey.length > 0;

  return useQuery<AppointmentNames>({
    // Namespaced under the collection name AND group labels — a patient id and
    // a dentist id happen to share the same primitive value (e.g. "3" vs 3),
    // so the key must not mix both id-lists into one flat array where a
    // future identifier-type change could produce identical serialized keys.
    queryKey: [
      'appointment-names',
      { patients: patientKey, dentists: dentistKey },
    ],
    queryFn: async () => {
      const patientNames = new Map<string, string | null>();
      const dentistNames = new Map<number, string | null>();

      // Resolve against the deduplicated id-sets (never duplicate requests
      // for the same id appearing on multiple rows of a page).
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
        dentistKey.map(async (id) => {
          try {
            const doctor = await doctorService.getByUserId(id);
            dentistNames.set(id, doctor.user_full_name ?? null);
          } catch {
            dentistNames.set(id, null);
          }
        }),
      );

      return { patientNames, dentistNames };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    // 401/403 (cross-role reads without permission) are expected for some
    // users — never retry them; keep the default retry for transient failures.
    retry: shouldRetryQuery,
  });
}
