import type { FC } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icon } from '../../common/Icon/Icon';
import { useDoctors } from '../../../hooks/doctors/useDoctors';
import {
  APPOINTMENT_STATUS_FILTERS,
  type AppointmentStatusFilter,
} from '../../../constants/appointment';

interface CalendarFiltersProps {
  /** Current dentist filter (null = all) */
  dentistId: number | null;
  /** Called when dentist filter changes */
  onDentistChange: (dentistId: number | null) => void;
  /** Current status filter */
  statusFilter: AppointmentStatusFilter;
  /** Called when status filter changes */
  onStatusChange: (status: AppointmentStatusFilter) => void;
  /** Additional classes */
  className?: string;
}

/**
 * CalendarFilters — dentist and status filter controls for the calendar view.
 *
 * The dentist filter fetches from the existing doctor list endpoint and
 * sends `dentist_id` to the backend (server-side filtering, not client-side).
 * The status filter sends `status` to the backend.
 */
export const CalendarFilters: FC<CalendarFiltersProps> = ({
  dentistId,
  onDentistChange,
  statusFilter,
  onStatusChange,
  className = '',
}) => {
  const doctorsQuery = useDoctors();

  const dentistOptions = [
    { value: '', label: 'All Dentists' },
    ...(doctorsQuery.data?.items ?? []).map((d) => ({
      value: String(d.user_id),
      label: d.user_full_name ?? d.doctor_code ?? `Dentist #${d.user_id}`,
    })),
  ];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Dentist filter */}
      <div className="relative">
        <select
          value={dentistId === null ? '' : String(dentistId)}
          onChange={(e) => {
            const val = e.target.value;
            onDentistChange(val === '' ? null : Number(val));
          }}
          disabled={doctorsQuery.isLoading}
          aria-label="Filter by dentist"
          className="
            appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-9
            text-button-sm font-medium text-neutral-700
            transition-colors duration-150 hover:bg-neutral-50
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {dentistOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <Icon icon={ChevronDown} size="sm" />
        </div>
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as AppointmentStatusFilter)}
          aria-label="Filter by status"
          className="
            appearance-none rounded-lg border border-neutral-300 bg-white py-2 pl-3 pr-9
            text-button-sm font-medium text-neutral-700
            transition-colors duration-150 hover:bg-neutral-50
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
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
    </div>
  );
};
