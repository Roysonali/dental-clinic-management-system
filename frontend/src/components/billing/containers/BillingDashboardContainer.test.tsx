import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { BillingDashboardContainer } from './BillingDashboardContainer';
import { billingService } from '../../../services/billingService';
import { patientService } from '../../../services/patientService';
import type {
  BillingDashboardResponse,
  InvoiceListItem,
  PaymentListItem,
} from '../../../types/billing';

vi.mock('../../../services/billingService', () => ({
  billingService: {
    getDashboard: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const getDashboardMock = vi.mocked(billingService.getDashboard);
const patientListMock = vi.mocked(patientService.list);

const config: InternalAxiosRequestConfig = {} as InternalAxiosRequestConfig;

/** Build an AxiosError with an HTTP response (mirrors apiError.test.ts). */
function httpError(status: number, data?: unknown): AxiosError {
  const response = {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  } as AxiosResponse;
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  );
}

const invoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'INV-00001',
  status: 'paid',
  patient: {
    id: 'p1',
    patient_code: 'PAT-000001',
    full_name: 'Marcus Delaney',
    is_active: true,
  },
  doctor: null,
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  financials: {
    currency_code: 'USD',
    subtotal: '3000.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '3000.00',
    paid_amount: '3000.00',
    outstanding_amount: '0.00',
  },
  item_count: 2,
  created_at: '2026-07-23T08:00:00Z',
};

const payment: PaymentListItem = {
  id: 'pay1',
  payment_number: 'PAY-00001',
  status: 'completed',
  patient: {
    id: 'p1',
    patient_code: 'PAT-000001',
    full_name: 'Marcus Delaney',
    is_active: true,
  },
  payment_method: 'card',
  total_amount: '1500.00',
  payment_date: '2026-07-23',
  financials: {
    currency_code: 'USD',
    total_amount: '1500.00',
    allocated_amount: '1500.00',
    refunded_amount: '0.00',
    unallocated_amount: '0.00',
  },
  allocation_count: 1,
  created_at: '2026-07-23T09:00:00Z',
};

const populatedResponse: BillingDashboardResponse = {
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
  recent_invoices: [invoice],
  recent_payments: [payment],
  patient_summary: null,
  generated_at: '2026-08-08T10:00:00Z',
};

const emptyResponse: BillingDashboardResponse = {
  totals: {
    total_invoiced: '0.00',
    total_collected: '0.00',
    total_refunded: '0.00',
    total_outstanding: '0.00',
    total_credited: '0.00',
    invoice_count: 0,
    paid_invoice_count: 0,
    outstanding_invoice_count: 0,
    payment_count: 0,
    credit_note_count: 0,
  },
  recent_invoices: [],
  recent_payments: [],
  patient_summary: null,
  generated_at: '2026-08-08T10:00:00Z',
};

const patientRow = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  age: 34,
  gender: 'male' as const,
  primary_contact_number: '+639123456789',
  is_active: true,
};

describe('BillingDashboardContainer', () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
    patientListMock.mockReset();
    patientListMock.mockResolvedValue({
      items: [patientRow],
      total: 1,
      page: 1,
      page_size: 10,
    });
  });

  it('renders the populated dashboard with KPI, invoice and payment data', async () => {
    getDashboardMock.mockResolvedValue(populatedResponse);

    renderWithProviders(<BillingDashboardContainer />);

    // KPI values (formatted per the shared currency formatter).
    expect(await screen.findByText('Total Invoiced')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    expect(screen.getByText('$3,500.00')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();

    // Recent invoices: number, patient (invoice + payment rows share it), status,
    // right-aligned total.
    expect(screen.getByText('INV-00001')).toBeInTheDocument();
    expect(screen.getAllByText('Marcus Delaney').length).toBeGreaterThan(0);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();

    // Recent payments: number, method · date, amount.
    expect(screen.getByText('PAY-00001')).toBeInTheDocument();
    expect(screen.getByText(/Card · Jul 23, 2026/)).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();

    // System-wide query (no patient filter) and patient-summary prompt.
    expect(getDashboardMock).toHaveBeenCalledWith(undefined);
    expect(
      screen.getByText('Select a patient to see their billing summary.'),
    ).toBeInTheDocument();

    // "View all" on Recent Invoices navigates to the Invoice List route
    // (Phase 2 ships it); Recent Payments' "View all" navigates to the
    // Payment List route (Phase 3 ships it). Both are live shortcuts now.
    const viewAllButtons = screen.getAllByRole('button', { name: 'View all' });
    expect(viewAllButtons).toHaveLength(2);

    const invoicesViewAll = screen.getAllByRole('button', { name: 'View all' })[0];
    expect(invoicesViewAll).toBeEnabled();

    const paymentsViewAll = screen.getAllByRole('button', { name: 'View all' })[1];
    expect(paymentsViewAll).toBeEnabled();
  });

  it('renders skeleton placeholders while the dashboard is loading', () => {
    getDashboardMock.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithProviders(<BillingDashboardContainer />);

    expect(
      screen.getByLabelText('Loading billing dashboard'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Total Invoiced')).not.toBeInTheDocument();
    expect(screen.queryByText('No billing activity yet')).not.toBeInTheDocument();
  });

  it('renders the error banner with an Unavailable KPI grid and retries via refetch', async () => {
    getDashboardMock.mockRejectedValue(httpError(500, { success: false, message: 'boom' }));

    // The hook keeps the global single-retry for 5xx (shouldRetryQuery), so the
    // retry backoff is disabled to settle the error state immediately.
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

    renderWithProviders(<BillingDashboardContainer />, { queryClient });

    expect(
      await screen.findByText("Couldn't load billing dashboard"),
    ).toBeInTheDocument();
    // Raw backend messages are never exposed; metrics degrade to unavailable.
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText('$15,000.00')).not.toBeInTheDocument();

    // Retry refetches the query (no full page reload).
    getDashboardMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(getDashboardMock).toHaveBeenCalledTimes(1));
  });

  it('renders the permission-denied state on 403 and never retries', async () => {
    getDashboardMock.mockRejectedValue(
      httpError(403, { success: false, message: 'Insufficient permissions' }),
    );

    renderWithProviders(<BillingDashboardContainer />);

    expect(
      await screen.findByText("You don't have permission"),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Error 403 · Insufficient permissions'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    // shouldRetryQuery never retries 403 — exactly one endpoint call.
    expect(getDashboardMock).toHaveBeenCalledTimes(1);
  });

  it('renders zeroed KPIs and the centered empty state when there is no billing activity', async () => {
    getDashboardMock.mockResolvedValue(emptyResponse);

    renderWithProviders(<BillingDashboardContainer />);

    expect(await screen.findByText('No billing activity yet')).toBeInTheDocument();
    // KPI cards still show graceful zero values (count cards all render '0').
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    // Empty-state CTAs are backend-capability aware: New invoice navigates to
    // the Invoice List route (Phase 2); Record payment navigates to the
    // Payment List route (Phase 3). Both are enabled shortcuts now.
    expect(screen.getByRole('button', { name: 'New invoice' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
  });

  it('scopes the dashboard to a patient and renders their financial summary', async () => {
    getDashboardMock.mockImplementation(async (patientId?: string) => {
      if (patientId === 'p1') {
        return {
          ...populatedResponse,
          patient_summary: {
            patient_id: 'p1',
            total_invoiced: '4210.00',
            total_paid: '3840.00',
            total_refunded: '0.00',
            total_outstanding: '370.00',
            total_credited: '0.00',
            total_credit_remaining: '0.00',
            invoice_count: 4,
            paid_invoice_count: 3,
            outstanding_invoice_count: 1,
            payment_count: 5,
            credit_note_count: 0,
          },
        };
      }
      return populatedResponse;
    });

    renderWithProviders(<BillingDashboardContainer />);

    expect(await screen.findByText('Patient Financial Summary')).toBeInTheDocument();

    // Search + select a patient via the shared PatientPicker.
    const pickerInput = screen.getByPlaceholderText('Search patient by name or code…');
    fireEvent.change(pickerInput, { target: { value: 'marcus' } });

    const option = await screen.findByRole('option', { name: /Marcus Delaney/ });
    fireEvent.click(option);

    // The dashboard refetches with the patient filter and shows the summary.
    await waitFor(() => expect(getDashboardMock).toHaveBeenCalledWith('p1'));
    expect(await screen.findByText('$4,210.00')).toBeInTheDocument();
    expect(screen.getByText('$3,840.00')).toBeInTheDocument();
    expect(screen.getByText('$370.00')).toBeInTheDocument();
    expect(
      screen.queryByText('Select a patient to see their billing summary.'),
    ).not.toBeInTheDocument();
  });

  it('renders accessible, labelled tables for the recent activity sections', async () => {
    getDashboardMock.mockResolvedValue(populatedResponse);

    renderWithProviders(<BillingDashboardContainer />);

    const invoicesTable = await screen.findByRole('table', { name: 'Recent invoices' });
    expect(within(invoicesTable).getByText('INV-00001')).toBeInTheDocument();
    expect(within(invoicesTable).getByText('Grand Total')).toBeInTheDocument();

    const paymentsTable = screen.getByRole('table', { name: 'Recent payments' });
    expect(within(paymentsTable).getByText('PAY-00001')).toBeInTheDocument();
  });
});
