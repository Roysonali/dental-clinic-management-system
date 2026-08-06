import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { shouldRetryQuery } from '../../services/apiError';
import { userQueryKeys } from '../users/useUsers';
import type {
  PendingUserResponse,
  UserApprovalResponse,
} from '../../types/auth';

/** Query key prefix for pending-user queries. */
export const pendingUsersQueryKeys = {
  all: ['auth', 'pending-users'] as const,
};

/**
 * Pending registration requests — GET /auth/users/pending (admin only).
 *
 * 403 (non-admin) is not retried and surfaces as `kind: 'forbidden'` so
 * the container can render an "insufficient permissions" state.
 */
export function usePendingUsers() {
  return useQuery<PendingUserResponse[]>({
    queryKey: pendingUsersQueryKeys.all,
    queryFn: () => authService.fetchPendingUsers(),
    retry: shouldRetryQuery,
  });
}

/**
 * Approve a pending user — PATCH /auth/users/{id}/approve (admin only).
 *
 * Invalidates BOTH the pending-approval queue (the approved user leaves
 * it) and the user directory (the approved user now appears in the
 * `/users` list with an assigned role). The second invalidation also
 * serves the Phase 1D Add-User flow, which approves a freshly registered
 * account from the Add-User drawer.
 */
export function useApproveUser() {
  const queryClient = useQueryClient();
  return useMutation<UserApprovalResponse, Error, { userId: number; roleId: number }>({
    mutationFn: ({ userId, roleId }) => authService.approveUser(userId, roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pendingUsersQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
    },
  });
}

/** Deactivate a pending user — PATCH /auth/users/{id}/deactivate (admin only). */
export function useDeactivatePendingUser() {
  const queryClient = useQueryClient();
  return useMutation<UserApprovalResponse, Error, number>({
    mutationFn: (userId) => authService.deactivateUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pendingUsersQueryKeys.all });
    },
  });
}
