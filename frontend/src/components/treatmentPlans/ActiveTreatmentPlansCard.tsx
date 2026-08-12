import type { FC, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, TriangleAlert } from 'lucide-react';
import { Card } from '../common/Card/Card';
import { Skeleton } from '../common/Skeleton/Skeleton';
import { EmptyState } from '../common/EmptyState/EmptyState';
import { Button } from '../common/Button/Button';
import { TreatmentPlanStatusBadge } from './TreatmentPlanStatusBadge';
import { TREATMENT_PLAN_CURRENCY_CODE } from '../../constants/treatmentPlan';
import { formatCurrency } from '../../utils/formatting';
import { formatISODate } from '../../utils/date';
import { useMyActiveTreatmentPlans } from '../../hooks/treatmentPlans/useMyActiveTreatmentPlans';
import { useAuth } from '../../hooks/auth/useAuth';
import { useQuery } from '@tanstack/react-query';
import { doctorService } from '../../services/doctorService';
import { parseApiError } from '../../services/apiError';
import { ROUTES } from '../../routes/routes';
import type { TreatmentPlanListItem } from '../../types/treatmentPlan';

/**
 * Retry policy for the user→doctor lookup (`getByUserId`).
 *
 * Mirrors the app-wide `shouldRetryQuery` (never retry permanent 401/403
 * auth / cross-role failures) and additionally treats 404 as permanent:
 * the backend raises DoctorNotFound for accounts without a doctor profile,
 * so retrying only delays the empty state by one wasted request.
 */
function retryDoctorLookup(failureCount: number, error: unknown): boolean {
  const kind = parseApiError(error).kind;
  if (kind === 'auth' || kind === 'forbidden' || kind === 'not-found') {
    return false;
  }
  return failureCount < 1;
}

/**
 * ActiveTreatmentPlansCard — S-13 doctor-dashboard widget ([MAP §3.13]).
 *
 * Resolves the current user's doctor profile (`/doctors/user/{user_id}`),
 * then lists that doctor's active plans (by-doctor + is_active, 5 rows).
 * Row click → plan detail. No progress % (U3 — no per-item statuses).
 *
 * State handling:
 * - The user→doctor lookup 404s for non-doctor accounts (admin /
 *   receptionist / dental assistant — backend raises DoctorNotFound). That
 *   is a legitimate "no plans for you" state, NOT a failure: the widget
 *   renders the empty state instead of a skeleton.
 * - Any other lookup failure or a failed plans fetch renders an error state
 *   with a retry action — a failed request never leaves the widget on a
 *   permanent loading skeleton.
 */
export const ActiveTreatmentPlansCard: FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const doctorQuery = useQuery({
    queryKey: ['doctors', 'by-user', user?.id ?? 0],
    queryFn: () => doctorService.getByUserId(user?.id as number),
    enabled: user?.id != null,
    staleTime: 5 * 60 * 1000,
    // 401/403/404 are permanent conditions for this lookup (see
    // `retryDoctorLookup`) — never retry them; keep the default single
    // retry for transient failures.
    retry: retryDoctorLookup,
  });

  const plansQuery = useMyActiveTreatmentPlans(doctorQuery.data?.id);

  const doctorError = doctorQuery.error ? parseApiError(doctorQuery.error) : null;
  const plansError = plansQuery.error ? parseApiError(plansQuery.error) : null;

  const plans: TreatmentPlanListItem[] = plansQuery.data?.items ?? [];

  const renderBody = (): ReactNode => {
    /* ── Doctor lookup failed → terminal state (never a permanent skeleton). */
    if (doctorQuery.isError) {
      // 404 = the current user has no doctor profile → legitimately no
      // "My Active Treatment Plans" for this account.
      if (doctorError?.kind === 'not-found') {
        return (
          <EmptyState
            icon={ClipboardList}
            title="No active treatment plans"
            description="Plans you are currently treating will appear here."
          />
        );
      }
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load your treatment plans"
          description={doctorError?.message}
          primaryAction={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void doctorQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      );
    }

    /* ── Plans fetch failed → terminal error state (never swallowed into empty). */
    if (plansQuery.isError) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load your treatment plans"
          description={plansError?.message}
          primaryAction={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void plansQuery.refetch()}
            >
              Try again
            </Button>
          }
        />
      );
    }

    /* ── Loading only while a request is genuinely in flight: the doctor
           lookup, or — once the doctor is resolved — the plans fetch. A
           never-enabled plans query (no doctor id) is NOT pending-forever
           here because this branch requires doctorQuery.isSuccess. */
    if (doctorQuery.isPending || (doctorQuery.isSuccess && plansQuery.isPending)) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="table-row" />
          ))}
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="No active treatment plans"
          description="Plans you are currently treating will appear here."
        />
      );
    }

    return (
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
                  {formatCurrency(plan.total_estimated_cost, TREATMENT_PLAN_CURRENCY_CODE)}
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
    );
  };

  return (
    <Card>
      <Card.Header
        title="My Active Treatment Plans"
        subtitle="Plans in progress for your patients"
        icon={<ClipboardList size={18} className="text-primary-500" />}
      />
      <Card.Body>{renderBody()}</Card.Body>
    </Card>
  );
};
