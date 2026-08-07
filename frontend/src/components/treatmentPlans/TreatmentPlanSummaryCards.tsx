import type { FC } from 'react';
import { ClipboardList, Clock, FileCheck2, FileClock } from 'lucide-react';
import { StatCard } from '../common/StatCard/StatCard';
import { Icon } from '../common/Icon/Icon';
import type { DashboardSummaryResponse } from '../../types/treatmentPlan';

interface TreatmentPlanSummaryCardsProps {
  dashboard: DashboardSummaryResponse | undefined;
  loading: boolean;
}

/**
 * TreatmentPlanSummaryCards — S-01 stat row ([MAP §3.1]).
 *
 * Values come from GET /treatment-plans/dashboard (single source). The
 * pending-acknowledgment card is COUNT-ONLY: it intentionally has no click
 * target — the queue endpoints cover pending-review and pending-approval
 * only (O7, [MAP §11]).
 */
export const TreatmentPlanSummaryCards: FC<TreatmentPlanSummaryCardsProps> = ({
  dashboard,
  loading,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Icon icon={ClipboardList} size="lg" className="text-primary-500" />}
        title="Total Plans"
        value={dashboard?.total_plans ?? 0}
        subtitle="All treatment plans"
        loading={loading}
      />
      <StatCard
        icon={<Icon icon={Clock} size="lg" className="text-warning" />}
        title="Pending Review"
        value={dashboard?.pending_review ?? 0}
        subtitle="Awaiting review"
        loading={loading}
      />
      <StatCard
        icon={<Icon icon={FileCheck2} size="lg" className="text-info" />}
        title="Pending Approval"
        value={dashboard?.pending_approval ?? 0}
        subtitle="Proposed, unsigned"
        loading={loading}
      />
      <StatCard
        icon={<Icon icon={FileClock} size="lg" className="text-success" />}
        title="Pending Acknowledgment"
        value={dashboard?.pending_acknowledgment ?? 0}
        subtitle="Accepted, not acknowledged"
        loading={loading}
      />
    </div>
  );
};
