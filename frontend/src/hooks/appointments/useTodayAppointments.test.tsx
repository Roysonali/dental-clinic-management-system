import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from '../../test/testUtils';
import { useTodayAppointments } from './useTodayAppointments';
import { appointmentService } from '../../services/appointmentService';
import type { AppointmentResponse } from '../../types/appointment';

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

const todayMock = vi.mocked(appointmentService.today);

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

describe('useTodayAppointments', () => {
  beforeEach(() => {
    todayMock.mockReset();
  });

  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      );
    };
  }

  it('calls the today endpoint and returns the appointments', async () => {
    todayMock.mockResolvedValue([appointment]);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useTodayAppointments(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual([appointment]));
    expect(todayMock).toHaveBeenCalledTimes(1);
  });

  it('shares a single cache entry across subscribers (same query key)', async () => {
    todayMock.mockResolvedValue([appointment]);
    const queryClient = createTestQueryClient();

    const { result: first } = renderHook(() => useTodayAppointments(), {
      wrapper: makeWrapper(queryClient),
    });
    const { result: second } = renderHook(() => useTodayAppointments(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(first.current.data).toEqual([appointment]));
    await waitFor(() => expect(second.current.data).toEqual([appointment]));

    // One network request for both subscribers.
    expect(todayMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces errors without retrying (test client disables retries)', async () => {
    todayMock.mockRejectedValue(new Error('Request failed with status code 500'));
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useTodayAppointments(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(todayMock).toHaveBeenCalledTimes(1);
  });
});
