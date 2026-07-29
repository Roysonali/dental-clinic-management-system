import type { FC, ReactNode } from 'react';

interface ErrorMessageProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

/**
 * Error message shown below form fields.
 * Uses `role="alert"` for screen reader announcement.
 *
 * @example
 * ```tsx
 * <ErrorMessage id="email-error">{errors.email?.message}</ErrorMessage>
 * ```
 */
export const ErrorMessage: FC<ErrorMessageProps> = ({
  children,
  id,
  className = '',
}) => {
  if (!children) return null;

  return (
    <p
      id={id}
      className={`text-caption text-danger ${className}`}
      role="alert"
    >
      {children}
    </p>
  );
};
