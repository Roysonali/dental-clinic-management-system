import { forwardRef } from 'react';
import type { ButtonProps, ButtonVariant, ButtonSize } from './button.types';

/* ── Style Maps ─────────────────────────────────────────────────────── */

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white shadow-sm hover:bg-primary-600 hover:shadow active:bg-primary-700 focus-visible:ring-primary-500/30 disabled:bg-primary-200 disabled:shadow-none',
  secondary:
    'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-primary-500/20 disabled:text-neutral-300 disabled:border-neutral-200',
  outline:
    'bg-transparent text-primary-600 border border-primary-300 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary-500/20 disabled:text-neutral-300 disabled:border-neutral-200',
  ghost:
    'bg-transparent text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-primary-500/20 disabled:text-neutral-300',
  danger:
    'bg-danger text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500/30 disabled:bg-red-300',
  success:
    'bg-success text-white hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-success/30 disabled:bg-emerald-300',
  link:
    'bg-transparent text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline focus-visible:ring-primary-500/20 disabled:text-neutral-300 p-0 h-auto min-w-0',
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-button-sm rounded-md gap-1',
  sm: 'h-8 px-3 text-button-sm rounded-md gap-1.5',
  md: 'h-10 px-4 text-button rounded-lg gap-2',
  lg: 'h-12 px-6 text-button rounded-lg gap-2.5',
  xl: 'h-14 px-8 text-h4 rounded-xl gap-3',
};

const iconOnlySize: Record<ButtonSize, string> = {
  xs: 'h-7 w-7 p-0',
  sm: 'h-8 w-8 p-0',
  md: 'h-10 w-10 p-0',
  lg: 'h-12 w-12 p-0',
  xl: 'h-14 w-14 p-0',
};

/* ── Loading Spinner ─────────────────────────────────────────────────-- */

function LoadingSpinner() {
  return (
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
  );
}

/* ── Component ──────────────────────────────────────────────────────── */

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      iconOnly = false,
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
          inline-flex items-center justify-center whitespace-nowrap font-medium
          transition-all duration-150
          focus-visible:outline-none focus-visible:ring-2
          cursor-pointer select-none
          ${variantStyles[variant]}
          ${iconOnly ? iconOnlySize[size] : sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${isDisabled ? 'cursor-not-allowed' : ''}
          ${className}
        `}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? (
          <LoadingSpinner />
        ) : (
          leftIcon
        )}

        {!iconOnly && children}

        {!loading && !iconOnly && rightIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';
