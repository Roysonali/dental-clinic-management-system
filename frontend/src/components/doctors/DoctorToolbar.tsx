import type { FC, ReactNode } from 'react';
import { Search, Settings2, UserPlus } from 'lucide-react';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { Dropdown } from '../common/Dropdown/Dropdown';
import { Checkbox } from '../common/Checkbox/Checkbox';
import { Spinner } from '../common/Spinner/Spinner';
import { DoctorFilters } from './DoctorFilters';
import type { SpecializationResponse } from '../../types/doctor';
import type { DoctorAvailabilityFilter, DoctorStatusFilter } from '../../types/doctor';
import type { ColumnVisibility, ToolbarColumnDescriptor } from '../common/DataTable';

/* ── Toolbar column descriptors for the column-visibility menu ───────── */

const DOCTOR_TOOLBAR_COLUMNS: ToolbarColumnDescriptor[] = [
  { key: 'doctor_code', label: 'Doctor Code', hideable: true },
  { key: 'name', label: 'Doctor Name', hideable: true },
  { key: 'primary_specialization', label: 'Primary Specialization', hideable: true },
  { key: 'primary_phone', label: 'Primary Phone', hideable: true },
  { key: 'years_of_experience', label: 'Years of Experience', hideable: true },
  { key: 'consultation_fee', label: 'Consultation Fee', hideable: true },
  { key: 'status', label: 'Status', hideable: true },
  { key: 'availability', label: 'Availability', hideable: true },
];

interface DoctorToolbarProps {
  /** Controlled search value */
  searchValue?: string;
  /** Called when search input changes */
  onSearchChange?: (value: string) => void;
  /** Show a loading spinner in the search field */
  searchLoading?: boolean;
  /* ── Filters ── */
  status: DoctorStatusFilter;
  onStatusChange: (status: DoctorStatusFilter) => void;
  availability: DoctorAvailabilityFilter;
  onAvailabilityChange: (availability: DoctorAvailabilityFilter) => void;
  /** Specialization master data (backend-driven filter options) */
  specializations: SpecializationResponse[];
  specializationId: number | null;
  onSpecializationChange: (specializationId: number | null) => void;
  /** Called when "Register Doctor" is clicked */
  onRegister: () => void;
  /* ── Column visibility ── */
  columnVisibility?: ColumnVisibility;
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /** Extra actions rendered next to the Register button */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * DoctorToolbar — single "Search & Filters" card: search input + status /
 * availability / specialization filters + column-visibility menu +
 * Register Doctor CTA. Search placeholder is intentionally explicit about
 * the backend contract: doctor code or name only (no phone/email search).
 */
export const DoctorToolbar: FC<DoctorToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  availability,
  onAvailabilityChange,
  specializations,
  specializationId,
  onSpecializationChange,
  onRegister,
  columnVisibility,
  onColumnVisibilityChange,
  children,
  className = '',
}) => {
  const specializationOptions = [
    { value: '', label: 'All specializations' },
    ...specializations.map((spec) => ({ value: String(spec.id), label: spec.name })),
  ];

  const hideableColumns = DOCTOR_TOOLBAR_COLUMNS.filter((c) => c.hideable);
  const canToggleVisibility =
    hideableColumns.length > 0 &&
    columnVisibility !== undefined &&
    onColumnVisibilityChange !== undefined;

  const toggleColumn = (key: string) => {
    if (!onColumnVisibilityChange || !columnVisibility) return;
    onColumnVisibilityChange({ ...columnVisibility, [key]: !columnVisibility[key] });
  };

  return (
    <section
      aria-label="Search and filter doctors"
      className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {/* Primary row: search + actions.
          Desktop (lg+): search and actions share one row (search grows,
          actions pinned right). Tablet (sm-lg): search on its own row,
          actions below. Mobile (<sm): search, then a full-width Register
          Doctor button (Columns is table-only so it is hidden). */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="relative w-full lg:w-auto lg:max-w-md lg:flex-1">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <Icon icon={Search} size="sm" />
          </div>
          <input
            type="search"
            value={searchValue ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search by doctor code or name…"
            aria-label="Search by doctor code or name…"
            className="
              h-10 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-9 text-body text-neutral-800 shadow-sm
              placeholder:text-neutral-400
              transition-all duration-150
              focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20
              hover:border-neutral-400
            "
          />
          {searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              <Spinner size="xs" variant="neutral" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          {children}
          {canToggleVisibility && (
            <Dropdown>
              <Dropdown.Trigger
                className="
                  hidden h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3
                  text-button-sm font-medium text-neutral-700 shadow-sm
                  transition-all duration-150 hover:border-neutral-400 hover:bg-neutral-50
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                  sm:inline-flex
                "
              >
                <Icon icon={Settings2} size="sm" />
                Columns
              </Dropdown.Trigger>
              <Dropdown.Content align="end" className="w-52">
                <Dropdown.Label>Visible columns</Dropdown.Label>
                {hideableColumns.map((col) => (
                  <div
                    key={col.key}
                    role="menuitem"
                    tabIndex={-1}
                    className="px-3 py-1.5 transition-colors duration-100 hover:bg-neutral-100"
                  >
                    <Checkbox
                      label={col.label}
                      checked={columnVisibility[col.key] !== false}
                      onChange={() => toggleColumn(col.key)}
                      size="sm"
                    />
                  </div>
                ))}
              </Dropdown.Content>
            </Dropdown>
          )}
          <Button
            size="md"
            onClick={onRegister}
            leftIcon={<Icon icon={UserPlus} size="md" />}
            className="w-full shrink-0 whitespace-nowrap sm:w-auto"
          >
            Register Doctor
          </Button>
        </div>
      </div>

      {/* Compact filter chips — directly below the primary row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-100 pt-3">
        <span className="text-caption font-semibold uppercase tracking-wider text-neutral-400">
          Filters
        </span>
        <DoctorFilters
          status={status}
          onStatusChange={onStatusChange}
          availability={availability}
          onAvailabilityChange={onAvailabilityChange}
          specializationOptions={specializationOptions}
          specializationId={specializationId}
          onSpecializationChange={onSpecializationChange}
        />
      </div>
    </section>
  );
};
