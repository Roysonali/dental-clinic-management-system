import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../../test/testUtils';
import { PaymentListContainer } from './PaymentListContainer';
import { billingService } from '../../../../services/billingService';
import { patientService } from '../../../../services/patientService';
import type {
  InvoiceListItem,
  PaymentListItem,
  PaymentListResponse,
} from '../../../../types/billing';
import type { PatientListItem } from '../../../../types/patient';

// The Delete row action is ADMIN-gated via PermissionGate (backend
// `_PAYMENT_DELETE_ROLES`) — resolve the role probe as a proven admin so the
// action renders in tests that exercise it.
const permissionMock = {
  state: { status: 'admin' as const, role: { role_name: 'ADMIN', id: 1, label: 'Administrator' } },
  isAdmin: true,
  isResolved: true,
  role: 'ADMIN' as const,
  can: () => true,
};

vi.mock('../../../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock,
}));

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
    generateReceipt: vi.fn(),
  },
}));

vi.mock('../../../../services/patientService', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const listMock = vi.mocked(billingService.listPayments);
const listInvoicesMock = vi.mocked(billingService.listInvoices);
const createMock = vi.mocked(billingService.createPayment);
const completeMock = vi.mocked(billingService.completePayment);
const failMock = vi.mocked(billingService.failPayment);
const voidMock = vi.mocked(billingService.voidPayment);
const allocateMock = vi.mocked(billingService.allocatePayment);
const deleteMock = vi.mocked(billingService.deletePayment);
const patientListMock = vi.mocked(patientService.list);

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

const patient: PatientListItem = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  age: 34,
  gender: 'male',
  primary_contact_number: '+1-555-0100',
  is_active: true,
};

const payment: PaymentListItem = {
  id: 'pay1',
  payment_number: 'PAY-00001',
  status: 'pending',
  patient,
  payment_method: 'card',
  total_amount: '1500.00',
  payment_date: '2026-07-23',
  financials: {
    currency_code: 'INR',
    total_amount: '1500.00',
    allocated_amount: '0.00',
    refunded_amount: '0.00',
    unallocated_amount: '1500.00',
  },
  allocation_count: 0,
  created_at: '2026-07-23T09:22:00Z',
};

const completedPayment: PaymentListItem = {
  ...payment,
  id: 'pay2',
  payment_number: 'PAY-00002',
  status: 'completed',
  financials: { ...payment.financials, unallocated_amount: '300.00' },
  allocation_count: 1,
};

const listResponse: PaymentListResponse = {
  items: [payment],
  total: 1,
  page: 1,
  page_size: 20,
};

/** A payable invoice row for the allocate dialog (issued, outstanding > 0). */
const payableInvoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'INV-01039',
  status: 'partially_paid',
  patient,
  doctor: null,
  invoice_date: '2026-07-20',
  due_date: '2026-08-19',
  financials: {
    currency_code: 'INR',
    subtotal: '3120.75',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '3120.75',
    paid_amount: '1000.00',
    outstanding_amount: '2120.75',
  },
  item_count: 2,
  created_at: '2026-07-20T08:00:00Z',
};

function renderList(
  route = '/billing/payments',
  queryClient?: QueryClient,
  createOpen = false,
) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/billing/payments"
        element={
          <PaymentListContainer
            createOpen={createOpen}
            onCreateClose={() => undefined}
            onRequestCreate={() => undefined}
          />
        }
      />
      <Route path="/billing/payments/:paymentId" element={<div>Payment details page</div>} />
    </Routes>,
    { route, queryClient },
  );
}

describe('PaymentListContainer', () => {
  beforeEach(() => {
    listMock.mockReset();
    listInvoicesMock.mockReset();
    createMock.mockReset();
    completeMock.mockReset();
    failMock.mockReset();
    voidMock.mockReset();
    allocateMock.mockReset();
    deleteMock.mockReset();
    patientListMock.mockReset();

    listMock.mockResolvedValue(listResponse);
    patientListMock.mockResolvedValue({
      items: [patient],
      total: 1,
      page: 1,
      page_size: 10,
    });
  });

  it('renders the payment list fetched from the backend with server-side params', async () => {
    renderList();

    expect(await screen.findByText('PAY-00001')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    // Total Amount AND Unallocated both read ₹1,500.00 for an unallocated payment.
    expect(screen.getAllByText('₹1,500.00').length).toBeGreaterThan(0);
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 20, sort_by: 'created_at', sort_order: 'desc' }),
    );
  });

  it('distinguishes the unfiltered empty state from the filtered-empty state', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });

    renderList();
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
    expect(screen.getByText('Record your first payment to start tracking clinic receipts.')).toBeInTheDocument();
    expect(screen.queryByText('No payments match these filters')).not.toBeInTheDocument();
  });

  it('navigates to the payment detail on row click', async () => {
    renderList();
    await screen.findByText('PAY-00001');

    fireEvent.click(screen.getByText('PAY-00001'));
    expect(await screen.findByText('Payment details page')).toBeInTheDocument();
  });

  it('renders the permission-denied state on 403 and never retries', async () => {
    listMock.mockRejectedValue(httpError(403, 'Insufficient permissions'));

    renderList();

    expect(await screen.findByText("You don't have permission")).toBeInTheDocument();
    expect(screen.getByText('Error 403 · Insufficient permissions')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('renders the error state with a working retry on a 500', async () => {
    listMock.mockRejectedValue(httpError(500, 'boom'));

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
    renderList('/billing/payments', queryClient);

    expect(await screen.findByText('Failed to load data')).toBeInTheDocument();

    listMock.mockClear();
    listMock.mockResolvedValue(listResponse);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('PAY-00001')).toBeInTheDocument();
  });

  it('creates a payment through the Record payment drawer', async () => {
    createMock.mockResolvedValue({
      ...payment,
      id: 'new-pay',
      payment_number: 'PAY-00002',
    } as never);
    renderList('/billing/payments', undefined, true);

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' });

    fireEvent.change(within(dialog).getByPlaceholderText('Search patient by name or code…'), {
      target: { value: 'marcus' },
    });
    // The PatientPicker search is debounced; under full-suite parallel load the
    // option can take longer than the default 1s find timeout (load-flaky).
    const option = await screen.findByRole('option', { name: /Marcus Delaney/ }, { timeout: 5000 });
    fireEvent.click(option);

    fireEvent.change(within(dialog).getByLabelText(/Payment Method/), {
      target: { value: 'card' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Total Amount/), {
      target: { value: '1500' },
    });

    const save = within(dialog).getByRole('button', { name: 'Save payment' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ patient_id: 'p1', payment_method: 'card', total_amount: '1500.00' }),
    );
    // The create flow navigates to the new payment's detail page.
    expect(await screen.findByText('Payment details page')).toBeInTheDocument();
  });

  it('completes a pending payment through the complete dialog', async () => {
    completeMock.mockResolvedValue({ ...payment, status: 'completed' } as never);
    renderList();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Complete payment PAY-00001' }));

    const dialog = await screen.findByRole('dialog', { name: 'Complete payment' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete payment' }));

    await waitFor(() => expect(completeMock).toHaveBeenCalledWith('pay1'));
  });

  it('fails a pending payment with an optional reason', async () => {
    failMock.mockResolvedValue({ ...payment, status: 'failed' } as never);
    renderList();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Mark payment PAY-00001 as failed' }));

    const dialog = await screen.findByRole('dialog', { name: 'Mark payment as failed' });
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'Gateway declined' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as failed' }));

    await waitFor(() =>
      expect(failMock).toHaveBeenCalledWith('pay1', { reason: 'Gateway declined' }),
    );
  });

  it('voids a pending payment with an optional reason', async () => {
    voidMock.mockResolvedValue({ ...payment, status: 'void' } as never);
    renderList();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Void payment PAY-00001' }));

    await screen.findByRole('dialog', { name: 'Void payment' });
    fireEvent.click(screen.getByRole('button', { name: 'Void payment' }));

    await waitFor(() => expect(voidMock).toHaveBeenCalledWith('pay1', {}));
  });

  it('allocates a completed payment to a payable invoice', async () => {
    listMock.mockResolvedValue({ items: [completedPayment], total: 1, page: 1, page_size: 20 });
    listInvoicesMock.mockResolvedValue({
      items: [payableInvoice],
      total: 1,
      page: 1,
      page_size: 100,
    });
    allocateMock.mockResolvedValue({ id: 'alloc1' } as never);

    renderList();

    await screen.findByText('PAY-00002');
    fireEvent.click(screen.getByRole('button', { name: 'Allocate payment PAY-00002' }));

    const dialog = await screen.findByRole('dialog', { name: 'Allocate payment to an invoice' });
    // The invoice rows arrive via a gated query once the dialog opens; wait for
    // them (longer timeout — load-flaky under full-suite parallel runs).
    expect(await within(dialog).findByText('INV-01039', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(within(dialog).getByText('₹2,120.75 due')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText('INV-01039'));
    // Selecting the invoice prefills the amount (min(outstanding, unallocated)).
    await waitFor(
      () => expect(within(dialog).getByLabelText(/Allocation Amount/)).toHaveValue(300),
      { timeout: 5000 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Allocate' }));
    await waitFor(() =>
      expect(allocateMock).toHaveBeenCalledWith('pay2', {
        invoice_id: 'inv1',
        amount: '300.00',
      }),
    );
  });

  it('deletes a pending payment through the delete dialog (admin-gated)', async () => {
    deleteMock.mockResolvedValue(undefined as never);
    renderList();

    await screen.findByText('PAY-00001');
    fireEvent.click(screen.getByRole('button', { name: 'Delete payment PAY-00001' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete payment' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete payment' }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('pay1'));
  });

  it('paginates with the backend page params', async () => {
    listMock.mockResolvedValue({ items: [payment], total: 45, page: 1, page_size: 20 });

    renderList();
    await screen.findByText('PAY-00001');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it('renders the list root width-constrained (horizontal-overflow regression guard)', async () => {
    // Sprint 14A.3 follows the 14A.2 remediation: the container root must
    // stretch to the available content width (w-full min-w-0) so the filter
    // rows can never push the workspace wider than the viewport.
    renderList();
    await screen.findByText('PAY-00001');

    const root = document.querySelector('.flex.w-full.min-w-0.flex-col.gap-4');
    expect(root).not.toBeNull();
  });
});
