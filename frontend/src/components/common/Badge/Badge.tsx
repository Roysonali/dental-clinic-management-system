import type { FC } from 'react';
import { X } from 'lucide-react';
import type { BadgeProps, BadgeVariant, BadgeSize } from './badge.types';
import { Icon } from '../Icon/Icon';

/* ── Style Maps ───────────────────────────────────────────────────────── */

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200/60',
  secondary: 'bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200/60',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/60',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/60',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/60',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200/60',
  neutral: 'bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200/60',
  outline: 'bg-transparent text-neutral-600 border border-neutral-300',
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-small gap-0.5',
  sm: 'px-2 py-0.5 text-caption gap-1',
  md: 'px-2.5 py-1 text-label gap-1',
};

const dotSizes: Record<BadgeSize, string> = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
};

const dotColors: Record<BadgeVariant, string> = {
  primary: 'bg-primary-500',
  secondary: 'bg-neutral-500',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral-400',
  outline: 'bg-neutral-400',
};

/* ── Component ────────────────────────────────────────────────────────── */

export const Badge: FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: IconComponent,
  dot = false,
  removable = false,
  onRemove,
  className = '',
}) => {
  if (dot) {
    return (
      <span
        className={`inline-block shrink-0 rounded-full ${dotSizes[size]} ${dotColors[variant]}`}
        aria-label={typeof children === 'string' ? children : undefined}
      />
    );
  }

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        transition-colors duration-150
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${removable ? 'pr-1' : ''}
        ${className}
      `}
    >
      {IconComponent && (
        <Icon icon={IconComponent} size={size === 'xs' ? 'xs' : 'sm'} />
      )}
      <span>{children}</span>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Remove"
        >
          <Icon icon={X} size="xs" />
        </button>
      )}
    </span>
  );
};
