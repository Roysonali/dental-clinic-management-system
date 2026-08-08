import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../../test/testUtils';
import {
  useCreateInvoice,
  useUpdateDraftInvoice,
  useIssueInvoice,
  useCancelInvoice,
  useDeleteInvoice,
} from './useInvoiceMutations';
import { billingService } from '../../services/billingService';
import type { InvoiceRead } from '../../types/billing';

vi.mock('../../services/billingService', () => ({
  billingService: {
    createInvoice: vi.fn(),
    updateDraftInvoice: vi.fn(),
    issueInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
  },
}));

const createMock = vi.mocked(billingService.createInvoice);
const updateMock = vi.mocked(billingService.updateDraftInvoice);
const issueMock = vi.mocked(billingService.issueInvoice);
const cancelMock = vi.mocked(billingService.cancelInvoice);
const deleteMock = vi.mocked(billingService.deleteInvoice);

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

describe('invoice mutation hooks', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    issueMock.mockReset();
    cancelMock.mockReset();
    deleteMock.mockReset();
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

  it('useCreateInvoice calls the service with the payload and invalidates the billing root', async () => {
    createMock.mockResolvedValue(invoice);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['billing', 'dashboard'], { stale: true });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateInvoice(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      patient_id: 'p1',
      invoice_date: '2026-07-23',
      due_date: '2026-08-22',
      currency_code: 'USD',
      items: [],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createMock).toHaveBeenCalledWith({
      patient_id: 'p1',
      invoice_date: '2026-07-23',
      due_date: '2026-08-22',
      currency_code: 'USD',
      items: [],
    });
    // Shared Billing root invalidation — list + dashboard refetch together.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['billing'] });
  });

  it('useUpdateDraftInvoice calls the service with id + payload', async () => {
    updateMock.mockResolvedValue({ ...invoice, status: 'draft' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useUpdateDraftInvoice(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({ id: 'inv1', payload: { notes: 'x', due_date: '2026-08-30' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMock).toHaveBeenCalledWith('inv1', { notes: 'x', due_date: '2026-08-30' });
  });

  it('useIssueInvoice calls the service with the id', async () => {
    issueMock.mockResolvedValue({ ...invoice, invoice_number: 'INV-01042' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useIssueInvoice(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate('inv1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(issueMock).toHaveBeenCalledWith('inv1');
  });

  it('useCancelInvoice calls the service with id + cancellation reason', async () => {
    cancelMock.mockResolvedValue({ ...invoice, status: 'cancelled' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCancelInvoice(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({ id: 'inv1', payload: { cancellation_reason: 'Duplicate' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelMock).toHaveBeenCalledWith('inv1', { cancellation_reason: 'Duplicate' });
  });

  it('useDeleteInvoice calls the service with the id and removes the detail cache entry', async () => {
    deleteMock.mockResolvedValue(undefined);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(['billing', 'invoices', 'detail', 'inv1'], invoice);
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useDeleteInvoice(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate('inv1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteMock).toHaveBeenCalledWith('inv1');
    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: ['billing', 'invoices', 'detail', 'inv1'],
    });
  });

  it('propagates mutation errors for the caller to parse', async () => {
    createMock.mockRejectedValue(new Error('boom'));
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCreateInvoice(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      patient_id: 'p1',
      invoice_date: '2026-07-23',
      due_date: '2026-08-22',
      currency_code: 'USD',
      items: [],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('boom');
  });
});
