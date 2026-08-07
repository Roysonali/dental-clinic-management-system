import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTreatmentPlanFilters } from './useTreatmentPlanFilters';

describe('useTreatmentPlanFilters', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('defaults to page 1, page_size 20, created_at desc', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    expect(result.current.params).toEqual({
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  });

  it('maps the status filter to the backend param (drops "all")', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setStatus('draft'));
    expect(result.current.params.status).toBe('draft');
    act(() => result.current.setStatus('all'));
    expect(result.current.params.status).toBeUndefined();
  });

  it('maps the active filter to is_active and drops "all"', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setActive('active'));
    expect(result.current.params.is_active).toBe(true);
    act(() => result.current.setActive('inactive'));
    expect(result.current.params.is_active).toBe(false);
    act(() => result.current.setActive('all'));
    expect(result.current.params.is_active).toBeUndefined();
  });

  it('passes doctor + date filters through verbatim (O6: YYYY-MM-DD only)', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setDoctorId('doc-1'));
    act(() => result.current.setDateFrom('2026-01-01'));
    act(() => result.current.setDateTo('2026-12-31'));
    expect(result.current.params.doctor_id).toBe('doc-1');
    expect(result.current.params.date_from).toBe('2026-01-01');
    expect(result.current.params.date_to).toBe('2026-12-31');
  });

  it('debounces the search input into params.search (350 ms)', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setSearchInput('TXN'));
    expect(result.current.params.search).toBeUndefined();
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.debouncedSearch).toBe('TXN');
    expect(result.current.params.search).toBe('TXN');
  });

  it('trims search whitespace before sending', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setSearchInput('  TXN-001  '));
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.params.search).toBe('TXN-001');
  });

  it('resets page to 1 whenever a filter changes', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.setStatus('proposed'));
    expect(result.current.page).toBe(1);
  });

  it('passes page_size and sort params through (resetting the page)', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    act(() => result.current.setPageSize(50));
    expect(result.current.params.page_size).toBe(50);
    expect(result.current.page).toBe(1);
    act(() => result.current.setSortBy('plan_code'));
    expect(result.current.params.sort_by).toBe('plan_code');
    act(() => result.current.setSortOrder('asc'));
    expect(result.current.params.sort_order).toBe('asc');
  });

  it('reports hasActiveFilters and clears everything back to defaults', () => {
    const { result } = renderHook(() => useTreatmentPlanFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.setStatus('draft'));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.status).toBe('all');
    expect(result.current.searchInput).toBe('');
    expect(result.current.doctorId).toBe('');
    expect(result.current.page).toBe(1);
  });
});
