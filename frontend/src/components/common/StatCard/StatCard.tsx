import type { FC, ReactNode } from 'react';
import { Skeleton } from '../Skeleton/Skeleton';

type StatCardSize = 'sm' | 'md' | 'lg';

interface StatCardProps {
  /** Icon component */
  icon?: ReactNode;
  /** Title/label text */
  title?: string;
  /** Primary value */
  value?: string | number;
  /** Subtitle below value */
  subtitle?: string;
  /** Trend indicator (percentage or text with arrow) */
  trend?: { value: string; positive: boolean };
  /** Value color */
  color?: string;
  /** Show loading skeleton */
  loading?: boolean;
  /** Size preset */
  size?: StatCardSize;
  /** Additional classes */
  className?: string;
  /** Click handler (makes card interactive) */
  onClick?: () => void;
}

const sizeStyles: Record<StatCardSize, string> = {
  sm: 'p-3',
  md: 'p-4 lg:p-5',
  lg: 'p-5 lg:p-6',
};

const valueSizes: Record<StatCardSize, string> = {
  sm: 'text-h3',
  md: 'text-h2',
  lg: 'text-display',
};

const iconTile: Record<StatCardSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-xl',
};

const iconSize: Record<StatCardSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

/**
 * StatCard — statistics display card for dashboards.
 *
 * @example
 * ```tsx
 * <StatCard
 *   icon={<Icon icon={Users} size="lg" className="text-primary-500" />}
 *   title="Total Patients"
 *   value="1,234"
 *   trend={{ value: "+12%", positive: true }}
 *   color="text-primary-500"
 * />
 * ```
 */
export const StatCard: FC<StatCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  trend,
  loading = false,
  size = 'md',
  className = '',
  onClick,
}) => {
  if (loading) {
    return (
      <div
        className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${sizeStyles[size]} ${className}`}
        role="status"
        aria-label="Loading statistics"
      >
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className={`${iconTile[size]} rounded-xl`} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="badge" className="w-20" />
            <Skeleton variant="stat" className="w-16" />
          </div>
        </div>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-150 ${sizeStyles[size]} ${onClick ? 'cursor-pointer hover:border-primary-300 hover:shadow-md' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        {icon && (
          <div
            className={`flex shrink-0 items-center justify-center bg-primary-50 text-primary-500 ${iconTile[size]}`}
          >
            <span className={iconSize[size]}>{icon}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <p className="truncate text-caption font-medium uppercase tracking-wide text-neutral-500">
              {title}
            </p>
          )}
          {value != null && (
            <p className={`mt-0.5 font-semibold tracking-tight text-neutral-900 tabular-nums ${valueSizes[size]}`}>
              {value}
            </p>
          )}
        </div>
        {trend && (
          <div className={`flex shrink-0 items-center gap-1 text-label font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d={trend.positive
                  ? 'M6 2L10 7H2L6 2Z'
                  : 'M6 10L2 5H10L6 10Z'
                }
                fill="currentColor"
              />
            </svg>
            {trend.value}
          </div>
        )}
      </div>
      {subtitle && (
        <p className="mt-2.5 text-caption text-neutral-400">{subtitle}</p>
      )}
    </div>
  );
};
