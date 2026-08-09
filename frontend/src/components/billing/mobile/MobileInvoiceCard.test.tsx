import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobileInvoiceCard } from './MobileInvoiceCard';
import type { InvoiceListItem } from '../../../types/billing';

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

describe('MobileInvoiceCard', () => {
  it('renders number, patient, code · doctor, due date and INR total', () => {
    renderWithProviders(<MobileInvoiceCard invoice={invoice} onClick={() => undefined} />);

    expect(screen.getByText('INV-01042')).toBeInTheDocument();
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('PT-00318 · Dr. Priya Raman')).toBeInTheDocument();
    // INR formatting is mandatory — never a dollar sign.
    expect(screen.getByText('₹1,840.00')).toBeInTheDocument();
    expect(screen.getByText(/^Due /)).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('shows the muted italic draft placeholder instead of a number for drafts', () => {
    renderWithProviders(
      <MobileInvoiceCard invoice={{ ...invoice, status: 'draft' }} onClick={() => undefined} />,
    );

    const title = screen.getByText('Draft — number assigned on issue');
    expect(title).toBeInTheDocument();
    expect(title.className).toContain('italic');
    expect(screen.queryByText('INV-01042')).not.toBeInTheDocument();
  });

  it('renders the status pill with a text label (not colour alone)', () => {
    renderWithProviders(<MobileInvoiceCard invoice={invoice} onClick={() => undefined} />);

    expect(screen.getByText('Issued')).toBeInTheDocument();
  });

  it('invokes onClick when the card is tapped', () => {
    const onClick = vi.fn();
    renderWithProviders(<MobileInvoiceCard invoice={invoice} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Marcus Delaney/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
