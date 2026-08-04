import { api } from './api';
import type {
  CurrentUserResponse,
  LoginResponse,
  PendingUserResponse,
  RegisterRequest,
  RegisterResponse,
  UserApprovalRequest,
  UserApprovalResponse,
} from '../types/auth';

/**
 * Auth API service.
 *
 * Endpoints mirror the backend `app/modules/auth/routes.py` exactly:
 * - POST   /auth/register              → 201 { message }                    (public)
 * - POST   /auth/login                 → 200 { access_token, token_type }   (public, form-encoded)
 * - GET    /auth/me                    → 200 current user profile           (Bearer)
 * - GET    /auth/users/pending         → 200 pending users                  (admin)
 * - PATCH  /auth/users/{id}/approve    → 200 { message }                    (admin)
 * - PATCH  /auth/users/{id}/deactivate → 200 { message }                    (admin)
 *
 * Backend contract notes:
 * - `login` uses OAuth2PasswordRequestForm: the body MUST be
 *   `application/x-www-form-urlencoded` with `username` + `password`
 *   fields (NOT JSON). Email is the username.
 * - `register` accepts JSON `{ full_name, email, password }` and creates a
 *   `pending` account that requires admin approval before it can log in.
 * - `GET /auth/me` returns only `{ id, full_name, email, status }` — the
 *   backend does NOT expose the current user's role.
 */
export const authService = {
  /** POST /auth/login — form-encoded (OAuth2PasswordRequestForm). */
  async login(username: string, password: string): Promise<LoginResponse> {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    const { data } = await api.post<LoginResponse>('/auth/login', body);
    return data;
  },

  /** POST /auth/register — JSON (201). */
  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    const { data } = await api.post<RegisterResponse>('/auth/register', payload);
    return data;
  },

  /** GET /auth/me — current user profile. */
  async getMe(): Promise<CurrentUserResponse> {
    const { data } = await api.get<CurrentUserResponse>('/auth/me');
    return data;
  },

  /** GET /auth/users/pending — admin only. */
  async fetchPendingUsers(): Promise<PendingUserResponse[]> {
    const { data } = await api.get<PendingUserResponse[]>('/auth/users/pending');
    return data;
  },

  /** PATCH /auth/users/{id}/approve — admin only. */
  async approveUser(userId: number, roleId: number): Promise<UserApprovalResponse> {
    const payload: UserApprovalRequest = { role_id: roleId };
    const { data } = await api.patch<UserApprovalResponse>(
      `/auth/users/${userId}/approve`,
      payload,
    );
    return data;
  },

  /** PATCH /auth/users/{id}/deactivate — admin only. */
  async deactivateUser(userId: number): Promise<UserApprovalResponse> {
    const { data } = await api.patch<UserApprovalResponse>(
      `/auth/users/${userId}/deactivate`,
    );
    return data;
  },
};
