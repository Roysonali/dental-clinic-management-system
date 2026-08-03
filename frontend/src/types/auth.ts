/* ============================================================
 * Auth Types
 *
 * Strictly matches backend Pydantic schemas.
 * Do NOT invent fields that don't exist in the backend.
 * ============================================================ */

import type { RoleName } from '../constants/roles';
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

/** Current user profile from GET /auth/me */
export interface CurrentUserResponse {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
  role_id?: number | null;
  role?: Role | null;
}

/** Pending user summary (admin view) */
export interface PendingUserResponse {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
}

/** Role entity */
export interface Role {
  id: number;
  name: string;
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

/* ── Form Types (UI-specific, not sent to API) ──────────────────────── */

/** Login form values (before transforming to API format) */
export interface LoginFormValues {
  email: string;
  password: string;
  remember_me: boolean;
}

/** Registration form values (before transforming to API format) */
export interface RegisterFormValues {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
}
