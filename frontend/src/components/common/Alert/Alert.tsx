import type { FC } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, Bell, X } from 'lucide-react';
import type { AlertProps, AlertVariant } from './alert.types';
import { Icon } from '../Icon/Icon';

/* ── Variant styles ──────────────────────────────────────────────────── */

const variantStyles: Record<AlertVariant, string> = {
  info: 'bg-info/10 border-info/25 text-info',
  success: 'bg-success/10 border-success/25 text-success',
  warning: 'bg-warning/10 border-warning/25 text-warning',
  danger: 'bg-danger/10 border-danger/25 text-danger',
  neutral: 'bg-neutral-100 border-neutral-200 text-neutral-700',
};

const iconMap: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Bell,
};

/* ── Component ────────────────────────────────────────────────────────── */

export const Alert: FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
  icon,
  dismissible = false,
  actions,
  fullWidth = false,
  className = '',
  onDismiss,
}) => {
  const AlertIcon = icon ?? iconMap[variant];

  return (
    <div
      role="alert"
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
      className={`
        relative flex gap-3 rounded-lg border p-4
        transition-all duration-150
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <Icon icon={AlertIcon} size="md" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1">
        {title && (
          <p className="text-body-sm font-semibold">{title}</p>
        )}
        {description && (
          <p className="text-body-sm opacity-90">{description}</p>
        )}
        {actions && (
          <div className="mt-2 flex items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 self-start rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Dismiss"
        >
          <Icon icon={X} size="sm" />
        </button>
      )}
    </div>
  );
};
