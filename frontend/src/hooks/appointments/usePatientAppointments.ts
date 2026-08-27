import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import { appointmentQueryKeys } from './useAppointments';
import type {
  AppointmentListParams,
  AppointmentListResponse,
} from '../../types/appointment';
import { APPOINTMENT_LIST_PAGE_SIZE } from '../../constants/appointment';

/**
 * Paginated appointment list query scoped to a specific patient.
 *
 * GET /patients/{patientId}/appointments?skip=&limit=
 *
 * Used by the Patient Details → Appointments tab so the tab displays
 * only the current patient's appointments.
 *
 * @param patientId — patient UUID (string)
 * @param params — `{skip, limit}` pagination params
 * @param enabled — set false until the patientId is ready
 */
export function usePatientAppointments(
  patientId: string | undefined | null,
  params: AppointmentListParams = {},
  enabled = true,
) {
  return useQuery<AppointmentListResponse>({
    queryKey: appointmentQueryKeys.patient(
      patientId ?? '',
      params,
    ),
    queryFn: () =>
      appointmentService.listByPatient(patientId as string, params),
    placeholderData: keepPreviousData,
    enabled: enabled && !!patientId,
  });
}
