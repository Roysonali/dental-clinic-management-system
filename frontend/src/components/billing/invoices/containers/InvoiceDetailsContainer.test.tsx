import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../../test/testUtils';
import { InvoiceDetailsContainer } from './InvoiceDetailsContainer';
import { billingService } from '../../../../services/billingService';
import type { InvoiceRead } from '../../../../types/billing';

vi.mock('../../../../services/billingService', () => ({
  billingService: {
    getInvoice: vi.fn(),
    updateDraftInvoice: vi.fn(),
    issueInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
  },
}));

const getMock = vi.mocked(billingService.getInvoice);
const issueMock = vi.mocked(billingService.issueInvoice);
const cancelMock = vi.mocked(billingService.cancelInvoice);
const deleteMock = vi.mocked(billingService.deleteInvoice);
const updateMock = vi.mocked(billingService.updateDraftInvoice);

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

const issuedInvoice: InvoiceRead = {
  id: 'inv1',
  invoice_number: 'INV-01042',
  document_type: 'invoice',
  status: 'issued',
  patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
  doctor: { id: 'd1', doctor_code: 'DOC-000001', user_full_name: 'Dr. Priya Raman', is_active: true },
  treatment_plan: { id: 'tp1', plan_code: 'TXN-000001', status: 'in_progress' },
  appointment: { id: 'apt1', appointment_number: 'APT-04412', appointment_date: '2026-07-12' },
  creator: { id: 1, full_name: 'Admin' },
  updater: null,
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  currency_code: 'USD',
  notes: 'Follow up in two weeks',
  cancellation_reason: null,
  void_reason: null,
  items: [
    {
      id: 'i1',
      sequence_number: 1,
      description: 'Composite restoration — tooth 26',
      quantity: 1,
      unit_price: '320.00',
      discount_type: 'PERCENTAGE',
      discount_value: '32.00',
      net_amount: '288.00',
      tax_amount: null,
      currency_code: 'USD',
    },
  ],
  financials: {
    currency_code: 'USD',
    subtotal: '320.00',
    discount_total: '32.00',
    tax_total: '0.00',
    grand_total: '288.00',
    paid_amount: '0.00',
    outstanding_amount: '288.00',
  },
  version: 1,
  doc_version: 1,
  created_at: '2026-07-23T08:00:00Z',
  updated_at: '2026-07-23T08:00:00Z',
  created_by: 1,
  updated_by: null,
};

function renderDetails(route = '/billing/invoices/inv1', queryClient?: QueryClient) {
  return renderWithProviders(
    <Routes>
      <Route path="/billing/invoices/:invoiceId" element={<InvoiceDetailsContainer invoiceId="inv1" />} />
      <Route path="/billing/invoices" element={<div>Invoice list page</div>} />
    </Routes>,
    { route, queryClient },
  );
}

describe('InvoiceDetailsContainer', () => {
  beforeEach(() => {
    getMock.mockReset();
    issueMock.mockReset();
    cancelMock.mockReset();
    deleteMock.mockReset();
    updateMock.mockReset();
    getMock.mockResolvedValue(issuedInvoice);
  });

  it('renders the full invoice aggregate (header, summary cards, line items, financials, notes)', async () => {
    renderDetails();

    expect(await screen.findByText('INV-01042')).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('PAT-000001')).toBeInTheDocument();
    expect(screen.getByText('Dr. Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('TXN-000001')).toBeInTheDocument();
    expect(screen.getByText('APT-04412')).toBeInTheDocument();
    expect(screen.getByText('Composite restoration — tooth 26')).toBeInTheDocument();
    // $288.00 appears in both the line-item net column and the grand total.
    expect(screen.getAllByText('$288.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Financial Summary')).toBeInTheDocument();
    expect(screen.getByText('Follow up in two weeks')).toBeInTheDocument();
    expect(screen.getByText('Record Information')).toBeInTheDocument();
  });

  it('shows only Cancel for an issued invoice — never Issue (state machine)', async () => {
    renderDetails();
    await screen.findByText('INV-01042');

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows Issue / Edit for a draft invoice', async () => {
    getMock.mockResolvedValue({
      ...issuedInvoice,
      status: 'draft',
      invoice_number: 'DRAFT-000023',
    });

    renderDetails();
    await screen.findByText('DRAFT-000023');

    expect(screen.getByRole('button', { name: 'Issue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows no lifecycle actions on a paid invoice', async () => {
    getMock.mockResolvedValue({ ...issuedInvoice, status: 'paid' });

    renderDetails();
    await screen.findByText('INV-01042');

    expect(screen.getByText('No actions are available for this invoice status.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('opens the issue dialog and issues the draft invoice', async () => {
    getMock.mockResolvedValue({
      ...issuedInvoice,
      status: 'draft',
      invoice_number: 'DRAFT-000023',
    });
    issueMock.mockResolvedValue({ ...issuedInvoice, invoice_number: 'INV-01043' } as never);

    renderDetails();
    await screen.findByText('DRAFT-000023');

    fireEvent.click(screen.getByRole('button', { name: 'Issue' }));
    expect(await screen.findByRole('dialog', { name: 'Issue invoice' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => expect(issueMock).toHaveBeenCalledWith('inv1'));
  });

  it('opens the cancel dialog and cancels with a reason', async () => {
    cancelMock.mockResolvedValue({ ...issuedInvoice, status: 'cancelled' } as never);

    renderDetails();
    await screen.findByText('INV-01042');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel invoice' });
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Patient withdrew' } });
    const confirm = screen.getByRole('button', { name: 'Cancel invoice' });
    // isValid updates asynchronously after the change — click only once enabled.
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith('inv1', { cancellation_reason: 'Patient withdrew' }),
    );
  });

  it('renders the permission-denied state on 403', async () => {
    getMock.mockRejectedValue(httpError(403, 'Insufficient permissions'));

    renderDetails();

    expect(await screen.findByText("You don't have permission")).toBeInTheDocument();
    expect(screen.getByText('Error 403 · Insufficient permissions')).toBeInTheDocument();
  });

  it('renders the error state on 404 and retries without a full reload', async () => {
    // useInvoice keeps the global single-retry for non-403 failures
    // (shouldRetryQuery) — use a permanent rejection so BOTH attempts settle
    // on the error state, and disable the retry backoff so it settles
    // immediately (established DensCare pattern).
    getMock.mockRejectedValue(httpError(404, 'Invoice not found'));

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
    renderDetails('/billing/invoices/inv1', queryClient);

    expect(await screen.findByText("Couldn't load this invoice")).toBeInTheDocument();
    expect(
      screen.getByText('This invoice could not be retrieved. It may have been removed, or the billing service is unavailable.'),
    ).toBeInTheDocument();

    // Retry refetches the query (no full page reload) — swap the mock first.
    getMock.mockClear();
    getMock.mockResolvedValue(issuedInvoice);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('INV-01042')).toBeInTheDocument();
  });

  it('renders a skeleton layout while loading', () => {
    getMock.mockReturnValue(new Promise(() => {})); // never resolves

    renderDetails();

    expect(screen.getByLabelText('Loading invoice')).toBeInTheDocument();
    expect(screen.queryByText('INV-01042')).not.toBeInTheDocument();
  });

  it('opens the edit drawer and saves only the editable fields', async () => {
    getMock.mockResolvedValue({
      ...issuedInvoice,
      status: 'draft',
      invoice_number: 'DRAFT-000023',
    });
    updateMock.mockResolvedValue({ ...issuedInvoice, status: 'draft' } as never);

    renderDetails();
    await screen.findByText('DRAFT-000023');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const drawer = await screen.findByRole('dialog', { name: 'Edit draft invoice' });
    expect(drawer).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Updated note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('inv1', {
        due_date: '2026-08-22',
        notes: 'Updated note',
      }),
    );
  });

  it('navigates back to the invoice list', async () => {
    renderDetails();
    await screen.findByText('INV-01042');

    fireEvent.click(screen.getByRole('button', { name: '← Back to Invoices' }));
    expect(await screen.findByText('Invoice list page')).toBeInTheDocument();
  });
});
