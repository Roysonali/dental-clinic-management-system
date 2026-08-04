import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { UpcomingAppointments } from './UpcomingAppointments';
import type { AppointmentResponse } from '../../types/appointment';

vi.mock('../../hooks/appointments/useTodayAppointments', () => ({
  useTodayAppointments: vi.fn(),
}));

vi.mock('../../hooks/appointments/useAppointmentNames', () => ({
  useAppointmentNames: vi.fn(),
}));

import { useTodayAppointments } from '../../hooks/appointments/useTodayAppointments';
import { useAppointmentNames } from '../../hooks/appointments/useAppointmentNames';

const todayMock = vi.mocked(useTodayAppointments);
const namesMock = vi.mocked(useAppointmentNames);

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
  reason_for_visit: 'Toothache',
  notes: null,
  created_by: 1,
  updated_by: null,
  created_at: '2026-07-07T08:00:00Z',
  updated_at: '2026-07-07T08:00:00Z',
};

describe('UpcomingAppointments', () => {
  beforeEach(() => {
    namesMock.mockReturnValue({
      data: {
        patientNames: new Map([['p1', 'Juan Dela Cruz']]),
        dentistNames: new Map([[3, 'Dr. Jose Rizal']]),
      },
    } as never);
  });

  it('renders today appointments with resolved names', async () => {
    todayMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [appointment],
    } as never);

    renderWithProviders(<UpcomingAppointments />);

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(screen.getByText('with Dr. Jose Rizal')).toBeInTheDocument();
    });
  });

  it('shows skeleton rows while loading', () => {
    todayMock.mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);

    renderWithProviders(<UpcomingAppointments />);
    expect(document.querySelectorAll('.animate-pulse, [data-skeleton="true"]').length).toBeGreaterThan(0);
  });

  it('shows a fallback message on error', () => {
    todayMock.mockReturnValue({ isLoading: false, isError: true, data: undefined } as never);

    renderWithProviders(<UpcomingAppointments />);
    expect(screen.getByText('Appointments could not be loaded.')).toBeInTheDocument();
  });

  it('shows the empty state when there are no appointments today', () => {
    todayMock.mockReturnValue({ isLoading: false, isError: false, data: [] } as never);

    renderWithProviders(<UpcomingAppointments />);
    expect(screen.getByText('No appointments today')).toBeInTheDocument();
  });

  it('respects the limit prop', async () => {
    const many = Array.from({ length: 5 }, (_, i): AppointmentResponse => ({
      ...appointment,
      id: `a${i}`,
      patient_id: `p${i}`,
      dentist_id: 3 + i,
    }));
    todayMock.mockReturnValue({ isLoading: false, isError: false, data: many } as never);
    namesMock.mockReturnValue({
      data: {
        patientNames: new Map<string, string | null>(),
        dentistNames: new Map<number, string | null>(),
      },
    } as never);

    renderWithProviders(<UpcomingAppointments limit={3} />);

    await waitFor(() => {
      // 5 rows in data but limit 3 → only 3 patient fallback chips rendered.
      expect(screen.getAllByText(/^Patient #/).length).toBe(3);
    });
  });
});
