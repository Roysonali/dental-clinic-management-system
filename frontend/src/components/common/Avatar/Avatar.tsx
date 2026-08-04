import { useState, type FC } from 'react';

/* ── Types ────────────────────────────────────────────────────────── */

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type AvatarStatus = 'online' | 'offline' | 'busy';

export interface AvatarProps {
  /** Image URL (if omitted, initials or fallback icon is shown) */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Initials to display when no image is available (e.g. "AD") */
  initials?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Status indicator dot */
  status?: AvatarStatus;
  /** Additional classes */
  className?: string;
}

/* ── Size maps ──────────────────────────────────────────────────────── */

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-caption',
  sm: 'h-7 w-7 text-label',
  md: 'h-8 w-8 text-label font-semibold',
  lg: 'h-10 w-10 text-body font-semibold',
  xl: 'h-12 w-12 text-body-lg font-semibold',
};

const statusSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-1.5 w-1.5 ring-1',
  sm: 'h-2 w-2 ring-1',
  md: 'h-2.5 w-2.5 ring-2',
  lg: 'h-3 w-3 ring-2',
  xl: 'h-3.5 w-3.5 ring-2',
};

const statusColorClasses: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-neutral-300',
  busy: 'bg-amber-500',
};

/* ── Component ──────────────────────────────────────────────────────── */

export const Avatar: FC<AvatarProps> = ({
  src,
  alt = '',
  initials,
  size = 'md',
  status,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const showImg = !!src && !imgError;

  const baseClasses = `
    relative inline-flex shrink-0 items-center justify-center rounded-full
    bg-primary-100 text-primary-700 overflow-hidden
    ${sizeClasses[size]}
    ${className}
  `;

  return (
    <div className={baseClasses} role="img" aria-label={alt || initials || 'User avatar'}>
      {showImg && (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
      {(!src || imgError) && (
        <span className="select-none">{initials ?? '?'}</span>
      )}

      {/* Status indicator */}
      {status && (
        <span
          className={`
            absolute -bottom-0.5 -right-0.5 rounded-full
            ring-white
            ${statusSizeClasses[size]}
            ${statusColorClasses[status]}
          `}
          aria-label={status}
        />
      )}
    </div>
  );
};
