/* ============================================================
 * Doctor Types (frontend)
 *
 * Strictly mirrors backend `app/modules/doctors/schemas.py`.
 * Do NOT invent fields, enums, or validation rules that don't
 * exist in the backend.
 *
 * NOTE: the backend list endpoint returns FULL `DoctorResponse`
 * records (not a summary slice), so `DoctorListResponse.items`
 * is typed as `DoctorResponse[]`. `DoctorUserResponse` remains
 * exported for the Appointment module's name-resolution use
 * (`GET /doctors/user/{user_id}`).
 * ============================================================ */

/* ── Supporting enums / unions ───────────────────────────────────────── */

/** Backend `GenderEnum` — app/core/constants.py. */
export type DoctorGender = 'male' | 'female' | 'other';

/** Allowed sort fields for GET /doctors (backend Literal). */
export type DoctorSortField = 'full_name' | 'years_of_experience';

/** Sort direction for GET /doctors. */
export type SortOrder = 'asc' | 'desc';

/** Schedule day-of-week (0=Monday … 5=Saturday; NO Sunday). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5;

/** Availability flag state (display). */
export type AvailabilityStatus = 'available' | 'unavailable';

/** Status filter used by the doctor list toolbar. */
export type DoctorStatusFilter = 'all' | 'active' | 'inactive';

/** Availability filter used by the doctor list toolbar. */
export type DoctorAvailabilityFilter = 'all' | AvailabilityStatus;

/* ── Request models ──────────────────────────────────────────────────── */

/** Payload for POST /doctors (DoctorCreate schema). */
export interface DoctorCreateRequest {
  /** FK to an existing active User with a DOCTOR-family role */
  user_id: number;
  /** ISO `YYYY-MM-DD`; not in the future; year ≥ 1900 */
  date_of_birth?: string | null;
  gender?: DoctorGender | null;
  /** `^\+?[1-9]\d{9,14}$` after stripping `[ \s-()]` */
  primary_phone: string;
  /** ≤ 500 chars */
  address?: string | null;
  /** ≤ 500 chars */
  qualification?: string | null;
  /** normalized: trim + uppercase, `^[A-Z0-9-]+$`, unique */
  registration_number?: string | null;
  /** 0–50 */
  years_of_experience?: number | null;
  /** > 0, ≤ 10 digits, ≤ 2 decimals */
  consultation_fee?: number | null;
  /** 15–240 minutes */
  consultation_duration?: number | null;
  /** non-empty strings; title-cased, deduplicated by backend */
  languages_known?: string[] | null;
  /** valid absolute URL */
  profile_photo_url?: string | null;
  /** ≤ 2000 chars, not whitespace-only */
  biography?: string | null;
  /** ≤ 100 chars */
  emergency_contact_name?: string | null;
  /** same pattern as primary_phone */
  emergency_contact_phone?: string | null;
}

/** Payload for PATCH /doctors/{id} (DoctorUpdate — all optional, no user_id). */
export type DoctorUpdateRequest = Partial<Omit<DoctorCreateRequest, 'user_id'>>;

/* ── Read models ─────────────────────────────────────────────────────── */

/** Nested specialization assignment (DoctorSpecializationResponse). */
export interface DoctorSpecializationResponse {
  specialization_id: number;
  specialization_name: string;
  specialization_code: string;
  is_primary: boolean;
  certification_date: string | null;
}

/** Weekly schedule template (ScheduleResponse). */
export interface ScheduleResponse {
  id: string;
  doctor_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

/** Full doctor record (DoctorResponse) — used by list, detail, mutations. */
export interface DoctorResponse {
  /** UUID as string */
  id: string;
  /** auto-generated, e.g. "DOC-000001" (read-only) */
  doctor_code: string;
  user_id: number;
  user_full_name: string | null;
  user_email: string | null;
  date_of_birth: string | null;
  gender: DoctorGender | null;
  primary_phone: string;
  address: string | null;
  qualification: string | null;
  registration_number: string | null;
  years_of_experience: number | null;
  consultation_fee: number | null;
  consultation_duration: number | null;
  languages_known: string[] | null;
  profile_photo_url: string | null;
  biography: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  available_for_appointment: boolean;
  on_leave: boolean;
  is_active: boolean;
  specializations: DoctorSpecializationResponse[];
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

/** Extended profile for GET /doctors/{id}/profile (= DoctorResponse + schedules). */
export interface DoctorProfileResponse extends DoctorResponse {
  schedules: ScheduleResponse[];
}

/** Paginated list response (DoctorListResponse — items are FULL records). */
export interface DoctorListResponse {
  items: DoctorResponse[];
  total: number;
  page: number;
  page_size: number;
}

/** Query parameters accepted by GET /doctors. */
export interface DoctorListParams {
  /** 1-based page number */
  page?: number;
  /** Records per page (1–100) */
  page_size?: number;
  /** Partial match on doctor code or user full name */
  search?: string;
  /** Filter by active status */
  is_active?: boolean;
  /** Filter by availability for appointments */
  is_available?: boolean;
  /** Filter by specialization */
  specialization_id?: number;
  sort_by?: DoctorSortField;
  sort_order?: SortOrder;
}

/** Specialization master-data record (SpecializationResponse). */
export interface SpecializationResponse {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
}

/** Paginated specialization list (SpecializationListResponse). */
export interface SpecializationListResponse {
  items: SpecializationResponse[];
  total: number;
  page: number;
  page_size: number;
}

/** Query parameters accepted by GET /specializations. */
export interface SpecializationListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/* ── Appointment-facing subset (unchanged) ───────────────────────────── */

/**
 * Doctor profile returned by GET /doctors/user/{user_id}.
 * Used by the Appointment module to resolve a dentist's display name.
 */
export interface DoctorUserResponse {
  /** UUID of the doctor profile */
  id: string;
  /** Auto-generated code (e.g. "DOC-00001") */
  doctor_code: string;
  /** Linked User PK (matches `AppointmentResponse.dentist_id`) */
  user_id: number;
  /** Display name resolved from the User relationship (may be null) */
  user_full_name: string | null;
  /** Email resolved from the User relationship (may be null) */
  user_email: string | null;
}

/* ── UI form values (never sent to the API as-is) ───────────────────── */

/** DoctorForm model — presentational layer, transformed before sending. */
export interface DoctorFormValues {
  /** Set by the shared UserSearchSelect (create mode); numeric id as string */
  user_id: string;
  /** ISO `YYYY-MM-DD` or '' */
  date_of_birth: string;
  gender: string;
  primary_phone: string;
  address: string;
  qualification: string;
  registration_number: string;
  /** Numeric inputs are held as strings by the form */
  years_of_experience: string;
  consultation_fee: string;
  consultation_duration: string;
  languages_known: string[];
  profile_photo_url: string;
  biography: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}
