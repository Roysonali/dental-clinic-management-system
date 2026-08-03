import type { FC, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Icon } from '../Icon/Icon';

export type ResultVariant = 'success' | 'error' | 'warning' | 'info';

interface ResultStateProps {
  /** Outcome variant */
  variant?: ResultVariant;
  /** Main title */
  title?: string;
  /** Description text */
  description?: string;
  /** Action buttons rendered below description */
  actions?: ReactNode;
  /** Custom icon override */
  icon?: typeof CheckCircle;
  /** Additional classes */
  className?: string;
}

/* ── Variant maps ──────────────────────────────────────────────────── */

const iconMap: Record<ResultVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ResultVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};

const bgMap: Record<ResultVariant, string> = {
  success: 'bg-success/10',
  error: 'bg-danger/10',
  warning: 'bg-warning/10',
  info: 'bg-info/10',
};

/**
 * ResultState — full-page outcome display for operation results.
 *
 * @example
 * ```tsx
 * <ResultState
 *   variant="success"
 *   title="Patient created"
 *   description="The patient record has been saved."
 *   actions={<Button>View patient</Button>}
 * />
 * ```
 */
export const ResultState: FC<ResultStateProps> = ({
  variant = 'info',
  title,
  description,
  actions,
  icon: IconComponent,
  className = '',
}) => {
  const ResultIcon = IconComponent ?? iconMap[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-20 text-center ${className}`}
      role="status"
    >
      {/* Icon circle */}
      <div
        className={`mb-6 flex h-20 w-20 items-center justify-center rounded-full ${bgMap[variant]}`}
      >
        <Icon icon={ResultIcon} size="xl" className={colorMap[variant]} />
      </div>

      {/* Title */}
      {title && (
        <h2 className="text-h2 font-semibold text-neutral-900">{title}</h2>
      )}

      {/* Description */}
      {description && (
        <p className="mt-2 max-w-md text-body text-neutral-500">
          {description}
        </p>
      )}

      {/* Actions */}
      {actions && <div className="mt-8 flex items-center gap-3">{actions}</div>}
    </div>
  );
};
