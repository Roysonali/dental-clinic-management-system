import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { DoctorDetailsContainer } from './DoctorDetailsContainer';
import { doctorService } from '../../../services/doctorService';
import type { DoctorProfileResponse } from '../../../types/doctor';

vi.mock('../../../services/doctorService', () => ({
  doctorService: {
    list: vi.fn(),
    get: vi.fn(),
    getByUserId: vi.fn(),
    getProfile: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    toggleLeave: vi.fn(),
    toggleAvailability: vi.fn(),
    delete: vi.fn(),
    listSpecializations: vi.fn(),
  },
}));

// Sprint 11C: admin identity so ADMIN-only status actions render in tests.
const permissionMock = {
  state: { status: 'admin' as const, role: { role_id: 1, role_name: 'ADMIN' } },
  isAdmin: true,
  isResolved: true,
  role: 'ADMIN' as const,
  can: vi.fn(() => true),
};

vi.mock('../../../hooks/rbac/usePermission', () => ({
  usePermission: () => permissionMock,
}));

const profile: DoctorProfileResponse = {
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-04-12',
  gender: 'male',
  primary_phone: '+639123456789',
  address: '123 Rizal St.',
  qualification: 'DMD',
  registration_number: 'DEN-2020-12345',
  years_of_experience: 12,
  consultation_fee: 800,
  consultation_duration: 30,
  languages_known: ['English', 'Filipino'],
  profile_photo_url: null,
  biography: 'Seasoned practitioner.',
  emergency_contact_name: 'Maria Rizal',
  emergency_contact_phone: '+639987654321',
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [
    { specialization_id: 1, specialization_name: 'Orthodontics', specialization_code: 'ORTHO', is_primary: true, certification_date: '2020-06-15' },
  ],
  created_by: 1,
  updated_by: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-06-01T00:00:00',
  schedules: [
    { id: 's1', doctor_id: 'd1', day_of_week: 0, start_time: '09:00:00', end_time: '12:00:00', is_active: true },
  ],
};

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/doctors/:doctorId" element={<DoctorDetailsContainer />} />
    </Routes>,
    { route: '/doctors/d1' },
  );
}

describe('DoctorDetailsContainer', () => {
  const getProfileMock = vi.mocked(doctorService.getProfile);

  beforeEach(() => {
    vi.mocked(doctorService.activate).mockReset();
    vi.mocked(doctorService.deactivate).mockReset();
    vi.mocked(doctorService.toggleLeave).mockReset();
    vi.mocked(doctorService.toggleAvailability).mockReset();
    vi.mocked(doctorService.get).mockReset();
    getProfileMock.mockReset();
  });

  it('renders the header, overview cards, schedule and specializations once loaded', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    expect(screen.getByText('Clinical Information')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact')).toBeInTheDocument();
    expect(screen.getByText('Weekly Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Specializations')).toBeInTheDocument();
    expect(screen.getByText('Orthodontics')).toBeInTheDocument();
  });

  it('renders placeholder tabs for unwired modules', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    for (const label of ['Overview', 'Appointments', 'Treatment Plans', 'Billing']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }

    // Placeholder tab content shows an empty state
    fireEvent.click(screen.getByRole('tab', { name: 'Appointments' }));
    expect(await screen.findByText('No appointments')).toBeInTheDocument();
  });

  it('shows a loading state while fetching the profile', () => {
    getProfileMock.mockReturnValue(new Promise(() => {}));
    renderDetails();
    expect(screen.getByRole('status', { name: 'Loading doctor' })).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    getProfileMock.mockRejectedValueOnce(new Error('Doctor does not exist'));
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Unable to load doctor')).toBeInTheDocument();
    });

    getProfileMock.mockResolvedValue(profile);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });
    expect(getProfileMock).toHaveBeenCalledTimes(2);
  });

  it('toggles availability through the confirmation dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleAvailability).mockResolvedValue({
      ...profile,
      available_for_appointment: false,
    });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Availability' }));
    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));
    await waitFor(() => {
      expect(doctorService.toggleAvailability).toHaveBeenCalledWith('d1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('surfaces a backend 400 error inside the availability dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleAvailability).mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Inactive doctors cannot be marked available.' } },
      }),
    );
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Availability' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Inactive doctors cannot be marked available.',
      );
    });
    // Dialog stays open so the user can retry or cancel
    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();
  });

  it('toggles leave through the confirmation dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleLeave).mockResolvedValue({ ...profile, on_leave: true });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Leave' }));
    expect(screen.getByRole('dialog', { name: 'Mark On Leave' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark On Leave' }));
    await waitFor(() => {
      expect(doctorService.toggleLeave).toHaveBeenCalledWith('d1');
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('invalidates the doctor cache after a successful toggle (profile refetch)', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.toggleAvailability).mockResolvedValue({
      ...profile,
      available_for_appointment: false,
    });
    const { queryClient } = renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });
    expect(getProfileMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Availability' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Unavailable' }));

    // Mutation success invalidates the doctors key → the profile refetches.
    await waitFor(() => {
      expect(getProfileMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(queryClient.getQueryData(['doctors', 'profile', 'd1'])).toBeDefined();
  });

  it('opens the edit drawer and fetches the full doctor record', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.get).mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => {
      expect(doctorService.get).toHaveBeenCalledWith('d1');
    });
  });

  it('restores focus to the trigger after closing a toggle dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole('button', { name: 'Toggle Availability' });
    toggleButton.focus();
    fireEvent.click(toggleButton);
    expect(screen.getByRole('dialog', { name: 'Mark Unavailable' })).toBeInTheDocument();

    // Closing via Cancel restores focus to the trigger (Modal focus trap).
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(toggleButton);
    });
  });

  it('deactivates via the status dialog', async () => {
    getProfileMock.mockResolvedValue(profile);
    vi.mocked(doctorService.deactivate).mockResolvedValue({ ...profile, is_active: false });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = screen.getByRole('dialog', { name: 'Deactivate doctor' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(doctorService.deactivate).toHaveBeenCalledWith('d1');
    });
  });
});
