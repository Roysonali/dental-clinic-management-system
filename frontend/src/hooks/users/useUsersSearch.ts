import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { shouldRetryQuery } from '../../services/apiError';
import { useDebounce } from '../useDebounce';
import {
  USER_SEARCH_DEBOUNCE_MS,
  USER_SEARCH_PAGE_SIZE,
  USER_SEARCH_STALE_TIME_MS,
} from '../../constants/user';
import { userQueryKeys } from './useUsers';
import type { UserListResponse } from '../../types/user';

/**
 * Shared query key namespace for user searches — the canonical definition
 * now lives in `hooks/users/useUsers.ts` (Sprint 11B Phase 1A) so the
 * whole `['users', ...]` key space is defined in one place. Re-exported
 * here for backward compatibility with the Sprint 11A foundation.
 */
export { userQueryKeys };

/**
 * Async, backend-driven user search — GET /users (admin only).
 *
 * Shared data foundation for the `UserSearchSelect` component: debounced
 * term, 60-second stale time, no retry on 401/403, previous results kept
 * while re-searching.
 *
 * @param search — raw search input (debounced internally)
 * @param enabled — set false until the picker opens
 */
export function useUsersSearch(search: string, enabled = true) {
  const debounced = useDebounce(search, USER_SEARCH_DEBOUNCE_MS);
  const term = debounced.trim();

  return useQuery<UserListResponse>({
    queryKey: userQueryKeys.search(term),
    queryFn: () =>
      userService.list({
        search: term || undefined,
        page: 1,
        page_size: USER_SEARCH_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: USER_SEARCH_STALE_TIME_MS,
    retry: shouldRetryQuery,
  });
}
