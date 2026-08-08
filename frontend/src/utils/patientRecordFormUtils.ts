/**
 * Patient Record form transformers.
 *
 * Presentational form values are never sent to the API as-is:
 * - Optional text fields: trimmed; empty strings become `null` (the
 *   canonical empty the backend stores — its strip-then-empty→null
 *   validators do the same).
 * - Record EDIT uses `exclude_unset` PATCH semantics: only fields that
 *   CHANGED are included; a field cleared to empty is sent as explicit
 *   `null` (erases the stored value); untouched fields are omitted.
 * - file_size is a string in the form; parsed to int only when present.
 */
import type {
  AttachmentCreateRequest,
  AttachmentFormValues,
  AttachmentUpdateRequest,
  DiagnosisCreateRequest,
  DiagnosisFormValues,
  DiagnosisUpdateRequest,
  FollowupCreateRequest,
  FollowupFormValues,
  FollowupUpdateRequest,
  PatientRecordCreateRequest,
  PatientRecordFormValues,
  PatientRecordResponse,
  PatientRecordUpdateRequest,
  PrescriptionCreateRequest,
  PrescriptionFormValues,
  PrescriptionItemCreateRequest,
  PrescriptionItemFormValues,
  PrescriptionItemUpdateRequest,
  PrescriptionUpdateRequest,
} from '../types/patientRecord';

/** The 11 optional clinical/medical text fields (shared by create/update). */
const CLINICAL_FIELDS = [
  'chief_complaint',
  'clinical_notes',
  'doctor_remarks',
  'treatment_recommendation',
  'systemic_diseases',
  'surgeries',
  'medications',
  'habits',
  'medical_alerts',
  'allergies',
  'dental_history',
] as const;

const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Record create payload: required ids + nullable text fields. */
export function recordFormValuesToCreateRequest(values: PatientRecordFormValues): PatientRecordCreateRequest {
  const request: PatientRecordCreateRequest = {
    patient_id: values.patient_id,
    appointment_id: values.appointment_id,
  };
  for (const field of CLINICAL_FIELDS) {
    request[field] = toNullable(values[field]);
  }
  return request;
}

/**
 * Record edit payload (PATCH `exclude_unset` semantics):
 * - Changed field → included.
 * - Cleared to empty → explicit `null` (erases the stored value).
 * - Untouched → omitted (backend leaves it as-is).
 *
 * `clinical_notes` is the exception to the 5k limit on the other fields —
 * bounds are enforced by the zod schema before this runs.
 */
export function recordFormValuesToUpdateRequest(
  values: PatientRecordFormValues,
  original: PatientRecordResponse,
): PatientRecordUpdateRequest {
  const request: PatientRecordUpdateRequest = {};
  for (const field of CLINICAL_FIELDS) {
    const next = values[field].trim();
    const prev = original[field] ?? '';
    if (next === prev) continue; // untouched — omit
    request[field] = next.length > 0 ? next : null; // cleared → null
  }
  return request;
}

/* ── Diagnoses ───────────────────────────────────────────────────── */

export function diagnosisFormValuesToCreateRequest(
  values: DiagnosisFormValues,
): DiagnosisCreateRequest {
  return {
    diagnosis_name: values.diagnosis_name.trim(),
    diagnosis_type: values.diagnosis_type as DiagnosisCreateRequest['diagnosis_type'],
    notes: toNullable(values.notes),
  };
}

export function diagnosisFormValuesToUpdateRequest(
  values: DiagnosisFormValues,
  original: { diagnosis_name: string; diagnosis_type: string; notes: string | null },
): DiagnosisUpdateRequest {
  const request: DiagnosisUpdateRequest = {};
  const name = values.diagnosis_name.trim();
  if (name !== original.diagnosis_name) request.diagnosis_name = name;
  if (values.diagnosis_type !== original.diagnosis_type) {
    request.diagnosis_type = values.diagnosis_type as DiagnosisUpdateRequest['diagnosis_type'];
  }
  const notes = toNullable(values.notes);
  if (notes !== original.notes) request.notes = notes;
  return request;
}

/* ── Prescriptions + items ───────────────────────────────────────── */

export function prescriptionItemFormValuesToRequest(
  item: PrescriptionItemFormValues,
): PrescriptionItemCreateRequest {
  return {
    medicine_name: item.medicine_name.trim(),
    dosage: item.dosage.trim(),
    frequency: item.frequency.trim(),
    duration: item.duration.trim(),
    instructions: toNullable(item.instructions),
  };
}

export function prescriptionFormValuesToCreateRequest(
  values: PrescriptionFormValues,
): PrescriptionCreateRequest {
  return {
    notes: toNullable(values.notes),
    items: values.items.map(prescriptionItemFormValuesToRequest),
  };
}

export function prescriptionItemFormValuesToUpdateRequest(
  item: PrescriptionItemFormValues,
  original: {
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string | null;
  },
): PrescriptionItemUpdateRequest {
  const request: PrescriptionItemUpdateRequest = {};
  const medicineName = item.medicine_name.trim();
  const dosage = item.dosage.trim();
  const frequency = item.frequency.trim();
  const duration = item.duration.trim();
  const instructions = toNullable(item.instructions);
  if (medicineName !== original.medicine_name) request.medicine_name = medicineName;
  if (dosage !== original.dosage) request.dosage = dosage;
  if (frequency !== original.frequency) request.frequency = frequency;
  if (duration !== original.duration) request.duration = duration;
  if (instructions !== original.instructions) request.instructions = instructions;
  return request;
}

/** Notes-only prescription update (items are managed via the items endpoints). */
export function prescriptionNotesToUpdateRequest(notes: string): PrescriptionUpdateRequest {
  return { notes: toNullable(notes) };
}

/* ── Attachments (metadata only) ─────────────────────────────────── */

export function attachmentFormValuesToCreateRequest(
  values: AttachmentFormValues,
): AttachmentCreateRequest {
  const request: AttachmentCreateRequest = {
    attachment_type: values.attachment_type as AttachmentCreateRequest['attachment_type'],
    file_name: values.file_name.trim(),
    file_path: values.file_path.trim(),
    mime_type: toNullable(values.mime_type),
  };
  const size = values.file_size.trim();
  if (size) request.file_size = Number(size);
  return request;
}

/**
 * Attachment edit — file_path is IMMUTABLE on the backend, so it is never
 * part of the update payload (the form renders it read-only). attachment_type
 * IS editable and is included when it changed.
 */
export function attachmentFormValuesToUpdateRequest(
  values: AttachmentFormValues,
  original: {
    file_name: string;
    mime_type: string | null;
    file_size: number | null;
    attachment_type: string;
  },
): AttachmentUpdateRequest {
  const request: AttachmentUpdateRequest = {};
  if (values.attachment_type !== original.attachment_type) {
    request.attachment_type = values.attachment_type as AttachmentUpdateRequest['attachment_type'];
  }
  const file_name = values.file_name.trim();
  if (file_name !== original.file_name) request.file_name = file_name;
  const mime_type = toNullable(values.mime_type);
  if (mime_type !== original.mime_type) request.mime_type = mime_type;
  const size = values.file_size.trim();
  const nextSize = size ? Number(size) : null;
  if (nextSize !== original.file_size) request.file_size = nextSize ?? undefined;
  return request;
}

/* ── Follow-ups ──────────────────────────────────────────────────── */

export function followupFormValuesToCreateRequest(
  values: FollowupFormValues,
): FollowupCreateRequest {
  return {
    followup_date: values.followup_date,
    notes: toNullable(values.notes),
  };
}

export function followupFormValuesToUpdateRequest(
  values: FollowupFormValues,
  original: { followup_date: string; notes: string | null },
): FollowupUpdateRequest {
  const request: FollowupUpdateRequest = {};
  if (values.followup_date !== original.followup_date) {
    request.followup_date = values.followup_date;
  }
  const notes = toNullable(values.notes);
  if (notes !== original.notes) request.notes = notes;
  return request;
}
