import { useState, type FC } from 'react';
import { ShieldAlert, UserCheck, UserX } from 'lucide-react';
import {
  useApproveUser,
  useDeactivatePendingUser,
  usePendingUsers,
} from '../../../hooks/auth/usePendingUsers';
import { parseApiError } from '../../../services/apiError';
import { ROLES, ROLE_LABELS, ROLE_IDS } from '../../../constants/roles';
import { Spinner } from '../../common/Spinner/Spinner';
import { Alert } from '../../common/Alert/Alert';
import { Button } from '../../common/Button/Button';
import { Select } from '../../common/Input/Select';
import { Modal } from '../../common/Modal/Modal';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import type { PendingUserResponse } from '../../../types/auth';

/**
 * Role options for the approval dropdown (value = numeric role_id from
 * ROLE_IDS — see constants/roles.ts for the seed-order caveat).
 */
const ROLE_OPTIONS = Object.values(ROLES).map((role) => ({
  value: String(ROLE_IDS[role]),
  label: ROLE_LABELS[role],
}));

/**
 * PendingUsersContainer — admin approval queue.
 *
 * Orchestrates:
 * - GET /auth/users/pending (list of registration requests)
 * - PATCH /auth/users/{id}/approve with a chosen role
 * - PATCH /auth/users/{id}/deactivate (confirmed via modal)
 *
 * The backend enforces admin-only access; a 403 renders an "insufficient
 * permissions" state (the backend does not expose the current user's role,
 * so the screen cannot be gated client-side).
 */
export const PendingUsersContainer: FC = () => {
  const { data: pendingUsers, isLoading, isError, error, refetch } = usePendingUsers();
  const approveMutation = useApproveUser();
  const deactivateMutation = useDeactivatePendingUser();

  const [roleSelections, setRoleSelections] = useState<Record<number, string>>({});
  const [deactivatingUser, setDeactivatingUser] = useState<PendingUserResponse | null>(null);

  const errorInfo = isError ? parseApiError(error) : null;
  const mutationError = approveMutation.isError
    ? parseApiError(approveMutation.error).message
    : deactivateMutation.isError
      ? parseApiError(deactivateMutation.error).message
      : null;

  const handleApprove = (userId: number) => {
    const roleId = Number(roleSelections[userId]);
    if (!Number.isInteger(roleId) || roleId <= 0) return;
    approveMutation.mutate({ userId, roleId });
  };

  const handleConfirmDeactivate = () => {
    if (!deactivatingUser) return;
    deactivateMutation.mutate(deactivatingUser.id, {
      onSettled: () => setDeactivatingUser(null),
    });
  };

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (isLoading) {
    return <Spinner centered size="lg" label="Loading pending approvals" />;
  }

  /* ── Forbidden (non-admin) ───────────────────────────────────────── */
  if (errorInfo?.kind === 'forbidden') {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Insufficient permissions"
        description="This screen is restricted to Administrators and Chief Doctors. Your account does not have the required role."
      />
    );
  }

  /* ── Other errors ────────────────────────────────────────────────── */
  if (errorInfo) {
    return (
      <Alert
        variant="danger"
        title="Unable to load pending approvals"
        description={errorInfo.message}
        actions={<Button variant="outline" onClick={() => void refetch()}>Retry</Button>}
      />
    );
  }

  /* ── Empty queue ─────────────────────────────────────────────────── */
  if (!pendingUsers || pendingUsers.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="No pending approvals"
        description="There are no registration requests waiting for review."
      />
    );
  }

  return (
    <div className="space-y-4">
      {mutationError && (
        <Alert variant="danger" title="Action failed" description={mutationError} />
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left" aria-label="Pending user approvals">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-caption uppercase tracking-wide text-neutral-500">
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              <th scope="col" className="px-4 py-3 font-semibold">Email</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Role to assign</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map((user) => {
              const pendingApprove = approveMutation.isPending
                && approveMutation.variables?.userId === user.id;
              const pendingDeactivate = deactivateMutation.isPending
                && deactivateMutation.variables === user.id;
              const busy = pendingApprove || pendingDeactivate;
              const selectedRole = roleSelections[user.id] ?? '';

              return (
                <tr key={user.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-body font-medium text-neutral-900">
                    {user.full_name}
                  </td>
                  <td className="px-4 py-3 text-body text-neutral-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Role to assign to ${user.full_name}`}
                      options={ROLE_OPTIONS}
                      placeholder="Select a role"
                      value={selectedRole}
                      disabled={busy}
                      onChange={(e) =>
                        setRoleSelections((prev) => ({
                          ...prev,
                          [user.id]: e.target.value,
                        }))
                      }
                      wrapperClassName="max-w-[200px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        loading={pendingApprove}
                        disabled={!selectedRole || busy}
                        onClick={() => handleApprove(user.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={pendingDeactivate}
                        disabled={busy}
                        onClick={() => setDeactivatingUser(user)}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Deactivation confirmation ─────────────────────────────────── */}
      <Modal
        open={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        size="sm"
        ariaLabel="Confirm deactivation"
      >
        <Modal.Header>
          <h2 className="text-h4 font-semibold text-neutral-900">
            Deactivate registration request?
          </h2>
        </Modal.Header>
        <Modal.Body>
          <p className="text-body text-neutral-600">
            {deactivatingUser?.full_name} ({deactivatingUser?.email}) will not
            be able to log in. This can be reversed later by an administrator.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setDeactivatingUser(null)}
            disabled={deactivateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deactivateMutation.isPending}
            leftIcon={<UserX size={16} />}
            onClick={handleConfirmDeactivate}
          >
            Deactivate user
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
