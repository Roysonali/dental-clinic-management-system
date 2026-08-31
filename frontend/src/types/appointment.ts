/* ============================================================
 * Appointment Types
 *
 * Strictly mirrors backend `app/modules/appointments/`:
 * - schema.py  -> AppointmentResponse, AppointmentListResponse
 * - enums.py   -> AppointmentStatus, AppointmentType
 *
 * Backend enums are string-valued ("Scheduled", "Checked In", ...), so the
 * frontend uses string-literal unions (the project's `erasableSyntaxOnly`
 * tsconfig forbids TS enums).
 * ============================================================ */

/** Backend `AppointmentStatus` enum (enums.py). Sent/received verbatim. */
export type AppointmentStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'Checked In'
  | 'In Treatment'
  | 'Completed'
  | 'Cancelled'
  | 'No Show';

/** Backend `AppointmentType` enum (enums.py). */
export type AppointmentType =
  | 'Consultation'
  | 'Follow-Up'
  | 'Emergency'
  | 'Procedure'
  | 'Review'
  | 'Other';

/**
 * Single appointment record (AppointmentResponse schema).
 * Time fields are `HH:MM:SS` (24h) strings; `appointment_date` is `YYYY-MM-DD`.
 */
export interface AppointmentResponse {
  id: string;
  appointment_number: string;
  patient_id: string;
  dentist_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit: string;
  notes: string | null;
  /** Resolved patient display name (from eager-loaded relationship). */
  patient_name?: string | null;
  /** Resolved dentist display name (from eager-loaded relationship). */
  dentist_name?: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Paginated list (AppointmentListResponse schema).
 * NOTE: backend returns plain `{items, total}` — not wrapped in a
 * `{success, data}` envelope, so the service returns it as-is.
 */
export interface AppointmentListResponse {
  items: AppointmentResponse[];
  total: number;
}

/**
 * Query parameters for GET /appointments.
 * Backend only accepts `skip` and `limit` (router.py). No search/status/date
 * filters exist on the endpoint, so none are exposed here.
 */
export interface AppointmentListParams {
  /** Zero-based offset (default 0) */
  skip?: number;
  /** Records per page (default 20, backend max 100) */
  limit?: number;
  /** Search appointment number, patient name or phone */
  search?: string;
  /** Filter by appointment status */
  status?: AppointmentStatus;
  /** Inclusive start date (YYYY-MM-DD) */
  date_from?: string;
  /** Inclusive end date (YYYY-MM-DD) */
  date_to?: string;
  /** Filter by dentist user ID */
  dentist_id?: number;
}

/**
 * Payload for POST /appointments (AppointmentCreate schema).
 * `start_time` is `HH:MM:SS` (24h). `patient_id` is a UUID string.
 * `dentist_id` is the linked User PK (matches the doctor's `user_id`).
 */
export interface AppointmentCreatePayload {
  patient_id: string;
  dentist_id: number;
  /** ISO `YYYY-MM-DD` */
  appointment_date: string;
  /** `HH:MM:SS` 24h */
  start_time: string;
  /** Backend-allowed durations: 15/30/45/60 */
  duration_minutes: number;
  appointment_type: AppointmentType;
  /** 3–500 chars */
  reason_for_visit: string;
  /** ≤5000 chars */
  notes?: string | null;
}

/**
 * Payload for PUT /appointments/{id} (AppointmentUpdate schema).
 * NOTE: the backend update schema does NOT accept `patient_id` or `status` —
 * the patient is fixed for the appointment's lifetime and status is managed
 * via PATCH /appointments/{id}/cancel only.
 */
export interface AppointmentUpdatePayload {
  dentist_id?: number;
  appointment_date?: string;
  start_time?: string;
  duration_minutes?: number;
  appointment_type?: AppointmentType;
  reason_for_visit?: string;
  notes?: string | null;
}

/* ── UI form values (never sent to the API as-is) ──────────────────── */

/**
 * AppointmentForm model — presentational layer, transformed before sending.
 * `dentist_id` / `duration_minutes` are strings because they map to native
 * `<select>` options; they are converted to numbers by the payload builders.
 * `start_time` is `HH:MM` (TimePicker format) — converted to `HH:MM:SS`.
 */
export interface AppointmentFormValues {
  patient_id: string;
  dentist_id: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: string;
  /** Validated against APPOINTMENT_TYPE_OPTIONS; cast to AppointmentType on send */
  appointment_type: string;
  reason_for_visit: string;
  notes: string;
}

/**
 * Appointment row enriched with display names resolved via lookups.
 * `patient_name` / `dentist_name` are `null` when unresolved (failed lookup or
 * not yet loaded) — the UI falls back to an ID-based label.
 */
export interface EnrichedAppointment extends AppointmentResponse {
  patient_name: string | null;
  dentist_name: string | null;
}

/* ── Calendar types ─────────────────────────────────────────────── */

/**
 * Single calendar appointment (CalendarAppointmentResponse schema).
 * Returned by GET /appointments/calendar — includes pre-resolved patient and
 * dentist display names so the calendar avoids N+1 API calls.
 *
 * Time fields are `HH:MM:SS` (24h) strings; `appointment_date` is `YYYY-MM-DD`.
 * All times represent clinic wall-clock time (no timezone conversion).
 */
export interface CalendarAppointmentResponse {
  id: string;
  appointment_number: string;
  patient_id: string;
  patient_name: string;
  dentist_id: number;
  dentist_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit: string;
}

/** Calendar list response (CalendarAppointmentListResponse schema). */
export interface CalendarAppointmentListResponse {
  items: CalendarAppointmentResponse[];
}

/** Query parameters for GET /appointments/calendar. */
export interface CalendarAppointmentParams {
  /** Inclusive start date (YYYY-MM-DD) */
  start: string;
  /** Exclusive end date (YYYY-MM-DD) */
  end: string;
  /** Optional dentist ID filter */
  dentist_id?: number;
  /** Optional status filter (AppointmentStatus value) */
  status?: AppointmentStatus;
}
