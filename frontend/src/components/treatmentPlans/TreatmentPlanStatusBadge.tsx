import type { FC } from 'react';
import { StatusBadge } from '../common/StatusBadge/StatusBadge';
import {
  TREATMENT_PLAN_STATUS_LABELS,
  TREATMENT_PLAN_STATUS_VARIANTS,
} from '../../constants/treatmentPlan';
import type { TreatmentPlanStatus } from '../../types/treatmentPlan';

interface TreatmentPlanStatusBadgeProps {
  status: TreatmentPlanStatus;
  size?: 'xs' | 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

/**
 * TreatmentPlanStatusBadge — the 9-status plan badge.
 *
 * Thin wrapper over the shared StatusBadge: the variant map comes from
 * module constants (single source of truth) so styling changes live in one
 * place ([MAP §7.1]).
 */
export const TreatmentPlanStatusBadge: FC<TreatmentPlanStatusBadgeProps> = ({
  status,
  size = 'sm',
  showDot = false,
  className,
}) => (
  <StatusBadge
    status={status}
    label={TREATMENT_PLAN_STATUS_LABELS[status]}
    statusMap={TREATMENT_PLAN_STATUS_VARIANTS}
    size={size}
    showDot={showDot}
    className={className}
  />
);
