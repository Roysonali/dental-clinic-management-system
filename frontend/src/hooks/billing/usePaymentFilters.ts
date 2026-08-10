import { useMemo, useState } from 'react';
import { PAYMENT_LIST_PAGE_SIZE } from '../../constants/billing';
import type {
  PaymentListParams,
  PaymentMethod,
  PaymentSortField,
  PaymentStatus,
  SortOrder,
} from '../../types/billing';

export type PaymentStatusFilter = PaymentStatus | 'all';
export type PaymentMethodFilter = PaymentMethod | 'all';

export interface PaymentFilters {
  /** Patient filter (patient UUID or ''). */
  patientId: string;
  /** Payment-method filter ('all' or a backend PaymentMethod). */
  method: PaymentMethodFilter;
  /** Status filter ('all' or a backend PaymentStatus). */
  status: PaymentStatusFilter;
  /** Payment-date-on-or-after filter (`YYYY-MM-DD` or ''). */
  dateFrom: string;
  /** Payment-date-on-or-before filter (`YYYY-MM-DD` or ''). */
  dateTo: string;
  /** Current page (1-based). */
  page: number;
  /** Page size. */
  pageSize: number;
  /** Sort field. */
  sortBy: PaymentSortField;
  /** Sort direction. */
  sortOrder: SortOrder;
  setPatientId: (value: string) => void;
  setMethod: (value: PaymentMethodFilter) => void;
  setStatus: (value: PaymentStatusFilter) => void;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSortBy: (value: PaymentSortField) => void;
  setSortOrder: (value: SortOrder) => void;
  /** True when any filter (besides pagination/sorting) is active. */
  hasActiveFilters: boolean;
  clearFilters: () => void;
  /** Ready-to-send params for GET /billing/payments. */
  params: PaymentListParams;
}

/**
 * Owns the payment list query state. Every filter is applied SERVER-SIDE —
 * the backend supports patient/method/status/date/sort/pagination natively
 * (routers/payment.py), so no client-side filtering happens.
 */
export function usePaymentFilters(): PaymentFilters {
  const [patientId, setPatientIdState] = useState('');
  const [method, setMethodState] = useState<PaymentMethodFilter>('all');
  const [status, setStatusState] = useState<PaymentStatusFilter>('all');
  const [dateFrom, setDateFromState] = useState('');
  const [dateTo, setDateToState] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(PAYMENT_LIST_PAGE_SIZE);
  const [sortBy, setSortByState] = useState<PaymentSortField>('created_at');
  const [sortOrder, setSortOrderState] = useState<SortOrder>('desc');

  // NOTE: the backend list endpoint has no free-text search query param, so
  // there is deliberately no search input on the payments toolbar.

  const resetPage = () => setPage(1);

  const setPatientId = (value: string) => {
    setPatientIdState(value);
    resetPage();
  };
  const setMethod = (value: PaymentMethodFilter) => {
    setMethodState(value);
    resetPage();
  };
  const setStatus = (value: PaymentStatusFilter) => {
    setStatusState(value);
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
  const setSortByValue = (value: PaymentSortField) => {
    setSortByState(value);
    resetPage();
  };
  const setSortOrderValue = (value: SortOrder) => {
    setSortOrderState(value);
    resetPage();
  };

  const hasActiveFilters =
    patientId !== '' ||
    method !== 'all' ||
    status !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = () => {
    setPatientIdState('');
    setMethodState('all');
    setStatusState('all');
    setDateFromState('');
    setDateToState('');
    resetPage();
  };

  const params = useMemo<PaymentListParams>(() => {
    const next: PaymentListParams = {
      page,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    if (patientId) next.patient_id = patientId;
    if (method !== 'all') next.payment_method = method;
    if (status !== 'all') next.status = status;
    if (dateFrom) next.date_from = dateFrom;
    if (dateTo) next.date_to = dateTo;
    return next;
  }, [page, pageSize, sortBy, sortOrder, patientId, method, status, dateFrom, dateTo]);

  return {
    patientId,
    method,
    status,
    dateFrom,
    dateTo,
    page,
    pageSize,
    sortBy,
    sortOrder,
    setPatientId,
    setMethod,
    setStatus,
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
