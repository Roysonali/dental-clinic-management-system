import type { FC } from 'react';

export type SpinnerVariant = 'primary' | 'neutral' | 'white';
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  /** Center the spinner in its container */
  centered?: boolean;
  className?: string;
  /** Accessible label */
  label?: string;
}

/* ── Style Maps ──────────────────────────────────────────────────────── */

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const colorMap: Record<SpinnerVariant, string> = {
  primary: 'text-primary-500',
  neutral: 'text-neutral-500',
  white: 'text-white',
};

/* ── Component ────────────────────────────────────────────────────────── */

export const Spinner: FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  centered = false,
  className = '',
  label = 'Loading',
}) => {
  const svg = (
    <svg
      className={`animate-spin motion-reduce:animate-none ${sizeMap[size]} ${colorMap[variant]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
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

  if (centered) {
    return (
      <div className="flex w-full items-center justify-center py-8">
        {svg}
      </div>
    );
  }

  return svg;
};
