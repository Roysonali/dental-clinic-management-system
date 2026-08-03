import type { FC, ReactNode } from 'react';
import { UserPlus } from 'lucide-react';
import { DataTableToolbar } from '../common/DataTable/DataTableToolbar';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { PatientFilters } from './PatientFilters';
import type { PatientStatusFilter } from '../../types/patient';
import type { ColumnVisibility, ToolbarColumnDescriptor } from '../common/DataTable';

interface PatientToolbarProps {
  /** Controlled search value */
  searchValue?: string;
  /** Called when search input changes */
  onSearchChange?: (value: string) => void;
  /** Show a loading spinner in the search field */
  searchLoading?: boolean;
  /** Current status filter */
  status: PatientStatusFilter;
  /** Called when status filter changes */
  onStatusChange: (status: PatientStatusFilter) => void;
  /** Called when "Register Patient" is clicked */
  onRegister: () => void;
  /** Column visibility (for the visibility menu) */
  columnVisibility?: ColumnVisibility;
  /** Called when column visibility changes */
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /** Extra actions rendered before the register button */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/** Toolbar column descriptors for the column-visibility menu. */
const PATIENT_TOOLBAR_COLUMNS: ToolbarColumnDescriptor[] = [
  { key: 'patient_code', label: 'Patient Code', hideable: true },
  { key: 'name', label: 'Patient Name', hideable: true },
  { key: 'age', label: 'Age', hideable: true },
  { key: 'gender', label: 'Gender', hideable: true },
  { key: 'phone', label: 'Phone', hideable: true },
  { key: 'status', label: 'Status', hideable: true },
];

/**
 * PatientToolbar — search + status filter + Register action + column
 * visibility menu. Composes the shared DataTableToolbar (which reuses the
 * Dropdown primitive for the columns menu).
 *
 * Layout: search + status filter + Columns menu stay grouped as table
 * controls; the Register Patient button is the module's primary CTA and is
 * rendered via `primaryActions` so it pins to the far right and never
 * wraps/shrinks on desktop.
 */
export const PatientToolbar: FC<PatientToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchLoading = false,
  status,
  onStatusChange,
  onRegister,
  columnVisibility,
  onColumnVisibilityChange,
  children,
  className = '',
}) => {
  return (
    <DataTableToolbar
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search patients..."
      searchLoading={searchLoading}
      columns={PATIENT_TOOLBAR_COLUMNS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      className={className}
      primaryActions={
        <Button
          size="md"
          onClick={onRegister}
          leftIcon={<Icon icon={UserPlus} size="md" />}
          className="shrink-0 whitespace-nowrap"
        >
          Register Patient
        </Button>
      }
    >
      {children}
      <PatientFilters status={status} onStatusChange={onStatusChange} />
    </DataTableToolbar>
  );
};
