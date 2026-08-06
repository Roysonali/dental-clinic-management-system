import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserFilters } from './useUserFilters';

describe('useUserFilters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns neutral default params', () => {
    const { result } = renderHook(() => useUserFilters());

    expect(result.current.params).toEqual({
      page: 1,
      page_size: 10,
      search: undefined,
      status: undefined,
      role_id: undefined,
    });
  });

  it('maps status and role to backend params', () => {
    const { result } = renderHook(() => useUserFilters());

    act(() => {
      result.current.setStatus('pending');
      result.current.setRole(2);
    });

    expect(result.current.params).toMatchObject({
      status: 'pending',
      role_id: 2,
    });
  });

  it('exposes status/role state plus the raw and debounced search inputs', () => {
    const { result } = renderHook(() => useUserFilters());

    act(() => result.current.setStatus('inactive'));

    expect(result.current.status).toBe('inactive');
    expect(result.current.roleId).toBeNull();
    expect(result.current.searchInput).toBe('');
    expect(result.current.debouncedSearch).toBe('');
  });

  it('resets the page to 1 whenever a filter changes', () => {
    const { result } = renderHook(() => useUserFilters());

    act(() => result.current.setPage(4));
    expect(result.current.params.page).toBe(4);

    act(() => result.current.setRole(6));
    expect(result.current.params.page).toBe(1);
    expect(result.current.params.role_id).toBe(6);
  });

  it('changes page size and resets to page 1', () => {
    const { result } = renderHook(() => useUserFilters());

    act(() => result.current.setPage(3));
    act(() => result.current.setPageSize(50));

    expect(result.current.pageSize).toBe(50);
    expect(result.current.params.page_size).toBe(50);
    expect(result.current.params.page).toBe(1);
  });

  it('debounces the search term before exposing it as a param', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useUserFilters());

    act(() => result.current.setSearchInput('rey'));
    expect(result.current.params.search).toBeUndefined();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(result.current.params.search).toBe('rey');
    expect(result.current.params.page).toBe(1);
  });
});
