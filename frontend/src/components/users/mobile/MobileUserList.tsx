import { useState, type FC } from 'react';
import { Shield } from 'lucide-react';
import { MobileSearchFilterBar } from '../../../layouts/components/mobile/MobileSearchFilterBar';
import { MobileCardList } from '../../../layouts/components/mobile/MobileCardList';
import { MobileFilterSheet } from '../../../layouts/components/mobile/MobileFilterSheet';
import { MobileListPagination } from '../../../layouts/components/mobile/MobileListPagination';
import { Select } from '../../common/Input';
import { USER_ROLE_OPTIONS } from '../../../constants/user';
import type { UserListItem, UserStatusFilter } from '../../../types/user';
import { MobileUserCard } from './MobileUserCard';

interface MobileUserListProps {
  users: UserListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Search input (server-side `search`). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Status filter (server-side `status`). */
  status: UserStatusFilter;
  onStatusChange: (value: UserStatusFilter) => void;
  /** Role filter (server-side `role_id`). */
  roleId: number | null;
  onRoleChange: (value: number | null) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onView: (user: UserListItem) => void;
  page: number;
  totalPages: number;
  totalCount?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

/**
 * MobileUserList — mobile presentation of the user list (admin module).
 *
 * Search + filter button, stacked user cards, and the existing server-side
 * status/role filters inside the shared filter sheet — every control maps
 * 1:1 to the desktop GET /users params.
 */
export const MobileUserList: FC<MobileUserListProps> = ({
  users,
  loading,
  error,
  onRetry,
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  roleId,
  onRoleChange,
  hasActiveFilters,
  onClearFilters,
  onView,
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pb-24">
      <MobileSearchFilterBar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onOpenFilters={() => setFiltersOpen(true)}
        searchPlaceholder="Search by name or email"
      />

      <MobileCardList
        items={users}
        loading={loading}
        error={error}
        onRetry={onRetry}
        emptyIcon={Shield}
        emptyTitle="No users found"
        emptyDescription="User accounts you approve will appear here."
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        loadingLabel="Loading users"
        getKey={(user) => user.id}
        renderCard={(user) => (
          <MobileUserCard user={user} onClick={() => onView(user)} />
        )}
      />

      <MobileListPagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter users"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      >
        <Select
          label="Status"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          value={status}
          onChange={(e) => onStatusChange(e.target.value as UserStatusFilter)}
        />
        <Select
          label="Role"
          placeholder="All roles"
          options={USER_ROLE_OPTIONS}
          value={roleId != null ? String(roleId) : ''}
          onChange={(e) => onRoleChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      </MobileFilterSheet>
    </div>
  );
};
