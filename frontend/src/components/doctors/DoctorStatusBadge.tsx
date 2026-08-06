import type { FC } from 'react';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import type { BadgeSize } from '../common/Badge';

interface DoctorStatusBadgeProps {
  /** Doctor active flag */
  active: boolean;
  /** Badge size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
}

/**
 * DoctorStatusBadge — renders the doctor's active/inactive lifecycle
 * state using the shared StatusBadge.
 */
export const DoctorStatusBadge: FC<DoctorStatusBadgeProps> = ({
  active,
  size = 'sm',
  className = '',
}) => {
  return (
    <StatusBadge
      status={active ? 'active' : 'inactive'}
      label={active ? 'Active' : 'Inactive'}
      statusMap={{ active: 'success', inactive: 'danger' }}
      size={size}
      showDot
      className={className}
    />
  );
};
