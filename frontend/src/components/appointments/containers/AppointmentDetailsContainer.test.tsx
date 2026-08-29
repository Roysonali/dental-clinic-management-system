import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../../test/testUtils';
import { AppointmentDetailsContainer } from './AppointmentDetailsContainer';
import { appointmentService } from '../../../services/appointmentService';
import { patientService } from '../../../services/patientService';
import { doctorService } from '../../../services/doctorService';
import type { AppointmentResponse } from '../../../types/appointment';

vi.mock('../../../services/appointmentService', () => ({
  appointmentService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
    today: vi.fn(),
  },
}));

vi.mock('../../../services/patientService', () => ({
  patientService: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/doctorService', () => ({
  doctorService: { list: vi.fn(), getByUserId: vi.fn() },
}));

const getMock = vi.mocked(appointmentService.get);
const cancelMock = vi.mocked(appointmentService.cancel);
const patientGetMock = vi.mocked(patientService.get);
const doctorGetMock = vi.mocked(doctorService.getByUserId);

const appointment: AppointmentResponse = {
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
  reason_for_visit: 'Toothache on upper right molar',
  notes: 'Patient prefers morning slots.',
  created_by: 1,
  updated_by: null,
  created_at: '2026-07-07T08:00:00Z',
  updated_at: '2026-07-07T08:00:00Z',
};

function renderDetails(route: string = '/appointments/a1') {
  return renderWithProviders(
    <Routes>
      <Route path="/appointments/:appointmentId" element={<AppointmentDetailsContainer />} />
    </Routes>,
    { route },
  );
}

describe('AppointmentDetailsContainer', () => {
  beforeEach(() => {
    getMock.mockReset();
    cancelMock.mockReset();
    patientGetMock.mockReset();
    doctorGetMock.mockReset();

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

  it('renders the appointment header and details once loaded', async () => {
    getMock.mockResolvedValue(appointment);
    renderDetails();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'APT-20260707-0001' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    expect(screen.getByText('Toothache on upper right molar')).toBeInTheDocument();
    expect(screen.getByText('Patient prefers morning slots.')).toBeInTheDocument();
    // Names resolve best-effort via the enrichment query — wait for them.
    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
    });
  });

  it('renders a back link to the appointments list by default', async () => {
    getMock.mockResolvedValue(appointment);
    renderDetails();

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: /Back to Appointments/ });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/appointments');
    });
  });

  it('renders a back link to the calendar when opened from calendar', async () => {
    getMock.mockResolvedValue(appointment);
    renderDetails('/appointments/a1?from=calendar');

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: /Back to Appointments/ });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/appointments/calendar');
    });
  });

  it('shows a loading state while fetching', () => {
    getMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderDetails();
    expect(screen.getByRole('status', { name: 'Loading appointment' })).toBeInTheDocument();
  });

  it('shows the error state and retries', async () => {
    getMock.mockRejectedValueOnce(new Error('Appointment not found'));
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Unable to load appointment')).toBeInTheDocument();
    });

    getMock.mockResolvedValue(appointment);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it('opens the edit drawer', async () => {
    getMock.mockResolvedValue(appointment);
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('dialog', { name: 'Edit Appointment' })).toBeInTheDocument();
  });

  it('opens the cancel dialog and confirms the cancellation', async () => {
    getMock.mockResolvedValue(appointment);
    cancelMock.mockResolvedValue({ ...appointment, status: 'Cancelled' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Appointment' }));
    expect(screen.getByRole('dialog', { name: 'Cancel appointment' })).toBeInTheDocument();

    // The dialog confirm has a distinct name from the header action.
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel Appointment' }));
    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith('a1'));
  });

  it('hides the cancel action for terminal statuses', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'Completed' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: 'Cancel Appointment' }),
    ).not.toBeInTheDocument();
  });
});
