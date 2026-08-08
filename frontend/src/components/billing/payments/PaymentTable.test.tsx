import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { PaymentTable } from './PaymentTable';
import type { PaymentListItem } from '../../../types/billing';

// The Delete row action is ADMIN-gated via PermissionGate (backend
// `_PAYMENT_DELETE_ROLES`) — resolve the role probe as a proven admin so the
// action renders in tests that exercise it.
vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => ({
    state: { status: 'admin' as const, role: { role_name: 'ADMIN', id: 1, label: 'Administrator' } },
    isAdmin: true,
    isResolved: true,
    role: 'ADMIN' as const,
    can: () => true,
  }),
}));

const patient = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const pendingPayment: PaymentListItem = {
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
  ...pendingPayment,
  id: 'pay2',
  payment_number: 'PAY-00002',
  status: 'completed',
  financials: {
    ...pendingPayment.financials,
    allocated_amount: '1200.00',
    unallocated_amount: '300.00',
  },
  allocation_count: 1,
};

const voidedPayment: PaymentListItem = {
  ...pendingPayment,
  id: 'pay3',
  payment_number: 'PAY-00003',
  status: 'void',
};

const baseProps = {
  loading: false,
  error: null as string | null,
  onRetry: vi.fn(),
  sortState: null,
  onSortChange: vi.fn(),
  onView: vi.fn(),
  onRowClick: vi.fn(),
  onComplete: vi.fn(),
  onFail: vi.fn(),
  onVoid: vi.fn(),
  onAllocate: vi.fn(),
  onDelete: vi.fn(),
  onCreate: vi.fn(),
  onClearFilters: vi.fn(),
  hasActiveFilters: false,
};

function renderTable(payments: PaymentListItem[], overrides: Partial<typeof baseProps> = {}) {
  return renderWithProviders(
    <PaymentTable payments={payments} {...baseProps} {...overrides} />,
  );
}

describe('PaymentTable', () => {
  it('renders the backend payment columns with financial values', () => {
    renderTable([completedPayment]);

    expect(screen.getByText('PAY-00002')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
    expect(screen.getByText('₹1,500.00')).toBeInTheDocument();
    expect(screen.getByText('₹1,200.00')).toBeInTheDocument();
    expect(screen.getByText('₹300.00')).toBeInTheDocument();
    expect(screen.getByText('Jul 23, 2026')).toBeInTheDocument();
  });

  it('shows the recorded datetime under the payment number (muted secondary)', () => {
    renderTable([pendingPayment]);

    expect(screen.getByText(/Jul 23, 2026 · 9:22 AM/)).toBeInTheDocument();
  });

  it('exposes complete/fail/void/delete actions only for Pending payments', () => {
    renderTable([pendingPayment, completedPayment, voidedPayment]);

    expect(screen.getByRole('button', { name: 'Complete payment PAY-00001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark payment PAY-00001 as failed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Void payment PAY-00001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete payment PAY-00001' })).toBeInTheDocument();

    // Completed payments expose allocate only.
    expect(screen.getByRole('button', { name: 'Allocate payment PAY-00002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete payment PAY-00002' })).not.toBeInTheDocument();

    // Terminal statuses expose no lifecycle actions.
    expect(screen.queryByRole('button', { name: 'Complete payment PAY-00003' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void payment PAY-00003' })).not.toBeInTheDocument();
  });

  it('navigates to the payment on row click', () => {
    const onRowClick = vi.fn();
    renderTable([pendingPayment], { onRowClick });

    fireEvent.click(screen.getByText('PAY-00001'));
    expect(onRowClick).toHaveBeenCalledWith(pendingPayment);
  });

  it('renders the filtered-empty state with a Clear filters action', () => {
    renderTable([], { hasActiveFilters: true, onClearFilters: vi.fn() });

    expect(screen.getByText('No payments match these filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('renders the unfiltered empty state with a Record payment action', () => {
    const onCreate = vi.fn();
    renderTable([], { onCreate });

    expect(screen.getByText('No payments yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders an error panel with a working retry', () => {
    const onRetry = vi.fn();
    renderTable([], { error: 'Boom', onRetry });

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders skeleton rows while loading', () => {
    renderTable([], { loading: true });

    expect(screen.getByLabelText('Payments')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-skeleton="true"]').length).toBeGreaterThan(0);
  });
});
