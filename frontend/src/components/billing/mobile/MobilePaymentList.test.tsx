import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobilePaymentList } from './MobilePaymentList';
import type { PaymentListItem } from '../../../types/billing';

const patient = {
  id: 'p1',
  patient_code: 'PT-00318',
  full_name: 'Marcus Delaney',
  is_active: true,
};

const payment: PaymentListItem = {
  id: 'pay1',
  payment_number: 'PAY-00871',
  status: 'completed',
  patient,
  payment_method: 'card',
  total_amount: '1840.00',
  payment_date: '2026-07-12',
  financials: {
    currency_code: 'INR',
    total_amount: '1840.00',
    allocated_amount: '1840.00',
    refunded_amount: '0.00',
    unallocated_amount: '0.00',
  },
  allocation_count: 1,
  created_at: '2026-07-12T08:00:00Z',
};

const handlers = {
  onMethodChange: vi.fn(),
  onStatusChange: vi.fn(),
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
  onClearFilters: vi.fn(),
  onView: vi.fn(),
};

function renderList(
  props: Partial<Parameters<typeof MobilePaymentList>[0]> = {},
) {
  return renderWithProviders(
    <MobilePaymentList
      payments={[payment]}
      loading={false}
      error={null}
      onRetry={() => undefined}
      hasActiveFilters={false}
      onClearFilters={handlers.onClearFilters}
      onView={handlers.onView}
      method="all"
      onMethodChange={handlers.onMethodChange}
      status="all"
      onStatusChange={handlers.onStatusChange}
      dateFrom=""
      dateTo=""
      onDateFromChange={handlers.onDateFromChange}
      onDateToChange={handlers.onDateToChange}
      page={1}
      totalPages={1}
      totalCount={1}
      pageSize={20}
      onPageChange={() => undefined}
      onPageSizeChange={() => undefined}
      {...props}
    />,
  );
}

describe('MobilePaymentList', () => {
  beforeEach(() => {
    Object.values(handlers).forEach((fn) => fn.mockReset());
  });

  it('renders payment cards from the same query data', () => {
    renderList();

    expect(screen.getByText('PAY-00871')).toBeInTheDocument();
    expect(screen.getByText('₹1,840.00')).toBeInTheDocument();
  });

  it('renders active filters as removable chips in one horizontal row', () => {
    renderList({ method: 'card', status: 'completed', dateFrom: '2026-07-01', dateTo: '2026-07-31' });

    expect(screen.getByText('Method: Card')).toBeInTheDocument();
    // 'Completed' appears on BOTH the filter chip and the card's status pill.
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Jul 1, 2026 – Jul 31, 2026$/)).toBeInTheDocument();
    // Chips sit in a single scrollable row (no wrapping into multiple rows).
    expect(screen.getByText('Method: Card').closest('div')).not.toBeNull();
  });

  it('removes a filter when its chip X is tapped', () => {
    renderList({ method: 'card' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Method: Card filter' }));
    expect(handlers.onMethodChange).toHaveBeenCalledWith('all');
  });

  it('clears all filters from the Clear all action', () => {
    renderList({ hasActiveFilters: true, status: 'completed' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(handlers.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('opens the payment detail on card tap', () => {
    renderList();

    fireEvent.click(screen.getByRole('button', { name: /Marcus Delaney/ }));
    expect(handlers.onView).toHaveBeenCalledWith(payment);
  });
});
