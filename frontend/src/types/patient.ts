/* ============================================================
 * Patient Types
 *
 * Strictly mirrors backend `app/modules/patients/schemas.py`.
 * Do NOT invent fields, enums, or validation rules that don't
 * exist in the backend.
 * ============================================================ */

/** Backend `GenderEnum` — app/core/constants.py */
export type PatientGender = 'male' | 'female' | 'other';

/** Payload for POST /patients (PatientCreate schema). */
export interface PatientCreatePayload {
  /** 2–100 chars, alphabetic + space/hyphen/apostrophe */
  first_name: string;
  /** Optional, ≤100 chars */
  middle_name?: string | null;
  /** 2–100 chars, alphabetic + space/hyphen/apostrophe */
  last_name: string;
  /** ISO `YYYY-MM-DD`, not in the future, year ≥ 1900 */
  date_of_birth: string;
  gender: PatientGender;
  /** `^\+?[0-9]{10,15}$` */
  primary_contact_number: string;
  /** Optional, same pattern as primary */
  emergency_contact_number?: string | null;
  email?: string | null;
  /** ≤500 chars */
  address?: string | null;
  /** ≤1000 chars */
  remarks?: string | null;
}

/** Payload for PATCH /patients/{id} (PatientUpdate schema — all optional). */
export type PatientUpdatePayload = Partial<PatientCreatePayload>;

/** Full patient record (PatientResponse schema). */
export interface PatientResponse {
  /** UUID as string */
  id: string;
  /** e.g. PAT-000001 */
  patient_code: string;
  /** Computed by the backend (first + middle + last) */
  full_name: string;
  date_of_birth: string;
  /** Computed by the backend */
  age: number | null;
  gender: string | null;
  primary_contact_number: string;
  emergency_contact_number: string | null;
  email: string | null;
  address: string | null;
  remarks: string | null;
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight row for list views (PatientListItem schema). */
export interface PatientListItem {
  id: string;
  patient_code: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  primary_contact_number: string;
  is_active: boolean;
}

/** Paginated list response (PatientListResponse schema). */
export interface PatientListResponse {
  items: PatientListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** Query parameters accepted by GET /patients. */
export interface PatientListParams {
  /** 1-based page number */
  page?: number;
  /** Records per page (1–100) */
  page_size?: number;
  /** Full-text search across code, name, phone, email */
  search?: string;
  /** Filter by active status; omit to return all */
  is_active?: boolean;
}

/* ── UI form values (never sent to the API as-is) ──────────────────── */

/** PatientForm model — presentational layer, transformed before sending. */
export interface PatientFormValues {
  first_name: string;
  middle_name: string;
  last_name: string;
  /** ISO `YYYY-MM-DD` */
  date_of_birth: string;
  gender: string;
  primary_contact_number: string;
  emergency_contact_number: string;
  email: string;
  address: string;
  remarks: string;
}

/** Status filter used by the patient list toolbar. */
export type PatientStatusFilter = 'all' | 'active' | 'inactive';
