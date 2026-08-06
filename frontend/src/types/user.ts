/* ============================================================
 * User Types (frontend)
 *
 * Strictly mirrors backend `app/modules/users/schemas.py` for the
 * admin `/users` endpoints (Sprint 11B blueprint).
 *
 * Do NOT invent fields, enums, or validation rules that don't
 * exist in the backend.
 *
 * INTENTIONALLY ABSENT (no backend endpoints exist):
 * - `UserCreateRequest` / `UserUpdateRequest` — the users module
 *   exposes NO create/update endpoints (accounts are created via
 *   POST /auth/register and approved via PATCH /auth/users/{id}/approve).
 * - `UserProfileResponse` — there is no `/users/{id}/profile`
 *   endpoint; the current-user profile is `GET /auth/me`
 *   (`CurrentUserResponse` in types/auth.ts, consumed by the auth
 *   module). Do not invent one here.
 * - `Permission` / permission APIs — the backend exposes no
 *   permission matrix endpoints.
 * ============================================================ */

import type { UserStatus } from './auth';
import type { RoleName } from '../constants/roles';

/** RBAC role name — mirrors backend `app/core/constants.py` roles. */
export type UserRole = RoleName;

/* ── Read models ─────────────────────────────────────────────────────── */

/** Row returned by GET /users (UserListItem schema). */
export interface UserListItem {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
  is_active: boolean;
  role_id: number | null;
  role_name: string | null;
  last_login_at: string | null;
  created_at: string | null;
}

/** Paginated user list (UserListResponse schema). */
export interface UserListResponse {
  items: UserListItem[];
  total: number;
  page: number;
  page_size: number;
}

/** Full user record returned by GET /users/{user_id} (UserDetailResponse). */
export interface UserDetailResponse {
  id: number;
  full_name: string;
  email: string;
  status: UserStatus;
  is_active: boolean;
  role_id: number | null;
  role_name: string | null;
  last_login_at: string | null;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: number | null;
}

/* ── Request / response models ───────────────────────────────────────── */

/** Payload for PATCH /users/{id}/role (ChangeRoleRequest — `role_id: int, gt=0`). */
export interface ChangeRoleRequest {
  role_id: number;
}

/** Response for role/activate/deactivate actions (UserActionResponse). */
export interface UserActionResponse {
  user_id: number;
  message: string;
}

/* ── Query params / filter unions ────────────────────────────────────── */

/** Query parameters accepted by GET /users (fixed `id DESC` ordering — no sort params). */
export interface UserListParams {
  /** Partial match on name or email (case-insensitive ilike) */
  search?: string;
  /** Filter by role id */
  role_id?: number;
  /** Filter by lifecycle status: 'pending' | 'active' | 'inactive' */
  status?: UserStatus;
  /** 1-based page number (≥ 1) */
  page?: number;
  /** Records per page (1–100) */
  page_size?: number;
}

/** Status filter used by the user list toolbar ('all' + backend statuses). */
export type UserStatusFilter = 'all' | UserStatus;

/* ── UI form values (never sent to the API as-is) ───────────────────── */

/** Role-assignment form model — the ONLY user form the backend supports. */
export interface RoleFormValues {
  /** Role id held as a string (select value); '' = not selected */
  role_id: string;
}
