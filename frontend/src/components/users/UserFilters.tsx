import type { FC } from 'react';
import { Select } from '../common/Input/Select';
import { USER_STATUS_FILTERS } from '../../constants/user';
import type { UserStatusFilter } from '../../types/user';

/* ── Local segmented filter (mirrors DoctorFilters' status control) ──── */

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

function Segmented<T extends string>({ label, options, value, onChange, disabled = false }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-300 bg-white p-0.5"
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={`
              rounded-md px-2.5 py-1.5 text-button-sm font-medium transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
              disabled:cursor-not-allowed disabled:opacity-50
              ${isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Props ───────────────────────────────────────────────────────────── */

interface UserFiltersProps {
  /** Current status filter */
  status: UserStatusFilter;
  /** Called when the status filter changes */
  onStatusChange: (status: UserStatusFilter) => void;
  /** Role options for the Select (value = String(role_id)) */
  roleOptions: readonly { value: string; label: string; disabled?: boolean }[];
  /** Current role filter (null = all) */
  roleId: number | null;
  /** Called when the role filter changes */
  onRoleChange: (roleId: number | null) => void;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * UserFilters — backend-driven list filters: lifecycle status (pending /
 * active / inactive) and role. Both feed `useUserFilters` → `GET /users`
 * query params (`status`, `role_id`); there is no client-side filtering.
 */
export const UserFilters: FC<UserFiltersProps> = ({
  status,
  onStatusChange,
  roleOptions,
  roleId,
  onRoleChange,
  disabled = false,
}) => {
  return (
    <>
      <Segmented
        label="Filter by status"
        options={USER_STATUS_FILTERS}
        value={status}
        onChange={onStatusChange}
        disabled={disabled}
      />
      <Select
        aria-label="Filter by role"
        value={roleId == null ? '' : String(roleId)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          onRoleChange(raw ? Number(raw) : null);
        }}
        options={roleOptions}
        className="w-44"
      />
    </>
  );
};
