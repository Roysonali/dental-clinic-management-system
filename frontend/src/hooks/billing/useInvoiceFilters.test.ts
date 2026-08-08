import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useInvoiceFilters } from './useInvoiceFilters';

describe('useInvoiceFilters', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('defaults to page 1, page_size 20, created_at desc', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    expect(result.current.params).toEqual({
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  });

  it('maps the status filter to the backend param (drops "all")', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setStatus('draft'));
    expect(result.current.params.status).toBe('draft');
    act(() => result.current.setStatus('all'));
    expect(result.current.params.status).toBeUndefined();
  });

  it('passes patient and doctor filters through verbatim', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setPatientId('p1'));
    act(() => result.current.setDoctorId('doc-1'));
    expect(result.current.params.patient_id).toBe('p1');
    expect(result.current.params.doctor_id).toBe('doc-1');
  });

  it('passes date-range filters through verbatim (YYYY-MM-DD)', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setDateFrom('2026-07-01'));
    act(() => result.current.setDateTo('2026-07-31'));
    expect(result.current.params.date_from).toBe('2026-07-01');
    expect(result.current.params.date_to).toBe('2026-07-31');
  });

  it('debounces the search input into params.query (350 ms)', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setSearchInput('INV'));
    expect(result.current.params.query).toBeUndefined();
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.debouncedSearch).toBe('INV');
    expect(result.current.params.query).toBe('INV');
  });

  it('trims search whitespace before sending', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setSearchInput('  INV-001  '));
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.params.query).toBe('INV-001');
  });

  it('resets the page to 1 whenever a filter changes', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.setStatus('issued'));
    expect(result.current.page).toBe(1);
  });

  it('passes page_size and sort params through (resetting the page)', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    act(() => result.current.setPageSize(50));
    expect(result.current.params.page_size).toBe(50);
    expect(result.current.page).toBe(1);
    act(() => result.current.setSortBy('grand_total'));
    expect(result.current.params.sort_by).toBe('grand_total');
    act(() => result.current.setSortOrder('asc'));
    expect(result.current.params.sort_order).toBe('asc');
  });

  it('reports hasActiveFilters and clears everything back to defaults', () => {
    const { result } = renderHook(() => useInvoiceFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.setStatus('issued'));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.setPatientId('p1'));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.status).toBe('all');
    expect(result.current.searchInput).toBe('');
    expect(result.current.patientId).toBe('');
    expect(result.current.page).toBe(1);
  });
});
