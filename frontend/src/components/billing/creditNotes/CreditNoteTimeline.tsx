import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '../../common/Icon/Icon';

export interface CreditNoteTimelineItem {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  description?: string;
  timestamp?: string;
  isNotApplicable?: boolean;
}

interface CreditNoteTimelineProps {
  items: CreditNoteTimelineItem[];
  className?: string;
}

export const CreditNoteTimeline: FC<CreditNoteTimelineProps> = ({ items, className = '' }) => {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-0 ${className}`} role="list" aria-label="Credit note timeline">
      {items.map((item, index) => (
        <CreditNoteTimelineEntry key={index} item={item} isLast={index === items.length - 1} />
      ))}
    </div>
  );
};

interface CreditNoteTimelineEntryProps {
  item: CreditNoteTimelineItem;
  isLast: boolean;
}

const CreditNoteTimelineEntry: FC<CreditNoteTimelineEntryProps> = ({ item, isLast }) => {
  const markerClasses = item.isNotApplicable
    ? 'border-neutral-300 bg-white text-neutral-300'
    : item.iconColor
      ? item.iconColor
      : 'border-neutral-300 text-neutral-400';

  return (
    <div className="relative flex gap-4 pb-6" role="listitem">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${markerClasses}`}>
          {item.icon && !item.isNotApplicable && (
            <Icon icon={item.icon} size="sm" className={item.iconColor} />
          )}
        </div>
        {!isLast && (
          <div className="mt-1 w-0.5 flex-1 bg-neutral-200" aria-hidden="true" />
        )}
      </div>

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
      </div>
    </div>
  );
};
