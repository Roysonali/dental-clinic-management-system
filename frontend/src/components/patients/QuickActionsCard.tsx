import type { FC } from 'react';
import { Pencil, UserCheck, UserX, Zap } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import type { PatientResponse } from '../../types/patient';

interface QuickActionsCardProps {
  patient: PatientResponse;
  onEdit: () => void;
  onToggleStatus: () => void;
}

/**
 * QuickActionsCard — common one-click actions for the Overview tab.
 * (Schedule Appointment / Create Invoice will be added when those modules
 * are wired to the frontend.)
 */
export const QuickActionsCard: FC<QuickActionsCardProps> = ({
  patient,
  onEdit,
  onToggleStatus,
}) => {
  const isActive = patient.is_active;

  return (
    <Card>
      <Card.Header title="Quick Actions" icon={<Icon icon={Zap} size="md" className="text-primary-500" />} />
      <Card.Body>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} leftIcon={<Icon icon={Pencil} size="sm" />}>
            Edit Details
          </Button>
          <Button
            size="sm"
            variant={isActive ? 'danger' : 'success'}
            onClick={onToggleStatus}
            leftIcon={<Icon icon={isActive ? UserX : UserCheck} size="sm" />}
          >
            {isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};
