import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentService } from './appointmentService';
import { api } from './api';
import type {
  AppointmentCreatePayload,
  AppointmentListParams,
  AppointmentListResponse,
  AppointmentResponse,
  AppointmentUpdatePayload,
} from '../types/appointment';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const putMock = vi.mocked(api.put);
const patchMock = vi.mocked(api.patch);

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

const listResponse: AppointmentListResponse = {
  items: [appointment],
  total: 1,
};

const createPayload: AppointmentCreatePayload = {
  patient_id: 'p1',
  dentist_id: 3,
  appointment_date: '2026-07-08',
  start_time: '10:00:00',
  duration_minutes: 30,
  appointment_type: 'Consultation',
  reason_for_visit: 'Toothache',
  notes: null,
};

describe('appointmentService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    patchMock.mockReset();
  });

  describe('list', () => {
    it('GETs /appointments with the given query params and returns data', async () => {
      getMock.mockResolvedValue({ data: listResponse });
      const params: AppointmentListParams = { skip: 20, limit: 20 };

      await expect(appointmentService.list(params)).resolves.toEqual(listResponse);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/appointments', { params });
    });

    it('passes an empty params object when no params are provided', async () => {
      getMock.mockResolvedValue({ data: listResponse });

      await expect(appointmentService.list()).resolves.toEqual(listResponse);

      expect(getMock).toHaveBeenCalledWith('/appointments', { params: {} });
    });
  });

  describe('create', () => {
    it('POSTs the payload to /appointments and returns the created appointment', async () => {
      postMock.mockResolvedValue({ data: appointment });

      await expect(appointmentService.create(createPayload)).resolves.toEqual(appointment);

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith('/appointments', createPayload);
    });
  });

  describe('today', () => {
    it('GETs /appointments/today and returns the array', async () => {
      getMock.mockResolvedValue({ data: [appointment] });

      await expect(appointmentService.today()).resolves.toEqual([appointment]);

      expect(getMock).toHaveBeenCalledWith('/appointments/today');
    });
  });

  describe('get', () => {
    it('GETs /appointments/{id} and returns the appointment', async () => {
      getMock.mockResolvedValue({ data: appointment });

      await expect(appointmentService.get('a1')).resolves.toEqual(appointment);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/appointments/a1');
    });
  });

  describe('update', () => {
    it('PUTs /appointments/{id} with the partial payload', async () => {
      putMock.mockResolvedValue({ data: { ...appointment, start_time: '11:00:00' } });
      const payload: AppointmentUpdatePayload = { start_time: '11:00:00' };

      await expect(appointmentService.update('a1', payload)).resolves.toMatchObject({
        start_time: '11:00:00',
      });

      expect(putMock).toHaveBeenCalledTimes(1);
      expect(putMock).toHaveBeenCalledWith('/appointments/a1', payload);
    });
  });

  describe('cancel', () => {
    it('PATCHes /appointments/{id}/cancel', async () => {
      patchMock.mockResolvedValue({ data: { ...appointment, status: 'Cancelled' } });

      await expect(appointmentService.cancel('a1')).resolves.toMatchObject({
        status: 'Cancelled',
      });

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/appointments/a1/cancel');
    });
  });

  describe('error handling', () => {
    it('propagates axios request errors to the caller', async () => {
      getMock.mockRejectedValue(new Error('Network Error'));

      await expect(appointmentService.get('a1')).rejects.toThrow('Network Error');
    });

    it('propagates backend HTTP errors (4xx/5xx) without swallowing them', async () => {
      postMock.mockRejectedValue(new Error('Request failed with status code 409'));

      await expect(appointmentService.create(createPayload)).rejects.toThrow('status code 409');
    });
  });
});
