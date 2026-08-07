/**
 * Zod schemas for every Patient Records form.
 *
 * Each schema mirrors the corresponding backend schema (BCR §5) exactly:
 * - Record create/edit: patient_id + appointment_id required; 11 optional
 *   text fields with per-field limits (clinical_notes 10k, all others 5k).
 * - Diagnosis: name 2–255 required; type PROVISIONAL|CONFIRMED required;
 *   notes ≤ 2000.
 * - Prescription: notes ≤ 3000; items 1–20 of (name 2–255, dosage/
 *   frequency/duration 1–100, instructions ≤ 2000).
 * - Attachment (metadata only): type + file_name + file_path required;
 *   file_size ≥ 0 and ≤ 50 MB (backend 400).
 * - Follow-up: date required and must be today or future (backend 400);
 *   notes ≤ 2000.
 *
 * Text fields are kept as strings in the form and transformed to
 * null/omitted in `patientRecordFormUtils` — matching the backend's
 * strip-then-empty→null semantics.
 */
import { z } from 'zod';
import {
  ATTACHMENT_FILE_NAME_MAX,
  ATTACHMENT_FILE_PATH_MAX,
  ATTACHMENT_MAX_FILE_SIZE_BYTES,
  ATTACHMENT_MIME_MAX,
  DIAGNOSIS_NAME_MAX,
  DIAGNOSIS_NOTES_MAX,
  FOLLOWUP_NOTES_MAX,
  MEDICINE_INSTRUCTIONS_MAX,
  MEDICINE_NAME_MAX,
  MEDICINE_TEXT_MAX,
  PATIENT_RECORD_CLINICAL_NOTES_MAX,
  PATIENT_RECORD_TEXT_MAX,
  PRESCRIPTION_MAX_ITEMS,
  PRESCRIPTION_NOTES_MAX,
} from '../constants/patientRecord';
import { todayLocalISO } from './date';
import type {
  AttachmentFormValues,
  DiagnosisFormValues,
  FollowupFormValues,
  PatientRecordFormValues,
  PrescriptionFormValues,
  PrescriptionItemFormValues,
} from '../types/patientRecord';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Optional text bound helper: empty is fine, non-empty must respect the limit. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v.length === 0 || v.length <= max, {
      message: `${label} must be at most ${max} characters`,
    });

/** Required stripped text with a min/max bound (backend strips then rejects empty). */
const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

/* ── Record create / edit ────────────────────────────────────────── */

export const patientRecordFormSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  appointment_id: z.string().min(1, 'Appointment is required'),
  chief_complaint: optionalText(PATIENT_RECORD_TEXT_MAX, 'Chief complaint'),
  clinical_notes: optionalText(PATIENT_RECORD_CLINICAL_NOTES_MAX, 'Clinical notes'),
  doctor_remarks: optionalText(PATIENT_RECORD_TEXT_MAX, 'Doctor remarks'),
  treatment_recommendation: optionalText(PATIENT_RECORD_TEXT_MAX, 'Treatment recommendation'),
  systemic_diseases: optionalText(PATIENT_RECORD_TEXT_MAX, 'Systemic diseases'),
  surgeries: optionalText(PATIENT_RECORD_TEXT_MAX, 'Surgeries'),
  medications: optionalText(PATIENT_RECORD_TEXT_MAX, 'Medications'),
  habits: optionalText(PATIENT_RECORD_TEXT_MAX, 'Habits'),
  medical_alerts: optionalText(PATIENT_RECORD_TEXT_MAX, 'Medical alerts'),
  allergies: optionalText(PATIENT_RECORD_TEXT_MAX, 'Allergies'),
  dental_history: optionalText(PATIENT_RECORD_TEXT_MAX, 'Dental history'),
});

export type PatientRecordFormSchema = z.infer<typeof patientRecordFormSchema>;

/** Default (empty) values for the create-record form. */
export const defaultPatientRecordFormValues: PatientRecordFormValues = {
  patient_id: '',
  appointment_id: '',
  chief_complaint: '',
  clinical_notes: '',
  doctor_remarks: '',
  treatment_recommendation: '',
  systemic_diseases: '',
  surgeries: '',
  medications: '',
  habits: '',
  medical_alerts: '',
  allergies: '',
  dental_history: '',
};

/* ── Diagnosis ───────────────────────────────────────────────────── */

export const diagnosisFormSchema = z.object({
  diagnosis_name: requiredText(2, DIAGNOSIS_NAME_MAX, 'Diagnosis name'),
  diagnosis_type: z
    .string()
    .min(1, 'Diagnosis type is required')
    .refine((v) => v === 'PROVISIONAL' || v === 'CONFIRMED', {
      message: 'Diagnosis type must be PROVISIONAL or CONFIRMED',
    }),
  notes: optionalText(DIAGNOSIS_NOTES_MAX, 'Notes'),
});

export type DiagnosisFormSchema = z.infer<typeof diagnosisFormSchema>;

export const defaultDiagnosisFormValues: DiagnosisFormValues = {
  diagnosis_name: '',
  diagnosis_type: '',
  notes: '',
};

/* ── Prescription + medicine items ───────────────────────────────── */

export const prescriptionItemFormSchema = z.object({
  medicine_name: requiredText(2, MEDICINE_NAME_MAX, 'Medicine name'),
  dosage: requiredText(1, MEDICINE_TEXT_MAX, 'Dosage'),
  frequency: requiredText(1, MEDICINE_TEXT_MAX, 'Frequency'),
  duration: requiredText(1, MEDICINE_TEXT_MAX, 'Duration'),
  instructions: optionalText(MEDICINE_INSTRUCTIONS_MAX, 'Instructions'),
});

export type PrescriptionItemFormSchema = z.infer<typeof prescriptionItemFormSchema>;

export const emptyPrescriptionItem: PrescriptionItemFormValues = {
  medicine_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
};

export const prescriptionFormSchema = z.object({
  notes: optionalText(PRESCRIPTION_NOTES_MAX, 'Notes'),
  items: z
    .array(prescriptionItemFormSchema)
    .min(1, 'Add at least one medicine')
    .max(PRESCRIPTION_MAX_ITEMS, `A prescription can have at most ${PRESCRIPTION_MAX_ITEMS} medicines`),
});

export type PrescriptionFormSchema = z.infer<typeof prescriptionFormSchema>;

export const defaultPrescriptionFormValues: PrescriptionFormValues = {
  notes: '',
  items: [emptyPrescriptionItem],
};

/* ── Attachment (metadata only) ──────────────────────────────────── */

export const attachmentFormSchema = z.object({
  attachment_type: z
    .string()
    .min(1, 'Attachment type is required')
    .refine(
      (v) => ['IMAGE', 'PDF', 'REPORT', 'SCAN', 'DOCUMENT'].includes(v),
      { message: 'Select a valid attachment type' },
    ),
  file_name: requiredText(1, ATTACHMENT_FILE_NAME_MAX, 'File name'),
  file_path: requiredText(1, ATTACHMENT_FILE_PATH_MAX, 'File path'),
  mime_type: optionalText(ATTACHMENT_MIME_MAX, 'MIME type'),
  file_size: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), {
      message: 'File size must be a whole number of bytes',
    })
    .refine((v) => v === '' || Number(v) <= ATTACHMENT_MAX_FILE_SIZE_BYTES, {
      message: 'File size cannot exceed 50 MB',
    }),
});

export type AttachmentFormSchema = z.infer<typeof attachmentFormSchema>;

export const defaultAttachmentFormValues: AttachmentFormValues = {
  attachment_type: '',
  file_name: '',
  file_path: '',
  mime_type: '',
  file_size: '',
};

/* ── Follow-up ───────────────────────────────────────────────────── */

export const followupFormSchema = z.object({
  followup_date: z
    .string()
    .min(1, 'Follow-up date is required')
    .refine((v) => DATE_PATTERN.test(v), {
      message: 'Follow-up date must be a valid date (YYYY-MM-DD)',
    })
    .refine((v) => !DATE_PATTERN.test(v) || v >= todayLocalISO(), {
      message: 'Follow-up date must be today or a future date',
    }),
  notes: optionalText(FOLLOWUP_NOTES_MAX, 'Notes'),
});

export type FollowupFormSchema = z.infer<typeof followupFormSchema>;

export const defaultFollowupFormValues: FollowupFormValues = {
  followup_date: '',
  notes: '',
};
