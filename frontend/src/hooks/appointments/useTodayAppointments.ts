import { useQuery } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import type { AppointmentResponse } from '../../types/appointment';
import { appointmentQueryKeys } from './useAppointments';

/**
 * Today's appointments query (GET /appointments/today).
 * Used by the dashboard "Upcoming Appointments" section.
 */
export function useTodayAppointments() {
  return useQuery<AppointmentResponse[]>({
    queryKey: appointmentQueryKeys.today,
    queryFn: () => appointmentService.today(),
  });
}
