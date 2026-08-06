import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../../context/auth/authContext';
import { userService } from '../../services/userService';
import { parseApiError, shouldRetryQuery } from '../../services/apiError';
import { RBAC_CURRENT_ROLE_STALE_TIME_MS } from '../../constants/rbac';
import type { UserDetailResponse } from '../../types/user';

/** Query key namespace for RBAC queries. */
export const rbacQueryKeys = {
  currentRole: (userId: number) => ['rbac', 'current-role', userId] as const,
};

/** Role info for a known admin (from GET /users/{id}). */
export interface CurrentUserRoleInfo {
  role_id: number;
  role_name: string;
}

/**
 * Discriminated state of the current user's role resolution.
 *
 * The backend exposes NO role for the current user via `GET /auth/me`, so
 * the frontend probes `GET /users/{id}` (the only endpoint that returns
 * `role_id`/`role_name`) with the id from `/auth/me`. Because that endpoint
 * is `require_admin`, the probe's outcome is the authorization signal:
 *
 * - `admin`      — 200: the caller IS an admin (ADMIN or CHIEF_DOCTOR).
 * - `non-admin`  — 403: the caller is definitively NOT an admin. The five
 *                  non-admin roles are mutually indistinguishable from the
 *                  client (no endpoint exposes them for the current user).
 * - `unknown`    — any other failure (network, 5xx, …). Access decisions
 *                  then fail OPEN (the backend remains the authority).
 */
export type CurrentUserRoleState =
  | { status: 'loading'; role: null }
  | { status: 'admin'; role: CurrentUserRoleInfo }
  | { status: 'non-admin'; role: null }
  | { status: 'unknown'; role: null };

const NO_CONTEXT_STATE: CurrentUserRoleState = { status: 'unknown', role: null };
const LOADING_STATE: CurrentUserRoleState = { status: 'loading', role: null };

/**
 * Resolve the current user's role (Sprint 11C).
 *
 * Strategy (see `docs/Sprint-11C-RBAC-UI-Integration.md` for the full
 * rationale): `GET /auth/me` returns `{id, full_name, email, status}` with
 * NO role, and the JWT carries no role claim, so the ONLY backend-sanctioned
 * way to learn the current user's role is `GET /users/{id}` — which is
 * `require_admin` and returns `role_id`/`role_name` on success.
 *
 * Consequences:
 * - 200 ⇒ known admin (exact role: ADMIN or CHIEF_DOCTOR).
 * - 403 ⇒ known non-admin (role never retried — `shouldRetryQuery`).
 * - Anything else ⇒ unknown → callers fail open.
 *
 * Reads the auth context directly (rather than `useAuth()`, which throws
 * outside a provider) so the hook degrades to a conservative `unknown`
 * state when rendered outside the auth tree (isolated tests), instead of
 * crashing.
 */
export function useCurrentUserRole(): CurrentUserRoleState {
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id ?? null;

  const query = useQuery<UserDetailResponse>({
    // A stable key regardless of resolution state; the query only runs when
    // a user id exists (`enabled`), so the placeholder key is never used.
    queryKey:
      userId != null
        ? rbacQueryKeys.currentRole(userId)
        : (['rbac', 'current-role', 'none'] as const),
    queryFn: () => userService.get(userId as number),
    enabled: userId != null,
    staleTime: RBAC_CURRENT_ROLE_STALE_TIME_MS,
    retry: shouldRetryQuery,
  });

  if (!auth) return NO_CONTEXT_STATE;

  // `loading` covers BOTH the probe in flight AND "no resolved user yet"
  // (session initialising / signed out). Guards and gates treat it as
  // unresolved-but-conservative, so this never grants anything; in practice
  // ProtectedRoute redirects signed-out users before this is visible.
  if (userId == null) return LOADING_STATE;
  if (query.isPending) return LOADING_STATE;

  if (query.data) {
    return {
      status: 'admin',
      role: {
        role_id: query.data.role_id ?? 0,
        role_name: query.data.role_name ?? '',
      },
    };
  }

  if (query.isError) {
    const kind = parseApiError(query.error).kind;
    return kind === 'forbidden'
      ? { status: 'non-admin', role: null }
      : { status: 'unknown', role: null };
  }

  // Query is disabled or in an unexpected terminal state — treat as unknown.
  return NO_CONTEXT_STATE;
}
