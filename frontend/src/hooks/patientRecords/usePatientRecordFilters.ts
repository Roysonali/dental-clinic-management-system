import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import { PATIENT_RECORD_LIST_PAGE_SIZE } from '../../constants/patientRecord';
import type { PatientRecordListParams, RecordStatus } from '../../types/patientRecord';

export type PatientRecordStatusFilter = RecordStatus | 'all';
export type FinalizedFilter = 'all' | 'finalized' | 'not-finalized';

export interface PatientRecordFilters {
  /** Raw search input (updates immediately) */
  searchInput: string;
  /** Debounced search value (drives the server-side `search` param) */
  debouncedSearch: string;
  /** Status filter ('all' or a backend RecordStatus) */
  status: PatientRecordStatusFilter;
  /** Finalized filter */
  finalized: FinalizedFilter;
  /** Current page (1-based) */
  page: number;
  /** Page size */
  pageSize: number;
  setSearchInput: (value: string) => void;
  setStatus: (value: PatientRecordStatusFilter) => void;
  setFinalized: (value: FinalizedFilter) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** True when any filter (besides pagination) is active — used to show Clear. */
  hasActiveFilters: boolean;
  clearFilters: () => void;
  /** Ready-to-send params for GET /patient-records. */
  params: PatientRecordListParams;
}

/**
 * Owns the patient record list query state. Every filter is applied
 * SERVER-SIDE (the backend supports search/status/is_finalized natively).
 * No sort state — the backend exposes no sort parameters.
 */
export function usePatientRecordFilters(): PatientRecordFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<PatientRecordStatusFilter>('all');
  const [finalized, setFinalizedState] = useState<FinalizedFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PATIENT_RECORD_LIST_PAGE_SIZE);

  const debouncedSearch = useDebounce(searchInput, 350);

  const resetPage = () => setPage(1);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    resetPage();
  };
  const setStatus = (value: PatientRecordStatusFilter) => {
    setStatusState(value);
    resetPage();
  };
  const setFinalized = (value: FinalizedFilter) => {
    setFinalizedState(value);
    resetPage();
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    resetPage();
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' || status !== 'all' || finalized !== 'all';

  const clearFilters = () => {
    setSearchInputState('');
    setStatusState('all');
    setFinalizedState('all');
    resetPage();
  };

  const params = useMemo<PatientRecordListParams>(() => {
    const next: PatientRecordListParams = { page, page_size: pageSize };
    const search = debouncedSearch.trim();
    if (search) next.search = search;
    if (status !== 'all') next.status = status;
    if (finalized === 'finalized') next.is_finalized = true;
    if (finalized === 'not-finalized') next.is_finalized = false;
    return next;
  }, [page, pageSize, debouncedSearch, status, finalized]);

  return {
    searchInput,
    debouncedSearch,
    status,
    finalized,
    page,
    pageSize,
    setSearchInput,
    setStatus,
    setFinalized,
    setPage,
    setPageSize: changePageSize,
    hasActiveFilters,
    clearFilters,
    params,
  };
}
