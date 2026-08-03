import type { FC, ReactNode } from 'react';

type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 12;
type GridGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
type GridAlign = 'start' | 'center' | 'end' | 'stretch';

interface GridProps {
  /** Number of columns (responsive: overridden by breakpoint props) */
  cols?: GridCols;
  /** Columns on sm breakpoint */
  sm?: GridCols;
  /** Columns on md breakpoint */
  md?: GridCols;
  /** Columns on lg breakpoint */
  lg?: GridCols;
  /** Columns on xl breakpoint */
  xl?: GridCols;
  /** Gap between cells */
  gap?: GridGap;
  /** Auto-fit mode (min column width, e.g. '250px') */
  autoFit?: string;
  /** Auto-fill mode (min column width, e.g. '200px') */
  autoFill?: string;
  /** Vertical alignment of items */
  align?: GridAlign;
  /** Children */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/* ── Lookup Maps (full strings for Tailwind JIT detection) ──────────── */

const gapMap: Record<GridGap, string> = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3',
  4: 'gap-4', 5: 'gap-5', 6: 'gap-6', 8: 'gap-8',
  10: 'gap-10', 12: 'gap-12',
};

const colsMap: Record<GridCols, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
  4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6', 12: 'grid-cols-12',
};

const smColsMap: Record<GridCols, string> = {
  1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 12: 'sm:grid-cols-12',
};

const mdColsMap: Record<GridCols, string> = {
  1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3',
  4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 12: 'md:grid-cols-12',
};

const lgColsMap: Record<GridCols, string> = {
  1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 12: 'lg:grid-cols-12',
};

const xlColsMap: Record<GridCols, string> = {
  1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 12: 'xl:grid-cols-12',
};

const alignMap: Record<GridAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

/**
 * Grid — responsive CSS grid layout using Tailwind's grid utilities.
 *
 * @example
 * ```tsx
 * <Grid cols={3} gap={4}>
 *   <Card>...</Card>
 * </Grid>
 * <Grid autoFit="250px" gap={4}>
 *   <StatCard ... />
 * </Grid>
 * ```
 */
export const Grid: FC<GridProps> = ({
  cols = 1,
  sm,
  md,
  lg,
  xl,
  gap = 4,
  autoFit,
  autoFill,
  align = 'stretch',
  children,
  className = '',
}) => {
  // Auto-fit/fill mode uses CSS grid with minmax
  if (autoFit || autoFill) {
    const mode = autoFit ? 'auto-fit' : 'auto-fill';
    const min = autoFit ?? autoFill;

    return (
      <div
        className={`grid ${gapMap[gap]} ${alignMap[align]} ${className}`}
        style={{
          gridTemplateColumns: `repeat(${mode}, minmax(${min}, 1fr))`,
        }}
      >
        {children}
      </div>
    );
  }

  // Build responsive column classes using lookup maps
  const colClasses = [
    cols > 1 ? colsMap[cols] : '',
    sm ? smColsMap[sm] : '',
    md ? mdColsMap[md] : '',
    lg ? lgColsMap[lg] : '',
    xl ? xlColsMap[xl] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`grid ${gapMap[gap]} ${colClasses} ${alignMap[align]} ${className}`}>
      {children}
    </div>
  );
};
