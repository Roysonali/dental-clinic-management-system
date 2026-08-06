import { useState, type FC } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserCreateDrawer } from '../UserCreateDrawer';
import { useRegisterUser } from '../../../hooks/users/useRegisterUser';
import {
  useApproveUser,
  pendingUsersQueryKeys,
} from '../../../hooks/auth/usePendingUsers';
import { authService } from '../../../services/authService';
import { parseApiError } from '../../../services/apiError';
import {
  roleIdFromUserCreateForm,
  userCreateFormToRegisterPayload,
  userRoleLabelFromId,
} from '../../../utils/userCreateFormUtils';
import type { PendingUserResponse } from '../../../types/auth';
import type { UserCreateFormValues } from '../../../types/user';

/**
 * Pending-lookup retry budget (Sprint 11B review improvement).
 *
 * `POST /auth/register` commits asynchronously relative to a subsequent
 * `GET /auth/users/pending` read — the freshly created account may not
 * appear in the queue on the first attempt. The container re-queries up
 * to `USER_CREATE_LOOKUP_ATTEMPTS` times with a short delay between
 * attempts, stopping immediately once the account is found.
 */
export const USER_CREATE_LOOKUP_ATTEMPTS = 3;
/** Delay between lookup attempts (per review guidance ~250–300ms). */
export const USER_CREATE_LOOKUP_RETRY_DELAY_MS = 275;

/** Outcome of the Add-User workflow, reported to the parent for feedback. */
export type UserCreationOutcome = 'approved' | 'pending' | 'approval_failed';

export interface UserCreationResult {
  outcome: UserCreationOutcome;
  /** Toast title */
  title: string;
  /** Toast body */
  description: string;
}

interface UserCreateContainerProps {
  /** Drawer open state (controlled by the parent) */
  open: boolean;
  /** Called to close the drawer */
  onClose: () => void;
  /** Called after the workflow ends (success or partial success) */
  onCreated?: (result: UserCreationResult) => void;
}

/**
 * UserCreateContainer — orchestrates the Sprint 11B Phase 1D Add-User
 * workflow using ONLY verified backend endpoints:
 *
 *   1. POST   /auth/register          {full_name, email, password} → 201
 *   2. GET    /auth/users/pending     → locate the created account by email
 *   3. PATCH  /auth/users/{id}/approve {role_id}                     → 200
 *
 * ── Known backend limitation ─────────────────────────────────────────
 * `POST /auth/register` returns `{message}` only — it does NOT return the
 * created user's id. To auto-approve we therefore look the account up in
 * the pending queue by its (lowercased, normalized) email immediately
 * after registration, then approve with the selected role.
 *
 * Fallbacks (never fabricating an API):
 * - If the created account cannot be located in the pending queue
 *   (lookup failure), the workflow reports `pending` — the registration
 *   succeeded and the account awaits admin approval there.
 * - If registration succeeds but approval fails (e.g. the account was
 *   concurrently approved/deactivated), the workflow reports
 *   `approval_failed` — the account is left in the pending queue rather
 *   than leaving the admin trapped in a form that would 409 on retry.
 *
 * Register errors (e.g. 409 duplicate email) keep the drawer open with
 * the backend message + field errors inline.
 */
export const UserCreateContainer: FC<UserCreateContainerProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const queryClient = useQueryClient();
  const registerMutation = useRegisterUser();
  const approveMutation = useApproveUser();

  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // Covers the pending-list lookup window between register and approve so
  // the drawer stays in a submitting state for the ENTIRE workflow (no
  // double-submit race after the register response arrives).
  const [lookupPending, setLookupPending] = useState(false);

  const submitting = registerMutation.isPending || approveMutation.isPending || lookupPending;

  const resetServerState = () => {
    setServerMessage(null);
    setServerErrors({});
  };

  /** User-initiated close — ignored while the workflow is in flight. */
  const handleClose = () => {
    if (submitting) return;
    resetServerState();
    onClose();
  };

  /** Workflow-completion close — always allowed (called on settle). */
  const completeClose = () => {
    resetServerState();
    onClose();
  };

  /**
   * Locate the freshly registered account in the pending queue by email,
   * retrying briefly when the account has not (yet) been returned.
   *
   * Registration commits asynchronously relative to the queue read, so a
   * single lookup can legitimately miss the account we just created. We
   * re-query up to `USER_CREATE_LOOKUP_ATTEMPTS` times, waiting
   * `USER_CREATE_LOOKUP_RETRY_DELAY_MS` between attempts, and stop the
   * moment the account is found. After all attempts the caller falls back
   * to the documented `pending` outcome (no fabricated API).
   */
  const findCreatedPendingUser = async (
    email: string,
  ): Promise<PendingUserResponse | null> => {
    for (let attempt = 0; attempt < USER_CREATE_LOOKUP_ATTEMPTS; attempt += 1) {
      const pending = await queryClient.fetchQuery({
        queryKey: pendingUsersQueryKeys.all,
        queryFn: () => authService.fetchPendingUsers(),
        // Always hit the network — a cached pre-registration snapshot
        // would not contain the account we just created.
        staleTime: 0,
      });
      const found = pending.find((user) => user.email === email) ?? null;
      if (found) return found;

      // Short pause before the next attempt (never after the last one).
      if (attempt < USER_CREATE_LOOKUP_ATTEMPTS - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, USER_CREATE_LOOKUP_RETRY_DELAY_MS),
        );
      }
    }
    return null;
  };

  const handleSubmit = (values: UserCreateFormValues) => {
    setServerMessage(null);
    setServerErrors({});

    const registerPayload = userCreateFormToRegisterPayload(values);
    const roleId = roleIdFromUserCreateForm(values);
    const roleLabel = userRoleLabelFromId(roleId);

    registerMutation.mutate(registerPayload, {
      onSuccess: async () => {
        setLookupPending(true);
        try {
          const created = await findCreatedPendingUser(registerPayload.email);

          // Fallback: registration succeeded but we cannot resolve the id
          // for approval — leave the account in the pending queue.
          if (!created) {
            onCreated?.({
              outcome: 'pending',
              title: 'User registered',
              description: `${registerPayload.email} was registered and will appear in the pending queue for approval.`,
            });
            completeClose();
            return;
          }

          approveMutation.mutate(
            { userId: created.id, roleId },
            {
              onSuccess: () => {
                onCreated?.({
                  outcome: 'approved',
                  title: 'User added',
                  description: `${created.full_name} (${created.email}) was registered and approved as ${roleLabel}.`,
                });
                completeClose();
              },
              onError: (error) => {
                const info = parseApiError(error);
                onCreated?.({
                  outcome: 'approval_failed',
                  title: 'User registered — approval pending',
                  description: `${registerPayload.email} was registered, but automatic approval failed (${info.message}). The account is in the pending queue.`,
                });
                completeClose();
              },
            },
          );
        } catch {
          // Pending-queue lookup failed (network) — registration succeeded.
          onCreated?.({
            outcome: 'pending',
            title: 'User registered',
            description: `${registerPayload.email} was registered and will appear in the pending queue for approval.`,
          });
          completeClose();
        } finally {
          setLookupPending(false);
        }
      },
      onError: (error) => {
        // e.g. 409 EMAIL_ALREADY_REGISTERED / 422 validation — keep the
        // drawer open with the backend's message + field errors.
        const info = parseApiError(error);
        setServerMessage(info.message);
        setServerErrors(info.fieldErrors);
      },
    });
  };

  return (
    <UserCreateDrawer
      open={open}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      serverMessage={serverMessage}
      serverErrors={serverErrors}
    />
  );
};
