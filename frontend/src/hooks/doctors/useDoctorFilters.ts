import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import {
  DOCTOR_LIST_PAGE_SIZE,
  DOCTOR_SEARCH_DEBOUNCE_MS,
} from '../../constants/doctor';
import type {
  DoctorAvailabilityFilter,
  DoctorListParams,
  DoctorStatusFilter,
} from '../../types/doctor';

export interface DoctorFilters {
  /** Raw search input (updates immediately) */
  searchInput: string;
  /** Debounced search value (drives the API query) */
  debouncedSearch: string;
  /** Active/inactive/all filter */
  status: DoctorStatusFilter;
  /** Available/unavailable/all filter */
  availability: DoctorAvailabilityFilter;
  /** Specialization filter (null = all) */
  specializationId: number | null;
  /** Current page (1-based) */
  page: number;
  /** Page size (matches backend default) */
  pageSize: number;
  /** Update search input (resets to page 1) */
  setSearchInput: (value: string) => void;
  /** Update status filter (resets to page 1) */
  setStatus: (value: DoctorStatusFilter) => void;
  /** Update availability filter (resets to page 1) */
  setAvailability: (value: DoctorAvailabilityFilter) => void;
  /** Update specialization filter (resets to page 1) */
  setSpecialization: (value: number | null) => void;
  /** Change page */
  setPage: (page: number) => void;
  /** Change page size (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Ready-to-send query params for GET /doctors */
  params: DoctorListParams;
}

/**
 * Owns the doctor list query state: debounced search, status/availability/
 * specialization filters and pagination. Page resets happen at the event
 * handlers (not in effects), keeping render/effect cycles side-effect free.
 */
export function useDoctorFilters(): DoctorFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<DoctorStatusFilter>('all');
  const [availability, setAvailabilityState] = useState<DoctorAvailabilityFilter>('all');
  const [specializationId, setSpecializationState] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DOCTOR_LIST_PAGE_SIZE);

  const debouncedSearch = useDebounce(searchInput, DOCTOR_SEARCH_DEBOUNCE_MS);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    setPage(1);
  };

  const setStatus = (value: DoctorStatusFilter) => {
    setStatusState(value);
    setPage(1);
  };

  const setAvailability = (value: DoctorAvailabilityFilter) => {
    setAvailabilityState(value);
    setPage(1);
  };

  const setSpecialization = (value: number | null) => {
    setSpecializationState(value);
    setPage(1);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const params = useMemo<DoctorListParams>(
    () => ({
      page,
      page_size: pageSize,
      search: debouncedSearch.trim() || undefined,
      is_active: status === 'all' ? undefined : status === 'active',
      is_available: availability === 'all' ? undefined : availability === 'available',
      specialization_id: specializationId ?? undefined,
      sort_by: 'full_name',
      sort_order: 'asc',
    }),
    [page, pageSize, debouncedSearch, status, availability, specializationId],
  );

  return {
    searchInput,
    debouncedSearch,
    status,
    availability,
    specializationId,
    page,
    pageSize,
    setSearchInput,
    setStatus,
    setAvailability,
    setSpecialization,
    setPage,
    setPageSize: changePageSize,
    params,
  };
}
