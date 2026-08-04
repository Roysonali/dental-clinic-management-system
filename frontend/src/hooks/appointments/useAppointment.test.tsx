import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from '../../test/testUtils';
import { useAppointment } from './useAppointment';
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

const getMock = vi.mocked(appointmentService.get);

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

describe('useAppointment', () => {
  beforeEach(() => {
    getMock.mockReset();
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

  it('fetches a single appointment by id', async () => {
    getMock.mockResolvedValue(appointment);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAppointment('a1'), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(appointment));
    expect(getMock).toHaveBeenCalledWith('a1');
  });

  it('stays disabled when no id is provided', () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAppointment(null), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(true);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('does not fetch until explicitly enabled', () => {
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAppointment('a1', false), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(true);
    expect(getMock).not.toHaveBeenCalled();
  });
});
