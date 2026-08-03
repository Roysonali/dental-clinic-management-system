import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { PatientFormContainer } from './PatientFormContainer';
import { patientService } from '../../../services/patientService';
import type { PatientResponse } from '../../../types/patient';

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

const createMock = vi.mocked(patientService.create);
const updateMock = vi.mocked(patientService.update);
const getMock = vi.mocked(patientService.get);

const created: PatientResponse = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Juan Dela Cruz',
  date_of_birth: '1990-05-15',
  age: 34,
  gender: 'male',
  primary_contact_number: '+639123456789',
  emergency_contact_number: null,
  email: 'juan@example.com',
  address: '123 Rizal St.',
  remarks: null,
  is_active: true,
  created_by: 1,
  updated_by: 1,
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-06-20T14:45:00Z',
};

/** Fill every required form field (names, phone, DOB via the calendar, gender). */
function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
  fireEvent.change(screen.getByLabelText(/primary contact number/i), {
    target: { value: '+639123456789' },
  });
  fireEvent.change(screen.getByLabelText(/gender/i), { target: { value: 'male' } });

  // DOB: open the calendar and pick day 1 of the current month — always valid
  // (never in the future, year >= 1900) regardless of the test run date.
  fireEvent.click(screen.getByRole('button', { name: 'Select a date' }));
  fireEvent.click(screen.getByRole('button', { name: '1' }));
}

describe('PatientFormContainer', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    getMock.mockReset();
  });

  it('creates a patient on valid submit and closes the drawer', async () => {
    createMock.mockResolvedValue(created);
    const onClose = vi.fn();
    const onCreated = vi.fn();

    renderWithProviders(
      <PatientFormContainer open mode="create" onClose={onClose} onCreated={onCreated} />,
    );

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    const payload = createMock.mock.calls[0][0];
    expect(payload.first_name).toBe('Juan');
    expect(payload.last_name).toBe('Dela Cruz');
    expect(payload.gender).toBe('male');
    expect(payload.date_of_birth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.primary_contact_number).toBe('+639123456789');

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith(created);
    });
  });

  it('invalidates patient queries after a successful create', async () => {
    createMock.mockResolvedValue(created);
    const { queryClient } = renderWithProviders(
      <PatientFormContainer open mode="create" onClose={vi.fn()} />,
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['patients'] });
  });

  it('updates an existing patient on valid submit in edit mode', async () => {
    getMock.mockResolvedValue(created);
    updateMock.mockResolvedValue(created);
    const onClose = vi.fn();

    renderWithProviders(
      <PatientFormContainer open mode="edit" patientId="p1" onClose={onClose} />,
    );

    // Wait for the fetched patient to populate the drawer form.
    await screen.findByLabelText(/first name/i);

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'Juan Carlos' },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    // useUpdatePatient calls patientService.update(id, payload) positionally.
    expect(updateMock).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ first_name: 'Juan Carlos' }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows the server error and keeps the drawer open on mutation failure', async () => {
    createMock.mockRejectedValue(new Error('Possible duplicate patient detected'));
    const onClose = vi.fn();

    renderWithProviders(
      <PatientFormContainer open mode="create" onClose={onClose} />,
    );

    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Possible duplicate patient detected'),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('blocks submission and shows validation errors on an invalid form', async () => {
    renderWithProviders(<PatientFormContainer open mode="create" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => {
      expect(screen.getAllByText('First name is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Last name is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gender is required').length).toBeGreaterThan(0);
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('closes the drawer via the cancel button', () => {
    const onClose = vi.fn();
    renderWithProviders(<PatientFormContainer open mode="create" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
