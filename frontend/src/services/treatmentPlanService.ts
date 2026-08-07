import { api } from './api';
import type {
  AddItemRequest,
  CreatePlanRequest,
  DashboardSummaryResponse,
  ItemUpdateRequest,
  PaginatedResponse,
  PlanListParams,
  ReorderItemsRequest,
  TreatmentPlanListItem,
  TreatmentPlanResponse,
  VersionDetailResponse,
  VersionListResponse,
  VersionRequest,
} from '../types/treatmentPlan';

/**
 * Treatment Plan API service.
 *
 * Endpoints mirror backend `app/modules/treatment/routers/treatment_plan_router.py`
 * (all 34 endpoints, no version prefix):
 * - Plan CRUD-lite: create, list, search, queues, dashboard, by-patient/by-doctor, counts, detail
 * - Items: add / update / remove / reorder
 * - Transitions: submit-for-review … complete (10, no body)
 * - Approval: doctor-approve / doctor-revoke / patient-acknowledge / patient-decline (no body)
 * - Versions: create / list / get / restore
 *
 * The backend returns plain objects (no `{success, data}` envelope), so each
 * method returns `data` as-is. Errors bubble as Axios errors for
 * `parseApiError`. All transition/approval endpoints take NO request body.
 */
export const treatmentPlanService = {
  /** POST /treatment-plans (201) — creates DRAFT + approval(pending) + version 1. */
  async createPlan(payload: CreatePlanRequest): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>('/treatment-plans', payload);
    return data;
  },

  /** GET /treatment-plans — server-side search/filter/sort/pagination. */
  async listPlans(params: PlanListParams = {}): Promise<PaginatedResponse<TreatmentPlanListItem>> {
    const { data } = await api.get<PaginatedResponse<TreatmentPlanListItem>>('/treatment-plans', { params });
    return data;
  },

  /** GET /treatment-plans/search — type-ahead by plan code (bare array). */
  async searchPlans(term: string, limit = 20): Promise<TreatmentPlanListItem[]> {
    const { data } = await api.get<TreatmentPlanListItem[]>('/treatment-plans/search', {
      params: { term, limit },
    });
    return data;
  },

  /** GET /treatment-plans/pending-review — plans in `under_review`. */
  async listPendingReview(page = 1, pageSize = 20): Promise<PaginatedResponse<TreatmentPlanListItem>> {
    const { data } = await api.get<PaginatedResponse<TreatmentPlanListItem>>(
      '/treatment-plans/pending-review',
      { params: { page, page_size: pageSize } },
    );
    return data;
  },

  /** GET /treatment-plans/pending-approval — `proposed` + unsigned doctor. */
  async listPendingApproval(page = 1, pageSize = 20): Promise<PaginatedResponse<TreatmentPlanListItem>> {
    const { data } = await api.get<PaginatedResponse<TreatmentPlanListItem>>(
      '/treatment-plans/pending-approval',
      { params: { page, page_size: pageSize } },
    );
    return data;
  },

  /** GET /treatment-plans/dashboard — aggregated stats. */
  async getDashboard(): Promise<DashboardSummaryResponse> {
    const { data } = await api.get<DashboardSummaryResponse>('/treatment-plans/dashboard');
    return data;
  },

  /** GET /treatment-plans/by-patient/{id}. */
  async listByPatient(patientId: string, params: PlanListParams = {}): Promise<PaginatedResponse<TreatmentPlanListItem>> {
    const { data } = await api.get<PaginatedResponse<TreatmentPlanListItem>>(
      `/treatment-plans/by-patient/${patientId}`,
      { params },
    );
    return data;
  },

  /** GET /treatment-plans/by-doctor/{id}. */
  async listByDoctor(doctorId: string, params: PlanListParams = {}): Promise<PaginatedResponse<TreatmentPlanListItem>> {
    const { data } = await api.get<PaginatedResponse<TreatmentPlanListItem>>(
      `/treatment-plans/by-doctor/${doctorId}`,
      { params },
    );
    return data;
  },

  /** GET /treatment-plans/count-by-status — sparse {status: count} map. */
  async countByStatus(): Promise<Record<string, number>> {
    const { data } = await api.get<Record<string, number>>('/treatment-plans/count-by-status');
    return data;
  },

  /** GET /treatment-plans/{id} — full aggregate (items + approval + versions). */
  async getPlan(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.get<TreatmentPlanResponse>(`/treatment-plans/${id}`);
    return data;
  },

  /* ── Items ─────────────────────────────────────────────────────── */

  /** POST /treatment-plans/{id}/items (201) — editable statuses only. */
  async addItem(id: string, payload: AddItemRequest): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/items`, payload);
    return data;
  },

  /** PATCH /treatment-plans/{id}/items/{itemId} — partial update. */
  async updateItem(id: string, itemId: string, payload: ItemUpdateRequest): Promise<TreatmentPlanResponse> {
    const { data } = await api.patch<TreatmentPlanResponse>(
      `/treatment-plans/${id}/items/${itemId}`,
      payload,
    );
    return data;
  },

  /** DELETE /treatment-plans/{id}/items/{itemId} — editable statuses only. */
  async removeItem(id: string, itemId: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.delete<TreatmentPlanResponse>(`/treatment-plans/${id}/items/${itemId}`);
    return data;
  },

  /** PUT /treatment-plans/{id}/items/reorder — all item ids exactly once. */
  async reorderItems(id: string, itemIds: string[]): Promise<TreatmentPlanResponse> {
    const { data } = await api.put<TreatmentPlanResponse>(
      `/treatment-plans/${id}/items/reorder`,
      { item_ids: itemIds } satisfies ReorderItemsRequest,
    );
    return data;
  },

  /* ── Status transitions (no body) ──────────────────────────────── */

  async submitForReview(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/submit-for-review`);
    return data;
  },
  async approveReview(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/approve-review`);
    return data;
  },
  async rejectReview(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/reject-review`);
    return data;
  },
  async acceptPlan(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/accept`);
    return data;
  },
  async declinePlan(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/decline`);
    return data;
  },
  async cancelPlan(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/cancel`);
    return data;
  },
  async startTreatment(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/start-treatment`);
    return data;
  },
  async putOnHold(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/hold`);
    return data;
  },
  async resume(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/resume`);
    return data;
  },
  async complete(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/complete`);
    return data;
  },

  /* ── Approval workflow (no body) ──────────────────────────────── */

  async doctorApprove(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/doctor-approve`);
    return data;
  },
  async doctorRevoke(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/doctor-revoke`);
    return data;
  },
  async patientAcknowledge(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/patient-acknowledge`);
    return data;
  },
  async patientDecline(id: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/patient-decline`);
    return data;
  },

  /* ── Versions ──────────────────────────────────────────────────── */

  /** POST /treatment-plans/{id}/versions (201) — creates immutable snapshot. */
  async createVersion(id: string, changeReason: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(`/treatment-plans/${id}/versions`, {
      change_reason: changeReason,
    } satisfies VersionRequest);
    return data;
  },

  /** GET /treatment-plans/{id}/versions — list snapshots (ascending). */
  async listVersions(id: string): Promise<VersionListResponse> {
    const { data } = await api.get<VersionListResponse>(`/treatment-plans/${id}/versions`);
    return data;
  },

  /** GET /treatment-plans/{id}/versions/{versionId} — snapshot detail (money as strings). */
  async getVersion(id: string, versionId: string): Promise<VersionDetailResponse> {
    const { data } = await api.get<VersionDetailResponse>(`/treatment-plans/${id}/versions/${versionId}`);
    return data;
  },

  /** POST /treatment-plans/{id}/versions/{versionId}/restore — editable statuses only. */
  async restoreVersion(id: string, versionId: string): Promise<TreatmentPlanResponse> {
    const { data } = await api.post<TreatmentPlanResponse>(
      `/treatment-plans/${id}/versions/${versionId}/restore`,
    );
    return data;
  },
};
