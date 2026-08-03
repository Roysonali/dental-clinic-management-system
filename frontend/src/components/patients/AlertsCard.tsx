import type { FC } from 'react';
import { Bell } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { EmptyState } from '../common/EmptyState/EmptyState';

/**
 * AlertsCard — active patient alerts.
 *
 * The backend Patient module exposes no alerts endpoint; this card is an
 * empty-state placeholder ready to be wired to the Records module.
 */
export const AlertsCard: FC = () => {
  return (
    <Card>
      <Card.Header title="Active Alerts" icon={<Icon icon={Bell} size="md" className="text-warning" />} />
      <Card.Body>
        <EmptyState
          title="No active alerts"
          description="Alerts from the patient's records will appear here."
        />
      </Card.Body>
    </Card>
  );
};
