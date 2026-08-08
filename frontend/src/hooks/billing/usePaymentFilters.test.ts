import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePaymentFilters } from './usePaymentFilters';

describe('usePaymentFilters', () => {
  it('starts with the backend defaults (page 1, 20 rows, created_at desc)', () => {
    const { result } = renderHook(() => usePaymentFilters());

    expect(result.current.params).toEqual({
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('encodes every server-side filter into params and resets the page', () => {
    const { result } = renderHook(() => usePaymentFilters());

    act(() => result.current.setPage(3));
    act(() => result.current.setPatientId('p1'));
    act(() => result.current.setMethod('card'));
    act(() => result.current.setStatus('completed'));
    act(() => result.current.setDateFrom('2026-07-01'));
    act(() => result.current.setDateTo('2026-07-31'));

    expect(result.current.params).toEqual({
      page: 1, // reset by each filter change
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
      patient_id: 'p1',
      payment_method: 'card',
      status: 'completed',
      date_from: '2026-07-01',
      date_to: '2026-07-31',
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("keeps 'all' filters out of the request params", () => {
    const { result } = renderHook(() => usePaymentFilters());

    act(() => result.current.setMethod('all'));
    act(() => result.current.setStatus('all'));

    expect(result.current.params).not.toHaveProperty('payment_method');
    expect(result.current.params).not.toHaveProperty('status');
  });

  it('clearFilters resets filters to defaults', () => {
    const { result } = renderHook(() => usePaymentFilters());

    act(() => result.current.setPatientId('p1'));
    act(() => result.current.setStatus('failed'));
    act(() => result.current.clearFilters());

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.params).toEqual({
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  });

  it('propagates sort changes without losing filters', () => {
    const { result } = renderHook(() => usePaymentFilters());

    act(() => result.current.setSortBy('total_amount'));
    act(() => result.current.setSortOrder('asc'));

    expect(result.current.params.sort_by).toBe('total_amount');
    expect(result.current.params.sort_order).toBe('asc');
  });
});
