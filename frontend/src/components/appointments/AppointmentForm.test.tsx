import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentForm } from './AppointmentForm';
import type { AppointmentFormValues } from '../../types/appointment';

// PatientPicker owns its own search query — substitute a plain input so the
// form test stays focused on validation/submission behaviour.
vi.mock('./PatientPicker', () => ({
  PatientPicker: ({
    value,
    onChange,
    error,
    disabled,
    helperText,
  }: {
    value: string;
    onChange: (v: string) => void;
    error?: string;
    disabled?: boolean;
    helperText?: string;
  }) => (
    <div>
      <label htmlFor="patient-picker-mock">Patient</label>
      <input
        id="patient-picker-mock"
        aria-label="Patient"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span role="alert">{error}</span>}
      {helperText && <span>{helperText}</span>}
    </div>
  ),
}));

const dentistOptions = [
  { value: '3', label: 'Dr. Jose Rizal' },
  { value: '4', label: 'Dr. Maria Clara' },
];

const completeValues: AppointmentFormValues = {
  patient_id: 'p1',
  dentist_id: '3',
  appointment_date: '2026-07-08',
  start_time: '10:00',
  duration_minutes: '30',
  appointment_type: 'Consultation',
  reason_for_visit: 'Toothache',
  notes: '',
};

describe('AppointmentForm', () => {
  it('renders all schedule fields', () => {
    renderWithProviders(
      <AppointmentForm dentistOptions={dentistOptions} patientEditable onSubmit={vi.fn()} />,
    );

    expect(screen.getByLabelText('Patient')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /dentist/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /appointment type/i })).toBeInTheDocument();
    expect(screen.getByText(/appointment date/i)).toBeInTheDocument();
    expect(screen.getByText(/start time/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /duration/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/reason for visit/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('shows validation errors when submitting an empty form', async () => {
    renderWithProviders(
      <AppointmentForm dentistOptions={dentistOptions} patientEditable onSubmit={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Appointment' }));

    // Messages appear both inline on the field and in the ValidationSummary.
    expect((await screen.findAllByText('Patient is required')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dentist is required').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Appointment type is required').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reason for visit must be at least 3 characters').length).toBeGreaterThan(0);
  });

  it('submits valid values', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <AppointmentForm
        dentistOptions={dentistOptions}
        patientEditable
        onSubmit={onSubmit}
        initialValues={completeValues}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Appointment' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const received = onSubmit.mock.calls[0][0] as AppointmentFormValues;
    expect(received).toEqual(completeValues);
  });

  it('rejects Sundays (backend clinic working-days rule)', async () => {
    // 2026-07-05 is a Sunday.
    renderWithProviders(
      <AppointmentForm
        dentistOptions={dentistOptions}
        patientEditable
        onSubmit={vi.fn()}
        initialValues={{ ...completeValues, appointment_date: '2026-07-05' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Appointment' }));
    expect(
      (await screen.findAllByText('The clinic is closed on Sundays.')).length,
    ).toBeGreaterThan(0);
  });

  it('rejects times outside clinic sessions (backend working-hours rule)', async () => {
    renderWithProviders(
      <AppointmentForm
        dentistOptions={dentistOptions}
        patientEditable
        onSubmit={vi.fn()}
        initialValues={{ ...completeValues, start_time: '15:00' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Appointment' }));
    expect(
      (await screen.findAllByText(
        'Appointment must be within clinic hours (10:00 AM – 1:00 PM or 5:00 – 9:00 PM).',
      )).length,
    ).toBeGreaterThan(0);
  });

  it('keeps the patient locked in edit mode', () => {
    renderWithProviders(
      <AppointmentForm
        dentistOptions={dentistOptions}
        patientEditable={false}
        patientName="Juan Dela Cruz"
        onSubmit={vi.fn()}
        initialValues={completeValues}
      />,
    );

    expect(screen.getByLabelText('Patient')).toBeDisabled();
    expect(screen.getByText('The patient cannot be changed after booking.')).toBeInTheDocument();
  });

  it('disables the dentist select while dentists are loading', () => {
    renderWithProviders(
      <AppointmentForm
        dentistOptions={[]}
        dentistsLoading
        patientEditable
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('combobox', { name: /dentist/i })).toBeDisabled();
  });

  it('explains the cause when the dentist list failed to load (403 for some roles)', () => {
    renderWithProviders(
      <AppointmentForm
        dentistOptions={[]}
        dentistsError
        patientEditable
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/the dentist list couldn't be loaded/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/requires Admin or Receptionist access/i),
    ).toBeInTheDocument();
    // The select itself stays interactive with its default placeholder — the
    // explanation banner is what prevents a confusing empty state.
    expect(screen.getByRole('combobox', { name: /dentist/i })).toBeEnabled();
  });
});
