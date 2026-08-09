import type { FC } from 'react';
import { MobileCard } from '../../../layouts/components/mobile/MobileCard';
import { StatusBadge } from '../../common/StatusBadge/StatusBadge';
import { Badge } from '../../common/Badge/Badge';
import { USER_STATUS_LABELS } from '../../../constants/user';
import { formatISODate } from '../../../utils/date';
import { getInitials } from '../../../utils/formatting';
import type { UserListItem } from '../../../types/user';

interface MobileUserCardProps {
  user: UserListItem;
  /** Navigates to the user detail page. */
  onClick?: () => void;
}

/**
 * MobileUserCard — mobile presentation of a user row (reference card
 * language: name + status pill, avatar, muted email line, divider, footer
 * with role badge + last login).
 */
export const MobileUserCard: FC<MobileUserCardProps> = ({ user, onClick }) => {
  return (
    <MobileCard onClick={onClick} ariaLabel={`View ${user.full_name}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          {/* Span-based avatar (a <div> would be invalid inside the card's <button>). */}
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-label font-semibold text-primary-700"
          >
            {getInitials(user.full_name)}
          </span>
          <span className="min-w-0 truncate text-lg font-semibold text-neutral-900">
            {user.full_name}
          </span>
        </span>
        <StatusBadge
          status={user.status}
          label={USER_STATUS_LABELS[user.status]}
          size="sm"
        />
      </span>

      <span className="mt-3 block truncate text-sm text-neutral-500">{user.email}</span>

      <span className="my-4 block h-px w-full bg-neutral-100" />

      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          {user.role_name ? (
            <Badge variant="info" size="sm">
              {user.role_name}
            </Badge>
          ) : (
            <span className="text-sm text-neutral-400">—</span>
          )}
        </span>
        <span className="shrink-0 text-sm text-neutral-500">
          {user.last_login_at ? `Last login ${formatISODate(user.last_login_at)}` : 'Never logged in'}
        </span>
      </span>
    </MobileCard>
  );
};
