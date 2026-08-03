import type { FC, ReactNode } from 'react';

/**
 * SectionHeader — heading row for a dashboard section.
 *
 * The `id` prop is used by the parent `<section aria-labelledby="...">` to
 * associate the heading with its section landmark for screen readers.
 *
 * @example
 * ```tsx
 * <SectionHeader id="statistics-heading" title="Statistics" action={<Button>View All</Button>} />
 * ```
 */
interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional id for aria-labelledby association */
  id?: string;
  /** Optional action rendered on the right */
  action?: ReactNode;
}

export const SectionHeader: FC<SectionHeaderProps> = ({ id, title, action }) => {
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="text-h3 font-semibold text-neutral-900">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
};
