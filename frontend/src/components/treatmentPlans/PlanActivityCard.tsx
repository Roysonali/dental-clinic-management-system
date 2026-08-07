import type { FC } from 'react';
import { Activity, FilePlus2, GitCommitHorizontal, Stethoscope, UserCheck } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Timeline } from '../common/Timeline/Timeline';
import { formatISODate } from '../../utils/date';
import type { TreatmentPlanResponse } from '../../types/treatmentPlan';

interface PlanActivityCardProps {
  plan: TreatmentPlanResponse;
  className?: string;
}

/**
 * PlanActivityCard — S-12 partial "Plan Activity" timeline ([MAP §3.12]).
 *
 * Reconstructed from the fields the backend actually exposes (O11/R11):
 * plan creation, version snapshots, and approval events. There is NO
 * item-change / status-change event feed — those events have no endpoint,
 * so they are intentionally absent (U8).
 */
export const PlanActivityCard: FC<PlanActivityCardProps> = ({ plan, className = '' }) => {
  const events: Array<{
    icon: typeof Activity;
    title: string;
    timestamp: string;
    description?: string;
  }> = [];

  events.push({
    icon: FilePlus2,
    title: 'Plan created',
    timestamp: formatISODate(plan.created_at),
    description: plan.created_by != null ? `By user #${plan.created_by}` : undefined,
  });

  for (const version of [...plan.versions].sort((a, b) => a.version_number - b.version_number)) {
    events.push({
      icon: GitCommitHorizontal,
      title: `Version ${version.version_number} created`,
      timestamp: formatISODate(version.created_at),
      description: version.change_reason,
    });
  }

  if (plan.approval?.approved_at) {
    events.push({
      icon: Stethoscope,
      title: 'Doctor approved',
      timestamp: formatISODate(plan.approval.approved_at),
      description: plan.approval.approved_by != null ? `By user #${plan.approval.approved_by}` : undefined,
    });
  }

  if (plan.approval?.patient_acknowledged_at) {
    events.push({
      icon: UserCheck,
      title: 'Patient acknowledged',
      timestamp: formatISODate(plan.approval.patient_acknowledged_at),
      description: `Patient ${plan.approval.patient_status.replace(/_/g, ' ')}`,
    });
  }

  return (
    <Card className={className}>
      <Card.Header title="Plan Activity" subtitle="Reconstructed from available plan history" />
      <Card.Body>
        {events.length > 0 ? (
          <Timeline items={events.map((e) => ({ ...e, iconColor: 'text-primary-500 border-primary-200' }))} />
        ) : (
          <p className="text-body-sm text-neutral-500">No recorded activity for this plan.</p>
        )}
      </Card.Body>
    </Card>
  );
};
