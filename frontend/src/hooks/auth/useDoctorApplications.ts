import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { shouldRetryQuery } from '../../services/apiError';
import type {
  DoctorApplicationResponse,
  DoctorApplicationActionResponse,
} from '../../types/auth';

/** Query key prefix for doctor application queries. */
export const doctorApplicationQueryKeys = {
  all: ['auth', 'doctor-applications'] as const,
};

/**
 * Pending doctor applications — GET /doctor-applications (admin only).
 */
export function useDoctorApplications() {
  return useQuery<DoctorApplicationResponse[]>({
    queryKey: doctorApplicationQueryKeys.all,
    queryFn: () => authService.fetchDoctorApplications(),
    retry: shouldRetryQuery,
  });
}

/**
 * Approve a doctor application — PATCH /doctor-applications/{id}/approve.
 *
 * Invalidates the doctor applications queue, the pending users queue,
 * and the doctor list.
 */
export function useApproveDoctorApplication() {
  const queryClient = useQueryClient();
  return useMutation<
    DoctorApplicationActionResponse,
    Error,
    { applicationId: number; roleId: number }
  >({
    mutationFn: ({ applicationId, roleId }) =>
      authService.approveDoctorApplication(applicationId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: doctorApplicationQueryKeys.all,
      });
      void queryClient.invalidateQueries({
        queryKey: ['auth', 'pending-users'],
      });
      void queryClient.invalidateQueries({
        queryKey: ['doctors'],
      });
    },
  });
}

/**
 * Reject a doctor application — PATCH /doctor-applications/{id}/reject.
 */
export function useRejectDoctorApplication() {
  const queryClient = useQueryClient();
  return useMutation<
    DoctorApplicationActionResponse,
    Error,
    { applicationId: number; reason?: string }
  >({
    mutationFn: ({ applicationId, reason }) =>
      authService.rejectDoctorApplication(applicationId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: doctorApplicationQueryKeys.all,
      });
    },
  });
}
