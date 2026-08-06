import type { FC } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import { USER_STATUS_LABELS } from '../../constants/user';
import type { UserDetailResponse } from '../../types/user';

interface UserStatusCardProps {
  /** Full user record returned by GET /users/{user_id} */
  user: UserDetailResponse;
}

/**
 * UserStatusCard — lifecycle summary: current status and current role.
 * Displays backend values only; no derived calculations.
 */
export const UserStatusCard: FC<UserStatusCardProps> = ({ user }) => {
  return (
    <Card>
      <Card.Header
        title="Status"
        icon={<Icon icon={ShieldCheck} size="md" className="text-primary-500" />}
      />
      <Card.Body>
        <DescriptionList
          layout="horizontal"
          columns={1}
          items={[
            {
              label: 'Current Status',
              value: (
                <StatusBadge
                  status={user.status}
                  label={USER_STATUS_LABELS[user.status]}
                  size="sm"
                />
              ),
            },
            {
              label: 'Current Role',
              value: user.role_name ? (
                <Badge variant="info" size="sm">
                  {user.role_name}
                </Badge>
              ) : (
                '—'
              ),
            },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
