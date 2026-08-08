import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueInvoiceDialog } from './IssueInvoiceDialog';
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

describe('IssueInvoiceDialog', () => {
  it('renders the confirmation copy, summary and both buttons when open', () => {
    render(
      <IssueInvoiceDialog
        open
        invoice={invoice}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Issue invoice' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Issue this invoice?')).toBeInTheDocument();
    expect(
      screen.getByText('A permanent invoice number will be assigned and the invoice becomes immutable.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<IssueInvoiceDialog open={false} invoice={null} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms and closes', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <IssueInvoiceDialog open invoice={invoice} onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables the confirm button and shows an error while submitting', () => {
    render(
      <IssueInvoiceDialog
        open
        invoice={invoice}
        submitting
        error="Could not issue invoice"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // Rendered in both the alert title and the description.
    expect(screen.getAllByText('Could not issue invoice').length).toBeGreaterThan(0);
  });
});
