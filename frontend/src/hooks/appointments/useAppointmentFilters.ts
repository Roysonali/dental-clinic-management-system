import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import {
  APPOINTMENT_LIST_PAGE_SIZE,
  type AppointmentStatusFilter,
} from '../../constants/appointment';
import type { AppointmentListParams } from '../../types/appointment';

export interface AppointmentFilters {
  /** Raw search input (updates immediately) */
  searchInput: string;
  /** Debounced search value (drives client-side row filtering) */
  debouncedSearch: string;
  /** Status filter ('all' or a backend AppointmentStatus) */
  status: AppointmentStatusFilter;
  /** Current page (1-based) */
  page: number;
  /** Page size (matches backend default 20) */
  pageSize: number;
  /** Update search input (resets to page 1) */
  setSearchInput: (value: string) => void;
  /** Update status filter (resets to page 1) */
  setStatus: (value: AppointmentStatusFilter) => void;
  /** Change page */
  setPage: (page: number) => void;
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Ready-to-send query params for GET /appointments (skip/limit only). */
  params: AppointmentListParams;
}

/**
 * Owns the appointment list query state: debounced search, status filter and
 * pagination. Mirrors `usePatientFilters`.
 *
 * NOTE: GET /appointments supports only `skip`/`limit` (no server-side
 * search or status params), so search/status are applied client-side over the
 * current page's enriched rows by the container — the toolbar still behaves
 * (and looks) like the Patient module.
 */
export function useAppointmentFilters(): AppointmentFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<AppointmentStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(APPOINTMENT_LIST_PAGE_SIZE);

  const debouncedSearch = useDebounce(searchInput, 350);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    setPage(1);
  };

  const setStatus = (value: AppointmentStatusFilter) => {
    setStatusState(value);
    setPage(1);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const params = useMemo<AppointmentListParams>(
    () => ({ skip: (page - 1) * pageSize, limit: pageSize }),
    [page, pageSize],
  );

  return {
    searchInput,
    debouncedSearch,
    status,
    page,
    pageSize,
    setSearchInput,
    setStatus,
    setPage,
    setPageSize: changePageSize,
    params,
  };
}
