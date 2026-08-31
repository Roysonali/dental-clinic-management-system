import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import type {
  AppointmentListParams,
  AppointmentListResponse,
  AppointmentResponse,
} from '../../types/appointment';
import { APPOINTMENT_LIST_PAGE_SIZE } from '../../constants/appointment';

/** Query key factory for every appointment query (used for cache invalidation). */
export const appointmentQueryKeys = {
  all: ['appointments'] as const,
  list: (params: AppointmentListParams) =>
    [
      'appointments',
      'list',
      {
        skip: params.skip ?? 0,
        limit: params.limit ?? APPOINTMENT_LIST_PAGE_SIZE,
        search: params.search ?? '',
        status: params.status ?? 'all',
        date_from: params.date_from ?? '',
        date_to: params.date_to ?? '',
        dentist_id: params.dentist_id ?? 'all',
      },
    ] as const,
  patient: (patientId: string, params: AppointmentListParams) =>
    [
      'appointments',
      'patient',
      patientId,
      {
        skip: params.skip ?? 0,
        limit: params.limit ?? APPOINTMENT_LIST_PAGE_SIZE,
        search: params.search ?? '',
        status: params.status ?? 'all',
        date_from: params.date_from ?? '',
        date_to: params.date_to ?? '',
        dentist_id: params.dentist_id ?? 'all',
      },
    ] as const,
  today: ['appointments', 'today'] as const,
  detail: (id: string) => ['appointments', 'detail', id] as const,
};

export type { AppointmentResponse, AppointmentListResponse };

/**
 * Paginated appointment list query.
 *
 * `@tanstack/react-query` `keepPreviousData` keeps the previous page's rows
 * visible while the next page loads (no layout jump), mirroring `usePatients`.
 *
 * @param params — `{skip, limit}` aligned with GET /appointments.
 */
export function useAppointments(params: AppointmentListParams) {
  return useQuery<AppointmentListResponse>({
    queryKey: appointmentQueryKeys.list(params),
    queryFn: () => appointmentService.list(params),
    placeholderData: keepPreviousData,
  });
}
