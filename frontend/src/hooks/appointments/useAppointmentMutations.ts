import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../../services/appointmentService';
import { appointmentQueryKeys } from './useAppointments';
import type {
  AppointmentCreatePayload,
  AppointmentResponse,
  AppointmentStatus,
  AppointmentUpdatePayload,
} from '../../types/appointment';

/**
 * Mutation hooks for the appointment module.
 *
 * All mutations invalidate the `appointments` query prefix on success so the
 * list, today and detail views refetch the freshest data (same pattern as the
 * patient module's `usePatientMutations`).
 */

/** POST /appointments — schedule a new appointment. */
export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation<AppointmentResponse, Error, AppointmentCreatePayload>({
    mutationFn: (payload) => appointmentService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentQueryKeys.all });
    },
  });
}

/** PUT /appointments/{id} — edit / reschedule. */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation<
    AppointmentResponse,
    Error,
    { id: string; payload: AppointmentUpdatePayload }
  >({
    mutationFn: ({ id, payload }) => appointmentService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentQueryKeys.all });
    },
  });
}

/** PATCH /appointments/{id}/cancel. */
export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation<AppointmentResponse, Error, string>({
    mutationFn: (id) => appointmentService.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentQueryKeys.all });
    },
  });
}

/** PATCH /appointments/{id}/status — transition appointment status. */
export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();
  return useMutation<AppointmentResponse, Error, { id: string; status: AppointmentStatus }>({
    mutationFn: ({ id, status }) => appointmentService.updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentQueryKeys.all });
    },
  });
}
