import type { FC, ReactNode } from 'react';
import { CalendarPlus } from 'lucide-react';
import { DataTableToolbar } from '../common/DataTable/DataTableToolbar';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { AppointmentFilters } from './AppointmentFilters';
import type { AppointmentStatusFilter } from '../../constants/appointment';
import type { ColumnVisibility, ToolbarColumnDescriptor } from '../common/DataTable';

interface AppointmentToolbarProps {
  /** Controlled search value */
  searchValue?: string;
  /** Called when search input changes */
  onSearchChange?: (value: string) => void;
  /** Show a loading spinner in the search field */
  searchLoading?: boolean;
  /** Current status filter */
  status: AppointmentStatusFilter;
  /** Called when status filter changes */
  onStatusChange: (status: AppointmentStatusFilter) => void;
  /** Called when "New Appointment" is clicked */
  onCreate: () => void;
  /** Column visibility (for the visibility menu) */
  columnVisibility?: ColumnVisibility;
  /** Called when column visibility changes */
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /** Extra actions rendered before the create button */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/** Toolbar column descriptors for the column-visibility menu. */
const APPOINTMENT_TOOLBAR_COLUMNS: ToolbarColumnDescriptor[] = [
  { key: 'appointment_number', label: 'Appointment #', hideable: true },
  { key: 'patient', label: 'Patient', hideable: true },
  { key: 'dentist', label: 'Dentist', hideable: true },
  { key: 'appointment_date', label: 'Date', hideable: true },
  { key: 'time', label: 'Time', hideable: true },
  { key: 'duration_minutes', label: 'Duration', hideable: true },
  { key: 'appointment_type', label: 'Type', hideable: true },
  { key: 'status', label: 'Status', hideable: true },
];

/**
 * AppointmentToolbar — search + status filter + New Appointment action +
 * column visibility menu. Mirrors PatientToolbar exactly: composes the shared
 * DataTableToolbar so search/filters stay grouped as table controls, the
 * Columns menu renders beneath the primary CTA (never beside it), and the CTA
 * pins to the far right and never wraps on desktop.
 */
export const AppointmentToolbar: FC<AppointmentToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  onCreate,
  columnVisibility,
  onColumnVisibilityChange,
  children,
  className = '',
}) => {
  return (
    <DataTableToolbar
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search appointments..."
      searchLoading={searchLoading}
      columns={APPOINTMENT_TOOLBAR_COLUMNS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      className={className}
      primaryActions={
        <Button
          size="md"
          onClick={onCreate}
          leftIcon={<Icon icon={CalendarPlus} size="md" />}
          className="shrink-0 whitespace-nowrap"
        >
          New Appointment
        </Button>
      }
    >
      {children}
      <AppointmentFilters status={status} onStatusChange={onStatusChange} />
    </DataTableToolbar>
  );
};
