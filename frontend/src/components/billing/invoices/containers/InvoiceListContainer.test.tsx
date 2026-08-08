import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../../test/testUtils';
import { InvoiceListContainer } from './InvoiceListContainer';
import { billingService } from '../../../../services/billingService';
import { doctorService } from '../../../../services/doctorService';
import { patientService } from '../../../../services/patientService';
import type { InvoiceListItem, InvoiceListResponse } from '../../../../types/billing';

// The Delete row action is ADMIN-gated via PermissionGate (backend
// `_INVOICE_DELETE_ROLES`) — resolve the role probe as a proven admin so the
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
    listInvoices: vi.fn(),
    getInvoice: vi.fn(),
    createInvoice: vi.fn(),
    updateDraftInvoice: vi.fn(),
    issueInvoice: vi.fn(),
    cancelInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
  },
}));

vi.mock('../../../../services/doctorService', () => ({
  doctorService: { list: vi.fn() },
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

const listMock = vi.mocked(billingService.listInvoices);
const createMock = vi.mocked(billingService.createInvoice);
const issueMock = vi.mocked(billingService.issueInvoice);
const cancelMock = vi.mocked(billingService.cancelInvoice);
const deleteMock = vi.mocked(billingService.deleteInvoice);
const getInvoiceMock = vi.mocked(billingService.getInvoice);
const doctorListMock = vi.mocked(doctorService.list);
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

const patient = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const invoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'INV-01042',
  status: 'issued',
  patient,
  doctor: { id: 'd1', doctor_code: 'DOC-000001', user_full_name: 'Dr. Priya Raman', is_active: true },
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  financials: {
    currency_code: 'USD',
    subtotal: '3000.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '3000.00',
    paid_amount: '0.00',
    outstanding_amount: '3000.00',
  },
  item_count: 2,
  created_at: '2026-07-23T08:00:00Z',
};

const draftInvoice: InvoiceListItem = {
  ...invoice,
  id: 'inv-draft',
  invoice_number: 'DRAFT-000023',
  status: 'draft',
};

const listResponse: InvoiceListResponse = {
  items: [invoice],
  total: 1,
  page: 1,
  page_size: 20,
};

function renderList(route = '/billing/invoices', queryClient?: QueryClient) {
  return renderWithProviders(
    <Routes>
      <Route path="/billing/invoices" element={<InvoiceListContainer />} />
      <Route path="/billing/invoices/:invoiceId" element={<div>Invoice details page</div>} />
    </Routes>,
    { route, queryClient },
  );
}

describe('InvoiceListContainer', () => {
  beforeEach(() => {
    listMock.mockReset();
    createMock.mockReset();
    issueMock.mockReset();
    cancelMock.mockReset();
    deleteMock.mockReset();
    getInvoiceMock.mockReset();
    doctorListMock.mockReset();
    patientListMock.mockReset();

    listMock.mockResolvedValue(listResponse);
    doctorListMock.mockResolvedValue({
      items: [{ id: 'd1', user_full_name: 'Dr. Priya Raman' }] as never,
      total: 1,
      page: 1,
      page_size: 100,
    } as never);
    patientListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    } as never);
  });

  it('renders the invoice list fetched from the backend with server-side params', async () => {
    renderList();

    expect(await screen.findByText('INV-01042')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    // 'Issued' appears in both the status filter option and the status badge.
    expect(screen.getAllByText('Issued').length).toBeGreaterThan(0);
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 20, sort_by: 'created_at', sort_order: 'desc' }),
    );
  });

  it('shows the filter-empty state when filters return nothing', async () => {
    listMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });

    renderList();

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first invoice to start tracking clinic billing.')).toBeInTheDocument();
  });

  it('navigates to the invoice detail on row click', async () => {
    renderList();
    await screen.findByText('INV-01042');

    fireEvent.click(screen.getByText('INV-01042'));
    expect(await screen.findByText('Invoice details page')).toBeInTheDocument();
  });

  it('opens the create drawer and creates a draft invoice', async () => {
    createMock.mockResolvedValue({
      ...invoice,
      id: 'new-inv',
      status: 'draft',
      invoice_number: 'DRAFT-000023',
    } as never);
    // The drawer's PatientPicker needs a real patient to search against.
    patientListMock.mockResolvedValue({
      items: [patient],
      total: 1,
      page: 1,
      page_size: 10,
    } as never);
    renderList();

    await screen.findByText('INV-01042');
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    const dialog = await screen.findByRole('dialog', { name: 'New invoice' });
    expect(dialog).toBeInTheDocument();

    // The toolbar ALSO renders a PatientPicker filter — scope drawer fields to
    // the drawer dialog. The picker's option list renders in a portal, so the
    // option is queried document-wide (the toolbar picker stays closed).
    fireEvent.change(within(dialog).getByPlaceholderText('Search patient by name or code…'), {
      target: { value: 'marcus' },
    });
    const option = await screen.findByRole('option', { name: /Marcus Delaney/ }, { timeout: 5000 });
    fireEvent.click(option);

    fireEvent.change(within(dialog).getByLabelText('Item 1 description'), {
      target: { value: 'Cleaning' },
    });
    fireEvent.change(within(dialog).getByLabelText('Item 1 unit price'), {
      target: { value: '100' },
    });

    const save = within(dialog).getByRole('button', { name: 'Save draft' });
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(save);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
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
    // The hook keeps the global single-retry for 5xx (shouldRetryQuery) — use
    // a permanent rejection so BOTH attempts settle on the error state, and
    // disable the retry backoff so it resolves immediately (established
    // DensCare pattern — see BillingDashboardContainer error test).
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
    renderList('/billing/invoices', queryClient);

    expect(await screen.findByText('Failed to load data')).toBeInTheDocument();

    // Retry refetches the query (no full page reload) — swap the mock first.
    listMock.mockClear();
    listMock.mockResolvedValue(listResponse);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('INV-01042')).toBeInTheDocument();
  });

  it('opens the issue dialog only for drafts and issues the invoice', async () => {
    listMock.mockResolvedValue({ items: [draftInvoice], total: 1, page: 1, page_size: 20 });
    issueMock.mockResolvedValue({ ...invoice, invoice_number: 'INV-01043' } as never);

    renderList();

    await screen.findByText('DRAFT-000023');
    fireEvent.click(screen.getByRole('button', { name: `Issue invoice ${draftInvoice.invoice_number}` }));

    const dialog = await screen.findByRole('dialog', { name: 'Issue invoice' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => expect(issueMock).toHaveBeenCalledWith('inv-draft'));
  });

  it('opens the cancel dialog and cancels the invoice with a reason', async () => {
    cancelMock.mockResolvedValue({ ...invoice, status: 'cancelled' } as never);
    renderList();

    await screen.findByText('INV-01042');
    fireEvent.click(screen.getByRole('button', { name: `Cancel invoice ${invoice.invoice_number}` }));

    const dialog = await screen.findByRole('dialog', { name: 'Cancel invoice' });
    expect(dialog).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'Duplicate invoice' },
    });
    const confirm = screen.getByRole('button', { name: 'Cancel invoice' });
    // isValid updates asynchronously after the change — click only once enabled.
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(cancelMock).toHaveBeenCalledWith('inv1', { cancellation_reason: 'Duplicate invoice' }),
    );
  });

  it('opens the delete dialog for a draft and deletes it', async () => {
    listMock.mockResolvedValue({ items: [draftInvoice], total: 1, page: 1, page_size: 20 });
    deleteMock.mockResolvedValue(undefined as never);

    renderList();

    await screen.findByText('DRAFT-000023');
    fireEvent.click(screen.getByRole('button', { name: `Delete invoice ${draftInvoice.invoice_number}` }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete draft invoice' });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('inv-draft'));
  });

  it('paginates with the backend page params', async () => {
    listMock.mockResolvedValue({ items: [invoice], total: 45, page: 1, page_size: 20 });

    renderList();
    await screen.findByText('INV-01042');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it('renders the list root width-constrained (horizontal-overflow regression guard)', async () => {
    // Sprint 14A.2 remediation: the container root must stretch to the
    // available content width (w-full min-w-0) instead of sizing to its
    // content's intrinsic width — otherwise the filter row grows to ~1336px
    // and the workspace clips the rightmost controls. Same pattern as
    // PatientRecordListContainer / DoctorListContainer.
    renderList();
    await screen.findByText('INV-01042');

    const root = document.querySelector('.flex.w-full.min-w-0.flex-col.gap-4');
    expect(root).not.toBeNull();
  });
});
