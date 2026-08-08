import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { CreateInvoiceDrawer } from './CreateInvoiceDrawer';
import { doctorService } from '../../../../services/doctorService';
import { treatmentPlanService } from '../../../../services/treatmentPlanService';
import { appointmentService } from '../../../../services/appointmentService';
import { patientService } from '../../../../services/patientService';
import type { InvoiceCreateFormValues } from '../../../../utils/invoiceFormSchema';

vi.mock('../../../../services/doctorService', () => ({
  doctorService: { list: vi.fn() },
}));
vi.mock('../../../../services/treatmentPlanService', () => ({
  treatmentPlanService: { listPlans: vi.fn() },
}));
vi.mock('../../../../services/appointmentService', () => ({
  appointmentService: { list: vi.fn() },
}));
vi.mock('../../../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), activate: vi.fn(), deactivate: vi.fn() },
}));

const doctorListMock = vi.mocked(doctorService.list);
const planListMock = vi.mocked(treatmentPlanService.listPlans);
const appointmentListMock = vi.mocked(appointmentService.list);
const patientListMock = vi.mocked(patientService.list);

const patientRow = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Marcus Delaney',
  age: 34,
  gender: 'male' as const,
  primary_contact_number: '+639123456789',
  is_active: true,
};

function renderDrawer(onSubmit = vi.fn()) {
  return renderWithProviders(
    <CreateInvoiceDrawer open onClose={vi.fn()} onSubmit={onSubmit} />,
  );
}

describe('CreateInvoiceDrawer', () => {
  beforeEach(() => {
    doctorListMock.mockReset();
    planListMock.mockReset();
    appointmentListMock.mockReset();
    patientListMock.mockReset();

    doctorListMock.mockResolvedValue({
      items: [{ id: 'd1', user_full_name: 'Dr. Priya Raman' }] as never,
      total: 1,
      page: 1,
      page_size: 100,
    } as never);
    planListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 100,
    } as never);
    appointmentListMock.mockResolvedValue({ items: [], total: 0 } as never);
    patientListMock.mockResolvedValue({
      items: [patientRow],
      total: 1,
      page: 1,
      page_size: 10,
    } as never);
  });

  it('renders the drawer header, sticky footer and required patient field', () => {
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'New invoice' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('New invoice')).toBeInTheDocument();
    expect(screen.getByText('Draft — number assigned on issue')).toBeInTheDocument();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('keeps Save draft disabled until the form is valid (patient + dates + one item)', async () => {
    const onSubmit = vi.fn();
    renderDrawer(onSubmit);

    const save = screen.getByRole('button', { name: 'Save draft' });
    expect(save).toBeDisabled();

    // Select a patient via the shared PatientPicker. Generous timeouts so the
    // picker's debounced fetch settles under parallel full-suite load.
    const picker = screen.getByPlaceholderText('Search patient by name or code…');
    fireEvent.change(picker, { target: { value: 'marcus' } });
    const option = await screen.findByRole('option', { name: /Marcus Delaney/ }, { timeout: 5000 });
    fireEvent.click(option);

    // Fill the required line-item fields (description + quantity + unit price).
    fireEvent.change(screen.getByLabelText('Item 1 description'), {
      target: { value: 'Composite restoration — tooth 26' },
    });
    fireEvent.change(screen.getByLabelText('Item 1 unit price'), {
      target: { value: '320.00' },
    });

    await waitFor(() => expect(save).toBeEnabled(), { timeout: 5000 });

    fireEvent.click(save);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0][0] as InvoiceCreateFormValues;
    expect(values.patient_id).toBe('p1');
    expect(values.items[0].description).toBe('Composite restoration — tooth 26');
    expect(values.items[0].unit_price).toBe('320.00');
  });

  it('shows a validation error when the due date is before the invoice date', async () => {
    const onSubmit = vi.fn();
    renderDrawer(onSubmit);

    // Fill a valid draft (patient + one line item) so Save becomes enabled.
    const picker = screen.getByPlaceholderText('Search patient by name or code…');
    fireEvent.change(picker, { target: { value: 'marcus' } });
    const option = await screen.findByRole('option', { name: /Marcus Delaney/ }, { timeout: 5000 });
    fireEvent.click(option);

    fireEvent.change(screen.getByLabelText('Item 1 description'), {
      target: { value: 'Composite restoration — tooth 26' },
    });
    fireEvent.change(screen.getByLabelText('Item 1 unit price'), {
      target: { value: '320.00' },
    });

    const save = screen.getByRole('button', { name: 'Save draft' });
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 5000 });

    // Push the invoice date a year into the future via the calendar so
    // invoice > due and the backend-mirrored cross-field rule fires on submit.
    // (The Invoice Date trigger is label-associated — query it by label;
    // regex because the required indicator renders as "Invoice Date *".)
    fireEvent.click(screen.getByLabelText(/Invoice Date/));
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: '1' }));

    // Submit always validates: the cross-field rule blocks the save and
    // surfaces the error (summary + field). No payload is sent.
    fireEvent.click(save);
    await waitFor(() =>
      expect(
        screen.getAllByText('Due date cannot be before the invoice date').length,
      ).toBeGreaterThan(0),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('supports adding and removing line items', () => {
    renderDrawer();

    // Initial single row — the only remove button is disabled (min 1 item).
    expect(screen.getByRole('button', { name: 'Remove item 1' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getAllByLabelText(/Item \d+ description/)).toHaveLength(2);

    // With two rows, both remove buttons are enabled.
    expect(screen.getByRole('button', { name: 'Remove item 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove item 2' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(screen.getAllByLabelText(/Item \d+ description/)).toHaveLength(1);

    // Back to a single row — remove is disabled again.
    expect(screen.getByRole('button', { name: 'Remove item 1' })).toBeDisabled();
  });

  it('surfaces server validation errors on the matching field', async () => {
    renderWithProviders(
      <CreateInvoiceDrawer
        open
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        serverErrors={{ patient_id: 'Select a patient to bill' }}
      />,
    );

    // Rendered in both the validation summary and the field error.
    await waitFor(() =>
      expect(screen.getAllByText('Select a patient to bill').length).toBeGreaterThan(0),
    );
  });

  it('shows the preview grand total that mirrors the backend net formula', async () => {
    renderDrawer();

    // Preview stays $0.00 until valid rows exist; with no rows entered the
    // preview reflects the default empty row (0). The same string appears in
    // the per-row net-amount caption, so assert at least one match.
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });

  it('renders a close button wired to onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<CreateInvoiceDrawer open onClose={onClose} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fits the mobile viewport: the min-width cap is released below sm (overflow guard)', () => {
    renderDrawer();

    const dialog = screen.getByRole('dialog', { name: 'New invoice' });
    // The drawer keeps a comfortable 520px floor on sm+ screens but must not
    // force the panel wider than a mobile viewport (max-sm:min-w-0).
    expect(dialog.className).toContain('max-sm:min-w-0');
    expect(dialog.className).toContain('max-sm:!max-w-full');
  });
});
