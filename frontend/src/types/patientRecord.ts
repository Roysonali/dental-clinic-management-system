/* ============================================================
 * Patient Record Types
 *
 * Strictly mirrors backend `app/modules/patient_records/`:
 * - enums/  -> RecordStatus, DiagnosisType, AttachmentType
 * - schemas -> request + response DTOs (snake_case, verbatim)
 * - pagination -> {items, total, page, page_size, pages} — the
 *   patient-records module uses `pages` (NOT `total_pages`, which
 *   is the treatment-plan shape).
 *
 * Backend enums are uppercase string-valued, so string-literal
 * unions are used (the project's `erasableSyntaxOnly` tsconfig
 * forbids TS enums).
 * ============================================================ */

/* ── Enums (string-literal unions) ──────────────────────────────── */

/** Backend `RecordStatus` (enums/record_status.py). Sent/received verbatim. */
export type RecordStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'FINALIZED'
  | 'LOCKED';

/** Backend `DiagnosisType` (enums/diagnosis_type.py). */
export type DiagnosisType = 'PROVISIONAL' | 'CONFIRMED';

/** Backend `AttachmentType` (enums/attachment_type.py) — no VIDEO/OTHER. */
export type AttachmentType = 'IMAGE' | 'PDF' | 'REPORT' | 'SCAN' | 'DOCUMENT';

/* ── Pagination (module-specific shape) ─────────────────────────── */

/** Paginated envelope returned by every patient-records list endpoint. */
export interface PatientRecordListEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  /** `ceil(total/page_size)`; 0 when total = 0. */
  pages: number;
}

/* ── Record list / detail DTOs ──────────────────────────────────── */

/**
 * Row returned by `GET /patient-records` and `GET /patient-records/patient/{id}`.
 * No patient/appointment names — resolved client-side (backend returns ids only).
 */
export interface PatientRecordListItem {
  id: string;
  patient_id: string;
  appointment_id: string;
  status: RecordStatus;
  is_finalized: boolean;
  chief_complaint: string | null;
  created_at: string;
}

/** Lightweight nested child shapes embedded in the record-detail aggregate. */
export interface DiagnosisNestedResponse {
  id: string;
  diagnosis_name: string;
  diagnosis_type: DiagnosisType;
}

export interface PrescriptionItemNestedResponse {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface PrescriptionNestedResponse {
  id: string;
  prescribed_at: string;
  items: PrescriptionItemNestedResponse[];
}

export interface FollowupNestedResponse {
  id: string;
  followup_date: string;
  notes: string | null;
}

export interface AttachmentNestedResponse {
  id: string;
  attachment_type: AttachmentType;
  file_name: string;
  mime_type: string | null;
}

/**
 * Audit entry embedded in the record-detail response — visible to ALL
 * read roles here (O4); standalone audit endpoints are admin-only.
 */
export interface AuditNestedResponse {
  id: string;
  action: string;
  performed_by: number;
  performed_at: string;
}

/**
 * Full record aggregate (`PatientRecordResponse` schema) — returned by
 * detail, by-appointment and every record mutation. Carries all 11
 * clinical/medical text fields, all nested child families, the embedded
 * audit log and backend-computed counts. Counts are displayed as-is —
 * never recomputed client-side.
 */
export interface PatientRecordResponse {
  id: string;
  patient_id: string;
  appointment_id: string;
  status: RecordStatus;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
  chief_complaint: string | null;
  clinical_notes: string | null;
  doctor_remarks: string | null;
  treatment_recommendation: string | null;
  systemic_diseases: string | null;
  surgeries: string | null;
  medications: string | null;
  habits: string | null;
  medical_alerts: string | null;
  allergies: string | null;
  dental_history: string | null;
  diagnoses: DiagnosisNestedResponse[];
  prescriptions: PrescriptionNestedResponse[];
  followups: FollowupNestedResponse[];
  attachments: AttachmentNestedResponse[];
  audit_logs: AuditNestedResponse[];
  diagnosis_count: number;
  prescription_count: number;
  attachment_count: number;
  followup_count: number;
}

/* ── Request DTOs (mirror schemas, extra="forbid") ──────────────── */

/**
 * POST /patient-records payload. `patient_id`/`appointment_id` required;
 * the 11 text fields optional (≤ limits) and stripped — empty → null.
 */
export interface PatientRecordCreateRequest {
  patient_id: string;
  appointment_id: string;
  chief_complaint?: string | null;
  clinical_notes?: string | null;
  doctor_remarks?: string | null;
  treatment_recommendation?: string | null;
  systemic_diseases?: string | null;
  surgeries?: string | null;
  medications?: string | null;
  habits?: string | null;
  medical_alerts?: string | null;
  allergies?: string | null;
  dental_history?: string | null;
}

/**
 * PATCH /patient-records/{id} payload — all fields optional
 * (`exclude_unset`): omitted keys untouched, explicit `null` clears.
 */
export type PatientRecordUpdateRequest = Partial<PatientRecordCreateRequest>;

/** POST /patient-records/{id}/finalize — must be the literal `true`. */
export interface PatientRecordFinalizeRequest {
  confirm: true;
}

/* ── Diagnoses ──────────────────────────────────────────────────── */

export interface DiagnosisCreateRequest {
  /** 2–255 chars, non-empty after strip */
  diagnosis_name: string;
  diagnosis_type: DiagnosisType;
  /** ≤ 2000 */
  notes?: string | null;
}

export interface DiagnosisUpdateRequest {
  diagnosis_name?: string;
  diagnosis_type?: DiagnosisType;
  notes?: string | null;
}

/** Full diagnosis response (also the item-router response). */
export interface DiagnosisResponse {
  id: string;
  patient_record_id: string;
  diagnosis_name: string;
  diagnosis_type: DiagnosisType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Row from `GET /patient-records/{id}/diagnoses`. */
export interface DiagnosisListItem {
  id: string;
  diagnosis_name: string;
  diagnosis_type: DiagnosisType;
  created_at: string;
}

/* ── Prescriptions ──────────────────────────────────────────────── */

export interface PrescriptionItemCreateRequest {
  /** 2–255 */
  medicine_name: string;
  /** 1–100 */
  dosage: string;
  /** 1–100 */
  frequency: string;
  /** 1–100 */
  duration: string;
  /** ≤ 2000 */
  instructions?: string | null;
}

export interface PrescriptionItemUpdateRequest {
  medicine_name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string | null;
}

/** POST /patient-records/{id}/prescriptions — items 1–20, atomic. */
export interface PrescriptionCreateRequest {
  /** ≤ 3000 */
  notes?: string | null;
  items: PrescriptionItemCreateRequest[];
}

/** PATCH /prescriptions/{id} — NOTES ONLY (items are managed separately). */
export interface PrescriptionUpdateRequest {
  notes?: string | null;
}

/** Row from `GET /patient-records/{id}/prescriptions`. */
export interface PrescriptionListItem {
  id: string;
  prescribed_at: string;
  prescribed_by: number;
  medicine_count: number;
}

/** Full prescription incl. items (`PrescriptionResponse` schema). */
export interface PrescriptionResponse {
  id: string;
  patient_record_id: string;
  prescribed_by: number;
  prescribed_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: PrescriptionItemResponse[];
}

export interface PrescriptionItemResponse {
  id: string;
  prescription_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Attachments (metadata only — no upload/download) ───────────── */

export interface AttachmentCreateRequest {
  attachment_type: AttachmentType;
  /** 1–255, non-empty */
  file_name: string;
  /** 1–1000 — client-supplied path/link string (no file upload) */
  file_path: string;
  /** ≤ 100 */
  mime_type?: string | null;
  /** ≥ 0; backend rejects > 50 MB (400) */
  file_size?: number | null;
}

export interface AttachmentUpdateRequest {
  attachment_type?: AttachmentType;
  file_name?: string;
  mime_type?: string | null;
  file_size?: number | null;
  /** file_path is IMMUTABLE — never accepted by the update endpoint. */
}

/** Row from `GET /patient-records/{id}/attachments`. */
export interface AttachmentListItem {
  id: string;
  attachment_type: AttachmentType;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

/* ── Follow-ups ─────────────────────────────────────────────────── */

export interface FollowupCreateRequest {
  /** YYYY-MM-DD — must be today or future (else 400 business rule) */
  followup_date: string;
  /** ≤ 2000 */
  notes?: string | null;
}

export interface FollowupUpdateRequest {
  followup_date?: string;
  notes?: string | null;
}

/** Row from `GET /patient-records/{id}/followups` (followup_date ASC). */
export interface FollowupListItem {
  id: string;
  followup_date: string;
  notes: string | null;
  created_at: string;
}

/* ── Query params ───────────────────────────────────────────────── */

/** Query params for GET /patient-records (no sort params exist). */
export interface PatientRecordListParams {
  /** Matches chief_complaint OR clinical_notes (substring). */
  search?: string;
  status?: RecordStatus;
  is_finalized?: boolean;
  patient_id?: string;
  page?: number;
  page_size?: number;
}

/** Query params for the paginated child lists. */
export interface ChildListParams {
  page?: number;
  page_size?: number;
}

/* ── UI form values (never sent to the API as-is) ──────────────── */

/** Create/edit record form model (presentational). */
export interface PatientRecordFormValues {
  patient_id: string;
  appointment_id: string;
  chief_complaint: string;
  clinical_notes: string;
  doctor_remarks: string;
  treatment_recommendation: string;
  systemic_diseases: string;
  surgeries: string;
  medications: string;
  habits: string;
  medical_alerts: string;
  allergies: string;
  dental_history: string;
}

export interface DiagnosisFormValues {
  diagnosis_name: string;
  diagnosis_type: string;
  notes: string;
}

export interface PrescriptionItemFormValues {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionFormValues {
  notes: string;
  items: PrescriptionItemFormValues[];
}

export interface AttachmentFormValues {
  attachment_type: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: string;
}

export interface FollowupFormValues {
  followup_date: string;
  notes: string;
}

/* ── Enriched display types ─────────────────────────────────────── */

/** Record row enriched with resolved display names (backend returns ids only). */
export interface EnrichedPatientRecord extends PatientRecordListItem {
  patient_name: string | null;
  appointment_number: string | null;
}
