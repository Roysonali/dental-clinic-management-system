import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { shouldRetryQuery } from '../../services/apiError';
import {
  USER_LIST_PAGE_SIZE,
  USER_LIST_STALE_TIME_MS,
} from '../../constants/user';
import type { UserListParams, UserListResponse } from '../../types/user';

/**
 * Query key namespace for all user queries (used for cache invalidation).
 * Mirrors the doctor/patient blueprint — the `['users']` prefix lets any
 * mutation invalidate every user query at once.
 *
 * NOTE: `search` (the UserSearchSelect key) is defined here too so the
 * whole namespace lives in one place; `useUsersSearch` imports it.
 */
export const userQueryKeys = {
  all: ['users'] as const,
  list: (params: UserListParams = {}) =>
    [
      'users',
      'list',
      params.page ?? 1,
      params.page_size ?? USER_LIST_PAGE_SIZE,
      params.search ?? '',
      params.status ?? 'all',
      params.role_id ?? 'all',
    ] as const,
  detail: (id: number) => ['users', 'detail', id] as const,
  search: (term: string) => ['users', 'search', term] as const,
};

/**
 * Paginated user list query — GET /users (admin only).
 *
 * Uses `keepPreviousData` so pagination, search and filter changes keep
 * the previous rows visible while the next page loads (no layout jump).
 * Never retries 401/403 (`shouldRetryQuery` — the endpoint is ADMIN-only).
 *
 * @param params — page/page_size/search/status/role_id aligned with GET /users
 * @param enabled — set false until the list view is ready
 */
export function useUsers(params: UserListParams = {}, enabled = true) {
  return useQuery<UserListResponse>({
    queryKey: userQueryKeys.list(params),
    queryFn: () => userService.list(params),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: USER_LIST_STALE_TIME_MS,
    retry: shouldRetryQuery,
  });
}
