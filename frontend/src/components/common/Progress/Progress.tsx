import type { FC } from 'react';

/* ── Shared types ────────────────────────────────────────────────── */

export type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger';

/* ── Linear Progress ───────────────────────────────────────────────── */

interface LinearProgressProps {
  /** Current value (0–100). Omit or pass null for indeterminate. */
  value?: number | null;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Additional classes */
  className?: string;
}

const linearTrackVar: Record<ProgressVariant, string> = {
  primary: 'bg-primary-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export const LinearProgress: FC<LinearProgressProps> = ({
  value,
  variant = 'primary',
  showPercentage = false,
  className = '',
}) => {
  const isIndeterminate = value == null;
  const pct = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
      >
        <div
          className={`
            h-full rounded-full transition-all duration-300
            ${linearTrackVar[variant]}
            ${isIndeterminate ? 'w-1/2 animate-pulse motion-reduce:animate-none' : ''}
          `}
          style={isIndeterminate ? {} : { width: `${pct}%` }}
        />
      </div>
      {showPercentage && !isIndeterminate && (
        <span className="text-caption font-medium text-neutral-600 tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  );
};

/* ── Circular Progress ────────────────────────────────────────────── */

export type CircularSize = 'sm' | 'md' | 'lg' | 'xl';

interface CircularProgressProps {
  /** Current value (0–100). Omit or pass null for indeterminate. */
  value?: number | null;
  /** Visual variant */
  variant?: ProgressVariant;
  /** Size */
  size?: CircularSize;
  /** Additional classes */
  className?: string;
}

const circularSizes: Record<CircularSize, { stroke: number; radius: number; viewBox: number }> = {
  sm: { stroke: 3, radius: 14, viewBox: 32 },
  md: { stroke: 4, radius: 18, viewBox: 40 },
  lg: { stroke: 5, radius: 22, viewBox: 48 },
  xl: { stroke: 6, radius: 28, viewBox: 60 },
};

const circularColors: Record<ProgressVariant, string> = {
  primary: 'stroke-primary-500',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
};

export const CircularProgress: FC<CircularProgressProps> = ({
  value,
  variant = 'primary',
  size = 'md',
  className = '',
}) => {
  const isIndeterminate = value == null;
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const { stroke, radius, viewBox } = circularSizes[size];
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg
      className={`${className} ${isIndeterminate ? 'animate-spin motion-reduce:animate-none' : ''}`}
      width={viewBox}
      height={viewBox}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      role="progressbar"
      aria-valuenow={isIndeterminate ? undefined : pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progress"
    >
      {/* Track */}
      <circle
        cx={viewBox / 2}
        cy={viewBox / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-neutral-200"
      />
      {/* Progress arc */}
      {!isIndeterminate && (
        <circle
          cx={viewBox / 2}
          cy={viewBox / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={circularColors[variant]}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${viewBox / 2} ${viewBox / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
        />
      )}
    </svg>
  );
};
