import { useEffect, useRef, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserTable } from '../UserTable';
import { Pagination } from '../../common/Pagination/Pagination';
import { UserStatusDialog, type UserStatusIntent } from '../UserStatusDialog';
import { UserRoleDialog } from '../UserRoleDialog';
import { ToastContainer, type Toast } from '../../common/Toast';
import { MobileUserList } from '../mobile/MobileUserList';
import { MobilePageHeader } from '../../../layouts/components/mobile/MobilePageHeader';
import { MobileBottomNav } from '../../../layouts/components/mobile/MobileBottomNav';
import { useIsMobileViewport } from '../../../hooks/useIsMobileViewport';
import { UserCreateContainer, type UserCreationResult } from './UserCreateContainer';
import { useUsers } from '../../../hooks/users/useUsers';
import { useUserFilters } from '../../../hooks/users/useUserFilters';
import {
  useActivateUser,
  useChangeUserRole,
  useDeactivateUser,
} from '../../../hooks/users/useUserMutations';
import { parseApiError } from '../../../services/apiError';
import { isRoleUnchanged } from '../../../utils/userFormUtils';
import { ROUTES } from '../../../routes/routes';
import type { UserListItem } from '../../../types/user';

/** Toast lifetime before auto-dismiss (ms). */
const TOAST_DURATION_MS = 5000;

type StatusState = { user: UserListItem; intent: UserStatusIntent } | null;

/**
 * UserListContainer — orchestrates the user list page.
 *
 * Owns the query state (search/filters/pagination via useUserFilters +
 * useUsers), the activate/deactivate confirmation dialog and the
 * change-role dialog. All filtering is backend-driven (`GET /users` query
 * params) — no client-side filtering. Mutations use the Phase 1A hooks,
 * which invalidate the `['users']` (and pending-approval) query keys on
 * success.
 */
export const UserListContainer: FC = () => {
  const isMobile = useIsMobileViewport();
  const filters = useUserFilters();
  const usersQuery = useUsers(filters.params);
  const navigate = useNavigate();

  const [statusState, setStatusState] = useState<StatusState>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [roleUser, setRoleUser] = useState<UserListItem | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastSeq = useRef(0);

  const activateMutation = useActivateUser();
  const deactivateMutation = useDeactivateUser();
  const changeRoleMutation = useChangeUserRole();
  const statusSubmitting = activateMutation.isPending || deactivateMutation.isPending;

  const queryError = usersQuery.error ? parseApiError(usersQuery.error).message : null;
  const totalPages = Math.max(1, Math.ceil((usersQuery.data?.total ?? 0) / filters.pageSize));

  const hasActiveFilters =
    filters.searchInput.trim() !== '' || filters.status !== 'all' || filters.roleId !== null;

  const clearFilters = () => {
    filters.setSearchInput('');
    filters.setStatus('all');
    filters.setRole(null);
    filters.setPage(1);
  };

  const handleStatusConfirm = () => {
    if (!statusState) return;
    setStatusError(null);
    const { user, intent } = statusState;
    const mutation = intent === 'deactivate' ? deactivateMutation : activateMutation;
    mutation.mutate(user.id, {
      onSuccess: () => setStatusState(null),
      onError: (error) => setStatusError(parseApiError(error).message),
    });
  };

  /** Map an Add-User workflow outcome onto a transient success/warning toast. */
  const handleCreated = (result: UserCreationResult) => {
    const variant =
      result.outcome === 'approved'
        ? 'success'
        : result.outcome === 'pending'
          ? 'info'
          : 'warning';
    setToast({
      id: `add-user-${++toastSeq.current}`,
      variant,
      title: result.title,
      description: result.description,
    });
  };

  // Auto-dismiss the success toast after a short delay.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRoleConfirm = (roleId: number) => {
    if (!roleUser) return;
    // PATCH semantics (Phase 1A util): skip the redundant backend write
    // when the selected role equals the user's current role.
    if (isRoleUnchanged({ role_id: String(roleId) }, roleUser.role_id)) {
      setRoleUser(null);
      setRoleError(null);
      return;
    }
    setRoleError(null);
    changeRoleMutation.mutate(
      { userId: roleUser.id, roleId },
      {
        onSuccess: () => setRoleUser(null),
        onError: (error) => setRoleError(parseApiError(error).message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {isMobile ? (
        <>
          <MobilePageHeader
            title="Users"
            addLabel="Add user"
            onAdd={() => setCreateOpen(true)}
          />
          <MobileUserList
            users={usersQuery.data?.items ?? []}
            loading={usersQuery.isLoading}
            error={queryError}
            onRetry={() => void usersQuery.refetch()}
            searchValue={filters.searchInput}
            onSearchChange={filters.setSearchInput}
            status={filters.status}
            onStatusChange={filters.setStatus}
            roleId={filters.roleId}
            onRoleChange={filters.setRole}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            onView={(user) => navigate(`${ROUTES.USERS}/${user.id}`)}
            page={filters.page}
            totalPages={totalPages}
            totalCount={usersQuery.data?.total}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            onPageSizeChange={filters.setPageSize}
          />
          <MobileBottomNav />
        </>
      ) : (
        <>
      <UserTable
        users={usersQuery.data?.items ?? []}
        loading={usersQuery.isLoading}
        error={queryError}
        onRetry={() => void usersQuery.refetch()}
        searchValue={filters.searchInput}
        onSearchChange={filters.setSearchInput}
        searchLoading={usersQuery.isFetching && !usersQuery.isPlaceholderData}
        status={filters.status}
        onStatusChange={filters.setStatus}
        roleId={filters.roleId}
        onRoleChange={filters.setRole}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        onRefresh={() => void usersQuery.refetch()}
        refreshing={usersQuery.isFetching}
        onViewDetails={(user) => navigate(`${ROUTES.USERS}/${user.id}`)}
        onChangeRole={(user) => setRoleUser(user)}
        onActivate={(user) => setStatusState({ user, intent: 'activate' })}
        onDeactivate={(user) => setStatusState({ user, intent: 'deactivate' })}
        onAddUser={() => setCreateOpen(true)}
      />

      <Pagination
        currentPage={filters.page}
        totalPages={totalPages}
        onPageChange={filters.setPage}
        totalCount={usersQuery.data?.total}
        pageSize={filters.pageSize}
      />
        </>
      )}

      <UserStatusDialog
        open={statusState !== null}
        user={statusState?.user ?? null}
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
        key={roleUser?.id ?? 'none'}
        open={roleUser !== null}
        user={roleUser}
        submitting={changeRoleMutation.isPending}
        error={roleError}
        onConfirm={handleRoleConfirm}
        onClose={() => {
          setRoleUser(null);
          setRoleError(null);
        }}
      />

      <UserCreateContainer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {toast && (
        <ToastContainer
          toasts={[toast]}
          position="top-right"
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
};
