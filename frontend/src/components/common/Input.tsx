import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from 'react';

/* ── Types ──────────────────────────────────────────────────────────── */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label text shown above the input */
  label: string;
  /** Error message shown below the input */
  error?: string;
  /** Helper/description text shown below the input */
  helperText?: string;
  /** Optional icon rendered at the start (left) of the input */
  leadingIcon?: ReactNode;
  /** Optional icon/element rendered at the end (right) of the input */
  trailingIcon?: ReactNode;
  /** Whether the field is required (shows asterisk on label) */
  required?: boolean;
  /** Wrapper className override for layout */
  wrapperClassName?: string;
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leadingIcon,
      trailingIcon,
      required = false,
      disabled = false,
      className = '',
      wrapperClassName = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = externalId ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-label font-medium text-neutral-700"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Leading Icon */}
          {leadingIcon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leadingIcon}
            </div>
          )}

          {/* Input Element */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              [error ? errorId : null, helperText ? helperId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={`
              w-full rounded-lg border bg-white px-3 py-2.5 text-body text-neutral-800
              placeholder:text-neutral-400
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
              disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400
              ${leadingIcon ? 'pl-10' : ''}
              ${trailingIcon ? 'pr-10' : ''}
              ${
                error
                  ? 'border-danger focus:ring-danger/20 focus:border-danger'
                  : 'border-neutral-300 hover:border-neutral-400'
              }
              ${className}
            `}
            {...rest}
          />

          {/* Trailing Icon */}
          {trailingIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {trailingIcon}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p id={errorId} className="text-caption text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <p id={helperId} className="text-caption text-neutral-500">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
