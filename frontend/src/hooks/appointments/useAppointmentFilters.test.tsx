import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAppointmentFilters } from './useAppointmentFilters';

describe('useAppointmentFilters', () => {
  it('defaults to page 1, page size 20 and no filters', () => {
    const { result } = renderHook(() => useAppointmentFilters());

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.status).toBe('all');
    expect(result.current.searchInput).toBe('');
    expect(result.current.params).toEqual({ skip: 0, limit: 20 });
  });

  it('computes skip/limit from page and page size', () => {
    const { result } = renderHook(() => useAppointmentFilters());

    act(() => result.current.setPageSize(50));
    act(() => result.current.setPage(3));

    expect(result.current.params).toEqual({ skip: 100, limit: 50 });
  });

  it('resets to page 1 when the search input changes', () => {
    const { result } = renderHook(() => useAppointmentFilters());

    act(() => result.current.setPage(3));
    act(() => result.current.setSearchInput('juan'));

    expect(result.current.page).toBe(1);
    expect(result.current.searchInput).toBe('juan');
  });

  it('resets to page 1 when the status filter changes', () => {
    const { result } = renderHook(() => useAppointmentFilters());

    act(() => result.current.setPage(2));
    act(() => result.current.setStatus('Confirmed'));

    expect(result.current.page).toBe(1);
    expect(result.current.status).toBe('Confirmed');
  });

  it('resets to page 1 when the page size changes', () => {
    const { result } = renderHook(() => useAppointmentFilters());

    act(() => result.current.setPage(4));
    act(() => result.current.setPageSize(50));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
  });

  it('debounces the search value before exposing it', async () => {
    const { result } = renderHook(() => useAppointmentFilters());

    act(() => result.current.setSearchInput('juan'));
    expect(result.current.debouncedSearch).toBe('');

    await waitFor(() => expect(result.current.debouncedSearch).toBe('juan'));
  });
});
