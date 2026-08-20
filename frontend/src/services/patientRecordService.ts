import { api } from './api';
import type {
  AttachmentListItem,
  AttachmentUpdateRequest,
  AttachmentUploadPayload,
  ChildListParams,
  DiagnosisCreateRequest,
  DiagnosisListItem,
  DiagnosisResponse,
  DiagnosisUpdateRequest,
  FollowupCreateRequest,
  FollowupListItem,
  FollowupUpdateRequest,
  PatientRecordCreateRequest,
  PatientRecordListEnvelope,
  PatientRecordListItem,
  PatientRecordListParams,
  PatientRecordResponse,
  PatientRecordUpdateRequest,
  PrescriptionCreateRequest,
  PrescriptionItemCreateRequest,
  PrescriptionItemResponse,
  PrescriptionItemUpdateRequest,
  PrescriptionListItem,
  PrescriptionResponse,
  PrescriptionUpdateRequest,
  RecordStatus,
} from '../types/patientRecord';

/**
 * Patient Record API service.
 *
 * Endpoints mirror backend `app/modules/patient_records/routers/*` (39 live
 * endpoints, no version prefix):
 * - Records: create, list, detail, by-appointment, by-patient, update,
 *   status (query param!), finalize ({confirm:true}), soft-delete (204).
 * - Diagnoses / Prescriptions (+items) / Attachments / Follow-ups: child
 *   CRUD families under `/patient-records/{id}/...` plus item routers.
 *
 * Contract notes ([BCR]):
 * - Every list endpoint returns `{items, total, page, page_size, pages}`
 *   (the module uses `pages`, not `total_pages`).
 * - No sort parameters exist anywhere — ordering is fixed server-side.
 * - DELETE endpoints return 204 (no body).
 * - Errors bubble as Axios errors for `parseApiError`; the envelope is
 *   `{success, message, details}` and the frontend branches on HTTP status.
 */
export const patientRecordService = {
  /* ── Records ─────────────────────────────────────────────────── */

  /** POST /patient-records (201) — DRAFT; 409 when the appointment already has a record. */
  async createRecord(payload: PatientRecordCreateRequest): Promise<PatientRecordResponse> {
    const { data } = await api.post<PatientRecordResponse>('/patient-records', payload);
    return data;
  },

  /** GET /patient-records — search/filter/paginate (fixed created_at DESC). */
  async listRecords(params: PatientRecordListParams = {}): Promise<PatientRecordListEnvelope<PatientRecordListItem>> {
    const { data } = await api.get<PatientRecordListEnvelope<PatientRecordListItem>>('/patient-records', { params });
    return data;
  },

  /** GET /patient-records/{id} — full aggregate with nested children + counts. */
  async getRecord(id: string): Promise<PatientRecordResponse> {
    const { data } = await api.get<PatientRecordResponse>(`/patient-records/${id}`);
    return data;
  },

  /** GET /patient-records/appointment/{id} — 404 when no record exists for the appointment. */
  async getRecordByAppointment(appointmentId: string): Promise<PatientRecordResponse> {
    const { data } = await api.get<PatientRecordResponse>(`/patient-records/appointment/${appointmentId}`);
    return data;
  },

  /** GET /patient-records/patient/{id} — records for one patient (created_at DESC). */
  async listRecordsByPatient(
    patientId: string,
    params: ChildListParams = {},
  ): Promise<PatientRecordListEnvelope<PatientRecordListItem>> {
    const { data } = await api.get<PatientRecordListEnvelope<PatientRecordListItem>>(
      `/patient-records/patient/${patientId}`,
      { params },
    );
    return data;
  },

  /** PATCH /patient-records/{id} — partial update (exclude_unset; null clears). */
  async updateRecord(id: string, payload: PatientRecordUpdateRequest): Promise<PatientRecordResponse> {
    const { data } = await api.patch<PatientRecordResponse>(`/patient-records/${id}`, payload);
    return data;
  },

  /** PATCH /patient-records/{id}/status?new_status=... — query parameter, not a body. */
  async changeStatus(id: string, newStatus: RecordStatus): Promise<PatientRecordResponse> {
    const { data } = await api.patch<PatientRecordResponse>(`/patient-records/${id}/status`, null, {
      params: { new_status: newStatus },
    });
    return data;
  },

  /** POST /patient-records/{id}/finalize — body must be exactly {confirm: true}. */
  async finalizeRecord(id: string): Promise<PatientRecordResponse> {
    const { data } = await api.post<PatientRecordResponse>(`/patient-records/${id}/finalize`, { confirm: true });
    return data;
  },

  /** DELETE /patient-records/{id} — soft delete, ADMIN only, 204 (no body). */
  async deleteRecord(id: string): Promise<void> {
    await api.delete(`/patient-records/${id}`);
  },

  /* ── Diagnoses ───────────────────────────────────────────────── */

  /** POST /patient-records/{id}/diagnoses (201). */
  async createDiagnosis(recordId: string, payload: DiagnosisCreateRequest): Promise<DiagnosisResponse> {
    const { data } = await api.post<DiagnosisResponse>(`/patient-records/${recordId}/diagnoses`, payload);
    return data;
  },

  /** GET /diagnoses/{id} — full diagnosis incl. notes (list rows omit notes). */
  async getDiagnosis(id: string): Promise<DiagnosisResponse> {
    const { data } = await api.get<DiagnosisResponse>(`/diagnoses/${id}`);
    return data;
  },

  /** GET /patient-records/{id}/diagnoses — optional diagnosis_type filter. */
  async listDiagnoses(
    recordId: string,
    params: ChildListParams & { diagnosis_type?: string } = {},
  ): Promise<PatientRecordListEnvelope<DiagnosisListItem>> {
    const { data } = await api.get<PatientRecordListEnvelope<DiagnosisListItem>>(
      `/patient-records/${recordId}/diagnoses`,
      { params },
    );
    return data;
  },

  /** PATCH /diagnoses/{id}. */
  async updateDiagnosis(id: string, payload: DiagnosisUpdateRequest): Promise<DiagnosisResponse> {
    const { data } = await api.patch<DiagnosisResponse>(`/diagnoses/${id}`, payload);
    return data;
  },

  /** DELETE /diagnoses/{id} — 204. */
  async deleteDiagnosis(id: string): Promise<void> {
    await api.delete(`/diagnoses/${id}`);
  },

  /* ── Prescriptions ───────────────────────────────────────────── */

  /** POST /patient-records/{id}/prescriptions (201) — 1–20 items, atomic. */
  async createPrescription(recordId: string, payload: PrescriptionCreateRequest): Promise<PrescriptionResponse> {
    const { data } = await api.post<PrescriptionResponse>(`/patient-records/${recordId}/prescriptions`, payload);
    return data;
  },

  /** GET /patient-records/{id}/prescriptions — prescribed_at DESC. */
  async listPrescriptions(
    recordId: string,
    params: ChildListParams = {},
  ): Promise<PatientRecordListEnvelope<PrescriptionListItem>> {
    const { data } = await api.get<PatientRecordListEnvelope<PrescriptionListItem>>(
      `/patient-records/${recordId}/prescriptions`,
      { params },
    );
    return data;
  },

  /** GET /prescriptions/{id} — full prescription incl. items. */
  async getPrescription(id: string): Promise<PrescriptionResponse> {
    const { data } = await api.get<PrescriptionResponse>(`/prescriptions/${id}`);
    return data;
  },

  /** PATCH /prescriptions/{id} — NOTES ONLY. */
  async updatePrescription(id: string, payload: PrescriptionUpdateRequest): Promise<PrescriptionResponse> {
    const { data } = await api.patch<PrescriptionResponse>(`/prescriptions/${id}`, payload);
    return data;
  },

  /** DELETE /prescriptions/{id} — 204. */
  async deletePrescription(id: string): Promise<void> {
    await api.delete(`/prescriptions/${id}`);
  },

  /* ── Prescription items ──────────────────────────────────────── */

  /** POST /prescriptions/{id}/items (201). */
  async createPrescriptionItem(
    prescriptionId: string,
    payload: PrescriptionItemCreateRequest,
  ): Promise<PrescriptionItemResponse> {
    const { data } = await api.post<PrescriptionItemResponse>(`/prescriptions/${prescriptionId}/items`, payload);
    return data;
  },

  /** POST /prescriptions/{id}/items/bulk (201) — all-or-nothing array body. */
  async bulkCreatePrescriptionItems(
    prescriptionId: string,
    payload: PrescriptionItemCreateRequest[],
  ): Promise<PrescriptionItemResponse[]> {
    const { data } = await api.post<PrescriptionItemResponse[]>(
      `/prescriptions/${prescriptionId}/items/bulk`,
      payload,
    );
    return data;
  },

  /** GET /prescriptions/{id}/items — created_at ASC. */
  async listPrescriptionItems(
    prescriptionId: string,
    params: ChildListParams = {},
  ): Promise<PatientRecordListEnvelope<PrescriptionItemResponse>> {
    const { data } = await api.get<PatientRecordListEnvelope<PrescriptionItemResponse>>(
      `/prescriptions/${prescriptionId}/items`,
      { params },
    );
    return data;
  },

  /** PATCH /prescription-items/{id}. */
  async updatePrescriptionItem(id: string, payload: PrescriptionItemUpdateRequest): Promise<PrescriptionItemResponse> {
    const { data } = await api.patch<PrescriptionItemResponse>(`/prescription-items/${id}`, payload);
    return data;
  },

  /** DELETE /prescription-items/{id} — 204. */
  async deletePrescriptionItem(id: string): Promise<void> {
    await api.delete(`/prescription-items/${id}`);
  },

  /* ── Attachments (real file uploads) ─────────────────────────── */

  /**
   * POST /patient-records/{id}/attachments (201) — multipart/form-data
   * with the real file. Axios sets the multipart boundary automatically;
   * the Authorization header is attached by the shared interceptor.
   */
  async createAttachment(recordId: string, payload: AttachmentUploadPayload): Promise<AttachmentListItem> {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('attachment_type', payload.attachment_type);
    const { data } = await api.post<AttachmentListItem>(`/patient-records/${recordId}/attachments`, formData);
    return data;
  },

  /** GET /patient-records/{id}/attachments — created_at DESC. */
  async listAttachments(
    recordId: string,
    params: ChildListParams = {},
  ): Promise<PatientRecordListEnvelope<AttachmentListItem>> {
    const { data } = await api.get<PatientRecordListEnvelope<AttachmentListItem>>(
      `/patient-records/${recordId}/attachments`,
      { params },
    );
    return data;
  },

  /** GET /attachments/{id} — full attachment metadata. */
  async getAttachment(id: string): Promise<AttachmentListItem & { file_path: string; patient_record_id: string }> {
    const { data } = await api.get<AttachmentListItem & { file_path: string; patient_record_id: string }>(
      `/attachments/${id}`,
    );
    return data;
  },

  /**
   * GET /attachments/{id}/download — fetch the stored file as a Blob.
   * The JWT is attached by the interceptor; files are only ever served
   * through this authorized endpoint (never a public path).
   */
  async downloadAttachment(id: string): Promise<Blob> {
    const { data } = await api.get<Blob>(`/attachments/${id}/download`, { responseType: 'blob' });
    return data;
  },

  /**
   * GET /attachments/{id}/preview — fetch the stored file inline for
   * browser rendering (PDF / images only; backend rejects other types).
   */
  async previewAttachment(id: string): Promise<Blob> {
    const { data } = await api.get<Blob>(`/attachments/${id}/preview`, { responseType: 'blob' });
    return data;
  },

  /** PATCH /attachments/{id} — the stored file is immutable. */
  async updateAttachment(id: string, payload: AttachmentUpdateRequest): Promise<AttachmentListItem> {
    const { data } = await api.patch<AttachmentListItem>(`/attachments/${id}`, payload);
    return data;
  },

  /** DELETE /attachments/{id} — 204. */
  async deleteAttachment(id: string): Promise<void> {
    await api.delete(`/attachments/${id}`);
  },

  /* ── Follow-ups ──────────────────────────────────────────────── */

  /** POST /patient-records/{id}/followups (201) — date must be today or future. */
  async createFollowup(recordId: string, payload: FollowupCreateRequest): Promise<FollowupListItem> {
    const { data } = await api.post<FollowupListItem>(`/patient-records/${recordId}/followups`, payload);
    return data;
  },

  /** GET /patient-records/{id}/followups — followup_date ASC (soonest first). */
  async listFollowups(
    recordId: string,
    params: ChildListParams = {},
  ): Promise<PatientRecordListEnvelope<FollowupListItem>> {
    const { data } = await api.get<PatientRecordListEnvelope<FollowupListItem>>(
      `/patient-records/${recordId}/followups`,
      { params },
    );
    return data;
  },

  /** PATCH /followups/{id} — date re-validated (today-or-future). */
  async updateFollowup(id: string, payload: FollowupUpdateRequest): Promise<FollowupListItem> {
    const { data } = await api.patch<FollowupListItem>(`/followups/${id}`, payload);
    return data;
  },

  /** DELETE /followups/{id} — 204. */
  async deleteFollowup(id: string): Promise<void> {
    await api.delete(`/followups/${id}`);
  },
};
