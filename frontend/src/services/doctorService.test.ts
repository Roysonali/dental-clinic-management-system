import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doctorService } from './doctorService';
import { api } from './api';
import type {
  DoctorCreateRequest,
  DoctorListParams,
  DoctorResponse,
  DoctorUpdateRequest,
  DoctorUserResponse,
  SpecializationListParams,
} from '../types/doctor';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);
const deleteMock = vi.mocked(api.delete);

const doctorUser: DoctorUserResponse = {
  id: 'd1',
  doctor_code: 'DOC-00001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
};

const doctor: DoctorResponse = {
  id: 'd1',
  doctor_code: 'DOC-00001',
  user_id: 3,
  user_full_name: 'Dr. Jose Rizal',
  user_email: 'jose@clinic.com',
  date_of_birth: '1985-06-15',
  gender: 'male',
  primary_phone: '+639171234567',
  address: '123 Rizal St., Manila',
  qualification: 'DMD, University of the Philippines',
  registration_number: 'DEN-2020-12345',
  years_of_experience: 10,
  consultation_fee: 800,
  consultation_duration: 30,
  languages_known: ['English', 'Filipino'],
  profile_photo_url: null,
  biography: 'Experienced general dentist.',
  emergency_contact_name: 'Maria Dela Cruz',
  emergency_contact_phone: '+639177654321',
  available_for_appointment: true,
  on_leave: false,
  is_active: true,
  specializations: [
    {
      specialization_id: 1,
      specialization_name: 'Orthodontics',
      specialization_code: 'ORTHO',
      is_primary: true,
      certification_date: '2020-06-15',
    },
  ],
  created_by: 1,
  updated_by: 1,
  created_at: '2026-07-07T10:00:00Z',
  updated_at: '2026-07-07T10:00:00Z',
};

describe('doctorService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  describe('list', () => {
    it('GETs /doctors with the given query params and returns data', async () => {
      getMock.mockResolvedValue({
        data: { items: [doctor], total: 1, page: 1, page_size: 100 },
      });
      const params: DoctorListParams = {
        page: 1,
        page_size: 100,
        search: 'rizal',
        is_active: true,
        is_available: true,
        specialization_id: 2,
        sort_by: 'full_name',
        sort_order: 'asc',
      };

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

  describe('get', () => {
    it('GETs /doctors/{id} and returns the full doctor', async () => {
      getMock.mockResolvedValue({ data: doctor });

      await expect(doctorService.get('d1')).resolves.toEqual(doctor);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/doctors/d1');
    });
  });

  describe('getByUserId', () => {
    it('GETs /doctors/user/{user_id} and returns the doctor', async () => {
      getMock.mockResolvedValue({ data: doctorUser });

      await expect(doctorService.getByUserId(3)).resolves.toEqual(doctorUser);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/doctors/user/3');
    });
  });

  describe('getProfile', () => {
    it('GETs /doctors/{id}/profile and returns the profile with schedules', async () => {
      const profile = {
        ...doctor,
        schedules: [
          { id: 's1', doctor_id: 'd1', day_of_week: 0 as const, start_time: '09:00', end_time: '17:00', is_active: true },
        ],
      };
      getMock.mockResolvedValue({ data: profile });

      await expect(doctorService.getProfile('d1')).resolves.toEqual(profile);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/doctors/d1/profile');
    });
  });

  describe('create', () => {
    it('POSTs /doctors with the payload and returns the created doctor', async () => {
      const payload: DoctorCreateRequest = {
        user_id: 3,
        primary_phone: '+639171234567',
        registration_number: 'DEN-2020-12345',
      };
      postMock.mockResolvedValue({ data: doctor });

      await expect(doctorService.create(payload)).resolves.toEqual(doctor);

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith('/doctors', payload);
    });
  });

  describe('update', () => {
    it('PATCHes /doctors/{id} with the partial payload', async () => {
      const payload: DoctorUpdateRequest = { years_of_experience: 11 };
      patchMock.mockResolvedValue({ data: { ...doctor, years_of_experience: 11 } });

      await expect(doctorService.update('d1', payload)).resolves.toMatchObject({
        years_of_experience: 11,
      });

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/doctors/d1', payload);
    });
  });

  describe('activate / deactivate', () => {
    it('PATCHes /doctors/{id}/activate', async () => {
      patchMock.mockResolvedValue({ data: { ...doctor, is_active: true } });

      await expect(doctorService.activate('d1')).resolves.toMatchObject({ is_active: true });

      expect(patchMock).toHaveBeenCalledWith('/doctors/d1/activate');
    });

    it('PATCHes /doctors/{id}/deactivate', async () => {
      patchMock.mockResolvedValue({ data: { ...doctor, is_active: false } });

      await expect(doctorService.deactivate('d1')).resolves.toMatchObject({ is_active: false });

      expect(patchMock).toHaveBeenCalledWith('/doctors/d1/deactivate');
    });
  });

  describe('toggleLeave / toggleAvailability', () => {
    it('PATCHes /doctors/{id}/leave with NO request body', async () => {
      patchMock.mockResolvedValue({ data: { ...doctor, on_leave: true } });

      await expect(doctorService.toggleLeave('d1')).resolves.toMatchObject({ on_leave: true });

      expect(patchMock).toHaveBeenCalledWith('/doctors/d1/leave');
    });

    it('PATCHes /doctors/{id}/availability with NO request body', async () => {
      patchMock.mockResolvedValue({ data: { ...doctor, available_for_appointment: false } });

      await expect(doctorService.toggleAvailability('d1')).resolves.toMatchObject({
        available_for_appointment: false,
      });

      expect(patchMock).toHaveBeenCalledWith('/doctors/d1/availability');
    });
  });

  describe('delete', () => {
    it('DELETEs /doctors/{id} and resolves without a body', async () => {
      deleteMock.mockResolvedValue({ data: undefined });

      await expect(doctorService.delete('d1')).resolves.toBeUndefined();

      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteMock).toHaveBeenCalledWith('/doctors/d1');
    });
  });

  describe('listSpecializations', () => {
    it('GETs /specializations with the given params', async () => {
      getMock.mockResolvedValue({
        data: {
          items: [
            { id: 1, name: 'Orthodontics', code: 'ORTHO', description: null, is_active: true },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        },
      });
      const params: SpecializationListParams = { is_active: true };

      await expect(doctorService.listSpecializations(params)).resolves.toMatchObject({ total: 1 });

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/specializations', { params });
    });
  });

  describe('consultation_fee normalization (Decimal → number wire contract)', () => {
    it('normalizes string fees from the list endpoint into numbers', async () => {
      getMock.mockResolvedValue({
        data: {
          items: [{ ...doctor, id: 'd1', consultation_fee: '800.00' }],
          total: 1,
          page: 1,
          page_size: 20,
        },
      });

      const result = await doctorService.list();
      expect(result.items[0].consultation_fee).toBe(800);
    });

    it('preserves numeric fees unchanged', async () => {
      getMock.mockResolvedValue({
        data: { items: [doctor], total: 1, page: 1, page_size: 20 },
      });

      const result = await doctorService.list();
      expect(result.items[0].consultation_fee).toBe(800);
    });

    it('keeps null fees as null', async () => {
      getMock.mockResolvedValue({
        data: {
          items: [{ ...doctor, consultation_fee: null }],
          total: 1,
          page: 1,
          page_size: 20,
        },
      });

      const result = await doctorService.list();
      expect(result.items[0].consultation_fee).toBeNull();
    });

    it('maps empty and invalid fee strings to null instead of NaN', async () => {
      getMock.mockResolvedValue({
        data: {
          items: [
            { ...doctor, id: 'd1', consultation_fee: '' },
            { ...doctor, id: 'd2', consultation_fee: 'not-a-number' },
          ],
          total: 2,
          page: 1,
          page_size: 20,
        },
      });

      const result = await doctorService.list();
      expect(result.items[0].consultation_fee).toBeNull();
      expect(result.items[1].consultation_fee).toBeNull();
    });

    it('normalizes string fees on the single-record endpoint', async () => {
      getMock.mockResolvedValue({ data: { ...doctor, consultation_fee: '500.00' } });

      const result = await doctorService.get('d1');
      expect(result.consultation_fee).toBe(500);
    });

    it('normalizes string fees on the profile endpoint and keeps schedules', async () => {
      const profile = {
        ...doctor,
        consultation_fee: '750.00',
        schedules: [
          { id: 's1', doctor_id: 'd1', day_of_week: 0 as const, start_time: '09:00', end_time: '17:00', is_active: true },
        ],
      };
      getMock.mockResolvedValue({ data: profile });

      const result = await doctorService.getProfile('d1');
      expect(result.consultation_fee).toBe(750);
      expect(result.schedules).toHaveLength(1);
    });

    it('normalizes string fees on mutation responses', async () => {
      postMock.mockResolvedValue({ data: { ...doctor, consultation_fee: '600.00' } });
      const created = await doctorService.create({ user_id: 3, primary_phone: '+639171234567' });
      expect(created.consultation_fee).toBe(600);

      patchMock.mockResolvedValue({ data: { ...doctor, consultation_fee: '650.00' } });
      const updated = await doctorService.update('d1', { consultation_fee: 650 });
      expect(updated.consultation_fee).toBe(650);

      patchMock.mockResolvedValue({ data: { ...doctor, consultation_fee: '700.00' } });
      const activated = await doctorService.activate('d1');
      expect(activated.consultation_fee).toBe(700);
    });
  });
});
