import type { FC, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { DataTableToolbar } from '../common/DataTable/DataTableToolbar';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { Select } from '../common/Input/Select';
import {
  PROCEDURE_CATEGORY_FILTERS,
  PROCEDURE_STATUS_FILTERS,
} from '../../constants/procedure';
import type { ProcedureCategory } from '../../types/procedure';
import type { ColumnVisibility, ToolbarColumnDescriptor } from '../common/DataTable';

interface ProcedureToolbarProps {
  /** Controlled search value */
  searchValue?: string;
  /** Called when search input changes */
  onSearchChange?: (value: string) => void;
  /** Show a loading spinner in the search field */
  searchLoading?: boolean;
  /** Current category filter */
  category: ProcedureCategory | 'all';
  /** Called when the category filter changes */
  onCategoryChange: (category: ProcedureCategory | 'all') => void;
  /** Current status filter */
  status: 'all' | 'active' | 'inactive';
  /** Called when the status filter changes */
  onStatusChange: (status: 'all' | 'active' | 'inactive') => void;
  /** Called when "New Procedure" is clicked */
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
const PROCEDURE_TOOLBAR_COLUMNS: ToolbarColumnDescriptor[] = [
  { key: 'code', label: 'Code', hideable: true },
  { key: 'name', label: 'Name', hideable: true },
  { key: 'category', label: 'Category', hideable: true },
  { key: 'cost', label: 'Default Cost', hideable: true },
  { key: 'status', label: 'Status', hideable: true },
];

/**
 * ProcedureToolbar — search + category/status filters + Columns menu +
 * New Procedure CTA. Mirrors the Patient/Appointment toolbar pattern:
 * composes the shared DataTableToolbar so search + filters group on the
 * left, while the Columns menu and the New Procedure CTA share the
 * right-side cluster on a single row (Columns first, then the CTA), which
 * pins to the far right and never wraps on desktop.
 */
export const ProcedureToolbar: FC<ProcedureToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchLoading = false,
  category,
  onCategoryChange,
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
      searchPlaceholder="Search procedures…"
      searchLoading={searchLoading}
      columns={PROCEDURE_TOOLBAR_COLUMNS}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      className={className}
      primaryActions={
        <Button
          size="md"
          onClick={onCreate}
          leftIcon={<Icon icon={Plus} size="md" />}
          className="shrink-0 whitespace-nowrap"
        >
          New Procedure
        </Button>
      }
    >
      {children}
      <Select
        aria-label="Filter by category"
        options={PROCEDURE_CATEGORY_FILTERS}
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as ProcedureCategory | 'all')}
        className="h-10"
        wrapperClassName="w-40 shrink-0"
      />
      <Select
        aria-label="Filter by status"
        options={PROCEDURE_STATUS_FILTERS}
        value={status}
        onChange={(e) => onStatusChange(e.target.value as 'all' | 'active' | 'inactive')}
        className="h-10"
        wrapperClassName="w-36 shrink-0"
      />
    </DataTableToolbar>
  );
};
