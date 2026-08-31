import { useQuery } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import { appointmentQueryKeys } from './useAppointments';
import type {
  AppointmentStatus,
  CalendarAppointmentListResponse,
} from '../../types/appointment';

/** Query key factory for calendar queries (extends appointment namespace). */
export const calendarQueryKeys = {
  ...appointmentQueryKeys,
  calendar: (params: {
    start: string;
    end: string;
    dentist_id?: number;
    status?: AppointmentStatus;
  }) =>
    [
      'appointments',
      'calendar',
      params.start,
      params.end,
      params.dentist_id ?? 'all',
      params.status ?? 'all',
    ] as const,
};

/**
 * Calendar appointment query — GET /appointments/calendar.
 *
 * Fetches appointments for a bounded date range with optional
 * dentist and status filters. The backend uses [start, end)
 * semantics (inclusive start, exclusive end).
 *
 * The query key includes all parameters so changing the visible
 * range, dentist filter, or status filter triggers a fresh fetch.
 *
 * @param params — `{start, end}` with optional `dentist_id` and `status`
 * @param enabled — set false until params are ready
 */
export function useAppointmentCalendar(
  params: {
    start: string;
    end: string;
    dentist_id?: number;
    status?: AppointmentStatus;
  },
  enabled = true,
) {
  return useQuery<CalendarAppointmentListResponse>({
    queryKey: calendarQueryKeys.calendar(params),
    queryFn: () => appointmentService.calendar(params),
    enabled: enabled && !!params.start && !!params.end,
    // Calendar data should be fresh — 30 seconds stale time
    staleTime: 30 * 1000,
  });
}
