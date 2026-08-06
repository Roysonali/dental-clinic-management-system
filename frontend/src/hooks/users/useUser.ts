import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { shouldRetryQuery } from '../../services/apiError';
import { userQueryKeys } from './useUsers';
import type { UserDetailResponse } from '../../types/user';

/**
 * Single user query — GET /users/{user_id} (admin only).
 *
 * @param id — numeric user id
 * @param enabled — set false until the id is ready (e.g. while a drawer opens)
 */
export function useUser(id: number | undefined | null, enabled = true) {
  return useQuery<UserDetailResponse>({
    queryKey: userQueryKeys.detail(id ?? 0),
    queryFn: () => userService.get(id as number),
    enabled: enabled && id != null,
    retry: shouldRetryQuery,
  });
}
