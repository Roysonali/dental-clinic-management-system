import type { FC } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icon } from '../common/Icon/Icon';
import {
  APPOINTMENT_STATUS_FILTERS,
  type AppointmentStatusFilter,
} from '../../constants/appointment';

interface AppointmentFiltersProps {
  /** Current status filter */
  status: AppointmentStatusFilter;
  /** Called when the filter changes */
  onStatusChange: (status: AppointmentStatusFilter) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * AppointmentFilters — compact status filter for the appointment list.
 *
 * The appointment lifecycle has eight filter values (All + 7 statuses), which
 * is too many for the segmented control the Patient module uses for its
 * three-way filter, so it is rendered as a native select styled with the same
 * toolbar tokens (height, radius, focus ring) as the DataTableToolbar
 * controls it sits alongside.
 */
export const AppointmentFilters: FC<AppointmentFiltersProps> = ({
  status,
  onStatusChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as AppointmentStatusFilter)}
        disabled={disabled}
        aria-label="Filter by status"
        className="
          appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-9
          text-button-sm font-medium text-neutral-700
          transition-colors duration-150 hover:bg-neutral-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
          disabled:cursor-not-allowed disabled:opacity-50
        "
      >
        {APPOINTMENT_STATUS_FILTERS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
        <Icon icon={ChevronDown} size="sm" />
      </div>
    </div>
  );
};
