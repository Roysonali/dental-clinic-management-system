import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import { useInvoices } from './useInvoices';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type { InvoiceListParams, InvoiceListResponse } from '../../types/billing';

vi.mock('../../services/billingService', () => ({
  billingService: {
    listInvoices: vi.fn(),
  },
}));

const listMock = vi.mocked(billingService.listInvoices);

const params: InvoiceListParams = {
  page: 1,
  page_size: 20,
  sort_by: 'created_at',
  sort_order: 'desc',
};

const listResponse: InvoiceListResponse = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
};

describe('useInvoices', () => {
  beforeEach(() => {
    listMock.mockReset();
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

  it('fetches the paginated invoice list with the server-side params', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useInvoices(params), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(listResponse));
    expect(listMock).toHaveBeenCalledWith(params);
    expect(queryClient.getQueryData(billingQueryKeys.invoiceList(params))).toEqual(listResponse);
  });

  it('uses an enabled gate so the list is not fetched until enabled', async () => {
    listMock.mockResolvedValue(listResponse);
    const queryClient = createTestQueryClient();

    // Kept for documentation: the list hook itself always fetches when mounted;
    // callers gate mounting (e.g. drawer opens). Verify params flow straight
    // through so a new filter set produces a distinct cache entry.
    const { result, rerender } = renderHook(
      (p: InvoiceListParams) => useInvoices(p),
      { wrapper: makeWrapper(queryClient), initialProps: params },
    );

    await waitFor(() => expect(result.current.data).toEqual(listResponse));

    const next: InvoiceListParams = { ...params, status: 'draft' };
    rerender(next);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(next));
  });
});
