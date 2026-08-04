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
      <div className={`rounded-xl border border-neutral-200 bg-white ${sizeStyles[size]} ${className}`}>
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white ${sizeStyles[size]} ${onClick ? 'cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all duration-150' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: icon + text */}
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="mt-0.5 shrink-0">{icon}</div>
          )}
          <div className="min-w-0">
            {title && (
              <p className="text-body-sm font-medium text-neutral-500 truncate">{title}</p>
            )}
            {value && (
              <p className={`mt-1 font-semibold text-neutral-900 tabular-nums ${valueSizes[size]}`}>
                {value}
              </p>
            )}
            {subtitle && (
              <p className="mt-0.5 text-caption text-neutral-400">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: trend */}
        {trend && (
          <div className={`flex shrink-0 items-center gap-0.5 text-label font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}>
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
    </div>
  );
};
