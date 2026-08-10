import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import { useInvoice } from './useInvoice';
import { billingService } from '../../services/billingService';
import { billingQueryKeys } from './billingQueryKeys';
import type { InvoiceRead } from '../../types/billing';

vi.mock('../../services/billingService', () => ({
  billingService: {
    getInvoice: vi.fn(),
  },
}));

const getMock = vi.mocked(billingService.getInvoice);

const invoice: InvoiceRead = {
  id: 'inv1',
  invoice_number: 'INV-00001',
  document_type: 'invoice',
  status: 'issued',
  patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
  doctor: null,
  treatment_plan: null,
  appointment: null,
  creator: { id: 1, full_name: 'Admin' },
  updater: null,
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  currency_code: 'USD',
  notes: null,
  cancellation_reason: null,
  void_reason: null,
  items: [],
  financials: {
    currency_code: 'USD',
    subtotal: '3000.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '3000.00',
    paid_amount: '0.00',
    outstanding_amount: '3000.00',
  },
  version: 1,
  doc_version: 1,
  created_at: '2026-07-23T08:00:00Z',
  updated_at: '2026-07-23T08:00:00Z',
  created_by: 1,
  updated_by: null,
};

describe('useInvoice', () => {
  beforeEach(() => {
    getMock.mockReset();
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

  it('fetches the invoice aggregate for the given id', async () => {
    getMock.mockResolvedValue(invoice);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useInvoice('inv1'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(invoice));
    expect(getMock).toHaveBeenCalledWith('inv1');
    expect(queryClient.getQueryData(billingQueryKeys.invoiceDetail('inv1'))).toEqual(invoice);
  });

  it('stays disabled until enabled (lazy prefill fetch)', async () => {
    getMock.mockResolvedValue(invoice);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useInvoice('inv1', { enabled: false }), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('surfaces a 403 as an error for the permission state', async () => {
    getMock.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useInvoice('inv1'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
