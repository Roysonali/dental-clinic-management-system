import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

/* ── Props ──────────────────────────────────────────────────────────── */

interface SwitchProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'size'
  > {
  /** Label displayed beside the switch */
  label?: ReactNode;
  /** Switch size */
  size?: 'sm' | 'md';
  /** Label position */
  labelPosition?: 'left' | 'right';
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      size = 'md',
      labelPosition = 'right',
      disabled = false,
      className = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const switchId = externalId ?? generatedId;

    const trackHeight = size === 'sm' ? 'h-5' : 'h-6';
    const trackWidth = size === 'sm' ? 'w-9' : 'w-11';
    const thumbSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
    const thumbTranslate = size === 'sm' ? 'peer-checked:translate-x-4' : 'peer-checked:translate-x-5';

    const inner = (
      <>
        {/* Hidden native checkbox (acts as switch) */}
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          id={switchId}
          disabled={disabled}
          className="peer sr-only"
          {...rest}
        />

        {/* Track */}
        <span
          className={`
            ${trackWidth} ${trackHeight} shrink-0 rounded-full
            flex items-center px-0.5
            transition-colors duration-150
            bg-neutral-300 peer-checked:bg-primary-500
            peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/30 peer-focus-visible:ring-offset-1
            peer-disabled:cursor-not-allowed peer-disabled:opacity-50
          `}
          aria-hidden="true"
        >
          {/* Thumb */}
          <span
            className={`
              ${thumbSize} rounded-full bg-white shadow-sm
              transition-transform duration-150
              ${thumbTranslate}
            `}
          />
        </span>
      </>
    );

    if (!label) {
      return <div className={`inline-flex items-center ${className}`}>{inner}</div>;
    }

    return (
      <label
        htmlFor={switchId}
        className={`
          inline-flex items-center gap-3 cursor-pointer select-none
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          ${labelPosition === 'left' ? 'flex-row-reverse justify-end' : ''}
          ${className}
        `}
      >
        {inner}
        <span className="text-body text-neutral-700 leading-5">{label}</span>
      </label>
    );
  },
);

Switch.displayName = 'Switch';
