import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { CreateRefundDrawer } from './CreateRefundDrawer';
import type { PaymentRead } from '../../../../types/billing';

const payment: PaymentRead = {
  id: 'pay1',
  payment_number: 'PAY-00869',
  document_type: 'payment',
  status: 'completed',
  patient: { id: 'p1', patient_code: 'PT-00504', full_name: 'Amara Okonkwo', is_active: true },
  creator: { id: 1, full_name: 'Dana Whitfield' },
  updater: null,
  payment_method: 'bank_transfer',
  total_amount: '1500.00',
  payment_date: '2026-07-09',
  currency_code: 'INR',
  reference_number: null,
  is_reversed: false,
  reversal_reason: null,
  notes: null,
  allocations: [],
  financials: {
    currency_code: 'INR',
    total_amount: '1500.00',
    allocated_amount: '0.00',
    refunded_amount: '200.00',
    unallocated_amount: '1300.00',
  },
  gateway_metadata: null,
  version: 1,
  doc_version: 1,
  created_at: '2026-07-09T14:20:00Z',
  updated_at: '2026-07-09T14:20:00Z',
  created_by: 1,
  updated_by: null,
};

describe('CreateRefundDrawer', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
    onClose.mockReset();
  });

  it('renders the financial info box computed from the real payment aggregate', () => {
    renderWithProviders(
      <CreateRefundDrawer open payment={payment} onClose={onClose} onSubmit={onSubmit} />,
    );

    const drawer = screen.getByRole('dialog', { name: 'Create refund' });
    expect(within(drawer).getByRole('heading', { name: 'Create refund' })).toBeInTheDocument();
    expect(within(drawer).getByText(/Saved as PENDING/)).toBeInTheDocument();

    // Financial box: ₹1,500 total − ₹200 already refunded = ₹1,300 balance.
    expect(within(drawer).getAllByText('₹1,500.00').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('₹200.00')).toBeInTheDocument();
    expect(within(drawer).getByText('₹1,300.00')).toBeInTheDocument();
  });

  it('updates the "Remaining after this refund" hint live from the entered amount', async () => {
    renderWithProviders(
      <CreateRefundDrawer open payment={payment} onClose={onClose} onSubmit={onSubmit} />,
    );

    const drawer = screen.getByRole('dialog', { name: 'Create refund' });
    fireEvent.change(within(drawer).getByLabelText(/Refund amount/i), {
      target: { value: '250.00' },
    });

    expect(await within(drawer).findByText('Remaining after this refund: ₹1,050.00')).toBeInTheDocument();
  });

  it('submits the payload-ready values when the form is valid', async () => {
    renderWithProviders(
      <CreateRefundDrawer open payment={payment} onClose={onClose} onSubmit={onSubmit} />,
    );

    const drawer = screen.getByRole('dialog', { name: 'Create refund' });
    fireEvent.change(within(drawer).getByLabelText(/Refund amount/i), {
      target: { value: '250.00' },
    });
    fireEvent.change(within(drawer).getByLabelText(/Reason/i), {
      target: { value: 'Duplicate transfer received for the same treatment session.' },
    });

    const submit = within(drawer).getByRole('button', { name: 'Create refund' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    // RHF resolves the submit promise asynchronously — await the call.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      payment_id: 'pay1',
      amount: '250.00',
      reason: 'Duplicate transfer received for the same treatment session.',
    });
  });

  it('keeps submit disabled while the amount exceeds the refundable balance', async () => {
    renderWithProviders(
      <CreateRefundDrawer open payment={payment} onClose={onClose} onSubmit={onSubmit} />,
    );

    const drawer = screen.getByRole('dialog', { name: 'Create refund' });
    fireEvent.change(within(drawer).getByLabelText(/Refund amount/i), {
      target: { value: '1300.01' },
    });
    fireEvent.change(within(drawer).getByLabelText(/Reason/i), {
      target: { value: 'Over the limit' },
    });

    await waitFor(() => {
      // The error appears in both the ValidationSummary list and the field hint.
      expect(within(drawer).getAllByText(/cannot exceed the refundable balance/).length).toBeGreaterThan(0);
    });
    expect(within(drawer).getByRole('button', { name: 'Create refund' })).toBeDisabled();
  });

  it('requires a reason before the refund can be created', async () => {
    renderWithProviders(
      <CreateRefundDrawer open payment={payment} onClose={onClose} onSubmit={onSubmit} />,
    );

    const drawer = screen.getByRole('dialog', { name: 'Create refund' });
    fireEvent.change(within(drawer).getByLabelText(/Refund amount/i), {
      target: { value: '250.00' },
    });

    await waitFor(() => {
      expect(within(drawer).getByRole('button', { name: 'Create refund' })).toBeDisabled();
    });
  });
});
