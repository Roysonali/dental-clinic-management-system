import { describe, it, expect, vi, beforeEach } from 'vitest';
import { patientService } from './patientService';
import { api } from './api';
import type {
  PatientCreatePayload,
  PatientListParams,
  PatientListResponse,
  PatientResponse,
} from '../types/patient';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);
const patchMock = vi.mocked(api.patch);

const patient: PatientResponse = {
  id: 'p1',
  patient_code: 'PAT-000001',
  full_name: 'Juan Dela Cruz',
  date_of_birth: '1990-05-15',
  age: 34,
  gender: 'male',
  primary_contact_number: '+639123456789',
  emergency_contact_number: null,
  email: 'juan@example.com',
  address: '123 Rizal St.',
  remarks: null,
  is_active: true,
  created_by: 1,
  updated_by: 1,
  created_at: '2025-01-15T10:30:00Z',
  updated_at: '2025-06-20T14:45:00Z',
};

const listResponse: PatientListResponse = {
  items: [
    {
      id: 'p1',
      patient_code: 'PAT-000001',
      full_name: 'Juan Dela Cruz',
      age: 34,
      gender: 'male',
      primary_contact_number: '+639123456789',
      is_active: true,
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

const createPayload: PatientCreatePayload = {
  first_name: 'Juan',
  middle_name: null,
  last_name: 'Dela Cruz',
  date_of_birth: '1990-05-15',
  gender: 'male',
  primary_contact_number: '+639123456789',
  email: 'juan@example.com',
  address: '123 Rizal St.',
  remarks: null,
};

describe('patientService', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  describe('list', () => {
    it('GETs /patients with the given query params and returns data', async () => {
      getMock.mockResolvedValue({ data: listResponse });
      const params: PatientListParams = { page: 2, page_size: 20, search: 'juan', is_active: true };

      await expect(patientService.list(params)).resolves.toEqual(listResponse);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/patients', { params });
    });

    it('passes an empty params object when no params are provided', async () => {
      getMock.mockResolvedValue({ data: listResponse });

      await expect(patientService.list()).resolves.toEqual(listResponse);

      expect(getMock).toHaveBeenCalledWith('/patients', { params: {} });
    });
  });

  describe('get', () => {
    it('GETs /patients/{id} and returns the patient', async () => {
      getMock.mockResolvedValue({ data: patient });

      await expect(patientService.get('p1')).resolves.toEqual(patient);

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith('/patients/p1');
    });
  });

  describe('create', () => {
    it('POSTs the payload to /patients and returns the created patient', async () => {
      postMock.mockResolvedValue({ data: patient });

      await expect(patientService.create(createPayload)).resolves.toEqual(patient);

      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith('/patients', createPayload);
    });
  });

  describe('update', () => {
    it('PATCHes /patients/{id} with the partial payload', async () => {
      patchMock.mockResolvedValue({ data: patient });
      const payload = { first_name: 'Juan Carlos' };

      await expect(patientService.update('p1', payload)).resolves.toEqual(patient);

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/patients/p1', payload);
    });
  });

  describe('activate / deactivate', () => {
    it('PATCHes /patients/{id}/activate', async () => {
      patchMock.mockResolvedValue({ data: patient });

      await expect(patientService.activate('p1')).resolves.toEqual(patient);

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/patients/p1/activate');
    });

    it('PATCHes /patients/{id}/deactivate', async () => {
      patchMock.mockResolvedValue({ data: patient });

      await expect(patientService.deactivate('p1')).resolves.toEqual(patient);

      expect(patchMock).toHaveBeenCalledTimes(1);
      expect(patchMock).toHaveBeenCalledWith('/patients/p1/deactivate');
    });
  });

  describe('error handling', () => {
    it('propagates axios request errors to the caller', async () => {
      getMock.mockRejectedValue(new Error('Network Error'));

      await expect(patientService.get('p1')).rejects.toThrow('Network Error');
    });

    it('propagates backend HTTP errors (4xx/5xx) without swallowing them', async () => {
      postMock.mockRejectedValue(new Error('Request failed with status code 409'));

      await expect(patientService.create(createPayload)).rejects.toThrow('status code 409');
    });
  });
});
