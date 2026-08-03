import type { FC } from 'react';
import { Badge } from '../Badge';
import type { BadgeVariant, BadgeSize } from '../Badge';

/**
 * Default status-to-variant mapping for common DensCare domain statuses.
 * Consumers can override via the `statusMap` prop for custom enums.
 */
const defaultStatusMap: Record<string, BadgeVariant> = {
  active: 'success',
  inactive: 'neutral',
  pending: 'warning',
  completed: 'success',
  cancelled: 'danger',
  draft: 'neutral',
  finalized: 'primary',
  paid: 'success',
  unpaid: 'warning',
  overdue: 'danger',
  in_progress: 'info',
  on_hold: 'warning',
  approved: 'success',
  rejected: 'danger',
  submitted: 'info',
  confirmed: 'success',
  scheduled: 'info',
  arrived: 'success',
  'in-treatment': 'info',
  released: 'success',
  'no-show': 'danger',
  resolved: 'success',
  open: 'info',
  closed: 'neutral',
};

interface StatusBadgeProps {
  /** Status key (e.g. 'active', 'pending', 'paid') */
  status: string;
  /** Optional label override (defaults to prettified status key) */
  label?: string;
  /** Size passed through to Badge */
  size?: BadgeSize;
  /** Optional custom status-to-variant map */
  statusMap?: Record<string, BadgeVariant>;
  /** Additional classes */
  className?: string;
}

/**
 * StatusBadge — a Badge wrapper that maps domain status strings to
 * the appropriate Badge variant.
 *
 * @example
 * ```tsx
 * <StatusBadge status="active" />
 * <StatusBadge status="overdue" size="sm" />
 * <StatusBadge status="custom_status" statusMap={{ custom_status: 'info' }} />
 * ```
 */
export const StatusBadge: FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  statusMap,
  className = '',
}) => {
  const mergedMap = { ...defaultStatusMap, ...statusMap };
  const variant = mergedMap[status.toLowerCase()] ?? 'neutral';
  const displayLabel =
    label ??
    status
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant={variant} size={size} className={className}>
      {displayLabel}
    </Badge>
  );
};
