import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import { shouldRetryQuery } from '../../services/apiError';
import { formatISODate, formatTime } from '../../utils/date';
import type { AppointmentListResponse } from '../../types/appointment';

/** Largest page size the backend accepts for GET /appointments (le=100). */
export const APPOINTMENT_PAGE_SIZE = 100;
/** Freshness window for the appointment directory (options are reused across drawer sessions). */
const DIRECTORY_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Fetch the COMPLETE appointment directory (every page up to `total`).
 *
 * Pure + exported for unit testing. `GET /appointments` caps `limit` at 100
 * and offers no filters, so completeness requires paging; a capped window
 * could silently omit a valid appointment older than the most recent 100.
 */
export async function fetchAppointmentDirectory(): Promise<AppointmentListResponse> {
  const first = await appointmentService.list({ skip: 0, limit: APPOINTMENT_PAGE_SIZE });
  const items = [...first.items];
  for (let skip = APPOINTMENT_PAGE_SIZE; skip < first.total; skip += APPOINTMENT_PAGE_SIZE) {
    const page = await appointmentService.list({ skip, limit: APPOINTMENT_PAGE_SIZE });
    items.push(...page.items);
  }
  return { items, total: first.total };
}

/**
 * Appointment options for the create-record drawer's appointment selector.
 *
 * The backend appointment list (`GET /appointments`) only accepts skip/limit
 * — there is no by-patient filter and no "without a record" listing (BCR
 * §2.3 note). Options are therefore derived client-side from the COMPLETE
 * appointment directory: every page is fetched (100 per request, looping
 * until `total` is covered) so a valid appointment older than the most
 * recent 100 is never silently omitted. The fetch is gated by `enabled` —
 * nothing is requested while the drawer is closed or no patient is chosen —
 * and the directory is cached for 5 minutes, so switching patients reuses
 * the same data instead of re-fetching.
 *
 * If the chosen appointment already has a record, the backend rejects
 * creation with 409 and the drawer surfaces the message — no fabricated
 * endpoints.
 */
export function useAppointmentOptions(patientId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ['appointments', 'directory'],
    queryFn: fetchAppointmentDirectory,
    enabled,
    staleTime: DIRECTORY_STALE_TIME_MS,
    // The appointments endpoint is read-role gated; never retry expected 401/403s.
    retry: shouldRetryQuery,
  });

  const options = useMemo(() => {
    const appointments = (query.data?.items ?? []).filter(
      (a) => a.patient_id === patientId && a.status !== 'Cancelled',
    );
    return appointments.map((a) => ({
      value: a.id,
      label: `${a.appointment_number} · ${formatISODate(a.appointment_date)} ${formatTime(a.start_time)}`,
    }));
  }, [query.data?.items, patientId]);

  return {
    options,
    loading: query.isLoading,
    /** True once the FULL directory has loaded — options are exhaustive, so an empty list is truthful. */
    loaded: query.isSuccess,
  };
}
