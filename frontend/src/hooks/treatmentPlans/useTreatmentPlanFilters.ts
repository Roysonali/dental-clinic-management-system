import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import { TREATMENT_PLAN_LIST_PAGE_SIZE } from '../../constants/treatmentPlan';
import type {
  PlanListParams,
  PlanSortField,
  SortOrder,
  TreatmentPlanStatus,
} from '../../types/treatmentPlan';

export type TreatmentPlanStatusFilter = TreatmentPlanStatus | 'all';
export type TreatmentPlanActiveFilter = 'all' | 'active' | 'inactive';

export interface TreatmentPlanFilters {
  /** Raw search input (updates immediately) */
  searchInput: string;
  /** Debounced search value (drives the server-side `search` param) */
  debouncedSearch: string;
  /** Status filter ('all' or a backend TreatmentPlanStatus) */
  status: TreatmentPlanStatusFilter;
  /** Doctor filter (doctor UUID or 'all') */
  doctorId: string;
  /** Created-after date (`YYYY-MM-DD` or '') */
  dateFrom: string;
  /** Created-before date (`YYYY-MM-DD` or '') */
  dateTo: string;
  /** Active-only filter */
  active: TreatmentPlanActiveFilter;
  /** Current page (1-based) */
  page: number;
  /** Page size */
  pageSize: number;
  /** Sort column */
  sortBy: PlanSortField;
  /** Sort direction */
  sortOrder: SortOrder;
  setSearchInput: (value: string) => void;
  setStatus: (value: TreatmentPlanStatusFilter) => void;
  setDoctorId: (value: string) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setActive: (value: TreatmentPlanActiveFilter) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSortBy: (value: PlanSortField) => void;
  setSortOrder: (value: SortOrder) => void;
  /** True when any filter (besides pagination) is active — used to show Clear. */
  hasActiveFilters: boolean;
  clearFilters: () => void;
  /** Ready-to-send params for GET /treatment-plans. */
  params: PlanListParams;
}

/**
 * Owns the treatment plan list query state. Unlike the appointments filters
 * hook, every filter here is applied SERVER-SIDE — the backend supports
 * search/status/doctor/date/active/sort params natively ([BCR §4.3]).
 */
export function useTreatmentPlanFilters(): TreatmentPlanFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<TreatmentPlanStatusFilter>('all');
  const [doctorId, setDoctorIdState] = useState('');
  const [dateFrom, setDateFromState] = useState('');
  const [dateTo, setDateToState] = useState('');
  const [active, setActiveState] = useState<TreatmentPlanActiveFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(TREATMENT_PLAN_LIST_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<PlanSortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const debouncedSearch = useDebounce(searchInput, 350);

  const resetPage = () => setPage(1);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    resetPage();
  };
  const setStatus = (value: TreatmentPlanStatusFilter) => {
    setStatusState(value);
    resetPage();
  };
  const setDoctorId = (value: string) => {
    setDoctorIdState(value);
    resetPage();
  };
  const setDateFrom = (value: string) => {
    setDateFromState(value);
    resetPage();
  };
  const setDateTo = (value: string) => {
    setDateToState(value);
    resetPage();
  };
  const setActive = (value: TreatmentPlanActiveFilter) => {
    setActiveState(value);
    resetPage();
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    resetPage();
  };
  const setSortByValue = (value: PlanSortField) => {
    setSortBy(value);
    resetPage();
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    status !== 'all' ||
    doctorId !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    active !== 'all';

  const clearFilters = () => {
    setSearchInputState('');
    setStatusState('all');
    setDoctorIdState('');
    setDateFromState('');
    setDateToState('');
    setActiveState('all');
    resetPage();
  };

  const params = useMemo<PlanListParams>(() => {
    const next: PlanListParams = {
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    const search = debouncedSearch.trim();
    if (search) next.search = search;
    if (status !== 'all') next.status = status;
    if (doctorId) next.doctor_id = doctorId;
    if (dateFrom) next.date_from = dateFrom;
    if (dateTo) next.date_to = dateTo;
    if (active === 'active') next.is_active = true;
    if (active === 'inactive') next.is_active = false;
    return next;
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, status, doctorId, dateFrom, dateTo, active]);

  return {
    searchInput,
    debouncedSearch,
    status,
    doctorId,
    dateFrom,
    dateTo,
    active,
    page,
    pageSize,
    sortBy,
    sortOrder,
    setSearchInput,
    setStatus,
    setDoctorId,
    setDateFrom,
    setDateTo,
    setActive,
    setPage,
    setPageSize: changePageSize,
    setSortBy: setSortByValue,
    setSortOrder,
    hasActiveFilters,
    clearFilters,
    params,
  };
}
