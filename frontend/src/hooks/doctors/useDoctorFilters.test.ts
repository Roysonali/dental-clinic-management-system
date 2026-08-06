import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDoctorFilters } from './useDoctorFilters';

describe('useDoctorFilters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns neutral default params', () => {
    const { result } = renderHook(() => useDoctorFilters());

    expect(result.current.params).toEqual({
      page: 1,
      page_size: 20,
      search: undefined,
      is_active: undefined,
      is_available: undefined,
      specialization_id: undefined,
      sort_by: 'full_name',
      sort_order: 'asc',
    });
  });

  it('maps status, availability and specialization to backend params', () => {
    const { result } = renderHook(() => useDoctorFilters());

    act(() => {
      result.current.setStatus('active');
      result.current.setAvailability('unavailable');
      result.current.setSpecialization(2);
    });

    expect(result.current.params).toMatchObject({
      is_active: true,
      is_available: false,
      specialization_id: 2,
    });
  });

  it('resets the page to 1 whenever a filter changes', () => {
    const { result } = renderHook(() => useDoctorFilters());

    act(() => result.current.setPage(4));
    expect(result.current.params.page).toBe(4);

    act(() => result.current.setStatus('inactive'));
    expect(result.current.params.page).toBe(1);
    expect(result.current.params.is_active).toBe(false);
  });

  it('changes page size and resets to page 1', () => {
    const { result } = renderHook(() => useDoctorFilters());

    act(() => result.current.setPage(3));
    act(() => result.current.setPageSize(50));

    expect(result.current.pageSize).toBe(50);
    expect(result.current.params.page_size).toBe(50);
    expect(result.current.params.page).toBe(1);
  });

  it('debounces the search term before exposing it as a param', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDoctorFilters());

    act(() => result.current.setSearchInput('dr'));
    expect(result.current.params.search).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(result.current.params.search).toBe('dr');
    expect(result.current.params.page).toBe(1);
  });
});
