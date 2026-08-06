import type { FC, ReactNode } from 'react';
import type { BadgeProps } from '../Badge';
import { Badge } from '../Badge';

interface PageHeaderProps {
  /** Page title */
  title?: string;
  /** Subtitle / description */
  subtitle?: string;
  /** Breadcrumb navigation slot (accepts any ReactNode) */
  breadcrumbs?: ReactNode;
  /** Actions rendered at the right (desktop) or below (mobile) */
  actions?: ReactNode;
  /** Optional status badge */
  status?: { label: string; variant: BadgeProps['variant'] };
  /** Additional classes */
  className?: string;
}

/**
 * PageHeader — reusable page header for every module.
 * Responsively stacks actions below title on mobile.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Patients"
 *   subtitle="Manage patient records"
 *   actions={<Button>Add Patient</Button>}
 * />
 * ```
 */
export const PageHeader: FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  status,
  className = '',
}) => {
  return (
    <div className={`mb-6 lg:mb-8 ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs && (
        <div className="mb-3">{breadcrumbs}</div>
      )}

      {/* Title Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {title && (
              <h1 className="text-h1 font-semibold tracking-tight text-neutral-900 truncate">
                {title}
              </h1>
            )}
            {status && (
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-body text-neutral-500">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
