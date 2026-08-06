import type { FC, ReactNode } from 'react';
import { FilterX, RefreshCw, UserPlus } from 'lucide-react';
import { DataTableToolbar } from '../common/DataTable/DataTableToolbar';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { UserFilters } from './UserFilters';
import { USER_ROLE_OPTIONS } from '../../constants/user';
import type { UserStatusFilter } from '../../types/user';
import type { ColumnVisibility, ToolbarColumnDescriptor } from '../common/DataTable';

/* ── Toolbar column descriptors for the column-visibility menu ───────── */

const USER_TOOLBAR_COLUMNS: ToolbarColumnDescriptor[] = [
  { key: 'user', label: 'User Name', hideable: true },
  { key: 'email', label: 'Email', hideable: true },
  { key: 'role', label: 'Role', hideable: true },
  { key: 'status', label: 'Status', hideable: true },
  { key: 'last_login', label: 'Last Login', hideable: true },
  { key: 'created_at', label: 'Created Date', hideable: true },
];

interface UserToolbarProps {
  /** Controlled search value */
  searchValue?: string;
  /** Called when search input changes */
  onSearchChange?: (value: string) => void;
  /** Show a loading spinner in the search field */
  searchLoading?: boolean;
  /* ── Filters ── */
  status: UserStatusFilter;
  onStatusChange: (status: UserStatusFilter) => void;
  roleId: number | null;
  onRoleChange: (roleId: number | null) => void;
  /** True when any filter/search is active — enables the Clear Filters button */
  hasActiveFilters: boolean;
  /** Reset search + filters + pagination */
  onClearFilters: () => void;
  /** Refetch the current query */
  onRefresh: () => void;
  /** Show loading on the Refresh button */
  refreshing?: boolean;
  /* ── Column visibility ── */
  columnVisibility?: ColumnVisibility;
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /** Opens the Add-User drawer (Sprint 11B Phase 1D — register + approve flow) */
  onAddUser?: () => void;
  /** Extra actions rendered before the clear/refresh actions */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * UserToolbar — search + status/role filters + Clear Filters + Refresh.
 *
 * The search placeholder is intentionally explicit about the backend
 * contract: `GET /users` matches `full_name` OR `email` only.
 *
 * The "Add User" action (Sprint 11B Phase 1D) is NOT a create endpoint —
 * the backend exposes none. It opens the Add-User drawer, which runs the
 * verified POST /auth/register → PATCH /auth/users/{id}/approve workflow
 * (`onAddUser`). Rendered only when the handler is provided.
 */
export const UserToolbar: FC<UserToolbarProps> = ({
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
  columnVisibility,
  onColumnVisibilityChange,
  onAddUser,
  children,
  className = '',
}) => {
  const roleOptions = [{ value: '', label: 'All roles' }, ...USER_ROLE_OPTIONS];

  return (
    <DataTableToolbar
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by name or email…"
      searchLoading={searchLoading}
      columns={USER_TOOLBAR_COLUMNS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      className={className}
      primaryActions={
        <div className="flex items-center gap-2">
          {onAddUser && (
            <Button
              variant="primary"
              size="md"
              onClick={onAddUser}
              leftIcon={<Icon icon={UserPlus} size="sm" />}
              className="shrink-0 whitespace-nowrap"
            >
              Add User
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={onClearFilters}
            disabled={!hasActiveFilters}
            leftIcon={<Icon icon={FilterX} size="sm" />}
            className="shrink-0 whitespace-nowrap"
          >
            Clear Filters
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={onRefresh}
            loading={refreshing}
            leftIcon={refreshing ? undefined : <Icon icon={RefreshCw} size="sm" />}
            className="shrink-0 whitespace-nowrap"
          >
            Refresh
          </Button>
        </div>
      }
    >
      {children}
      <UserFilters
        status={status}
        onStatusChange={onStatusChange}
        roleOptions={roleOptions}
        roleId={roleId}
        onRoleChange={onRoleChange}
      />
    </DataTableToolbar>
  );
};
