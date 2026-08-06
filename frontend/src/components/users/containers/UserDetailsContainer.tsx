import { useState, type FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, UserCheck, UserCog, UserX } from 'lucide-react';
import { UserHeader } from '../UserHeader';
import { UserProfileCard } from '../UserProfileCard';
import { UserAccountCard } from '../UserAccountCard';
import { UserStatusCard } from '../UserStatusCard';
import { UserStatusDialog, type UserStatusIntent } from '../UserStatusDialog';
import { UserRoleDialog } from '../UserRoleDialog';
import { useUser } from '../../../hooks/users/useUser';
import {
  useActivateUser,
  useChangeUserRole,
  useDeactivateUser,
} from '../../../hooks/users/useUserMutations';
import { parseApiError } from '../../../services/apiError';
import { isRoleUnchanged } from '../../../utils/userFormUtils';
import { ROUTES } from '../../../routes/routes';
import { Button } from '../../common/Button/Button';
import { Icon } from '../../common/Icon/Icon';
import { Spinner } from '../../common/Spinner/Spinner';
import { ResultState } from '../../common/ResultState/ResultState';
import { ContentContainer } from '../../../layouts/components/ContentContainer';
import type { UserDetailResponse } from '../../../types/user';

/**
 * UserDetailsContainer — orchestrates the `/users/:userId` details page.
 *
 * Loads the user via GET /users/{id} (Phase 1A `useUser` hook), owns the
 * activate/deactivate confirmation dialog and the change-role dialog
 * (both reused from Phase 1B), and wires the Phase 1A mutation hooks.
 * Mutations invalidate the `['users']` query prefix on success, so the
 * details view and the list both refetch. The presentation components
 * (header + cards) stay stateless.
 */
export const UserDetailsContainer: FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const parsedId = userId != null && /^\d+$/.test(userId) ? Number(userId) : undefined;
  const userQuery = useUser(parsedId);

  const [statusState, setStatusState] = useState<{ intent: UserStatusIntent } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const activateMutation = useActivateUser();
  const deactivateMutation = useDeactivateUser();
  const changeRoleMutation = useChangeUserRole();
  const statusSubmitting = activateMutation.isPending || deactivateMutation.isPending;

  const errorMessage = userQuery.error ? parseApiError(userQuery.error).message : null;
  const invalidId = parsedId == null;

  const handleStatusConfirm = () => {
    if (!statusState || !userQuery.data) return;
    setStatusError(null);
    const intent = statusState.intent;
    const mutation = intent === 'deactivate' ? deactivateMutation : activateMutation;
    mutation.mutate(userQuery.data.id, {
      onSuccess: () => setStatusState(null),
      onError: (error) => setStatusError(parseApiError(error).message),
    });
  };

  const handleRoleConfirm = (roleId: number) => {
    if (!userQuery.data) return;
    // PATCH semantics (Phase 1A util): skip the redundant backend write
    // when the selected role equals the user's current role.
    if (isRoleUnchanged({ role_id: String(roleId) }, userQuery.data.role_id)) {
      setRoleOpen(false);
      setRoleError(null);
      return;
    }
    setRoleError(null);
    changeRoleMutation.mutate(
      { userId: userQuery.data.id, roleId },
      {
        onSuccess: () => setRoleOpen(false),
        onError: (error) => setRoleError(parseApiError(error).message),
      },
    );
  };

  if (invalidId) {
    return (
      <ContentContainer width="wide">
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-8">
          <ResultState
            variant="error"
            title="Unable to load user"
            description="The user id in the URL is not valid."
            actions={
              <Button variant="primary" size="md" onClick={() => navigate(ROUTES.USERS)}>
                Back to Users
              </Button>
            }
          />
        </div>
      </ContentContainer>
    );
  }

  if (userQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading user">
        <Spinner size="lg" variant="primary" />
      </div>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <ContentContainer width="wide">
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-8">
          <ResultState
            variant="error"
            title="Unable to load user"
            description={errorMessage ?? 'This user could not be found.'}
            actions={
              <Button variant="primary" size="md" onClick={() => void userQuery.refetch()}>
                Retry
              </Button>
            }
          />
        </div>
      </ContentContainer>
    );
  }

  const user: UserDetailResponse = userQuery.data;

  return (
    <ContentContainer width="wide">
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.USERS)}
          leftIcon={<Icon icon={ChevronLeft} size="sm" />}
          className="self-start"
        >
          Back to Users
        </Button>

        <UserHeader
          user={user}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRoleOpen(true)}
                leftIcon={<Icon icon={UserCog} size="sm" />}
              >
                Change Role
              </Button>
              <Button
                variant={user.is_active ? 'danger' : 'success'}
                size="sm"
                onClick={() =>
                  setStatusState({ intent: user.is_active ? 'deactivate' : 'activate' })
                }
                leftIcon={<Icon icon={user.is_active ? UserX : UserCheck} size="sm" />}
              >
                {user.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </>
          }
        />

        {/* Responsive grid: single column (mobile) → two columns (tablet)
            → three columns (desktop) with the identity card spanning two. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-6 md:col-span-2 lg:col-span-2">
            <UserProfileCard user={user} />
            <UserAccountCard user={user} />
          </div>
          <div className="flex flex-col gap-6">
            <UserStatusCard user={user} />
          </div>
        </div>
      </div>

      <UserStatusDialog
        open={statusState !== null}
        user={user}
        intent={statusState?.intent ?? null}
        submitting={statusSubmitting}
        error={statusError}
        onConfirm={handleStatusConfirm}
        onClose={() => {
          setStatusState(null);
          setStatusError(null);
        }}
      />

      <UserRoleDialog
        open={roleOpen}
        user={user}
        submitting={changeRoleMutation.isPending}
        error={roleError}
        onConfirm={handleRoleConfirm}
        onClose={() => {
          setRoleOpen(false);
          setRoleError(null);
        }}
      />
    </ContentContainer>
  );
};
