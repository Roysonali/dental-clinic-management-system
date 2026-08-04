import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { AppointmentListPage } from './AppointmentListPage';
import { appointmentService } from '../../services/appointmentService';
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

const listMock = vi.mocked(appointmentService.list);
const doctorListMock = vi.mocked(doctorService.list);

describe('AppointmentListPage', () => {
  beforeEach(() => {
    listMock.mockReset();
    doctorListMock.mockReset();
    listMock.mockResolvedValue({
      items: [
        {
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
        },
      ],
      total: 1,
    });
    doctorListMock.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
  });

  it('renders the appointment list inside the page shell', async () => {
    renderWithProviders(<AppointmentListPage />);

    await waitFor(() => {
      expect(screen.getByText('APT-20260707-0001')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('heading', { name: 'Appointments' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Search, filter and manage scheduled appointments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Appointment' })).toBeInTheDocument();
  });

  it('renders the empty state when there are no appointments', async () => {
    listMock.mockResolvedValue({ items: [], total: 0 });
    renderWithProviders(<AppointmentListPage />);

    await waitFor(() => {
      expect(screen.getByText('No appointments found')).toBeInTheDocument();
    });
  });
});
