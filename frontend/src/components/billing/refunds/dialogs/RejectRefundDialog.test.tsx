import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { RejectRefundDialog } from './RejectRefundDialog';
import type { RefundRead } from '../../../../types/billing';

const refund: RefundRead = {
  id: 'rfd1',
  refund_number: 'RFD-00114',
  document_type: 'refund',
  status: 'pending',
  patient: { id: 'p1', patient_code: 'PT-00504', full_name: 'Amara Okonkwo', is_active: true },
  payment: {
    id: 'pay1',
    payment_number: 'PAY-00869',
    payment_method: 'bank_transfer',
    total_amount: '1500.00',
    payment_date: '2026-07-09',
    currency_code: 'INR',
  },
  invoices: [],
  creator: { id: 1, full_name: 'Dana Whitfield' },
  updater: null,
  reviewer: null,
  amount: '250.00',
  reason: 'Duplicate transfer received for the same treatment session.',
  currency_code: 'INR',
  notes: null,
  rejection_reason: null,
  reviewed_by: null,
  reviewed_at: null,
  financials: {
    currency_code: 'INR',
    refund_amount: '250.00',
    payment_total: '1500.00',
    remaining_on_payment: '1050.00',
    refund_count: 1,
  },
  gateway_metadata: null,
  document_metadata: {
    document_type: 'refund',
    sequence_number: null,
    issued_at: '2026-07-10T16:02:00Z',
    generated_at: '2026-07-10T16:02:00Z',
  },
  audit_trail: [],
  version: 1,
  doc_version: 1,
  created_at: '2026-07-10T16:02:00Z',
  created_by: 1,
  updated_at: '2026-07-10T16:02:00Z',
  updated_by: null,
};

describe('RejectRefundDialog', () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    onConfirm.mockReset();
    onClose.mockReset();
  });

  it('keeps the destructive confirm disabled until a non-empty reason is entered', () => {
    renderWithProviders(
      <RejectRefundDialog open refund={refund} onConfirm={onConfirm} onClose={onClose} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Reject refund' });
    expect(within(dialog).getByText('Reject this refund?')).toBeInTheDocument();

    const confirm = within(dialog).getByRole('button', { name: 'Reject refund' });
    expect(confirm).toBeDisabled();

    // Whitespace-only still counts as missing.
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'No duplicate payment found.' },
    });
    expect(confirm).toBeEnabled();
  });

  it('submits the trimmed reason only when the confirm is enabled', () => {
    renderWithProviders(
      <RejectRefundDialog open refund={refund} onConfirm={onConfirm} onClose={onClose} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Reject refund' });
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: '  No duplicate payment found.  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject refund' }));

    expect(onConfirm).toHaveBeenCalledWith('No duplicate payment found.');
  });

  it('renders the character counter and the supporting hint', () => {
    renderWithProviders(
      <RejectRefundDialog open refund={refund} onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByText('0/500')).toBeInTheDocument();
    expect(screen.getByText('Confirm is enabled once a reason is entered.')).toBeInTheDocument();
  });
});
