import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { TreatmentPlanStatusBadge } from './TreatmentPlanStatusBadge';
import { TREATMENT_PLAN_CURRENCY_SYMBOL } from '../../constants/treatmentPlan';
import { formatFee } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import { useMyActiveTreatmentPlans } from '../../hooks/treatmentPlans/useMyActiveTreatmentPlans';
import { useAuth } from '../../hooks/auth/useAuth';
import { useQuery } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { ROUTES } from '../../routes/routes';
import type { TreatmentPlanListItem } from '../../types/treatmentPlan';

/**
 * ActiveTreatmentPlansCard — S-13 doctor-dashboard widget ([MAP §3.13]).
 *
 * Resolves the current user's doctor profile (`/doctors/user/{user_id}`),
 * then lists that doctor's active plans (by-doctor + is_active, 5 rows).
 * Row click → plan detail. No progress % (U3 — no per-item statuses).
 */
export const ActiveTreatmentPlansCard: FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const doctorQuery = useQuery({
    queryKey: ['doctors', 'by-user', user?.id ?? 0],
    queryFn: () => doctorService.getByUserId(user?.id as number),
    enabled: user?.id != null,
    staleTime: 5 * 60 * 1000,
  });

  const plansQuery = useMyActiveTreatmentPlans(doctorQuery.data?.id);

  const plans: TreatmentPlanListItem[] = plansQuery.data?.items ?? [];

  return (
    <Card>
      <Card.Header
        title="My Active Treatment Plans"
        subtitle="Plans in progress for your patients"
        icon={<ClipboardList size={18} className="text-primary-500" />}
      />
      <Card.Body>
        {plansQuery.isPending || doctorQuery.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="table-row" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No active treatment plans"
            description="Plans you are currently treating will appear here."
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition-colors duration-100 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm font-medium text-neutral-900">
                      {plan.plan_code}
                    </span>
                    <span className="block truncate text-caption text-neutral-400">
                      Patient #{plan.patient_id} · {plan.item_count} items
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-body-sm tabular-nums text-neutral-700 sm:inline">
                      {formatFee(plan.total_estimated_cost, TREATMENT_PLAN_CURRENCY_SYMBOL)}
                    </span>
                    <span className="hidden text-caption text-neutral-400 md:inline">
                      {formatISODate(plan.updated_at)}
                    </span>
                    <TreatmentPlanStatusBadge status={plan.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
};
