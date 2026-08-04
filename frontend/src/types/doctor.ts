/* ============================================================
 * Doctor Types (frontend)
 *
 * Mirrors the subset of backend `app/modules/doctors/schemas.py`
 * (`DoctorResponse`) that the appointment module consumes: the
 * `GET /doctors/user/{user_id}` endpoint, which is used to resolve a
 * dentist's display name (`user_full_name`) for an `AppointmentResponse`.
 * ============================================================ */

/** Doctor profile returned by GET /doctors/user/{user_id}. */
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

/** Query parameters accepted by GET /doctors (list). */
export interface DoctorListParams {
  /** 1-based page number */
  page?: number;
  /** Records per page (1–100) */
  page_size?: number;
  /** Search by doctor code or user name */
  search?: string;
  /** Filter by active status */
  is_active?: boolean;
  /** Filter by availability for appointments */
  is_available?: boolean;
}

/**
 * Paginated doctor list (DoctorListResponse schema).
 * Used by the appointment create/edit form to populate the dentist dropdown.
 * NOTE: GET /doctors is ADMIN/RECEPTIONIST only — doctor-role users receive
 * 403 and the UI falls back to an empty list with a note.
 */
export interface DoctorListResponse {
  items: DoctorUserResponse[];
  total: number;
  page: number;
  page_size: number;
}
