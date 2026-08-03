import type { FC } from 'react';

export type SkeletonVariant = 'text' | 'avatar' | 'card' | 'table-row' | 'button' | 'custom';

interface SkeletonProps {
  /** Shape preset */
  variant?: SkeletonVariant;
  /** Width override (e.g. 'w-32', 'w-full', '200px') */
  width?: string;
  /** Height override */
  height?: string;
  /** Number of lines for text variant */
  lines?: number;
  /** Enable shimmer animation (default true) */
  animate?: boolean;
  /** Additional classes */
  className?: string;
}

/* ── Preset styles ────────────────────────────────────────────────── */

const presets: Record<
  SkeletonVariant,
  { className: string; defaultLines?: number }
> = {
  text: { className: 'h-4 w-full rounded', defaultLines: 1 },
  avatar: { className: 'h-10 w-10 rounded-full', defaultLines: undefined },
  card: { className: 'h-32 w-full rounded-lg', defaultLines: undefined },
  'table-row': { className: 'h-12 w-full rounded', defaultLines: undefined },
  button: { className: 'h-10 w-24 rounded-lg', defaultLines: undefined },
  custom: { className: '', defaultLines: undefined },
};

/* ── Component ──────────────────────────────────────────────────────── */

export const Skeleton: FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  lines,
  animate = true,
  className = '',
}) => {
  const preset = presets[variant];
  const numLines = lines ?? preset.defaultLines ?? 1;
  const animClass = animate
    ? 'animate-pulse motion-reduce:animate-none'
    : '';

  const skeletonClass = `
    bg-neutral-200
    ${animClass}
    ${preset.className}
    ${width ? '' : ''}
    ${className}
  `;

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  if (variant === 'text' && numLines > 1) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading content">
        {Array.from({ length: numLines }).map((_, i) => (
          <div
            key={i}
            className={skeletonClass}
            style={{
              ...style,
              width: i === numLines - 1 ? '60%' : width,
            }}
          />
        ))}
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div
      className={skeletonClass}
      style={style}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};
