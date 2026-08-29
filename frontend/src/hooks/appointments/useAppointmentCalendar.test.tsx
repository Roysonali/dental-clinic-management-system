import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAppointmentCalendar, calendarQueryKeys } from './useAppointmentCalendar';
import { appointmentService } from '../../services/appointmentService';

// Mock the appointment service
vi.mock('../../services/appointmentService', () => ({
  appointmentService: {
    calendar: vi.fn(),
  },
}));

const mockCalendar = vi.mocked(appointmentService.calendar);

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

describe('useAppointmentCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls appointmentService.calendar with correct params', async () => {
    mockCalendar.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useAppointmentCalendar({
          start: '2026-08-01',
          end: '2026-09-01',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockCalendar).toHaveBeenCalledWith({
        start: '2026-08-01',
        end: '2026-09-01',
      });
    });
  });

  it('passes dentist_id when provided', async () => {
    mockCalendar.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useAppointmentCalendar({
          start: '2026-08-01',
          end: '2026-09-01',
          dentist_id: 42,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockCalendar).toHaveBeenCalledWith({
        start: '2026-08-01',
        end: '2026-09-01',
        dentist_id: 42,
      });
    });
  });

  it('passes status when provided', async () => {
    mockCalendar.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useAppointmentCalendar({
          start: '2026-08-01',
          end: '2026-09-01',
          status: 'Scheduled',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockCalendar).toHaveBeenCalledWith({
        start: '2026-08-01',
        end: '2026-09-01',
        status: 'Scheduled',
      });
    });
  });

  it('does not fetch when start is empty', () => {
    mockCalendar.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useAppointmentCalendar({
          start: '',
          end: '2026-09-01',
        }),
      { wrapper },
    );

    expect(mockCalendar).not.toHaveBeenCalled();
  });

  it('does not fetch when end is empty', () => {
    mockCalendar.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useAppointmentCalendar({
          start: '2026-08-01',
          end: '',
        }),
      { wrapper },
    );

    expect(mockCalendar).not.toHaveBeenCalled();
  });

  it('returns empty items on success', async () => {
    mockCalendar.mockResolvedValue({ items: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useAppointmentCalendar({
          start: '2026-08-01',
          end: '2026-09-01',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toEqual([]);
  });

  it('returns data on success', async () => {
    const mockData = {
      items: [
        {
          id: 'apt-1',
          appointment_number: 'APT-20260828-0001',
          patient_id: 'pat-1',
          patient_name: 'John Smith',
          dentist_id: 10,
          dentist_name: 'Dr. Sarah Johnson',
          appointment_date: '2026-08-28',
          start_time: '10:00:00',
          end_time: '10:30:00',
          duration_minutes: 30,
          appointment_type: 'Consultation' as const,
          status: 'Scheduled' as const,
          reason_for_visit: 'Annual checkup',
        },
      ],
    };
    mockCalendar.mockResolvedValue(mockData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useAppointmentCalendar({
          start: '2026-08-01',
          end: '2026-09-01',
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].patient_name).toBe('John Smith');
  });
});

describe('calendarQueryKeys', () => {
  it('generates distinct keys for different params', () => {
    const key1 = calendarQueryKeys.calendar({
      start: '2026-08-01',
      end: '2026-09-01',
    });
    const key2 = calendarQueryKeys.calendar({
      start: '2026-09-01',
      end: '2026-10-01',
    });
    expect(key1).not.toEqual(key2);
  });

  it('generates distinct keys for different dentist filters', () => {
    const key1 = calendarQueryKeys.calendar({
      start: '2026-08-01',
      end: '2026-09-01',
    });
    const key2 = calendarQueryKeys.calendar({
      start: '2026-08-01',
      end: '2026-09-01',
      dentist_id: 42,
    });
    expect(key1).not.toEqual(key2);
  });

  it('generates distinct keys for different status filters', () => {
    const key1 = calendarQueryKeys.calendar({
      start: '2026-08-01',
      end: '2026-09-01',
    });
    const key2 = calendarQueryKeys.calendar({
      start: '2026-08-01',
      end: '2026-09-01',
      status: 'Scheduled',
    });
    expect(key1).not.toEqual(key2);
  });
});
