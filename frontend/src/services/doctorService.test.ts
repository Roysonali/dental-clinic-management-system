import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doctorService } from './doctorService';
import { api } from './api';
import type { DoctorListParams, DoctorUserResponse } from '../types/doctor';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

const doctor: DoctorUserResponse = {
  id: 'd1',
  doctor_code: 'DOC-00001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
};

describe('doctorService', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  describe('list', () => {
    it('GETs /doctors with the given query params and returns data', async () => {
      getMock.mockResolvedValue({
        data: { items: [doctor], total: 1, page: 1, page_size: 100 },
      });
      const params: DoctorListParams = { page: 1, page_size: 100, is_active: true };

      await expect(doctorService.list(params)).resolves.toEqual({
        items: [doctor],
        total: 1,
        page: 1,
        page_size: 100,
      });

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/doctors', { params });
    });

    it('passes an empty params object when no params are provided', async () => {
      getMock.mockResolvedValue({ data: { items: [], total: 0, page: 1, page_size: 20 } });

      await expect(doctorService.list()).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });

      expect(getMock).toHaveBeenCalledWith('/doctors', { params: {} });
    });
  });

  describe('getByUserId', () => {
    it('GETs /doctors/user/{user_id} and returns the doctor', async () => {
      getMock.mockResolvedValue({ data: doctor });

      await expect(doctorService.getByUserId(3)).resolves.toEqual(doctor);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/doctors/user/3');
    });
  });
});
