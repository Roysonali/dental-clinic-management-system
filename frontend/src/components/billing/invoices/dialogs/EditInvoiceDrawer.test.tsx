import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { EditInvoiceDrawer } from './EditInvoiceDrawer';
import type { InvoiceRead } from '../../../../types/billing';

const invoice: InvoiceRead = {
  id: 'inv1',
  invoice_number: 'DRAFT-000023',
  document_type: 'invoice',
  status: 'draft',
  patient: { id: 'p1', patient_code: 'PAT-000001', full_name: 'Marcus Delaney', is_active: true },
  doctor: { id: 'd1', doctor_code: 'DOC-000001', user_full_name: 'Dr. Priya Raman', is_active: true },
  treatment_plan: null,
  appointment: null,
  creator: { id: 1, full_name: 'Admin' },
  updater: null,
  invoice_date: '2026-07-23',
  due_date: '2026-08-22',
  currency_code: 'INR',
  notes: 'Follow up call',
  cancellation_reason: null,
  void_reason: null,
  items: [
    {
      id: 'i1',
      sequence_number: 1,
      description: 'Composite restoration — tooth 26',
      quantity: 1,
      unit_price: '320.00',
      discount_type: null,
      discount_value: null,
      net_amount: '320.00',
      tax_amount: null,
      currency_code: 'INR',
    },
  ],
  financials: {
    currency_code: 'INR',
    subtotal: '320.00',
    discount_total: '0.00',
    tax_total: '0.00',
    grand_total: '320.00',
    paid_amount: '0.00',
    outstanding_amount: '320.00',
  },
  version: 1,
  doc_version: 1,
  created_at: '2026-07-23T08:00:00Z',
  updated_at: '2026-07-23T08:00:00Z',
  created_by: 1,
  updated_by: null,
};

describe('EditInvoiceDrawer', () => {
  it('renders the read-only summary and ONLY the editable fields (due date + notes)', () => {
    renderWithProviders(
      <EditInvoiceDrawer open invoice={invoice} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit draft invoice' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Edit draft invoice')).toBeInTheDocument();

    // Read-only summary.
    expect(screen.getByText('Marcus Delaney')).toBeInTheDocument();
    expect(screen.getByText('Dr. Priya Raman')).toBeInTheDocument();
    expect(screen.getByText('₹320.00')).toBeInTheDocument();

    // Only the backend-editable fields exist. Due Date renders as a button
    // trigger (DatePicker) whose accessible name carries the label + value;
    // Notes is a textarea.
    expect(screen.getByRole('button', { name: /Aug 22, 2026/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unit price')).not.toBeInTheDocument();

    // The backend limitation is explained.
    expect(screen.getByText(/Line items cannot be edited in this release/)).toBeInTheDocument();
  });

  it('prefills the form from the aggregate (notes + due date)', async () => {
    renderWithProviders(
      <EditInvoiceDrawer open invoice={invoice} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    // Due Date is a DatePicker — its button trigger shows the formatted value.
    expect(screen.getByRole('button', { name: /Aug 22, 2026/ })).toBeInTheDocument();
    expect((screen.getByLabelText(/notes/i) as HTMLTextAreaElement).value).toBe('Follow up call');

    // A valid prefilled draft can be saved without any edits — the drawer runs
    // `trigger()` after reset so isValid reflects the loaded draft (async).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled(),
    );
  });

  it('submits only the editable payload on save', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <EditInvoiceDrawer open invoice={invoice} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Updated note' } });
    const save = screen.getByRole('button', { name: 'Save changes' });
    // isValid updates asynchronously after the change — click only once enabled.
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // handleSubmit passes the event as the second argument — assert the payload.
    expect(onSubmit.mock.calls[0][0]).toEqual({
      due_date: '2026-08-22',
      notes: 'Updated note',
    });
  });

  it('shows a loading skeleton while the aggregate is fetched lazily', () => {
    renderWithProviders(
      <EditInvoiceDrawer
        open
        invoice={null}
        loading
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Loading invoice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('surfaces a server error message', () => {
    renderWithProviders(
      <EditInvoiceDrawer
        open
        invoice={invoice}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        serverMessage="Due date cannot be before the invoice date"
      />,
    );

    expect(screen.getByText('Due date cannot be before the invoice date')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(
      <EditInvoiceDrawer open={false} invoice={null} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
