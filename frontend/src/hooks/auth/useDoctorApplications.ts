import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { shouldRetryQuery } from '../../services/apiError';
import type {
  DoctorApplicationResponse,
  DoctorApplicationActionResponse,
  RoleResponse,
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
 * RBAC roles from GET /auth/roles (admin).
 *
 * F-03: approval screens should prefer this server-provided list when
 * building role dropdowns. Callers fall back to the seeded ROLE_IDS map
 * only if the query fails (e.g. role list temporarily unavailable).
 */
export function useRoles() {
  return useQuery<RoleResponse[]>({
    queryKey: ['auth', 'roles'],
    queryFn: () => authService.fetchRoles(),
    staleTime: 5 * 60 * 1000, // roles are near-static master data
    retry: shouldRetryQuery,
  });
}

/**
 * Reject a doctor application — PATCH /doctor-applications/{id}/reject.
 *
 * Invalidates the doctor applications queue and the pending users queue
 * (a doctor applicant is a pending user) so the admin lists refresh
 * without a manual reload.
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
      void queryClient.invalidateQueries({
        queryKey: ['auth', 'pending-users'],
      });
    },
  });
}
