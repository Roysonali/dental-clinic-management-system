import type { FC } from 'react';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import type { BadgeSize } from '../common/Badge';

interface PatientStatusBadgeProps {
  /** Patient active flag */
  active: boolean;
  /** Badge size */
  size?: BadgeSize;
  /** Additional classes */
  className?: string;
}

/**
 * PatientStatusBadge — renders the patient's active/inactive lifecycle state
 * using the shared StatusBadge (maps to the design-system Badge variants).
 */
export const PatientStatusBadge: FC<PatientStatusBadgeProps> = ({
  active,
  size = 'sm',
  className = '',
}) => {
  return (
    <StatusBadge
      status={active ? 'active' : 'inactive'}
      label={active ? 'Active' : 'Inactive'}
      size={size}
      className={className}
    />
  );
};
