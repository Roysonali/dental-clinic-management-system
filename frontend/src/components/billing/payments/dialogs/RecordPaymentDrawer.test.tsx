import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { RecordPaymentDrawer } from './RecordPaymentDrawer';
import { patientService } from '../../../../services/patientService';
import type { PaymentFormValues } from '../../../../utils/paymentFormSchema';
import type { PatientListItem } from '../../../../types/patient';

vi.mock('../../../../services/patientService', () => ({
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

const patient: PatientListItem = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  age: 34,
  gender: 'male',
  primary_contact_number: '+1-555-0100',
  is_active: true,
};

function renderDrawer(overrides: Partial<Parameters<typeof RecordPaymentDrawer>[0]> = {}) {
  const props: Parameters<typeof RecordPaymentDrawer>[0] = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    submitting: false,
    ...overrides,
  };
  return renderWithProviders(<RecordPaymentDrawer {...props} />);
}

describe('RecordPaymentDrawer', () => {
  beforeEach(() => {
    patientListMock.mockReset();
    patientListMock.mockResolvedValue({
      items: [patient],
      total: 1,
      page: 1,
      page_size: 10,
    });
  });

  it('renders the header, fields and pinned footer', () => {
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(within(dialog).getByText('Record payment')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Saved as PENDING · number PAY-##### assigned on save/),
    ).toBeInTheDocument();

    // Fields with labels + required markers.
    expect(within(dialog).getByLabelText(/Patient/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Payment Method/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Total Amount/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Payment Date/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Reference Number/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Notes/)).toBeInTheDocument();

    // Footer actions.
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save payment' })).toBeInTheDocument();

    // Lifecycle notice (backend fact, not invented workflow).
    expect(
      within(dialog).getByText(/created as pending\. Complete it before allocating to invoices or generating a receipt\./),
    ).toBeInTheDocument();
  });

  it('presents the total amount in INR with the INR helper text (no USD)', () => {
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Record payment' });

    // ₹ prefix renders inside the Total Amount field wrapper (scoped to the
    // input's wrapper so a future ₹-bearing string elsewhere can't false-pass).
    const amountInput = within(dialog).getByLabelText(/Total Amount/);
    const amountWrapper = amountInput.closest('.relative');
    expect(amountWrapper).not.toBeNull();
    expect(within(amountWrapper as HTMLElement).getByText('₹')).toBeInTheDocument();

    // The helper text (wired via aria-describedby) explains the precision.
    const helperId = amountInput.getAttribute('aria-describedby');
    expect(helperId).toBeTruthy();
    const helper = document.getElementById(helperId!);
    expect(helper?.textContent).toContain('INR — up to two decimal places');

    // No USD presentation anywhere in the drawer.
    expect(within(dialog).queryByText('$')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/USD/)).not.toBeInTheDocument();
  });

  it('keeps Save disabled until the form is valid', async () => {
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    const save = within(dialog).getByRole('button', { name: 'Save payment' });
    expect(save).toBeDisabled();
  });

  it('submits mapped values for a valid payment', async () => {
    const onSubmit = vi.fn();
    renderDrawer({ onSubmit });

    const dialog = screen.getByRole('dialog', { name: 'Record payment' });

    // Select the patient through the shared PatientPicker.
    fireEvent.change(within(dialog).getByPlaceholderText('Search patient by name or code…'), {
      target: { value: 'marcus' },
    });
    const option = await screen.findByRole('option', { name: /Marcus Delaney/ });
    fireEvent.click(option);

    fireEvent.change(within(dialog).getByLabelText(/Payment Method/), {
      target: { value: 'card' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Total Amount/), {
      target: { value: '1500.50' },
    });
    // Payment Date defaults to today (backend allows any date) — unchanged.
    fireEvent.change(within(dialog).getByLabelText(/Reference Number/), {
      target: { value: 'TXN-123' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Notes/), {
      target: { value: 'Paid via gateway' },
    });

    const save = within(dialog).getByRole('button', { name: 'Save payment' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0] as PaymentFormValues;
    expect(values.patient_id).toBe('p1');
    expect(values.payment_method).toBe('card');
    expect(values.total_amount).toBe('1500.50');
    expect(values.payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.reference_number).toBe('TXN-123');
    expect(values.notes).toBe('Paid via gateway');
  });

  it('shows inline validation errors without submitting', async () => {
    const onSubmit = vi.fn();
    renderDrawer({ onSubmit });

    const dialog = screen.getByRole('dialog', { name: 'Record payment' });

    // Enter an invalid amount.
    fireEvent.change(within(dialog).getByLabelText(/Total Amount/), {
      target: { value: '0' },
    });

    // The message appears inline under the field AND in the ValidationSummary.
    await waitFor(() => {
      expect(within(dialog).getAllByText('Amount must be greater than 0').length).toBeGreaterThan(0);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces a server error alert and keeps the drawer open', () => {
    renderDrawer({ serverMessage: 'Payment number reservation failed' });

    expect(screen.getByRole('alert').textContent).toContain('Payment number reservation failed');
  });
});
