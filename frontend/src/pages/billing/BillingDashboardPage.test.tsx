import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/testUtils';
import { BillingDashboardPage } from './BillingDashboardPage';
import { billingService } from '../../services/billingService';
import { doctorService } from '../../services/doctorService';
import { patientService } from '../../services/patientService';
import type { BillingDashboardResponse, InvoiceListItem, PaymentListItem } from '../../types/billing';

vi.mock('../../services/billingService', () => ({
  billingService: {
    getDashboard: vi.fn(),
    createInvoice: vi.fn(),
  },
}));

vi.mock('../../services/doctorService', () => ({
  doctorService: { list: vi.fn() },
}));

vi.mock('../../services/patientService', () => ({
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
const createMock = vi.mocked(billingService.createInvoice);
const doctorListMock = vi.mocked(doctorService.list);
const patientListMock = vi.mocked(patientService.list);

const patient = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const invoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'INV-00001',
  status: 'paid',
  patient,
  doctor: null,
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  financials: {
    currency_code: 'INR',
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
  patient,
  payment_method: 'card',
  total_amount: '1500.00',
  payment_date: '2026-07-23',
  financials: {
    currency_code: 'INR',
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

const patientRow = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  age: 34,
  gender: 'male' as const,
  primary_contact_number: '+639123456789',
  is_active: true,
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/billing" element={<BillingDashboardPage />} />
      <Route path="/billing/invoices/:invoiceId" element={<div>Invoice details page</div>} />
    </Routes>,
    { route: '/billing' },
  );
}

describe('BillingDashboardPage', () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
    createMock.mockReset();
    doctorListMock.mockReset();
    patientListMock.mockReset();

    getDashboardMock.mockResolvedValue(populatedResponse);
    doctorListMock.mockResolvedValue({
      items: [],
      total: 0,
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

  it('opens the create invoice drawer DIRECTLY on the dashboard (no Invoice List detour)', async () => {
    renderPage();

    // Dashboard content loads.
    expect(await screen.findByText('Total Invoiced')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    // The create drawer opens on the dashboard page itself.
    const dialog = await screen.findByRole('dialog', { name: 'New invoice' });
    expect(dialog).toBeInTheDocument();
    // The dashboard content is still mounted behind the drawer — no
    // navigation to the Invoice List page happened.
    expect(screen.getByText('Total Invoiced')).toBeInTheDocument();
    expect(screen.queryByText('Invoice details page')).not.toBeInTheDocument();
  });

  it('creates a draft from the dashboard drawer and navigates to the new invoice detail page', async () => {
    createMock.mockResolvedValue({
      ...invoice,
      id: 'new-inv',
      status: 'draft',
      invoice_number: 'DRAFT-000023',
    } as never);
    // The drawer's PatientPicker needs a real patient to search against.
    patientListMock.mockResolvedValue({
      items: [patientRow],
      total: 1,
      page: 1,
      page_size: 10,
    } as never);

    renderPage();
    await screen.findByText('Total Invoiced');

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));

    const dialog = await screen.findByRole('dialog', { name: 'New invoice' });

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
    // The shared create flow navigates to the new invoice's detail page.
    expect(await screen.findByText('Invoice details page')).toBeInTheDocument();
  });
});
