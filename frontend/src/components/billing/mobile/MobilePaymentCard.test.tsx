import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobilePaymentCard } from './MobilePaymentCard';
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

describe('MobilePaymentCard', () => {
  it('renders number, patient, uppercase method · date, unallocated and INR total', () => {
    renderWithProviders(<MobilePaymentCard payment={payment} onClick={() => undefined} />);

    expect(screen.getByText('PAY-00871')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText(/^CARD · /)).toBeInTheDocument();
    expect(screen.getByText('Unallocated ₹0.00')).toBeInTheDocument();
    expect(screen.getByText('₹1,840.00')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('renders the status pill with a text label', () => {
    renderWithProviders(<MobilePaymentCard payment={payment} onClick={() => undefined} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('invokes onClick when the card is tapped', () => {
    const onClick = vi.fn();
    renderWithProviders(<MobilePaymentCard payment={payment} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Marcus Delaney/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
