import type { FC } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import type { Toast, ToastVariant } from './toast.types';
import { Icon } from '../Icon/Icon';

/* ── Variant maps ──────────────────────────────────────────────────── */

const iconMap: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
};

const styleMap: Record<ToastVariant, string> = {
  info: 'border-l-info bg-info/5',
  success: 'border-l-success bg-success/5',
  warning: 'border-l-warning bg-warning/5',
  danger: 'border-l-danger bg-danger/5',
};

const colorMap: Record<ToastVariant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

/* ── Component ──────────────────────────────────────────────────────── */

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export const ToastItem: FC<ToastProps> = ({ toast, onDismiss }) => {
  const ToastIcon = toast.icon ?? iconMap[toast.variant];

  return (
    <div
      className={`
        flex items-start gap-3 rounded-lg border border-l-4 bg-white p-4 shadow-lg
        transition-all duration-300
        ${styleMap[toast.variant]}
        ${toast.exiting ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <Icon icon={ToastIcon} size="md" className={colorMap[toast.variant]} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-body-sm font-semibold text-neutral-900">
            {toast.title}
          </p>
        )}
        {toast.description && (
          <p className="text-body-sm text-neutral-600 mt-0.5">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <div className="mt-2">{toast.action}</div>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label="Dismiss notification"
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  );
};
