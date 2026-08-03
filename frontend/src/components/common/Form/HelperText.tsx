import type { FC, ReactNode } from 'react';

interface HelperTextProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * Helper/description text shown below form fields.
 * Provides contextual guidance without error styling.
 *
 * @example
 * ```tsx
 * <HelperText id="email-helper">We'll never share your email.</HelperText>
 * ```
 */
export const HelperText: FC<HelperTextProps> = ({
  children,
  id,
  className = '',
}) => {
  if (!children) return null;

  return (
    <p id={id} className={`text-caption text-neutral-500 ${className}`}>
      {children}
    </p>
  );
};
