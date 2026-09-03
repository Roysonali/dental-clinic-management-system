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
  AttachmentFormValues,
  AttachmentUpdateRequest,
  AttachmentUploadPayload,
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
  };
  // Only include appointment_id when a value is provided
  if (values.appointment_id && values.appointment_id.length > 0) {
    request.appointment_id = values.appointment_id;
  }
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

/* ── Attachments (real file upload) ──────────────────────────────── */

/**
 * Build the multipart upload payload from the form: the actual File plus
 * the declared attachment category. The backend validates the file itself.
 */
export function attachmentFormValuesToUploadRequest(
  values: AttachmentFormValues,
): AttachmentUploadPayload {
  if (!values.file) {
    throw new Error('No file selected');
  }
  return {
    file: values.file,
    attachment_type: values.attachment_type as AttachmentUploadPayload['attachment_type'],
  };
}

/**
 * Attachment edit — only the category is editable; the stored file (and
 * its metadata) is immutable on the backend.
 */
export function attachmentFormValuesToUpdateRequest(
  values: AttachmentFormValues,
  original: { attachment_type: string },
): AttachmentUpdateRequest {
  const request: AttachmentUpdateRequest = {};
  if (values.attachment_type !== original.attachment_type) {
    request.attachment_type = values.attachment_type as AttachmentUpdateRequest['attachment_type'];
  }
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
