import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { DoctorListPage } from './DoctorListPage';
import { doctorService } from '../../services/doctorService';

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

describe('DoctorListPage', () => {
  beforeEach(() => {
    vi.mocked(doctorService.list).mockReset();
    vi.mocked(doctorService.list).mockResolvedValue({
      items: [
        {
          id: 'd1',
          doctor_code: 'DOC-000001',
          user_id: 3,
          user_full_name: 'Dr. Jose Rizal',
          user_email: 'jose@clinic.com',
          date_of_birth: null,
          gender: null,
          primary_phone: '+639123456789',
          address: null,
          qualification: null,
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
          updated_at: '2024-01-01T00:00:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    vi.mocked(doctorService.listSpecializations).mockReset();
    vi.mocked(doctorService.listSpecializations).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 100,
    });
  });

  it('renders the page header and composes the doctor list container', async () => {
    renderWithProviders(<DoctorListPage />);

    expect(screen.getByRole('heading', { name: 'Doctors' })).toBeInTheDocument();
    expect(screen.getByText('Search, filter and manage doctor records.')).toBeInTheDocument();

    // The composed container fetches and renders the list.
    await waitFor(() => expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument());
  });
});
