import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorDetailsPage } from './DoctorDetailsPage';
import { doctorService } from '../../services/doctorService';
import type { DoctorProfileResponse } from '../../types/doctor';

vi.mock('../../services/doctorService', () => ({
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

const profile: DoctorProfileResponse = {
  id: 'd1',
  doctor_code: 'DOC-000001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-04-12',
  gender: 'male',
  primary_phone: '+639123456789',
  address: null,
  qualification: 'DMD',
  registration_number: null,
  years_of_experience: 12,
  consultation_fee: 800,
  consultation_duration: 30,
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
  schedules: [],
};

describe('DoctorDetailsPage', () => {
  beforeEach(() => {
    vi.mocked(doctorService.getProfile).mockReset();
    vi.mocked(doctorService.getProfile).mockResolvedValue(profile);
  });

  it('composes the doctor details container at /doctors/:doctorId', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/doctors/:doctorId" element={<DoctorDetailsPage />} />
      </Routes>,
      { route: '/doctors/d1' },
    );

    // The composed container fetches the profile and renders the header.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dr. Jose Rizal' })).toBeInTheDocument();
    });
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
