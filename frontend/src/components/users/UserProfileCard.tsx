import type { FC } from 'react';
import { User } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { USER_STATUS_LABELS } from '../../constants/user';
import type { UserDetailResponse } from '../../types/user';

interface UserProfileCardProps {
  /** Full user record returned by GET /users/{user_id} */
  user: UserDetailResponse;
}

/**
 * UserProfileCard — identity and access information for the user details
 * page. Fields map 1:1 to backend `UserDetailResponse` (no invented
 * information).
 *
 * NOTE: the backend has no `username` or `phone` fields — the OAuth2
 * login identifier is `email` — so neither is shown here.
 */
export const UserProfileCard: FC<UserProfileCardProps> = ({ user }) => {
  return (
    <Card>
      <Card.Header
        title="User Information"
        icon={<Icon icon={User} size="md" className="text-primary-500" />}
      />
      <Card.Body>
        <DescriptionList
          layout="horizontal"
          columns={2}
          items={[
            { label: 'Full Name', value: user.full_name },
            { label: 'Email', value: user.email },
            {
              label: 'Role',
              value: user.role_name ? (
                <Badge variant="info" size="sm">
                  {user.role_name}
                </Badge>
              ) : (
                '—'
              ),
            },
            {
              label: 'Status',
              value: (
                <StatusBadge
                  status={user.status}
                  label={USER_STATUS_LABELS[user.status]}
                  size="sm"
                />
              ),
            },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
