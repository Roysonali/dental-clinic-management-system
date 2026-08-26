import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { DataTable } from '../common/DataTable/DataTable';
import { Button } from '../common/Button/Button';
import { Icon } from '../common/Icon/Icon';
import { TreatmentPlanStatusBadge } from '../treatmentPlans/TreatmentPlanStatusBadge';
import { useTreatmentPlans } from '../../hooks/treatmentPlans/useTreatmentPlans';
import { formatISODate } from '../../utils/date';
import { ROUTES } from '../../routes/routes';
import { apiErrorMessage } from '../../services/apiError';
import type { CreateActionType } from './PatientQuickActions';
import type { TreatmentPlanListItem } from '../../types/treatmentPlan';

interface PatientTreatmentPlansTabProps {
  patientId: string;
  /** Callback to open the contextual create drawer. When provided, the empty-state CTA
   *  uses this instead of navigating away from Patient Hub. */
  onCreateAction?: (action: CreateActionType) => void;
}

/**
 * PatientTreatmentPlansTab — renders a paginated list of treatment plans
 * belonging to a specific patient.
 *
 * Data source: GET /treatment-plans/by-patient/{patientId}
 * Reuses the existing DataTable infrastructure and TreatmentPlanStatusBadge.
 */
export const PatientTreatmentPlansTab: FC<PatientTreatmentPlansTabProps> = ({
  patientId,
  onCreateAction,
}) => {
  const navigate = useNavigate();

  const plansQuery = useTreatmentPlans({
    patient_id: patientId,
    page: 1,
    page_size: 20,
  });

  const items = useMemo(
    () => plansQuery.data?.items ?? [],
    [plansQuery.data?.items],
  );

  const queryError = plansQuery.error
    ? apiErrorMessage(plansQuery.error)
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <DataTable<TreatmentPlanListItem>
        ariaLabel="Patient treatment plans"
        data={items}
        rowKey={(plan) => plan.id}
        loading={plansQuery.isLoading}
        error={queryError}
        onRetry={() => void plansQuery.refetch()}
        onRowClick={(plan) =>
          navigate(`${ROUTES.TREATMENT_PLANS}/${plan.id}`)
        }
        emptyTitle="No treatment plans"
        emptyDescription="Treatment plans for this patient will appear here once created."
        emptyAction={
          <Button
            size="md"
            onClick={() =>
              onCreateAction
                ? onCreateAction('treatment-plan')
                : navigate(`${ROUTES.TREATMENT_PLANS}?create=true&patientId=${patientId}`)
            }
            leftIcon={<Icon icon={Plus} size="md" />}
            className="shrink-0 whitespace-nowrap"
          >
            New Treatment Plan
          </Button>
        }
        columns={[
          {
            key: 'plan_code',
            header: 'Plan #',
            accessor: 'plan_code',
            sortable: true,
            render: (row) => (
              <span className="font-mono text-caption text-neutral-600">
                {row.plan_code}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            accessor: 'status',
            sortable: true,
            render: (row) => (
              <TreatmentPlanStatusBadge status={row.status} size="sm" />
            ),
          },
          {
            key: 'created_at',
            header: 'Created',
            accessor: 'created_at',
            sortable: true,
            render: (row) => formatISODate(row.created_at),
          },
        ]}
      />
    </div>
  );
};
