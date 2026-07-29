import {
  forwardRef,
  useId,
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

/* ── Props ──────────────────────────────────────────────────────────── */

interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Label displayed to the right */
  label?: ReactNode;
  /** Error state */
  error?: boolean;
  /** Checkbox size */
  size?: 'sm' | 'md';
  /** Indeterminate state (three-state checkbox) */
  indeterminate?: boolean;
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error = false,
      size = 'md',
      disabled = false,
      indeterminate = false,
      className = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const checkboxId = externalId ?? generatedId;
    const innerRef = useRef<HTMLInputElement | null>(null);

    const setRef = (element: HTMLInputElement | null) => {
      innerRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    };

    // Sync indeterminate state (DOM property, not attribute)
    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const boxSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

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
          ref={setRef}
          type="checkbox"
          id={checkboxId}
          disabled={disabled}
          aria-invalid={error}
          aria-checked={indeterminate ? 'mixed' : undefined}
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
          {/* Indeterminate dash */}
          {indeterminate ? (
            <svg
              className={`${iconSize} text-white`}
              viewBox="0 0 12 4"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="1"
                y="1.5"
                width="10"
                height="1"
                rx="0.5"
                fill="currentColor"
              />
            </svg>
          ) : (
            /* Checkmark icon */
            <svg
              className={`${iconSize} text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-150`}
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
          )}
        </span>

        {/* Label text */}
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
