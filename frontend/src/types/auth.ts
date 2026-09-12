/* ============================================================
 * Auth Types
 *
 * Strictly matches backend Pydantic schemas.
 * Do NOT invent fields that don't exist in the backend.
 * ============================================================ */

export type { RoleName } from '../constants/roles';
export { ROLES, DOCTOR_ROLES } from '../constants/roles';

/** Login request (form-encoded via OAuth2PasswordRequestForm) */
export interface LoginRequest {
  /** Maps to OAuth2 `username` field — the user's email */
  username: string;
  /** The user's password */
  password: string;
  /** Optional: whether to persist the session (future use) */
  remember_me?: boolean;
}

/** Login response from POST /auth/login */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/** Refresh token response from POST /auth/refresh */
export interface RefreshResponse {
  access_token: string;
  token_type: string;
}

/** Registration request for POST /auth/register */
export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

/** Registration response */
export interface RegisterResponse {
  message: string;
}

/**
 * Current user profile from GET /auth/me.
 *
 * The backend `CurrentUserResponse` schema returns EXACTLY these four
 * fields — it deliberately does NOT expose the user's role. Client-side
 * RBAC gating is therefore not possible from this endpoint; admin-only
 * screens rely on the backend's 403 responses instead.
 */
export interface CurrentUserResponse {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
}

/** Pending user summary (admin view) */
export interface PendingUserResponse {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
}

/** User approval request */
export interface UserApprovalRequest {
  role_id: number;
}

/** User approval/deactivation response */
export interface UserApprovalResponse {
  message: string;
}

/* ── Enums ──────────────────────────────────────────────────────────── */

/** User lifecycle statuses matching backend constants */
export type UserStatus = 'pending' | 'active' | 'inactive';

/** Forgot-password request for POST /auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Forgot-password response — always the same generic message, whether or
 * not the account exists (backend anti-enumeration contract).
 */
export interface ForgotPasswordResponse {
  message: string;
}

/** Reset-password request for POST /auth/reset-password */
export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

/** Reset-password response */
export interface ResetPasswordResponse {
  message: string;
}

/* ── Doctor Application Types ────────────────────────────────────────── */

/** Application type discriminator */
export type ApplicationType = 'staff' | 'doctor';

/** Pending user with optional application type info */
export interface PendingUserWithApplicationResponse {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
  application_type: ApplicationType;
  doctor_application_id?: number;
}

/** Doctor application registration request */
export interface DoctorApplicationRegistrationRequest {
  full_name: string;
  email: string;
  password: string;
  qualification?: string;
  registration_number?: string;
  years_of_experience?: number;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  primary_phone?: string;
  address?: string;
  profile_photo_url?: string;
  requested_specialization_ids?: number[];
  primary_specialization_id?: number;
}

/** Doctor application detail (admin view) */
export interface DoctorApplicationResponse {
  id: number;
  user_id: number;
  user_full_name?: string;
  user_email?: string;
  qualification?: string;
  registration_number?: string;
  years_of_experience?: number;
  date_of_birth?: string;
  gender?: string;
  primary_phone?: string;
  address?: string;
  profile_photo_url?: string;
  requested_specialization_ids?: number[];
  primary_specialization_id?: number;
  specialization_names?: string[];
  status: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: number;
  rejection_reason?: string;
  doctor_id?: string;
}

/** Admin approve request */
export interface DoctorApplicationApproveRequest {
  role_id: number;
}

/** Admin reject request */
export interface DoctorApplicationRejectRequest {
  rejection_reason?: string;
}

/** Application action response */
export interface DoctorApplicationActionResponse {
  message: string;
}

/** A single RBAC role from GET /auth/roles (F-03: replaces hardcoded id maps) */
export interface RoleResponse {
  id: number;
  name: string;
}

/* ── Form Types (UI-specific, not sent to API) ──────────────────────── */

/** Login form values (before transforming to API format) */
export interface LoginFormValues {
  email: string;
  password: string;
  remember_me?: boolean;
}

/** Registration form values (before transforming to API format) */
export interface RegisterFormValues {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
}

/** Doctor registration form values (multi-step) */
export interface DoctorRegisterFormValues {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
  qualification?: string;
  registration_number?: string;
  years_of_experience?: number;
  date_of_birth?: string;
  gender?: string;
  primary_phone?: string;
  address?: string;
  profile_photo_url?: string;
  requested_specialization_ids?: number[];
  primary_specialization_id?: number;
}

/** Forgot-password form values (before transforming to API format) */
export interface ForgotPasswordFormValues {
  email: string;
}

/** Reset-password form values (before transforming to API format) */
export interface ResetPasswordFormValues {
  new_password: string;
  confirm_password: string;
}
