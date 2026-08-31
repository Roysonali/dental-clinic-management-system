import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from '../../test/testUtils';
import { useAppointments } from './useAppointments';
import { appointmentService } from '../../services/appointmentService';
import type { AppointmentListResponse } from '../../types/appointment';

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

const listMock = vi.mocked(appointmentService.list);

const response: AppointmentListResponse = {
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
};

describe('useAppointments', () => {
  beforeEach(() => {
    listMock.mockReset();
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

  it('calls the appointment service with the given params', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAppointments({ skip: 20, limit: 20 }), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledWith({ skip: 20, limit: 20 });
  });

  it('refetches when pagination params change', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ skip }: { skip: number }) => useAppointments({ skip, limit: 20 }),
      {
        wrapper: makeWrapper(queryClient),
        initialProps: { skip: 0 },
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledTimes(1);

    rerender({ skip: 20 });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith({ skip: 20, limit: 20 });
  });

  it('creates a new query when search filter changes', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ search }: { search?: string }) =>
        useAppointments({ skip: 0, limit: 20, ...(search ? { search } : {}) }),
      {
        wrapper: makeWrapper(queryClient),
        initialProps: { search: undefined as string | undefined },
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledTimes(1);

    // Changing search should create a new cache entry (not reuse stale)
    rerender({ search: 'toothache' });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith({ skip: 0, limit: 20, search: 'toothache' });
  });

  it('creates a new query when status filter changes', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ status }: { status?: string }) =>
        useAppointments({ skip: 0, limit: 20, ...(status ? { status: status as any } : {}) }),
      {
        wrapper: makeWrapper(queryClient),
        initialProps: { status: undefined as string | undefined },
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledTimes(1);

    // Changing status should create a new cache entry
    rerender({ status: 'Confirmed' });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith({ skip: 0, limit: 20, status: 'Confirmed' });
  });

  it('creates a new query when date filters change', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ dateFrom }: { dateFrom?: string }) =>
        useAppointments({ skip: 0, limit: 20, ...(dateFrom ? { date_from: dateFrom } : {}) }),
      {
        wrapper: makeWrapper(queryClient),
        initialProps: { dateFrom: undefined as string | undefined },
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledTimes(1);

    rerender({ dateFrom: '2026-08-01' });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith({ skip: 0, limit: 20, date_from: '2026-08-01' });
  });

  it('creates a new query when dentist filter changes', async () => {
    listMock.mockResolvedValue(response);
    const queryClient = createTestQueryClient();

    const { result, rerender } = renderHook(
      ({ dentistId }: { dentistId?: number }) =>
        useAppointments({ skip: 0, limit: 20, ...(dentistId ? { dentist_id: dentistId } : {}) }),
      {
        wrapper: makeWrapper(queryClient),
        initialProps: { dentistId: undefined as number | undefined },
      },
    );

    await waitFor(() => expect(result.current.data).toEqual(response));
    expect(listMock).toHaveBeenCalledTimes(1);

    rerender({ dentistId: 5 });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock).toHaveBeenLastCalledWith({ skip: 0, limit: 20, dentist_id: 5 });
  });

  it('exposes isLoading while the query is pending', () => {
    listMock.mockReturnValue(new Promise(() => {})); // never resolves
    const queryClient = createTestQueryClient();

    const { result } = renderHook(() => useAppointments({ skip: 0, limit: 20 }), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
