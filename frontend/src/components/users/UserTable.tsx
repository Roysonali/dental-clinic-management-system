import type { FC, ReactNode } from 'react';
import { Eye, UserCheck, UserCog, UserX } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { IconButton } from '../common/Button/IconButton';
import { Icon } from '../common/Icon/Icon';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { Badge } from '../common/Badge/Badge';
import { Avatar } from '../common/Avatar/Avatar';
import { UserToolbar } from './UserToolbar';
import { USER_STATUS_LABELS } from '../../constants/user';
import { formatISODate } from '../../utils/date';
import { getInitials } from '../../utils/formatting';
import type { UserListItem, UserStatusFilter } from '../../types/user';

/* ── Display helpers ─────────────────────────────────────────────────── */

/** Lifecycle status badge — renders the backend `status` value as-is. */
function UserStatusBadge({ user }: { user: UserListItem }) {
  return (
    <StatusBadge
      status={user.status}
      label={USER_STATUS_LABELS[user.status]}
      size="sm"
    />
  );
}

/** Role badge — renders the backend `role_name` value as-is (null → '—'). */
function UserRoleBadge({ user }: { user: UserListItem }) {
  if (!user.role_name) return <span className="text-neutral-400">—</span>;
  return (
    <Badge variant="info" size="sm">
      {user.role_name}
    </Badge>
  );
}

/* ── Props ───────────────────────────────────────────────────────────── */

interface UserTableProps {
  /** User rows to display (backend UserListItem records) */
  users: UserListItem[];
  /** Loading state (skeleton rows) */
  loading?: boolean;
  /** Error message (error panel with retry) */
  error?: string | null;
  /** Retry callback for the error panel */
  onRetry?: () => void;
  /* ── Toolbar (search + filters + clear + refresh) ── */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchLoading?: boolean;
  status: UserStatusFilter;
  onStatusChange: (status: UserStatusFilter) => void;
  roleId: number | null;
  onRoleChange: (roleId: number | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  /* ── Row actions ── */
  onViewDetails?: (user: UserListItem) => void;
  onChangeRole?: (user: UserListItem) => void;
  onActivate?: (user: UserListItem) => void;
  onDeactivate?: (user: UserListItem) => void;
  /** Row actions column header (default 'Actions') */
  rowActionsHeader?: ReactNode;
  /** Accessible table label */
  ariaLabel?: string;
  /** Additional classes */
  className?: string;
}

/**
 * UserTable — user-specific DataTable.
 *
 * Columns map 1:1 to backend `UserListItem` fields (no invented columns):
 * name (+avatar), email, role, status, last login and created date.
 * NOTE: there is no "username" column — the backend has no username field
 * (email is the login identifier per the OAuth2 contract).
 */
export const UserTable: FC<UserTableProps> = ({
  users,
  loading = false,
  error = null,
  onRetry,
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  roleId,
  onRoleChange,
  hasActiveFilters,
  onClearFilters,
  onRefresh,
  refreshing = false,
  onViewDetails,
  onChangeRole,
  onActivate,
  onDeactivate,
  rowActionsHeader = 'Actions',
  ariaLabel = 'Users table',
  className = '',
}) => {
  return (
    <DataTable<UserListItem>
      ariaLabel={ariaLabel}
      className={className}
      data={users}
      rowKey={(user) => user.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      rowActionsHeader={rowActionsHeader}
      emptyTitle="No users found"
      emptyDescription="Try adjusting your search or filters."
      // NOTE: no `emptyAction` — the backend exposes no create endpoint, so
      // there is no CTA to offer here.
      toolbar={({ columnVisibility, setColumnVisibility }) => (
        <UserToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchLoading={searchLoading}
          status={status}
          onStatusChange={onStatusChange}
          roleId={roleId}
          onRoleChange={onRoleChange}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={onClearFilters}
          onRefresh={onRefresh}
          refreshing={refreshing}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      )}
      columns={[
        {
          key: 'user',
          header: 'User Name',
          render: (user) => (
            <span className="flex items-center gap-3">
              <Avatar initials={getInitials(user.full_name)} alt={user.full_name} size="sm" />
              <span className="min-w-0 truncate font-medium text-neutral-900">
                {user.full_name}
              </span>
            </span>
          ),
          hideable: true,
        },
        {
          key: 'email',
          header: 'Email',
          accessor: 'email',
          hideable: true,
        },
        {
          key: 'role',
          header: 'Role',
          render: (user) => <UserRoleBadge user={user} />,
          hideable: true,
        },
        {
          key: 'status',
          header: 'Status',
          render: (user) => <UserStatusBadge user={user} />,
          hideable: true,
        },
        {
          key: 'last_login',
          header: 'Last Login',
          render: (user) => formatISODate(user.last_login_at),
          hideable: true,
        },
        {
          key: 'created_at',
          header: 'Created Date',
          render: (user) => formatISODate(user.created_at),
          hideable: true,
        },
      ]}
      rowActions={(user) => (
        <span className="inline-flex items-center justify-end gap-1">
          {onViewDetails && (
            <IconButton
              icon={<Icon icon={Eye} size="sm" />}
              aria-label={`View details for ${user.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onViewDetails(user)}
            />
          )}
          {onChangeRole && (
            <IconButton
              icon={<Icon icon={UserCog} size="sm" />}
              aria-label={`Change role for ${user.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onChangeRole(user)}
            />
          )}
          {onDeactivate && user.is_active && (
            <IconButton
              icon={<Icon icon={UserX} size="sm" />}
              aria-label={`Deactivate ${user.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onDeactivate(user)}
            />
          )}
          {onActivate && !user.is_active && (
            <IconButton
              icon={<Icon icon={UserCheck} size="sm" />}
              aria-label={`Activate ${user.full_name}`}
              size="sm"
              variant="ghost"
              onClick={() => onActivate(user)}
            />
          )}
        </span>
      )}
    />
  );
};
