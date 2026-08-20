import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

/* ── Props ──────────────────────────────────────────────────────────── */

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Label displayed to the right */
  label?: ReactNode;
  /** Radio size */
  size?: 'sm' | 'md';
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      size = 'md',
      disabled = false,
      className = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const radioId = externalId ?? generatedId;
    const outerSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    const innerSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

    return (
      <label
        htmlFor={radioId}
        className={`
          inline-flex items-start gap-3 cursor-pointer select-none
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          ${className}
        `}
      >
        {/* Hidden native radio */}
        <input
          ref={ref}
          type="radio"
          id={radioId}
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />

        {/* Custom radio visual.
            NOTE: `peer-checked:` compiles to the general-sibling selector
            `:is(:where(.peer):checked~*)`, which only reaches elements that are
            DIRECT SIBLINGS of the hidden input. The inner dot is a child of this
            circle, so the checked-state control lives here on the circle (the
            sibling) via an arbitrary child selector (`[&>span]:`), which reaches
            the dot. Putting `peer-checked:scale-100` directly on the dot would
            never match — the checked radio previously showed a blue border with
            no dot. */}
        <span
          className={`
            ${outerSize} mt-0.5 shrink-0 rounded-full border-2
            flex items-center justify-center
            transition-all duration-150
            border-neutral-300 peer-hover:border-neutral-400
            peer-checked:border-primary-500
            peer-checked:[&>span]:scale-100
            peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/30 peer-focus-visible:ring-offset-1
            peer-disabled:border-neutral-200
          `}
          aria-hidden="true"
        >
          {/* Inner dot */}
          <span
            className={`
              ${innerSize} rounded-full bg-primary-500
              scale-0
              transition-transform duration-150
            `}
          />
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

Radio.displayName = 'Radio';
