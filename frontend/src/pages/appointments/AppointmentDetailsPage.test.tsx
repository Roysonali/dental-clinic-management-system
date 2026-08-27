import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentDetailsPage } from './AppointmentDetailsPage';
import { appointmentService } from '../../services/appointmentService';
import { patientService } from '../../services/patientService';
import { doctorService } from '../../services/doctorService';

vi.mock('../../services/appointmentService', () => ({
  appointmentService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    today: vi.fn(),
  },
}));

vi.mock('../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../services/doctorService', () => ({
  doctorService: { list: vi.fn(), getByUserId: vi.fn() },
}));

const getMock = vi.mocked(appointmentService.get);
const patientGetMock = vi.mocked(patientService.get);
const doctorGetMock = vi.mocked(doctorService.getByUserId);

describe('AppointmentDetailsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    patientGetMock.mockReset();
    doctorGetMock.mockReset();

    getMock.mockResolvedValue({
      id: 'a1',
      appointment_number: 'APT-20260707-0001',
      patient_id: 'p1',
      dentist_id: 3,
      appointment_date: '2026-07-08',
      start_time: '10:00:00',
      end_time: '10:30:00',
      duration_minutes: 30,
      appointment_type: 'Consultation',
      status: 'Scheduled',
      reason_for_visit: 'Toothache',
      notes: null,
      created_by: 1,
      updated_by: null,
      created_at: '2026-07-07T08:00:00Z',
      updated_at: '2026-07-07T08:00:00Z',
    });
    patientGetMock.mockResolvedValue({
      id: 'p1',
      patient_code: 'PAT-000001',
      first_name: 'Juan',
      middle_name: null,
      last_name: 'Dela Cruz',
      full_name: 'Juan Dela Cruz',
      date_of_birth: '1990-05-15',
      age: 36,
      gender: 'male',
      primary_contact_number: '+639123456789',
      emergency_contact_number: null,
      email: null,
      address: null,
      remarks: null,
      is_active: true,
      created_by: 1,
      updated_by: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    doctorGetMock.mockResolvedValue({
      id: 'd1',
      doctor_code: 'DOC-00001',
      user_id: 3,
      user_full_name: 'Dr. Jose Rizal',
      user_email: 'jose@clinic.com',
    });
  });

  it('renders the details page at the route', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/appointments/:appointmentId" element={<AppointmentDetailsPage />} />
      </Routes>,
      { route: '/appointments/a1' },
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'APT-20260707-0001' }),
      ).toBeInTheDocument();
    });
  });
});
