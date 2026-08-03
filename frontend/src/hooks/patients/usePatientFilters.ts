import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import { PATIENT_LIST_PAGE_SIZE } from '../../constants/patient';
import type {
  PatientListParams,
  PatientStatusFilter,
} from '../../types/patient';

export interface PatientFilters {
  /** Raw search input (updates immediately) */
  searchInput: string;
  /** Debounced search value (drives the API query) */
  debouncedSearch: string;
  /** Active/inactive/all filter */
  status: PatientStatusFilter;
  /** Current page (1-based) */
  page: number;
  /** Page size (matches backend default) */
  pageSize: number;
  /** Update search input (resets to page 1) */
  setSearchInput: (value: string) => void;
  /** Update status filter (resets to page 1) */
  setStatus: (value: PatientStatusFilter) => void;
  /** Change page */
  setPage: (page: number) => void;
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Ready-to-send query params for GET /patients */
  params: PatientListParams;
}

/**
 * Owns the patient list query state: debounced search, status filter and
 * pagination. Page resets happen at the event handlers (not in effects),
 * keeping render/effect cycles side-effect free and lint-clean.
 */
export function usePatientFilters(): PatientFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<PatientStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PATIENT_LIST_PAGE_SIZE);

  const debouncedSearch = useDebounce(searchInput, 350);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    setPage(1);
  };

  const setStatus = (value: PatientStatusFilter) => {
    setStatusState(value);
    setPage(1);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const params = useMemo<PatientListParams>(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      is_active: status === 'all' ? undefined : status === 'active',
    }),
    [page, pageSize, debouncedSearch, status],
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
