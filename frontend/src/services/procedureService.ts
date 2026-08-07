import { api } from './api';
import type {
  ProcedureCreateRequest,
  ProcedureListParams,
  ProcedureResponse,
  ProcedureUpdateRequest,
} from '../types/procedure';
import type { PaginatedResponse } from '../types/treatmentPlan';

/**
 * Procedure Catalog API service.
 *
 * Endpoints mirror backend `app/modules/treatment/routers/procedure_router.py`
 * (11 endpoints). Read endpoints allow the full plan role set 🅰; write
 * endpoints (create/update/activate/deactivate/delete) require ADMIN or
 * CHIEF_DOCTOR (⭐) — gated in the UI with `PermissionGate`.
 *
 * `DELETE /procedures/{id}` returns 204 with no body → method returns void.
 */
export const procedureService = {
  /** GET /procedures — paginated list + category/is_active filters + sort. */
  async list(params: ProcedureListParams = {}): Promise<PaginatedResponse<ProcedureResponse>> {
    const { data } = await api.get<PaginatedResponse<ProcedureResponse>>('/procedures', { params });
    return data;
  },

  /** GET /procedures/search — type-ahead by code or name (bare array). */
  async search(term: string, limit = 20): Promise<ProcedureResponse[]> {
    const { data } = await api.get<ProcedureResponse[]>('/procedures/search', {
      params: { term, limit },
    });
    return data;
  },

  /** GET /procedures/active — all active procedures ordered by code (dropdown source). */
  async listActive(): Promise<ProcedureResponse[]> {
    const { data } = await api.get<ProcedureResponse[]>('/procedures/active');
    return data;
  },

  /** GET /procedures/count — total count, optionally filtered by is_active. */
  async count(isActive?: boolean): Promise<{ count: number }> {
    const { data } = await api.get<{ count: number }>('/procedures/count', {
      params: isActive === undefined ? {} : { is_active: isActive },
    });
    return data;
  },

  /** GET /procedures/{id}. */
  async get(id: number): Promise<ProcedureResponse> {
    const { data } = await api.get<ProcedureResponse>(`/procedures/${id}`);
    return data;
  },

  /** GET /procedures/by-code/{code} — case-insensitive business-code lookup. */
  async getByCode(code: string): Promise<ProcedureResponse> {
    const { data } = await api.get<ProcedureResponse>(`/procedures/by-code/${encodeURIComponent(code)}`);
    return data;
  },

  /** POST /procedures (201) — admin only; code uppercased by the backend. */
  async create(payload: ProcedureCreateRequest): Promise<ProcedureResponse> {
    const { data } = await api.post<ProcedureResponse>('/procedures', payload);
    return data;
  },

  /** PATCH /procedures/{id} — `code` is immutable (absent from the schema). */
  async update(id: number, payload: ProcedureUpdateRequest): Promise<ProcedureResponse> {
    const { data } = await api.patch<ProcedureResponse>(`/procedures/${id}`, payload);
    return data;
  },

  /** PATCH /procedures/{id}/activate — admin only (already-active → 409). */
  async activate(id: number): Promise<ProcedureResponse> {
    const { data } = await api.patch<ProcedureResponse>(`/procedures/${id}/activate`);
    return data;
  },

  /** PATCH /procedures/{id}/deactivate — admin only (idempotent). */
  async deactivate(id: number): Promise<ProcedureResponse> {
    const { data } = await api.patch<ProcedureResponse>(`/procedures/${id}/deactivate`);
    return data;
  },

  /** DELETE /procedures/{id} — 204, admin only; must be inactive (else 409). */
  async delete(id: number): Promise<void> {
    await api.delete(`/procedures/${id}`);
  },
};
