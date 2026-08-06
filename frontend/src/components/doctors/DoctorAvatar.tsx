import type { FC } from 'react';
import { Avatar } from '../common/Avatar/Avatar';
import { getInitials } from '../../utils/formatting';
import type { AvatarProps } from '../common/Avatar/Avatar';

interface DoctorAvatarProps {
  /** Doctor's full name (from the linked user; used for initials + alt) */
  fullName: string | null;
  /** Optional profile photo URL */
  src?: string | null;
  /** Size variant */
  size?: AvatarProps['size'];
  /** Additional classes */
  className?: string;
}

/**
 * DoctorAvatar — avatar with initials derived from the doctor's
 * user full name. Reuses the shared Avatar primitive; falls back to
 * initials when no photo exists.
 */
export const DoctorAvatar: FC<DoctorAvatarProps> = ({
  fullName,
  src,
  size = 'md',
  className = '',
}) => {
  return (
    <Avatar
      src={src ?? undefined}
      initials={getInitials(fullName)}
      alt={fullName ?? 'Doctor'}
      size={size}
      className={className}
    />
  );
};
