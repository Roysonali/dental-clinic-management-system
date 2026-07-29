import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from 'react';

/* ── Props ──────────────────────────────────────────────────────────── */

interface CheckboxProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'size'
  > {
  /** Label text displayed to the right of the checkbox */
  label?: ReactNode;
  /** Whether the field is in an error state */
  error?: boolean;
  /** Checkbox size */
  size?: 'sm' | 'md';
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error = false,
      size = 'md',
      disabled = false,
      className = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const checkboxId = externalId ?? generatedId;

    const boxSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

    return (
      <label
        htmlFor={checkboxId}
        className={`
          inline-flex items-start gap-3 cursor-pointer select-none
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          ${className}
        `}
      >
        {/* Hidden native checkbox (for accessibility & form integration) */}
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          disabled={disabled}
          aria-invalid={error}
          className="peer sr-only"
          {...rest}
        />

        {/* Custom checkbox visual */}
        <span
          className={`
            ${boxSize} mt-0.5 shrink-0 rounded border-2
            flex items-center justify-center
            transition-all duration-150
            ${
              error
                ? 'border-danger'
                : 'border-neutral-300 peer-hover:border-neutral-400'
            }
            peer-checked:border-primary-500 peer-checked:bg-primary-500
            peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/30 peer-focus-visible:ring-offset-1
          `}
          aria-hidden="true"
        >
          {/* Checkmark icon */}
          <svg
            className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-150"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        {/* Label */}
        {label && (
          <span className="text-body text-neutral-700 leading-5">
            {label}
          </span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
