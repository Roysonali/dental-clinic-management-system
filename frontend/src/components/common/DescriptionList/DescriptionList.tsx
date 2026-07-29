import type { FC, ReactNode } from 'react';

interface DescriptionListItem {
  /** Label / term */
  label: string;
  /** Value / description */
  value: ReactNode;
  /** Optional href for link values */
  href?: string;
}

interface DescriptionListProps {
  /** Array of label-value pairs */
  items: DescriptionListItem[];
  /** Layout direction */
  layout?: 'vertical' | 'horizontal';
  /** Number of columns (horizontal layout) */
  columns?: 1 | 2 | 3;
  /** Additional classes */
  className?: string;
}

/**
 * DescriptionList — key-value display for details pages.
 *
 * @example
 * ```tsx
 * <DescriptionList
 *   items={[
 *     { label: 'Full Name', value: 'Juan Dela Cruz' },
 *     { label: 'Email', value: 'juan@clinic.com' },
 *     { label: 'Status', value: <StatusBadge status="active" /> },
 *   ]}
 *   layout="horizontal"
 *   columns={2}
 * />
 * ```
 */
export const DescriptionList: FC<DescriptionListProps> = ({
  items,
  layout = 'vertical',
  columns = 1,
  className = '',
}) => {
  if (layout === 'horizontal') {
    const colClass = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : '';

    return (
      <dl className={`grid grid-cols-1 ${colClass} gap-x-6 gap-y-4 ${className}`}>
        {items.map((item, i) => (
          <div key={i} className="space-y-0.5">
            <dt className="text-caption font-medium text-neutral-500">{item.label}</dt>
            <dd className="text-body text-neutral-900">
              {item.href ? (
                <a href={item.href} className="text-primary-600 hover:text-primary-700 hover:underline transition-colors duration-150">
                  {item.value}
                </a>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className={`divide-y divide-neutral-100 ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
          <dt className="w-full shrink-0 text-caption font-medium text-neutral-500 sm:w-40">
            {item.label}
          </dt>
          <dd className="text-body text-neutral-900">
            {item.href ? (
              <a href={item.href} className="text-primary-600 hover:text-primary-700 hover:underline transition-colors duration-150">
                {item.value}
              </a>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};
