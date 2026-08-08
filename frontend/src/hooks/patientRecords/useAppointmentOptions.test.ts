import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentService } from '../../services/appointmentService';
import { fetchAppointmentDirectory, APPOINTMENT_PAGE_SIZE } from './useAppointmentOptions';
import type { AppointmentResponse } from '../../types/appointment';

vi.mock('../../services/appointmentService', () => ({
  appointmentService: { list: vi.fn() },
}));

const listMock = vi.mocked(appointmentService.list);

/** Minimal valid appointment row. */
function mkAppointment(id: string): AppointmentResponse {
  return {
    id,
    appointment_number: `APT-${id}`,
    patient_id: 'p1',
    dentist_id: 1,
    appointment_date: '2026-08-01',
    start_time: '10:00:00',
    end_time: '10:30:00',
    duration_minutes: 30,
    appointment_type: 'Consultation',
    status: 'Scheduled',
    reason_for_visit: 'Checkup',
    notes: null,
    created_by: 1,
    updated_by: null,
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-01T08:00:00Z',
  };
}

const page = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => mkAppointment(`a${from + i}`));

describe('fetchAppointmentDirectory — M-2 (scales beyond the 100-cap window)', () => {
  beforeEach(() => listMock.mockReset());

  it('fetches every page until `total` is covered (250 > 100)', async () => {
    listMock
      .mockResolvedValueOnce({ items: page(0, APPOINTMENT_PAGE_SIZE), total: 250 })
      .mockResolvedValueOnce({ items: page(100, APPOINTMENT_PAGE_SIZE), total: 250 })
      .mockResolvedValueOnce({ items: page(200, 50), total: 250 });

    const directory = await fetchAppointmentDirectory();

    expect(listMock).toHaveBeenCalledTimes(3);
    expect(listMock).toHaveBeenNthCalledWith(1, { skip: 0, limit: 100 });
    expect(listMock).toHaveBeenNthCalledWith(2, { skip: 100, limit: 100 });
    expect(listMock).toHaveBeenNthCalledWith(3, { skip: 200, limit: 100 });
    // No appointment is silently dropped by a capped window.
    expect(directory.items).toHaveLength(250);
    expect(directory.items[0].id).toBe('a0');
    expect(directory.items[249].id).toBe('a249');
  });

  it('does not page when the directory fits in one request (exactly 100)', async () => {
    listMock.mockResolvedValueOnce({ items: page(0, APPOINTMENT_PAGE_SIZE), total: 100 });

    const directory = await fetchAppointmentDirectory();

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(directory.items).toHaveLength(100);
  });

  it('handles an empty directory with a single request', async () => {
    listMock.mockResolvedValueOnce({ items: [], total: 0 });

    const directory = await fetchAppointmentDirectory();

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(directory.items).toHaveLength(0);
    expect(directory.total).toBe(0);
  });
});
