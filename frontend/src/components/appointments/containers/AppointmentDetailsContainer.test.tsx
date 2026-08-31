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
    updateStatus: vi.fn(),
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
  patient_name: 'Juan Dela Cruz',
  dentist_name: 'Dr. Jose Rizal',
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
    // Names are now returned directly from the backend response.
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Dr. Jose Rizal')).toBeInTheDocument();
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

  // ── Lifecycle action visibility tests ──────────────────────────────

  it('does NOT render a generic "Cancelled" button for Scheduled appointments', async () => {
    getMock.mockResolvedValue(appointment); // status: Scheduled
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    // Should NOT have a plain "Cancelled" button
    expect(
      screen.queryByRole('button', { name: /^Cancelled$/ }),
    ).not.toBeInTheDocument();
  });

  it('renders dedicated "Cancel Appointment" for Scheduled appointments', async () => {
    getMock.mockResolvedValue(appointment); // status: Scheduled
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Cancel Appointment' }),
    ).toBeInTheDocument();
  });

  it('Scheduled shows Confirm and No Show but not Check In', async () => {
    getMock.mockResolvedValue(appointment); // status: Scheduled
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    // Scheduled → Confirmed shows "Confirm" label
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    // Scheduled → No Show shows "Mark No Show"
    expect(screen.getByRole('button', { name: 'Mark No Show' })).toBeInTheDocument();
    // "Check In" is NOT valid from Scheduled (only from Confirmed)
    expect(
      screen.queryByRole('button', { name: 'Check In' }),
    ).not.toBeInTheDocument();
  });

  it('Confirmed shows Check In and Mark No Show', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'Confirmed' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Check In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark No Show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Appointment' })).toBeInTheDocument();
    // Confirm is NOT valid from Confirmed
    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
  });

  it('Checked In shows Start Treatment only', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'Checked In' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Start Treatment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument();
  });

  it('In Treatment shows Complete only', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'In Treatment' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Treatment' })).not.toBeInTheDocument();
  });

  it('Completed has no lifecycle actions and no Edit', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'Completed' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('Cancelled has no lifecycle actions and no Edit', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'Cancelled' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('No Show has no lifecycle actions and no Edit', async () => {
    getMock.mockResolvedValue({ ...appointment, status: 'No Show' });
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('Edit button shows for non-terminal statuses', async () => {
    getMock.mockResolvedValue(appointment); // status: Scheduled
    renderDetails();

    await waitFor(() => {
      expect(screen.getByText('Appointment Details')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
