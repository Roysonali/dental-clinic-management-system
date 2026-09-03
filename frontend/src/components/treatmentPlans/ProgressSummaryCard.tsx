import type { FC } from 'react';
import { FileText } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { TREATMENT_PLAN_CURRENCY_CODE } from '../../constants/treatmentPlan';
import { formatCurrency } from '../../utils/formatting';

interface ProgressSummaryCardProps {
  itemCount: number;
  totalEstimatedCost: number;
  className?: string;
}

/**
 * ProgressSummaryCard — S-10 scope-cut summary ([MAP §3.10]).
 *
 * Informational only: item count + total estimated cost straight from the
 * plan aggregate. There is deliberately NO progress percentage or per-status
 * item breakdown — no item-status endpoint exists (U3), so those numbers
 * could not be sourced from the backend.
 */
export const ProgressSummaryCard: FC<ProgressSummaryCardProps> = ({
  itemCount,
  totalEstimatedCost,
  className = '',
}) => {
  return (
    <Card className={className}>
      <Card.Header
        title="Plan Summary"
        subtitle="Items and estimated cost"
        icon={<FileText size={18} className="text-primary-500" />}
      />
      <Card.Body>
        <dl className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-neutral-50 p-4">
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Items</dt>
            <dd className="mt-1 text-h3 font-semibold text-neutral-900 tabular-nums">{itemCount}</dd>
          </div>
          <div className="rounded-lg bg-neutral-50 p-4">
            <dt className="text-caption font-medium uppercase tracking-wide text-neutral-500">Estimated Total (Gross)</dt>
            <dd className="mt-1 text-h3 font-semibold text-neutral-900 tabular-nums">
              {formatCurrency(totalEstimatedCost, TREATMENT_PLAN_CURRENCY_CODE)}
            </dd>
          </div>
        </dl>
      </Card.Body>
    </Card>
  );
};
