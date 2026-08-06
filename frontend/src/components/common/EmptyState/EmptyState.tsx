import type { FC, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Icon } from '../Icon/Icon';

interface EmptyStateProps {
  /** Icon or illustration component */
  icon?: LucideIcon;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  primaryAction?: ReactNode;
  /** Secondary action button */
  secondaryAction?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * EmptyState — displayed when there is no data to show.
 * Works for any empty list: patients, appointments, invoices, search results.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={SearchX}
 *   title="No results found"
 *   description="Try adjusting your search or filters."
 *   primaryAction={<Button>Clear filters</Button>}
 * />
 * ```
 */
export const EmptyState: FC<EmptyStateProps> = ({
  icon: IconComponent = Inbox,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="status"
    >
      {/* Icon */}
      <div className="relative mb-5">
        <div className="absolute -inset-3 rounded-full bg-primary-50/60" aria-hidden="true" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-100 bg-white shadow-sm">
          <Icon
            icon={IconComponent}
            size="xl"
            className="text-primary-400"
          />
        </div>
      </div>

      {/* Title */}
      {title && (
        <h3 className="text-h3 font-semibold tracking-tight text-neutral-900">{title}</h3>
      )}

      {/* Description */}
      {description && (
        <p className="mt-1.5 max-w-sm text-body text-neutral-500">
          {description}
        </p>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
