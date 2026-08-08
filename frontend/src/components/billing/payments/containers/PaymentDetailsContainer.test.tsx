import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { PaymentDetailsContainer } from './PaymentDetailsContainer';
import { billingService } from '../../../../services/billingService';
import type { PaymentRead, ReceiptRead } from '../../../../types/billing';

vi.mock('../../../../services/billingService', () => ({
  billingService: {
    getDashboard: vi.fn(),
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    createInvoice: vi.fn(),
    listPayments: vi.fn(),
    getPayment: vi.fn(),
    createPayment: vi.fn(),
    updatePayment: vi.fn(),
    deletePayment: vi.fn(),
    completePayment: vi.fn(),
    failPayment: vi.fn(),
    voidPayment: vi.fn(),
    allocatePayment: vi.fn(),
    deallocatePayment: vi.fn(),
    getPaymentAllocations: vi.fn(),
    generateReceipt: vi.fn(),
  },
}));

const getPaymentMock = vi.mocked(billingService.getPayment);
const completeMock = vi.mocked(billingService.completePayment);
const deallocateMock = vi.mocked(billingService.deallocatePayment);
const generateReceiptMock = vi.mocked(billingService.generateReceipt);

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

function httpError(status: number, message: string): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data: { success: false, message },
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  );
}

const patient = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const basePayment: PaymentRead = {
  id: 'pay1',
  payment_number: 'PAY-00001',
  document_type: 'payment',
  status: 'pending',
  patient,
  creator: { id: 1, full_name: 'Admin' },
  updater: null,
  payment_method: 'card',
  total_amount: '1500.00',
  payment_date: '2026-07-23',
  currency_code: 'INR',
  reference_number: 'TXN-123',
  is_reversed: false,
  reversal_reason: null,
  notes: 'Paid via online gateway.',
  allocations: [],
  financials: {
    currency_code: 'INR',
    total_amount: '1500.00',
    allocated_amount: '0.00',
    refunded_amount: '0.00',
    unallocated_amount: '1500.00',
  },
  gateway_metadata: null,
  version: 1,
  doc_version: 1,
  created_at: '2026-07-23T09:22:00Z',
  updated_at: '2026-07-23T09:22:00Z',
  created_by: 1,
  updated_by: null,
};

const allocation = {
  id: 'alloc1',
  invoice: {
    id: 'inv1',
    invoice_number: 'INV-01039',
    patient,
    invoice_date: '2026-07-20',
    currency_code: 'INR',
    grand_total: '3120.75',
  },
  allocated_amount: '1000.00',
  is_refund: false,
  created_at: '2026-07-23T14:16:00Z',
};

const completedWithAllocation: PaymentRead = {
  ...basePayment,
  status: 'completed',
  allocations: [allocation],
  financials: {
    ...basePayment.financials,
    allocated_amount: '1000.00',
    unallocated_amount: '500.00',
  },
};

const receipt: ReceiptRead = {
  id: 'rct1',
  receipt_number: 'RCT-00001',
  status: 'generated',
  amount: '1500.00',
  currency_code: 'INR',
  receipt_date: '2026-07-23',
  payment: {
    id: 'pay1',
    payment_number: 'PAY-00001',
    payment_method: 'card',
    total_amount: '1500.00',
    payment_date: '2026-07-23',
    currency_code: 'INR',
  },
  created_at: '2026-07-23T14:20:00Z',
};

function renderDetail(paymentId = 'pay1', queryClient?: QueryClient) {
  return renderWithProviders(<PaymentDetailsContainer paymentId={paymentId} />, {
    route: '/billing/payments/pay1',
    queryClient,
  });
}

describe('PaymentDetailsContainer', () => {
  beforeEach(() => {
    getPaymentMock.mockReset();
    completeMock.mockReset();
    deallocateMock.mockReset();
    generateReceiptMock.mockReset();
    getPaymentMock.mockResolvedValue(basePayment);
  });

  it('renders the full payment aggregate with overview, financial and record data', async () => {
    renderDetail();

    expect(await screen.findByText('PAY-00001')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('PAT-000001')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Paid via online gateway.')).toBeInTheDocument();
    expect(screen.getByText(/Recorded by Admin/)).toBeInTheDocument();
  });

  it('shows the two-column detail layout with right-side cards', async () => {
    renderDetail();

    await screen.findByText('PAY-00001');
    expect(screen.getByText('Financial Summary')).toBeInTheDocument();
    expect(screen.getByText('Allocations')).toBeInTheDocument();
    expect(screen.getByText('Receipt')).toBeInTheDocument();
    expect(screen.getByText('Record')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('exposes state-machine actions for a Pending payment', async () => {
    renderDetail();

    await screen.findByText('PAY-00001');
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as failed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void' })).toBeInTheDocument();
    // Allocate is hidden for a Pending payment (backend requires COMPLETED).
    expect(screen.queryByRole('button', { name: 'Allocate' })).not.toBeInTheDocument();
  });

  it('exposes Allocate + Generate receipt for a Completed payment and completes the flow', async () => {
    getPaymentMock.mockResolvedValue(completedWithAllocation);
    renderDetail();

    await screen.findByText('PAY-00001');
    // Allocate appears in both the header actions and the Allocations card.
    expect(screen.getAllByRole('button', { name: 'Allocate' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Generate receipt' })).toBeInTheDocument();
    // The allocation row renders with its type badge and remove action. The
    // amount also appears in the Financial Summary's Allocated row.
    expect(screen.getByText('INV-01039')).toBeInTheDocument();
    expect(screen.getAllByText('₹1,000.00').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Remove allocation to INV-01039' })).toBeInTheDocument();
  });

  it('completes the payment through the complete dialog', async () => {
    completeMock.mockResolvedValue({ ...basePayment, status: 'completed' } as never);
    renderDetail();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Complete payment' });
    expect(within(dialog).getByText('Complete this payment?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete payment' }));

    await waitFor(() => expect(completeMock).toHaveBeenCalledWith('pay1'));
  });

  it('removes an allocation through the deallocate dialog', async () => {
    getPaymentMock.mockResolvedValue(completedWithAllocation);
    deallocateMock.mockResolvedValue(undefined as never);
    renderDetail();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Remove allocation to INV-01039' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove allocation' });
    expect(within(dialog).getByText('Remove this allocation?')).toBeInTheDocument();
    // New unallocated balance = 500 + 1000.
    expect(within(dialog).getByText('₹1,500.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove allocation' }));

    await waitFor(() =>
      expect(deallocateMock).toHaveBeenCalledWith('pay1', { invoice_id: 'inv1' }),
    );
  });

  it('generates a receipt and surfaces it in the Receipt card', async () => {
    getPaymentMock.mockResolvedValue(completedWithAllocation);
    generateReceiptMock.mockResolvedValue(receipt as never);
    renderDetail();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Generate receipt' }));

    await waitFor(() => expect(generateReceiptMock).toHaveBeenCalledWith({ payment_id: 'pay1' }));
    // The generated ReceiptRead is read back from the query cache.
    expect(await screen.findByText('RCT-00001')).toBeInTheDocument();
    expect(screen.getByText('Generated')).toBeInTheDocument();
  });

  it('renders the permission-denied state on 403 and never retries', async () => {
    getPaymentMock.mockRejectedValue(httpError(403, 'Insufficient permissions'));

    renderDetail();

    expect(await screen.findByText("You don't have permission")).toBeInTheDocument();
    expect(screen.getByText('Error 403 · Insufficient permissions')).toBeInTheDocument();
    expect(getPaymentMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('renders the error state with a working retry on a 500', async () => {
    getPaymentMock.mockRejectedValue(httpError(500, 'boom'));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
          staleTime: Infinity,
          retryDelay: 0,
        },
      },
    });
    renderDetail('pay1', queryClient);

    expect(await screen.findByText("Couldn't load this payment")).toBeInTheDocument();

    getPaymentMock.mockClear();
    getPaymentMock.mockResolvedValue(basePayment);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('PAY-00001')).toBeInTheDocument();
  });
});
