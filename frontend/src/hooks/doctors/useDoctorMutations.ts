import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { doctorQueryKeys } from './useDoctors';
import type {
  DoctorCreateRequest,
  DoctorResponse,
  DoctorUpdateRequest,
  ScheduleCreateRequest,
  ScheduleResponse,
  ScheduleUpdateRequest,
} from '../../types/doctor';

/**
 * Mutation hooks for the doctor module.
 *
 * All mutations invalidate the `doctors` query prefix on success so the
 * list, detail and profile views refetch the freshest data. No optimistic
 * updates (server is the source of truth — blueprint §8.3).
 */

/** POST /doctors — create a doctor profile linked to an existing user. */
export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation<DoctorResponse, Error, DoctorCreateRequest>({
    mutationFn: (payload) => doctorService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** PATCH /doctors/{id} — partial update. */
export function useUpdateDoctor() {
  const queryClient = useQueryClient();
  return useMutation<DoctorResponse, Error, { id: string; payload: DoctorUpdateRequest }>({
    mutationFn: ({ id, payload }) => doctorService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** PATCH /doctors/{id}/activate — admin only (backend-enforced). */
export function useActivateDoctor() {
  const queryClient = useQueryClient();
  return useMutation<DoctorResponse, Error, string>({
    mutationFn: (id) => doctorService.activate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** PATCH /doctors/{id}/deactivate — admin only (backend-enforced). */
export function useDeactivateDoctor() {
  const queryClient = useQueryClient();
  return useMutation<DoctorResponse, Error, string>({
    mutationFn: (id) => doctorService.deactivate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** PATCH /doctors/{id}/leave — toggles on_leave (no request body). */
export function useToggleLeave() {
  const queryClient = useQueryClient();
  return useMutation<DoctorResponse, Error, string>({
    mutationFn: (id) => doctorService.toggleLeave(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** PATCH /doctors/{id}/availability — toggles availability (no request body). */
export function useToggleAvailability() {
  const queryClient = useQueryClient();
  return useMutation<DoctorResponse, Error, string>({
    mutationFn: (id) => doctorService.toggleAvailability(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/* ── Schedule Mutations ──────────────────────────────────────────────────── */

/**
 * PUT /doctors/{id}/schedules — atomically replace the entire weekly schedule.
 *
 * This is the PRIMARY save mechanism for the weekly schedule editor.
 * All existing entries are deleted and replaced with the provided list.
 */
export function useReplaceWeekSchedule() {
  const queryClient = useQueryClient();
  return useMutation<ScheduleResponse[], Error, { doctorId: string; schedules: ScheduleCreateRequest[] }>({
    mutationFn: ({ doctorId, schedules }) => doctorService.replaceWeekSchedule(doctorId, schedules),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** POST /doctors/{id}/schedules — create a single schedule entry. */
export function useCreateDoctorSchedule() {
  const queryClient = useQueryClient();
  return useMutation<ScheduleResponse, Error, { doctorId: string; payload: ScheduleCreateRequest }>({
    mutationFn: ({ doctorId, payload }) => doctorService.createSchedule(doctorId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** PATCH /doctors/{id}/schedules/{sid} — partial update a schedule entry. */
export function useUpdateDoctorSchedule() {
  const queryClient = useQueryClient();
  return useMutation<
    ScheduleResponse,
    Error,
    { doctorId: string; scheduleId: string; payload: ScheduleUpdateRequest }
  >({
    mutationFn: ({ doctorId, scheduleId, payload }) =>
      doctorService.updateSchedule(doctorId, scheduleId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}

/** DELETE /doctors/{id}/schedules/{sid} — delete a schedule entry. */
export function useDeleteDoctorSchedule() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { doctorId: string; scheduleId: string }>({
    mutationFn: ({ doctorId, scheduleId }) => doctorService.deleteSchedule(doctorId, scheduleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorQueryKeys.all });
    },
  });
}
