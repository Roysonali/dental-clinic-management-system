import { api } from './api';
import type {
  CurrentUserResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginResponse,
  PendingUserResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  UserApprovalRequest,
  UserApprovalResponse,
} from '../types/auth';

/**
 * Auth API service.
 *
 * Endpoints mirror the backend `app/modules/auth/routes.py` exactly:
 * - POST   /auth/register              → 201 { message }                    (public)
 * - POST   /auth/login                 → 200 { access_token, token_type }   (public, form-encoded)
 * - POST   /auth/forgot-password       → 200 { message }                    (public)
 * - POST   /auth/reset-password        → 200 { message }                    (public)
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

  /**
   * POST /auth/forgot-password — public, JSON.
   *
   * The backend always returns the same generic message whether or not the
   * account exists (anti-enumeration), so the UI must never branch on this
   * response to reveal account existence.
   */
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const payload: ForgotPasswordRequest = { email };
    const { data } = await api.post<ForgotPasswordResponse>(
      '/auth/forgot-password',
      payload,
    );
    return data;
  },

  /**
   * POST /auth/reset-password — public, JSON.
   *
   * The secure token is the credential; a 400 means the link is invalid,
   * expired, already used, or revoked.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ResetPasswordResponse> {
    const payload: ResetPasswordRequest = {
      token,
      new_password: newPassword,
    };
    const { data } = await api.post<ResetPasswordResponse>(
      '/auth/reset-password',
      payload,
    );
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
