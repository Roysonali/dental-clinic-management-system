import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorProfileCard } from './DoctorProfileCard';
import { DoctorClinicalCard } from './DoctorClinicalCard';
import { DoctorEmergencyCard } from './DoctorEmergencyCard';
import type { DoctorResponse } from '../../types/doctor';

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-04-12',
  gender: 'male',
  primary_phone: '+639123456789',
  address: '123 Rizal St.',
  qualification: 'DMD, UP Manila',
  registration_number: 'DEN-2020-12345',
  years_of_experience: 12,
  consultation_fee: 800,
  consultation_duration: 30,
  languages_known: ['English', 'Filipino'],
  profile_photo_url: null,
  biography: 'Seasoned practitioner with a focus on preventive care.',
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
};

describe('DoctorProfileCard', () => {
  it('renders backend-mapped identity fields', () => {
    renderWithProviders(<DoctorProfileCard doctor={doctor} />);

    expect(screen.getByText('Doctor Information')).toBeInTheDocument();
    expect(screen.getByText('DOC-000001')).toBeInTheDocument();
    expect(screen.getByText('jose@clinic.com')).toBeInTheDocument();
    expect(screen.getByText('123 Rizal St.')).toBeInTheDocument();
    expect(screen.getByText('DEN-2020-12345')).toBeInTheDocument();
    expect(screen.getByText('English, Filipino')).toBeInTheDocument();
    expect(screen.getByText('Male')).toBeInTheDocument();
  });

  it('shows em-dashes for missing optional fields', () => {
    renderWithProviders(
      <DoctorProfileCard
        doctor={{ ...doctor, user_email: null, address: null, registration_number: null, languages_known: null, gender: null }}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});

describe('DoctorClinicalCard', () => {
  it('renders clinical fields with formatted fee and duration', () => {
    renderWithProviders(<DoctorClinicalCard doctor={doctor} />);

    expect(screen.getByText('Clinical Information')).toBeInTheDocument();
    expect(screen.getByText('DMD, UP Manila')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('₹800.00')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('Seasoned practitioner with a focus on preventive care.')).toBeInTheDocument();
  });

  it('renders em-dashes and hides biography when absent', () => {
    renderWithProviders(
      <DoctorClinicalCard doctor={{ ...doctor, qualification: null, years_of_experience: null, consultation_fee: null, consultation_duration: null, biography: null }} />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('Biography')).not.toBeInTheDocument();
  });
});

describe('DoctorEmergencyCard', () => {
  it('renders emergency contact details', () => {
    renderWithProviders(<DoctorEmergencyCard doctor={doctor} />);
    expect(screen.getByText('Emergency Contact')).toBeInTheDocument();
    expect(screen.getByText('Maria Rizal')).toBeInTheDocument();
    expect(screen.getByText('+639987654321')).toBeInTheDocument();
  });

  it('shows em-dashes when no emergency contact is set', () => {
    renderWithProviders(
      <DoctorEmergencyCard doctor={{ ...doctor, emergency_contact_name: null, emergency_contact_phone: null }} />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
