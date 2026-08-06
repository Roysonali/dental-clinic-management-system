import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorSpecializationsSection } from './DoctorSpecializationsSection';
import type { DoctorResponse } from '../../types/doctor';

const baseDoctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: null,
  date_of_birth: null,
  gender: null,
  primary_phone: '+639123456789',
  address: null,
  qualification: null,
  registration_number: null,
  years_of_experience: null,
  consultation_fee: null,
  consultation_duration: null,
  languages_known: null,
  profile_photo_url: null,
  biography: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [],
  created_by: 1,
  updated_by: 1,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-06-01T00:00:00',
};

describe('DoctorSpecializationsSection', () => {
  it('renders specialization name, code, primary badge and certification date', () => {
    renderWithProviders(
      <DoctorSpecializationsSection
        doctor={{
          ...baseDoctor,
          specializations: [
            {
              specialization_id: 1,
              specialization_name: 'Orthodontics',
              specialization_code: 'ORTHO',
              is_primary: true,
              certification_date: '2020-06-15',
            },
            {
              specialization_id: 2,
              specialization_name: 'Endodontics',
              specialization_code: 'ENDO',
              is_primary: false,
              certification_date: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Orthodontics')).toBeInTheDocument();
    expect(screen.getByText('Endodontics')).toBeInTheDocument();
    // Codes render inline with certification info (single text node), so
    // use substring matchers.
    expect(screen.getByText(/ORTHO/)).toBeInTheDocument();
    expect(screen.getByText(/ENDO/)).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText(/Certified Jun 15, 2020/)).toBeInTheDocument();
  });

  it('renders the empty state when no specializations are assigned', () => {
    renderWithProviders(<DoctorSpecializationsSection doctor={baseDoctor} />);
    expect(screen.getByText('No specializations')).toBeInTheDocument();
  });
});
