import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from '../../test/testUtils';
import {
  useCreateAppointment,
  useUpdateAppointment,
  useCancelAppointment,
} from './useAppointmentMutations';
import { appointmentService } from '../../services/appointmentService';
import type {
  AppointmentCreatePayload,
  AppointmentResponse,
  AppointmentUpdatePayload,
} from '../../types/appointment';

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

const createMock = vi.mocked(appointmentService.create);
const updateMock = vi.mocked(appointmentService.update);
const cancelMock = vi.mocked(appointmentService.cancel);

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

describe('appointment mutation hooks', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    cancelMock.mockReset();
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

  it('useCreateAppointment calls the service with the payload', async () => {
    createMock.mockResolvedValue(appointment);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCreateAppointment(), {
      wrapper: makeWrapper(queryClient),
    });

    const payload: AppointmentCreatePayload = {
      patient_id: 'p1',
      dentist_id: 3,
      appointment_date: '2026-07-08',
      start_time: '10:00:00',
      duration_minutes: 30,
      appointment_type: 'Consultation',
      reason_for_visit: 'Toothache',
    };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createMock).toHaveBeenCalledWith(payload);
  });

  it('useUpdateAppointment calls the service with id and payload', async () => {
    updateMock.mockResolvedValue(appointment);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useUpdateAppointment(), {
      wrapper: makeWrapper(queryClient),
    });

    const payload: AppointmentUpdatePayload = { start_time: '11:00:00' };
    result.current.mutate({ id: 'a1', payload });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateMock).toHaveBeenCalledWith('a1', payload);
  });

  it('useCancelAppointment calls the service with the id', async () => {
    cancelMock.mockResolvedValue({ ...appointment, status: 'Cancelled' });
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useCancelAppointment(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cancelMock).toHaveBeenCalledWith('a1');
  });

  it('invalidates appointment queries after a successful mutation', async () => {
    createMock.mockResolvedValue(appointment);
    const queryClient = createTestQueryClient();
    // Seed the cache with a stale list query, then confirm it is invalidated.
    queryClient.setQueryData(['appointments', 'list', 0, 20], { items: [], total: 0 });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateAppointment(), {
      wrapper: makeWrapper(queryClient),
    });

    result.current.mutate({
      patient_id: 'p1',
      dentist_id: 3,
      appointment_date: '2026-07-08',
      start_time: '10:00:00',
      duration_minutes: 30,
      appointment_type: 'Consultation',
      reason_for_visit: 'Toothache',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['appointments'] });
  });
});
