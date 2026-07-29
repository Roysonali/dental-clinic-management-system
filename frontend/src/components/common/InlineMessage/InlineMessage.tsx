import type { FC, ReactNode } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Icon } from '../Icon/Icon';

export type InlineMessageVariant = 'info' | 'success' | 'warning' | 'danger';

interface InlineMessageProps {
  /** Visual variant */
  variant?: InlineMessageVariant;
  /** Message content */
  children: ReactNode;
  /** Additional classes */
  className?: string;
}

/* ── Variant maps ──────────────────────────────────────────────────── */

const iconMap: Record<InlineMessageVariant, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
};

const styleMap: Record<InlineMessageVariant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

/**
 * InlineMessage — lightweight contextual message for use inside forms,
 * cards, or sections. Compact and non-intrusive.
 *
 * @example
 * ```tsx
 * <InlineMessage variant="info">
 *   Passwords must be at least 8 characters.
 * </InlineMessage>
 * ```
 */
export const InlineMessage: FC<InlineMessageProps> = ({
  variant = 'info',
  children,
  className = '',
}) => {
  if (!children) return null;

  return (
    <div
      className={`flex items-start gap-2 text-body-sm ${styleMap[variant]} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon icon={iconMap[variant]} size="sm" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
};
