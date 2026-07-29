import type { FC, ReactNode } from 'react';

type StackDirection = 'vertical' | 'horizontal';
type StackSpacing = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 | 14 | 16;
type StackAlignment = 'start' | 'center' | 'end' | 'stretch';
type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

interface StackProps {
  /** Stack direction */
  direction?: StackDirection;
  /** Gap between children (Tailwind spacing scale) */
  spacing?: StackSpacing;
  /** Cross-axis alignment */
  align?: StackAlignment;
  /** Main-axis justification */
  justify?: StackJustify;
  /** Allow wrapping on horizontal */
  wrap?: boolean;
  /** Responsive: switch to vertical on mobile */
  responsive?: boolean;
  /** Children */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/* ── Lookup Maps (full strings for Tailwind JIT detection) ──────────── */

const gapMap: Record<StackSpacing, string> = {
  0: 'gap-0',
  0.5: 'gap-0.5',
  1: 'gap-1',
  1.5: 'gap-1.5',
  2: 'gap-2',
  2.5: 'gap-2.5',
  3: 'gap-3',
  3.5: 'gap-3.5',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  7: 'gap-7',
  8: 'gap-8',
  9: 'gap-9',
  10: 'gap-10',
  12: 'gap-12',
  14: 'gap-14',
  16: 'gap-16',
};

const alignMap: Record<StackAlignment, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyMap: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

/**
 * Stack — consistent spacing between elements without hardcoded margins.
 *
 * @example
 * ```tsx
 * <Stack spacing="4">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 * <Stack direction="horizontal" spacing="3" align="center">
 *   <Icon ... />
 *   <span>Label</span>
 * </Stack>
 * ```
 */
export const Stack: FC<StackProps> = ({
  direction = 'vertical',
  spacing = 4,
  align = 'start',
  justify = 'start',
  wrap = false,
  responsive = false,
  children,
  className = '',
}) => {
  const isVertical = direction === 'vertical';

  const baseClasses = responsive
    ? 'flex flex-col sm:flex-row'
    : isVertical
      ? 'flex flex-col'
      : 'flex flex-row';

  return (
    <div
      className={`
        ${baseClasses}
        ${alignMap[align]}
        ${justifyMap[justify]}
        ${wrap ? 'flex-wrap' : ''}
        ${gapMap[spacing]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
