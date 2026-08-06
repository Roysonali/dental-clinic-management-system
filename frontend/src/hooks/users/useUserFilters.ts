import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import {
  USER_LIST_PAGE_SIZE,
  USER_SEARCH_DEBOUNCE_MS,
} from '../../constants/user';
import type { UserListParams, UserStatusFilter } from '../../types/user';

export interface UserFilters {
  /** Raw search input (updates immediately) */
  searchInput: string;
  /** Debounced search value (drives the API query) */
  debouncedSearch: string;
  /** Status filter (all/pending/active/inactive) */
  status: UserStatusFilter;
  /** Role filter (null = all) */
  roleId: number | null;
  /** Current page (1-based) */
  page: number;
  /** Page size (matches backend default 10) */
  pageSize: number;
  /** Update search input (resets to page 1) */
  setSearchInput: (value: string) => void;
  /** Update status filter (resets to page 1) */
  setStatus: (value: UserStatusFilter) => void;
  /** Update role filter (resets to page 1) */
  setRole: (value: number | null) => void;
  /** Change page */
  setPage: (page: number) => void;
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Ready-to-send query params for GET /users */
  params: UserListParams;
}

/**
 * Owns the user list query state: debounced search, status/role filters
 * and pagination. Page resets happen at the event handlers (not in
 * effects), keeping render/effect cycles side-effect free — identical to
 * the doctor/patient filter hooks.
 *
 * NOTE: the backend GET /users has NO sort params (fixed `id DESC`
 * ordering), so unlike the doctor module there is no sort state here.
 */
export function useUserFilters(): UserFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<UserStatusFilter>('all');
  const [roleId, setRoleState] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(USER_LIST_PAGE_SIZE);

  const debouncedSearch = useDebounce(searchInput, USER_SEARCH_DEBOUNCE_MS);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    setPage(1);
  };

  const setStatus = (value: UserStatusFilter) => {
    setStatusState(value);
    setPage(1);
  };

  const setRole = (value: number | null) => {
    setRoleState(value);
    setPage(1);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const params = useMemo<UserListParams>(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      status: status === 'all' ? undefined : status,
      role_id: roleId ?? undefined,
    }),
    [page, pageSize, debouncedSearch, status, roleId],
  );

  return {
    searchInput,
    debouncedSearch,
    status,
    roleId,
    page,
    pageSize,
    setSearchInput,
    setStatus,
    setRole,
    setPage,
    setPageSize: changePageSize,
    params,
  };
}
