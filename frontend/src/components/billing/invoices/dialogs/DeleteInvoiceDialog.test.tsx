import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteInvoiceDialog } from './DeleteInvoiceDialog';
import type { InvoiceListItem } from '../../../../types/billing';

const invoice: InvoiceListItem = {
  id: 'inv1',
  invoice_number: 'DRAFT-000023',
  status: 'draft',
  patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
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

describe('DeleteInvoiceDialog', () => {
  it('renders the destructive confirmation with a summary', () => {
    render(<DeleteInvoiceDialog open invoice={invoice} onConfirm={vi.fn()} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Delete draft invoice' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Delete this draft invoice?')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // line items
    expect(screen.getByText('₹3,000.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeInTheDocument();
  });

  it('confirms deletion and closes', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<DeleteInvoiceDialog open invoice={invoice} onConfirm={onConfirm} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate deletions while submitting', () => {
    render(
      <DeleteInvoiceDialog open invoice={invoice} submitting onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Delete draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('shows the backend error copy in the dialog', () => {
    render(
      <DeleteInvoiceDialog
        open
        invoice={invoice}
        error="Only administrators can delete draft invoices"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Could not delete draft')).toBeInTheDocument();
    expect(screen.getByText('Only administrators can delete draft invoices')).toBeInTheDocument();
  });
});
