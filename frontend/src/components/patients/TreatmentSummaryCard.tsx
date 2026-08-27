import { useNavigate } from 'react-router-dom';
import type { FC } from 'react';
import { ClipboardList } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Icon } from '../common/Icon/Icon';
import { Badge } from '../common/Badge/Badge';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { formatISODate } from '../../utils/date';
import { ROUTES } from '../../routes/routes';
import type { PatientSummaryTreatmentPlan } from '../../types/patient';

interface TreatmentSummaryCardProps {
  activeTreatmentPlans?: PatientSummaryTreatmentPlan[];
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  proposed: 'Proposed',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const TreatmentSummaryCard: FC<TreatmentSummaryCardProps> = ({
  activeTreatmentPlans = [],
}) => {
  const navigate = useNavigate();

  return (
    <Card>
      <Card.Header title="Treatment Plans" icon={<Icon icon={ClipboardList} size="md" className="text-info" />} />
      <Card.Body>
        {activeTreatmentPlans.length > 0 ? (
          <ul className="space-y-3">
            {activeTreatmentPlans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`)}
                  className="w-full text-left transition-colors duration-150 hover:bg-neutral-50 -mx-2 px-2 py-1.5 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-caption text-neutral-600">{plan.plan_code}</span>
                    <Badge variant="secondary" size="sm">
                      {PLAN_STATUS_LABELS[plan.status] ?? plan.status}
                    </Badge>
                  </div>
                  <p className="text-caption text-neutral-500 mt-0.5">
                    Created {formatISODate(plan.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No treatment plans"
            description="Active treatment plans for this patient will appear here."
          />
        )}
      </Card.Body>
    </Card>
  );
};
