import { useQuery } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import { appointmentQueryKeys } from './useAppointments';
import type { AppointmentResponse } from '../../types/appointment';

/**
 * Single appointment query — GET /appointments/{id}.
 *
 * @param id — appointment UUID (string)
 * @param enabled — set false until the id is ready (e.g. while a drawer opens)
 */
export function useAppointment(id: string | undefined | null, enabled = true) {
  return useQuery<AppointmentResponse>({
    queryKey: appointmentQueryKeys.detail(id ?? ''),
    queryFn: () => appointmentService.get(id as string),
    enabled: enabled && !!id,
  });
}
