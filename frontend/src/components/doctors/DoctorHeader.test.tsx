import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorHeader } from './DoctorHeader';
import type { DoctorProfileResponse } from '../../types/doctor';

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
  specializations: [],
  created_by: 1,
  updated_by: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-06-01T00:00:00',
  schedules: [],
};

describe('DoctorHeader', () => {
  it('renders name, code and lifecycle badges', () => {
    renderWithProviders(<DoctorHeader doctor={profile} />);

    expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    expect(screen.getByText('DOC-000001')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('On Duty')).toBeInTheDocument();
  });

  it('shows On Leave and Unavailable when flags are set', () => {
    renderWithProviders(
      <DoctorHeader
        doctor={{ ...profile, on_leave: true, available_for_appointment: false }}
      />,
    );

    expect(screen.getByText('On Leave')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('shows Inactive when the doctor is deactivated', () => {
    renderWithProviders(<DoctorHeader doctor={{ ...profile, is_active: false }} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders demographic facts (DOB, gender, phone)', () => {
    renderWithProviders(<DoctorHeader doctor={profile} />);

    // Apr 12, 1985 via formatISODate
    expect(screen.getByText('Apr 12, 1985')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('+639123456789')).toBeInTheDocument();
  });

  it('renders the actions slot', () => {
    const onEdit = vi.fn();
    renderWithProviders(
      <DoctorHeader
        doctor={profile}
        actions={<button type="button" onClick={onEdit}>Edit</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
