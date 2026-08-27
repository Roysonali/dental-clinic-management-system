import { api } from './api';
import type {
  PatientCreatePayload,
  PatientListParams,
  PatientListResponse,
  PatientQuickCreatePayload,
  PatientQuickCreateResponse,
  PatientResponse,
  PatientSummaryResponse,
  PatientUpdatePayload,
} from '../types/patient';

/**
 * Patient API service.
 *
 * Endpoints mirror the backend `app/modules/patients/routes.py` exactly:
 * - GET    /patients                 → paginated list (page, page_size, search, is_active)
 * - POST   /patients                 → create (201)
 * - GET    /patients/{id}            → single patient
 * - PATCH  /patients/{id}            → partial update
 * - PATCH  /patients/{id}/activate   → activate (ADMIN)
 * - PATCH  /patients/{id}/deactivate → deactivate (ADMIN)
 *
 * Note: there is NO hard-delete endpoint — records are soft-managed via
 * activate/deactivate. The frontend intentionally exposes no delete action.
 * The backend's `GET /patients/{id}/profile` endpoint is not consumed by
 * any screen, so no client method is exposed for it.
 */
export const patientService = {
  /** GET /patients */
  async list(params: PatientListParams = {}): Promise<PatientListResponse> {
    const { data } = await api.get<PatientListResponse>('/patients', { params });
    return data;
  },

  /** GET /patients/{id} */
  async get(id: string): Promise<PatientResponse> {
    const { data } = await api.get<PatientResponse>(`/patients/${id}`);
    return data;
  },

  /** POST /patients (201) */
  async create(payload: PatientCreatePayload): Promise<PatientResponse> {
    const { data } = await api.post<PatientResponse>('/patients', payload);
    return data;
  },

  /** PATCH /patients/{id} */
  async update(id: string, payload: PatientUpdatePayload): Promise<PatientResponse> {
    const { data } = await api.patch<PatientResponse>(`/patients/${id}`, payload);
    return data;
  },

  /** PATCH /patients/{id}/activate */
  async activate(id: string): Promise<PatientResponse> {
    const { data } = await api.patch<PatientResponse>(`/patients/${id}/activate`);
    return data;
  },

  /** PATCH /patients/{id}/deactivate */
  async deactivate(id: string): Promise<PatientResponse> {
    const { data } = await api.patch<PatientResponse>(`/patients/${id}/deactivate`);
    return data;
  },

  /** POST /patients/quick-create (201) */
  async quickCreate(payload: PatientQuickCreatePayload): Promise<PatientQuickCreateResponse> {
    const { data } = await api.post<PatientQuickCreateResponse>('/patients/quick-create', payload);
    return data;
  },

  /** GET /patients/{id}/summary */
  async getSummary(id: string): Promise<PatientSummaryResponse> {
    const { data } = await api.get<PatientSummaryResponse>(`/patients/${id}/summary`);
    return data;
  },
};
