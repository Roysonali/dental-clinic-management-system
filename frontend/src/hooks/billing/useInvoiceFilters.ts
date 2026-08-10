import { useMemo, useState } from 'react';
import { useDebounce } from '../useDebounce';
import { INVOICE_LIST_PAGE_SIZE } from '../../constants/billing';
import type {
  InvoiceListParams,
  InvoiceSortField,
  InvoiceStatus,
  SortOrder,
} from '../../types/billing';

export type InvoiceStatusFilter = InvoiceStatus | 'all';

export interface InvoiceFilters {
  /** Raw search input (updates immediately). */
  searchInput: string;
  /** Debounced search value (drives the server-side `query` param). */
  debouncedSearch: string;
  /** Status filter ('all' or a backend InvoiceStatus). */
  status: InvoiceStatusFilter;
  /** Patient filter (patient UUID or ''). */
  patientId: string;
  /** Doctor filter (doctor UUID or ''). */
  doctorId: string;
  /** Invoice-date-on-or-after filter (`YYYY-MM-DD` or ''). */
  dateFrom: string;
  /** Invoice-date-on-or-before filter (`YYYY-MM-DD` or ''). */
  dateTo: string;
  /** Current page (1-based). */
  page: number;
  /** Page size. */
  pageSize: number;
  /** Sort field. */
  sortBy: InvoiceSortField;
  /** Sort direction. */
  sortOrder: SortOrder;
  setSearchInput: (value: string) => void;
  setStatus: (value: InvoiceStatusFilter) => void;
  setPatientId: (value: string) => void;
  setDoctorId: (value: string) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSortBy: (value: InvoiceSortField) => void;
  setSortOrder: (value: SortOrder) => void;
  /** True when any filter (besides pagination) is active — drives Clear + empty copy. */
  hasActiveFilters: boolean;
  clearFilters: () => void;
  /** Ready-to-send params for GET /billing/invoices. */
  params: InvoiceListParams;
}

/**
 * Owns the invoice list query state. Every filter is applied SERVER-SIDE —
 * the backend supports search/status/patient/doctor/date/sort/pagination
 * natively (routers/invoice.py), so no client-side filtering happens.
 * Search is debounced (350ms) to avoid a request per keystroke.
 */
export function useInvoiceFilters(): InvoiceFilters {
  const [searchInput, setSearchInputState] = useState('');
  const [status, setStatusState] = useState<InvoiceStatusFilter>('all');
  const [patientId, setPatientIdState] = useState('');
  const [doctorId, setDoctorIdState] = useState('');
  const [dateFrom, setDateFromState] = useState('');
  const [dateTo, setDateToState] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(INVOICE_LIST_PAGE_SIZE);
  const [sortBy, setSortByState] = useState<InvoiceSortField>('created_at');
  const [sortOrder, setSortOrderState] = useState<SortOrder>('desc');

  const debouncedSearch = useDebounce(searchInput, 350);

  const resetPage = () => setPage(1);

  const setSearchInput = (value: string) => {
    setSearchInputState(value);
    resetPage();
  };
  const setStatus = (value: InvoiceStatusFilter) => {
    setStatusState(value);
    resetPage();
  };
  const setPatientId = (value: string) => {
    setPatientIdState(value);
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
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    resetPage();
  };
  const setSortByValue = (value: InvoiceSortField) => {
    setSortByState(value);
    resetPage();
  };
  const setSortOrderValue = (value: SortOrder) => {
    setSortOrderState(value);
    resetPage();
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    status !== 'all' ||
    patientId !== '' ||
    doctorId !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = () => {
    setSearchInputState('');
    setStatusState('all');
    setPatientIdState('');
    setDoctorIdState('');
    setDateFromState('');
    setDateToState('');
    resetPage();
  };

  const params = useMemo<InvoiceListParams>(() => {
    const next: InvoiceListParams = {
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    const search = debouncedSearch.trim();
    if (search) next.query = search;
    if (status !== 'all') next.status = status;
    if (patientId) next.patient_id = patientId;
    if (doctorId) next.doctor_id = doctorId;
    if (dateFrom) next.date_from = dateFrom;
    if (dateTo) next.date_to = dateTo;
    return next;
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, status, patientId, doctorId, dateFrom, dateTo]);

  return {
    searchInput,
    debouncedSearch,
    status,
    patientId,
    doctorId,
    dateFrom,
    dateTo,
    page,
    pageSize,
    sortBy,
    sortOrder,
    setSearchInput,
    setStatus,
    setPatientId,
    setDoctorId,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
    setSortBy: setSortByValue,
    setSortOrder: setSortOrderValue,
    hasActiveFilters,
    clearFilters,
    params,
  };
}
