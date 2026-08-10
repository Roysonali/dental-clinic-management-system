import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { InvoiceTable } from './InvoiceTable';
import type { InvoiceListItem } from '../../../types/billing';

// PermissionGate → usePermission must resolve without a role probe.
// A non-admin result hides the ADMIN-only delete row action by default.
const permissionMock = {
  state: { status: 'non-admin' as const, role: null },
  isAdmin: false,
  isResolved: true,
  role: null,
  can: vi.fn(() => false),
};

vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock,
}));

const patient = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const draft: InvoiceListItem = {
  id: 'inv-draft',
  invoice_number: 'DRAFT-000023',
  status: 'draft',
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
    paid_amount: '0.00',
    outstanding_amount: '3000.00',
  },
  item_count: 2,
  created_at: '2026-07-23T08:00:00Z',
};

const issued: InvoiceListItem = {
  ...draft,
  id: 'inv-issued',
  invoice_number: 'INV-01042',
  status: 'issued',
  doctor: {
    id: 'd1',
    doctor_code: 'DOC-000001',
    user_full_name: 'Dr. Priya Raman',
    is_active: true,
  },
};

const paid: InvoiceListItem = {
  ...draft,
  id: 'inv-paid',
  invoice_number: 'INV-01000',
  status: 'paid',
};

function renderTable(overrides: Partial<Parameters<typeof InvoiceTable>[0]> = {}) {
  const props: Parameters<typeof InvoiceTable>[0] = {
    invoices: [],
    loading: false,
    error: null,
    onRetry: vi.fn(),
    sortState: null,
    onSortChange: vi.fn(),
    onView: vi.fn(),
    onRowClick: vi.fn(),
    onIssue: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
    onCreate: vi.fn(),
    onClearFilters: vi.fn(),
    hasActiveFilters: false,
    ...overrides,
  };
  render(<InvoiceTable {...props} />);
  return props;
}

describe('InvoiceTable', () => {
  it('renders invoice rows with number, status, patient, doctor, dates, totals and items', () => {
    renderTable({ invoices: [issued] });

    expect(screen.getByText('INV-01042')).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('PAT-000001')).toBeInTheDocument();
    expect(screen.getByText('Dr. Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('DOC-000001')).toBeInTheDocument();
    // Right-aligned currency via the shared formatter.
    expect(screen.getByText('₹3,000.00')).toBeInTheDocument();
    // Items column.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders the draft caption instead of a fabricated permanent number', () => {
    renderTable({ invoices: [draft] });

    expect(screen.getByText('DRAFT-000023')).toBeInTheDocument();
    expect(screen.getByText('Draft — number assigned on issue')).toBeInTheDocument();
  });

  it('exposes the state-machine-driven actions: draft gets Issue/Edit/Cancel', () => {
    const onIssue = vi.fn();
    const onEdit = vi.fn();
    const onCancel = vi.fn();
    renderTable({ invoices: [draft], onIssue, onEdit, onCancel });

    expect(screen.getByRole('button', { name: `Issue invoice ${draft.invoice_number}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Edit invoice ${draft.invoice_number}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Cancel invoice ${draft.invoice_number}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Open invoice ${draft.invoice_number}` })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `Issue invoice ${draft.invoice_number}` }));
    expect(onIssue).toHaveBeenCalledWith(draft);

    fireEvent.click(screen.getByRole('button', { name: `Edit invoice ${draft.invoice_number}` }));
    expect(onEdit).toHaveBeenCalledWith(draft);

    fireEvent.click(screen.getByRole('button', { name: `Cancel invoice ${draft.invoice_number}` }));
    expect(onCancel).toHaveBeenCalledWith(draft);
  });

  it('exposes only Cancel on issued invoices — never Issue/Edit (state machine)', () => {
    renderTable({ invoices: [issued] });

    expect(screen.getByRole('button', { name: `Cancel invoice ${issued.invoice_number}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Issue invoice ${issued.invoice_number}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Edit invoice ${issued.invoice_number}` })).not.toBeInTheDocument();
  });

  it('exposes no lifecycle actions on a paid invoice (the only transition is void — no endpoint)', () => {
    renderTable({ invoices: [paid] });

    expect(screen.queryByRole('button', { name: `Cancel invoice ${paid.invoice_number}` })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Open invoice ${paid.invoice_number}` })).not.toBeInTheDocument();
    // The actions cell degrades to a dash (patient/doctor cells may also show
    // dashes on other rows — assert presence rather than uniqueness).
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('does not expose the admin-only Delete action for a non-admin user (PermissionGate)', () => {
    renderTable({ invoices: [draft] });

    expect(screen.queryByRole('button', { name: `Delete invoice ${draft.invoice_number}` })).not.toBeInTheDocument();
  });

  it('renders the empty state with a New invoice CTA when unfiltered', () => {
    const onCreate = vi.fn();
    renderTable({ invoices: [], onCreate });

    expect(screen.getByText('No invoices yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('renders the filter-empty state with Clear filters when filters are active', () => {
    const onClearFilters = vi.fn();
    renderTable({ invoices: [], onClearFilters, hasActiveFilters: true });

    expect(screen.getByText('No invoices match these filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('renders an accessible table labelled Invoices', () => {
    renderTable({ invoices: [issued] });
    const table = screen.getByRole('table', { name: 'Invoices' });
    expect(within(table).getByText('Invoice Number')).toBeInTheDocument();
    expect(within(table).getByText('Grand Total')).toBeInTheDocument();
  });
});
