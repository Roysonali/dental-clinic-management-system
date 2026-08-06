import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { userQueryKeys } from './useUsers';
import { pendingUsersQueryKeys } from '../auth/usePendingUsers';
import type { UserActionResponse } from '../../types/user';

/**
 * Mutation hooks for the user module.
 *
 * All mutations invalidate the `['users']` query prefix on success so the
 * list, detail and search views refetch the freshest data. Activate/
 * deactivate additionally invalidate the admin pending-approval list
 * (`['auth','pending-users']`) because those endpoints move users between
 * the pending and active/inactive statuses. No optimistic updates (server
 * is the source of truth — same convention as the doctor module).
 */

/** Invalidate every user-directory query (list + detail + search). */
function invalidateUserDirectory(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
}

/** PATCH /users/{user_id}/role — admin only (backend rejects self-change). */
export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation<UserActionResponse, Error, { userId: number; roleId: number }>({
    mutationFn: ({ userId, roleId }) => userService.changeRole(userId, roleId),
    onSuccess: () => {
      invalidateUserDirectory(queryClient);
    },
  });
}

/** PATCH /users/{user_id}/activate — admin only (backend rejects self-activation). */
export function useActivateUser() {
  const queryClient = useQueryClient();
  return useMutation<UserActionResponse, Error, number>({
    mutationFn: (userId) => userService.activate(userId),
    onSuccess: () => {
      invalidateUserDirectory(queryClient);
      void queryClient.invalidateQueries({ queryKey: pendingUsersQueryKeys.all });
    },
  });
}

/** PATCH /users/{user_id}/deactivate — admin only (backend rejects self-deactivation). */
export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation<UserActionResponse, Error, number>({
    mutationFn: (userId) => userService.deactivate(userId),
    onSuccess: () => {
      invalidateUserDirectory(queryClient);
      void queryClient.invalidateQueries({ queryKey: pendingUsersQueryKeys.all });
    },
  });
}
