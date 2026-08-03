import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../../components/common/Icon/Icon';

/**
 * ActivityItem — single entry in the recent activity list.
 *
 * Placeholder component — no business logic, no real data.
 *
 * @example
 * ```tsx
 * <ActivityItem
 *   icon={UserPlus}
 *   iconColor="text-primary-500"
 *   title="New patient registered"
 *   description="Juan Dela Cruz"
 *   timestamp="5 min ago"
 * />
 * ```
 */
interface ActivityItemProps {
  /** Lucide icon for the activity type */
  icon: LucideIcon;
  /** Icon color class */
  iconColor?: string;
  /** Activity title */
  title: string;
  /** Activity description */
  description?: string;
  /** Relative timestamp */
  timestamp?: string;
}

export const ActivityItem: FC<ActivityItemProps> = ({
  icon,
  iconColor = 'text-primary-500',
  title,
  description,
  timestamp,
}) => {
  return (
    <div className="flex items-start gap-3 py-3">
      {/* Icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 ${iconColor}`}>
        <Icon icon={icon} size="sm" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium text-neutral-900">{title}</p>
        {description && (
          <p className="mt-0.5 text-body-sm text-neutral-500">{description}</p>
        )}
      </div>

      {/* Timestamp */}
      {timestamp && (
        <span className="shrink-0 text-caption text-neutral-400">{timestamp}</span>
      )}
    </div>
  );
};
