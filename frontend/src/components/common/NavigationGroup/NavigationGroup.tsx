import { useState, type FC, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface NavigationGroupProps {
  /** Group heading/title */
  title?: string;
  /** Navigation items (NavLink-style children) */
  children?: ReactNode;
  /** Collapsible group */
  collapsible?: boolean;
  /** Default expanded */
  defaultExpanded?: boolean;
  /** Badge count displayed next to heading */
  badge?: string | number;
  /** Additional classes */
  className?: string;
}

/**
 * NavigationGroup — groups navigation links under a heading.
 * Designed for future Sidebar integration.
 * Supports collapsible groups with badge counters.
 *
 * @example
 * ```tsx
 * <NavigationGroup title="Clinical" collapsible badge={3}>
 *   <a href="/patients">Patients</a>
 *   <a href="/appointments">Appointments</a>
 *   <a href="/treatment-plans">Treatment Plans</a>
 * </NavigationGroup>
 * ```
 */
export const NavigationGroup: FC<NavigationGroupProps> = ({
  title,
  children,
  collapsible = false,
  defaultExpanded = true,
  badge,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const heading = (
    <div className="flex items-center justify-between px-3 py-2">
      {title && (
        <span className="text-caption font-semibold uppercase tracking-wider text-neutral-400">
          {title}
        </span>
      )}
      <div className="flex items-center gap-1">
        {badge != null && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-neutral-200 px-1.5 text-caption font-medium text-neutral-600">
            {badge}
          </span>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={expanded ? 'Collapse group' : 'Expand group'}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
            />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={className}>
      {heading}
      {(!collapsible || expanded) && children && (
        <div className="flex flex-col">{children}</div>
      )}
    </div>
  );
};
