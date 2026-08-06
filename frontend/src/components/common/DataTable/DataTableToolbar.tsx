import type { FC, ReactNode } from 'react';
import { Settings2, Search } from 'lucide-react';
import type { ColumnVisibility, ToolbarColumnDescriptor } from './types';
import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';
import { Checkbox } from '../Checkbox/Checkbox';
import { Spinner } from '../Spinner/Spinner';

/* ── Props ─────────────────────────────────────────────────────────── */

interface DataTableToolbarProps {
  /** Search value (controlled) */
  searchValue?: string;
  /** Called when search input changes */
  onSearchChange?: (value: string) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Show a loading spinner inside the search input */
  searchLoading?: boolean;
  /** Lightweight column descriptors for the column-visibility menu */
  columns?: ToolbarColumnDescriptor[];
  /** Controlled column visibility */
  columnVisibility?: ColumnVisibility;
  /** Called when visibility changes */
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /**
   * Table controls (filters, secondary actions) rendered alongside the
   * search input — all grouped together as a single "table controls"
   * cluster on the left.
   */
  children?: ReactNode;
  /**
   * Primary actions (e.g. a "Create" CTA) rendered at the far right,
   * visually separated from the table-controls cluster and pinned so it
   * never wraps or shrinks on desktop. The column-visibility menu
   * ("Columns") renders directly beneath it, left-aligned.
   */
  primaryActions?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * DataTableToolbar — search input + column-visibility menu + action slots
 * for DataTable. Composable: omit props you do not need.
 *
 * Layout:
 * - **Table controls** (search + `children`) are grouped together on the
 *   left and may wrap internally on narrow screens.
 * - **Right action stack** is pinned to the far right and never
 *   wraps/shrinks: `primaryActions` (the module's primary CTA) on top with
 *   the column-visibility menu directly beneath it, left-aligned to the
 *   CTA. On desktop the CTA therefore shares the first row with the
 *   table controls; on narrow screens everything stacks vertically.
 *
 * The column-visibility menu reuses the existing `Dropdown` primitive
 * (outside-click, Escape, arrow-key navigation).
 *
 * @example
 * ```tsx
 * <DataTableToolbar
 *   searchValue={query}
 *   onSearchChange={setQuery}
 *   searchPlaceholder="Search patients..."
 *   columns={columns.map(c => ({ key: c.key, label: String(c.header ?? c.key), hideable: c.hideable }))}
 *   columnVisibility={visibility}
 *   onColumnVisibilityChange={setVisibility}
 *   primaryActions={<Button size="md">Register Patient</Button>}
 * >
 *   <PatientFilters ... />
 * </DataTableToolbar>
 * ```
 */
export const DataTableToolbar: FC<DataTableToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchLoading = false,
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  children,
  primaryActions,
  className = '',
}) => {
  const hideableColumns = (columns ?? []).filter((c) => c.hideable);
  const canToggleVisibility =
    hideableColumns.length > 0 &&
    columnVisibility !== undefined &&
    onColumnVisibilityChange !== undefined;

  const hasSearch = searchValue !== undefined || onSearchChange !== undefined;
  const hasControls = hasSearch || children !== undefined;

  const toggleColumn = (key: string) => {
    if (!onColumnVisibilityChange || !columnVisibility) return;
    onColumnVisibilityChange({ ...columnVisibility, [key]: !columnVisibility[key] });
  };

  return (
    <div
      className={`flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${className}`}
    >
      {/* Table controls: search + children (grouped on the left) */}
      {hasControls && (
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {hasSearch && (
            <div className="relative w-full sm:max-w-xs">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <Icon icon={Search} size="sm" />
              </div>
              <input
                type="search"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="
                  h-10 w-full rounded-lg border border-neutral-300 bg-white py-0 pl-9 pr-9 text-body text-neutral-800 shadow-sm
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
          )}

          {children}
        </div>
      )}

      {/* Right action stack: primary CTA on top, Columns menu directly
          beneath it (left-aligned). ml-auto covers the edge case where no
          table-controls cluster renders. */}
      {(primaryActions || canToggleVisibility) && (
        <div className="flex shrink-0 flex-col items-start gap-2 lg:ml-auto">
          {primaryActions}

          {canToggleVisibility && (
            <Dropdown>
              <Dropdown.Trigger
                className="
                  inline-flex h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3
                  text-button-sm font-medium text-neutral-700 shadow-sm
                  transition-all duration-150 hover:bg-neutral-50 hover:border-neutral-400
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
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
        </div>
      )}
    </div>
  );
};
