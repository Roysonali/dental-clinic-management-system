import type { FC } from 'react';
import { Avatar } from '../common/Avatar/Avatar';

export type PatientAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Derive up-to-two initials from a full name (e.g. "Juan Dela Cruz" → "JD"). */
function getPatientInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PatientAvatarProps {
  /** Patient's full name (used for initials + alt text) */
  fullName: string;
  /** Optional photo URL */
  src?: string;
  /** Size variant */
  size?: PatientAvatarSize;
  /** Additional classes */
  className?: string;
}

/**
 * PatientAvatar — avatar with initials derived from the patient's full name.
 * Reuses the shared Avatar primitive; falls back to initials when no photo
 * exists (the backend has no photo field, so initials are the default).
 */
export const PatientAvatar: FC<PatientAvatarProps> = ({
  fullName,
  src,
  size = 'md',
  className = '',
}) => {
  return (
    <Avatar
      src={src}
      initials={getPatientInitials(fullName)}
      alt={fullName}
      size={size}
      className={className}
    />
  );
};
