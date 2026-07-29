import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

/* ── Variants ───────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

/* ── Props ──────────────────────────────────────────────────────────── */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

/* ── Style Maps ─────────────────────────────────────────────────────── */

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:ring-primary-500/30 disabled:bg-primary-200',
  secondary:
    'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 focus:ring-primary-500/20 disabled:text-neutral-300 disabled:border-neutral-200',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 focus:ring-primary-500/20 disabled:text-neutral-300',
  danger:
    'bg-danger text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500/30 disabled:bg-red-300',
  link: 'bg-transparent text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline focus:ring-primary-500/20 disabled:text-neutral-300 p-0 h-auto',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-button-sm rounded-md gap-1.5',
  md: 'h-10 px-4 text-button rounded-lg gap-2',
  lg: 'h-12 px-6 text-button rounded-lg gap-2.5',
};

/* ── Component ──────────────────────────────────────────────────────── */

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leadingIcon,
      trailingIcon,
      fullWidth = false,
      disabled = false,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-150
          focus:outline-none focus:ring-2
          cursor-pointer select-none
          ${variantStyles[variant]}
          ${sizeStyles[variant === 'link' ? 'md' : size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'cursor-not-allowed' : ''}
          ${className}
        `}
        {...rest}
      >
        {/* Loading Spinner (replaces leading icon when loading) */}
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          leadingIcon
        )}

        {children}

        {!loading && trailingIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
