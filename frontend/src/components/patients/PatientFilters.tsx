import type { FC } from 'react';
import { PATIENT_STATUS_FILTERS } from '../../constants/patient';
import type { PatientStatusFilter } from '../../types/patient';

interface PatientFiltersProps {
  /** Current status filter */
  status: PatientStatusFilter;
  /** Called when the filter changes */
  onStatusChange: (status: PatientStatusFilter) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * PatientFilters — segmented control for the active/inactive/all filter.
 * Keyboard accessible (native buttons with `aria-pressed`); styled to sit
 * alongside DataTableToolbar actions.
 */
export const PatientFilters: FC<PatientFiltersProps> = ({
  status,
  onStatusChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-neutral-300 bg-white p-0.5 ${className}`}
    >
      {PATIENT_STATUS_FILTERS.map((option) => {
        const isActive = status === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onStatusChange(option.value)}
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
};
