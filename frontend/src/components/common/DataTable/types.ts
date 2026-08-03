import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ── Sorting ───────────────────────────────────────────────────────── */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** Column key being sorted */
  key: string;
  /** Sort direction */
  direction: SortDirection;
}

/* ── Selection ─────────────────────────────────────────────────────── */

/** Unique row identifier (string or number key) */
export type RowKey = string | number;

/* ── Column Visibility ─────────────────────────────────────────────── */

/** Map of column key → visible */
export type ColumnVisibility = Record<string, boolean>;

/* ── Column Definitions ────────────────────────────────────────────── */

export type ColumnAlign = 'left' | 'center' | 'right';

/**
 * A single column definition for DataTable.
 *
 * @typeParam T - Row data type.
 */
export interface DataTableColumn<T> {
  /** Unique column key (used for sorting, visibility, React keys) */
  key: string;
  /** Header label */
  header?: ReactNode;
  /** Property accessor or accessor function */
  accessor?: keyof T | ((row: T) => unknown);
  /** Custom cell renderer (overrides accessor) */
  render?: (row: T) => ReactNode;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Value extractor used for sorting (defaults to accessor result) */
  sortValue?: (row: T) => string | number | Date | null;
  /** Cell content alignment */
  align?: ColumnAlign;
  /** Column width (e.g. 'w-32', '200px') */
  width?: string;
  /** Whether the column can be toggled via column visibility */
  hideable?: boolean;
  /** Hidden by default (only applies when hideable) */
  defaultHidden?: boolean;
  /** Extra classes for the header cell */
  headerClassName?: string;
  /** Extra classes for every body cell in this column */
  cellClassName?: string;
  /** Column-level icon shown next to the header (optional) */
  headerIcon?: LucideIcon;
}

/* ── Cell Value Helpers ────────────────────────────────────────────── */

/** Resolve the raw value for a column via accessor. */
export function resolveCellValue<T>(column: DataTableColumn<T>, row: T): unknown {
  const { accessor } = column;
  if (accessor === undefined) return undefined;
  if (typeof accessor === 'function') return accessor(row);
  return row[accessor];
}

/** Resolve a comparable sort value for a column. */
export function resolveSortValue<T>(column: DataTableColumn<T>, row: T): string | number | Date | null {
  if (column.sortValue) return column.sortValue(row) ?? null;
  const value = resolveCellValue(column, row);
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

/* ── Toolbar Column Descriptor ─────────────────────────────────────── */

/** Lightweight column info for the toolbar column-visibility menu. */
export interface ToolbarColumnDescriptor {
  /** Column key */
  key: string;
  /** Human-readable label for the visibility menu */
  label: string;
  /** Whether this column can be hidden */
  hideable?: boolean;
  /** Hidden by default */
  defaultHidden?: boolean;
}

export const DEFAULT_EMPTY_TITLE = 'No results found';
export const DEFAULT_EMPTY_DESCRIPTION = 'Try adjusting your search or filters.';
