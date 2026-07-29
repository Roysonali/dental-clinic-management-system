import type { FC, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface SectionProps {
  /** Section title */
  title?: string;
  /** Description text */
  description?: string;
  /** Actions rendered at the right of the header */
  actions?: ReactNode;
  /** Show divider below header */
  divider?: boolean;
  /** Allow collapsing/expanding */
  collapsible?: boolean;
  /** Default expanded state (only applies when collapsible) */
  defaultExpanded?: boolean;
  /** Section content */
  children?: ReactNode;
  /** Additional classes */
  className?: string;
}

/**
 * Section — reusable content section for page composition.
 * Can optionally be collapsible.
 *
 * @example
 * ```tsx
 * <Section title="Patient Information" divider collapsible>
 *   <DescriptionList items={info} />
 * </Section>
 * ```
 */
export const Section: FC<SectionProps> = ({
  title,
  description,
  actions,
  divider = false,
  collapsible = false,
  defaultExpanded = true,
  children,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const headerContent = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {title && (
          <h3 className="text-h4 font-semibold text-neutral-900">{title}</h3>
        )}
        {description && (
          <p className="mt-0.5 text-body-sm text-neutral-500">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={expanded ? 'Collapse section' : 'Expand section'}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
            />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className={className}>
      {headerContent}

      {divider && <hr className="my-4 border-t border-neutral-200" role="separator" />}

      {(!collapsible || expanded) && children && (
        <div className={collapsible ? 'mt-4' : ''}>
          {children}
        </div>
      )}
    </section>
  );
};
