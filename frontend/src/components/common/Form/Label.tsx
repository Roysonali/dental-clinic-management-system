import type { FC, LabelHTMLAttributes, ReactNode } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Whether the field is required (shows *) */
  required?: boolean;
  /** Whether the field is optional (shows "Optional") */
  optional?: boolean;
  /** Extra element displayed at the right side of the label */
  extra?: ReactNode;
  /** Wrapped children override default rendering */
  children?: ReactNode;
}

/**
 * Reusable form label with required/optional indicators.
 *
 * @example
 * ```tsx
 * <Label htmlFor="email" required>Email address</Label>
 * <Label htmlFor="bio" optional>Bio</Label>
 * ```
 */
export const Label: FC<LabelProps> = ({
  required = false,
  optional = false,
  extra,
  children,
  className = '',
  ...rest
}) => {
  if (!children) return null;

  return (
    <div className="flex items-center justify-between">
      <label
        className={`text-label font-medium text-neutral-700 ${className}`}
        {...rest}
      >
        {children}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
        {!required && optional && (
          <span className="ml-1.5 text-caption font-normal text-neutral-400">
            (Optional)
          </span>
        )}
      </label>
      {extra}
    </div>
  );
};
