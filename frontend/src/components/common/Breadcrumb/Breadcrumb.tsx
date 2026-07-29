import { useState, type FC, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Icon } from '../Icon/Icon';

interface BreadcrumbItem {
  /** Page label */
  label: string;
  /** Optional href — omit for current page */
  href?: string;
  /** Optional icon */
  icon?: ReactNode;
}

interface BreadcrumbProps {
  /** Ordered list of breadcrumb items (last = current page) */
  items: BreadcrumbItem[];
  /** Custom separator icon/component */
  separator?: ReactNode;
  /** Maximum number of items before truncation (0 = no truncation) */
  maxItems?: number;
  /** Additional classes */
  className?: string;
}

/**
 * Breadcrumb — hierarchical page navigation.
 * Last item represents the current page (aria-current="page").
 * Supports responsive truncation for long paths (single ellipsis).
 *
 * @example
 * ```tsx
 * <Breadcrumb
 *   items={[
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Patients', href: '/patients' },
 *     { label: 'Juan Dela Cruz' },
 *   ]}
 * />
 * ```
 */
export const Breadcrumb: FC<BreadcrumbProps> = ({
  items,
  separator = <Icon icon={ChevronRight} size="sm" className="text-neutral-400" />,
  maxItems = 0,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const shouldTruncate = !expanded && maxItems > 0 && items.length > maxItems;
  const threshold = Math.floor((maxItems - 1) / 2);

  // Build visible items with single ellipsis marker
  const displayItems: (BreadcrumbItem & { key: number; isEllipsis?: boolean })[] = [];

  if (shouldTruncate) {
    // First item
    displayItems.push({ ...items[0], key: 0 });
    // Ellipsis
    displayItems.push({ label: '', key: -1, isEllipsis: true });
    // Last items
    for (let i = items.length - threshold; i < items.length; i++) {
      displayItems.push({ ...items[i], key: i });
    }
  } else {
    items.forEach((item, i) => displayItems.push({ ...item, key: i }));
  }

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-1">
        {displayItems.map((item, displayIndex) => (
          <li key={item.isEllipsis ? 'ellipsis' : item.key} className="flex items-center gap-1 min-w-0">
            {displayIndex > 0 && <span className="shrink-0">{separator}</span>}

            {item.isEllipsis ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-body-sm text-neutral-400 hover:text-neutral-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded px-1"
                aria-label="Show more breadcrumbs"
              >
                ...
              </button>
            ) : (
              <>
                {item.icon && (
                  <span className="shrink-0 text-neutral-400">{item.icon}</span>
                )}
                {item.href && item.key !== items.length - 1 ? (
                  <a
                    href={item.href}
                    className="truncate text-body-sm text-neutral-500 hover:text-neutral-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    className="truncate text-body-sm font-medium text-neutral-900"
                    aria-current={item.key === items.length - 1 ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
