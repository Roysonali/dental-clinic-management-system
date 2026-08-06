import { api } from './api';
import type {
  ChangeRoleRequest,
  UserActionResponse,
  UserDetailResponse,
  UserListParams,
  UserListResponse,
} from '../types/user';

/**
 * User API service (admin user directory).
 *
 * Endpoints mirror the backend `app/modules/users/routes.py` exactly
 * (all ADMIN-only — non-admins receive 403):
 * - GET    /users                → paginated, filterable user list
 * - GET    /users/{user_id}      → single user detail
 * - PATCH  /users/{user_id}/role → change a user's role
 * - PATCH  /users/{user_id}/activate   → activate a user
 * - PATCH  /users/{user_id}/deactivate → deactivate a user
 *
 * Backend contract notes:
 * - GET /users supports `search` (name/email ilike), `role_id`,
 *   `status` ('pending'|'active'|'inactive'), `page` (≥1) and
 *   `page_size` (1–100, default 10). Ordering is fixed `id DESC` —
 *   there are NO sort params.
 * - There is NO create/update endpoint in this module (accounts are
 *   created via POST /auth/register + approved via the auth module),
 *   and NO profile endpoint (`GET /auth/me` lives in authService).
 *
 * Kept thin: no business logic, no data transformation, no UI concerns.
 */
export const userService = {
  /** GET /users — admin only (403 for non-admins). */
  async list(params: UserListParams = {}): Promise<UserListResponse> {
    const { data } = await api.get<UserListResponse>('/users', { params });
    return data;
  },

  /** GET /users/{user_id} — admin only. */
  async get(userId: number): Promise<UserDetailResponse> {
    const { data } = await api.get<UserDetailResponse>(`/users/${userId}`);
    return data;
  },

  /** PATCH /users/{user_id}/role — admin only; self-role-change is rejected by the backend. */
  async changeRole(userId: number, roleId: number): Promise<UserActionResponse> {
    const payload: ChangeRoleRequest = { role_id: roleId };
    const { data } = await api.patch<UserActionResponse>(`/users/${userId}/role`, payload);
    return data;
  },

  /** PATCH /users/{user_id}/activate — admin only; NO request body. */
  async activate(userId: number): Promise<UserActionResponse> {
    const { data } = await api.patch<UserActionResponse>(`/users/${userId}/activate`);
    return data;
  },

  /** PATCH /users/{user_id}/deactivate — admin only; NO request body. */
  async deactivate(userId: number): Promise<UserActionResponse> {
    const { data } = await api.patch<UserActionResponse>(`/users/${userId}/deactivate`);
    return data;
  },

  /**
   * @deprecated Use {@link userService.list} instead. Kept for backward
   * compatibility with the UserSearchSelect data foundation (Sprint 11A).
   */
  async listUsers(params: UserListParams = {}): Promise<UserListResponse> {
    return userService.list(params);
  },
};
