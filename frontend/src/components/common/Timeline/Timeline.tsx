import type { FC, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../Icon/Icon';

interface TimelineItem {
  /** Icon component */
  icon?: LucideIcon;
  /** Icon/status color (Tailwind text color class) */
  iconColor?: string;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Timestamp string */
  timestamp?: string;
  /** Optional action/element rendered at the right */
  extra?: ReactNode;
}

interface TimelineProps {
  /** Array of timeline entries */
  items: TimelineItem[];
  /** Additional classes */
  className?: string;
  /** Whether this is the last item (removes tail line) — for manual use */
  isLast?: boolean;
}

/**
 * Timeline — vertical timeline for displaying chronological events.
 * Future modules (Billing Audit Logs, Patient History) will consume this.
 *
 * @example
 * ```tsx
 * <Timeline items={[
 *   { icon: FileText, title: 'Invoice issued', timestamp: '2 hours ago', description: 'INV-001 for $150.00' },
 *   { icon: DollarSign, title: 'Payment received', timestamp: '1 hour ago', description: '$150.00 via Card' },
 * ]} />
 * ```
 */
export const Timeline: FC<TimelineProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-0 ${className}`} role="list" aria-label="Timeline">
      {items.map((item, index) => (
        <TimelineEntry
          key={index}
          item={item}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
};

/* ── Single timeline entry ──────────────────────────────────────────── */

interface TimelineEntryProps {
  item: TimelineItem;
  isLast: boolean;
}

const TimelineEntry: FC<TimelineEntryProps> = ({ item, isLast }) => {
  return (
    <div className="relative flex gap-4 pb-6" role="listitem">
      {/* Line column */}
      <div className="flex flex-col items-center">
        {/* Icon circle */}
        <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white ${item.iconColor ?? 'border-neutral-300 text-neutral-400'}`}>
          {item.icon && (
            <Icon icon={item.icon} size="sm" className={item.iconColor} />
          )}
        </div>
        {/* Connector line */}
        {!isLast && (
          <div className="mt-1 w-0.5 flex-1 bg-neutral-200" aria-hidden="true" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-body-sm font-semibold text-neutral-900">
            {item.title}
          </p>
          {item.timestamp && (
            <span className="shrink-0 text-caption text-neutral-400">
              {item.timestamp}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 text-body-sm text-neutral-500">
            {item.description}
          </p>
        )}
        {item.extra && (
          <div className="mt-2">{item.extra}</div>
        )}
      </div>
    </div>
  );
};
