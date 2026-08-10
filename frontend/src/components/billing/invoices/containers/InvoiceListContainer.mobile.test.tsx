import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../../test/testUtils';
import { InvoiceListContainer } from './InvoiceListContainer';
import { billingService } from '../../../../services/billingService';
import { doctorService } from '../../../../services/doctorService';
import { patientService } from '../../../../services/patientService';
import type { InvoiceListItem, InvoiceListResponse } from '../../../../types/billing';

vi.mock('../../../../hooks/rbac/usePermission', () => ({
  usePermission: () => ({
    state: { status: 'admin' as const, role: { role_name: 'ADMIN', id: 1, label: 'Administrator' } },
    isAdmin: true,
    isResolved: true,
    role: 'ADMIN' as const,
    can: () => true,
  }),
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
const doctorListMock = vi.mocked(doctorService.list);
const patientListMock = vi.mocked(patientService.list);

const patient = {
  id: 'p1',
  patient_code: 'PT-00318',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const invoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'INV-01042',
  status: 'issued',
  patient,
  doctor: { id: 'd1', doctor_code: 'DOC-00001', user_full_name: 'Dr. Priya Raman', is_active: true },
  invoice_date: '2026-07-23',
  due_date: '2026-08-11',
  financials: {
    currency_code: 'INR',
    subtotal: '1840.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '1840.00',
    paid_amount: '0.00',
    outstanding_amount: '1840.00',
  },
  item_count: 1,
  created_at: '2026-07-23T08:00:00Z',
};

const listResponse: InvoiceListResponse = {
  items: [invoice],
  total: 1,
  page: 1,
  page_size: 20,
};

/** Force the phone breakpoint so the container selects the mobile presentation. */
function stubMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderMobile() {
  return renderWithProviders(
    <Routes>
      <Route path="/billing/invoices" element={<InvoiceListContainer />} />
      <Route path="/billing/invoices/:invoiceId" element={<div>Invoice details page</div>} />
    </Routes>,
    { route: '/billing/invoices' },
  );
}

describe('InvoiceListContainer (mobile presentation)', () => {
  beforeEach(() => {
    stubMobileViewport();
    listMock.mockReset();
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

  it('renders the mobile card list instead of the desktop table', async () => {
    renderMobile();

    // Mobile search input + filter button, card, INR amount.
    expect(await screen.findByText('INV-01042')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search invoices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open filters' })).toBeInTheDocument();
    expect(screen.getByText('₹1,840.00')).toBeInTheDocument();
    // Desktop toolbar CTA is not rendered on mobile.
    expect(screen.queryByRole('button', { name: 'New invoice' })).not.toBeInTheDocument();
  });

  it('drives the same server-side search query param from the mobile search input', async () => {
    renderMobile();
    await screen.findByText('INV-01042');

    fireEvent.change(screen.getByPlaceholderText('Search invoices'), {
      target: { value: 'marcus' },
    });

    await waitFor(
      () =>
        expect(listMock).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'marcus', page: 1 }),
        ),
      { timeout: 2000 },
    );
  });

  it('opens the mobile filter sheet from the filter button', async () => {
    renderMobile();
    await screen.findByText('INV-01042');

    fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

    const dialog = await screen.findByRole('dialog', { name: 'Filter invoices' });
    // The Select label may render more than once; assert presence broadly.
    expect(within(dialog).getAllByText('Status').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Sort by')).toBeInTheDocument();
  });

  it('navigates to the invoice detail from a card tap', async () => {
    renderMobile();
    await screen.findByText('INV-01042');

    fireEvent.click(screen.getByRole('button', { name: /Marcus Delaney/ }));
    expect(await screen.findByText('Invoice details page')).toBeInTheDocument();
  });

  it('opens the mobile full-screen create form when createOpen is requested (mobile + CTA)', async () => {
    // The page owns the + CTA and drives the container's controlled createOpen.
    renderWithProviders(
      <Routes>
        <Route
          path="/billing/invoices"
          element={<InvoiceListContainer createOpen onRequestCreate={() => undefined} />}
        />
        <Route path="/billing/invoices/:invoiceId" element={<div>Invoice details page</div>} />
      </Routes>,
      { route: '/billing/invoices' },
    );
    await screen.findByText('INV-01042');

    // Full-screen mobile form (dialog), not the desktop two-column drawer.
    const dialog = await screen.findByRole('dialog', { name: 'New invoice' });
    expect(within(dialog).getByText('Line item 1')).toBeInTheDocument();
  });
});
