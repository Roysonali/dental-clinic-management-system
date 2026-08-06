import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import type { RegisterRequest, RegisterResponse } from '../../types/auth';

/**
 * useRegisterUser — POST /auth/register (Sprint 11B Phase 1D).
 *
 * The ONLY backend-supported way to create a user account. The backend
 * creates the account in `pending` status (`is_active=false`, no role) and
 * returns `{message}` — NOT the created user id. Approving the account is
 * a separate step (`useApproveUser` in hooks/auth/usePendingUsers.ts).
 *
 * No cache invalidation on success: a registered account does not appear
 * in the user directory until it is approved — the approval mutation owns
 * the `['users']` and `['auth','pending-users']` invalidations.
 */
export function useRegisterUser() {
  return useMutation<RegisterResponse, Error, RegisterRequest>({
    mutationFn: (payload) => authService.register(payload),
  });
}
