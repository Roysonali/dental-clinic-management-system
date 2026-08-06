import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorForm } from './DoctorForm';
import { userService } from '../../services/userService';
import type { DoctorFormValues } from '../../types/doctor';
import type { UserListResponse } from '../../types/user';

// The create-mode form renders the shared UserSearchSelect, which hits
// GET /users — mock the service so the picker resolves deterministically.
vi.mock('../../services/userService', () => ({
  userService: {
    list: vi.fn(),
  },
}));

const listMock = vi.mocked(userService.list);

const userResponse: UserListResponse = {
  items: [
    {
      id: 3,
      full_name: 'Dr. Jose Rizal',
      email: 'jose@clinic.com',
      status: 'active',
      is_active: true,
      role_id: 3,
      role_name: 'GENERAL_DOCTOR',
      last_login_at: null,
      created_at: null,
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
};

describe('DoctorForm', () => {
  it('renders all backend-mapped fields', () => {
    renderWithProviders(<DoctorForm mode="create" onSubmit={vi.fn()} />);

    // Identity (create only)
    expect(screen.getByRole('combobox', { name: 'User' })).toBeInTheDocument();
    // The DatePicker trigger is a button (not a labelled input) — assert on
    // its label text and trigger, matching the Patient test conventions.
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
    expect(screen.getByLabelText('Gender')).toBeInTheDocument();
    expect(screen.getByLabelText(/primary phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Profile Photo URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Qualification')).toBeInTheDocument();
    expect(screen.getByLabelText('Registration Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Years of Experience')).toBeInTheDocument();
    expect(screen.getByLabelText('Consultation Fee')).toBeInTheDocument();
    expect(screen.getByLabelText('Consultation Duration (minutes)')).toBeInTheDocument();
    expect(screen.getByLabelText('Languages Known')).toBeInTheDocument();
    expect(screen.getByLabelText('Biography')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency Contact Name')).toBeInTheDocument();
    expect(screen.getByLabelText(/emergency contact phone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Doctor' })).toBeInTheDocument();
  });

  it('hides the user picker in edit mode', () => {
    renderWithProviders(<DoctorForm mode="edit" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('combobox', { name: 'User' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Doctor' })).toBeInTheDocument();
  });

  it('shows required-field validation errors on empty submit (create)', async () => {
    renderWithProviders(<DoctorForm mode="create" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Doctor' }));

    await waitFor(() => {
      expect(screen.getAllByText('User is required').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Phone is required').length).toBeGreaterThan(0);
    });
  });

  it('rejects invalid phone numbers (backend doctor pattern)', async () => {
    renderWithProviders(
      <DoctorForm mode="create" onSubmit={vi.fn()} initialValues={{ user_id: '3' }} />,
    );
    fireEvent.change(screen.getByLabelText(/primary phone/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Doctor' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Phone must be 10–15 digits/i).length).toBeGreaterThan(0);
    });
  });

  it('calls onSubmit with mapped values for a valid create submission', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <DoctorForm
        mode="create"
        onSubmit={onSubmit}
        initialValues={{ user_id: '3', date_of_birth: '1985-04-12', gender: 'male' }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/primary phone/i), { target: { value: '+639123456789' } });
    fireEvent.change(screen.getByLabelText('Years of Experience'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Consultation Fee'), { target: { value: '800.00' } });
    fireEvent.change(screen.getByLabelText('Consultation Duration (minutes)'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Languages Known'), { target: { value: 'English, Filipino' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Doctor' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const values = onSubmit.mock.calls[0][0] as DoctorFormValues;
    expect(values.user_id).toBe('3');
    expect(values.primary_phone).toBe('+639123456789');
    expect(values.years_of_experience).toBe('12');
    expect(values.consultation_fee).toBe('800.00');
    expect(values.consultation_duration).toBe('30');
    expect(values.languages_known).toEqual(['English', 'Filipino']);
    expect(values.date_of_birth).toBe('1985-04-12');
    expect(values.gender).toBe('male');
  });

  it('surfaces server-side field errors and banner messages', () => {
    renderWithProviders(
      <DoctorForm
        mode="edit"
        onSubmit={vi.fn()}
        serverErrors={{ registration_number: 'Registration number already exists.' }}
        serverMessage="Possible duplicate doctor detected"
      />,
    );

    expect(screen.getByText('Registration number already exists.')).toBeInTheDocument();
    expect(screen.getByText('Possible duplicate doctor detected')).toBeInTheDocument();
  });

  it('pre-fills initial values in edit mode', () => {
    renderWithProviders(
      <DoctorForm
        mode="edit"
        onSubmit={vi.fn()}
        initialValues={{ primary_phone: '+639123456789', years_of_experience: '12' }}
      />,
    );
    expect(screen.getByLabelText(/primary phone/i)).toHaveValue('+639123456789');
    // type="number" inputs expose a numeric DOM value.
    expect(screen.getByLabelText('Years of Experience')).toHaveValue(12);
  });

  it('supports selecting a user through the shared UserSearchSelect', async () => {
    listMock.mockReset();
    listMock.mockResolvedValue(userResponse);
    const onSubmit = vi.fn();

    renderWithProviders(<DoctorForm mode="create" onSubmit={onSubmit} />);

    const picker = screen.getByRole('combobox', { name: 'User' });
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: 'jose' } });

    // Match by visible text — the option button's accessible name is computed
    // from the avatar (aria-label) + name + email + role, so a plain role+name
    // query is brittle; assert on the row text instead.
    const option = await screen.findByRole('option', { name: /jose@clinic\.com/i });
    fireEvent.click(option);

    fireEvent.change(screen.getByLabelText(/primary phone/i), { target: { value: '+639123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Doctor' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0][0] as DoctorFormValues).user_id).toBe('3');
  });
});
