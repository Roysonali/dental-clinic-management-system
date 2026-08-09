import type { FC } from 'react';
import { MobileCard } from '../../../layouts/components/mobile/MobileCard';
import { TreatmentPlanStatusBadge } from '../TreatmentPlanStatusBadge';
import { formatFee } from '../../../utils/formatting';
import { TREATMENT_PLAN_CURRENCY_SYMBOL } from '../../../constants/treatmentPlan';
import type { EnrichedTreatmentPlan } from '../../../types/treatmentPlan';

interface MobileTreatmentPlanCardProps {
  plan: EnrichedTreatmentPlan;
  /** Navigates to the plan detail page. */
  onClick?: () => void;
}

/**
 * MobileTreatmentPlanCard — mobile presentation of a treatment plan row
 * (reference card language: plan code + status pill, bold patient, muted
 * doctor line, divider, footer with item count + estimated cost). Cost uses
 * the module's existing ₱ display convention (same as the desktop table).
 */
export const MobileTreatmentPlanCard: FC<MobileTreatmentPlanCardProps> = ({ plan, onClick }) => {
  const patientName = plan.patient_name ?? `Patient #${plan.patient_id}`;
  const doctorName = plan.doctor_name ?? `Doctor #${plan.doctor_id}`;

  return (
    <MobileCard onClick={onClick} ariaLabel={`View ${plan.plan_code}`}>
      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight text-neutral-900">
          {plan.plan_code}
        </span>
        <TreatmentPlanStatusBadge status={plan.status} />
      </span>

      <span className="mt-3 block truncate text-lg font-semibold text-neutral-900">
        {patientName}
      </span>
      <span className="mt-1 block truncate text-sm text-neutral-500">{doctorName}</span>

      <span className="my-4 block h-px w-full bg-neutral-100" />

      <span className="flex w-full items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-neutral-500">
          {plan.item_count} {plan.item_count === 1 ? 'item' : 'items'}
        </span>
        <span className="shrink-0 text-base font-bold tracking-tight text-neutral-900">
          {formatFee(plan.total_estimated_cost, TREATMENT_PLAN_CURRENCY_SYMBOL)}
        </span>
      </span>
    </MobileCard>
  );
};
