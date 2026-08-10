import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import { useBillingDashboard } from './useBillingDashboard';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type { BillingDashboardResponse } from '../../types/billing';

vi.mock('../../services/billingService', () => ({
  billingService: {
    getDashboard: vi.fn(),
  },
}));

const getDashboardMock = vi.mocked(billingService.getDashboard);

const dashboardResponse: BillingDashboardResponse = {
  totals: {
    total_invoiced: '15000.00',
    total_collected: '12000.00',
    total_refunded: '500.00',
    total_outstanding: '3500.00',
    total_credited: '200.00',
    invoice_count: 42,
    paid_invoice_count: 30,
    outstanding_invoice_count: 12,
    payment_count: 35,
    credit_note_count: 5,
  },
  recent_invoices: [],
  recent_payments: [],
  patient_summary: null,
  generated_at: '2026-08-08T10:00:00Z',
};

describe('useBillingDashboard', () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
  });

  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  }

  it('queries the system-wide dashboard when no patient is selected', async () => {
    getDashboardMock.mockResolvedValue(dashboardResponse);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useBillingDashboard(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(dashboardResponse));
    expect(getDashboardMock).toHaveBeenCalledWith(undefined);
    // The dashboard cache key (system-wide = 'all') is the invalidation target.
    expect(queryClient.getQueryData(billingQueryKeys.dashboard())).toEqual(
      dashboardResponse,
    );
  });

  it('passes the patient id filter to the dashboard endpoint', async () => {
    getDashboardMock.mockResolvedValue(dashboardResponse);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useBillingDashboard('p1'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(dashboardResponse));
    expect(getDashboardMock).toHaveBeenCalledWith('p1');
    expect(queryClient.getQueryData(billingQueryKeys.dashboard('p1'))).toEqual(
      dashboardResponse,
    );
  });

  it('keys the cache per patient so switching patients refetches', async () => {
    getDashboardMock.mockResolvedValue(dashboardResponse);
    const queryClient = createTestQueryClient();

    type HookProps = { patientId?: string };
    const initialProps: HookProps = { patientId: undefined };

    const { result, rerender } = renderHook(
      ({ patientId }: HookProps) => useBillingDashboard(patientId),
      {
        wrapper: makeWrapper(queryClient),
        initialProps,
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(dashboardResponse));

    rerender({ patientId: 'p1' });
    await waitFor(() => expect(getDashboardMock).toHaveBeenCalledWith('p1'));

    // Both keys exist in the cache — the 'all' snapshot is preserved.
    expect(queryClient.getQueryData(billingQueryKeys.dashboard())).toBeDefined();
    expect(queryClient.getQueryData(billingQueryKeys.dashboard('p1'))).toBeDefined();
  });

  it('exposes isLoading while the query is pending', () => {
    getDashboardMock.mockReturnValue(new Promise(() => {})); // never resolves
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useBillingDashboard(), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('shares the root invalidation key with the cache contract', () => {
    expect(billingQueryKeys.all).toEqual(['billing']);
  });
});
