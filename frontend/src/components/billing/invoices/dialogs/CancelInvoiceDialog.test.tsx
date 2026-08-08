import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CancelInvoiceDialog } from './CancelInvoiceDialog';
import type { InvoiceListItem } from '../../../../types/billing';

const invoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'INV-01042',
  status: 'issued',
  patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
  doctor: null,
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

describe('CancelInvoiceDialog', () => {
  it('renders the destructive confirmation with a required reason field', () => {
    render(
      <CancelInvoiceDialog open invoice={invoice} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Cancel invoice' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Cancel this invoice?')).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep invoice' })).toBeInTheDocument();
  });

  it('keeps the confirm disabled until a reason is provided', async () => {
    const onConfirm = vi.fn();
    render(
      <CancelInvoiceDialog open invoice={invoice} onConfirm={onConfirm} onClose={vi.fn()} />,
    );

    const reason = screen.getByLabelText(/Reason/i) as HTMLTextAreaElement;
    const confirm = screen.getByRole('button', { name: 'Cancel invoice' });

    expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: '   ' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(reason, { target: { value: 'Duplicate invoice' } });
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it('enforces the backend max reason length (500)', async () => {
    render(<CancelInvoiceDialog open invoice={invoice} onConfirm={vi.fn()} onClose={vi.fn()} />);

    const reason = screen.getByLabelText(/Reason/i) as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: 'x'.repeat(501) } });

    await waitFor(() =>
      expect(
        screen.getAllByText('Reason must be at most 500 characters').length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toBeDisabled();
  });

  it('submits the validated reason on confirm', async () => {
    const onConfirm = vi.fn();
    render(
      <CancelInvoiceDialog open invoice={invoice} onConfirm={onConfirm} onClose={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/Reason/i), {
      target: { value: 'Patient requested cancellation' },
    });
    const confirm = screen.getByRole('button', { name: 'Cancel invoice' });
    // isValid updates asynchronously after the change — click only once enabled.
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith('Patient requested cancellation'),
    );
  });

  it('disables both buttons while submitting', () => {
    render(
      <CancelInvoiceDialog open invoice={invoice} submitting onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep invoice' })).toBeDisabled();
  });
});
