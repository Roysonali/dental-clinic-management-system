import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  resolveCellValue,
  resolveSortValue,
  DEFAULT_EMPTY_TITLE,
  DEFAULT_EMPTY_DESCRIPTION,
  type ColumnVisibility,
  type DataTableColumn,
  type RowKey,
  type SortState,
} from './types';
import { Checkbox } from '../Checkbox/Checkbox';
import { Skeleton } from '../Skeleton/Skeleton';
import { EmptyState } from '../EmptyState/EmptyState';
import { ResultState } from '../ResultState/ResultState';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';

/* ── Default renderer ──────────────────────────────────────────────── */

function defaultRender(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-neutral-400">—</span>;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

/* ── Toolbar render-prop helpers ───────────────────────────────────── */

export interface DataTableToolbarHelpers {
  /** Current column visibility map */
  columnVisibility: ColumnVisibility;
  /** Set column visibility (supports both controlled & uncontrolled) */
  setColumnVisibility: (visibility: ColumnVisibility) => void;
}

/* ── Props ─────────────────────────────────────────────────────────── */

interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row data */
  data: T[];
  /** Returns a unique key for each row */
  rowKey: (row: T) => RowKey;
  /** Loading state (renders skeleton rows) */
  loading?: boolean;
  /** Error state (renders error panel with retry) */
  error?: string | null;
  /** Called by the retry button */
  onRetry?: () => void;
  /** Controlled sort state */
  sortState?: SortState | null;
  /** Called when sort changes (null clears sorting) */
  onSortChange?: (sort: SortState | null) => void;
  /** Initial sort for uncontrolled mode */
  defaultSort?: SortState | null;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  /** Controlled selected row keys */
  selectedKeys?: RowKey[];
  /** Called when selection changes */
  onSelectionChange?: (keys: RowKey[]) => void;
  /** Controlled column visibility */
  columnVisibility?: ColumnVisibility;
  /** Called when column visibility changes */
  onColumnVisibilityChange?: (visibility: ColumnVisibility) => void;
  /**
   * Toolbar rendered above the table. Receives column-visibility helpers
   * so the toolbar can drive the column menu through the same
   * controlled/uncontrolled state as the table:
   *
   * ```tsx
   * toolbar={({ columnVisibility, setColumnVisibility }) => (
   *   <DataTableToolbar
   *     searchValue={q}
   *     onSearchChange={setQ}
   *     columns={columns.map(c => ({ key: c.key, label: String(c.header ?? c.key), hideable: c.hideable }))}
   *     columnVisibility={columnVisibility}
   *     onColumnVisibilityChange={setColumnVisibility}
   *   />
   * )}
   * ```
   */
  toolbar?: (helpers: DataTableToolbarHelpers) => ReactNode;
  /** Pagination rendered below the table */
  pagination?: ReactNode;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Empty state primary action */
  emptyAction?: ReactNode;
  /** Render a trailing actions cell for each row */
  rowActions?: (row: T) => ReactNode;
  /** Header label for the row actions column (defaults to 'Actions') */
  rowActionsHeader?: ReactNode;
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Number of skeleton rows shown while loading */
  loadingRows?: number;
  /** Accessible label for the table */
  ariaLabel?: string;
  /** Additional classes for the outer wrapper */
  className?: string;
}

/* ── Alignment map ─────────────────────────────────────────────────── */

const alignMap = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/* ── Component ─────────────────────────────────────────────────────── */

/**
 * DataTable — generic, column-driven data table.
 *
 * Features:
 * - Column definitions (accessor, custom render, sorting, alignment)
 * - Single-column sorting (controlled or uncontrolled)
 * - Row selection + bulk "select all" (indeterminate header checkbox)
 * - Column visibility (controlled or uncontrolled, driven via toolbar)
 * - Loading skeleton rows, empty state, error state with retry
 * - Optional toolbar and pagination slots
 * - Row click + row actions support
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={[
 *     { key: 'name', header: 'Name', accessor: 'name', sortable: true },
 *     { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
 *   ]}
 *   data={patients}
 *   rowKey={(p) => p.id}
 *   toolbar={({ columnVisibility, setColumnVisibility }) => (
 *     <DataTableToolbar
 *       searchValue={q}
 *       onSearchChange={setQ}
 *       columns={columns.map(c => ({ key: c.key, label: String(c.header ?? c.key), hideable: c.hideable }))}
 *       columnVisibility={columnVisibility}
 *       onColumnVisibilityChange={setColumnVisibility}
 *     />
 *   )}
 *   pagination={<Pagination currentPage={page} totalPages={total} onPageChange={setPage} />}
 * />
 * ```
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  sortState: controlledSort,
  onSortChange,
  defaultSort = null,
  selectable = false,
  selectedKeys: controlledSelected,
  onSelectionChange,
  columnVisibility: controlledVisibility,
  onColumnVisibilityChange,
  toolbar,
  pagination,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyDescription = DEFAULT_EMPTY_DESCRIPTION,
  emptyAction,
  rowActions,
  rowActionsHeader = 'Actions',
  onRowClick,
  loadingRows = 5,
  ariaLabel = 'Data table',
  className = '',
}: DataTableProps<T>) {
  /* ── Sorting state (uncontrolled fallback) ────────────────────── */
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort);
  const isSortControlled = controlledSort !== undefined;
  const sort = isSortControlled ? controlledSort : internalSort;

  const handleSortChange = (next: SortState | null) => {
    if (isSortControlled) onSortChange?.(next);
    else setInternalSort(next);
  };

  const toggleSort = (key: string) => {
    if (sort?.key === key) {
      if (sort.direction === 'asc') handleSortChange({ key, direction: 'desc' });
      else handleSortChange(null);
    } else {
      handleSortChange({ key, direction: 'asc' });
    }
  };

  /* ── Selection state (uncontrolled fallback) ───────────────────── */
  const [internalSelected, setInternalSelected] = useState<RowKey[]>([]);
  const isSelectedControlled = controlledSelected !== undefined;
  const selected = isSelectedControlled ? controlledSelected : internalSelected;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Memoised derived values — avoid recomputing key/selection predicates on
  // every render (recomputed only when data, rowKey or selection change).
  const allKeys = useMemo(() => data.map(rowKey), [data, rowKey]);
  const allKeysSet = useMemo(() => new Set(allKeys), [allKeys]);
  const allSelected = useMemo(
    () => allKeys.length > 0 && allKeys.every((k) => selectedSet.has(k)),
    [allKeys, selectedSet],
  );
  const someSelected = useMemo(
    () => !allSelected && allKeys.some((k) => selectedSet.has(k)),
    [allSelected, allKeys, selectedSet],
  );

  const handleSelectionChange = (next: RowKey[]) => {
    if (isSelectedControlled) onSelectionChange?.(next);
    else setInternalSelected(next);
  };

  const toggleRow = (key: RowKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    handleSelectionChange([...next]);
  };

  const toggleAll = () => {
    if (allSelected) {
      handleSelectionChange(selected.filter((k) => !allKeysSet.has(k)));
    } else {
      handleSelectionChange([...new Set([...selected, ...allKeys])]);
    }
  };

  /* ── Column visibility state (uncontrolled fallback) ───────────── */
  const initialVisibility = useMemo(() => {
    const vis: ColumnVisibility = {};
    for (const col of columns) {
      vis[col.key] = !col.defaultHidden;
    }
    return vis;
  }, [columns]);

  const [internalVisibility, setInternalVisibility] = useState<ColumnVisibility>(initialVisibility);
  const isVisibilityControlled = controlledVisibility !== undefined;
  const visibility = isVisibilityControlled ? controlledVisibility : internalVisibility;

  const setColumnVisibility = (next: ColumnVisibility) => {
    if (isVisibilityControlled) onColumnVisibilityChange?.(next);
    else setInternalVisibility(next);
  };

  const visibleColumns = columns.filter((col) => !col.hideable || visibility[col.key] !== false);

  /* ── Sorted data ───────────────────────────────────────────────── */
  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return data;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = resolveSortValue(column, a);
      const bv = resolveSortValue(column, b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, sort, columns]);

  const toolbarHelpers: DataTableToolbarHelpers = {
    columnVisibility: visibility,
    setColumnVisibility,
  };

  /* ── Error state ───────────────────────────────────────────────── */
  if (error) {
    return (
      <div className={className}>
        {toolbar && <div className="mb-4">{toolbar(toolbarHelpers)}</div>}
        <div className="rounded-xl border border-danger/20 bg-danger/5">
          <ResultState
            variant="error"
            title="Failed to load data"
            description={error}
            actions={
              onRetry ? <Button variant="primary" size="md" onClick={onRetry}>Retry</Button> : undefined
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      {toolbar && <div className="mb-4">{toolbar(toolbarHelpers)}</div>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full border-collapse text-left" aria-label={ariaLabel}>
          {/* Header */}
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {selectable && (
                <th scope="col" className="w-12 px-4 py-3 align-middle">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                    size="sm"
                  />
                </th>
              )}
              {visibleColumns.map((column) => {
                const isSorted = sort?.key === column.key;
                const ariaSort = isSorted
                  ? sort.direction === 'asc' ? 'ascending' : 'descending'
                  : column.sortable ? 'none' : undefined;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`
                      whitespace-nowrap px-4 py-3 text-label font-semibold text-neutral-600
                      ${alignMap[column.align ?? 'left']}
                      ${column.width ?? ''}
                      ${column.headerClassName ?? ''}
                    `}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="
                          inline-flex items-center gap-1.5 text-label font-semibold text-neutral-600
                          transition-colors duration-150 hover:text-neutral-900
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                        "
                      >
                        {column.headerIcon && <Icon icon={column.headerIcon} size="xs" />}
                        {column.header}
                        <span className="shrink-0 text-neutral-400">
                          {isSorted ? (
                            <Icon
                              icon={sort.direction === 'asc' ? ArrowUp : ArrowDown}
                              size="xs"
                            />
                          ) : (
                            <Icon icon={ChevronsUpDown} size="xs" />
                          )}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        {column.headerIcon && <Icon icon={column.headerIcon} size="xs" />}
                        {column.header}
                      </span>
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="w-20 px-4 py-3 text-right text-label font-semibold text-neutral-600">
                  {rowActionsHeader}
                </th>
              )}
            </tr>
          </thead>

          {/* Body */}
          <tbody aria-busy={loading}>
            {loading ? (
              Array.from({ length: loadingRows }).map((_, rowIdx) => (
                <tr key={`skeleton-${rowIdx}`} className="border-b border-neutral-100 last:border-0">
                  {selectable && (
                    <td className="px-4 py-3">
                      <Skeleton variant="table-row" width="16px" />
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 ${alignMap[column.align ?? 'left']}`}>
                      <Skeleton variant="table-row" />
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3">
                      <Skeleton variant="table-row" width="40px" />
                    </td>
                  )}
                </tr>
              ))
            ) : (
              sortedData.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedSet.has(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`
                      border-b border-neutral-100 transition-colors duration-100 last:border-0
                      ${onRowClick ? 'cursor-pointer hover:bg-neutral-50' : ''}
                      ${isSelected ? 'bg-primary-50/60' : 'hover:bg-neutral-50'}
                    `}
                  >
                    {selectable && (
                      <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          aria-label={`Select row ${String(key)}`}
                          size="sm"
                        />
                      </td>
                    )}
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-body text-neutral-800 ${alignMap[column.align ?? 'left']} ${column.cellClassName ?? ''}`}
                      >
                        {column.render
                          ? column.render(row)
                          : defaultRender(resolveCellValue(column, row))}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {rowActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Empty state */}
        {!loading && sortedData.length === 0 && (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            primaryAction={emptyAction}
          />
        )}
      </div>

      {/* Pagination */}
      {pagination && <div className="mt-4">{pagination}</div>}
    </div>
  );
}
