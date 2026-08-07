import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { patientService } from '../../services/patientService';
import { appointmentService } from '../../services/appointmentService';
import { userService } from '../../services/userService';
import { parseApiError, shouldRetryQuery } from '../../services/apiError';
import { patientQueryKeys } from '../patients/usePatients';
import { appointmentQueryKeys } from '../appointments/useAppointments';
import { userQueryKeys } from '../users/useUsers';

/** Freshness window for resolved display names. */
const NAME_STALE_TIME_MS = 5 * 60 * 1000;
/** Largest page size the backend accepts for GET /users (1–100). */
const USER_DIRECTORY_PAGE_SIZE = 100;

/** Resolved display-name maps keyed by id (null when unresolved). */
export interface PatientRecordNames {
  /** patient_id → full_name */
  patientNames: Map<string, string | null>;
  /** appointment_id → appointment_number */
  appointmentNumbers: Map<string, string | null>;
  /** user id (int — prescribed_by / performed_by) → full_name */
  userNames: Map<number, string | null>;
}

/**
 * Resolve patient, appointment and user display names for record rows.
 *
 * The backend `PatientRecordListItem`/`PatientRecordResponse` only carry ids
 * (and `prescribed_by`/`performed_by` are int user ids). Names are resolved
 * via `GET /patients/{id}`, `GET /appointments/{id}` and `GET /users/{id}`.
 *
 * M-3 — no cold-start N+1 where avoidable:
 * - Patient + appointment names use PER-ID queries keyed under the shared
 *   `['patients','detail',id]` / `['appointments','detail',id]` cache keys,
 *   so an id resolved anywhere in the app (patient details page, the
 *   appointment module, this module's list/detail/prescriptions views) is
 *   fetched once and reused — never duplicated across consumers.
 * - User names are batched through the ADMIN-only user directory
 *   (`GET /users` pages). One request resolves every actor/prescriber; for
 *   non-admins the single 403 (never retried) collapses to all-null instead
 *   of one forbidden request per id. Only ids missing from a SUCCESSFUL
 *   directory read fall back to `GET /users/{id}`.
 *
 * All lookups are BEST-EFFORT: any per-id failure is swallowed and maps to
 * `null` — the UI falls back to "Patient #… / Appointment #… / User #id".
 */
export function usePatientRecordNames(
  patientIds: readonly string[],
  appointmentIds: readonly string[],
  userIds: readonly number[],
): PatientRecordNames {
  const patientKey = useMemo(() => Array.from(new Set(patientIds)).sort(), [patientIds]);
  const appointmentKey = useMemo(
    () => Array.from(new Set(appointmentIds)).sort(),
    [appointmentIds],
  );
  const userKey = useMemo(
    () => Array.from(new Set(userIds)).sort((a, b) => a - b),
    [userIds],
  );

  // Per-id patient/appointment queries — shared cache keys reuse entities
  // fetched by other modules (M-3).
  const patientResults = useQueries({
    queries: patientKey.map((id) => ({
      queryKey: patientQueryKeys.detail(id),
      queryFn: () => patientService.get(id),
      staleTime: NAME_STALE_TIME_MS,
      retry: shouldRetryQuery,
    })),
  });

  const appointmentResults = useQueries({
    queries: appointmentKey.map((id) => ({
      queryKey: appointmentQueryKeys.detail(id),
      queryFn: () => appointmentService.get(id),
      staleTime: NAME_STALE_TIME_MS,
      retry: shouldRetryQuery,
    })),
  });

  // User directory batch (admin-only; a single 403 → all names null).
  const userDirectoryQuery = useQuery({
    queryKey: ['patient-record-names', 'user-directory'],
    queryFn: async () => {
      const first = await userService.list({ page: 1, page_size: USER_DIRECTORY_PAGE_SIZE });
      const items = [...first.items];
      for (let page = 2; (page - 1) * USER_DIRECTORY_PAGE_SIZE < first.total; page += 1) {
        const next = await userService.list({ page, page_size: USER_DIRECTORY_PAGE_SIZE });
        items.push(...next.items);
      }
      return items;
    },
    enabled: userKey.length > 0,
    staleTime: NAME_STALE_TIME_MS,
    retry: shouldRetryQuery,
  });

  // When the directory is forbidden (non-admin), skip the per-id fallback
  // entirely — every user lookup would fail the same way (N forbidden
  // requests). All names stay null, which the UI renders as "User #id".
  const directoryDenied =
    userDirectoryQuery.isError &&
    parseApiError(userDirectoryQuery.error).kind === 'forbidden';

  const missingUserIds = useMemo(() => {
    if (directoryDenied || !userDirectoryQuery.data) return [];
    const known = new Set(userDirectoryQuery.data.map((u) => u.id));
    return userKey.filter((id) => !known.has(id));
  }, [directoryDenied, userDirectoryQuery.data, userKey]);

  const userFallbackResults = useQueries({
    queries: missingUserIds.map((id) => ({
      queryKey: userQueryKeys.detail(id),
      queryFn: () => userService.get(id),
      staleTime: NAME_STALE_TIME_MS,
      retry: shouldRetryQuery,
    })),
  });

  // Every requested id is present in its map — `null` when unresolved, so
  // consumers never see `undefined` from `.get()` (the documented contract).
  const patientNames = useMemo(() => {
    const map = new Map<string, string | null>(patientKey.map((id) => [id, null]));
    patientKey.forEach((id, index) => {
      const result = patientResults[index];
      const name = result?.data?.full_name ?? null;
      if (name) map.set(id, name);
    });
    return map;
  }, [patientKey, patientResults]);

  const appointmentNumbers = useMemo(() => {
    const map = new Map<string, string | null>(appointmentKey.map((id) => [id, null]));
    appointmentKey.forEach((id, index) => {
      const result = appointmentResults[index];
      const number = result?.data?.appointment_number ?? null;
      if (number) map.set(id, number);
    });
    return map;
  }, [appointmentKey, appointmentResults]);

  const userNames = useMemo(() => {
    const map = new Map<number, string | null>(userKey.map((id) => [id, null]));
    if (userDirectoryQuery.data) {
      for (const user of userDirectoryQuery.data) {
        map.set(user.id, user.full_name ?? null);
      }
    }
    missingUserIds.forEach((id, index) => {
      const result = userFallbackResults[index];
      const name = result?.data?.full_name ?? null;
      if (name) map.set(id, name);
    });
    return map;
  }, [userKey, userDirectoryQuery.data, missingUserIds, userFallbackResults]);

  return { patientNames, appointmentNumbers, userNames };
}
