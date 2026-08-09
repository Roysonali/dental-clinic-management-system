import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { MobileCreateInvoiceForm } from './MobileCreateInvoiceForm';
import { patientService } from '../../../services/patientService';

vi.mock('../../../services/patientService', () => ({
  patientService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const patientListMock = vi.mocked(patientService.list);

const patient = {
  id: 'p1',
  patient_code: 'PT-00318',
  full_name: 'Marcus Delaney',
  is_active: true,
};

function renderForm(onSubmit = vi.fn()) {
  return renderWithProviders(
    <MobileCreateInvoiceForm open onClose={vi.fn()} onSubmit={onSubmit} submitting={false} />,
  );
}

describe('MobileCreateInvoiceForm', () => {
  beforeEach(() => {
    patientListMock.mockReset();
    patientListMock.mockResolvedValue({
      items: [patient],
      total: 1,
      page: 1,
      page_size: 10,
    } as never);
  });

  it('renders the full-screen form header, fields, line-item card and fixed footer', () => {
    renderForm();

    const dialog = screen.getByRole('dialog', { name: 'New invoice' });
    expect(within(dialog).getByRole('heading', { name: 'New invoice' })).toBeInTheDocument();
    expect(within(dialog).getByText('Draft — number assigned on issue')).toBeInTheDocument();
    expect(within(dialog).getByText('Due Date')).toBeInTheDocument();
    expect(within(dialog).getByText('Notes')).toBeInTheDocument();
    expect(within(dialog).getByText('Line item 1')).toBeInTheDocument();
    expect(within(dialog).getByText('Grand total')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save draft' })).toBeInTheDocument();
    // Notes counter uses the real backend limit (2000), not the reference's 500.
    expect(within(dialog).getByText('0/2000')).toBeInTheDocument();
  });

  it('keeps Save draft disabled until the required fields are valid', () => {
    renderForm();

    const save = screen.getByRole('button', { name: 'Save draft' });
    expect(save).toBeDisabled();
  });

  it('submits the same backend payload shape as the desktop drawer', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);

    const dialog = screen.getByRole('dialog', { name: 'New invoice' });

    // Select patient (the picker needs a real patient to search against).
    fireEvent.change(within(dialog).getByPlaceholderText('Search patient by name or code…'), {
      target: { value: 'marcus' },
    });
    const option = await screen.findByRole('option', { name: /Marcus Delaney/ }, { timeout: 5000 });
    fireEvent.click(option);

    // Fill the line item.
    fireEvent.change(within(dialog).getByLabelText('Line item 1 description'), {
      target: { value: 'Composite restoration — 26' },
    });
    fireEvent.change(within(dialog).getByLabelText('Line item 1 unit price'), {
      target: { value: '320' },
    });

    const save = within(dialog).getByRole('button', { name: 'Save draft' });
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(save);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0] as {
      patient_id: string;
      due_date: string;
      items: { description: string; quantity: string; unit_price: string }[];
    };
    expect(values.patient_id).toBe('p1');
    expect(values.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.items[0]).toMatchObject({
      description: 'Composite restoration — 26',
      quantity: '1',
      unit_price: '320',
    });
  });

  it('shows inline validation errors for an invalid line item', async () => {
    renderForm();

    const dialog = screen.getByRole('dialog', { name: 'New invoice' });
    const price = within(dialog).getByLabelText('Line item 1 unit price');
    fireEvent.change(price, { target: { value: '-5' } });

    expect(await screen.findByText('Unit price must be 0 or more')).toBeInTheDocument();
  });
});
