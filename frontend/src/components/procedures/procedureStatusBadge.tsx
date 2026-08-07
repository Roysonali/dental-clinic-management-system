import type { FC } from 'react';
import { Badge } from '../common/Badge/Badge';
import type { BadgeVariant } from '../common/Badge/badge.types';

/**
 * ProcedureStatusBadge — active/inactive indicator for the procedure
 * catalog ([MAP §7.2]). Plain Badge (not StatusBadge) keeps the mapping
 * explicit and local.
 */
export const ProcedureStatusBadge: FC<{
  isActive: boolean;
  size?: 'xs' | 'sm' | 'md';
}> = ({ isActive, size = 'sm' }) => {
  const variant: BadgeVariant = isActive ? 'success' : 'neutral';
  return (
    <Badge variant={variant} size={size}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
};
