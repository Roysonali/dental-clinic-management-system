/**
 * Patient Records module constants.
 *
 * Maintains alignment with backend `app/modules/patient_records/`:
 * - enums/record_status.py, diagnosis_type.py, attachment_type.py
 * - schemas (per-field length limits)
 * - routers (default page size 20, max 100)
 * - attachment service (50 MB file-size cap)
 */
import type { BadgeVariant } from '../components/common/Badge/badge.types';
import type {
  AttachmentType,
  DiagnosisType,
  RecordStatus,
} from '../types/patientRecord';

/** Default page size for GET /patient-records (matches backend default 20). */
export const PATIENT_RECORD_LIST_PAGE_SIZE = 20;

/** Max page size accepted by the backend. */
export const PATIENT_RECORD_MAX_PAGE_SIZE = 100;

/** Page-size options offered in the list toolbar. */
export const PATIENT_RECORD_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Max medicine items per prescription (schema `max_length=20`). */
export const PRESCRIPTION_MAX_ITEMS = 20;

/** Backend attachment size cap (50 MB) — service rejects larger with 400. */
export const ATTACHMENT_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/* ── Record status presentation ──────────────────────────────────── */

/** Status → BadgeVariant map (approved styling, UI spec §1.2). */
export const PATIENT_RECORD_STATUS_VARIANTS: Record<RecordStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  UNDER_REVIEW: 'warning',
  COMPLETED: 'success',
  FINALIZED: 'primary',
  LOCKED: 'neutral',
};

/** Human-readable status labels (display only). */
export const PATIENT_RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  FINALIZED: 'Finalized',
  LOCKED: 'Locked',
};

/** Status filter option descriptors for the list toolbar. */
export const PATIENT_RECORD_STATUS_FILTERS: readonly {
  value: RecordStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All Status' },
  ...(Object.keys(PATIENT_RECORD_STATUS_LABELS) as RecordStatus[]).map((s) => ({
    value: s,
    label: PATIENT_RECORD_STATUS_LABELS[s],
  })),
];

/* ── Diagnosis type presentation ─────────────────────────────────── */

export const DIAGNOSIS_TYPE_VARIANTS: Record<DiagnosisType, BadgeVariant> = {
  PROVISIONAL: 'warning',
  CONFIRMED: 'success',
};

export const DIAGNOSIS_TYPE_LABELS: Record<DiagnosisType, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
};

export const DIAGNOSIS_TYPE_FILTERS: readonly { value: DiagnosisType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'PROVISIONAL', label: 'Provisional' },
  { value: 'CONFIRMED', label: 'Confirmed' },
];

/* ── Attachment type presentation ───────────────────────────────── */

export const ATTACHMENT_TYPE_VARIANTS: Record<AttachmentType, BadgeVariant> = {
  IMAGE: 'info',
  PDF: 'danger',
  REPORT: 'warning',
  SCAN: 'neutral',
  DOCUMENT: 'primary',
};

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  IMAGE: 'Image',
  PDF: 'PDF',
  REPORT: 'Report',
  SCAN: 'Scan',
  DOCUMENT: 'Document',
};

/** Attachment type dropdown options (create/update forms). */
export const ATTACHMENT_TYPE_OPTIONS: readonly { value: AttachmentType; label: string }[] =
  Object.keys(ATTACHMENT_TYPE_LABELS).map((value) => ({
    value: value as AttachmentType,
    label: ATTACHMENT_TYPE_LABELS[value as AttachmentType],
  }));

/* ── Audit action labels (prettified; old/new values never parsed) ─ */

/**
 * Known audit actions → human labels. Unknown actions fall back to a
 * prettified version of the raw string (`utils/patientRecordFormatting`).
 * Extracted from `constants/audit_events.py` (the UI never diffs
 * old_value/new_value — they are opaque free-text).
 */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  PATIENT_RECORD_CREATED: 'Record created',
  PATIENT_RECORD_UPDATED: 'Record updated',
  PATIENT_RECORD_STATUS_CHANGED: 'Record status changed',
  PATIENT_RECORD_FINALIZED: 'Record finalized',
  PATIENT_RECORD_DELETED: 'Record deleted',
  DIAGNOSIS_CREATED: 'Diagnosis added',
  DIAGNOSIS_BULK_CREATED: 'Diagnoses added',
  DIAGNOSIS_UPDATED: 'Diagnosis updated',
  DIAGNOSIS_DELETED: 'Diagnosis removed',
  PRESCRIPTION_CREATED: 'Prescription created',
  PRESCRIPTION_UPDATED: 'Prescription updated',
  PRESCRIPTION_FINALIZED: 'Prescription finalized',
  PRESCRIPTION_DELETED: 'Prescription removed',
  PRESCRIPTION_ITEM_CREATED: 'Medicine added',
  PRESCRIPTION_ITEM_BULK_CREATED: 'Medicines added',
  PRESCRIPTION_ITEM_UPDATED: 'Medicine updated',
  PRESCRIPTION_ITEM_DELETED: 'Medicine removed',
  ATTACHMENT_UPLOADED: 'Attachment registered',
  ATTACHMENT_BULK_UPLOADED: 'Attachments registered',
  ATTACHMENT_UPDATED: 'Attachment updated',
  ATTACHMENT_DELETED: 'Attachment removed',
  FOLLOWUP_CREATED: 'Follow-up scheduled',
  FOLLOWUP_UPDATED: 'Follow-up updated',
  FOLLOWUP_DELETED: 'Follow-up removed',
};

/* ── Backend field length limits (mirror schemas exactly) ───────── */

/** chief_complaint + 9 of the 11 text fields: 5000 chars each. */
export const PATIENT_RECORD_TEXT_MAX = 5000;
/** clinical_notes is the exception: 10000 chars. */
export const PATIENT_RECORD_CLINICAL_NOTES_MAX = 10000;

export const DIAGNOSIS_NAME_MAX = 255;
export const DIAGNOSIS_NOTES_MAX = 2000;

export const PRESCRIPTION_NOTES_MAX = 3000;

export const MEDICINE_NAME_MAX = 255;
export const MEDICINE_TEXT_MAX = 100;
export const MEDICINE_INSTRUCTIONS_MAX = 2000;

export const ATTACHMENT_FILE_NAME_MAX = 255;
export const ATTACHMENT_FILE_PATH_MAX = 1000;
export const ATTACHMENT_MIME_MAX = 100;

export const FOLLOWUP_NOTES_MAX = 2000;
