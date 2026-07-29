import type { FC } from 'react';

interface DividerProps {
  className?: string;
}

/**
 * Horizontal divider line for separating sections.
 */
export const Divider: FC<DividerProps> = ({ className = '' }) => (
  <hr
    className={`border-t border-neutral-200 ${className}`}
    role="separator"
    aria-orientation="horizontal"
  />
);
