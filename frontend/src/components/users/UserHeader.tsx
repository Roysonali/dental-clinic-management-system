import type { FC, ReactNode } from 'react';
import { Mail } from 'lucide-react';
import { Avatar } from '../common/Avatar/Avatar';
import { Badge } from '../common/Badge/Badge';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { USER_STATUS_LABELS } from '../../constants/user';
import { getInitials } from '../../utils/formatting';
import type { UserDetailResponse } from '../../types/user';

interface UserHeaderProps {
  /** Full user record returned by GET /users/{user_id} */
  user: UserDetailResponse;
  /** Actions rendered on the right (Change Role, Activate/Deactivate) */
  actions?: ReactNode;
}

/**
 * UserHeader — details-page hero: avatar, identity, email, role and
 * lifecycle status badges, plus administrative actions.
 *
 * Badges map 1:1 to backend `UserDetailResponse` values: `role_name`
 * (Badge) and `status` (StatusBadge via USER_STATUS_LABELS).
 *
 * NOTE: there is no "username" — the backend has no username field
 * (email is the login identifier per the OAuth2 contract), so none is
 * fabricated here.
 */
export const UserHeader: FC<UserHeaderProps> = ({ user, actions }) => {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 items-start gap-4">
          <Avatar initials={getInitials(user.full_name)} alt={user.full_name} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-h2 font-semibold text-neutral-900">
                {user.full_name || `User #${user.id}`}
              </h1>
              <StatusBadge
                status={user.status}
                label={USER_STATUS_LABELS[user.status]}
                size="sm"
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {user.role_name ? (
                <Badge variant="info" size="sm">
                  {user.role_name}
                </Badge>
              ) : (
                <span className="text-body-sm text-neutral-400">No role assigned</span>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-body-sm text-neutral-600">
              <Mail size={14} aria-hidden="true" />
              <span className="sr-only">Email</span>
              <span className="font-medium text-neutral-800">{user.email}</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
