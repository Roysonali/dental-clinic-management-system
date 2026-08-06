import type { FC } from 'react';
import { Select } from '../common/Input/Select';
import { DOCTOR_AVAILABILITY_FILTERS, DOCTOR_STATUS_FILTERS } from '../../constants/doctor';
import type { DoctorAvailabilityFilter, DoctorStatusFilter } from '../../types/doctor';

/* ── Local segmented filter (shared by status + availability) ─────────── */

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

interface DoctorFiltersProps {
  /** Current status filter */
  status: DoctorStatusFilter;
  /** Called when the status filter changes */
  onStatusChange: (status: DoctorStatusFilter) => void;
  /** Current availability filter */
  availability: DoctorAvailabilityFilter;
  /** Called when the availability filter changes */
  onAvailabilityChange: (availability: DoctorAvailabilityFilter) => void;
  /** Specialization options for the Select (value = String(id)) */
  specializationOptions: readonly { value: string; label: string; disabled?: boolean }[];
  /** Current specialization filter (null = all) */
  specializationId: number | null;
  /** Called when the specialization filter changes */
  onSpecializationChange: (specializationId: number | null) => void;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * DoctorFilters — backend-driven list filters: status, availability and
 * specialization. All values feed `useDoctorFilters` → `GET /doctors`
 * query params; there is no client-side filtering.
 */
export const DoctorFilters: FC<DoctorFiltersProps> = ({
  status,
  onStatusChange,
  availability,
  onAvailabilityChange,
  specializationOptions,
  specializationId,
  onSpecializationChange,
  disabled = false,
}) => {
  return (
    <>
      <Segmented
        label="Filter by status"
        options={DOCTOR_STATUS_FILTERS}
        value={status}
        onChange={onStatusChange}
        disabled={disabled}
      />
      <Segmented
        label="Filter by availability"
        options={DOCTOR_AVAILABILITY_FILTERS}
        value={availability}
        onChange={onAvailabilityChange}
        disabled={disabled}
      />
      <Select
        aria-label="Filter by specialization"
        value={specializationId == null ? '' : String(specializationId)}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          onSpecializationChange(raw ? Number(raw) : null);
        }}
        options={specializationOptions}
        className="w-44"
      />
    </>
  );
};
