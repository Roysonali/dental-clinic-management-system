import type { FC } from 'react';
import { Fingerprint } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { DescriptionList } from '../common/DescriptionList/DescriptionList';
import { Icon } from '../common/Icon/Icon';
import { formatISODate } from '../../utils/date';
import type { UserDetailResponse } from '../../types/user';

interface UserAccountCardProps {
  /** Full user record returned by GET /users/{user_id} */
  user: UserDetailResponse;
}

/**
 * UserAccountCard — account metadata returned by the backend
 * (`UserDetailResponse` audit fields). Fields map 1:1 to the API; null
 * values render as '—' (no derived calculations).
 *
 * NOTE: `created_by` / `updated_by` are admin ids (not names) — the
 * backend does not join user identities, so the raw ids are shown.
 */
export const UserAccountCard: FC<UserAccountCardProps> = ({ user }) => {
  return (
    <Card>
      <Card.Header
        title="Account Information"
        icon={<Icon icon={Fingerprint} size="md" className="text-primary-500" />}
      />
      <Card.Body>
        <DescriptionList
          layout="horizontal"
          columns={2}
          items={[
            { label: 'User ID', value: String(user.id) },
            { label: 'Created Date', value: formatISODate(user.created_at) },
            { label: 'Updated Date', value: formatISODate(user.updated_at) },
            { label: 'Last Login', value: formatISODate(user.last_login_at) },
            {
              label: 'Created By',
              value: user.created_by != null ? String(user.created_by) : '—',
            },
            {
              label: 'Updated By',
              value: user.updated_by != null ? String(user.updated_by) : '—',
            },
          ]}
        />
      </Card.Body>
    </Card>
  );
};
